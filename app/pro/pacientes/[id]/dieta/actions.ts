'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveDietPlan(planId: string, data: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase.from('diet_plans').update({ ...data, updated_at: new Date().toISOString() }).eq('id', planId).eq('professional_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/pro/pacientes')
}

export async function publishPlan(planId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  await supabase.from('diet_plans').update({ published_at: new Date().toISOString() }).eq('id', planId).eq('professional_id', user.id)
}

// Helper: verify a meal belongs to this professional via diet_plan ownership
async function getMealOwnerId(supabase: Awaited<ReturnType<typeof createClient>>, mealId: string) {
  const { data } = await supabase
    .from('meals')
    .select('diet_plans(professional_id)')
    .eq('id', mealId)
    .single()
  return (data?.diet_plans as { professional_id: string } | null)?.professional_id ?? null
}

// Helper: verify a meal_food belongs to this professional
async function getMealFoodOwnerId(supabase: Awaited<ReturnType<typeof createClient>>, mealFoodId: string) {
  const { data } = await supabase
    .from('meal_foods')
    .select('meal:meals(diet_plans(professional_id))')
    .eq('id', mealFoodId)
    .single()
  return ((data?.meal as { diet_plans?: { professional_id?: string } } | null)?.diet_plans?.professional_id) ?? null
}

export async function addMeal(planId: string, name: string, timeStart: string, emoji: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Verify plan ownership
  const { data: plan } = await supabase.from('diet_plans').select('id').eq('id', planId).eq('professional_id', user.id).single()
  if (!plan) return { error: 'Não encontrado' }

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = await getMealOwnerId(supabase, mealId)
  if (ownerId !== user.id) return
  await supabase.from('meals').delete().eq('id', mealId)
}

export async function addFoodToMeal(mealId: string, foodId: string, quantityG: number, description: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const ownerId = await getMealOwnerId(supabase, mealId)
  if (ownerId !== user.id) return { error: 'Não encontrado' }

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = await getMealFoodOwnerId(supabase, mealFoodId)
  if (ownerId !== user.id) return
  await supabase.from('meal_foods').delete().eq('id', mealFoodId)
}

export async function updateMealFood(mealFoodId: string, quantityG: number, description?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = await getMealFoodOwnerId(supabase, mealFoodId)
  if (ownerId !== user.id) return
  const update: Record<string, unknown> = { quantity_g: quantityG }
  if (description !== undefined) update.quantity_description = description
  await supabase.from('meal_foods').update(update).eq('id', mealFoodId)
}

export async function addSubstitute(mealFoodId: string, foodId: string, quantityG: number, description: string, notes?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const ownerId = await getMealFoodOwnerId(supabase, mealFoodId)
  if (ownerId !== user.id) return { error: 'Não encontrado' }

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
    notes: notes ?? null,
    sort_order,
  }).select().single()

  if (error) return { error: error.message }
  return { data }
}

export async function removeSubstitute(substituteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // Ownership via join
  const { data: sub } = await supabase
    .from('meal_food_substitutes')
    .select('meal_food:meal_foods(meal:meals(diet_plans(professional_id)))')
    .eq('id', substituteId)
    .single()
  const ownerId = ((sub?.meal_food as { meal?: { diet_plans?: { professional_id?: string } } } | null)
    ?.meal?.diet_plans?.professional_id) ?? null
  if (ownerId !== user.id) return
  await supabase.from('meal_food_substitutes').delete().eq('id', substituteId)
}

export async function reorderMeal(planId: string, mealId: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Verify plan belongs to this professional
  const { data: plan } = await supabase.from('diet_plans').select('id').eq('id', planId).eq('professional_id', user.id).single()
  if (!plan) return

  // Fetch all meals sorted
  const { data: meals } = await supabase.from('meals').select('id, sort_order').eq('diet_plan_id', planId).order('sort_order')
  if (!meals) return

  const idx = meals.findIndex(m => m.id === mealId)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= meals.length) return

  const a = meals[idx], b = meals[swapIdx]
  await supabase.from('meals').update({ sort_order: b.sort_order }).eq('id', a.id)
  await supabase.from('meals').update({ sort_order: a.sort_order }).eq('id', b.id)
}

export async function reorderMealFood(mealId: string, mealFoodId: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = await getMealOwnerId(supabase, mealId)
  if (ownerId !== user.id) return

  const { data: foods } = await supabase.from('meal_foods').select('id, sort_order').eq('meal_id', mealId).order('sort_order')
  if (!foods) return

  const idx = foods.findIndex(f => f.id === mealFoodId)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= foods.length) return

  const a = foods[idx], b = foods[swapIdx]
  await supabase.from('meal_foods').update({ sort_order: b.sort_order }).eq('id', a.id)
  await supabase.from('meal_foods').update({ sort_order: a.sort_order }).eq('id', b.id)
}

export async function updateMeal(mealId: string, data: { name?: string; time_start?: string; emoji?: string; notes?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = await getMealOwnerId(supabase, mealId)
  if (ownerId !== user.id) return
  await supabase.from('meals').update(data).eq('id', mealId)
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

type TemplateMeal = {
  name: string; time_start: string; emoji: string; notes: string
  foods: { search: string; grams: number }[]
}
type TemplateId = 'feminino' | 'masculino'

const CAFE_NOTES =
  'Fruta é opcional — recomendada para vitaminas e saciedade (melancia, morango e melão em maior quantidade). ' +
  'Leite do café, se desnatado, não precisa ser quantificado. ' +
  'Para o ovo, use os substitutos por praticidade: queijo muçarela, requeijão, cottage. ' +
  'Com iogurte natural + fruta + doce de leite você pode montar um bowl doce com bastante volume e saciedade.'

const ALMOCO_NOTES =
  'Em casa sempre pese os alimentos — as medidas caseiras são referência para fora de casa. ' +
  'Salada e legumes (tomate, alface, abobrinha, brócolis, etc.) à vontade. ' +
  'Para temperar: máx. 1 col. chá de óleo; vinagre, limão, mostarda, ketchup e ervas à vontade. ' +
  'Molho de tomate à vontade (pese o macarrão separado). Queijo ralado: máx. 20 g como adicional. ' +
  'Atum: sempre em filé/pedaço inteiro, escorra bem o óleo.'

const LANCHE_NOTES =
  'Se ater sempre à gramagem e não à medida caseira.'

const JANTAR_NOTES =
  'Mesmo porcionamento de proteína do almoço — as opções de lá servem aqui e vice-versa. ' +
  'Molho de tomate à vontade. Para sopas: pese a carne e o carboidrato; caldo e legumes livres. ' +
  'Sanduíche de atum ou sardinha é uma boa opção prática: 2 latas + 2 pães + 1 tomate e está feita a refeição.'

const DIET_TEMPLATES: Record<TemplateId, { kcal_goal: number; meals: TemplateMeal[] }> = {
  feminino: {
    kcal_goal: 1300,
    meals: [
      { name: 'Café da manhã', time_start: '06:00', emoji: '☀️', notes: CAFE_NOTES, foods: [
        { search: 'pão de forma integral', grams: 50 },
        { search: 'ovo de galinha', grams: 90 },
        { search: 'manteiga', grams: 8 },
        { search: 'banana prata', grams: 65 },
      ]},
      { name: 'Almoço', time_start: '12:00', emoji: '🍽️', notes: ALMOCO_NOTES, foods: [
        { search: 'batata inglesa', grams: 150 },
        { search: 'peito de frango', grams: 151 },
      ]},
      { name: 'Lanche da tarde', time_start: '15:30', emoji: '🍪', notes: LANCHE_NOTES, foods: [
        { search: 'bolo com gotas de chocolate', grams: 80 },
      ]},
      { name: 'Jantar', time_start: '19:00', emoji: '🌙', notes: JANTAR_NOTES, foods: [
        { search: 'batata inglesa', grams: 150 },
        { search: 'peito de frango', grams: 150 },
      ]},
    ],
  },
  masculino: {
    kcal_goal: 1800,
    meals: [
      { name: 'Café da manhã', time_start: '06:00', emoji: '☀️', notes: CAFE_NOTES, foods: [
        { search: 'pão de forma integral', grams: 50 },
        { search: 'ovo de galinha', grams: 90 },
        { search: 'banana prata', grams: 65 },
      ]},
      { name: 'Almoço', time_start: '12:00', emoji: '🍽️', notes: ALMOCO_NOTES, foods: [
        { search: 'batata inglesa', grams: 400 },
        { search: 'peito de frango', grams: 201 },
      ]},
      { name: 'Lanche da tarde', time_start: '15:30', emoji: '🍪', notes: LANCHE_NOTES, foods: [
        { search: 'bolo com gotas de chocolate', grams: 80 },
      ]},
      { name: 'Jantar', time_start: '19:00', emoji: '🌙', notes: JANTAR_NOTES, foods: [
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { meals: [] }
  const tpl = DIET_TEMPLATES[template]

  await supabase.from('diet_plans').update({ kcal_goal: tpl.kcal_goal }).eq('id', planId).eq('professional_id', user.id)

  const createdMeals = []

  for (let i = 0; i < tpl.meals.length; i++) {
    const mealDef = tpl.meals[i]

    const { data: meal, error: mealErr } = await supabase
      .from('meals')
      .insert({ diet_plan_id: planId, name: mealDef.name, time_start: mealDef.time_start, emoji: mealDef.emoji, notes: mealDef.notes ?? null, sort_order: i + 1 })
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mf) createdFoods.push({ ...(mf as any), food, substitutes: [] })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdMeals.push({ ...(meal as any), meal_foods: createdFoods })
  }

  return { meals: createdMeals }
}
