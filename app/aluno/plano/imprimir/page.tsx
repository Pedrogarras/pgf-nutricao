'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ─── types ───────────────────────────────────────────────────────────────── */
interface MealFood {
  quantity_g: number
  quantity_description: string | null
  notes: string | null
  sort_order: number
  food: {
    name: string
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number | null
    portion_g: number
  } | null
  substitutes?: {
    sort_order: number
    food: {
      name: string
      kcal: number
      protein_g: number
      carbs_g: number
      fat_g: number
      portion_g: number
    } | null
    quantity_g: number
    quantity_description: string | null
  }[]
}

interface Meal {
  id: string
  name: string
  time_start: string | null
  emoji: string | null
  sort_order: number
  notes: string | null
  meal_foods: MealFood[]
}

interface Plan {
  id: string
  title: string
  notes: string | null
  updated_at: string
  meals: Meal[]
}

interface PatientInfo {
  full_name: string
  goal: string | null
  professional_id: string
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function r1(n: number) { return Math.round(n * 10) / 10 }

function calcMacros(meal: Meal) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fiber = 0
  for (const mf of meal.meal_foods) {
    if (!mf.food) continue
    const ratio = mf.quantity_g / (mf.food.portion_g || 100)
    kcal    += mf.food.kcal    * ratio
    protein += mf.food.protein_g * ratio
    carbs   += mf.food.carbs_g   * ratio
    fat     += mf.food.fat_g     * ratio
    fiber   += (mf.food.fiber_g ?? 0) * ratio
  }
  return { kcal: r1(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat), fiber: r1(fiber) }
}

const MEAL_EMOJIS: Record<string, string> = {
  'Café da manhã': '☀️', 'Lanche da manhã': '🍎', 'Almoço': '🍽️',
  'Lanche da tarde': '⚡', 'Jantar': '🌙', 'Ceia': '🌛',
  'Pré-treino': '🏋️', 'Pós-treino': '💪', 'Snack': '🥜',
}

/* ─── Print styles injected in head ──────────────────────────────────────── */
const PRINT_STYLE = `
@media print {
  body { background: white !important; color: black !important; }
  .no-print { display: none !important; }
  .print-page { background: white !important; color: black !important; }
  .meal-card { break-inside: avoid; page-break-inside: avoid; }
  @page { margin: 1.5cm; size: A4; }
}
`

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function AlunoPlanoImprimirPage() {
  const supabase = createClient()
  const [plan, setPlan]       = useState<Plan | null>(null)
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [noplan, setNoplan]   = useState(false)
  const [showSubs, setShowSubs] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: p } = await supabase
      .from('patients')
      .select('full_name, goal, professional_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!p) { setLoading(false); setNoplan(true); return }
    setPatient(p)

    const { data: planData } = await supabase
      .from('diet_plans')
      .select(`
        id, title, notes, updated_at,
        meals(
          id, name, time_start, emoji, sort_order, notes,
          meal_foods(
            quantity_g, quantity_description, notes, sort_order,
            food:foods(name, kcal, protein_g, carbs_g, fat_g, fiber_g, portion_g),
            substitutes:meal_food_substitutes(
              sort_order, quantity_g, quantity_description,
              food:foods(name, kcal, protein_g, carbs_g, fat_g, portion_g)
            )
          )
        )
      `)
      .eq('patient_id', p.professional_id ? p.professional_id : '')
      // Use patient_id filter properly
      .limit(1)
      .maybeSingle()

    // Re-fetch with correct patient id
    const { data: patientRow } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!patientRow) { setLoading(false); setNoplan(true); return }

    const { data: plan2 } = await supabase
      .from('diet_plans')
      .select(`
        id, title, notes, updated_at,
        meals(
          id, name, time_start, emoji, sort_order, notes,
          meal_foods(
            quantity_g, quantity_description, notes, sort_order,
            food:foods(name, kcal, protein_g, carbs_g, fat_g, fiber_g, portion_g),
            substitutes:meal_food_substitutes(
              sort_order, quantity_g, quantity_description,
              food:foods(name, kcal, protein_g, carbs_g, fat_g, portion_g)
            )
          )
        )
      `)
      .eq('patient_id', patientRow.id)
      .eq('active', true)
      .not('published_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan2) { setLoading(false); setNoplan(true); return }

    // Sort meals and meal_foods
    const sorted: Plan = {
      ...plan2,
      meals: ((plan2.meals ?? []) as unknown as Meal[])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(meal => ({
          ...meal,
          meal_foods: [...(meal.meal_foods ?? [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        })),
    }
    setPlan(sorted)
    setLoading(false)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void planData
  }

  // Totals
  const totals = plan?.meals.reduce(
    (acc, meal) => {
      const m = calcMacros(meal)
      return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat, fiber: acc.fiber + m.fiber }
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )

  const printDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{PRINT_STYLE}</style>

      {/* ── Toolbar (hidden when printing) ──────────────────────── */}
      <div className="no-print sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.97)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}>
        <Link href="/aluno/plano" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <span className="text-base font-black text-white flex-1">🖨️ Imprimir plano</span>
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <input type="checkbox" checked={showSubs} onChange={e => setShowSubs(e.target.checked)}
            className="rounded" />
          Mostrar substitutos
        </label>
        <button
          onClick={() => window.print()}
          className="px-5 py-2 rounded-xl font-bold text-sm transition-all"
          style={{ background: '#2563EB', color: 'white' }}>
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>

      {/* ── Print page ───────────────────────────────────────────── */}
      <div className="print-page min-h-screen py-6 px-6 max-w-3xl mx-auto"
        style={{ background: 'white', color: '#111827', fontFamily: 'system-ui, sans-serif' }}>

        {loading ? (
          <div className="text-center py-20 no-print">
            <div className="text-gray-400">Carregando plano...</div>
          </div>
        ) : noplan || !plan ? (
          <div className="text-center py-20 no-print">
            <div className="text-5xl mb-4">🥗</div>
            <div className="font-bold text-lg text-gray-800">Nenhum plano alimentar disponível</div>
            <div className="text-sm text-gray-500 mt-2">Aguarde seu nutricionista publicar seu plano.</div>
            <Link href="/aluno/plano" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
              ← Voltar
            </Link>
          </div>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-start justify-between mb-6 pb-4"
              style={{ borderBottom: '2px solid #1D4ED8' }}>
              <div>
                <div className="text-2xl font-black text-gray-900">{plan.title}</div>
                {patient && (
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">{patient.full_name}</span>
                    {patient.goal && <span className="text-gray-400"> · Objetivo: {patient.goal}</span>}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">Emitido em {printDate}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Pedro Garrastazu Frey</div>
                <div className="text-xs text-gray-400">Nutricionista</div>
              </div>
            </div>

            {/* ── Daily totals ────────────────────────────────────── */}
            {totals && (
              <div className="grid grid-cols-5 gap-3 mb-6 p-4 rounded-2xl"
                style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                {[
                  { label: 'Calorias',  value: `${Math.round(totals.kcal)} kcal`, color: '#6D28D9' },
                  { label: 'Proteína',  value: `${Math.round(totals.protein)}g`,  color: '#1D4ED8' },
                  { label: 'Carboidrato', value: `${Math.round(totals.carbs)}g`, color: '#B45309' },
                  { label: 'Gordura',   value: `${Math.round(totals.fat)}g`,     color: '#DC2626' },
                  { label: 'Fibra',     value: `${Math.round(totals.fiber)}g`,   color: '#065F46' },
                ].map(t => (
                  <div key={t.label} className="text-center">
                    <div className="text-lg font-black" style={{ color: t.color }}>{t.value}</div>
                    <div className="text-[11px] text-gray-500 font-medium">{t.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Macro bar */}
            {totals && totals.kcal > 0 && (
              <div className="mb-6">
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div style={{ width: `${(totals.protein * 4 / totals.kcal) * 100}%`, background: '#3B82F6' }} />
                  <div style={{ width: `${(totals.carbs * 4 / totals.kcal) * 100}%`, background: '#F59E0B' }} />
                  <div style={{ width: `${(totals.fat * 9 / totals.kcal) * 100}%`, background: '#EF4444' }} />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span><span style={{ color: '#3B82F6' }}>●</span> Proteína {Math.round((totals.protein * 4 / totals.kcal) * 100)}%</span>
                  <span><span style={{ color: '#F59E0B' }}>●</span> Carboidrato {Math.round((totals.carbs * 4 / totals.kcal) * 100)}%</span>
                  <span><span style={{ color: '#EF4444' }}>●</span> Gordura {Math.round((totals.fat * 9 / totals.kcal) * 100)}%</span>
                </div>
              </div>
            )}

            {/* ── Meals ───────────────────────────────────────────── */}
            <div className="space-y-5">
              {plan.meals.map((meal, mIdx) => {
                const macros = calcMacros(meal)
                const emoji = meal.emoji ?? MEAL_EMOJIS[meal.name] ?? '🍽️'
                return (
                  <div key={meal.id} className="meal-card rounded-2xl overflow-hidden"
                    style={{ border: '1px solid #E5E7EB' }}>
                    {/* Meal header */}
                    <div className="px-4 py-3 flex items-center justify-between"
                      style={{ background: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emoji}</span>
                        <div>
                          <div className="font-bold text-gray-800 text-sm">{meal.name}</div>
                          {meal.time_start && (
                            <div className="text-xs text-gray-500">🕐 {meal.time_start.slice(0, 5)}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-black text-gray-800">{Math.round(macros.kcal)} kcal</div>
                        <div className="text-gray-500">{Math.round(macros.protein)}g P · {Math.round(macros.carbs)}g C · {Math.round(macros.fat)}g G</div>
                      </div>
                    </div>

                    {/* Foods */}
                    <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                      {meal.meal_foods.map((mf, fIdx) => {
                        const food = mf.food
                        if (!food) return null
                        const ratio = mf.quantity_g / (food.portion_g || 100)
                        const fKcal = Math.round(food.kcal * ratio)
                        const qty = mf.quantity_description ?? `${mf.quantity_g}g`

                        return (
                          <div key={fIdx}>
                            {/* Main food */}
                            <div className="px-4 py-2.5 flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                                style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                                {mIdx + 1}{String.fromCharCode(65 + fIdx)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-800">{food.name}</div>
                                {mf.notes && (
                                  <div className="text-xs text-gray-500 italic">{mf.notes}</div>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-black text-gray-800">{qty}</div>
                                <div className="text-[10px] text-gray-400">{fKcal} kcal</div>
                              </div>
                            </div>

                            {/* Substitutes */}
                            {showSubs && mf.substitutes && mf.substitutes.length > 0 && (
                              <div className="px-4 pb-2 space-y-1">
                                {[...mf.substitutes]
                                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                  .map((sub, sIdx) => {
                                    if (!sub.food) return null
                                    const sQty = sub.quantity_description ?? `${sub.quantity_g}g`
                                    return (
                                      <div key={sIdx} className="flex items-center gap-2 pl-8"
                                        style={{ color: '#6B7280' }}>
                                        <span className="text-xs">↳ ou</span>
                                        <span className="text-xs font-medium flex-1">{sub.food.name}</span>
                                        <span className="text-xs">{sQty}</span>
                                      </div>
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Meal notes */}
                    {meal.notes && (
                      <div className="px-4 py-2.5 text-xs text-gray-600 italic"
                        style={{ background: '#FFFBEB', borderTop: '1px solid #FDE68A' }}>
                        📌 {meal.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Plan notes ──────────────────────────────────────── */}
            {plan.notes && (
              <div className="mt-6 p-4 rounded-2xl text-sm text-gray-700 leading-relaxed"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div className="font-bold text-green-800 mb-1 text-xs uppercase tracking-widest">Orientações gerais</div>
                {plan.notes}
              </div>
            )}

            {/* ── Footer ──────────────────────────────────────────── */}
            <div className="mt-8 pt-4 text-center text-xs text-gray-400"
              style={{ borderTop: '1px solid #E5E7EB' }}>
              Plano alimentar elaborado por Pedro Garrastazu Frey — Nutricionista · PGF Nutrição
              <br />Dúvidas? Entre em contato pelo WhatsApp
            </div>
          </>
        )}
      </div>
    </>
  )
}
