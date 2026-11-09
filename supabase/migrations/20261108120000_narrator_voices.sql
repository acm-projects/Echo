-- =============================================================================
-- Migration: narrator_voices
--
-- Narrator voices a user designs in the app. Gemini creates the voice; the
-- server keeps two clips of it in S3 and records where they are here:
--   reference_path  the long, neutral Gemini sample IndexTTS clones from
--   preview_path    the short clip the app plays in the narrator picker
--
-- S3 columns across the schema (books.source_file_path, chapters.audio_s3_url,
-- characters.voice_sample_path, and these) hold keys relative to the bucket,
-- e.g. 'books/<book id>/audio.mp3', never full or signed URLs: signed links
-- expire, and the bucket can change without rewriting rows.
--
-- Only the service_role server writes rows; users read their own.
-- =============================================================================

create table public.narrator_voices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,

  voice_id        text not null unique,                     -- Gemini voice id
  name            text not null check (char_length(name) between 1 and 40),
  description     text not null check (char_length(description) <= 400),
  sample_text     text not null check (char_length(sample_text) <= 500),

  reference_path  text not null,                            -- S3 key, cloning reference
  preview_path    text not null,                            -- S3 key, preview clip

  -- The narrator new books are read with. At most one per user.
  is_selected     boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index uq_narrator_voices_one_selected
  on public.narrator_voices (user_id)
  where is_selected;
create index idx_narrator_voices_user on public.narrator_voices (user_id, created_at desc);

create trigger trg_narrator_voices_updated_at
  before update on public.narrator_voices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.narrator_voices enable row level security;

create policy "read own narrator voices"
  on public.narrator_voices for select to authenticated
  using (user_id = auth.uid());

-- No write policies: creating a narrator spends Gemini quota, so only the
-- server (service_role) inserts rows, and it also changes the selection.
revoke insert, update, delete on public.narrator_voices from anon, authenticated;
