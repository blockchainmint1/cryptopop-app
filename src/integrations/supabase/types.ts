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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blast_campaigns: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          from_email: string
          from_name: string
          html: string
          preview_text: string | null
          recipients_raw: string
          reply_to: string | null
          sent_at: string | null
          subject: string
          total_recipients: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          from_email: string
          from_name: string
          html: string
          preview_text?: string | null
          recipients_raw: string
          reply_to?: string | null
          sent_at?: string | null
          subject: string
          total_recipients?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          from_email?: string
          from_name?: string
          html?: string
          preview_text?: string | null
          recipients_raw?: string
          reply_to?: string | null
          sent_at?: string | null
          subject?: string
          total_recipients?: number
        }
        Relationships: []
      }
      blast_recipients: {
        Row: {
          attempts: number
          campaign_id: string
          email: string
          error_message: string | null
          id: string
          queued_at: string
          sent_at: string | null
          ses_message_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          email: string
          error_message?: string | null
          id?: string
          queued_at?: string
          sent_at?: string | null
          ses_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          email?: string
          error_message?: string | null
          id?: string
          queued_at?: string
          sent_at?: string | null
          ses_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "blast_campaigns"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      claims: {
        Row: {
          base_reward: number
          created_at: string
          error: string | null
          event_id: string
          id: string
          lat: number | null
          lng: number | null
          qr_payload: string | null
          quiz_reward: number
          referral_reward: number
          scanned_at: string
          status: Database["public"]["Enums"]["claim_status"]
          total: number
          tx_hash: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          base_reward?: number
          created_at?: string
          error?: string | null
          event_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          qr_payload?: string | null
          quiz_reward?: number
          referral_reward?: number
          scanned_at?: string
          status?: Database["public"]["Enums"]["claim_status"]
          total?: number
          tx_hash?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          base_reward?: number
          created_at?: string
          error?: string | null
          event_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          qr_payload?: string | null
          quiz_reward?: number
          referral_reward?: number
          scanned_at?: string
          status?: Database["public"]["Enums"]["claim_status"]
          total?: number
          tx_hash?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          html: string
          id: string
          name: string
          notes: string | null
          preview_text: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          html: string
          id?: string
          name: string
          notes?: string | null
          preview_text?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          html?: string
          id?: string
          name?: string
          notes?: string | null
          preview_text?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_wallets: {
        Row: {
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          derivation_index: number
          email: string
          wallet_address: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          derivation_index: number
          email: string
          wallet_address: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          derivation_index?: number
          email?: string
          wallet_address?: string
        }
        Relationships: []
      }
      event_quiz_questions: {
        Row: {
          correct_index: number
          created_at: string
          event_id: string
          id: string
          options: Json
          position: number
          question: string
          reward: number
        }
        Insert: {
          correct_index: number
          created_at?: string
          event_id: string
          id?: string
          options: Json
          position?: number
          question: string
          reward?: number
        }
        Update: {
          correct_index?: number
          created_at?: string
          event_id?: string
          id?: string
          options?: Json
          position?: number
          question?: string
          reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_quiz_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          contact_number: string
          created_at: string
          email: string
          event_name: string
          event_slug: string
          full_name: string
          heard_from: string | null
          id: string
          notes: string | null
          party_size: number
        }
        Insert: {
          contact_number: string
          created_at?: string
          email: string
          event_name: string
          event_slug: string
          full_name: string
          heard_from?: string | null
          id?: string
          notes?: string | null
          party_size?: number
        }
        Update: {
          contact_number?: string
          created_at?: string
          email?: string
          event_name?: string
          event_slug?: string
          full_name?: string
          heard_from?: string | null
          id?: string
          notes?: string | null
          party_size?: number
        }
        Relationships: []
      }
      event_signups: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          completed_activities: string[]
          created_at: string
          email: string
          full_name: string
          id: string
          instagram_handle: string | null
          is_friend: boolean
          mobile_number: string
          pop_credits: number
          signed_up_at: string
          signup_source: string
          status: string
          telegram_handle: string | null
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          completed_activities?: string[]
          created_at?: string
          email: string
          full_name: string
          id?: string
          instagram_handle?: string | null
          is_friend?: boolean
          mobile_number: string
          pop_credits?: number
          signed_up_at?: string
          signup_source?: string
          status?: string
          telegram_handle?: string | null
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          completed_activities?: string[]
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          instagram_handle?: string | null
          is_friend?: boolean
          mobile_number?: string
          pop_credits?: number
          signed_up_at?: string
          signup_source?: string
          status?: string
          telegram_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          base_reward: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
          referral_reward: number
          start_at: string
          updated_at: string
        }
        Insert: {
          base_reward?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at: string
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number
          referral_reward?: number
          start_at: string
          updated_at?: string
        }
        Update: {
          base_reward?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          referral_reward?: number
          start_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pop_awards: {
        Row: {
          amount: number
          created_at: string
          email: string
          error: string | null
          id: string
          sent_at: string | null
          source: string
          source_id: string | null
          status: string
          tx_hash: string | null
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          email: string
          error?: string | null
          id?: string
          sent_at?: string | null
          source: string
          source_id?: string | null
          status?: string
          tx_hash?: string | null
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          source?: string
          source_id?: string | null
          status?: string
          tx_hash?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      pop_balance_mirror: {
        Row: {
          balance: number
          events_attended: number
          last_synced_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          events_attended?: number
          last_synced_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          events_attended?: number
          last_synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          event_id: string | null
          expires_at: string
          id: string
          label: string
          lat: number | null
          lng: number | null
          pop_reward: number
          radius_m: number | null
          single_use: boolean
          token: string
          updated_at: string
          use_count: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at: string
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
          pop_reward: number
          radius_m?: number | null
          single_use?: boolean
          token: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          pop_reward?: number
          radius_m?: number | null
          single_use?: boolean
          token?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_redemptions: {
        Row: {
          code_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          pop_amount: number
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          pop_amount: number
          status: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          pop_amount?: number
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          event_id: string
          id: string
          referee_id: string
          referrer_id: string
          reward: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          referee_id: string
          referrer_id: string
          reward?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          referee_id?: string
          referrer_id?: string
          reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_rules: {
        Row: {
          action_key: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          label: string
          pop_amount: number
          updated_at: string
        }
        Insert: {
          action_key: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label: string
          pop_amount: number
          updated_at?: string
        }
        Update: {
          action_key?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label?: string
          pop_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_backups: {
        Row: {
          ciphertext: string
          created_at: string
          iv: string
          salt: string
          updated_at: string
          user_id: string
          version: number
          wallet_address: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          iv: string
          salt: string
          updated_at?: string
          user_id: string
          version?: number
          wallet_address: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          iv?: string
          salt?: string
          updated_at?: string
          user_id?: string
          version?: number
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      claim_status: "pending" | "minted" | "failed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      claim_status: ["pending", "minted", "failed"],
    },
  },
} as const
