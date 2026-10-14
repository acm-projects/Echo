-- =============================================================================
-- Migration: voice_jobs
--
-- When a user changes a character's voice, the laptop server must re-generate
-- all of that character's lines. A voice job is the request for that work.
--
--   user changes voice  ->  app inserts a job (status 'queued')
--   server picks it up  ->  'processing'  ->  'ready' or 'failed'
--
-- Reuses the processing_status enum: queued -> processing -> ready / failed.
-- Book owners create and read their own jobs; only the server updates them.
-- =============================================================================

create table public.voice_jobs (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books (id) on delete cascade,
  character_id  uuid not null,
  requested_by  uuid not null default auth.uid()
                  references public.users (id) on delete cascade,

  status        processing_status not null default 'queued',
  error_message text,

  created_at    timestamptz not null default now(),
  started_at    timestamptz,                      -- set when status becomes 'processing'
  finished_at   timestamptz,                      -- set when status becomes 'ready' or 'failed'
  updated_at    timestamptz not null default now(),

  -- Only the four job states are valid ('uploaded' belongs to books)
  constraint voice_jobs_status_check
    check (status in ('queued', 'processing', 'ready', 'failed')),

  -- The character must belong to the SAME book as the job
  constraint voice_jobs_character_fk
    foreign key (character_id, book_id)
    references public.characters (id, book_id) on delete cascade
);

-- At most one WAITING job per character. A second change while one is still
-- queued is redundant, because the server reads the character's current voice
-- when it starts. A new job can still be queued while one is processing.
create unique index uq_voice_jobs_one_queued_per_character
  on public.voice_jobs (character_id)
  where status = 'queued';

-- Worker queue scan: oldest unfinished jobs first
create index idx_voice_jobs_queue
  on public.voice_jobs (created_at)
  where status in ('queued', 'processing');

create index idx_voice_jobs_requested_by on public.voice_jobs (requested_by, created_at desc);
create index idx_voice_jobs_character    on public.voice_jobs (character_id, created_at desc);
create index idx_voice_jobs_book         on public.voice_jobs (book_id);

create trigger trg_voice_jobs_updated_at
  before update on public.voice_jobs
  for each row execute function public.set_updated_at();

-- Stamp started_at / finished_at automatically when the server changes status
create or replace function public.voice_jobs_stamp_times()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'processing' then
      new.started_at := coalesce(new.started_at, now());
    elsif new.status in ('ready', 'failed') then
      new.finished_at := coalesce(new.finished_at, now());
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_voice_jobs_stamp_times
  before update on public.voice_jobs
  for each row execute function public.voice_jobs_stamp_times();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.voice_jobs enable row level security;

-- Read your own jobs
create policy "read own voice jobs"
  on public.voice_jobs for select to authenticated
  using (requested_by = auth.uid());

-- Create a job only for a book you own, as yourself, in the 'queued' state
create policy "book owner creates voice jobs"
  on public.voice_jobs for insert to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'queued'
    and error_message is null
    and exists (
      select 1 from public.books b
       where b.id = voice_jobs.book_id
         and b.user_id = auth.uid()
         and b.deleted_at is null
    )
  );

-- No update or delete policies: only the service_role server changes a job.
-- Privileges are also locked at the column level as a second barrier.
revoke insert, update, delete on public.voice_jobs from anon, authenticated;
grant  insert (book_id, character_id) on public.voice_jobs to authenticated;

-- =============================================================================
-- Notes
--  * Client request:  insert into voice_jobs (book_id, character_id) values (...);
--    requested_by fills itself in from the signed-in user. If it fails with a
--    unique-violation, a job for that character is already waiting.
--  * Server flow: select the oldest 'queued' job, set status = 'processing',
--    re-generate the character's script lines and audio, then set 'ready', or
--    'failed' with error_message. Timestamps fill themselves in.
--  * To let the app watch a job update live, enable Realtime for the table:
--      alter publication supabase_realtime add table public.voice_jobs;
-- =============================================================================