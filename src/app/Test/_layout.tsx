import { Stack } from 'expo-router';

// Expo Router 58 tabs redirect any screen that isn't a declared tab, so the tab screens live in the
// (tabs) group and everything else (welcome, auth, book details, voice lab) is a plain stack screen.
export default function TestLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 320, contentStyle: { backgroundColor: '#030818' } }} />;
}
