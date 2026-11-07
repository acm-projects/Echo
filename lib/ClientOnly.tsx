import { ReactNode, useEffect, useState } from 'react';

// Web static rendering runs screens in Node, where browser-only APIs (like expo-audio's `Audio`) don't exist.
// Wrap those screens so they only render after mounting on the client.
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : null;
}
