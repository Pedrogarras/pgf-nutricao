import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patientId = request.nextUrl.searchParams.get('patient_id')
  const days = parseInt(request.nextUrl.searchParams.get('days') ?? '30')
  if (!patientId) return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  // Fetch diary entries
  const { data: entries } = await supabase
    .from('diary_entries')
    .select('logged_at, total_kcal, total_protein_g, total_carbs_g, total_fat_g, meal_name')
    .eq('patient_id', patientId)
    .eq('professional_id', user.id)
    .gte('logged_at', sinceStr)
    .order('logged_at', { ascending: true })

  // Fetch active diet plan targets
  const { data: activePlan } = await supabase
    .from('diet_plans')
    .select('kcal_goal, meals(meal_foods(quantity_g, food:foods(kcal, protein_g, carbs_g, fat_g, portion_g)))')
    .eq('patient_id', patientId)
    .eq('professional_id', user.id)
    .eq('active', true)
    .not('published_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Compute plan targets from meals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meals = (activePlan?.meals ?? []) as any[]
  const planTargets = meals.reduce(
    (acc: { kcal: number; protein: number; carbs: number; fat: number }, m: { meal_foods: { quantity_g: number; food: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion_g: number } }[] }) => {
      m.meal_foods?.forEach(mf => {
        const ratio = mf.quantity_g / (mf.food?.portion_g || 100)
        acc.kcal += (mf.food?.kcal ?? 0) * ratio
        acc.protein += (mf.food?.protein_g ?? 0) * ratio
        acc.carbs += (mf.food?.carbs_g ?? 0) * ratio
        acc.fat += (mf.food?.fat_g ?? 0) * ratio
      })
      return acc
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )

  // Use kcal_goal from plan if set, otherwise computed
  const targetKcal = activePlan?.kcal_goal || planTargets.kcal || null

  // Aggregate diary by date
  const byDate: Record<string, { kcal: number; protein: number; carbs: number; fat: number; meals: number }> = {}
  for (const e of entries ?? []) {
    const d = e.logged_at
    if (!byDate[d]) byDate[d] = { kcal: 0, protein: 0, carbs: 0, fat: 0, meals: 0 }
    byDate[d].kcal += Number(e.total_kcal ?? 0)
    byDate[d].protein += Number(e.total_protein_g ?? 0)
    byDate[d].carbs += Number(e.total_carbs_g ?? 0)
    byDate[d].fat += Number(e.total_fat_g ?? 0)
    byDate[d].meals += 1
  }

  // Build daily array for the date range
  const dailyData: Array<{
    date: string
    logged: boolean
    kcal: number
    protein: number
    carbs: number
    fat: number
    meals: number
    kcalPct: number | null
  }> = []

  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const dateStr = d.toISOString().split('T')[0]
    const entry = byDate[dateStr]
    const kcalPct = entry && targetKcal ? Math.round((entry.kcal / targetKcal) * 100) : null
    dailyData.push({
      date: dateStr,
      logged: !!entry,
      kcal: entry?.kcal ?? 0,
      protein: entry?.protein ?? 0,
      carbs: entry?.carbs ?? 0,
      fat: entry?.fat ?? 0,
      meals: entry?.meals ?? 0,
      kcalPct,
    })
  }

  // Summary stats
  const loggedDays = dailyData.filter(d => d.logged).length
  const totalDays = dailyData.length
  const loggedEntries = dailyData.filter(d => d.logged)

  const avgKcal = loggedEntries.length > 0
    ? Math.round(loggedEntries.reduce((s, d) => s + d.kcal, 0) / loggedEntries.length)
    : null
  const avgProtein = loggedEntries.length > 0
    ? Math.round(loggedEntries.reduce((s, d) => s + d.protein, 0) / loggedEntries.length)
    : null
  const avgCarbs = loggedEntries.length > 0
    ? Math.round(loggedEntries.reduce((s, d) => s + d.carbs, 0) / loggedEntries.length)
    : null
  const avgFat = loggedEntries.length > 0
    ? Math.round(loggedEntries.reduce((s, d) => s + d.fat, 0) / loggedEntries.length)
    : null

  const complianceRate = Math.round((loggedDays / totalDays) * 100)

  // Days above/below target
  const inRangeDays = loggedEntries.filter(d => d.kcalPct != null && d.kcalPct >= 90 && d.kcalPct <= 110).length
  const aboveDays = loggedEntries.filter(d => d.kcalPct != null && d.kcalPct > 110).length
  const belowDays = loggedEntries.filter(d => d.kcalPct != null && d.kcalPct < 90).length

  return NextResponse.json({
    daily: dailyData,
    targets: {
      kcal: targetKcal ? Math.round(targetKcal) : null,
      protein: planTargets.protein ? Math.round(planTargets.protein) : null,
      carbs: planTargets.carbs ? Math.round(planTargets.carbs) : null,
      fat: planTargets.fat ? Math.round(planTargets.fat) : null,
    },
    summary: {
      loggedDays,
      totalDays,
      complianceRate,
      avgKcal,
      avgProtein,
      avgCarbs,
      avgFat,
      inRangeDays,
      aboveDays,
      belowDays,
    },
  })
}
