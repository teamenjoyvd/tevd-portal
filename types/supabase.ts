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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      abo_verification_requests: {
        Row: {
          admin_note: string | null
          claimed_abo: string | null
          claimed_upline_abo: string
          created_at: string
          id: string
          profile_id: string
          request_type: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          claimed_abo?: string | null
          claimed_upline_abo: string
          created_at?: string
          id?: string
          profile_id: string
          request_type?: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          claimed_abo?: string | null
          claimed_upline_abo?: string
          created_at?: string
          id?: string
          profile_id?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "abo_verification_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "abo_verification_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          access_roles: Database["public"]["Enums"]["user_role"][]
          contents: Json
          created_at: string
          id: string
          is_active: boolean
          slug: string | null
          sort_order: number
          titles: Json
        }
        Insert: {
          access_roles?: Database["public"]["Enums"]["user_role"][]
          contents?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string | null
          sort_order?: number
          titles?: Json
        }
        Update: {
          access_roles?: Database["public"]["Enums"]["user_role"][]
          contents?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string | null
          sort_order?: number
          titles?: Json
        }
        Relationships: []
      }
      approval_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          inngest_event_id: string | null
          request_id: string
          settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          inngest_event_id?: string | null
          request_id: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          inngest_event_id?: string | null
          request_id?: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_jobs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "abo_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bento_config: {
        Row: {
          max_items: number
          tile_key: string
          updated_at: string
        }
        Insert: {
          max_items?: number
          tile_key: string
          updated_at?: string
        }
        Update: {
          max_items?: number
          tile_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          access_roles: Database["public"]["Enums"]["user_role"][]
          allow_guest_registration: boolean
          available_roles: string[]
          category: Database["public"]["Enums"]["event_category"]
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          event_type: Database["public"]["Enums"]["event_type"] | null
          google_event_id: string | null
          guest_capacity: number | null
          id: string
          is_all_day: boolean
          location: string | null
          meeting_url: string | null
          reminders_enabled: boolean
          start_time: string
          title: string
          week_number: number
        }
        Insert: {
          access_roles?: Database["public"]["Enums"]["user_role"][]
          allow_guest_registration?: boolean
          available_roles?: string[]
          category?: Database["public"]["Enums"]["event_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          google_event_id?: string | null
          guest_capacity?: number | null
          id?: string
          is_all_day?: boolean
          location?: string | null
          meeting_url?: string | null
          reminders_enabled?: boolean
          start_time: string
          title: string
          week_number: number
        }
        Update: {
          access_roles?: Database["public"]["Enums"]["user_role"][]
          allow_guest_registration?: boolean
          available_roles?: string[]
          category?: Database["public"]["Enums"]["event_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          google_event_id?: string | null
          guest_capacity?: number | null
          id?: string
          is_all_day?: boolean
          location?: string | null
          meeting_url?: string | null
          reminders_enabled?: boolean
          start_time?: string
          title?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_role_requests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          profile_id: string
          role_label: string
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          profile_id: string
          role_label: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          profile_id?: string
          role_label?: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_role_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_role_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_roles_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_role_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_role_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_role_slots: {
        Row: {
          created_at: string
          event_id: string
          id: string
          role_label: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          role_label: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          role_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_role_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_role_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_roles_history"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_share_links: {
        Row: {
          click_count: number
          created_at: string
          event_id: string
          id: string
          lang: string
          profile_id: string
          revoked_at: string | null
          share_method: string
          token: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          event_id: string
          id?: string
          lang?: string
          profile_id: string
          revoked_at?: string | null
          share_method: string
          token: string
        }
        Update: {
          click_count?: number
          created_at?: string
          event_id?: string
          id?: string
          lang?: string
          profile_id?: string
          revoked_at?: string | null
          share_method?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_share_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_share_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_roles_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_share_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_share_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_registrations: {
        Row: {
          attended_at: string | null
          cancelled_at: string | null
          created_at: string
          email: string
          event_id: string
          expires_at: string
          id: string
          lang: string
          name: string
          share_link_id: string | null
          status: Database["public"]["Enums"]["guest_registration_status"]
          token: string
        }
        Insert: {
          attended_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          email: string
          event_id: string
          expires_at: string
          id?: string
          lang?: string
          name: string
          share_link_id?: string | null
          status?: Database["public"]["Enums"]["guest_registration_status"]
          token: string
        }
        Update: {
          attended_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          email?: string
          event_id?: string
          expires_at?: string
          id?: string
          lang?: string
          name?: string
          share_link_id?: string | null
          status?: Database["public"]["Enums"]["guest_registration_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_roles_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "guest_registrations_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "event_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          guide_id: string
          id: string
          label: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          guide_id: string
          id?: string
          label?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          guide_id?: string
          id?: string
          label?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "guide_attachments_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          access_roles: string[]
          body_bg: Json | null
          body_en: Json | null
          cover_image_url: string | null
          created_at: string
          emoji: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title: Json
          updated_at: string
        }
        Insert: {
          access_roles?: string[]
          body_bg?: Json | null
          body_en?: Json | null
          cover_image_url?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title?: Json
          updated_at?: string
        }
        Update: {
          access_roles?: string[]
          body_bg?: Json | null
          body_en?: Json | null
          cover_image_url?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title?: Json
          updated_at?: string
        }
        Relationships: []
      }
      home_settings: {
        Row: {
          caret_1_text: string
          caret_2_text: string
          caret_3_text: string
          featured_announcement_id: string | null
          id: string
          show_caret_1: boolean
          show_caret_2: boolean
          show_caret_3: boolean
          updated_at: string
        }
        Insert: {
          caret_1_text?: string
          caret_2_text?: string
          caret_3_text?: string
          featured_announcement_id?: string | null
          id?: string
          show_caret_1?: boolean
          show_caret_2?: boolean
          show_caret_3?: boolean
          updated_at?: string
        }
        Update: {
          caret_1_text?: string
          caret_2_text?: string
          caret_3_text?: string
          featured_announcement_id?: string | null
          id?: string
          show_caret_1?: boolean
          show_caret_2?: boolean
          show_caret_3?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_settings_featured_announcement_id_fkey"
            columns: ["featured_announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      links: {
        Row: {
          access_roles: string[]
          created_at: string
          id: string
          is_active: boolean
          label: Json
          sort_order: number
          url: string
        }
        Insert: {
          access_roles?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          label?: Json
          sort_order?: number
          url: string
        }
        Update: {
          access_roles?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          label?: Json
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      los_imports: {
        Row: {
          file_count: number
          id: string
          imported_at: string
          imported_by: string | null
          removed_count: number
          row_count: number
          snapshot: Json
          status: string
        }
        Insert: {
          file_count?: number
          id?: string
          imported_at?: string
          imported_by?: string | null
          removed_count?: number
          row_count?: number
          snapshot: Json
          status: string
        }
        Update: {
          file_count?: number
          id?: string
          imported_at?: string
          imported_by?: string | null
          removed_count?: number
          row_count?: number
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "los_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "los_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      los_members: {
        Row: {
          abo_level: string | null
          abo_number: string
          address: string | null
          annual_ppv: number | null
          bonus_percent: number | null
          country: string | null
          customer_pv: number | null
          customers: number | null
          email: string | null
          entry_date: string | null
          gbv: number | null
          gpv: number | null
          group_orders_count: number | null
          group_size: number | null
          last_synced_at: string
          last_updated_by_abo: string | null
          name: string | null
          personal_order_count: number | null
          phone: string | null
          points_to_next_level: number | null
          ppv: number | null
          qualified_legs: number | null
          renewal_date: string | null
          ruby_pv: number | null
          sponsor_abo_number: string | null
          sponsoring: number | null
        }
        Insert: {
          abo_level?: string | null
          abo_number: string
          address?: string | null
          annual_ppv?: number | null
          bonus_percent?: number | null
          country?: string | null
          customer_pv?: number | null
          customers?: number | null
          email?: string | null
          entry_date?: string | null
          gbv?: number | null
          gpv?: number | null
          group_orders_count?: number | null
          group_size?: number | null
          last_synced_at?: string
          last_updated_by_abo?: string | null
          name?: string | null
          personal_order_count?: number | null
          phone?: string | null
          points_to_next_level?: number | null
          ppv?: number | null
          qualified_legs?: number | null
          renewal_date?: string | null
          ruby_pv?: number | null
          sponsor_abo_number?: string | null
          sponsoring?: number | null
        }
        Update: {
          abo_level?: string | null
          abo_number?: string
          address?: string | null
          annual_ppv?: number | null
          bonus_percent?: number | null
          country?: string | null
          customer_pv?: number | null
          customers?: number | null
          email?: string | null
          entry_date?: string | null
          gbv?: number | null
          gpv?: number | null
          group_orders_count?: number | null
          group_size?: number | null
          last_synced_at?: string
          last_updated_by_abo?: string | null
          name?: string | null
          personal_order_count?: number | null
          phone?: string | null
          points_to_next_level?: number | null
          ppv?: number | null
          qualified_legs?: number | null
          renewal_date?: string | null
          ruby_pv?: number | null
          sponsor_abo_number?: string | null
          sponsoring?: number | null
        }
        Relationships: []
      }
      los_submission_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          profile_id: string
          resolved_at: string | null
          resolved_by: string | null
          root_abo_number: string
          row_count: number
          rows: Json
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          profile_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          root_abo_number: string
          row_count?: number
          rows: Json
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          root_abo_number?: string
          row_count?: number
          rows?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "los_submission_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "los_submission_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "los_submission_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "los_submission_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_event_log: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          status: string
          subject_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          status?: string
          subject_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          status?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_event_log_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "member_event_log_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_read: boolean
          message: string
          profile_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          profile_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          action_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          profile_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "member_notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_vital_signs: {
        Row: {
          created_at: string
          definition_id: string
          id: string
          is_active: boolean
          note: string | null
          profile_id: string
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          created_at?: string
          definition_id: string
          id?: string
          is_active?: boolean
          note?: string | null
          profile_id: string
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          created_at?: string
          definition_id?: string
          id?: string
          is_active?: boolean
          note?: string | null
          profile_id?: string
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_vital_signs_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "vital_sign_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_vital_signs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "member_vital_signs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_vital_signs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "member_vital_signs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_config: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      notification_delivery_log: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error: string | null
          id: string
          payload: Json
          queue_id: string | null
          recipient: string
          resend_id: string | null
          status: string
          template: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          queue_id?: string | null
          recipient: string
          resend_id?: string | null
          status: string
          template: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          queue_id?: string | null
          recipient?: string
          resend_id?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_log_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "notification_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          in_app_enabled: boolean
          preferences: Json
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          preferences?: Json
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          preferences?: Json
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          event_id: string | null
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          profile_id: string | null
          registration_id: string | null
          send_at: string
          sent_at: string | null
          status: string
          type: Database["public"]["Enums"]["notification_queue_type"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["notification_channel"]
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          profile_id?: string | null
          registration_id?: string | null
          send_at?: string
          sent_at?: string | null
          status?: string
          type: Database["public"]["Enums"]["notification_queue_type"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          profile_id?: string | null
          registration_id?: string | null
          send_at?: string
          sent_at?: string | null
          status?: string
          type?: Database["public"]["Enums"]["notification_queue_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_roles_history"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "notification_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notification_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "guest_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_items: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          item_type: string
          linked_trip_id: string | null
          properties: Json
          title: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_type: string
          linked_trip_id?: string | null
          properties?: Json
          title: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_type?: string
          linked_trip_id?: string | null
          properties?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payable_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_items_linked_trip_id_fkey"
            columns: ["linked_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_guests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          linked_profile_id: string | null
          name: string
          owner_profile_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          linked_profile_id?: string | null
          name: string
          owner_profile_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          linked_profile_id?: string | null
          name?: string
          owner_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_guests_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payment_guests_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_guests_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payment_guests_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          admin_note: string | null
          admin_reject_reason: string | null
          admin_status: string
          amount: number
          beneficiary_guest_id: string | null
          created_at: string
          currency: string
          id: string
          logged_by_admin: string | null
          member_reject_reason: string | null
          member_status: string
          note: string | null
          paid_by_profile_id: string | null
          payable_item_id: string | null
          payment_group_id: string | null
          payment_method: string | null
          profile_id: string
          proof_url: string | null
          properties: Json
          transaction_date: string
          trip_id: string | null
        }
        Insert: {
          admin_note?: string | null
          admin_reject_reason?: string | null
          admin_status?: string
          amount: number
          beneficiary_guest_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          logged_by_admin?: string | null
          member_reject_reason?: string | null
          member_status?: string
          note?: string | null
          paid_by_profile_id?: string | null
          payable_item_id?: string | null
          payment_group_id?: string | null
          payment_method?: string | null
          profile_id: string
          proof_url?: string | null
          properties?: Json
          transaction_date: string
          trip_id?: string | null
        }
        Update: {
          admin_note?: string | null
          admin_reject_reason?: string | null
          admin_status?: string
          amount?: number
          beneficiary_guest_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          logged_by_admin?: string | null
          member_reject_reason?: string | null
          member_status?: string
          note?: string | null
          paid_by_profile_id?: string | null
          payable_item_id?: string | null
          payment_group_id?: string | null
          payment_method?: string | null
          profile_id?: string
          proof_url?: string | null
          properties?: Json
          transaction_date?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_beneficiary_guest_id_fkey"
            columns: ["beneficiary_guest_id"]
            isOneToOne: false
            referencedRelation: "payment_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_logged_by_admin_fkey"
            columns: ["logged_by_admin"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_logged_by_admin_fkey"
            columns: ["logged_by_admin"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_by_profile_id_fkey"
            columns: ["paid_by_profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_paid_by_profile_id_fkey"
            columns: ["paid_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payable_item_id_fkey"
            columns: ["payable_item_id"]
            isOneToOne: false
            referencedRelation: "payable_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          abo_number: string | null
          clerk_id: string
          contact_email: string | null
          created_at: string
          display_names: Json
          document_active_type: Database["public"]["Enums"]["document_type"]
          first_name: string
          ical_token: string | null
          id: string
          id_number: string | null
          last_name: string
          notification_prefs: Json
          passport_number: string | null
          phone: string | null
          primary_profile_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          ui_prefs: Json
          upline_abo_number: string | null
          valid_through: string | null
        }
        Insert: {
          abo_number?: string | null
          clerk_id: string
          contact_email?: string | null
          created_at?: string
          display_names?: Json
          document_active_type?: Database["public"]["Enums"]["document_type"]
          first_name: string
          ical_token?: string | null
          id?: string
          id_number?: string | null
          last_name: string
          notification_prefs?: Json
          passport_number?: string | null
          phone?: string | null
          primary_profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          ui_prefs?: Json
          upline_abo_number?: string | null
          valid_through?: string | null
        }
        Update: {
          abo_number?: string | null
          clerk_id?: string
          contact_email?: string | null
          created_at?: string
          display_names?: Json
          document_active_type?: Database["public"]["Enums"]["document_type"]
          first_name?: string
          ical_token?: string | null
          id?: string
          id_number?: string | null
          last_name?: string
          notification_prefs?: Json
          passport_number?: string | null
          phone?: string | null
          primary_profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          ui_prefs?: Json
          upline_abo_number?: string | null
          valid_through?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_profile_id_fkey"
            columns: ["primary_profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "profiles_primary_profile_id_fkey"
            columns: ["primary_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_abo_number: string | null
          new_primary_profile_id: string | null
          new_role: string | null
          new_upline_abo_number: string | null
          old_abo_number: string | null
          old_primary_profile_id: string | null
          old_role: string | null
          old_upline_abo_number: string | null
          profile_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_abo_number?: string | null
          new_primary_profile_id?: string | null
          new_role?: string | null
          new_upline_abo_number?: string | null
          old_abo_number?: string | null
          old_primary_profile_id?: string | null
          old_role?: string | null
          old_upline_abo_number?: string | null
          profile_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_abo_number?: string | null
          new_primary_profile_id?: string | null
          new_role?: string | null
          new_upline_abo_number?: string | null
          old_abo_number?: string | null
          old_primary_profile_id?: string | null
          old_role?: string | null
          old_upline_abo_number?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "profiles_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_role: Database["public"]["Enums"]["user_role"]
          note: string | null
          old_role: Database["public"]["Enums"]["user_role"]
          profile_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_role: Database["public"]["Enums"]["user_role"]
          note?: string | null
          old_role: Database["public"]["Enums"]["user_role"]
          profile_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_role?: Database["public"]["Enums"]["user_role"]
          note?: string | null
          old_role?: Database["public"]["Enums"]["user_role"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_change_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "role_change_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_pinned: boolean
          is_visible: boolean
          platform: string
          post_url: string
          posted_at: string | null
          sort_order: number
          thumbnail_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_visible?: boolean
          platform: string
          post_url: string
          posted_at?: string | null
          sort_order?: number
          thumbnail_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_visible?: boolean
          platform?: string
          post_url?: string
          posted_at?: string | null
          sort_order?: number
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      spouse_link_requests: {
        Row: {
          admin_note: string | null
          claimed_primary_id: string
          created_at: string
          id: string
          requester_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          claimed_primary_id: string
          created_at?: string
          id?: string
          requester_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          claimed_primary_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "spouse_link_requests_claimed_primary_id_fkey"
            columns: ["claimed_primary_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "spouse_link_requests_claimed_primary_id_fkey"
            columns: ["claimed_primary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spouse_link_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: true
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "spouse_link_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tree_nodes: {
        Row: {
          created_at: string
          depth: number
          id: string
          parent_id: string | null
          path: unknown
          profile_id: string
        }
        Insert: {
          created_at?: string
          depth?: number
          id?: string
          parent_id?: string | null
          path: unknown
          profile_id: string
        }
        Update: {
          created_at?: string
          depth?: number
          id?: string
          parent_id?: string | null
          path?: unknown
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tree_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tree_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tree_nodes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "tree_nodes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_attachments: {
        Row: {
          created_at: string
          created_by: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          sort_order: number
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          sort_order?: number
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          sort_order?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trip_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_attachments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_messages: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trip_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_registrations: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: string
          profile_id: string
          status: Database["public"]["Enums"]["registration_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          profile_id: string
          status?: Database["public"]["Enums"]["registration_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["registration_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_registrations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trip_registrations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "member_roles_history"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trip_registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_registrations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          access_roles: string[]
          accommodation_type: string | null
          counter_bg_color: string | null
          created_at: string
          currency: string
          description: Json
          destination: string
          end_date: string
          id: string
          image_url: string | null
          inclusions: string[]
          location: string | null
          milestones: Json
          start_date: string
          title: string
          total_cost: number
          trip_type: string | null
        }
        Insert: {
          access_roles?: string[]
          accommodation_type?: string | null
          counter_bg_color?: string | null
          created_at?: string
          currency?: string
          description: Json
          destination: string
          end_date: string
          id?: string
          image_url?: string | null
          inclusions?: string[]
          location?: string | null
          milestones?: Json
          start_date: string
          title: string
          total_cost?: number
          trip_type?: string | null
        }
        Update: {
          access_roles?: string[]
          accommodation_type?: string | null
          counter_bg_color?: string | null
          created_at?: string
          currency?: string
          description?: Json
          destination?: string
          end_date?: string
          id?: string
          image_url?: string | null
          inclusions?: string[]
          location?: string | null
          milestones?: Json
          start_date?: string
          title?: string
          total_cost?: number
          trip_type?: string | null
        }
        Relationships: []
      }
      verification_log: {
        Row: {
          created_at: string
          error_code: string | null
          error_context: Json | null
          error_message: string
          id: string
          request_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_context?: Json | null
          error_message: string
          id?: string
          request_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_context?: Json | null
          error_message?: string
          id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "abo_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vital_sign_definitions: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      waiting_list: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      member_roles_history: {
        Row: {
          first_name: string | null
          host_count: number | null
          last_name: string | null
          products_count: number | null
          profile_id: string | null
          speaker_count: number | null
          total_count: number | null
        }
        Relationships: []
      }
      v_member_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          event_type: string | null
          field: string | null
          new_value: string | null
          old_value: string | null
          profile_id: string | null
        }
        Relationships: []
      }
      v_roles_history: {
        Row: {
          description: string | null
          end_time: string | null
          event_id: string | null
          host_name: string | null
          products_name: string | null
          speaker_name: string | null
          start_time: string | null
          title: string | null
        }
        Insert: {
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          host_name?: never
          products_name?: never
          speaker_name?: never
          start_time?: string | null
          title?: string | null
        }
        Update: {
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          host_name?: never
          products_name?: never
          speaker_name?: never
          start_time?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      abo_to_ltree_label: { Args: { abo: string }; Returns: string }
      approve_event_role_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approve_los_submissions: {
        Args: { p_ids: string[]; p_resolved_by?: string }
        Returns: number
      }
      approve_member_verification: {
        Args: { p_admin_note?: string; p_request_id: string }
        Returns: {
          abo_number: string
          profile_id: string
          role: string
          tree_path: string
          upline_abo_number: string
        }[]
      }
      can_pay_for: {
        Args: { p_beneficiary: string; p_payer: string }
        Returns: boolean
      }
      claim_due_notifications: {
        Args: {
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          event_id: string | null
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          profile_id: string | null
          registration_id: string | null
          send_at: string
          sent_at: string | null
          status: string
          type: Database["public"]["Enums"]["notification_queue_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_los_submissions: {
        Args: { p_ids: string[]; p_resolved_by?: string }
        Returns: {
          created_at: string
          id: string
          root_abo_number: string
          rows: Json
        }[]
      }
      dissolve_partnership: {
        Args: { p_changed_by: string; p_profile_id: string }
        Returns: {
          clerk_id: string
          old_role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      enqueue_notification: {
        Args: {
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_payload: Json
          p_profile_id: string
          p_send_at?: string
          p_type: Database["public"]["Enums"]["notification_queue_type"]
        }
        Returns: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          event_id: string | null
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          profile_id: string | null
          registration_id: string | null
          send_at: string
          sent_at: string | null
          status: string
          type: Database["public"]["Enums"]["notification_queue_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_queue"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_schedule_guest_reminders_record: {
        Args: {
          p_event_title: string
          p_registration_id: string
          p_start_time: string
        }
        Returns: undefined
      }
      get_core_ancestors: { Args: { p_profile_id: string }; Returns: string[] }
      get_event_years: {
        Args: never
        Returns: {
          year: number
        }[]
      }
      get_los_members_with_profiles: {
        Args: never
        Returns: {
          abo_level: string
          abo_number: string
          annual_ppv: number
          bonus_percent: number
          country: string
          depth: number
          first_name: string
          gpv: number
          group_size: number
          last_name: string
          last_synced_at: string
          last_updated_by_abo: string
          name: string
          ppv: number
          profile_id: string
          qualified_legs: number
          renewal_date: string
          role: string
          sponsor_abo_number: string
        }[]
      }
      get_my_clerk_id: { Args: never; Returns: string }
      get_my_profile_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_payable_beneficiaries: {
        Args: { p_target?: string; p_viewer: string }
        Returns: {
          abo_number: string
          first_name: string
          last_name: string
          profile_id: string
          relation: string
          role: string
        }[]
      }
      get_trip_team_attendees: {
        Args: { p_trip_id: string; p_viewer_profile: string }
        Returns: {
          abo_number: string
          first_name: string
          last_name: string
          profile_id: string
          role: string
        }[]
      }
      import_los_members:
        | { Args: { p_imported_by?: string; p_rows: Json }; Returns: Json }
        | { Args: { rows: Json }; Returns: Json }
      increment_share_link_click: {
        Args: { link_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      patch_member_role: {
        Args: {
          p_changed_by: string
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_note?: string
          p_profile_id: string
        }
        Returns: {
          abo_number: string | null
          clerk_id: string
          contact_email: string | null
          created_at: string
          display_names: Json
          document_active_type: Database["public"]["Enums"]["document_type"]
          first_name: string
          ical_token: string | null
          id: string
          id_number: string | null
          last_name: string
          notification_prefs: Json
          passport_number: string | null
          phone: string | null
          primary_profile_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          ui_prefs: Json
          upline_abo_number: string | null
          valid_through: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pin_social_post: { Args: { p_id: string }; Returns: undefined }
      promote_to_primary: {
        Args: { p_current_primary_id: string; p_current_secondary_id: string }
        Returns: undefined
      }
      purge_absent_los_members: {
        Args: { p_imported_by?: string; p_keep_abos: string[] }
        Returns: Json
      }
      rebuild_tree_paths: { Args: never; Returns: undefined }
      reject_los_submission: {
        Args: { p_id: string; p_note?: string; p_resolved_by?: string }
        Returns: undefined
      }
      release_los_submissions: { Args: { p_ids: string[] }; Returns: number }
      rollback_los_import: { Args: { p_import_id: string }; Returns: Json }
      run_los_digest: { Args: never; Returns: undefined }
      submit_payment_group: {
        Args: { p_payer: string; p_payload: Json }
        Returns: string
      }
      text2ltree: { Args: { "": string }; Returns: unknown }
      upsert_tree_node: {
        Args: {
          p_abo_number?: string
          p_profile_id: string
          p_sponsor_abo_number?: string
        }
        Returns: undefined
      }
      vault_read_secrets: {
        Args: never
        Returns: {
          name: string
          secret: string
        }[]
      }
      withdraw_payment_group: {
        Args: { p_group_id: string; p_payer: string }
        Returns: {
          deleted: number
          proof_url: string
        }[]
      }
    }
    Enums: {
      document_type: "id" | "passport"
      event_category: "N21" | "Personal"
      event_type: "in-person" | "online" | "hybrid"
      guest_registration_status: "pending" | "confirmed"
      notification_channel: "email" | "in_app"
      notification_queue_type:
        | "event_reminder_1h"
        | "event_reminder_15m"
        | "doc_expiry"
      notification_type:
        | "role_request"
        | "trip_request"
        | "trip_created"
        | "event_fetched"
        | "doc_expiry"
        | "los_digest"
        | "trip_message"
        | "trip_attachment"
        | "spouse_link_request"
      registration_status: "pending" | "approved" | "denied"
      reminder_type: "1_hour" | "15_min"
      user_role: "admin" | "core" | "member" | "guest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      document_type: ["id", "passport"],
      event_category: ["N21", "Personal"],
      event_type: ["in-person", "online", "hybrid"],
      guest_registration_status: ["pending", "confirmed"],
      notification_channel: ["email", "in_app"],
      notification_queue_type: [
        "event_reminder_1h",
        "event_reminder_15m",
        "doc_expiry",
      ],
      notification_type: [
        "role_request",
        "trip_request",
        "trip_created",
        "event_fetched",
        "doc_expiry",
        "los_digest",
        "trip_message",
        "trip_attachment",
        "spouse_link_request",
      ],
      registration_status: ["pending", "approved", "denied"],
      reminder_type: ["1_hour", "15_min"],
      user_role: ["admin", "core", "member", "guest"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
