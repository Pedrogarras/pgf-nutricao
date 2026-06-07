'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DiaryFood {
  food_name: string
  quantity_g: number
  quantity_description: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

interface DiaryEntry {
  id: string
  logged_at: string
  meal_name: string
  meal_time: string | null
  foods: DiaryFood[]
  total_kcal: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  notes: string | null
  adherence_score: number | null
}

interface FoodSearchResult {
  id: string
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  portion_g: number | null
  portion_description: string | null
}

interface PlanMealFood {
  quantity_g: number
  food: {
    name: string
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    portion_g: number | null
  } | null
}

interface PlanMeal {
  id: string
  name: string
  time_start: string | null
  emoji: string | null
  sort_order: number | null
  meal_foods: PlanMealFood[]
}

const MEAL_EMOJIS: Record<string, string> = {
  'Café da manhã': '☀️',
  'Lanche da manhã': '🍎',
  'Almoço': '🍽️',
  'Lanche da tarde': '⚡',
  'Jantar': '🌙',
  'Ceia': '🌛',
  'Pré-treino': '🏋️',
  'Pós-treino': '💪',
}

export default function AlunoDiarioPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // Plan targets for comparison
  const [planTargets, setPlanTargets] = useState<{ kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }>({ kcal: null, protein: null, carbs: null, fat: null })

  // Plan log modal
  const [planLogOpen, setPlanLogOpen] = useState(false)
  const [planMeals, setPlanMeals] = useState<PlanMeal[]>([])
  const [planLoading, setPlanLoading] = useState(false)
  const [selectedPlanMealIds, setSelectedPlanMealIds] = useState<Set<string>>(new Set())
  const [planLogging, setPlanLogging] = useState(false)

  // Add meal form
  const [mealName, setMealName] = useState('Café da manhã')
  const [mealTime, setMealTime] = useState('')
  const [mealNotes, setMealNotes] = useState('')
  const [adherenceScore, setAdherenceScore] = useState<number>(3)
  const [foods, setFoods] = useState<DiaryFood[]>([])
  const [saving, setSaving] = useState(false)

  // Food search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
  const [foodQty, setFoodQty] = useState('100')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchEntries(selectedDate) }, [selectedDate])

  // Load plan targets once on mount
  useEffect(() => {
    async function loadTargets() {
      try {
        const supabase = (await import('@/lib/supabase/client')).createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: patient } = await supabase.from('patients').select('id').eq('auth_user_id', user.id).single()
        if (!patient) return
        const { data: plan } = await supabase
          .from('diet_plans')
          .select('kcal_goal, meals(meal_foods(quantity_g, food:foods(kcal, protein_g, carbs_g, fat_g, portion_g)))')
          .eq('patient_id', patient.id)
          .eq('active', true)
          .not('published_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!plan) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meals = (plan.meals ?? []) as any[]
        const t = meals.reduce((acc: { kcal: number; protein: number; carbs: number; fat: number }, m: { meal_foods: { quantity_g: number; food: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion_g: number } }[] }) => {
          m.meal_foods?.forEach(mf => {
            const r = mf.quantity_g / (mf.food?.portion_g || 100)
            acc.kcal += (mf.food?.kcal ?? 0) * r
            acc.protein += (mf.food?.protein_g ?? 0) * r
            acc.carbs += (mf.food?.carbs_g ?? 0) * r
            acc.fat += (mf.food?.fat_g ?? 0) * r
          })
          return acc
        }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
        setPlanTargets({
          kcal: plan.kcal_goal || (t.kcal > 0 ? Math.round(t.kcal) : null),
          protein: t.protein > 0 ? Math.round(t.protein) : null,
          carbs: t.carbs > 0 ? Math.round(t.carbs) : null,
          fat: t.fat > 0 ? Math.round(t.fat) : null,
        })
      } catch { /* ignore */ }
    }
    loadTargets()
  }, [])

  async function fetchEntries(date: string) {
    setLoading(true)
    const res = await fetch(`/api/diary?date=${date}`)
    const json = await res.json()
    setEntries(json.entries ?? [])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Food search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/foods?q=${encodeURIComponent(searchQuery)}&limit=8`)
      const json = await res.json()
      setSearchResults(json.foods ?? [])
      setSearching(false)
    }, 350)
  }, [searchQuery])

  function addFood() {
    if (!selectedFood) return
    const qty = Number(foodQty) || 100
    const base = selectedFood.portion_g || 100
    const ratio = qty / base
    const desc = selectedFood.portion_description
      ? `${Math.round(ratio * 10) / 10} ${selectedFood.portion_description} (${qty}g)`
      : `${qty}g`

    const food: DiaryFood = {
      food_name: selectedFood.name,
      quantity_g: qty,
      quantity_description: desc,
      kcal: Math.round(selectedFood.kcal * ratio * 10) / 10,
      protein: Math.round(selectedFood.protein_g * ratio * 10) / 10,
      carbs: Math.round(selectedFood.carbs_g * ratio * 10) / 10,
      fat: Math.round(selectedFood.fat_g * ratio * 10) / 10,
    }
    setFoods(prev => [...prev, food])
    setSelectedFood(null)
    setSearchQuery('')
    setFoodQty('100')
    setSearchResults([])
  }

  function removeFood(idx: number) {
    setFoods(prev => prev.filter((_, i) => i !== idx))
  }

  const mealTotals = {
    kcal: foods.reduce((s, f) => s + f.kcal, 0),
    protein: foods.reduce((s, f) => s + f.protein, 0),
    carbs: foods.reduce((s, f) => s + f.carbs, 0),
    fat: foods.reduce((s, f) => s + f.fat, 0),
  }

  async function handleSave() {
    if (!mealName.trim()) return
    setSaving(true)
    const res = await fetch('/api/diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logged_at: selectedDate,
        meal_name: mealName,
        meal_time: mealTime || null,
        foods,
        total_kcal: Math.round(mealTotals.kcal * 10) / 10,
        total_protein_g: Math.round(mealTotals.protein * 10) / 10,
        total_carbs_g: Math.round(mealTotals.carbs * 10) / 10,
        total_fat_g: Math.round(mealTotals.fat * 10) / 10,
        notes: mealNotes || null,
        adherence_score: adherenceScore,
        source: 'patient',
      }),
    })
    setSaving(false)
    if (res.ok) {
      const json = await res.json()
      setEntries(prev => [...prev, json.entry])
      setAddOpen(false)
      setMealName('Café da manhã')
      setMealTime('')
      setMealNotes('')
      setAdherenceScore(3)
      setFoods([])
      showToast('Refeição registrada! 📔')
    } else {
      showToast('Erro ao salvar.')
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/diary/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
    showToast('Registro removido.')
  }

  async function openPlanLog() {
    setPlanLogOpen(true)
    setPlanLoading(true)
    setSelectedPlanMealIds(new Set())
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPlanLoading(false); return }

      // Get patient record
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (!patient) { setPlanLoading(false); return }

      // Get active published plan with meals and foods
      const { data: planData } = await supabase
        .from('diet_plans')
        .select(`
          id,
          meals(
            id, name, time_start, emoji, sort_order,
            meal_foods(
              quantity_g,
              food:foods(name, kcal, protein_g, carbs_g, fat_g, portion_g)
            )
          )
        `)
        .eq('patient_id', patient.id)
        .eq('active', true)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .single()
      if (!planData) { setPlanLoading(false); return }

      const meals: PlanMeal[] = ((planData.meals ?? []) as PlanMeal[])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      setPlanMeals(meals)
      // Pre-select all meals
      if (meals.length > 0) {
        setSelectedPlanMealIds(new Set(meals.map(m => m.id)))
      }
    } catch {
      // ignore errors gracefully
    }
    setPlanLoading(false)
  }

  function togglePlanMeal(id: string) {
    setSelectedPlanMealIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function computeMealTotals(meal: PlanMeal) {
    let kcal = 0, protein = 0, carbs = 0, fat = 0
    for (const mf of meal.meal_foods) {
      if (!mf.food) continue
      const ratio = mf.quantity_g / (mf.food.portion_g || 100)
      kcal += mf.food.kcal * ratio
      protein += mf.food.protein_g * ratio
      carbs += mf.food.carbs_g * ratio
      fat += mf.food.fat_g * ratio
    }
    return {
      kcal: Math.round(kcal * 10) / 10,
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
    }
  }

  async function handleLogFromPlan() {
    if (selectedPlanMealIds.size === 0) return
    setPlanLogging(true)
    const mealsToLog = planMeals.filter(m => selectedPlanMealIds.has(m.id))

    let logged = 0
    for (const meal of mealsToLog) {
      const totals = computeMealTotals(meal)
      const foods: DiaryFood[] = meal.meal_foods
        .filter(mf => mf.food)
        .map(mf => {
          const f = mf.food!
          const ratio = mf.quantity_g / (f.portion_g || 100)
          return {
            food_name: f.name,
            quantity_g: mf.quantity_g,
            quantity_description: `${mf.quantity_g}g`,
            kcal: Math.round(f.kcal * ratio * 10) / 10,
            protein: Math.round(f.protein_g * ratio * 10) / 10,
            carbs: Math.round(f.carbs_g * ratio * 10) / 10,
            fat: Math.round(f.fat_g * ratio * 10) / 10,
          }
        })

      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logged_at: selectedDate,
          meal_name: meal.name,
          meal_time: meal.time_start || null,
          foods,
          total_kcal: totals.kcal,
          total_protein_g: totals.protein,
          total_carbs_g: totals.carbs,
          total_fat_g: totals.fat,
          notes: null,
          adherence_score: 5,
          source: 'plan',
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setEntries(prev => [...prev, json.entry])
        logged++
      }
    }

    setPlanLogging(false)
    setPlanLogOpen(false)
    showToast(`${logged} refeição${logged !== 1 ? 'ões' : ''} do plano registrada${logged !== 1 ? 's' : ''}! 📋`)
  }

  const dayTotals = {
    kcal: entries.reduce((s, e) => s + (e.total_kcal ?? 0), 0),
    protein: entries.reduce((s, e) => s + (e.total_protein_g ?? 0), 0),
    carbs: entries.reduce((s, e) => s + (e.total_carbs_g ?? 0), 0),
    fat: entries.reduce((s, e) => s + (e.total_fat_g ?? 0), 0),
  }

  // Navigation dates (last 7 days)
  const dates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-6 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/aluno" className="text-pgf-400 hover:text-pgf-300 text-sm">← Início</Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">📔 Meu Diário</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openPlanLog}
            className="btn btn-sm"
            style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
          >
            📋 Do plano
          </button>
          <button
            onClick={() => { setAddOpen(true) }}
            className="btn btn-primary btn-sm"
          >
            + Manual
          </button>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {/* Date picker */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {dates.map(d => {
            const isToday = d === new Date().toISOString().split('T')[0]
            const isSelected = d === selectedDate
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-center transition-all ${isSelected ? 'bg-pgf-600 text-white' : 'text-white/50 hover:text-white/80'}`}
                style={!isSelected ? { background: 'rgba(255,255,255,0.05)' } : undefined}
              >
                <div className="text-[10px] font-bold uppercase">
                  {isToday ? 'Hoje' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div className="text-base font-black mt-0.5">
                  {new Date(d + 'T12:00').getDate()}
                </div>
              </button>
            )
          })}
        </div>

        {/* Day totals */}
        {entries.length > 0 && (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-white/40 font-semibold uppercase tracking-wide">Total do dia</div>
              {planTargets.kcal && (
                <div className="text-[10px] text-white/25">meta: {planTargets.kcal} kcal</div>
              )}
            </div>
            {/* Kcal progress bar */}
            {planTargets.kcal ? (
              <>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-2xl font-black text-white leading-none">{Math.round(dayTotals.kcal)}</span>
                  <span className="text-sm text-white/30">/ {planTargets.kcal} kcal</span>
                  <span className="ml-auto text-xs font-bold" style={{
                    color: (() => {
                      const pct = (dayTotals.kcal / planTargets.kcal) * 100
                      return pct >= 90 && pct <= 110 ? '#4ade80' : pct > 110 ? '#f87171' : '#fcd34d'
                    })()
                  }}>
                    {Math.round((dayTotals.kcal / planTargets.kcal) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, (dayTotals.kcal / planTargets.kcal) * 100)}%`,
                    background: (() => {
                      const pct = (dayTotals.kcal / planTargets.kcal) * 100
                      return pct >= 90 && pct <= 110 ? '#4ade80' : pct > 110 ? '#f87171' : '#fcd34d'
                    })()
                  }} />
                </div>
              </>
            ) : (
              <div className="text-2xl font-black text-white mb-3">{Math.round(dayTotals.kcal)} kcal</div>
            )}
            {/* Macro row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Proteína', actual: dayTotals.protein, target: planTargets.protein, color: '#818cf8' },
                { label: 'Carboidrato', actual: dayTotals.carbs, target: planTargets.carbs, color: '#fcd34d' },
                { label: 'Gordura', actual: dayTotals.fat, target: planTargets.fat, color: '#f97316' },
              ].map(m => {
                const pct = m.actual > 0 && m.target ? Math.min(120, Math.round((m.actual / m.target) * 100)) : null
                return (
                  <div key={m.label} className="rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[10px] text-white/30 uppercase font-semibold">{m.label}</span>
                      {pct != null && <span className="text-[10px] font-bold" style={{ color: m.color }}>{pct}%</span>}
                    </div>
                    <div className="text-sm font-black" style={{ color: m.color }}>
                      {Math.round(m.actual)}g
                      {m.target && <span className="text-[10px] font-normal text-white/20 ml-0.5">/{m.target}g</span>}
                    </div>
                    {m.target && (
                      <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (m.actual / m.target) * 100)}%`, background: m.color + 'CC' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Entries */}
        {loading ? (
          <div className="text-center py-12 text-white/30 text-sm">Carregando...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📔</div>
            <p className="text-white/40 text-sm">Nenhuma refeição registrada hoje.</p>
            <button onClick={() => setAddOpen(true)} className="btn btn-primary mt-4">
              Registrar primeira refeição
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{MEAL_EMOJIS[entry.meal_name] ?? '🍽️'}</span>
                    <div>
                      <div className="font-semibold text-white text-sm">{entry.meal_name}</div>
                      <div className="text-xs text-white/40">
                        {entry.meal_time?.slice(0,5)} · {entry.foods.length} alimento{entry.foods.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-black text-white">{Math.round(entry.total_kcal ?? 0)} kcal</div>
                      <div className="text-[10px] text-white/40">
                        P{Math.round(entry.total_protein_g ?? 0)} C{Math.round(entry.total_carbs_g ?? 0)} G{Math.round(entry.total_fat_g ?? 0)}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(entry.id) }}
                      className="text-white/20 hover:text-red-400 transition-colors text-sm"
                    >✕</button>
                    <span className="text-white/30">{expandedId === entry.id ? '▾' : '▸'}</span>
                  </div>
                </div>
                {expandedId === entry.id && entry.foods.length > 0 && (
                  <div className="px-4 pb-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {entry.foods.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-white/70">{f.food_name}</span>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>{f.quantity_description}</span>
                          <span className="text-white/60 font-semibold">{Math.round(f.kcal)} kcal</span>
                        </div>
                      </div>
                    ))}
                    {entry.notes && <p className="text-xs text-white/30 italic mt-2">{entry.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add meal modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setAddOpen(false)}>
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg">Registrar Refeição</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Meal name */}
              <div>
                <label className="form-label">Refeição</label>
                <select value={mealName} onChange={e => setMealName(e.target.value)} className="form-select">
                  {Object.keys(MEAL_EMOJIS).map(n => <option key={n}>{n}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Horário</label>
                  <input type="time" value={mealTime} onChange={e => setMealTime(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Adesão ao plano</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAdherenceScore(n)}
                        className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${adherenceScore === n ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Food search */}
              <div>
                <label className="form-label">Buscar alimento</label>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input"
                  placeholder="Nome do alimento..."
                />
                {searching && <div className="text-xs text-gray-400 mt-1">Buscando...</div>}
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg">
                    {searchResults.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSelectedFood(f); setFoodQty(String(f.portion_g ?? 100)); setSearchResults([]) }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${selectedFood?.id === f.id ? 'bg-pgf-50' : ''}`}
                      >
                        <div className="text-sm font-medium text-gray-900">{f.name}</div>
                        <div className="text-xs text-gray-400">{Math.round(f.kcal)} kcal/100g · P{Math.round(f.protein_g)}g C{Math.round(f.carbs_g)}g G{Math.round(f.fat_g)}g</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected food quantity */}
              {selectedFood && (
                <div className="bg-pgf-50 rounded-xl p-4 border border-pgf-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-sm text-pgf-800">{selectedFood.name}</div>
                    <button onClick={() => setSelectedFood(null)} className="text-gray-400 text-xs">✕</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="form-label">Quantidade (g)</label>
                      <input type="number" value={foodQty} onChange={e => setFoodQty(e.target.value)} className="form-input" min="1" />
                    </div>
                    <div className="pt-5">
                      <button type="button" onClick={addFood} className="btn btn-primary">+ Adicionar</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Added foods */}
              {foods.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Alimentos adicionados</div>
                  <div className="space-y-1.5">
                    {foods.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{f.food_name}</div>
                          <div className="text-xs text-gray-400">{f.quantity_description} · {Math.round(f.kcal)} kcal</div>
                        </div>
                        <button onClick={() => removeFood(i)} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Mini totals */}
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center bg-gray-900 rounded-xl p-3">
                    {[
                      { label: 'Kcal', value: Math.round(mealTotals.kcal) },
                      { label: 'Prot', value: `${Math.round(mealTotals.protein)}g` },
                      { label: 'Carb', value: `${Math.round(mealTotals.carbs)}g` },
                      { label: 'Gord', value: `${Math.round(mealTotals.fat)}g` },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="text-sm font-black text-white">{m.value}</div>
                        <div className="text-[10px] text-white/40 uppercase">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Observações</label>
                <textarea value={mealNotes} onChange={e => setMealNotes(e.target.value)} className="form-input" rows={2} placeholder="Comi fora de casa, não tinha o alimento..." />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (!mealName.trim())}
                className="btn btn-primary w-full"
              >
                {saving ? 'Salvando...' : '✓ Salvar refeição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Log Modal */}
      {planLogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setPlanLogOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">📋 Registrar do Plano</h3>
                <p className="text-xs text-gray-400 mt-0.5">Selecione as refeições que você fez hoje</p>
              </div>
              <button onClick={() => setPlanLogOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto">
              {planLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <div className="text-3xl animate-pulse">📋</div>
                  <div className="text-sm">Carregando plano alimentar...</div>
                </div>
              ) : planMeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <div className="text-3xl">📭</div>
                  <div className="text-sm font-medium">Nenhum plano ativo encontrado</div>
                  <div className="text-xs text-center px-8">Seu nutricionista precisa prescrever e publicar um plano alimentar para você.</div>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {/* Select all / none */}
                  <div className="flex items-center justify-between px-1 mb-3">
                    <span className="text-xs text-gray-500 font-semibold">
                      {selectedPlanMealIds.size} de {planMeals.length} selecionada{planMeals.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-3 text-xs">
                      <button
                        onClick={() => setSelectedPlanMealIds(new Set(planMeals.map(m => m.id)))}
                        className="text-blue-600 font-semibold hover:underline"
                      >Todas</button>
                      <button
                        onClick={() => setSelectedPlanMealIds(new Set())}
                        className="text-gray-400 hover:underline"
                      >Nenhuma</button>
                    </div>
                  </div>

                  {planMeals.map(meal => {
                    const totals = computeMealTotals(meal)
                    const selected = selectedPlanMealIds.has(meal.id)
                    const emoji = meal.emoji ?? MEAL_EMOJIS[meal.name] ?? '🍽️'
                    return (
                      <button
                        key={meal.id}
                        onClick={() => togglePlanMeal(meal.id)}
                        className="w-full text-left rounded-xl p-3.5 transition-all"
                        style={{
                          background: selected ? 'rgba(37,99,235,0.07)' : '#f8fafc',
                          border: selected ? '1.5px solid rgba(37,99,235,0.35)' : '1.5px solid #e2e8f0',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <div
                            className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-all"
                            style={{
                              background: selected ? '#2563EB' : 'white',
                              border: selected ? '2px solid #2563EB' : '2px solid #d1d5db',
                            }}
                          >
                            {selected && <span className="text-white text-xs font-black">✓</span>}
                          </div>

                          {/* Meal info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{emoji}</span>
                              <span className="font-bold text-sm text-gray-900">{meal.name}</span>
                              {meal.time_start && (
                                <span className="text-xs text-gray-400">{meal.time_start.slice(0, 5)}</span>
                              )}
                            </div>

                            {/* Foods list */}
                            {meal.meal_foods.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {meal.meal_foods.filter(mf => mf.food).slice(0, 4).map((mf, i) => (
                                  <div key={i} className="text-xs text-gray-500">
                                    {mf.food!.name} · {mf.quantity_g}g
                                  </div>
                                ))}
                                {meal.meal_foods.length > 4 && (
                                  <div className="text-xs text-gray-400">+{meal.meal_foods.length - 4} mais...</div>
                                )}
                              </div>
                            )}

                            {/* Macros */}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs font-black text-gray-700">{Math.round(totals.kcal)} kcal</span>
                              <span className="text-[10px] text-blue-500">P{Math.round(totals.protein)}g</span>
                              <span className="text-[10px] text-amber-500">C{Math.round(totals.carbs)}g</span>
                              <span className="text-[10px] text-red-400">G{Math.round(totals.fat)}g</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal footer */}
            {!planLoading && planMeals.length > 0 && (
              <div className="sticky bottom-0 bg-white px-4 py-4 border-t border-gray-100">
                {/* Total preview */}
                {selectedPlanMealIds.size > 0 && (() => {
                  const selectedMeals = planMeals.filter(m => selectedPlanMealIds.has(m.id))
                  const grand = selectedMeals.reduce((acc, m) => {
                    const t = computeMealTotals(m)
                    return { kcal: acc.kcal + t.kcal, protein: acc.protein + t.protein, carbs: acc.carbs + t.carbs, fat: acc.fat + t.fat }
                  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
                  return (
                    <div className="grid grid-cols-4 gap-2 text-center rounded-xl py-2 px-3 mb-3" style={{ background: '#f0f7ff' }}>
                      {[
                        { label: 'Kcal', value: Math.round(grand.kcal), color: 'text-blue-800' },
                        { label: 'Prot', value: `${Math.round(grand.protein)}g`, color: 'text-blue-600' },
                        { label: 'Carb', value: `${Math.round(grand.carbs)}g`, color: 'text-amber-600' },
                        { label: 'Gord', value: `${Math.round(grand.fat)}g`, color: 'text-red-500' },
                      ].map(m => (
                        <div key={m.label}>
                          <div className={`text-sm font-black ${m.color}`}>{m.value}</div>
                          <div className="text-[10px] text-gray-400 uppercase">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <button
                  onClick={handleLogFromPlan}
                  disabled={planLogging || selectedPlanMealIds.size === 0}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all"
                  style={{
                    background: selectedPlanMealIds.size > 0 ? '#2563EB' : '#e5e7eb',
                    color: selectedPlanMealIds.size > 0 ? 'white' : '#9ca3af',
                  }}
                >
                  {planLogging
                    ? 'Registrando...'
                    : selectedPlanMealIds.size === 0
                      ? 'Selecione ao menos 1 refeição'
                      : `✓ Registrar ${selectedPlanMealIds.size} refeição${selectedPlanMealIds.size !== 1 ? 'ões' : ''}`
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
