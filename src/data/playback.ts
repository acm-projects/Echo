import { useEffect, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { currentSettings, saveSetting } from './settings';
import { mediaUrl, VOICE_SERVER_URL, voiceServerHeaders } from './voiceServer';
import { recordListening, saveProgress } from './progress';

// Playback shared by the mini-player and the Player screen. A chapter with stored audio (an audioPath) plays through
// one expo-audio player, in the background and on the lock screen, saves where the reader is, and counts listening
// time toward their streak. The test books have no audio, so they keep a simulated clock, which advances while
// playing so skip, speed and the progress bars all behave like the real thing.
export type NowPlaying = {
  title: string;
  author: string;
  chapter: string;
  chapterNumber: number;
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
  speed: number;
  // Who is speaking right now, from the chapter's timeline; empty when the chapter has none.
  speaker: string;
  bookId?: string;
  chapterId?: string;
  audioPath?: string;
  // When the sleep timer pauses playback (epoch ms), if one is set.
  sleepEndsAt?: number;
  error?: string;
};

/** A chapter that can be played, for moving on to the next one when a chapter ends. */
export type QueuedChapter = { chapter: string; chapterNumber: number; chapterId?: string; audioPath: string; durationSec?: number };

type TimelineEntry = { startSec: number; speaker: string };

const SIMULATED_DURATION_SEC = 40 * 60;
// Progress is saved this often while playing, and whenever playback pauses or a chapter ends.
const SAVE_EVERY_MS = 15_000;

let state: NowPlaying = {
  title: 'The Night Circus',
  author: 'Erin Morgenstern',
  chapter: 'The room beneath the stars',
  chapterNumber: 7,
  positionSec: 14 * 60 + 22,
  durationSec: SIMULATED_DURATION_SEC,
  isPlaying: false,
  speed: 1,
  speaker: 'Narrator',
};

const listeners = new Set<(s: NowPlaying) => void>();
let ticker: ReturnType<typeof setInterval> | null = null;
let queue: QueuedChapter[] = [];
let player: AudioPlayer | null = null;
let timeline: TimelineEntry[] = [];
// Each load bumps this, so a slow link or timeline for a chapter the reader already left is ignored.
let loadToken = 0;
let pendingSeekSec: number | null = null;
let listenedSec = 0;
let lastStatusAt = 0;
let lastSavedAt = 0;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
let sleepMinutes = 0;

function set(patch: Partial<NowPlaying>) {
  state = { ...state, ...patch };
  // The real player reports its own position and end; only the simulated clock is clamped here.
  if (!state.audioPath) {
    state.positionSec = Math.max(0, Math.min(state.durationSec, state.positionSec));
    if (state.positionSec >= state.durationSec) state.isPlaying = false;
  }
  listeners.forEach((l) => l(state));
  const simulate = state.isPlaying && !state.audioPath;
  if (simulate && !ticker) ticker = setInterval(() => set({ positionSec: state.positionSec + state.speed }), 1000);
  if (!simulate && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function speakerAt(sec: number) {
  let speaker = '';
  for (const entry of timeline) {
    if (entry.startSec > sec) break;
    speaker = entry.speaker;
  }
  return speaker;
}

// Saves the reader's place in a real book, and adds the time listened since the last save to their streak.
function flushProgress(chapterDone = false) {
  if (!state.bookId || !state.chapterId) return;
  const lastChapter = !queue.some((item) => item.chapterNumber > state.chapterNumber);
  void saveProgress({
    bookId: state.bookId,
    chapterId: state.chapterId,
    positionMs: (chapterDone ? state.durationSec : state.positionSec) * 1000,
    speed: state.speed,
    completed: chapterDone && lastChapter,
  });
  void recordListening(listenedSec, chapterDone ? 1 : 0);
  listenedSec = 0;
  lastSavedAt = Date.now();
}

function onStatus(status: AudioStatus) {
  if (!state.audioPath) return;
  if (pendingSeekSec !== null && status.isLoaded) {
    player?.seekTo(pendingSeekSec).catch(() => {});
    pendingSeekSec = null;
  }
  const now = Date.now();
  // Wall-clock time spent listening, so 2x speed counts the minutes actually spent.
  if (status.playing && lastStatusAt) listenedSec += Math.min(now - lastStatusAt, 2000) / 1000;
  lastStatusAt = status.playing ? now : 0;
  const wasPlaying = state.isPlaying;
  set({
    positionSec: status.currentTime,
    durationSec: status.duration > 0 ? status.duration : state.durationSec,
    isPlaying: status.playing,
    speaker: speakerAt(status.currentTime),
  });
  if (status.didJustFinish) {
    flushProgress(true);
    next();
  } else if ((wasPlaying && !status.playing) || (status.playing && now - lastSavedAt > SAVE_EVERY_MS)) {
    flushProgress();
  }
}

// Created on first real playback, which is always a tap, so web's static render never touches the audio API.
function audio() {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 500 });
    // Keeps playing with the screen locked or the app in the background; lock-screen controls need doNotMix.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
    player.addListener('playbackStatusUpdate', onStatus);
  }
  return player;
}

function showOnLockScreen() {
  try {
    player?.setActiveForLockScreen?.(true, { title: state.chapter, artist: state.author, albumTitle: state.title }, { showSeekBackward: true, showSeekForward: true });
  } catch {
    // Not every platform has lock-screen controls (web).
  }
}

async function loadTimeline(bookId: string | undefined, chapterIndex: number, token: number) {
  timeline = [];
  if (!bookId) return;
  try {
    const response = await fetch(`${VOICE_SERVER_URL}/api/books/${bookId}/chapters/${chapterIndex}/timeline`, { headers: await voiceServerHeaders() });
    const data = (await response.json()) as { timeline?: TimelineEntry[] };
    if (token === loadToken) timeline = data.timeline ?? [];
  } catch {
    // Without a timeline the player just says "Playing".
  }
}

// Moves on to the next playable chapter of the same book when the listener has autoplay on.
function next() {
  const upcoming = queue.find((item) => item.chapterNumber > state.chapterNumber);
  if (upcoming && currentSettings().autoplayNextChapter) void playback.load({ title: state.title, author: state.author, bookId: state.bookId, ...upcoming, queue });
  else set({ isPlaying: false });
}

function pause() {
  if (state.audioPath) player?.pause();
  set({ isPlaying: false });
}

type LoadInput = {
  title: string;
  author: string;
  chapter: string;
  chapterNumber: number;
  bookId?: string;
  chapterId?: string;
  audioPath?: string;
  durationSec?: number;
  // Where to start, for picking a book back up.
  startAtSec?: number;
  queue?: QueuedChapter[];
};

export const playback = {
  // Switch to a book/chapter and start playing; keeps the position when it's the same chapter.
  load: async (book: LoadInput) => {
    const { queue: chapters, durationSec, startAtSec, ...rest } = book;
    queue = chapters ?? [];
    const token = ++loadToken;
    if (!book.audioPath) {
      if (state.audioPath) {
        flushProgress();
        player?.pause();
      }
      const same = book.title === state.title && book.chapterNumber === state.chapterNumber && !state.audioPath;
      set({ ...rest, audioPath: undefined, chapterId: undefined, error: undefined, durationSec: state.audioPath ? SIMULATED_DURATION_SEC : state.durationSec, positionSec: same ? state.positionSec : 0, isPlaying: true, speaker: 'Narrator' });
      return;
    }
    const same = book.audioPath === state.audioPath;
    if (!same) flushProgress();
    set({ ...rest, error: undefined, durationSec: same ? state.durationSec : durationSec ?? 0, positionSec: same ? state.positionSec : startAtSec ?? 0, isPlaying: true, speaker: '' });
    const p = audio();
    if (!same) {
      void loadTimeline(book.bookId, book.chapterNumber - 1, token);
      let uri: string | null;
      try {
        uri = await mediaUrl(book.audioPath);
      } catch (error) {
        if (token === loadToken) set({ isPlaying: false, error: error instanceof Error ? error.message : 'Could not open that chapter.' });
        return;
      }
      if (token !== loadToken || !uri) return;
      pendingSeekSec = startAtSec && startAtSec > 1 ? startAtSec : null;
      p.replace({ uri });
    }
    p.setPlaybackRate(state.speed);
    p.play();
    showOnLockScreen();
  },
  toggle: () => {
    if (state.isPlaying) return pause();
    if (state.audioPath && player) {
      // Play after the chapter ended starts it again.
      if (state.durationSec > 0 && state.positionSec >= state.durationSec - 0.5) player.seekTo(0).catch(() => {});
      player.play();
    }
    set({ isPlaying: true });
  },
  skip: (seconds: number) => {
    const position = Math.max(0, Math.min(state.durationSec, state.positionSec + seconds));
    if (state.audioPath) player?.seekTo(position).catch(() => {});
    set({ positionSec: position });
  },
  seek: (fraction: number) => {
    const position = Math.max(0, Math.min(1, fraction)) * state.durationSec;
    if (state.audioPath) player?.seekTo(position).catch(() => {});
    set({ positionSec: position });
  },
  setSpeed: (speed: number) => {
    if (state.audioPath) player?.setPlaybackRate(speed);
    set({ speed });
  },
  // Pauses after `minutes` (0 cancels) and switches the setting back off. Setting the same minutes again keeps
  // the timer that's already running, so reopening the player doesn't restart it.
  setSleepTimer: (minutes: number) => {
    if (minutes === sleepMinutes) return;
    sleepMinutes = minutes;
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = null;
    if (!minutes) return set({ sleepEndsAt: undefined });
    const endsAt = Date.now() + minutes * 60_000;
    sleepTimer = setTimeout(() => {
      sleepTimer = null;
      sleepMinutes = 0;
      pause();
      set({ sleepEndsAt: undefined });
      saveSetting('sleepTimerMinutes', 0);
    }, minutes * 60_000);
    set({ sleepEndsAt: endsAt });
  },
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
