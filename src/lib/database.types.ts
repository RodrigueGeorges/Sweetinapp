// Types de la base — miroir de supabase/migrations/.
// Régénérer avec `npm run gen:types` quand la base est en ligne, puis comparer à la main.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; onboarded: boolean; avatar_path: string | null; created_at: string };
        Insert: { id: string; username: string; onboarded?: boolean; avatar_path?: string | null; created_at?: string };
        Update: { id?: string; username?: string; onboarded?: boolean; avatar_path?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: 'profiles_id_fkey'; columns: ['id']; isOneToOne: true; referencedRelation: 'users'; referencedColumns: ['id'] },
        ];
      };
      profile_private: {
        Row: { id: string; birth_date: string; age_blocked: boolean; discoverable: boolean; updated_at: string };
        Insert: { id: string; birth_date: string; age_blocked?: boolean; discoverable?: boolean; updated_at?: string };
        Update: { id?: string; birth_date?: string; age_blocked?: boolean; discoverable?: boolean; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'profile_private_id_fkey'; columns: ['id']; isOneToOne: true; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      friendships: {
        Row: { user_id: string; friend_id: string; created_at: string };
        Insert: { user_id: string; friend_id: string; created_at?: string };
        Update: { user_id?: string; friend_id?: string; created_at?: string };
        Relationships: [
          { foreignKeyName: 'friendships_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'friendships_friend_id_fkey'; columns: ['friend_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocker_id: string; blocked_id: string; created_at?: string };
        Update: { blocker_id?: string; blocked_id?: string; created_at?: string };
        Relationships: [
          { foreignKeyName: 'blocks_blocker_id_fkey'; columns: ['blocker_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'blocks_blocked_id_fkey'; columns: ['blocked_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      flips: {
        Row: {
          id: string;
          sender_id: string;
          photo_path: string | null;
          preview: string | null;
          mode: 'free' | 'once';
          sweet_hour: boolean;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          photo_path?: string | null;
          preview?: string | null;
          mode?: 'free' | 'once';
          sweet_hour?: boolean;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          photo_path?: string | null;
          preview?: string | null;
          mode?: 'free' | 'once';
          sweet_hour?: boolean;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'flips_sender_id_fkey'; columns: ['sender_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      flip_secrets: {
        Row: { flip_id: string; message: string };
        Insert: { flip_id: string; message: string };
        Update: { flip_id?: string; message?: string };
        Relationships: [
          { foreignKeyName: 'flip_secrets_flip_id_fkey'; columns: ['flip_id']; isOneToOne: true; referencedRelation: 'flips'; referencedColumns: ['id'] },
        ];
      };
      flip_recipients: {
        Row: {
          flip_id: string;
          recipient_id: string;
          opened_at: string | null;
          scratched_at: string | null;
          percent: number | null;
          duration_ms: number | null;
          reaction: string | null;
          screenshot_at: string | null;
        };
        Insert: {
          flip_id: string;
          recipient_id: string;
          opened_at?: string | null;
          scratched_at?: string | null;
          percent?: number | null;
          duration_ms?: number | null;
          reaction?: string | null;
          screenshot_at?: string | null;
        };
        Update: {
          flip_id?: string;
          recipient_id?: string;
          opened_at?: string | null;
          scratched_at?: string | null;
          percent?: number | null;
          duration_ms?: number | null;
          reaction?: string | null;
          screenshot_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'flip_recipients_flip_id_fkey'; columns: ['flip_id']; isOneToOne: false; referencedRelation: 'flips'; referencedColumns: ['id'] },
          { foreignKeyName: 'flip_recipients_recipient_id_fkey'; columns: ['recipient_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      flip_links: {
        Row: {
          token: string;
          flip_id: string;
          kind: 'single' | 'story';
          opened_at: string | null;
          scratched_at: string | null;
          percent: number | null;
          duration_ms: number | null;
          opens: number;
          scratches: number;
          created_at: string;
        };
        Insert: {
          token: string;
          flip_id: string;
          kind: 'single' | 'story';
          opened_at?: string | null;
          scratched_at?: string | null;
          percent?: number | null;
          duration_ms?: number | null;
          opens?: number;
          scratches?: number;
          created_at?: string;
        };
        Update: {
          token?: string;
          flip_id?: string;
          kind?: 'single' | 'story';
          opened_at?: string | null;
          scratched_at?: string | null;
          percent?: number | null;
          duration_ms?: number | null;
          opens?: number;
          scratches?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'flip_links_flip_id_fkey'; columns: ['flip_id']; isOneToOne: false; referencedRelation: 'flips'; referencedColumns: ['id'] },
        ];
      };
      streaks: {
        Row: { user_a: string; user_b: string; days: number; last_day: string | null; a_sent: string | null; b_sent: string | null; celebrated: number };
        Insert: { user_a: string; user_b: string; days?: number; last_day?: string | null; a_sent?: string | null; b_sent?: string | null; celebrated?: number };
        Update: { user_a?: string; user_b?: string; days?: number; last_day?: string | null; a_sent?: string | null; b_sent?: string | null; celebrated?: number };
        Relationships: [
          { foreignKeyName: 'streaks_user_a_fkey'; columns: ['user_a']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'streaks_user_b_fkey'; columns: ['user_b']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      streak_saves: {
        Row: { user_id: string; saved_at: string };
        Insert: { user_id: string; saved_at?: string };
        Update: { user_id?: string; saved_at?: string };
        Relationships: [
          { foreignKeyName: 'streak_saves_user_id_fkey'; columns: ['user_id']; isOneToOne: true; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      push_tokens: {
        Row: { user_id: string; token: string; platform: string | null; lang: string; updated_at: string };
        Insert: { user_id: string; token: string; platform?: string | null; lang?: string; updated_at?: string };
        Update: { user_id?: string; token?: string; platform?: string | null; lang?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'push_tokens_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'users'; referencedColumns: ['id'] },
        ];
      };
      live_tokens: {
        Row: { token: string; user_id: string; expo_token: string | null; lang: string; updated_at: string };
        Insert: { token: string; user_id: string; expo_token?: string | null; lang?: string; updated_at?: string };
        Update: { token?: string; user_id?: string; expo_token?: string | null; lang?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'live_tokens_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      phone_index: {
        Row: { user_id: string; phone_hash: string };
        Insert: { user_id: string; phone_hash: string };
        Update: { user_id?: string; phone_hash?: string };
        Relationships: [];
      };
      contact_lookups: {
        Row: { user_id: string; day: string; calls: number };
        Insert: { user_id: string; day: string; calls?: number };
        Update: { user_id?: string; day?: string; calls?: number };
        Relationships: [];
      };
      referrals: {
        Row: { user_id: string; invited_by: string | null; source: 'link' | 'flip' | 'story' | 'qr' | 'contacts' | 'username' | null; created_at: string };
        Insert: { user_id: string; invited_by?: string | null; source?: 'link' | 'flip' | 'story' | 'qr' | 'contacts' | 'username' | null; created_at?: string };
        Update: { user_id?: string; invited_by?: string | null; source?: 'link' | 'flip' | 'story' | 'qr' | 'contacts' | 'username' | null; created_at?: string };
        Relationships: [
          { foreignKeyName: 'referrals_user_id_fkey'; columns: ['user_id']; isOneToOne: true; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'referrals_invited_by_fkey'; columns: ['invited_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      reports: {
        Row: { id: number; reporter_id: string; reported_id: string | null; flip_id: string | null; reason: string; kept_message: string | null; created_at: string };
        Insert: { id?: number; reporter_id: string; reported_id?: string | null; flip_id?: string | null; reason: string; kept_message?: string | null; created_at?: string };
        Update: { id?: number; reporter_id?: string; reported_id?: string | null; flip_id?: string | null; reason?: string; kept_message?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: 'reports_reporter_id_fkey'; columns: ['reporter_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'reports_reported_id_fkey'; columns: ['reported_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'reports_flip_id_fkey'; columns: ['flip_id']; isOneToOne: false; referencedRelation: 'flips'; referencedColumns: ['id'] },
        ];
      };
      sweet_hours: {
        Row: { day: string; starts_at: string; notified: boolean };
        Insert: { day: string; starts_at: string; notified?: boolean };
        Update: { day?: string; starts_at?: string; notified?: boolean };
        Relationships: [];
      };
      rate_limits: {
        Row: { actor: string; action: string; window_start: string; count: number };
        Insert: { actor: string; action: string; window_start: string; count: number };
        Update: { actor?: string; action?: string; window_start?: string; count?: number };
        Relationships: [];
      };
      push_receipts: {
        Row: { ticket_id: string; token: string; created_at: string; checked_at: string | null };
        Insert: { ticket_id: string; token: string; created_at?: string; checked_at?: string | null };
        Update: { ticket_id?: string; token?: string; created_at?: string; checked_at?: string | null };
        Relationships: [];
      };
    };
    Views: {
      admin_growth: {
        Row: {
          day: string | null;
          signups: number | null;
          invited_signups: number | null;
          active_senders: number | null;
          flips: number | null;
          private_links: number | null;
          private_links_opened: number | null;
          stories: number | null;
          story_opens: number | null;
          k_factor: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_invite: { Args: { p_username: string; p_source?: string }; Returns: Database['public']['Tables']['profiles']['Row'] };
      add_friend: { Args: { p_username: string }; Returns: Database['public']['Tables']['profiles']['Row'] };
      block_user: { Args: { p_user: string }; Returns: undefined };
      complete_profile: { Args: { p_username: string; p_birth_date: string }; Returns: Json };
      current_sweet_hour: { Args: Record<string, never>; Returns: { starts_at: string; ends_at: string }[] };
      match_contacts: { Args: { p_hashes: string[] }; Returns: { id: string; username: string }[] };
      my_lost_streaks: { Args: Record<string, never>; Returns: { friend_id: string; days: number; can_save: boolean }[] };
      my_settings: { Args: Record<string, never>; Returns: { discoverable: boolean; has_phone: boolean }[] };
      my_streaks: { Args: Record<string, never>; Returns: { friend_id: string; days: number; at_risk: boolean }[] };
      rate_hit: { Args: { p_actor: string; p_action: string; p_limit: number; p_window: number }; Returns: boolean };
      record_streaks: { Args: { p_sender: string; p_recipients: string[] }; Returns: { recipient: string; days: number }[] };
      register_push_token: { Args: { p_token: string; p_platform: string; p_lang: string }; Returns: undefined };
      remove_friend: { Args: { p_friend: string }; Returns: undefined };
      restore_streak: { Args: { p_friend: string }; Returns: number };
      set_discoverable: { Args: { p_on: boolean }; Returns: undefined };
      username_available: { Args: { p_username: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
