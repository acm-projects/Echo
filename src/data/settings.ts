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
};

export const DEFAULT_SETTINGS: Settings = {
  playbackSpeed: 1,
  skipSeconds: 15,
  sleepTimerMinutes: 0,
  characterVoices: true,
  autoplayNextChapter: true,
  dailyReminder: true,
  friendActivity: true,
  newChapters: false,
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

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...(cache ?? DEFAULT_SETTINGS), [key]: value };
    cache = next;
    listeners.forEach((listener) => listener(next));
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  return [settings, update] as const;
}
