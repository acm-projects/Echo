import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { currentSettings } from './settings';
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

// Nothing is loaded until the reader opens a book: the mini-player stays hidden and the Player says so.
let state: NowPlaying = {
  title: '',
  author: '',
  chapter: '',
  chapterNumber: 0,
  positionSec: 0,
  durationSec: 0,
  isPlaying: false,
  speed: 1,
  speaker: '',
};

/** Whether a book has been loaded into the player this session. */
export const hasTrack = (now: NowPlaying) => now.title !== '';

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
// A new chapter's audio is a new player item, which on iOS starts with the default pitch algorithm again.
let rateNeedsApply = false;

// Faster or slower speech at the same pitch. 'high' is the only quality web honours for keeping the pitch (anything
// else plays chipmunk-fast), and on iOS it picks the spectral algorithm, the cleanest for voices. Android always
// keeps the pitch while shouldCorrectPitch is on.
function applyRate(p: AudioPlayer, speed: number) {
  try {
    p.shouldCorrectPitch = true;
  } catch {
    // Read-only on some platforms; setPlaybackRate's quality still asks for pitch correction.
  }
  // Android's native setPlaybackRate takes the rate alone, and Expo rejects extra arguments.
  if (Platform.OS === 'android') p.setPlaybackRate(speed);
  else p.setPlaybackRate(speed, 'high');
}

function sleepNow() {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  set({ sleepEndsAt: undefined });
  pause();
}

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
  if (rateNeedsApply && status.isLoaded && player) {
    rateNeedsApply = false;
    applyRate(player, state.speed);
  }
  const now = Date.now();
  // Backs up the sleep timeout, which a phone may hold back while the app is in the background; status updates keep
  // arriving as long as audio plays.
  if (state.sleepEndsAt && now >= state.sleepEndsAt && status.playing) {
    sleepNow();
    return;
  }
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
    queue = [...(chapters ?? [])].sort((a, b) => a.chapterNumber - b.chapterNumber);
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
      rateNeedsApply = true;
    }
    applyRate(p, state.speed);
    // Paused (mini player, lock screen) while the chapter was still loading: keep it loaded but paused.
    if (!state.isPlaying) return;
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
  // The book's playable chapters in order (empty for a test book, whose chapters have no audio).
  chapters: () => queue,
  // Jumps to a chapter of the book that's playing and plays it from the start.
  playChapter: (chapterNumber: number) => {
    const item = queue.find((c) => c.chapterNumber === chapterNumber);
    if (!item || item.chapterNumber === state.chapterNumber) return;
    void playback.load({ title: state.title, author: state.author, bookId: state.bookId, ...item, queue });
  },
  nextChapter: () => {
    const upcoming = queue.find((c) => c.chapterNumber > state.chapterNumber);
    if (upcoming) playback.playChapter(upcoming.chapterNumber);
  },
  // Like a music player: a few seconds in, back goes to the start of this chapter; at the start, to the one before.
  previousChapter: () => {
    const before = [...queue].reverse().find((c) => c.chapterNumber < state.chapterNumber);
    if (state.positionSec > 5 || !before) return playback.seek(0);
    playback.playChapter(before.chapterNumber);
  },
  setSpeed: (speed: number) => {
    if (state.audioPath && player) applyRate(player, speed);
    set({ speed });
  },
  // Pauses playback `minutes` from now (any length; 0 or less turns the timer off). Starting it again restarts it.
  setSleepTimer: (minutes: number) => {
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = null;
    if (!(minutes > 0)) return set({ sleepEndsAt: undefined });
    const ms = Math.round(minutes * 60_000);
    sleepTimer = setTimeout(sleepNow, ms);
    set({ sleepEndsAt: Date.now() + ms });
  },
  // Adds time to a running timer (or starts one).
  extendSleepTimer: (minutes: number) => {
    const left = state.sleepEndsAt ? Math.max(0, state.sleepEndsAt - Date.now()) / 60_000 : 0;
    playback.setSleepTimer(left + minutes);
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

/** Seconds until the sleep timer pauses playback, ticking every second; null with no timer running. */
export function useSleepCountdown() {
  const { sleepEndsAt } = useNowPlaying();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!sleepEndsAt) return;
    setNowMs(Date.now());
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [sleepEndsAt]);
  return sleepEndsAt ? Math.max(0, Math.ceil((sleepEndsAt - nowMs) / 1000)) : null;
}

/** "4:05" or "1:02:30" for a countdown. */
export function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
