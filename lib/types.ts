export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: 'professional' | 'student'; full_name: string; created_at: string }
        Insert: { id: string; role: 'professional' | 'student'; full_name: string }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      patients: {
        Row: {
          id: string; professional_id: string; auth_user_id: string | null
          full_name: string; email: string | null; phone: string | null
          date_of_birth: string | null; gender: string | null
          weight_kg: number | null; height_cm: number | null; goal: string | null
          activity_level: string | null; notes: string | null
          active: boolean; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['patients']['Row'], 'id'|'created_at'|'updated_at'>
        Update: Partial<Database['public']['Tables']['patients']['Insert']>
      }
      foods: {
        Row: {
          id: string; name: string; kcal: number
          protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sodium_mg: number
          portion_g: number; portion_description: string | null
          food_group: string | null; source: 'TACO' | 'custom'
          source_label: string | null
          professional_id: string | null; active: boolean; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['foods']['Row'], 'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['foods']['Insert']>
      }
      diet_plans: {
        Row: {
          id: string; patient_id: string; professional_id: string; title: string
          kcal_goal: number | null; protein_goal_g: number | null
          carbs_goal_g: number | null; fat_goal_g: number | null
          notes: string | null; anamnesis: Json
          active: boolean; valid_from: string | null; valid_until: string | null
          published_at: string | null; created_at: string; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['diet_plans']['Row'], 'id'|'created_at'|'updated_at'>
        Update: Partial<Database['public']['Tables']['diet_plans']['Insert']>
      }
      meals: {
        Row: { id: string; diet_plan_id: string; name: string; time_start: string | null; emoji: string; sort_order: number; notes: string | null }
        Insert: Omit<Database['public']['Tables']['meals']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['meals']['Insert']>
      }
      meal_foods: {
        Row: { id: string; meal_id: string; food_id: string; quantity_g: number; quantity_description: string | null; notes: string | null; sort_order: number }
        Insert: Omit<Database['public']['Tables']['meal_foods']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['meal_foods']['Insert']>
      }
      anthropometric_records: {
        Row: {
          id: string; patient_id: string; professional_id: string; measured_at: string
          weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null
          waist_cm: number | null; hip_cm: number | null; arm_cm: number | null
          thigh_cm: number | null; calf_cm: number | null; adherence_pct: number | null; notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['anthropometric_records']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['anthropometric_records']['Insert']>
      }
      exercises: {
        Row: { id: string; professional_id: string; name: string; muscle_group: string | null; description: string | null; video_url: string | null; thumbnail_url: string | null; active: boolean; created_at: string }
        Insert: Omit<Database['public']['Tables']['exercises']['Row'], 'id'|'created_at'>
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>
      }
      workout_plans: {
        Row: { id: string; patient_id: string; professional_id: string; title: string; notes: string | null; active: boolean; valid_from: string | null; valid_until: string | null; published_at: string | null; created_at: string; updated_at: string }
        Insert: Omit<Database['public']['Tables']['workout_plans']['Row'], 'id'|'created_at'|'updated_at'>
        Update: Partial<Database['public']['Tables']['workout_plans']['Insert']>
      }
      workout_days: {
        Row: { id: string; workout_plan_id: string; name: string; sort_order: number }
        Insert: Omit<Database['public']['Tables']['workout_days']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['workout_days']['Insert']>
      }
      workout_exercises: {
        Row: { id: string; workout_day_id: string; exercise_id: string; sets: number | null; reps: string | null; rest_seconds: number | null; notes: string | null; sort_order: number }
        Insert: Omit<Database['public']['Tables']['workout_exercises']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['workout_exercises']['Insert']>
      }
    }
  }
}

// Tipos auxiliares
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Patient = Database['public']['Tables']['patients']['Row']
export type Food = Database['public']['Tables']['foods']['Row']
export type DietPlan = Database['public']['Tables']['diet_plans']['Row']
export type Meal = Database['public']['Tables']['meals']['Row']
export type MealFood = Database['public']['Tables']['meal_foods']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row']
export type WorkoutDay = Database['public']['Tables']['workout_days']['Row']
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row']
export type AnthropometricRecord = Database['public']['Tables']['anthropometric_records']['Row']

// Tipo composto para exibição
export type MealWithFoods = Meal & {
  meal_foods: (MealFood & { food: Food })[]
}
export type DietPlanWithMeals = DietPlan & {
  meals: MealWithFoods[]
  patient: Patient
}
