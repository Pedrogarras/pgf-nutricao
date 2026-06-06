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

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

type TemplateMeal = { name: string; time_start: string; emoji: string; foods: { search: string; grams: number }[] }
type TemplateId = 'feminino' | 'masculino'

const DIET_TEMPLATES: Record<TemplateId, { kcal_goal: number; meals: TemplateMeal[] }> = {
  feminino: {
    kcal_goal: 1300,
    meals: [
      { name: 'Café da manhã', time_start: '06:00', emoji: '☀️', foods: [
        { search: 'pão de forma integral', grams: 50 },
        { search: 'ovo de galinha', grams: 90 },
        { search: 'manteiga', grams: 8 },
        { search: 'banana prata', grams: 65 },
      ]},
      { name: 'Almoço', time_start: '12:00', emoji: '🍽️', foods: [
        { search: 'batata inglesa', grams: 150 },
        { search: 'peito de frango', grams: 151 },
      ]},
      { name: 'Lanche da tarde', time_start: '15:30', emoji: '🍪', foods: [
        { search: 'bolo com gotas de chocolate', grams: 80 },
      ]},
      { name: 'Jantar', time_start: '19:00', emoji: '🌙', foods: [
        { search: 'batata inglesa', grams: 150 },
        { search: 'peito de frango', grams: 150 },
      ]},
    ],
  },
  masculino: {
    kcal_goal: 1800,
    meals: [
      { name: 'Café da manhã', time_start: '06:00', emoji: '☀️', foods: [
        { search: 'pão de forma integral', grams: 50 },
        { search: 'ovo de galinha', grams: 90 },
        { search: 'banana prata', grams: 65 },
      ]},
      { name: 'Almoço', time_start: '12:00', emoji: '🍽️', foods: [
        { search: 'batata inglesa', grams: 400 },
        { search: 'peito de frango', grams: 201 },
      ]},
      { name: 'Lanche da tarde', time_start: '15:30', emoji: '🍪', foods: [
        { search: 'bolo com gotas de chocolate', grams: 80 },
      ]},
      { name: 'Jantar', time_start: '19:00', emoji: '🌙', foods: [
        { search: 'batata inglesa', grams: 400 },
        { search: 'peito de frango', grams: 200 },
      ]},
    ],
  },
}

function descFromFood(grams: number, food: { portion_g: number | null; portion_description: string | null }): string {
  const base = food.portion_g || 100
  const desc = food.portion_description
  if (desc && base > 0) {
    const ratio = grams / base
    const fmt = ratio % 1 === 0 ? String(ratio) : String(Math.round(ratio * 10) / 10)
    return `${fmt} ${desc} (${grams}g)`
  }
  return `${grams}g`
}

export async function applyTemplate(planId: string, template: TemplateId) {
  const supabase = await createClient()
  const tpl = DIET_TEMPLATES[template]

  await supabase.from('diet_plans').update({ kcal_goal: tpl.kcal_goal }).eq('id', planId)

  const createdMeals = []

  for (let i = 0; i < tpl.meals.length; i++) {
    const mealDef = tpl.meals[i]

    const { data: meal, error: mealErr } = await supabase
      .from('meals')
      .insert({ diet_plan_id: planId, name: mealDef.name, time_start: mealDef.time_start, emoji: mealDef.emoji, sort_order: i + 1 })
      .select()
      .single()

    if (mealErr || !meal) continue

    const createdFoods = []

    for (let j = 0; j < mealDef.foods.length; j++) {
      const foodDef = mealDef.foods[j]

      const { data: found } = await supabase
        .from('foods')
        .select('*')
        .ilike('name', `%${foodDef.search}%`)
        .eq('active', true)
        .order('source', { ascending: true }) // 'TACO' before 'custom'
        .limit(1)

      if (!found?.length) continue
      const food = found[0]

      const desc = descFromFood(foodDef.grams, food)

      const { data: mf } = await supabase
        .from('meal_foods')
        .insert({ meal_id: meal.id, food_id: food.id, quantity_g: foodDef.grams, quantity_description: desc, sort_order: j + 1 })
        .select()
        .single()

      if (mf) createdFoods.push({ ...mf, food, substitutes: [] })
    }

    createdMeals.push({ ...meal, meal_foods: createdFoods })
  }

  return { meals: createdMeals }
}
