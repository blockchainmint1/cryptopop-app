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
          org_id: string
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
          org_id?: string
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
          org_id?: string
          preview_text?: string | null
          recipients_raw?: string
          reply_to?: string | null
          sent_at?: string | null
          subject?: string
          total_recipients?: number
        }
        Relationships: [
          {
            foreignKeyName: "blast_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      blast_recipients: {
        Row: {
          attempts: number
          campaign_id: string
          email: string
          error_message: string | null
          id: string
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
          {
            foreignKeyName: "blast_recipients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
          {
            foreignKeyName: "claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
          {
            foreignKeyName: "event_quiz_questions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          event_id: string | null
          external_wallet: string | null
          full_name: string
          guest_count: number
          id: string
          instagram_handle: string | null
          is_friend: boolean
          mobile_number: string | null
          org_id: string
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
          event_id?: string | null
          external_wallet?: string | null
          full_name: string
          guest_count?: number
          id?: string
          instagram_handle?: string | null
          is_friend?: boolean
          mobile_number?: string | null
          org_id?: string
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
          event_id?: string | null
          external_wallet?: string | null
          full_name?: string
          guest_count?: number
          id?: string
          instagram_handle?: string | null
          is_friend?: boolean
          mobile_number?: string | null
          org_id?: string
          pop_credits?: number
          signed_up_at?: string
          signup_source?: string
          status?: string
          telegram_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_signups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_signups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          base_reward: number
          capacity: number | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string
          id: string
          lat: number
          lng: number
          name: string
          org_id: string
          qr_active_minutes_before: number
          radius_m: number
          referral_reward: number
          slug: string | null
          start_at: string
          time_zone: string
          updated_at: string
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          base_reward?: number
          capacity?: number | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at: string
          id?: string
          lat: number
          lng: number
          name: string
          org_id?: string
          qr_active_minutes_before?: number
          radius_m?: number
          referral_reward?: number
          slug?: string | null
          start_at: string
          time_zone?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          base_reward?: number
          capacity?: number | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          org_id?: string
          qr_active_minutes_before?: number
          radius_m?: number
          referral_reward?: number
          slug?: string | null
          start_at?: string
          time_zone?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_requests: {
        Row: {
          city: string
          country: string | null
          created_at: string
          email: string
          id: string
          name: string
          region: string | null
          status: string
          why: string | null
        }
        Insert: {
          city: string
          country?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          region?: string | null
          status?: string
          why?: string | null
        }
        Update: {
          city?: string
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          region?: string | null
          status?: string
          why?: string | null
        }
        Relationships: []
      }
      merchants: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          market_slug: string
          name: string
          pop_per_visit: number
          sort_order: number
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          market_slug: string
          name: string
          pop_per_visit?: number
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          market_slug?: string
          name?: string
          pop_per_visit?: number
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_market_slug_fkey"
            columns: ["market_slug"]
            isOneToOne: false
            referencedRelation: "pop_markets"
            referencedColumns: ["slug"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_wallet_secrets: {
        Row: {
          created_at: string
          encrypted_wif: string
          encryption_key_id: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_wif: string
          encryption_key_id?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_wif?: string
          encryption_key_id?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_wallet_secrets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          created_at: string
          created_by: string | null
          id: string
          is_featured: boolean
          logo_url: string | null
          minter_wallet_address: string | null
          name: string
          pop_token_name: string | null
          pop_token_symbol: string | null
          slug: string
          status: string
          tagline: string | null
          txc_property_id: number | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          minter_wallet_address?: string | null
          name: string
          pop_token_name?: string | null
          pop_token_symbol?: string | null
          slug: string
          status?: string
          tagline?: string | null
          txc_property_id?: number | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          minter_wallet_address?: string | null
          name?: string
          pop_token_name?: string | null
          pop_token_symbol?: string | null
          slug?: string
          status?: string
          tagline?: string | null
          txc_property_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pop_awards: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          org_id: string
          sent_at: string | null
          source: string
          source_id: string | null
          status: string
          tx_hash: string | null
          wallet_address: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          org_id?: string
          sent_at?: string | null
          source: string
          source_id?: string | null
          status?: string
          tx_hash?: string | null
          wallet_address: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          org_id?: string
          sent_at?: string | null
          source?: string
          source_id?: string | null
          status?: string
          tx_hash?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_awards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      pop_markets: {
        Row: {
          city: string
          country: string
          created_at: string
          hero_copy: string | null
          id: string
          lat: number | null
          launched_at: string | null
          lng: number | null
          org_id: string | null
          region: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          hero_copy?: string | null
          id?: string
          lat?: number | null
          launched_at?: string | null
          lng?: number | null
          org_id?: string | null
          region?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          hero_copy?: string | null
          id?: string
          lat?: number | null
          launched_at?: string | null
          lng?: number | null
          org_id?: string | null
          region?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_markets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_mint_lock: {
        Row: {
          created_at: string
          holder: string | null
          id: number
          locked_until: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holder?: string | null
          id?: number
          locked_until?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holder?: string | null
          id?: number
          locked_until?: string
          updated_at?: string
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
          {
            foreignKeyName: "qr_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
          pop_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      acquire_pop_mint_lock: {
        Args: { p_holder: string; p_ttl_seconds?: number }
        Returns: boolean
      }
      claim_pop_award: {
        Args: { p_award_id: string }
        Returns: {
          amount: number
          claimed_at: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          org_id: string
          sent_at: string | null
          source: string
          source_id: string | null
          status: string
          tx_hash: string | null
          wallet_address: string
        }[]
        SetofOptions: {
          from: "*"
          to: "pop_awards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
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
      release_pop_mint_lock: { Args: { p_holder: string }; Returns: undefined }
      user_owns_email: {
        Args: { _email: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "gatekeeper"
      claim_status: "pending" | "minted" | "failed"
      event_visibility: "public" | "unlisted" | "private"
      org_role: "owner" | "admin" | "staff"
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
      app_role: ["admin", "user", "gatekeeper"],
      claim_status: ["pending", "minted", "failed"],
      event_visibility: ["public", "unlisted", "private"],
      org_role: ["owner", "admin", "staff"],
    },
  },
} as const
