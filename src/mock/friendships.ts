import type { Friendship } from '../data/types';
import { USER_IDS } from './users';

// IDs used to reference mock friendships
export const FRIENDSHIP_IDS = {
  alex: '40000000-0000-4000-8000-000000000001',
  jordan: '40000000-0000-4000-8000-000000000002',
  taylor: '40000000-0000-4000-8000-000000000003',
};

// Sample friendships for testing social features
export const mockFriendships: Friendship[] = [
  {
    id: FRIENDSHIP_IDS.alex,
    requester_id: USER_IDS.current,
    addressee_id: USER_IDS.alex,
    status: 'accepted',
    blocked_by: null,
    created_at: '2026-10-01T10:00:00Z',
    responded_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
  },
  {
    id: FRIENDSHIP_IDS.jordan,
    requester_id: USER_IDS.jordan,
    addressee_id: USER_IDS.current,
    status: 'pending',
    blocked_by: null,
    created_at: '2026-10-12T14:00:00Z',
    responded_at: null,
    updated_at: '2026-10-12T14:00:00Z',
  },
  {
    id: FRIENDSHIP_IDS.taylor,
    requester_id: USER_IDS.taylor,
    addressee_id: USER_IDS.current,
    status: 'blocked',
    blocked_by: USER_IDS.current,
    created_at: '2026-10-05T09:00:00Z',
    responded_at: '2026-10-06T11:00:00Z',
    updated_at: '2026-10-06T11:00:00Z',
  },
];
