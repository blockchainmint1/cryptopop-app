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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
