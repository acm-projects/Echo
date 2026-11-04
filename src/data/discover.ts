import type { Ionicons } from '@expo/vector-icons';

// Discovery content for the Library tab. Static until there's a recommendation service; every book here is in the
// public domain so it can be narrated once catalog narration exists.
export type DiscoverBook = { title: string; author: string; genre: GenreId; accent: string; blurb: string };
export type GenreId = 'fantasy' | 'classics' | 'romance' | 'mystery' | 'horror' | 'adventure';

export const GENRES: { id: GenreId; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: 'fantasy', label: 'Fantasy & Sci-Fi', icon: 'planet-outline', color: '#9C7BFF' },
  { id: 'classics', label: 'Classics', icon: 'book-outline', color: '#C9A26B' },
  { id: 'romance', label: 'Romance', icon: 'heart-outline', color: '#FF8FB1' },
  { id: 'mystery', label: 'Mystery', icon: 'search-outline', color: '#6FC3C9' },
  { id: 'horror', label: 'Horror', icon: 'moon-outline', color: '#E0667A' },
  { id: 'adventure', label: 'Adventure', icon: 'compass-outline', color: '#FFB45E' },
];

export const DISCOVER_BOOKS: DiscoverBook[] = [
  { title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', genre: 'fantasy', accent: '#5A3A78', blurb: 'A rabbit hole, a mad tea party and a queen who shouts.' },
  { title: 'The Time Machine', author: 'H. G. Wells', genre: 'fantasy', accent: '#2E4A5C', blurb: 'An inventor tells his dinner guests about the far future.' },
  { title: 'Twenty Thousand Leagues Under the Seas', author: 'Jules Verne', genre: 'fantasy', accent: '#1F4A5A', blurb: 'Captain Nemo and the Nautilus, deep beneath the waves.' },
  { title: 'The War of the Worlds', author: 'H. G. Wells', genre: 'fantasy', accent: '#5C2D2D', blurb: 'Cylinders fall on Surrey, and nothing is the same.' },
  { title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'romance', accent: '#7D5C75', blurb: 'Elizabeth Bennet and the proud Mr. Darcy.' },
  { title: 'Jane Eyre', author: 'Charlotte Brontë', genre: 'romance', accent: '#5A4A3E', blurb: 'An orphan turned governess finds her own voice.' },
  { title: 'Persuasion', author: 'Jane Austen', genre: 'romance', accent: '#4A5A6B', blurb: 'A second chance, eight years after a broken engagement.' },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', genre: 'classics', accent: '#1F5A6B', blurb: 'Glittering parties for one person who never comes.' },
  { title: 'Moby-Dick', author: 'Herman Melville', genre: 'classics', accent: '#2E3A5C', blurb: 'Call me Ishmael. A captain, a whale, an obsession.' },
  { title: 'Little Women', author: 'Louisa May Alcott', genre: 'classics', accent: '#6B4A3A', blurb: 'Four sisters growing up through hard, warm years.' },
  { title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', genre: 'mystery', accent: '#4E4A6B', blurb: 'Twelve short mysteries, perfect one a night.' },
  { title: 'The Moonstone', author: 'Wilkie Collins', genre: 'mystery', accent: '#3E5A5A', blurb: 'A cursed diamond vanishes on a birthday night.' },
  { title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'mystery', accent: '#3A3A2E', blurb: 'A legend, a moor, and a hound in the fog.' },
  { title: 'Frankenstein', author: 'Mary Shelley', genre: 'horror', accent: '#45584D', blurb: 'A scientist builds a life, then runs from it.' },
  { title: 'Dracula', author: 'Bram Stoker', genre: 'horror', accent: '#603D49', blurb: 'Diaries and letters trace a count to London.' },
  { title: 'The Legend of Sleepy Hollow', author: 'Washington Irving', genre: 'horror', accent: '#5A4A1F', blurb: 'A schoolmaster, a dark road, a headless rider.' },
  { title: 'Treasure Island', author: 'Robert Louis Stevenson', genre: 'adventure', accent: '#6B5A2E', blurb: 'A map, a mutiny, and Long John Silver.' },
  { title: 'The Call of the Wild', author: 'Jack London', genre: 'adventure', accent: '#3E5A2E', blurb: 'A dog stolen into the Yukon gold rush.' },
  { title: 'Around the World in Eighty Days', author: 'Jules Verne', genre: 'adventure', accent: '#7A3B2E', blurb: 'A wager, a valet, and a race against the clock.' },
];

export const RECOMMENDED = ["Alice's Adventures in Wonderland", 'Frankenstein', 'Dracula', 'Treasure Island'].map((t) => DISCOVER_BOOKS.find((b) => b.title === t)!);

export const booksInGenre = (genre: GenreId) => DISCOVER_BOOKS.filter((b) => b.genre === genre);
export const genreOf = (id: GenreId) => GENRES.find((g) => g.id === id)!;

// Sample activity so the section isn't empty; replace with lib/db/friends getFriendActivity once books are linked.
export const FRIENDS_READING = [
  { name: 'Reader A', initial: 'A', color: '#9C7BFF', book: DISCOVER_BOOKS[0] },
  { name: 'Reader B', initial: 'B', color: '#7CF2B8', book: DISCOVER_BOOKS[13] },
  { name: 'Reader C', initial: 'C', color: '#FF8FB1', book: DISCOVER_BOOKS[4] },
];
