import type { User } from '../data/types';

// Sample user IDs that we can reuse in other mock files
export const USER_IDS = {
  current: '11111111-1111-4111-8111-111111111111',
  alex: '22222222-2222-4222-8222-222222222222',
  jordan: '33333333-3333-4333-8333-333333333333',
  taylor: '44444444-4444-4444-8444-444444444444',
};

// Fake user profiles for testing Echo
export const mockUsers: User[] = [
  {
    id: USER_IDS.current,
    username: 'echo_reader',
    display_name: 'Echo Reader',
    avatar_url: null,
    bio: 'I love listening to audiobooks!',
    profile_visibility: 'public',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
  },
  {
    id: USER_IDS.alex,
    username: 'alex_reads',
    display_name: 'Alex Morgan',
    avatar_url: null,
    bio: 'Fantasy and science fiction fan.',
    profile_visibility: 'public',
    created_at: '2026-09-03T12:00:00Z',
    updated_at: '2026-09-03T12:00:00Z',
  },
  {
    id: USER_IDS.jordan,
    username: 'jordan_books',
    display_name: 'Jordan Lee',
    avatar_url: null,
    bio: 'Always looking for my next favorite book.',
    profile_visibility: 'friends_only',
    created_at: '2026-09-05T12:00:00Z',
    updated_at: '2026-09-05T12:00:00Z',
  },
  {
    id: USER_IDS.taylor,
    username: 'taylor_listens',
    display_name: 'Taylor Smith',
    avatar_url: null,
    bio: 'Audiobooks make every commute better.',
    profile_visibility: 'private',
    created_at: '2026-09-07T12:00:00Z',
    updated_at: '2026-09-07T12:00:00Z',
  },
];
