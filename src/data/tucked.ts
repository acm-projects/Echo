import AsyncStorage from '@react-native-async-storage/async-storage';

// Presentation helper: a hidden switch (five quick taps on Help & support's intro line) that keeps the demo book off this
// device's lists of the reader's books, so a fresh upload of it can be shown. It hides the copies that exist when it's
// switched on, so the one made during the demo still appears. Nothing on screen shows the switch's state.
//
// Kept on this device only, per account. With nothing saved yet, the presenter's account (DEMO_OWNER, which holds the
// demo's master copy) starts hidden and every other account starts shown.

const DEMO_OWNER = '0ba503d8-5db1-4a86-9f8d-de2550389ba0';
const DEMO_TITLE = 'night ferry';
const keyFor = (userId: string) => `echo.shelf.tucked.${userId}`;
const titleKey = (title: string) => title.toLowerCase().replace(/\s*\(\d+\)$/, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
const demoCopies = (books: Array<{ id: string; title: string }>) => books.filter((book) => titleKey(book.title) === DEMO_TITLE).map((book) => book.id);

// Saved state per account: the hidden book ids (an empty list means shown on purpose).
const cache = new Map<string, Set<string>>();

async function save(userId: string, ids: string[]) {
  cache.set(userId, new Set(ids));
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(ids)).catch(() => {});
}

/** The ids hidden for this account, given its full list of books (used to apply the default the first time). */
export async function tuckedBookIds(userId: string, books: Array<{ id: string; title: string }>): Promise<Set<string>> {
  const cached = cache.get(userId);
  if (cached) return cached;
  let saved: string[] | null = null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    saved = raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    saved = null;
  }
  if (saved) {
    cache.set(userId, new Set(saved));
    return cache.get(userId)!;
  }
  // First time on this device: hidden for the presenter, shown for everyone else.
  if (userId === DEMO_OWNER) await save(userId, demoCopies(books));
  else cache.set(userId, new Set());
  return cache.get(userId)!;
}

/** Hides this account's current demo-book copies, or shows them again. Returns whether they're hidden now. */
export async function toggleTucked(userId: string, books: Array<{ id: string; title: string }>) {
  const hidden = await tuckedBookIds(userId, books);
  const next = hidden.size ? [] : demoCopies(books);
  await save(userId, next);
  return next.length > 0;
}

// ---- the demo narrator ---------------------------------------------------------------------------------------------
// A ready-made voice on the presenter's account ("Narrator": British, male, confident), kept out of the voice lists
// while hidden. If making a voice live takes longer than NARRATOR_FAILSAFE_SECONDS, it appears (armNarratorFailsafe)
// and stays shown until its own switch hides it again (five quick taps on "Can I change the narrator's voice?" in Help & support). It's
// separate from the book's switch: neither one changes the other.

export const DEMO_NARRATOR_VOICE = 'voice_sjfkfs08iwc8';
const narratorKeyFor = (userId: string) => `echo.studio.tucked.${userId}`;
const narratorCache = new Map<string, boolean>();

async function signedInUserId() {
  const { supabase } = await import('../../lib/supabase');
  return (await supabase.auth.getSession()).data.session?.user.id ?? null;
}

/** Whether the demo narrator is hidden for this account. With nothing saved, hidden for the presenter (like the book). */
export async function narratorTucked(userId: string): Promise<boolean> {
  const cached = narratorCache.get(userId);
  if (cached !== undefined) return cached;
  let hidden = userId === DEMO_OWNER;
  try {
    const raw = await AsyncStorage.getItem(narratorKeyFor(userId));
    if (raw !== null) hidden = raw === '1';
  } catch {}
  narratorCache.set(userId, hidden);
  return hidden;
}

export async function setNarratorTucked(userId: string, hidden: boolean) {
  narratorCache.set(userId, hidden);
  await AsyncStorage.setItem(narratorKeyFor(userId), hidden ? '1' : '0').catch(() => {});
}

/** Flips only the demo narrator for whoever is signed in. Returns whether it's hidden now. */
export async function toggleNarratorTucked() {
  const userId = await signedInUserId();
  if (!userId) return false;
  const next = !(await narratorTucked(userId));
  await setNarratorTucked(userId, next);
  return next;
}

/** Drops the demo narrator from a voice list while it's hidden for the signed-in reader (and clears it as selected). */
export async function withoutTuckedNarrator<T extends { voices: Array<{ id: string }>; selectedId: string | null }>(state: T): Promise<T> {
  if (!state.voices.some((voice) => voice.id === DEMO_NARRATOR_VOICE)) return state;
  const userId = await signedInUserId().catch(() => null);
  if (!userId || !(await narratorTucked(userId))) return state;
  return {
    ...state,
    voices: state.voices.filter((voice) => voice.id !== DEMO_NARRATOR_VOICE),
    selectedId: state.selectedId === DEMO_NARRATOR_VOICE ? null : state.selectedId,
  };
}

/**
 * Call when Create is tapped. While the demo narrator is hidden, it's shown after `seconds` (from this call) unless the
 * returned cancel runs first, then `onReveal` runs. While it's shown, this does nothing.
 */
export function armNarratorFailsafe(seconds: number, onReveal: () => void): () => void {
  const startedAt = Date.now();
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  void (async () => {
    const userId = await signedInUserId().catch(() => null);
    if (cancelled || !userId || !(await narratorTucked(userId)) || cancelled) return;
    timer = setTimeout(() => {
      if (cancelled) return;
      void setNarratorTucked(userId, false).then(() => { if (!cancelled) onReveal(); });
    }, Math.max(0, seconds * 1000 - (Date.now() - startedAt)));
  })();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
