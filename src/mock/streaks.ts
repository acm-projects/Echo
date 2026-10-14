import type { UserStreak } from '../data/types';
import { USER_IDS } from './users';

// Sample listening streaks for our four users
export const mockStreaks: UserStreak[] = [
  {
    user_id: USER_IDS.current,
    current_streak: 7,
    longest_streak: 14,
    last_goal_met_date: '2026-10-14',
    streak_freezes: 2,
    daily_goal_seconds: 600,
    timezone: 'America/Chicago',
    total_listen_seconds: 252000,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-10-14T14:00:00Z',
  },
  {
    user_id: USER_IDS.alex,
    current_streak: 21,
    longest_streak: 30,
    last_goal_met_date: '2026-10-14',
    streak_freezes: 1,
    daily_goal_seconds: 1200,
    timezone: 'America/Chicago',
    total_listen_seconds: 540000,
    created_at: '2026-08-15T12:00:00Z',
    updated_at: '2026-10-14T13:00:00Z',
  },
  {
    user_id: USER_IDS.jordan,
    current_streak: 3,
    longest_streak: 5,
    last_goal_met_date: '2026-10-13',
    streak_freezes: 0,
    daily_goal_seconds: 900,
    timezone: 'America/New_York',
    total_listen_seconds: 72000,
    created_at: '2026-09-20T12:00:00Z',
    updated_at: '2026-10-13T21:00:00Z',
  },
  {
    user_id: USER_IDS.taylor,
    current_streak: 0,
    longest_streak: 12,
    last_goal_met_date: '2026-10-01',
    streak_freezes: 0,
    daily_goal_seconds: 600,
    timezone: 'America/Los_Angeles',
    total_listen_seconds: 180000,
    created_at: '2026-08-01T12:00:00Z',
    updated_at: '2026-10-02T12:00:00Z',
  },
];
