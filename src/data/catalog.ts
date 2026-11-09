import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Public-domain classics offered on the Upload tab. Saving one keeps it on a "for later" list on this device;
// narrating one downloads its Project Gutenberg text (gutenbergId is the ebook number on gutenberg.org).
export type Classic = { id: string; title: string; author: string; year: string; accent: string; blurb: string; gutenbergId: number };

export const CLASSICS: Classic[] = [
  { id: 'pride-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', year: '1813', accent: '#7D5C75', blurb: 'Elizabeth Bennet trades barbs with the proud Mr. Darcy in a comedy of manners full of voices to tell apart.', gutenbergId: 1342 },
  { id: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', year: '1818', accent: '#45584D', blurb: 'A young scientist builds a life and then runs from it. Told in letters and confessions, it was made for a storm-lit night.', gutenbergId: 84 },
  { id: 'dracula', title: 'Dracula', author: 'Bram Stoker', year: '1897', accent: '#603D49', blurb: 'Diaries, letters and telegrams trace a count from Transylvania to London. A whole cast, each with a voice of their own.', gutenbergId: 345 },
  { id: 'gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: '1925', accent: '#3E596A', blurb: 'Nick Carraway watches his neighbour throw glittering parties for one person who never comes.', gutenbergId: 64317 },
  { id: 'sherlock', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', year: '1892', accent: '#4E4A6B', blurb: 'Twelve short mysteries, perfect one-a-night listening, with Holmes and Watson trading lines.', gutenbergId: 1661 },
  { id: 'alice', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', year: '1865', accent: '#6B4A62', blurb: 'A rabbit hole, a mad tea party and a queen who shouts. A riot of characters for Echo to give voices to.', gutenbergId: 11 },
  { id: 'jane-eyre', title: 'Jane Eyre', author: 'Charlotte Brontë', year: '1847', accent: '#5A4A3E', blurb: 'An orphan turned governess finds a home, a secret and her own voice at Thornfield Hall.', gutenbergId: 1260 },
  { id: 'time-machine', title: 'The Time Machine', author: 'H. G. Wells', year: '1895', accent: '#3E5A5A', blurb: 'An inventor tells his dinner guests about the far future he has just come back from.', gutenbergId: 35 },
];

const KEY = 'echo.savedClassics.v1';
let saved: Set<string> | null = null;
const listeners = new Set<(ids: Set<string>) => void>();

export function useSavedClassics() {
  const [ids, setIds] = useState<Set<string>>(saved ?? new Set());

  useEffect(() => {
    listeners.add(setIds);
    if (!saved) {
      AsyncStorage.getItem(KEY)
        .then((raw) => (saved = new Set(raw ? JSON.parse(raw) : [])))
        .catch(() => (saved = new Set()))
        .then(() => listeners.forEach((l) => l(saved!)));
    }
    return () => {
      listeners.delete(setIds);
    };
  }, []);

  const toggle = (id: string) => {
    const next = new Set(saved ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saved = next;
    listeners.forEach((l) => l(next));
    AsyncStorage.setItem(KEY, JSON.stringify([...next])).catch(() => {});
  };

  return [ids, toggle] as const;
}
