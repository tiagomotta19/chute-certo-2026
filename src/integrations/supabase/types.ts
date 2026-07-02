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
      bolao_members: {
        Row: {
          bolao_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          bolao_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          bolao_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bolao_members_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
        ]
      }
      boloes: {
        Row: {
          competition: string
          created_at: string
          created_by: string
          id: string
          invite_code: string
          invite_created_at: string
          name: string
          updated_at: string
        }
        Insert: {
          competition?: string
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          invite_created_at?: string
          name: string
          updated_at?: string
        }
        Update: {
          competition?: string
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          invite_created_at?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_events: {
        Row: {
          bolao_id: string
          created_at: string
          event_type: string
          id: string
          match_id: string | null
          message: string
          user_id: string | null
        }
        Insert: {
          bolao_id: string
          created_at?: string
          event_type: string
          id?: string
          match_id?: string | null
          message: string
          user_id?: string | null
        }
        Update: {
          bolao_id?: string
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string | null
          message?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_events_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_football_id: number | null
          away_score: number | null
          away_team: string
          bonus_question: string | null
          bonus_result: boolean | null
          city: string | null
          created_at: string
          extra_time_away: number | null
          extra_time_home: number | null
          group_name: string | null
          home_score: number | null
          home_team: string
          id: string
          is_finished: boolean
          is_manual_override: boolean
          match_date: string
          penalty_away: number | null
          penalty_home: number | null
          round_name: string | null
          stadium: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          updated_at: string
        }
        Insert: {
          api_football_id?: number | null
          away_score?: number | null
          away_team: string
          bonus_question?: string | null
          bonus_result?: boolean | null
          city?: string | null
          created_at?: string
          extra_time_away?: number | null
          extra_time_home?: number | null
          group_name?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          is_finished?: boolean
          is_manual_override?: boolean
          match_date: string
          penalty_away?: number | null
          penalty_home?: number | null
          round_name?: string | null
          stadium?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          updated_at?: string
        }
        Update: {
          api_football_id?: number | null
          away_score?: number | null
          away_team?: string
          bonus_question?: string | null
          bonus_result?: boolean | null
          city?: string | null
          created_at?: string
          extra_time_away?: number | null
          extra_time_home?: number | null
          group_name?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          is_finished?: boolean
          is_manual_override?: boolean
          match_date?: string
          penalty_away?: number | null
          penalty_home?: number | null
          round_name?: string | null
          stadium?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          updated_at?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          away_score: number
          bolao_id: string
          bonus_answer: boolean | null
          bonus_points: number | null
          created_at: string
          home_score: number
          id: string
          match_id: string
          points: number | null
          scorer_name: string | null
          scorer_points: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          away_score: number
          bolao_id: string
          bonus_answer?: boolean | null
          bonus_points?: number | null
          created_at?: string
          home_score: number
          id?: string
          match_id: string
          points?: number | null
          scorer_name?: string | null
          scorer_points?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          away_score?: number
          bolao_id?: string
          bonus_answer?: boolean | null
          bonus_points?: number | null
          created_at?: string
          home_score?: number
          id?: string
          match_id?: string
          points?: number | null
          scorer_name?: string | null
          scorer_points?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      quiz_participants: {
        Row: {
          created_at: string
          finished: boolean
          id: string
          is_ready: boolean
          room_id: string
          score: number
          time_taken: number | null
          total: number
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          finished?: boolean
          id?: string
          is_ready?: boolean
          room_id: string
          score?: number
          time_taken?: number | null
          total?: number
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          finished?: boolean
          id?: string
          is_ready?: boolean
          room_id?: string
          score?: number
          time_taken?: number | null
          total?: number
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "quiz_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          id: string
          level: string | null
          mode: string
          played_at: string
          score: number
          time_taken: number | null
          total: number
          user_id: string
        }
        Insert: {
          id?: string
          level?: string | null
          mode: string
          played_at?: string
          score?: number
          time_taken?: number | null
          total?: number
          user_id: string
        }
        Update: {
          id?: string
          level?: string | null
          mode?: string
          played_at?: string
          score?: number
          time_taken?: number | null
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      quiz_rooms: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
          level: string
          question_count: number
          questions: Json
          status: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by: string
          id?: string
          level?: string
          question_count?: number
          questions?: Json
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          level?: string
          question_count?: number
          questions?: Json
          status?: string
        }
        Relationships: []
      }
      scorer_snapshots: {
        Row: {
          captured_at: string
          id: string
          scorers: Json
        }
        Insert: {
          captured_at?: string
          id?: string
          scorers: Json
        }
        Update: {
          captured_at?: string
          id?: string
          scorers?: Json
        }
        Relationships: []
      }
      season_predictions: {
        Row: {
          best_player: string | null
          best_player_points: number | null
          bolao_id: string
          champion: string | null
          champion_points: number | null
          created_at: string
          id: string
          top_scorer: string | null
          top_scorer_points: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_player?: string | null
          best_player_points?: number | null
          bolao_id: string
          champion?: string | null
          champion_points?: number | null
          created_at?: string
          id?: string
          top_scorer?: string | null
          top_scorer_points?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_player?: string | null
          best_player_points?: number | null
          bolao_id?: string
          champion?: string | null
          champion_points?: number | null
          created_at?: string
          id?: string
          top_scorer?: string | null
          top_scorer_points?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_predictions_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      calculate_bonus_points: {
        Args: { bonus_result_input: boolean; match_id_input: string }
        Returns: undefined
      }
      calculate_match_points: {
        Args: { match_id_input: string }
        Returns: undefined
      }
      get_user_bolao_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_quiz_room: { Args: { code_input: string }; Returns: Json }
      lookup_bolao_by_invite: {
        Args: { invite_code_input: string }
        Returns: Json
      }
      recompute_match_scorers_from_snapshots: {
        Args: { match_id_input: string }
        Returns: Json
      }
      regenerate_invite_code: {
        Args: { bolao_id_input: string }
        Returns: Json
      }
      set_match_scorers: {
        Args: { match_id_input: string; scorer_names: string[] }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      match_stage:
        | "group"
        | "round_of_32"
        | "round_of_16"
        | "quarter_final"
        | "semi_final"
        | "third_place"
        | "final"
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
      app_role: ["admin", "moderator", "user"],
      match_stage: [
        "group",
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
      ],
    },
  },
} as const
