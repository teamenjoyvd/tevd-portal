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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      abo_verification_requests: {
        Row: {
          admin_note: string | null
          claimed_abo: string
          claimed_upline_abo: string
          created_at: string
          id: string
          profile_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          claimed_abo: string
          claimed_upline_abo: string
          created_at?: string
          id?: string
          profile_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          claimed_abo?: string
          claimed_upline_abo?: string
          created_at?: string
          id?: string
          profile_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
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
          access_level: Database["public"]["Enums"]["user_role"][]
          contents: Json
          created_at: string
          id: string
          is_active: boolean
          titles: Json
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["user_role"][]
          contents?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          titles?: Json
        }
        Update: {
          access_level?: Database["public"]["Enums"]["user_role"][]
          contents?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          titles?: Json
        }
        Relationships: []
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
          category: Database["public"]["Enums"]["event_category"]
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          event_type: Database["public"]["Enums"]["event_type"] | null
          google_event_id: string | null
          id: string
          start_time: string
          title: string
          visibility_roles: Database["public"]["Enums"]["user_role"][]
          week_number: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["event_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          google_event_id?: string | null
          id?: string
          start_time: string
          title: string
          visibility_roles?: Database["public"]["Enums"]["user_role"][]
          week_number: number
        }
        Update: {
          category?: Database["public"]["Enums"]["event_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          google_event_id?: string | null
          id?: string
          start_time?: string
          title?: string
          visibility_roles?: Database["public"]["Enums"]["user_role"][]
          week_number?: number
        }
        Relationships: [
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
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          profile_id: string
          role_label: string
          status?: Database["public"]["Enums"]["registration_status"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          profile_id?: string
          role_label?: string
          status?: Database["public"]["Enums"]["registration_status"]
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
            foreignKeyName: "event_role_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      howtos: {
        Row: {
          access_roles: string[]
          body: Json
          cover_image_url: string | null
          created_at: string
          emoji: string | null
          id: string
          is_published: boolean
          slug: string
          title: Json
          updated_at: string
        }
        Insert: {
          access_roles?: string[]
          body?: Json
          cover_image_url?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_published?: boolean
          slug: string
          title?: Json
          updated_at?: string
        }
        Update: {
          access_roles?: string[]
          body?: Json
          cover_image_url?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          title?: Json
          updated_at?: string
        }
        Relationships: []
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
      member_vital_signs: {
        Row: {
          event_key: string
          event_label: string
          has_ticket: boolean
          id: string
          profile_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          event_key: string
          event_label: string
          has_ticket?: boolean
          id?: string
          profile_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          event_key?: string
          event_label?: string
          has_ticket?: boolean
          id?: string
          profile_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_vital_signs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
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
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          passport_number: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
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
          passport_number?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
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
          passport_number?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          valid_through?: string | null
        }
        Relationships: []
      }
      quick_links: {
        Row: {
          access_level: Database["public"]["Enums"]["user_role"][]
          created_at: string
          icon_name: string
          id: string
          label: string
          sort_order: number
          url: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["user_role"][]
          created_at?: string
          icon_name?: string
          id?: string
          label: string
          sort_order?: number
          url: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["user_role"][]
          created_at?: string
          icon_name?: string
          id?: string
          label?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_method: string | null
          profile_id: string
          proof_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          submitted_by_member: boolean
          transaction_date: string
          trip_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          profile_id: string
          proof_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_by_member?: boolean
          transaction_date?: string
          trip_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          profile_id?: string
          proof_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_by_member?: boolean
          transaction_date?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_registrations: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          status: Database["public"]["Enums"]["registration_status"]
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          status?: Database["public"]["Enums"]["registration_status"]
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["registration_status"]
          trip_id?: string
        }
        Relationships: [
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
          accommodation_type: string | null
          created_at: string
          currency: string
          description: string
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
          visibility_roles: string[]
        }
        Insert: {
          accommodation_type?: string | null
          created_at?: string
          currency?: string
          description?: string
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
          visibility_roles?: string[]
        }
        Update: {
          accommodation_type?: string | null
          created_at?: string
          currency?: string
          description?: string
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
          visibility_roles?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abo_to_ltree_label: { Args: { abo: string }; Returns: string }
      get_core_ancestors: { Args: { p_profile_id: string }; Returns: string[] }
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
      import_los_members: { Args: { rows: Json }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      rebuild_tree_paths: { Args: never; Returns: undefined }
      run_los_digest: { Args: never; Returns: undefined }
      text2ltree: { Args: { "": string }; Returns: unknown }
      upsert_tree_node: {
        Args: {
          p_abo_number: string
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
    }
    Enums: {
      document_type: "id" | "passport"
      event_category: "N21" | "Personal"
      event_type: "in-person" | "online" | "hybrid"
      notification_type:
        | "role_request"
        | "trip_request"
        | "trip_created"
        | "event_fetched"
        | "doc_expiry"
        | "los_digest"
      payment_status: "completed" | "pending" | "failed"
      registration_status: "pending" | "approved" | "denied"
      user_role: "admin" | "core" | "member" | "guest"
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
      document_type: ["id", "passport"],
      event_category: ["N21", "Personal"],
      event_type: ["in-person", "online", "hybrid"],
      notification_type: [
        "role_request",
        "trip_request",
        "trip_created",
        "event_fetched",
        "doc_expiry",
        "los_digest",
      ],
      payment_status: ["completed", "pending", "failed"],
      registration_status: ["pending", "approved", "denied"],
      user_role: ["admin", "core", "member", "guest"],
    },
  },
} as const
