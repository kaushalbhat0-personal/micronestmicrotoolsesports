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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          id: string
          status: string
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          is_active: boolean
          key: string
          name: string
          short_name: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          key: string
          name: string
          short_name: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          key?: string
          name?: string
          short_name?: string
        }
        Relationships: []
      }
      player_game_profiles: {
        Row: {
          availability: string[]
          created_at: string
          game_key: string
          game_user_id: string | null
          id: string
          ign: string
          is_visible: boolean
          play_modes: string[]
          player_user_id: string
          primary_role: string | null
          region_code: string | null
          updated_at: string
        }
        Insert: {
          availability?: string[]
          created_at?: string
          game_key: string
          game_user_id?: string | null
          id?: string
          ign: string
          is_visible?: boolean
          play_modes?: string[]
          player_user_id: string
          primary_role?: string | null
          region_code?: string | null
          updated_at?: string
        }
        Update: {
          availability?: string[]
          created_at?: string
          game_key?: string
          game_user_id?: string | null
          id?: string
          ign?: string
          is_visible?: boolean
          play_modes?: string[]
          player_user_id?: string
          primary_role?: string | null
          region_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_game_profiles_game_key_fkey"
            columns: ["game_key"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "player_game_profiles_player_user_id_fkey"
            columns: ["player_user_id"]
            isOneToOne: false
            referencedRelation: "player_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      player_profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          country_code: string | null
          created_at: string
          display_name: string
          handle: string
          handle_changed_at: string | null
          is_discoverable: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          display_name: string
          handle: string
          handle_changed_at?: string | null
          is_discoverable?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          handle_changed_at?: string | null
          is_discoverable?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      player_bgmi_ownership_cases: {
        Row: {
          id: string
          player_id: string
          status: string
          claimed_game_user_id: string | null
          identity_mismatch: boolean
          evidence_count: number
          submitted_at: string | null
          withdrawn_at: string | null
          created_at: string
          updated_at: string
          decided_at: string | null
          player_facing_message: string | null
          decision_id: string | null
        }
        Insert: {
          id?: string
          player_id: string
          status?: string
          claimed_game_user_id?: string | null
          identity_mismatch?: boolean
          evidence_count?: number
          submitted_at?: string | null
          withdrawn_at?: string | null
          created_at?: string
          updated_at?: string
          decided_at?: string | null
          player_facing_message?: string | null
          decision_id?: string | null
        }
        Update: {
          id?: string
          player_id?: string
          status?: string
          claimed_game_user_id?: string | null
          identity_mismatch?: boolean
          evidence_count?: number
          submitted_at?: string | null
          withdrawn_at?: string | null
          created_at?: string
          updated_at?: string
          decided_at?: string | null
          player_facing_message?: string | null
          decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_bgmi_ownership_cases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      player_bgmi_ownership_evidence: {
        Row: {
          id: string
          case_id: string
          player_id: string
          storage_bucket: string
          storage_path: string
          content_type: string
          byte_size: number
          width: number
          height: number
          sha256: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          player_id: string
          storage_bucket?: string
          storage_path: string
          content_type: string
          byte_size: number
          width: number
          height: number
          sha256: string
          sort_order: number
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          player_id?: string
          storage_bucket?: string
          storage_path?: string
          content_type?: string
          byte_size?: number
          width?: number
          height?: number
          sha256?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_bgmi_ownership_evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "player_bgmi_ownership_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_bgmi_ownership_evidence_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      player_bgmi_ownership_rate_events: {
        Row: {
          id: number
          player_id: string
          event_type: string
          created_at: string
        }
        Insert: {
          id?: number
          player_id: string
          event_type: string
          created_at?: string
        }
        Update: {
          id?: number
          player_id?: string
          event_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_bgmi_ownership_rate_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_bgmi_ownership_rate_limit: {
        Args: {
          p_event_type: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: undefined
      }
      is_super_admin: {
        Args: never
        Returns: boolean
      }
      decide_player_bgmi_ownership_case: {
        Args: {
          p_case_id: string
          p_decision: string
          p_internal_reason: string
          p_player_facing_message?: string | null
        }
        Returns: {
          id: string
          player_id: string
          status: string
          claimed_game_user_id: string | null
          identity_mismatch: boolean
          evidence_count: number
          submitted_at: string | null
          withdrawn_at: string | null
          created_at: string
          updated_at: string
          decided_at: string | null
          player_facing_message: string | null
          decision_id: string | null
        }
      }
      list_pending_bgmi_ownership_cases: {
        Args: { p_limit?: number }
        Returns: {
          case_id: string
          player_id: string
          handle: string
          display_name: string
          ign: string | null
          claimed_game_user_id: string
          submitted_at: string | null
          evidence_count: number
          status: string
          identity_mismatch: boolean
        }[]
      }
      get_player_bgmi_ownership_public_status: {
        Args: { p_handle: string }
        Returns: {
          handle: string
          ownership_reviewed: boolean
          status_label: string | null
        }[]
      }
      submit_player_bgmi_ownership_case: {
        Args: { p_case_id: string }
        Returns: {
          id: string
          player_id: string
          status: string
          claimed_game_user_id: string | null
          identity_mismatch: boolean
          evidence_count: number
          submitted_at: string | null
          withdrawn_at: string | null
          created_at: string
          updated_at: string
        }
      }
      withdraw_player_bgmi_ownership_case: {
        Args: { p_case_id: string }
        Returns: {
          case_id: string
          storage_path: string
          already_withdrawn: boolean
        }[]
      }
      create_player_profile: {
        Args: {
          p_bio: string
          p_country_code: string
          p_display_name: string
          p_handle: string
        }
        Returns: {
          avatar_path: string
          bio: string
          country_code: string
          created_at: string
          display_name: string
          handle: string
          is_discoverable: boolean
          updated_at: string
          user_id: string
        }[]
      }
      ensure_app_user: {
        Args: never
        Returns: {
          created_at: string
          id: string
          status: string
          suspended_at: string
          updated_at: string
        }[]
      }
      get_player_by_handle: {
        Args: { p_handle: string }
        Returns: {
          availability: string[]
          avatar_url: string
          bio: string
          country_code: string
          display_name: string
          game_key: string
          game_name: string
          handle: string
          ign: string
          play_modes: string[]
          primary_role: string
          region_code: string
        }[]
      }
      search_player_directory: {
        Args: {
          p_game?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_region?: string
          p_role?: string
        }
        Returns: {
          availability: string[]
          avatar_url: string
          bio: string
          country_code: string
          display_name: string
          game_key: string
          game_name: string
          handle: string
          ign: string
          play_modes: string[]
          primary_role: string
          region_code: string
        }[]
      }
      set_player_discoverability: {
        Args: { p_value: boolean }
        Returns: {
          avatar_path: string
          bio: string
          country_code: string
          created_at: string
          display_name: string
          handle: string
          handle_changed_at: string
          is_discoverable: boolean
          updated_at: string
          user_id: string
        }[]
      }
      update_player_handle: {
        Args: { p_handle: string }
        Returns: {
          avatar_path: string
          bio: string
          country_code: string
          created_at: string
          display_name: string
          handle: string
          handle_changed_at: string
          is_discoverable: boolean
          updated_at: string
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
