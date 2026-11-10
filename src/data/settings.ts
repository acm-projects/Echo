import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Listening preferences live on the device; nothing here needs the server.
export type Settings = {
  playbackSpeed: number;
  skipSeconds: 10 | 15 | 30;
  sleepTimerMinutes: 0 | 15 | 30 | 45 | 60;
  characterVoices: boolean;
  autoplayNextChapter: boolean;
  dailyReminder: boolean;
  friendActivity: boolean;
  newChapters: boolean;
  // Each kind of animation can be switched off on its own (Reduce Motion in the OS turns them all off).
  motionNavigation: boolean;
  motionOpening: boolean;
  motionRooms: boolean;
  motionBackground: boolean;
  motionDetails: boolean;
  motionLoader: boolean;
};

export type MotionKind = 'navigation' | 'opening' | 'rooms' | 'background' | 'details' | 'loader';
export const MOTION_KEYS = {
  navigation: 'motionNavigation',
  opening: 'motionOpening',
  rooms: 'motionRooms',
  background: 'motionBackground',
  details: 'motionDetails',
  loader: 'motionLoader',
} as const satisfies Record<MotionKind, keyof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  playbackSpeed: 1,
  skipSeconds: 15,
  sleepTimerMinutes: 0,
  characterVoices: true,
  autoplayNextChapter: true,
  dailyReminder: true,
  friendActivity: true,
  newChapters: false,
  motionNavigation: true,
  motionOpening: true,
  motionRooms: true,
  motionBackground: true,
  motionDetails: true,
  motionLoader: true,
};

const KEY = 'echo.settings.v1';
let cache: Settings | null = null;
const listeners = new Set<(settings: Settings) => void>();

async function load(): Promise<Settings> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache!;
}

/** The settings as last loaded, for code outside React (navigation decides on the spot). */
export function currentSettings(): Settings {
  return cache ?? DEFAULT_SETTINGS;
}

/** Changes one setting from outside React (the sleep timer turning itself off, say); screens update immediately. */
export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const next = { ...(cache ?? DEFAULT_SETTINGS), [key]: value };
  cache = next;
  listeners.forEach((listener) => listener(next));
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

/** Loads the saved settings, for code outside React that needs them before any screen has. */
export const loadSettings = load;

/** Shared settings: every screen using this hook sees updates immediately. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(cache ?? DEFAULT_SETTINGS);

  useEffect(() => {
    load().then(setSettings);
    listeners.add(setSettings);
    return () => {
      listeners.delete(setSettings);
    };
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => saveSetting(key, value), []);

  return [settings, update] as const;
}
