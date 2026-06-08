'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Substitute {
  id: string
  quantity_g: number
  quantity_description: string | null
  food: { name: string } | null
}

interface MealFood {
  id: string
  quantity_g: number
  quantity_description: string | null
  notes: string | null
  sort_order: number
  substitutes?: Substitute[]
  food: {
    name: string
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number | null
    portion_g: number
    portion_description: string | null
  } | null
}

interface Meal {
  id: string
  name: string
  time_start: string | null
  emoji: string | null
  sort_order: number
  notes: string | null
  is_substitute: boolean
  meal_foods: MealFood[]
  totals?: { kcal: number; protein: number; carbs: number; fat: number }
}

interface DietPlan {
  id: string
  title: string
  notes: string | null
  kcal_goal: number | null
  protein_goal_g: number | null
  carbs_goal_g: number | null
  fat_goal_g: number | null
  updated_at: string
}


function computeTotals(meal: Meal) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0
  for (const mf of meal.meal_foods) {
    if (!mf.food) continue
    const ratio = mf.quantity_g / 100
    kcal += mf.food.kcal * ratio
    protein += mf.food.protein_g * ratio
    carbs += mf.food.carbs_g * ratio
    fat += mf.food.fat_g * ratio
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  }
}

// swappedFoods: maps mealFoodId → substituteId (or null = original)
type SwapMap = Record<string, string | null>

export default function AlunoPlanoPage() {
  const [plan, setPlan] = useState<DietPlan | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noPlan, setNoPlan] = useState(false)
  const [swappedFoods, setSwappedFoods] = useState<SwapMap>({})
  const [includedMeals, setIncludedMeals] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadPlan()
  }, [])

  async function loadPlan() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setNoPlan(true); setLoading(false); return }

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (!patient) { setNoPlan(true); setLoading(false); return }

      const { data: planData } = await supabase
        .from('diet_plans')
        .select(`
          id, title, notes, kcal_goal, protein_goal_g, carbs_goal_g, fat_goal_g, updated_at,
          meals(
            id, name, time_start, emoji, sort_order, notes, is_substitute,
            meal_foods(
              id, quantity_g, quantity_description, notes, sort_order,
              food:foods(name, kcal, protein_g, carbs_g, fat_g, fiber_g, portion_g, portion_description),
              substitutes:meal_food_substitutes(id, quantity_g, quantity_description, food:foods(name))
            )
          )
        `)
        .eq('patient_id', patient.id)
        .eq('active', true)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .single()

      if (!planData) { setNoPlan(true); setLoading(false); return }

      setPlan({
        id: planData.id,
        title: planData.title,
        notes: planData.notes,
        kcal_goal: planData.kcal_goal,
        protein_goal_g: planData.protein_goal_g,
        carbs_goal_g: planData.carbs_goal_g,
        fat_goal_g: planData.fat_goal_g,
        updated_at: planData.updated_at,
      })

      const withTotals: Meal[] = ((planData.meals ?? []) as Meal[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(m => ({
          ...m,
          meal_foods: (m.meal_foods ?? []).sort((a, b) => a.sort_order - b.sort_order),
          totals: computeTotals({
            ...m,
            meal_foods: (m.meal_foods ?? []),
          }),
        }))
      setMeals(withTotals)

      // Load saved swaps from localStorage
      try {
        const saved = localStorage.getItem(`pgf-swaps-${planData.id}`)
        if (saved) setSwappedFoods(JSON.parse(saved))
      } catch (_) { /* ignore */ }

      // Load included meals (default = all non-substitute meals included)
      try {
        const savedIncluded = localStorage.getItem(`pgf-included-${planData.id}`)
        if (savedIncluded) {
          setIncludedMeals(new Set(JSON.parse(savedIncluded)))
        } else {
          setIncludedMeals(new Set(withTotals.filter(m => !m.is_substitute).map(m => m.id)))
        }
      } catch (_) {
        setIncludedMeals(new Set(withTotals.filter(m => !m.is_substitute).map(m => m.id)))
      }

      // Auto-expand first meal
      if (withTotals.length > 0) setExpandedId(withTotals[0].id)
    } catch (_) {
      setNoPlan(true)
    }
    setLoading(false)
  }

  function handleSwap(mfId: string, subId: string | null) {
    setSwappedFoods(prev => {
      const next = { ...prev, [mfId]: subId }
      try { if (plan) localStorage.setItem(`pgf-swaps-${plan.id}`, JSON.stringify(next)) } catch (_) { /* ignore */ }
      return next
    })
  }

  function toggleMealInclusion(mealId: string) {
    setIncludedMeals(prev => {
      const next = new Set(prev)
      if (next.has(mealId)) { next.delete(mealId) } else { next.add(mealId) }
      try { if (plan) localStorage.setItem(`pgf-included-${plan.id}`, JSON.stringify(Array.from(next))) } catch (_) { /* ignore */ }
      return next
    })
  }

  const grandTotals = meals
    .filter(m => includedMeals.has(m.id))
    .reduce(
      (acc, m) => ({
        kcal: acc.kcal + (m.totals?.kcal ?? 0),
        protein: acc.protein + (m.totals?.protein ?? 0),
        carbs: acc.carbs + (m.totals?.carbs ?? 0),
        fat: acc.fat + (m.totals?.fat ?? 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    )
  const excludedCount = meals.length - includedMeals.size

  const goalKcal = plan?.kcal_goal ?? grandTotals.kcal
  const goalProtein = plan?.protein_goal_g ?? grandTotals.protein
  const goalCarbs = plan?.carbs_goal_g ?? grandTotals.carbs
  const goalFat = plan?.fat_goal_g ?? grandTotals.fat

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
          <h1 className="text-base font-bold text-white">🥗 Meu Plano Alimentar</h1>
        </div>
        {plan && (
          <div className="flex gap-2">
            <Link
              href="/aluno/plano/imprimir"
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              🖨️ Imprimir
            </Link>
            <Link
              href="/aluno/diario"
              className="btn btn-sm"
              style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
            >
              📔 Registrar
            </Link>
          </div>
        )}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-4xl animate-pulse">🥗</div>
            <div className="text-white/40 text-sm">Carregando plano alimentar...</div>
          </div>
        ) : noPlan ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-6">
            <div className="text-5xl">📭</div>
            <div className="text-white font-bold text-lg">Nenhum plano ativo</div>
            <p className="text-white/40 text-sm leading-relaxed">
              Seu nutricionista ainda não publicou um plano alimentar para você.
              Entre em contato para receber sua prescrição!
            </p>
            <Link href="/aluno" className="btn btn-primary mt-2">← Voltar ao início</Link>
          </div>
        ) : (
          <>
            {/* Plan header card */}
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-white font-bold text-base">{plan!.title}</div>
                  {plan!.notes && (
                    <div className="text-white/50 text-xs mt-0.5 line-clamp-2">{plan!.notes}</div>
                  )}
                </div>
                <div className="text-xs text-white/30 text-right">
                  <div>Atualizado</div>
                  <div>{new Date(plan!.updated_at).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              {/* Daily targets */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Kcal/dia', value: Math.round(goalKcal), color: 'text-white' },
                  { label: 'Proteína', value: `${Math.round(goalProtein)}g`, color: 'text-blue-300' },
                  { label: 'Carboidrato', value: `${Math.round(goalCarbs)}g`, color: 'text-amber-300' },
                  { label: 'Gordura', value: `${Math.round(goalFat)}g`, color: 'text-red-300' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <div className={`text-base font-black ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wide">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Macro % bar */}
              {goalKcal > 0 && (() => {
                const pPct = Math.round((goalProtein * 4 / goalKcal) * 100)
                const cPct = Math.round((goalCarbs * 4 / goalKcal) * 100)
                const fPct = Math.round((goalFat * 9 / goalKcal) * 100)
                return (
                  <div className="mt-3">
                    <div className="flex rounded-full overflow-hidden h-2">
                      <div style={{ width: `${pPct}%`, background: '#3B82F6' }} />
                      <div style={{ width: `${cPct}%`, background: '#F59E0B' }} />
                      <div style={{ width: `${Math.min(fPct, 100-pPct-cPct)}%`, background: '#EF4444' }} />
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px]">
                      <span className="text-blue-400">● Prot {pPct}%</span>
                      <span className="text-amber-400">● Carb {cPct}%</span>
                      <span className="text-red-400">● Gord {fPct}%</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Meals count + collapse all */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">
                {meals.length} refeição{meals.length !== 1 ? 'ões' : ''}
              </div>
              <button
                onClick={() => setExpandedId(null)}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Recolher tudo
              </button>
            </div>

            {/* Meals list */}
            <div className="space-y-2">
              {meals.map(meal => {
                const isOpen = expandedId === meal.id
                const isIncluded = includedMeals.has(meal.id)
                const t = meal.totals!
                return (
                  <div
                    key={meal.id}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOpen ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.08)'}`, opacity: isIncluded ? 1 : 0.55 }}
                  >
                    {/* Meal header */}
                    <div className="flex items-center">
                      {/* Include/exclude toggle */}
                      <button
                        onClick={() => toggleMealInclusion(meal.id)}
                        className="pl-4 pr-2 py-3.5 flex-shrink-0 flex items-center"
                        title={isIncluded ? 'Tirar do cálculo diário' : 'Incluir no cálculo diário'}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center transition-all border-2 ${isIncluded ? 'bg-blue-600 border-blue-600' : 'border-white/25 bg-transparent'}`}>
                          {isIncluded && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
                            </svg>
                          )}
                        </div>
                      </button>

                      {/* Expand button */}
                      <button
                        className="flex-1 flex items-center justify-between pr-4 py-3.5"
                        onClick={() => setExpandedId(isOpen ? null : meal.id)}
                      >
                        <div className="text-left">
                          <div className={`font-semibold text-sm tracking-wide ${isIncluded ? 'text-white' : 'text-white/60'}`}>{meal.name}</div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {meal.time_start}
                            {meal.time_start && meal.meal_foods.length > 0 && ' · '}
                            {meal.meal_foods.length} item{meal.meal_foods.length !== 1 ? 'ns' : ''}
                            {!isIncluded && <span className="ml-1 text-white/30">· fora do total</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-black text-white">{t.kcal} kcal</div>
                            <div className="text-[10px] text-white/40">
                              P{Math.round(t.protein)}g C{Math.round(t.carbs)}g G{Math.round(t.fat)}g
                            </div>
                          </div>
                          <span className="text-white/30 text-xs">{isOpen ? '▾' : '▸'}</span>
                        </div>
                      </button>
                    </div>

                    {/* Expanded food list */}
                    {isOpen && (
                      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        {meal.meal_foods.length === 0 ? (
                          <div className="px-4 py-4 text-white/30 text-sm text-center">Nenhum alimento cadastrado</div>
                        ) : (
                          <div className="px-4 py-3 space-y-2">
                            {meal.meal_foods.map(mf => {
                              if (!mf.food) return null
                              const activeSubId = swappedFoods[mf.id] ?? null
                              const activeSub = activeSubId ? (mf.substitutes ?? []).find(s => s.id === activeSubId) ?? null : null
                              // Use either the swapped food or the original
                              const displayFood = activeSub?.food ?? mf.food
                              const displayQty = activeSub?.quantity_g ?? mf.quantity_g
                              const displayDesc = activeSub?.quantity_description ?? mf.quantity_description ?? `${mf.quantity_g}g`
                              const ratio = displayQty / (displayFood.portion_g || 100)
                              const kcal = Math.round(displayFood.kcal * ratio)
                              const hasSubs = (mf.substitutes ?? []).length > 0
                              return (
                                <div
                                  key={mf.id}
                                  className="rounded-xl overflow-hidden"
                                  style={{ background: activeSub ? 'rgba(37,99,235,0.07)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activeSub ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.0)'}` }}
                                >
                                  {/* Main food row */}
                                  <div className="flex items-start justify-between py-2.5 px-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-white/90 text-sm font-medium">{displayFood.name}</div>
                                      <div className="text-white/35 text-xs mt-0.5">{displayDesc}</div>
                                      {!activeSub && mf.notes && (
                                        <div className="text-white/25 text-xs italic mt-0.5">{mf.notes}</div>
                                      )}
                                      {activeSub && (
                                        <div className="text-[10px] mt-0.5 flex items-center gap-1.5">
                                          <span style={{ color: 'rgba(37,99,235,0.7)' }}>↕ trocado</span>
                                          <span className="text-white/25">original: {mf.food.name}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                      <div className="text-white/80 text-sm font-bold">{kcal} kcal</div>
                                      <div className="text-[10px] text-white/30">
                                        P{Math.round(displayFood.protein_g * ratio)}g
                                        {' '}C{Math.round(displayFood.carbs_g * ratio)}g
                                        {' '}G{Math.round(displayFood.fat_g * ratio)}g
                                      </div>
                                    </div>
                                  </div>

                                  {/* Substitutes selector */}
                                  {hasSubs && (
                                    <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
                                      {/* Restore original pill (shown when swapped) */}
                                      {activeSub && (
                                        <button
                                          onClick={() => handleSwap(mf.id, null)}
                                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
                                          style={{ background: 'rgba(37,99,235,0.12)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
                                        >
                                          ↩ original
                                        </button>
                                      )}
                                      {(mf.substitutes ?? []).map(s => {
                                        if (!s.food) return null
                                        const isActive = s.id === activeSubId
                                        return (
                                          <button
                                            key={s.id}
                                            onClick={() => handleSwap(mf.id, isActive ? null : s.id)}
                                            className="text-[10px] font-medium px-2.5 py-1 rounded-full transition-all"
                                            style={isActive
                                              ? { background: 'rgba(37,99,235,0.25)', color: '#BFDBFE', border: '1px solid rgba(37,99,235,0.5)' }
                                              : { background: 'rgba(245,158,11,0.08)', color: 'rgba(245,158,11,0.7)', border: '1px solid rgba(245,158,11,0.2)' }
                                            }
                                          >
                                            {isActive ? '✓ ' : 'OU '}{s.food.name}
                                            <span className="ml-1 opacity-60">{s.quantity_description ?? `${s.quantity_g}g`}</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {meal.notes && (
                          <div
                            className="mx-4 mb-3 px-3 py-2 rounded-xl text-xs italic"
                            style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)' }}
                          >
                            💬 {meal.notes}
                          </div>
                        )}

                        {/* Mini macro bar */}
                        {t.kcal > 0 && (() => {
                          const pPct = Math.round((t.protein * 4 / t.kcal) * 100)
                          const cPct = Math.round((t.carbs * 4 / t.kcal) * 100)
                          const fPct = Math.round((t.fat * 9 / t.kcal) * 100)
                          return (
                            <div className="px-4 pb-3">
                              <div className="flex rounded-full overflow-hidden h-1.5">
                                <div style={{ width: `${pPct}%`, background: '#3B82F6' }} />
                                <div style={{ width: `${cPct}%`, background: '#F59E0B' }} />
                                <div style={{ width: `${Math.min(fPct, 100-pPct-cPct)}%`, background: '#EF4444' }} />
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Daily totals summary */}
            <div
              className="mt-4 rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-white/40 font-semibold uppercase tracking-wide">Total diário do plano</div>
                {excludedCount > 0 && (
                  <div className="text-[10px] text-amber-400/70">{excludedCount} refeição{excludedCount > 1 ? 'ões' : ''} fora do cálculo</div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Kcal', value: Math.round(grandTotals.kcal), color: 'text-white' },
                  { label: 'Proteína', value: `${Math.round(grandTotals.protein)}g`, color: 'text-blue-400' },
                  { label: 'Carboidrato', value: `${Math.round(grandTotals.carbs)}g`, color: 'text-amber-400' },
                  { label: 'Gordura', value: `${Math.round(grandTotals.fat)}g`, color: 'text-red-400' },
                ].map(m => (
                  <div key={m.label}>
                    <div className={`text-lg font-black ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-white/30 font-semibold">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-4 pb-8 flex gap-3">
              <Link
                href="/aluno/diario"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all"
                style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)' }}
              >
                📔 Registrar no Diário
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
