'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface MealFood {
  id: string
  quantity_g: number
  foods: {
    name: string
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    portion_g: number | null
    portion_description: string | null
  } | null
}

interface Meal {
  id: string
  meal_name: string
  meal_time: string | null
  order: number | null
  notes: string | null
  meal_foods: MealFood[]
  // computed
  totals?: { kcal: number; protein: number; carbs: number; fat: number }
}

interface DietPlan {
  id: string
  name: string
  description: string | null
  goal_kcal: number | null
  goal_protein_g: number | null
  goal_carbs_g: number | null
  goal_fat_g: number | null
  updated_at: string
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
  'Snack': '🥜',
}

function computeTotals(meal: Meal) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0
  for (const mf of meal.meal_foods) {
    if (!mf.foods) continue
    const ratio = mf.quantity_g / (mf.foods.portion_g || 100)
    kcal += mf.foods.kcal * ratio
    protein += mf.foods.protein_g * ratio
    carbs += mf.foods.carbs_g * ratio
    fat += mf.foods.fat_g * ratio
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  }
}

export default function AlunoPlanoPage() {
  const [plan, setPlan] = useState<DietPlan | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noPlan, setNoPlan] = useState(false)

  useEffect(() => {
    loadPlan()
  }, [])

  async function loadPlan() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (!patient) { setNoPlan(true); setLoading(false); return }

      const { data: planData } = await supabase
        .from('diet_plans')
        .select('id, name, description, goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g, updated_at')
        .eq('patient_id', patient.id)
        .eq('active', true)
        .eq('published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (!planData) { setNoPlan(true); setLoading(false); return }
      setPlan(planData)

      const { data: mealsData } = await supabase
        .from('diet_plan_meals')
        .select(`
          id, meal_name, meal_time, order, notes,
          meal_foods(
            id, quantity_g,
            foods(name, kcal, protein_g, carbs_g, fat_g, portion_g, portion_description)
          )
        `)
        .eq('plan_id', planData.id)
        .order('order', { ascending: true })

      const withTotals: Meal[] = (mealsData ?? []).map((m: Meal) => ({
        ...m,
        totals: computeTotals(m),
      }))
      setMeals(withTotals)

      // Auto-expand first meal
      if (withTotals.length > 0) setExpandedId(withTotals[0].id)
    } catch {
      setNoPlan(true)
    }
    setLoading(false)
  }

  // Grand totals from meals (if no goal set in plan)
  const grandTotals = meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.totals?.kcal ?? 0),
      protein: acc.protein + (m.totals?.protein ?? 0),
      carbs: acc.carbs + (m.totals?.carbs ?? 0),
      fat: acc.fat + (m.totals?.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const goalKcal = plan?.goal_kcal ?? grandTotals.kcal
  const goalProtein = plan?.goal_protein_g ?? grandTotals.protein
  const goalCarbs = plan?.goal_carbs_g ?? grandTotals.carbs
  const goalFat = plan?.goal_fat_g ?? grandTotals.fat

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
          <Link
            href="/aluno/diario"
            className="btn btn-sm"
            style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
          >
            📔 Registrar
          </Link>
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
                  <div className="text-white font-bold text-base">{plan!.name}</div>
                  {plan!.description && (
                    <div className="text-white/50 text-xs mt-0.5">{plan!.description}</div>
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
                  { label: 'Kcal', value: Math.round(goalKcal), color: 'text-white' },
                  { label: 'Prot', value: `${Math.round(goalProtein)}g`, color: 'text-blue-300' },
                  { label: 'Carb', value: `${Math.round(goalCarbs)}g`, color: 'text-amber-300' },
                  { label: 'Gord', value: `${Math.round(goalFat)}g`, color: 'text-red-300' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <div className={`text-base font-black ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wide">{m.label}/dia</div>
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
                      <div style={{ width: `${fPct}%`, background: '#EF4444' }} />
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px]">
                      <span className="text-blue-400">● Proteína {pPct}%</span>
                      <span className="text-amber-400">● Carboidrato {cPct}%</span>
                      <span className="text-red-400">● Gordura {fPct}%</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Meals count badge */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">
                {meals.length} refeição{meals.length !== 1 ? 'ões' : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setExpandedId(null)}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  Recolher tudo
                </button>
              </div>
            </div>

            {/* Meals list */}
            <div className="space-y-2">
              {meals.map((meal, idx) => {
                const isOpen = expandedId === meal.id
                const t = meal.totals!
                return (
                  <div
                    key={meal.id}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOpen ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.08)'}` }}
                  >
                    {/* Meal header */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3.5"
                      onClick={() => setExpandedId(isOpen ? null : meal.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: isOpen ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.06)' }}
                        >
                          {MEAL_EMOJIS[meal.meal_name] ?? '🍽️'}
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-white text-sm">{meal.meal_name}</div>
                          <div className="text-[11px] text-white/40">
                            {meal.meal_time?.slice(0, 5)}
                            {meal.meal_time && meal.meal_foods.length > 0 && ' · '}
                            {meal.meal_foods.length} item{meal.meal_foods.length !== 1 ? 'ns' : ''}
                          </div>
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

                    {/* Expanded food list */}
                    {isOpen && (
                      <div
                        className="border-t"
                        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                      >
                        {meal.meal_foods.length === 0 ? (
                          <div className="px-4 py-4 text-white/30 text-sm text-center">Nenhum alimento cadastrado</div>
                        ) : (
                          <div className="px-4 py-3 space-y-2">
                            {meal.meal_foods.map((mf, i) => {
                              if (!mf.foods) return null
                              const ratio = mf.quantity_g / (mf.foods.portion_g || 100)
                              const kcal = Math.round(mf.foods.kcal * ratio)
                              const desc = mf.foods.portion_description
                                ? `${Math.round(ratio * 10) / 10} ${mf.foods.portion_description} (${mf.quantity_g}g)`
                                : `${mf.quantity_g}g`
                              return (
                                <div
                                  key={mf.id}
                                  className="flex items-center justify-between py-2 px-3 rounded-xl"
                                  style={{ background: 'rgba(255,255,255,0.04)' }}
                                >
                                  <div>
                                    <div className="text-white/90 text-sm font-medium">{mf.foods.name}</div>
                                    <div className="text-white/35 text-xs mt-0.5">{desc}</div>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-3">
                                    <div className="text-white/80 text-sm font-bold">{kcal} kcal</div>
                                    <div className="text-[10px] text-white/30">
                                      P{Math.round(mf.foods.protein_g * ratio)}g
                                      {' '}C{Math.round(mf.foods.carbs_g * ratio)}g
                                      {' '}G{Math.round(mf.foods.fat_g * ratio)}g
                                    </div>
                                  </div>
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

            {/* Daily totals summary at bottom */}
            <div
              className="mt-4 rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-xs text-white/40 font-semibold uppercase tracking-wide mb-3">
                Total diário do plano
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
                📔 Ir para o Diário
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
