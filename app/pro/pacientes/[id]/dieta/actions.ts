'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveDietPlan(planId: string, data: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.from('diet_plans').update({ ...data, updated_at: new Date().toISOString() }).eq('id', planId)
  if (error) return { error: error.message }
  revalidatePath('/pro/pacientes')
}

export async function publishPlan(planId: string) {
  const supabase = await createClient()
  await supabase.from('diet_plans').update({ published_at: new Date().toISOString() }).eq('id', planId)
}

export async function addMeal(planId: string, name: string, timeStart: string, emoji: string) {
  const supabase = await createClient()
  const { data: existing } = await supabase.from('meals').select('sort_order').eq('diet_plan_id', planId).order('sort_order', { ascending: false }).limit(1).single()
  const sort_order = (existing?.sort_order ?? 0) + 1

  const { data, error } = await supabase.from('meals').insert({
    diet_plan_id: planId,
    name,
    time_start: timeStart || null,
    emoji: emoji || '🍽️',
    sort_order,
  }).select().single()

  if (error) return { error: error.message }
  return { data }
}

export async function removeMeal(mealId: string) {
  const supabase = await createClient()
  await supabase.from('meals').delete().eq('id', mealId)
}

export async function addFoodToMeal(mealId: string, foodId: string, quantityG: number, description: string) {
  const supabase = await createClient()
  const { data: existing } = await supabase.from('meal_foods').select('sort_order').eq('meal_id', mealId).order('sort_order', { ascending: false }).limit(1).single()
  const sort_order = (existing?.sort_order ?? 0) + 1

  const { data, error } = await supabase.from('meal_foods').insert({
    meal_id: mealId,
    food_id: foodId,
    quantity_g: quantityG,
    quantity_description: description,
    sort_order,
  }).select().single()

  if (error) return { error: error.message }
  return { data }
}

export async function removeFoodFromMeal(mealFoodId: string) {
  const supabase = await createClient()
  await supabase.from('meal_foods').delete().eq('id', mealFoodId)
}

export async function updateMealFood(mealFoodId: string, quantityG: number, description?: string) {
  const supabase = await createClient()
  const update: Record<string, unknown> = { quantity_g: quantityG }
  if (description !== undefined) update.quantity_description = description
  await supabase.from('meal_foods').update(update).eq('id', mealFoodId)
}

export async function addSubstitute(mealFoodId: string, foodId: string, quantityG: number, description: string) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('meal_food_substitutes')
    .select('sort_order')
    .eq('meal_food_id', mealFoodId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const sort_order = (existing?.sort_order ?? 0) + 1

  const { data, error } = await supabase.from('meal_food_substitutes').insert({
    meal_food_id: mealFoodId,
    food_id: foodId,
    quantity_g: quantityG,
    quantity_description: description,
    sort_order,
  }).select().single()

  if (error) return { error: error.message }
  return { data }
}

export async function removeSubstitute(substituteId: string) {
  const supabase = await createClient()
  await supabase.from('meal_food_substitutes').delete().eq('id', substituteId)
}
