import type {
  CommunityBook,
  ReviewComment,
} from '../data/types';

import { USER_IDS } from './users';
import { BOOK_IDS } from './books';

// IDs used to connect community books and reviews
export const COMMUNITY_BOOK_IDS = {
  gatsby: '50000000-0000-4000-8000-000000000001',
  gameOfThrones: '50000000-0000-4000-8000-000000000002',
};

export const REVIEW_IDS = {
  alexGatsby: '60000000-0000-4000-8000-000000000001',
  jordanGatsby: '60000000-0000-4000-8000-000000000002',
  currentReply: '60000000-0000-4000-8000-000000000003',
  alexGameOfThrones: '60000000-0000-4000-8000-000000000004',
};

// Sample books shared with the community
export const mockCommunityBooks: CommunityBook[] = [
  {
    id: COMMUNITY_BOOK_IDS.gatsby,
    book_id: BOOK_IDS.gatsby,
    user_id: USER_IDS.current,
    title: 'The Great Gatsby',
    description:
      'Listen to this classic story about wealth, ambition, and the American Dream.',
    tags: ['classic', 'fiction', 'drama'],
    language: 'en',
    status: 'published',
    published_at: '2026-10-02T12:00:00Z',
    play_count: 245,
    save_count: 82,
    rating_avg: 4.5,
    rating_count: 2,
    review_count: 2,
    created_at: '2026-10-02T12:00:00Z',
    updated_at: '2026-10-13T18:00:00Z',
  },
  {
    id: COMMUNITY_BOOK_IDS.gameOfThrones,
    book_id: BOOK_IDS.gameOfThrones,
    user_id: USER_IDS.current,
    title: 'A Game of Thrones',
    description:
      'Explore the Seven Kingdoms through an audiobook with multiple character voices.',
    tags: ['fantasy', 'adventure', 'drama'],
    language: 'en',
    status: 'published',
    published_at: '2026-10-05T15:00:00Z',
    play_count: 510,
    save_count: 190,
    rating_avg: 5.0,
    rating_count: 1,
    review_count: 1,
    created_at: '2026-10-05T15:00:00Z',
    updated_at: '2026-10-13T20:00:00Z',
  },
];

// Sample reviews and replies
export const mockReviewsComments: ReviewComment[] = [
  {
    id: REVIEW_IDS.alexGatsby,
    community_book_id: COMMUNITY_BOOK_IDS.gatsby,
    user_id: USER_IDS.alex,
    parent_id: null,
    rating: 5,
    title: 'Great narration',
    body:
      'I really enjoyed the different character voices. The narration made the story easy to follow.',
    is_edited: false,
    deleted_at: null,
    created_at: '2026-10-10T14:00:00Z',
    updated_at: '2026-10-10T14:00:00Z',
  },
  {
    id: REVIEW_IDS.jordanGatsby,
    community_book_id: COMMUNITY_BOOK_IDS.gatsby,
    user_id: USER_IDS.jordan,
    parent_id: null,
    rating: 4,
    title: 'Enjoyable audiobook',
    body:
      'The pacing was good, and I liked being able to listen while doing other things.',
    is_edited: false,
    deleted_at: null,
    created_at: '2026-10-11T16:00:00Z',
    updated_at: '2026-10-11T16:00:00Z',
  },
  {
    id: REVIEW_IDS.currentReply,
    community_book_id: COMMUNITY_BOOK_IDS.gatsby,
    user_id: USER_IDS.current,
    parent_id: REVIEW_IDS.alexGatsby,
    rating: null,
    title: null,
    body:
      'Thanks for listening! Glad you enjoyed the narration.',
    is_edited: false,
    deleted_at: null,
    created_at: '2026-10-10T15:00:00Z',
    updated_at: '2026-10-10T15:00:00Z',
  },
  {
    id: REVIEW_IDS.alexGameOfThrones,
    community_book_id: COMMUNITY_BOOK_IDS.gameOfThrones,
    user_id: USER_IDS.alex,
    parent_id: null,
    rating: 5,
    title: 'Love the different voices',
    body:
      'Having different voices for the characters makes it much easier to follow the story.',
    is_edited: false,
    deleted_at: null,
    created_at: '2026-10-13T20:00:00Z',
    updated_at: '2026-10-13T20:00:00Z',
  },
];
