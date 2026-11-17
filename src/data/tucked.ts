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
