import type { Character } from '../data/types';
import { BOOK_IDS } from './books';

// IDs used to connect characters to narration and chapters
export const CHARACTER_IDS = {
  nick: '10000000-0000-4000-8000-000000000001',
  gatsby: '10000000-0000-4000-8000-000000000002',
  daisy: '10000000-0000-4000-8000-000000000003',
  tom: '10000000-0000-4000-8000-000000000004',
  jon: '20000000-0000-4000-8000-000000000001',
  daenerys: '20000000-0000-4000-8000-000000000002',
  tyrion: '20000000-0000-4000-8000-000000000003',
  ned: '20000000-0000-4000-8000-000000000004',
  arya: '20000000-0000-4000-8000-000000000005',
};

// Helper function to create characters
function createCharacter(
  id: string,
  bookId: string,
  name: string,
  gender: Character['gender'],
  summary: string,
  voiceName: string,
  isNarrator = false
): Character {
  return {
    id,
    book_id: bookId,
    name,
    aliases: [],
    gender,
    is_narrator: isNarrator,
    summary,
    voice_id: `mock-${id}`,
    voice_name: voiceName,
    voice_description: `Sample ${voiceName} voice`,
    voice_sample_path: null,
    voice_settings: {
      pitch: 1.0,
      speed: 1.0,
    },
    narration_voice_id: null,
    narration_voice_settings: {},
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
  };
}

// The Great Gatsby characters
const gatsbyCharacters: Character[] = [
  createCharacter(
    CHARACTER_IDS.nick,
    BOOK_IDS.gatsby,
    'Nick Carraway',
    'male',
    'The narrator who observes the events surrounding Gatsby.',
    'Calm American Male',
    true
  ),
  createCharacter(
    CHARACTER_IDS.gatsby,
    BOOK_IDS.gatsby,
    'Jay Gatsby',
    'male',
    'A mysterious wealthy man known for his elaborate parties.',
    'Deep American Male'
  ),
  createCharacter(
    CHARACTER_IDS.daisy,
    BOOK_IDS.gatsby,
    'Daisy Buchanan',
    'female',
    'A wealthy socialite connected to Gatsby and Nick.',
    'Soft American Female'
  ),
  createCharacter(
    CHARACTER_IDS.tom,
    BOOK_IDS.gatsby,
    'Tom Buchanan',
    'male',
    'Daisy’s husband, known for his arrogance and wealth.',
    'Strong American Male'
  ),
];

// A Game of Thrones characters
const gameOfThronesCharacters: Character[] = [
  createCharacter(
    CHARACTER_IDS.jon,
    BOOK_IDS.gameOfThrones,
    'Jon Snow',
    'male',
    'A young man raised in the Stark household who joins the Night’s Watch.',
    'Young Northern Male',
    true
  ),
  createCharacter(
    CHARACTER_IDS.daenerys,
    BOOK_IDS.gameOfThrones,
    'Daenerys Targaryen',
    'female',
    'An exiled princess from House Targaryen.',
    'Regal Female',
    true
  ),
  createCharacter(
    CHARACTER_IDS.tyrion,
    BOOK_IDS.gameOfThrones,
    'Tyrion Lannister',
    'male',
    'A clever member of House Lannister known for his intelligence and wit.',
    'Witty Male',
    true
  ),
  createCharacter(
    CHARACTER_IDS.ned,
    BOOK_IDS.gameOfThrones,
    'Eddard Stark',
    'male',
    'The honorable lord of Winterfell and head of House Stark.',
    'Deep Northern Male',
    true
  ),
  createCharacter(
    CHARACTER_IDS.arya,
    BOOK_IDS.gameOfThrones,
    'Arya Stark',
    'female',
    'A spirited young member of House Stark.',
    'Young Female',
    true
  ),
];

// Combine all characters
export const mockCharacters: Character[] = [
  ...gatsbyCharacters,
  ...gameOfThronesCharacters,
];
