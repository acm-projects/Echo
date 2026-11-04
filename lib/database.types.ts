export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      book_rooms: {
        Row: {
          catalog_book_id: string
          created_at: string
          id: string
        }
        Insert: {
          catalog_book_id: string
          created_at?: string
          id?: string
        }
        Update: {
          catalog_book_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_rooms_catalog_book_id_fkey"
            columns: ["catalog_book_id"]
            isOneToOne: true
            referencedRelation: "catalog_books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string | null
          catalog_book_id: string | null
          cover_image_path: string | null
          created_at: string
          default_narrator_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          language: string
          model_info: Json
          narration_style: Database["public"]["Enums"]["narration_style"] | null
          processing_error: string | null
          processing_finished_at: string | null
          processing_started_at: string | null
          search_vector: unknown
          source_file_path: string
          source_file_size_bytes: number | null
          source_file_type: Database["public"]["Enums"]["source_file_type"]
          status: Database["public"]["Enums"]["processing_status"]
          title: string
          total_chapters: number
          total_duration_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          catalog_book_id?: string | null
          cover_image_path?: string | null
          created_at?: string
          default_narrator_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          language?: string
          model_info?: Json
          narration_style?:
            | Database["public"]["Enums"]["narration_style"]
            | null
          processing_error?: string | null
          processing_finished_at?: string | null
          processing_started_at?: string | null
          search_vector?: unknown
          source_file_path: string
          source_file_size_bytes?: number | null
          source_file_type: Database["public"]["Enums"]["source_file_type"]
          status?: Database["public"]["Enums"]["processing_status"]
          title: string
          total_chapters?: number
          total_duration_ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          catalog_book_id?: string | null
          cover_image_path?: string | null
          created_at?: string
          default_narrator_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          language?: string
          model_info?: Json
          narration_style?:
            | Database["public"]["Enums"]["narration_style"]
            | null
          processing_error?: string | null
          processing_finished_at?: string | null
          processing_started_at?: string | null
          search_vector?: unknown
          source_file_path?: string
          source_file_size_bytes?: number | null
          source_file_type?: Database["public"]["Enums"]["source_file_type"]
          status?: Database["public"]["Enums"]["processing_status"]
          title?: string
          total_chapters?: number
          total_duration_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_catalog_book_id_fkey"
            columns: ["catalog_book_id"]
            isOneToOne: false
            referencedRelation: "catalog_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_default_narrator_fk"
            columns: ["default_narrator_id", "id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_books: {
        Row: {
          author: string | null
          cover_image_path: string | null
          created_at: string
          description: string | null
          id: string
          is_public_domain: boolean
          language: string
          search_vector: unknown
          source: string | null
          source_file_path: string | null
          source_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public_domain?: boolean
          language?: string
          search_vector?: unknown
          source?: string | null
          source_file_path?: string | null
          source_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public_domain?: boolean
          language?: string
          search_vector?: unknown
          source?: string | null
          source_file_path?: string | null
          source_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chapter_characters: {
        Row: {
          book_id: string
          chapter_id: string
          character_id: string
          created_at: string
          line_count: number
        }
        Insert: {
          book_id: string
          chapter_id: string
          character_id: string
          created_at?: string
          line_count?: number
        }
        Update: {
          book_id?: string
          chapter_id?: string
          character_id?: string
          created_at?: string
          line_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapter_characters_chapter_id_book_id_fkey"
            columns: ["chapter_id", "book_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "chapter_characters_chapter_id_book_id_fkey"
            columns: ["chapter_id", "book_id"]
            isOneToOne: false
            referencedRelation: "chapters_with_narrator"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "chapter_characters_character_id_book_id_fkey"
            columns: ["character_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
        ]
      }
      chapters: {
        Row: {
          audio_duration_ms: number | null
          audio_format: string | null
          audio_s3_url: string | null
          audio_size_bytes: number | null
          book_id: string
          chapter_index: number
          created_at: string
          id: string
          narrator_character_id: string | null
          processing_error: string | null
          status: Database["public"]["Enums"]["processing_status"]
          title: string | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_format?: string | null
          audio_s3_url?: string | null
          audio_size_bytes?: number | null
          book_id: string
          chapter_index: number
          created_at?: string
          id?: string
          narrator_character_id?: string | null
          processing_error?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          title?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          audio_duration_ms?: number | null
          audio_format?: string | null
          audio_s3_url?: string | null
          audio_size_bytes?: number | null
          book_id?: string
          chapter_index?: number
          created_at?: string
          id?: string
          narrator_character_id?: string | null
          processing_error?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          title?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_narrator_fk"
            columns: ["narrator_character_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
        ]
      }
      character_relationships: {
        Row: {
          book_id: string
          character_a_id: string
          character_b_id: string
          created_at: string
          description: string | null
          id: string
          label: string
          revealed_in_chapter_index: number | null
          updated_at: string
        }
        Insert: {
          book_id: string
          character_a_id: string
          character_b_id: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          revealed_in_chapter_index?: number | null
          updated_at?: string
        }
        Update: {
          book_id?: string
          character_a_id?: string
          character_b_id?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          revealed_in_chapter_index?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_relationships_a_fk"
            columns: ["character_a_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "character_relationships_b_fk"
            columns: ["character_b_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "character_relationships_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          aliases: string[]
          book_id: string
          created_at: string
          first_appearance_chapter_index: number | null
          gender: string | null
          id: string
          is_narrator: boolean
          name: string
          narration_voice_id: string | null
          narration_voice_settings: Json
          portrait_path: string | null
          role: Database["public"]["Enums"]["character_role"] | null
          summary: string | null
          updated_at: string
          voice_description: string | null
          voice_id: string | null
          voice_name: string | null
          voice_sample_path: string | null
          voice_settings: Json
        }
        Insert: {
          aliases?: string[]
          book_id: string
          created_at?: string
          first_appearance_chapter_index?: number | null
          gender?: string | null
          id?: string
          is_narrator?: boolean
          name: string
          narration_voice_id?: string | null
          narration_voice_settings?: Json
          portrait_path?: string | null
          role?: Database["public"]["Enums"]["character_role"] | null
          summary?: string | null
          updated_at?: string
          voice_description?: string | null
          voice_id?: string | null
          voice_name?: string | null
          voice_sample_path?: string | null
          voice_settings?: Json
        }
        Update: {
          aliases?: string[]
          book_id?: string
          created_at?: string
          first_appearance_chapter_index?: number | null
          gender?: string | null
          id?: string
          is_narrator?: boolean
          name?: string
          narration_voice_id?: string | null
          narration_voice_settings?: Json
          portrait_path?: string | null
          role?: Database["public"]["Enums"]["character_role"] | null
          summary?: string | null
          updated_at?: string
          voice_description?: string | null
          voice_id?: string | null
          voice_name?: string | null
          voice_sample_path?: string | null
          voice_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "characters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      community_books: {
        Row: {
          book_id: string
          created_at: string
          description: string | null
          id: string
          language: string
          play_count: number
          published_at: string
          rating_avg: number
          rating_count: number
          review_count: number
          save_count: number
          search_vector: unknown
          status: Database["public"]["Enums"]["publish_status"]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          play_count?: number
          published_at?: string
          rating_avg?: number
          rating_count?: number
          review_count?: number
          save_count?: number
          search_vector?: unknown
          status?: Database["public"]["Enums"]["publish_status"]
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          play_count?: number
          published_at?: string
          rating_avg?: number
          rating_count?: number
          review_count?: number
          save_count?: number
          search_vector?: unknown
          status?: Database["public"]["Enums"]["publish_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_books_book_owner_fk"
            columns: ["book_id", "user_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "community_books_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          blocked_by: string | null
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_scripts: {
        Row: {
          alignment: Json
          chapter_id: string
          character_id: string | null
          created_at: string
          emotional_tone: string | null
          end_ms: number | null
          id: string
          line_index: number
          line_type: Database["public"]["Enums"]["script_line_type"]
          source_char_end: number | null
          source_char_start: number | null
          speaker_name: string
          start_ms: number | null
          text_content: string
        }
        Insert: {
          alignment?: Json
          chapter_id: string
          character_id?: string | null
          created_at?: string
          emotional_tone?: string | null
          end_ms?: number | null
          id?: string
          line_index: number
          line_type?: Database["public"]["Enums"]["script_line_type"]
          source_char_end?: number | null
          source_char_start?: number | null
          speaker_name: string
          start_ms?: number | null
          text_content: string
        }
        Update: {
          alignment?: Json
          chapter_id?: string
          character_id?: string | null
          created_at?: string
          emotional_tone?: string | null
          end_ms?: number | null
          id?: string
          line_index?: number
          line_type?: Database["public"]["Enums"]["script_line_type"]
          source_char_end?: number | null
          source_char_start?: number | null
          speaker_name?: string
          start_ms?: number | null
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "narration_scripts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narration_scripts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters_with_narrator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narration_scripts_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_activity: {
        Row: {
          activity_date: string
          chapters_completed: number
          created_at: string
          goal_met: boolean
          listened_seconds: number
          updated_at: string
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          activity_date: string
          chapters_completed?: number
          created_at?: string
          goal_met?: boolean
          listened_seconds?: number
          updated_at?: string
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          activity_date?: string
          chapters_completed?: number
          created_at?: string
          goal_met?: boolean
          listened_seconds?: number
          updated_at?: string
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews_comments: {
        Row: {
          body: string | null
          community_book_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_edited: boolean
          parent_id: string | null
          rating: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          community_book_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_id?: string | null
          rating?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          community_book_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_id?: string | null
          rating?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_comments_community_book_id_fkey"
            columns: ["community_book_id"]
            isOneToOne: false
            referencedRelation: "community_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "reviews_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      room_posts: {
        Row: {
          body: string
          chapter_index: number | null
          created_at: string
          deleted_at: string | null
          id: string
          is_edited: boolean
          parent_id: string | null
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          chapter_index?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_id?: string | null
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          chapter_index?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_id?: string | null
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_posts_parent_fk"
            columns: ["parent_id", "room_id"]
            isOneToOne: false
            referencedRelation: "room_posts"
            referencedColumns: ["id", "room_id"]
          },
          {
            foreignKeyName: "room_posts_parent_fk"
            columns: ["parent_id", "room_id"]
            isOneToOne: false
            referencedRelation: "room_posts_visible"
            referencedColumns: ["id", "room_id"]
          },
          {
            foreignKeyName: "room_posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "book_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_cast_voices: {
        Row: {
          cast_id: string
          character_name: string
          created_at: string
          id: string
          updated_at: string
          voice_description: string | null
          voice_sample_path: string | null
          voice_settings: Json
        }
        Insert: {
          cast_id: string
          character_name: string
          created_at?: string
          id?: string
          updated_at?: string
          voice_description?: string | null
          voice_sample_path?: string | null
          voice_settings?: Json
        }
        Update: {
          cast_id?: string
          character_name?: string
          created_at?: string
          id?: string
          updated_at?: string
          voice_description?: string | null
          voice_sample_path?: string | null
          voice_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shared_cast_voices_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "shared_casts"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_casts: {
        Row: {
          catalog_book_id: string
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_book_id: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          catalog_book_id?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_casts_catalog_book_id_fkey"
            columns: ["catalog_book_id"]
            isOneToOne: false
            referencedRelation: "catalog_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_casts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      story_event_characters: {
        Row: {
          book_id: string
          character_id: string
          created_at: string
          event_id: string
        }
        Insert: {
          book_id: string
          character_id: string
          created_at?: string
          event_id: string
        }
        Update: {
          book_id?: string
          character_id?: string
          created_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_event_characters_character_id_book_id_fkey"
            columns: ["character_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "story_event_characters_event_id_book_id_fkey"
            columns: ["event_id", "book_id"]
            isOneToOne: false
            referencedRelation: "story_events"
            referencedColumns: ["id", "book_id"]
          },
        ]
      }
      story_events: {
        Row: {
          book_id: string
          chapter_index: number
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          book_id: string
          chapter_index: number
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          chapter_index?: number
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_events_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          book_id: string
          chapter_id: string | null
          character_id: string | null
          content: string
          created_at: string
          id: string
          model_info: Json
          spoiler_free_through_chapter_index: number | null
          summary_type: Database["public"]["Enums"]["summary_type"]
          updated_at: string
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          character_id?: string | null
          content: string
          created_at?: string
          id?: string
          model_info?: Json
          spoiler_free_through_chapter_index?: number | null
          summary_type: Database["public"]["Enums"]["summary_type"]
          updated_at?: string
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          model_info?: Json
          spoiler_free_through_chapter_index?: number | null
          summary_type?: Database["public"]["Enums"]["summary_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters_with_narrator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_character_book_fk"
            columns: ["character_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
        ]
      }
      user_progress: {
        Row: {
          book_id: string
          chapter_id: string | null
          client_updated_at: string
          device_id: string | null
          id: string
          is_completed: boolean
          playback_speed: number
          position_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          client_updated_at?: string
          device_id?: string | null
          id?: string
          is_completed?: boolean
          playback_speed?: number
          position_ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          client_updated_at?: string
          device_id?: string | null
          id?: string
          is_completed?: boolean
          playback_speed?: number
          position_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters_with_narrator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          daily_goal_seconds: number
          last_goal_met_date: string | null
          longest_streak: number
          streak_freezes: number
          timezone: string
          total_listen_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          daily_goal_seconds?: number
          last_goal_met_date?: string | null
          longest_streak?: number
          streak_freezes?: number
          timezone?: string
          total_listen_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          daily_goal_seconds?: number
          last_goal_met_date?: string | null
          longest_streak?: number
          streak_freezes?: number
          timezone?: string
          total_listen_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          profile_visibility: Database["public"]["Enums"]["profile_visibility"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          profile_visibility?: Database["public"]["Enums"]["profile_visibility"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      voice_jobs: {
        Row: {
          book_id: string
          character_id: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          requested_by: string
          started_at: string | null
          status: Database["public"]["Enums"]["processing_status"]
          updated_at: string
        }
        Insert: {
          book_id: string
          character_id: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          requested_by?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          updated_at?: string
        }
        Update: {
          book_id?: string
          character_id?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          requested_by?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_jobs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_jobs_character_fk"
            columns: ["character_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "voice_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      chapters_with_narrator: {
        Row: {
          audio_duration_ms: number | null
          audio_format: string | null
          audio_s3_url: string | null
          audio_size_bytes: number | null
          book_id: string | null
          chapter_index: number | null
          created_at: string | null
          effective_narrator_id: string | null
          id: string | null
          narrator_character_id: string | null
          processing_error: string | null
          status: Database["public"]["Enums"]["processing_status"] | null
          title: string | null
          updated_at: string | null
          word_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_narrator_fk"
            columns: ["narrator_character_id", "book_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id", "book_id"]
          },
        ]
      }
      room_posts_visible: {
        Row: {
          body: string | null
          chapter_index: number | null
          created_at: string | null
          id: string | null
          is_deleted: boolean | null
          is_edited: boolean | null
          is_spoiler: boolean | null
          parent_id: string | null
          room_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_posts_parent_fk"
            columns: ["parent_id", "room_id"]
            isOneToOne: false
            referencedRelation: "room_posts"
            referencedColumns: ["id", "room_id"]
          },
          {
            foreignKeyName: "room_posts_parent_fk"
            columns: ["parent_id", "room_id"]
            isOneToOne: false
            referencedRelation: "room_posts_visible"
            referencedColumns: ["id", "room_id"]
          },
          {
            foreignKeyName: "room_posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "book_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks_live: {
        Row: {
          created_at: string | null
          current_streak: number | null
          daily_goal_seconds: number | null
          last_goal_met_date: string | null
          live_streak: number | null
          longest_streak: number | null
          streak_freezes: number | null
          timezone: string | null
          total_listen_seconds: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          daily_goal_seconds?: number | null
          last_goal_met_date?: string | null
          live_streak?: never
          longest_streak?: number | null
          streak_freezes?: number | null
          timezone?: string | null
          total_listen_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          daily_goal_seconds?: number | null
          last_goal_met_date?: string | null
          live_streak?: never
          longest_streak?: number | null
          streak_freezes?: number | null
          timezone?: string | null
          total_listen_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      can_read_book: { Args: { p_book_id: string }; Returns: boolean }
      can_view_profile_stats: { Args: { p_user: string }; Returns: boolean }
      friends_leaderboard: {
        Args: { p_end: string; p_start: string }
        Returns: {
          avatar_url: string
          display_name: string
          listened_seconds: number
          live_streak: number
          rank: number
          user_id: string
          username: string
          xp: number
        }[]
      }
      increment_play_count: {
        Args: { p_community_book_id: string }
        Returns: number
      }
      live_streak: {
        Args: {
          p_current: number
          p_freezes: number
          p_last: string
          p_tz: string
        }
        Returns: number
      }
      my_catalog_chapter_index: {
        Args: { p_catalog_book_id: string }
        Returns: number
      }
      record_listening: {
        Args: { p_chapters_completed?: number; p_seconds: number }
        Returns: {
          created_at: string
          current_streak: number
          daily_goal_seconds: number
          last_goal_met_date: string | null
          longest_streak: number
          streak_freezes: number
          timezone: string
          total_listen_seconds: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_streaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_progress: {
        Args: {
          p_book_id: string
          p_chapter_id: string
          p_client_updated_at: string
          p_device_id?: string
          p_is_completed?: boolean
          p_playback_speed?: number
          p_position_ms: number
        }
        Returns: {
          book_id: string
          chapter_id: string | null
          client_updated_at: string
          device_id: string | null
          id: string
          is_completed: boolean
          playback_speed: number
          position_ms: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      character_role: "protagonist" | "antagonist" | "supporting" | "minor"
      friendship_status: "pending" | "accepted" | "declined" | "blocked"
      narration_style:
        | "first_person"
        | "third_person"
        | "multiple_pov"
        | "mixed"
      processing_status:
        | "uploaded"
        | "queued"
        | "processing"
        | "ready"
        | "failed"
      profile_visibility: "public" | "friends_only" | "private"
      publish_status: "draft" | "published" | "unlisted" | "removed"
      script_line_type: "narration" | "dialogue" | "thought"
      source_file_type: "pdf" | "epub" | "txt" | "md"
      summary_type: "book" | "chapter" | "character"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      character_role: ["protagonist", "antagonist", "supporting", "minor"],
      friendship_status: ["pending", "accepted", "declined", "blocked"],
      narration_style: [
        "first_person",
        "third_person",
        "multiple_pov",
        "mixed",
      ],
      processing_status: [
        "uploaded",
        "queued",
        "processing",
        "ready",
        "failed",
      ],
      profile_visibility: ["public", "friends_only", "private"],
      publish_status: ["draft", "published", "unlisted", "removed"],
      script_line_type: ["narration", "dialogue", "thought"],
      source_file_type: ["pdf", "epub", "txt", "md"],
      summary_type: ["book", "chapter", "character"],
    },
  },
} as const
