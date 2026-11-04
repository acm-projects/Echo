import { useEffect, useState } from 'react';

// Simulated playback shared by the mini-player and the Player screen until real chapter audio is wired up.
// Position advances while playing, so skip, speed and the progress bars all behave like the real thing.
export type NowPlaying = {
  title: string;
  author: string;
  chapter: string;
  chapterNumber: number;
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
  speed: number;
  speaker: string;
};

let state: NowPlaying = {
  title: 'The Night Circus',
  author: 'Erin Morgenstern',
  chapter: 'The room beneath the stars',
  chapterNumber: 7,
  positionSec: 14 * 60 + 22,
  durationSec: 40 * 60,
  isPlaying: false,
  speed: 1,
  speaker: 'Narrator',
};

const listeners = new Set<(s: NowPlaying) => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function set(patch: Partial<NowPlaying>) {
  state = { ...state, ...patch };
  state.positionSec = Math.max(0, Math.min(state.durationSec, state.positionSec));
  if (state.positionSec >= state.durationSec) state.isPlaying = false;
  listeners.forEach((l) => l(state));
  if (state.isPlaying && !ticker) ticker = setInterval(() => set({ positionSec: state.positionSec + state.speed }), 1000);
  if (!state.isPlaying && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

export const playback = {
  // Switch to a book/chapter and start playing; keeps the position when it's the same chapter.
  load: (book: { title: string; author: string; chapter: string; chapterNumber: number }) => {
    const same = book.title === state.title && book.chapterNumber === state.chapterNumber;
    set({ ...book, positionSec: same ? state.positionSec : 0, isPlaying: true, speaker: 'Narrator' });
  },
  toggle: () => set({ isPlaying: !state.isPlaying }),
  skip: (seconds: number) => set({ positionSec: state.positionSec + seconds }),
  seek: (fraction: number) => set({ positionSec: fraction * state.durationSec }),
  setSpeed: (speed: number) => set({ speed }),
};

export function useNowPlaying() {
  const [now, setNow] = useState(state);
  useEffect(() => {
    listeners.add(setNow);
    setNow(state);
    return () => {
      listeners.delete(setNow);
    };
  }, []);
  return now;
}

export function formatTime(totalSec: number) {
  const sec = Math.floor(totalSec);
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}
