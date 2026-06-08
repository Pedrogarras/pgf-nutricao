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

export async function addFoodToMeal(mealId: string, foodId: string, quantityG: number, description?: string, notes?: string | null) {
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
    quantity_description: description ?? null,
    notes: notes ?? null,
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

export async function updateMealFood(mealFoodId: string, quantityG: number, description?: string, notes?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const ownerId = await getMealFoodOwnerId(supabase, mealFoodId)
  if (ownerId !== user.id) return
  const update: Record<string, unknown> = { quantity_g: quantityG }
  if (description !== undefined) update.quantity_description = description
  if (notes !== undefined) update.notes = notes ?? null
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

// ─── Swap: troca alimento principal ↔ substituto ─────────────────────────────
export async function swapSubstitute(mealFoodId: string, substituteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const ownerId = await getMealFoodOwnerId(supabase, mealFoodId)
  if (ownerId !== user.id) return { error: 'Não autorizado' }

  // Fetch current values for both records
  const [{ data: mf }, { data: sub }] = await Promise.all([
    supabase.from('meal_foods')
      .select('food_id, quantity_g, quantity_description')
      .eq('id', mealFoodId).single(),
    supabase.from('meal_food_substitutes')
      .select('food_id, quantity_g, quantity_description')
      .eq('id', substituteId).eq('meal_food_id', mealFoodId).single(),
  ])
  if (!mf || !sub) return { error: 'Não encontrado' }

  // Atomic swap — meal_food takes substitute's values, substitute takes meal_food's values
  const [r1, r2] = await Promise.all([
    supabase.from('meal_foods').update({
      food_id: sub.food_id,
      quantity_g: sub.quantity_g,
      quantity_description: sub.quantity_description,
    }).eq('id', mealFoodId),
    supabase.from('meal_food_substitutes').update({
      food_id: mf.food_id,
      quantity_g: mf.quantity_g,
      quantity_description: mf.quantity_description,
    }).eq('id', substituteId),
  ])
  if (r1.error) return { error: r1.error.message }
  if (r2.error) return { error: r2.error.message }
  return { ok: true }
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

export async function duplicateMeal(mealId: string, planId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Verify plan ownership
  const { data: plan } = await supabase.from('diet_plans').select('id').eq('id', planId).eq('professional_id', user.id).single()
  if (!plan) return { error: 'Plano não encontrado' }

  // Load the source meal with all foods and substitutes
  const { data: sourceMeal } = await supabase
    .from('meals')
    .select(`id, name, time_start, emoji, sort_order, notes,
      meal_foods(id, food_id, quantity_g, quantity_description, sort_order,
        meal_food_substitutes(food_id, quantity_g, quantity_description, notes, sort_order)
      )`)
    .eq('id', mealId)
    .eq('diet_plan_id', planId)
    .single()

  if (!sourceMeal) return { error: 'Refeição não encontrada' }

  // Determine the new sort_order (append after last meal)
  const { data: lastMeal } = await supabase
    .from('meals')
    .select('sort_order')
    .eq('diet_plan_id', planId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const newSortOrder = (lastMeal?.sort_order ?? 0) + 1

  // Create the new meal
  const { data: newMeal, error: mealErr } = await supabase
    .from('meals')
    .insert({
      diet_plan_id: planId,
      name: `${sourceMeal.name} (cópia)`,
      time_start: sourceMeal.time_start,
      emoji: sourceMeal.emoji,
      sort_order: newSortOrder,
      notes: sourceMeal.notes,
    })
    .select('id, name, time_start, emoji, sort_order, notes')
    .single()

  if (mealErr || !newMeal) return { error: mealErr?.message ?? 'Erro ao duplicar' }

  type SubRow = { food_id: string; quantity_g: number; quantity_description: string | null; notes: string | null; sort_order: number }
  type FoodRow = { id: string; food_id: string; quantity_g: number; quantity_description: string | null; sort_order: number; meal_food_substitutes: SubRow[] }

  const createdFoods = []
  for (const mf of (sourceMeal.meal_foods as FoodRow[]) ?? []) {
    const { data: newMf } = await supabase
      .from('meal_foods')
      .insert({ meal_id: newMeal.id, food_id: mf.food_id, quantity_g: mf.quantity_g, quantity_description: mf.quantity_description, sort_order: mf.sort_order })
      .select('id, food_id, quantity_g, quantity_description, sort_order')
      .single()
    if (!newMf) continue

    for (const sub of mf.meal_food_substitutes ?? []) {
      await supabase.from('meal_food_substitutes').insert({
        meal_food_id: newMf.id, food_id: sub.food_id, quantity_g: sub.quantity_g,
        quantity_description: sub.quantity_description, notes: sub.notes ?? null, sort_order: sub.sort_order,
      })
    }
    createdFoods.push(newMf)
  }

  // Return the full meal with food details by re-fetching
  const { data: fullMeal } = await supabase
    .from('meals')
    .select(`id, name, time_start, emoji, sort_order, notes,
      meal_foods(id, food_id, quantity_g, quantity_description, sort_order, notes,
        food:foods(*),
        substitutes:meal_food_substitutes(id, food_id, quantity_g, quantity_description, notes, sort_order, food:foods(*))
      )`)
    .eq('id', newMeal.id)
    .single()

  return { meal: fullMeal }
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

export async function updateMeal(mealId: string, data: { name?: string; time_start?: string | null; emoji?: string | null; notes?: string }) {
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

// ===================== MEAL TEMPLATES =====================

export async function saveMealAsTemplate(mealId: string, name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: meal } = await supabase
    .from('meals')
    .select('id, name, emoji, time_start, diet_plans(professional_id), meal_foods(id, food_id, quantity_g, quantity_description, sort_order, food:foods(name))')
    .eq('id', mealId)
    .single()

  const ownerId = (meal?.diet_plans as { professional_id: string } | null)?.professional_id
  if (ownerId !== user.id) return { error: 'Sem permissão' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const foods = ((meal?.meal_foods ?? []) as any[])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(mf => ({
      food_id: mf.food_id,
      food_name: (mf.food as { name: string } | null)?.name ?? '',
      quantity_g: mf.quantity_g,
      quantity_description: mf.quantity_description ?? '',
    }))

  const { data, error } = await supabase
    .from('meal_templates')
    .insert({
      professional_id: user.id,
      name: name || (meal?.name ?? 'Template'),
      emoji: meal?.emoji ?? '🍽️',
      time_start: meal?.time_start ?? null,
      foods,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { template: data }
}

export async function applyMealTemplate(planId: string, templateId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Verify plan ownership
  const { data: plan } = await supabase
    .from('diet_plans')
    .select('id')
    .eq('id', planId)
    .eq('professional_id', user.id)
    .single()
  if (!plan) return { error: 'Plano não encontrado' }

  // Get the template
  const { data: tpl } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('id', templateId)
    .eq('professional_id', user.id)
    .single()
  if (!tpl) return { error: 'Template não encontrado' }

  // Create the meal
  const { data: meal, error: mealErr } = await supabase
    .from('meals')
    .insert({ diet_plan_id: planId, name: tpl.name, emoji: tpl.emoji, time_start: tpl.time_start, sort_order: 99 })
    .select()
    .single()

  if (mealErr || !meal) return { error: 'Erro ao criar refeição' }

  const createdFoods: unknown[] = []
  const templateFoods = (tpl.foods ?? []) as Array<{ food_id: string; food_name: string; quantity_g: number; quantity_description: string }>

  for (let j = 0; j < templateFoods.length; j++) {
    const f = templateFoods[j]
    const { data: food } = await supabase.from('foods').select('*').eq('id', f.food_id).eq('active', true).single()
    if (!food) continue
    const { data: mf } = await supabase
      .from('meal_foods')
      .insert({ meal_id: meal.id, food_id: food.id, quantity_g: f.quantity_g, quantity_description: f.quantity_description, sort_order: j + 1 })
      .select()
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (mf) createdFoods.push({ ...(mf as any), food, substitutes: [] })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { meal: { ...(meal as any), meal_foods: createdFoods } }
}
