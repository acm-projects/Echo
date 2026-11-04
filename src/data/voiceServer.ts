import Constants from 'expo-constants';
import { Platform } from 'react-native';

const VOICE_SERVER_PORT = 8787;

// On a phone or emulator, 127.0.0.1 is the device itself, so default to the machine running the Expo dev server.
function resolveVoiceServerUrl() {
  if (process.env.EXPO_PUBLIC_VOICE_SERVER_URL) return process.env.EXPO_PUBLIC_VOICE_SERVER_URL.replace(/\/$/, '');
  if (Platform.OS === 'web') {
    const host = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname;
    return `http://${host}:${VOICE_SERVER_PORT}`;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) return `http://${devHost}:${VOICE_SERVER_PORT}`;
  // The Android emulator reaches the host machine through 10.0.2.2.
  return `http://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:${VOICE_SERVER_PORT}`;
}

export const VOICE_SERVER_URL = resolveVoiceServerUrl();
