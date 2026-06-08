import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'

interface Substitute {
  id: string
  quantity_g: number
  quantity_description: string | null
  sort_order: number
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
    id: string
    name: string
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number | null
    portion_g: number
  }
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

interface DietPlan {
  id: string
  title: string
  kcal_goal: number | null
  protein_goal_g: number | null
  carbs_goal_g: number | null
  fat_goal_g: number | null
  notes: string | null
  meals: Meal[]
}

function macros(mf: MealFood) {
  const ratio = mf.quantity_g / (mf.food.portion_g || 100)
  return {
    kcal:    Math.round(mf.food.kcal * ratio),
    protein: Math.round(mf.food.protein_g * ratio * 10) / 10,
    carbs:   Math.round(mf.food.carbs_g * ratio * 10) / 10,
    fat:     Math.round(mf.food.fat_g * ratio * 10) / 10,
    fiber:   Math.round((mf.food.fiber_g ?? 0) * ratio * 10) / 10,
  }
}

function mealTotals(meal: Meal) {
  return meal.meal_foods.reduce((acc, mf) => {
    const m = macros(mf)
    return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat, fiber: acc.fiber + m.fiber }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
}

export default async function ImprimirDietaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ plan?: string }>
}) {
  const { id } = await params
  const { plan: planId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: patient }, { data: plans }] = await Promise.all([
    supabase.from('patients').select('id, full_name, weight_kg, height_cm, date_of_birth, gender, goal').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('diet_plans')
      .select(`id, title, kcal_goal, protein_goal_g, carbs_goal_g, fat_goal_g, notes,
        meals(id, name, time_start, emoji, sort_order, notes,
          meal_foods(id, quantity_g, quantity_description, notes, sort_order,
            food:foods(id, name, kcal, protein_g, carbs_g, fat_g, fiber_g, portion_g),
            substitutes:meal_food_substitutes(id, quantity_g, quantity_description, sort_order, food:foods(name))
          )
        )`)
      .eq('patient_id', id)
      .eq('professional_id', user.id),
  ])

  if (!patient) notFound()

  const allPlans = (plans ?? []) as DietPlan[]
  const plan = planId
    ? allPlans.find(p => p.id === planId)
    : allPlans.find(p => true) // first
  if (!plan) notFound()

  const meals = plan.meals
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(m => ({ ...m, meal_foods: m.meal_foods.sort((a, b) => a.sort_order - b.sort_order) }))

  const totals = meals.reduce((acc, m) => {
    const t = mealTotals(m)
    return { kcal: acc.kcal + t.kcal, protein: acc.protein + t.protein, carbs: acc.carbs + t.carbs, fat: acc.fat + t.fat, fiber: acc.fiber + t.fiber }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth + 'T12:00').getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null
  const bmi = patient.weight_kg && patient.height_cm
    ? patient.weight_kg / ((patient.height_cm / 100) ** 2)
    : null

  const printDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        @page { margin: 1.2cm 1.5cm; }
        body { font-family: system-ui, -apple-system, sans-serif; background: white; color: #111; }
      `}</style>

      {/* Print Button */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: '#2563EB', color: 'white' }}
        >
          🖨️ Imprimir / PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: '#F3F4F6', color: '#374151' }}
        >
          ✕ Fechar
        </button>
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '32px 24px', background: 'white' }}>
        {/* Header / Letterhead */}
        <div style={{ borderBottom: '3px solid #2563EB', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#2563EB', letterSpacing: '-0.04em', fontStyle: 'italic' }}>
                PGF
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>
                Pedro Garrastazu Frey · Nutricionista
              </div>
              <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>
                CRN · pedro_frey@hotmail.com
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#9CA3AF' }}>Emitido em {printDate}</div>
            </div>
          </div>
        </div>

        {/* Patient Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', background: '#F8FAFF', borderRadius: '12px', padding: '16px', border: '1px solid #E0E7FF' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600', marginBottom: '4px' }}>Paciente</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#111' }}>{patient.full_name}</div>
            {patient.goal && <div style={{ fontSize: '12px', color: '#2563EB', marginTop: '2px', fontWeight: '500' }}>{patient.goal}</div>}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {age && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: '800', color: '#111' }}>{age}</div><div style={{ fontSize: '10px', color: '#9CA3AF' }}>anos</div></div>}
            {patient.weight_kg && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: '800', color: '#111' }}>{patient.weight_kg}</div><div style={{ fontSize: '10px', color: '#9CA3AF' }}>kg</div></div>}
            {patient.height_cm && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: '800', color: '#111' }}>{patient.height_cm}</div><div style={{ fontSize: '10px', color: '#9CA3AF' }}>cm</div></div>}
            {bmi && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: '800', color: '#111' }}>{bmi.toFixed(1)}</div><div style={{ fontSize: '10px', color: '#9CA3AF' }}>IMC</div></div>}
          </div>
        </div>

        {/* Plan Title + macros summary */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111', marginBottom: '12px' }}>
            {plan.emoji ? plan.emoji + ' ' : ''}{plan.title}
          </h1>

          {/* Macro goals bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {[
              { label: 'Calorias',   val: totals.kcal, goal: plan.kcal_goal, unit: 'kcal', color: '#2563EB' },
              { label: 'Proteínas',  val: totals.protein, goal: plan.protein_goal_g, unit: 'g', color: '#10B981' },
              { label: 'Carboidr.',  val: totals.carbs, goal: plan.carbs_goal_g, unit: 'g', color: '#F59E0B' },
              { label: 'Gorduras',   val: totals.fat, goal: plan.fat_goal_g, unit: 'g', color: '#8B5CF6' },
            ].map(m => (
              <div key={m.label} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px', border: `1px solid ${m.color}30`, textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: m.color }}>{Math.round(m.val)}<span style={{ fontSize: '10px', fontWeight: '400', color: '#9CA3AF', marginLeft: '2px' }}>{m.unit}</span></div>
                <div style={{ fontSize: '10px', color: '#6B7280' }}>{m.label}</div>
                {m.goal && <div style={{ fontSize: '9px', color: '#9CA3AF' }}>Meta: {m.goal}{m.unit}</div>}
              </div>
            ))}
          </div>

          {plan.notes && (
            <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic', padding: '8px 12px', background: '#FEF3C7', borderRadius: '6px', borderLeft: '3px solid #F59E0B' }}>
              💡 {plan.notes}
            </div>
          )}
        </div>

        {/* Meals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {meals.map((meal, mIdx) => {
            const mt = mealTotals(meal)
            return (
              <div key={meal.id} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Meal header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#F8FAFF', borderBottom: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{meal.emoji ?? '🍽️'}</span>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#111' }}>{meal.name}</div>
                      {meal.time_start && <div style={{ fontSize: '11px', color: '#6B7280' }}>⏰ {meal.time_start}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6B7280' }}>
                    <span><strong style={{ color: '#2563EB' }}>{mt.kcal}</strong> kcal</span>
                    <span><strong style={{ color: '#10B981' }}>{mt.protein.toFixed(0)}g</strong> prot</span>
                    <span><strong style={{ color: '#F59E0B' }}>{mt.carbs.toFixed(0)}g</strong> carb</span>
                    <span><strong style={{ color: '#8B5CF6' }}>{mt.fat.toFixed(0)}g</strong> gord</span>
                  </div>
                </div>

                {/* Foods table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Alimento', 'Quantidade', 'Medida caseira', 'Prot', 'Carb', 'Gord', 'Kcal'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Alimento' ? 'left' : 'right', fontSize: '9px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meal.meal_foods.map((mf, fi) => {
                      const m = macros(mf)
                      return (
                        <tr key={mf.id} style={{ borderBottom: fi < meal.meal_foods.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                          <td style={{ padding: '7px 10px', fontWeight: '500', color: '#111' }}>
                            {mf.food.name}
                            {mf.notes && <div style={{ fontSize: '10px', color: '#9CA3AF', fontStyle: 'italic' }}>{mf.notes}</div>}
                            {mf.substitutes && mf.substitutes.length > 0 && (
                              <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '3px' }}>
                                <span style={{ fontWeight: '700', color: '#D97706', marginRight: '4px' }}>OU:</span>
                                {[...mf.substitutes]
                                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                  .map((s, si, arr) => (
                                    <span key={s.id}>
                                      {s.food?.name ?? '—'}{s.quantity_description ? ` (${s.quantity_description})` : s.quantity_g ? ` (${s.quantity_g}g)` : ''}{si < arr.length - 1 ? ' · ' : ''}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{mf.quantity_g}g</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6B7280', fontSize: '11px' }}>{mf.quantity_description ?? '—'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#10B981', fontWeight: '600' }}>{m.protein}g</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#F59E0B', fontWeight: '600' }}>{m.carbs}g</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#8B5CF6', fontWeight: '600' }}>{m.fat}g</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#2563EB', fontWeight: '700' }}>{m.kcal}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F8FAFF', borderTop: '2px solid #E5E7EB' }}>
                      <td colSpan={3} style={{ padding: '7px 10px', fontSize: '10px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Subtotal {meal.name}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: '#10B981', fontWeight: '800', fontSize: '13px' }}>{mt.protein.toFixed(0)}g</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: '#F59E0B', fontWeight: '800', fontSize: '13px' }}>{mt.carbs.toFixed(0)}g</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: '#8B5CF6', fontWeight: '800', fontSize: '13px' }}>{mt.fat.toFixed(0)}g</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: '#2563EB', fontWeight: '800', fontSize: '13px' }}>{mt.kcal}</td>
                    </tr>
                  </tfoot>
                </table>

                {meal.notes && (
                  <div style={{ padding: '8px 16px', fontSize: '11px', color: '#6B7280', fontStyle: 'italic', background: '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
                    📌 {meal.notes}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Daily Totals */}
        <div style={{ marginTop: '20px', padding: '16px', background: '#EEF2FF', borderRadius: '12px', border: '2px solid #C7D2FE' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Diário
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {[
              { label: 'Calorias',   val: `${totals.kcal} kcal`,     color: '#1D4ED8' },
              { label: 'Proteínas',  val: `${totals.protein.toFixed(0)}g`, color: '#059669' },
              { label: 'Carboidr.',  val: `${totals.carbs.toFixed(0)}g`,   color: '#D97706' },
              { label: 'Gorduras',   val: `${totals.fat.toFixed(0)}g`,     color: '#7C3AED' },
              { label: 'Fibras',     val: `${totals.fiber.toFixed(0)}g`,   color: '#374151' },
            ].map(t => (
              <div key={t.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: t.color }}>{t.val}</div>
                <div style={{ fontSize: '10px', color: '#6B7280' }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Macro distribution */}
        {totals.kcal > 0 && (
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#6B7280', textAlign: 'center' }}>
            Distribuição: {Math.round((totals.protein * 4 / totals.kcal) * 100)}% proteínas ·
            {Math.round((totals.carbs * 4 / totals.kcal) * 100)}% carboidratos ·
            {Math.round((totals.fat * 9 / totals.kcal) * 100)}% gorduras
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
            Pedro Garrastazu Frey · Nutricionista
          </div>
          <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
            Este plano é individualizado — siga as orientações do seu nutricionista.
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelectorAll('button').forEach(b => {
          b.addEventListener('click', function() {
            if (this.textContent.includes('Imprimir')) window.print()
            if (this.textContent.includes('Fechar')) window.close()
          })
        })
      ` }} />
    </>
  )
}
