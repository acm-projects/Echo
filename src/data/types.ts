// These types match the enums in our SQL database.
export type SourceFileType = 'pdf' | 'epub' | 'txt' | 'md';

export type ProcessingStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed';

export type NarrationStyle =
  | 'first_person'
  | 'third_person'
  | 'multiple_pov'
  | 'mixed';

export type ProfileVisibility =
  | 'public'
  | 'friends_only'
  | 'private';

export type FriendshipStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'blocked';

export type PublishStatus =
  | 'draft'
  | 'published'
  | 'unlisted'
  | 'removed';

export type SummaryType = 'book' | 'chapter' | 'character';

export type ScriptLineType =
  | 'narration'
  | 'dialogue'
  | 'thought';

// User profile information
export interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_visibility: ProfileVisibility;
  created_at: string;
  updated_at: string;
}

// Uploaded book information
export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  description: string | null;
  language: string;
  source_file_path: string;
  source_file_type: SourceFileType;
  source_file_size_bytes: number | null;
  cover_image_path: string | null;
  status: ProcessingStatus;
  processing_error: string | null;
  processing_started_at: string | null;
  processing_finished_at: string | null;
  total_chapters: number;
  total_duration_ms: number;
  model_info: Record<string, unknown>;
  narration_style: NarrationStyle | null;
  default_narrator_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// Individual chapters belonging to a book
export interface Chapter {
  id: string;
  book_id: string;
  chapter_index: number;
  title: string | null;
  word_count: number | null;
  narrator_character_id: string | null;
  audio_s3_url: string | null;
  audio_duration_ms: number | null;
  audio_size_bytes: number | null;
  audio_format: string | null;
  status: ProcessingStatus;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

// Characters and their assigned voices
export interface Character {
  id: string;
  book_id: string;
  name: string;
  aliases: string[];
  gender: 'female' | 'male' | 'neutral' | 'unknown' | null;
  is_narrator: boolean;
  summary: string | null;
  voice_id: string | null;
  voice_name: string | null;
  voice_description: string | null;
  voice_sample_path: string | null;
  voice_settings: Record<string, unknown>;
  narration_voice_id: string | null;
  narration_voice_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}




 // Tracks a user's listening progress for a book
export interface UserProgress {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  position_ms: number;
  playback_speed: number;
  is_completed: boolean;
  device_id: string | null;
  client_updated_at: string;
  updated_at: string;
}



export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  blocked_by: string | null;
  created_at: string;
  responded_at: string | null;
  updated_at: string;
}



export interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_goal_met_date: string | null;
  streak_freezes: number;
  daily_goal_seconds: number;
  timezone: string;
  total_listen_seconds: number;
  created_at: string;
  updated_at: string;
}



export interface CommunityBook {
  id: string;
  book_id: string;
  user_id: string;
  title: string;
  description: string | null;
  tags: string[];
  language: string;
  status: PublishStatus;
  published_at: string;
  play_count: number;
  save_count: number;
  rating_avg: number;
  rating_count: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewComment {
  id: string;
  community_book_id: string;
  user_id: string;
  parent_id: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  is_edited: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
