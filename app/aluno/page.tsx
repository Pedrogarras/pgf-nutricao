import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import Link from 'next/link'
import CheckInForm from './CheckInForm'
import WorkoutDayTabs from './WorkoutDayTabs'

export default async function AlunoPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!patient) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="font-semibold text-white">Perfil não encontrado</div>
          <div className="text-sm mt-1" style={{ color: 'rgba(226,232,248,0.5)' }}>Contate seu nutricionista.</div>
          <form action={logout} className="mt-4">
            <button type="submit" className="btn btn-sm text-white/60 border border-white/10 hover:border-white/30 rounded-lg px-4 py-1.5 text-xs">
              Sair
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Carrega todos os planos ativos e publicados (inclui substitutos)
  const { data: activePlans } = await supabase
    .from('diet_plans')
    .select(`*, meals(*, meal_foods(*, food:foods(*), substitutes:meal_food_substitutes(*, food:foods(*))))`)
    .eq('patient_id', patient.id)
    .eq('active', true)
    .not('published_at', 'is', null)
    .order('created_at', { ascending: false })

  const { data: workoutPlan } = await supabase
    .from('workout_plans')
    .select(`*, workout_days(*, workout_exercises(*, exercise:exercises(*)))`)
    .eq('patient_id', patient.id)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  // Last 8 check-ins for weight history
  const { data: checkIns } = await supabase
    .from('anthropometric_records')
    .select('id, measured_at, weight_kg, body_fat_pct, adherence_pct')
    .eq('patient_id', patient.id)
    .order('measured_at', { ascending: false })
    .limit(8)

  // Next upcoming consultation
  const { data: nextConsultation } = await supabase
    .from('consultations')
    .select('id, scheduled_at, duration_min, type, status')
    .eq('patient_id', patient.id)
    .in('status', ['agendado', 'confirmado'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(1)
    .single()

  // Active goals for patient
  const { data: activeGoals } = await supabase
    .from('patient_goals')
    .select('id, label, metric, unit, target_value, current_value, start_value, direction, deadline, achieved')
    .eq('patient_id', patient.id)
    .eq('achieved', false)
    .order('created_at')
    .limit(4)

  // Today's diary entries and water
  const todayDate = new Date().toISOString().split('T')[0]
  // For streak: last 60 days of diary dates
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [{ data: todayDiary }, { data: todayWater }, { data: recentDiary }] = await Promise.all([
    supabase
      .from('diary_entries')
      .select('id, total_kcal, total_protein_g, total_carbs_g, total_fat_g, meal_name, logged_at')
      .eq('patient_id', patient.id)
      .eq('logged_at', todayDate),
    supabase
      .from('water_intake')
      .select('amount_ml, goal_ml')
      .eq('patient_id', patient.id)
      .eq('date', todayDate)
      .maybeSingle(),
    supabase
      .from('diary_entries')
      .select('logged_at')
      .eq('patient_id', patient.id)
      .gte('logged_at', sixtyDaysAgo)
      .order('logged_at', { ascending: false }),
  ])

  type DiaryRow = { total_kcal: number | null; total_protein_g: number | null; total_carbs_g: number | null; total_fat_g: number | null }
  const todayKcal    = (todayDiary ?? []).reduce((s: number, e: DiaryRow) => s + (e.total_kcal ?? 0), 0)
  const todayProtein = (todayDiary ?? []).reduce((s: number, e: DiaryRow) => s + (e.total_protein_g ?? 0), 0)
  const todayCarbs   = (todayDiary ?? []).reduce((s: number, e: DiaryRow) => s + (e.total_carbs_g ?? 0), 0)
  const todayFat     = (todayDiary ?? []).reduce((s: number, e: DiaryRow) => s + (e.total_fat_g ?? 0), 0)
  const todayMeals   = (todayDiary ?? []).length
  const waterMl = todayWater?.amount_ml ?? 0
  const waterGoal = todayWater?.goal_ml ?? 2000

  // Calculate diary streak (consecutive days logged, counting from today or yesterday)
  const loggedDates = new Set((recentDiary ?? []).map((e: { logged_at: string }) => e.logged_at))
  let diaryStreak = 0
  const today = new Date()
  // If logged today, start from today; otherwise start from yesterday
  const startOffset = loggedDates.has(todayDate) ? 0 : 1
  for (let i = startOffset; i < 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if (loggedDates.has(ds)) {
      diaryStreak++
    } else {
      break
    }
  }

  const { plan: selectedPlanId } = await searchParams

  // Seleciona o plano a exibir: ?plan=ID ou o primeiro da lista
  const plans = activePlans ?? []
  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? plans[0] ?? null

  const meals = (selectedPlan?.meals ?? [])
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    .map((m: { meal_foods?: { sort_order: number; substitutes?: { sort_order: number }[] }[] }) => ({
      ...m,
      meal_foods: (m.meal_foods ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(mf => ({
          ...mf,
          substitutes: (mf.substitutes ?? []).sort((a, b) => a.sort_order - b.sort_order),
        })),
    }))
  const days = workoutPlan?.workout_days?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order) ?? []

  function r(n: number) { return Math.round(n * 10) / 10 }

  type FoodType = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sodium_mg: number; portion_g: number }
  const totals = meals.reduce((acc: { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number }, meal: { meal_foods: { quantity_g: number; food: FoodType }[] }) => {
    meal.meal_foods?.forEach((mf: { quantity_g: number; food: FoodType }) => {
      const ratio = mf.quantity_g / (mf.food.portion_g || 100)
      acc.kcal += mf.food.kcal * ratio
      acc.protein += mf.food.protein_g * ratio
      acc.carbs += mf.food.carbs_g * ratio
      acc.fat += mf.food.fat_g * ratio
      acc.fiber += (mf.food.fiber_g ?? 0) * ratio
      acc.sodium += (mf.food.sodium_mg ?? 0) * ratio
    })
    return acc
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })

  return (
    <div className="max-w-md mx-auto pb-10">
      {/* Header */}
      <div className="px-6 pt-10 pb-20 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #06060A 0%, #0C0C18 100%)' }}>
        {/* Top blue accent line */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

        {patient.public_message && (
          <div className="mb-3 rounded-xl p-4" style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.28)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: 'rgba(147,197,253,0.75)' }}>
                Mensagem do seu nutricionista
              </span>
            </div>
            <div className="text-sm text-white leading-relaxed">{patient.public_message}</div>
            {patient.public_message_at && (
              <div className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {new Date(patient.public_message_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        )}
        {nextConsultation && (
          <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2.5" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(147,197,253,0.7)' }}>Próxima consulta</div>
              <div className="text-xs font-semibold text-white">
                {new Date(nextConsultation.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' às '}
                {new Date(nextConsultation.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{nextConsultation.type === 'presencial' ? '🏥 Presencial' : nextConsultation.type === 'online' ? '💻 Online' : '📞 Telefone'}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-[10px] font-medium tracking-widest uppercase mb-1"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Bem-vindo</div>
            <div className="text-2xl font-black text-white tracking-tight">{patient.full_name.split(' ')[0]}</div>
            <div className="text-xs mt-1 tracking-wide" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {patient.goal ?? 'Plano personalizado'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-serif italic font-black text-white tracking-tighter" style={{ fontSize: '1.5rem' }}>PGF</div>
            <div className="text-[9px] tracking-[2px] uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>Nutricionista</div>
            <form action={logout} className="mt-3">
              <button type="submit" className="text-[10px] tracking-wider uppercase"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                Sair
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-12 space-y-4">
        {/* Today's progress card */}
        <div className="rounded-2xl p-4 shadow-xl" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(197,205,240,0.4)' }}>
            Hoje · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Diary */}
            <div className="flex flex-col items-center justify-center rounded-xl py-3 gap-0.5"
              style={{ background: todayMeals > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${todayMeals > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
              <span className="text-xl">{todayMeals > 0 ? '✅' : '📔'}</span>
              <span className="text-sm font-black" style={{ color: todayMeals > 0 ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                {todayMeals > 0 ? `${todayMeals} ref.` : '—'}
              </span>
              <span className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.25)' }}>Diário</span>
              {diaryStreak >= 2 && (
                <span className="text-[10px] font-bold" style={{ color: '#fb923c' }}>🔥 {diaryStreak}d streak</span>
              )}
              {diaryStreak < 2 && todayMeals > 0 && todayKcal > 0 && (
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{Math.round(todayKcal)} kcal</span>
              )}
            </div>
            {/* Water */}
            <div className="flex flex-col items-center justify-center rounded-xl py-3 gap-1"
              style={{ background: waterMl >= waterGoal ? 'rgba(34,197,94,0.08)' : waterMl > 0 ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${waterMl >= waterGoal ? 'rgba(34,197,94,0.2)' : waterMl > 0 ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
              <span className="text-xl">{waterMl >= waterGoal ? '🎉' : '💧'}</span>
              <span className="text-sm font-black" style={{ color: waterMl >= waterGoal ? '#4ade80' : waterMl > 0 ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>
                {waterMl > 0 ? (waterMl >= 1000 ? `${(waterMl / 1000).toFixed(1)}L` : `${waterMl}ml`) : '—'}
              </span>
              <span className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.25)' }}>Água</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {waterMl >= waterGoal ? 'Meta atingida' : `meta ${(waterGoal / 1000).toFixed(1)}L`}
              </span>
            </div>
            {/* Goals */}
            <div className="flex flex-col items-center justify-center rounded-xl py-3 gap-1"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <span className="text-xl">🎯</span>
              <span className="text-sm font-black" style={{ color: '#fbbf24' }}>
                {activeGoals?.length ?? 0}
              </span>
              <span className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.25)' }}>Metas</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>em progresso</span>
            </div>
          </div>
        </div>

        {/* Today consumed vs plan targets */}
        {selectedPlan && todayMeals > 0 && (() => {
          const kcalGoal  = selectedPlan.kcal_goal ?? totals.kcal
          const protGoal  = selectedPlan.protein_goal_g ?? (totals.protein > 0 ? Math.round(totals.protein) : null)
          const carbsGoal = selectedPlan.carbs_goal_g   ?? (totals.carbs   > 0 ? Math.round(totals.carbs)   : null)
          const fatGoal   = selectedPlan.fat_goal_g     ?? (totals.fat     > 0 ? Math.round(totals.fat)     : null)
          const kcalPct   = kcalGoal  > 0 ? Math.min(115, Math.round((todayKcal    / kcalGoal)  * 100)) : null
          const protPct   = protGoal  && protGoal  > 0 ? Math.min(115, Math.round((todayProtein / protGoal)  * 100)) : null
          const carbsPct  = carbsGoal && carbsGoal > 0 ? Math.min(115, Math.round((todayCarbs   / carbsGoal) * 100)) : null
          const fatPct    = fatGoal   && fatGoal   > 0 ? Math.min(115, Math.round((todayFat     / fatGoal)   * 100)) : null
          const barColor  = (pct: number) => pct >= 100 ? '#22c55e' : pct >= 75 ? '#60a5fa' : pct >= 50 ? '#fbbf24' : '#f87171'
          return (
            <div className="rounded-2xl p-4 shadow-xl"
              style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(197,205,240,0.4)' }}>
                  Consumo de hoje
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(37,99,235,0.12)', color: '#93C5FD' }}>
                  {todayMeals} ref. registradas
                </span>
              </div>
              {/* kcal big number + bar */}
              <div className="flex items-end justify-between mb-2">
                <div className="text-2xl font-black text-white">
                  {Math.round(todayKcal)}
                  <span className="text-sm font-medium ml-1" style={{ color: 'rgba(197,205,240,0.4)' }}>kcal</span>
                </div>
                {kcalGoal > 0 && (
                  <div className="text-right">
                    <span className="text-[10px]" style={{ color: 'rgba(197,205,240,0.3)' }}>meta </span>
                    <span className="text-xs font-bold" style={{ color: 'rgba(197,205,240,0.5)' }}>{Math.round(kcalGoal)}</span>
                    {kcalPct !== null && (
                      <span className="ml-2 text-xs font-black" style={{ color: barColor(kcalPct) }}>{kcalPct}%</span>
                    )}
                  </div>
                )}
              </div>
              {kcalGoal > 0 && kcalPct !== null && (
                <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, kcalPct)}%`, background: barColor(kcalPct) }} />
                </div>
              )}
              {/* Macros mini bars */}
              {(protPct !== null || carbsPct !== null || fatPct !== null) && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Prot', consumed: Math.round(todayProtein), goal: protGoal,  pct: protPct,  color: '#93C5FD' },
                    { label: 'Carb', consumed: Math.round(todayCarbs),   goal: carbsGoal, pct: carbsPct, color: '#FCD34D' },
                    { label: 'Gord', consumed: Math.round(todayFat),     goal: fatGoal,   pct: fatPct,   color: '#FCA5A5' },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-sm font-black" style={{ color: m.color }}>{m.consumed}g</span>
                        {m.goal && (
                          <span className="text-[10px]" style={{ color: 'rgba(197,205,240,0.3)' }}>/{m.goal}g</span>
                        )}
                      </div>
                      {m.pct !== null && (
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(100, m.pct)}%`, background: m.color }} />
                        </div>
                      )}
                      <div className="text-[10px] mt-1" style={{ color: 'rgba(197,205,240,0.4)' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Macro card */}
        {selectedPlan && (() => {
          const hasGoals = selectedPlan.protein_goal_g || selectedPlan.carbs_goal_g || selectedPlan.fat_goal_g
          const macroList = [
            { label: 'Prot', value: r(totals.protein), goal: selectedPlan.protein_goal_g, color: '#93C5FD', trackColor: 'rgba(147,197,253,0.2)' },
            { label: 'Carb', value: r(totals.carbs), goal: selectedPlan.carbs_goal_g, color: '#FCD34D', trackColor: 'rgba(252,211,77,0.2)' },
            { label: 'Gord', value: r(totals.fat), goal: selectedPlan.fat_goal_g, color: '#FCA5A5', trackColor: 'rgba(252,165,165,0.2)' },
          ]
          return (
            <div className="rounded-2xl p-4 shadow-xl" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
              {/* kcal header */}
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(197,205,240,0.4)' }}>
                    Total do dia
                  </div>
                  <div className="text-3xl font-black text-white leading-none">
                    {r(totals.kcal)}
                    <span className="text-base font-medium ml-1" style={{ color: 'rgba(197,205,240,0.4)' }}>kcal</span>
                  </div>
                </div>
                {selectedPlan.kcal_goal && (
                  <div className="text-right">
                    <div className="text-[10px]" style={{ color: 'rgba(197,205,240,0.3)' }}>meta</div>
                    <div className="text-sm font-bold" style={{ color: 'rgba(197,205,240,0.5)' }}>{selectedPlan.kcal_goal} kcal</div>
                  </div>
                )}
              </div>
              {/* kcal progress bar */}
              {selectedPlan.kcal_goal && (
                <div className="mb-4">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (totals.kcal / selectedPlan.kcal_goal) * 100).toFixed(1)}%`,
                        background: 'linear-gradient(90deg, #2563EB, #60A5FA)',
                      }}
                    />
                  </div>
                </div>
              )}
              {/* Macros */}
              <div className="grid grid-cols-3 gap-3">
                {macroList.map(m => (
                  <div key={m.label}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-base font-black" style={{ color: m.color }}>{m.value}g</span>
                      {hasGoals && m.goal && (
                        <span className="text-[10px]" style={{ color: 'rgba(197,205,240,0.3)' }}>/{m.goal}g</span>
                      )}
                    </div>
                    {hasGoals && m.goal ? (
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: m.trackColor }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (m.value / m.goal) * 100).toFixed(1)}%`,
                            background: m.color,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-px" style={{ background: m.trackColor }} />
                    )}
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(197,205,240,0.4)' }}>{m.label}</div>
                  </div>
                ))}
              </div>
              {/* Fiber + sodium footer */}
              {totals.fiber > 0 || totals.sodium > 0 ? (
                <div className="flex gap-4 mt-3 pt-3 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {totals.fiber > 0 && (
                    <div style={{ color: 'rgba(197,205,240,0.5)' }}>
                      Fibra: <span className="font-bold" style={{ color: '#4ade80' }}>{r(totals.fiber)}g</span>
                    </div>
                  )}
                  {totals.sodium > 0 && (
                    <div style={{ color: 'rgba(197,205,240,0.5)' }}>
                      Sódio: <span className="font-bold" style={{ color: totals.sodium > 2000 ? '#fca5a5' : 'rgba(197,205,240,0.7)' }}>{Math.round(totals.sodium)}mg</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )
        })()}

        {/* Diet plan */}
        {selectedPlan ? (
          <>
            {/* Plan selector — shown when more than 1 active plan */}
            {plans.length > 1 && (
              <div>
                <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Plano Alimentar
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {plans.map(p => {
                    const isSelected = p.id === selectedPlan.id
                    return (
                      <Link
                        key={p.id}
                        href={`/aluno?plan=${p.id}`}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={isSelected ? {
                          background: 'rgba(37,99,235,0.25)',
                          color: '#93C5FD',
                          border: '1px solid rgba(37,99,235,0.4)',
                        } : {
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.4)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {p.title || 'Plano'}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {plans.length === 1 && (
              <div className="flex items-center justify-between mt-2">
                <div className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Plano Alimentar
                </div>
                {selectedPlan.title && (
                  <span className="text-xs font-semibold" style={{ color: 'rgba(147,197,253,0.8)' }}>
                    {selectedPlan.title}
                  </span>
                )}
              </div>
            )}

            {meals.map((meal: {
              id: string; emoji: string; name: string; time_start: string | null; notes: string | null
              meal_foods: { id: string; food: { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion_g: number }; quantity_g: number; quantity_description: string | null }[]
            }) => {
              const mealMacros = meal.meal_foods?.reduce((acc, mf) => {
                const ratio = mf.quantity_g / (mf.food.portion_g || 100)
                return {
                  kcal: acc.kcal + mf.food.kcal * ratio,
                  protein: acc.protein + mf.food.protein_g * ratio,
                  carbs: acc.carbs + mf.food.carbs_g * ratio,
                  fat: acc.fat + mf.food.fat_g * ratio,
                }
              }, { kcal: 0, protein: 0, carbs: 0, fat: 0 }) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }

              return (
                <div key={meal.id} className="rounded-xl overflow-hidden shadow-md"
                  style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                  {/* Meal header */}
                  <div className="px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(37,99,235,0.15)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{meal.emoji}</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-white">{meal.name}</div>
                        {meal.time_start && (
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(197,205,240,0.5)' }}>{meal.time_start}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-white">{r(mealMacros.kcal)}</div>
                        <div className="text-[10px]" style={{ color: 'rgba(197,205,240,0.4)' }}>kcal</div>
                      </div>
                    </div>
                    {/* Macro mini bar */}
                    {meal.meal_foods?.length > 0 && (
                      <div className="flex gap-3 mt-2.5 text-xs">
                        <span style={{ color: '#93C5FD' }}>P {r(mealMacros.protein)}g</span>
                        <span style={{ color: '#FCD34D' }}>C {r(mealMacros.carbs)}g</span>
                        <span style={{ color: '#FCA5A5' }}>G {r(mealMacros.fat)}g</span>
                      </div>
                    )}
                  </div>

                  {/* Food list */}
                  {meal.meal_foods?.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--dark-border)' }}>
                      {meal.meal_foods.map((mf: {
                        id: string
                        food: { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion_g: number }
                        quantity_g: number
                        quantity_description: string | null
                        notes: string | null
                        substitutes?: { id: string; food: { name: string }; quantity_g: number; quantity_description: string | null; notes: string | null }[]
                      }) => (
                        <div key={mf.id}>
                          {/* Alimento principal */}
                          <div className="px-4 py-2.5"
                            style={{ borderBottom: mf.substitutes?.length ? undefined : '1px solid var(--dark-border)' }}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium" style={{ color: 'rgba(226,232,248,0.9)' }}>
                                {mf.food.name}
                              </span>
                              <span className="text-xs ml-3 text-right flex-shrink-0" style={{ color: 'rgba(197,205,240,0.55)' }}>
                                {mf.quantity_description ?? `${mf.quantity_g}g`}
                              </span>
                            </div>
                            {mf.notes && (
                              <div className="text-[11px] italic mt-0.5" style={{ color: 'rgba(147,180,250,0.7)' }}>
                                {mf.notes}
                              </div>
                            )}
                          </div>
                          {/* Substitutos */}
                          {mf.substitutes?.map((sub, si) => (
                            <div key={sub.id}
                              className="flex items-center justify-between pl-6 pr-4 py-2"
                              style={{
                                borderBottom: si === (mf.substitutes!.length - 1) ? '1px solid var(--dark-border)' : '1px solid rgba(37,99,235,0.08)',
                                background: 'rgba(251,191,36,0.04)',
                              }}>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D' }}>
                                    OU
                                  </span>
                                  <span className="text-xs truncate" style={{ color: 'rgba(197,205,240,0.75)' }}>
                                    {sub.food.name}
                                  </span>
                                </div>
                                {sub.notes && (
                                  <div className="text-[10px] italic mt-0.5 ml-8" style={{ color: 'rgba(251,191,36,0.7)' }}>
                                    {sub.notes}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'rgba(197,205,240,0.45)' }}>
                                {sub.quantity_description ?? `${sub.quantity_g}g`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Orientações da refeição */}
                  {meal.notes && (
                    <div className="px-4 py-3" style={{ background: 'rgba(90,111,204,0.08)', borderTop: '1px solid rgba(90,111,204,0.2)' }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9BAAE6' }}>
                          Orientações
                        </span>
                      </div>
                      <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'rgba(226,232,248,0.65)' }}>
                        {meal.notes}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {selectedPlan.notes && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(90,111,204,0.12)', border: '1px solid rgba(90,111,204,0.25)' }}>
                <div className="text-xs font-bold mb-1" style={{ color: '#9BAAE6' }}>Orientações</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(226,232,248,0.7)' }}>{selectedPlan.notes}</div>
              </div>
            )}

            {/* Allergy/restriction reminder from anamnesis */}
            {selectedPlan.anamnesis && (() => {
              const a = selectedPlan.anamnesis as { allergies?: string | null; dislikes?: string | null; supplements?: string | null }
              if (!a.allergies && !a.dislikes && !a.supplements) return null
              return (
                <div className="rounded-xl px-4 py-3.5" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'rgba(252,165,165,0.8)' }}>
                    Suas restrições e preferências
                  </div>
                  <div className="space-y-1.5">
                    {a.allergies && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                          Alergias
                        </span>
                        <span className="text-xs" style={{ color: 'rgba(226,232,248,0.65)' }}>{a.allergies}</span>
                      </div>
                    )}
                    {a.dislikes && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: '#fcd34d' }}>
                          Evitar
                        </span>
                        <span className="text-xs" style={{ color: 'rgba(226,232,248,0.65)' }}>{a.dislikes}</span>
                      </div>
                    )}
                    {a.supplements && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(147,197,253,0.15)', color: '#93C5FD' }}>
                          Suplementação
                        </span>
                        <span className="text-xs" style={{ color: 'rgba(226,232,248,0.65)' }}>{a.supplements}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            <button onClick={() => window.print()}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)', color: '#9BAAE6' }}>
              Baixar Plano em PDF
            </button>
          </>
        ) : (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
            <div className="font-semibold" style={{ color: 'rgba(226,232,248,0.7)' }}>Plano alimentar ainda não publicado</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(197,205,240,0.4)' }}>Seu nutricionista irá liberar em breve.</div>
          </div>
        )}

        {/* Workout plan */}
        {workoutPlan && days.length > 0 && (
          <>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mt-4" style={{ color: 'rgba(255,255,255,0.35)' }}>Treino</div>
            <WorkoutDayTabs days={days} planTitle={workoutPlan.title} />
          </>
        )}

        {/* Weight history */}
        {checkIns && checkIns.length > 0 && (() => {
          const sorted = [...checkIns].reverse() // oldest first for chart
          const weights = sorted.map(c => c.weight_kg).filter((w): w is number => w != null)
          const latest = checkIns[0]
          const prev = checkIns[1]
          const delta = latest.weight_kg != null && prev?.weight_kg != null
            ? r(latest.weight_kg - prev.weight_kg) : null

          // Mini sparkline SVG
          let sparkline = null
          if (weights.length >= 2) {
            const W = 120, H = 30, PAD = 3
            const min = Math.min(...weights), max = Math.max(...weights)
            const range = max - min || 1
            const pts = weights.map((w, i) => {
              const x = PAD + (i / (weights.length - 1)) * (W - PAD * 2)
              const y = H - PAD - ((w - min) / range) * (H - PAD * 2)
              return `${x},${y}`
            })
            const trend = weights[weights.length - 1] - weights[0]
            const color = trend <= 0 ? '#22c55e' : '#ef4444'
            sparkline = (
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
                <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                {weights.map((w, i) => {
                  const x = PAD + (i / (weights.length - 1)) * (W - PAD * 2)
                  const y = H - PAD - ((w - min) / range) * (H - PAD * 2)
                  return <circle key={i} cx={x} cy={y} r="2" fill={color} opacity="0.6" />
                })}
              </svg>
            )
          }

          return (
            <>
              <div className="flex items-center justify-between mt-4">
                <div className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Evolução
                </div>
                <CheckInForm lastWeight={latest.weight_kg} />
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                {/* Header with sparkline */}
                <div className="px-4 py-3.5 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--dark-border)' }}>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(197,205,240,0.4)' }}>
                      Peso atual
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white">
                        {latest.weight_kg != null ? `${latest.weight_kg}` : '—'}
                      </span>
                      <span className="text-sm" style={{ color: 'rgba(197,205,240,0.4)' }}>kg</span>
                      {delta != null && (
                        <span className="text-xs font-bold" style={{ color: delta < 0 ? '#22c55e' : delta > 0 ? '#ef4444' : '#9ca3af' }}>
                          {delta > 0 ? '+' : ''}{delta} kg
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(197,205,240,0.3)' }}>
                      {new Date(latest.measured_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </div>
                  </div>
                  {sparkline}
                </div>

                {/* History table */}
                <div className="divide-y" style={{ borderColor: 'var(--dark-border)' }}>
                  {checkIns.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs" style={{ color: 'rgba(197,205,240,0.5)' }}>
                        {new Date(c.measured_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-white">
                          {c.weight_kg != null ? `${c.weight_kg} kg` : '—'}
                        </span>
                        {c.body_fat_pct != null && (
                          <span className="text-xs" style={{ color: 'rgba(197,205,240,0.4)' }}>{c.body_fat_pct}% gord.</span>
                        )}
                        {c.adherence_pct != null && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={c.adherence_pct >= 80
                              ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                              : c.adherence_pct >= 50
                              ? { background: 'rgba(59,130,246,0.15)', color: '#93C5FD' }
                              : { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }
                            }
                          >
                            {c.adherence_pct}% adesão
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        })()}

        {/* First check-in CTA for patients with no history */}
        {(!checkIns || checkIns.length === 0) && (
          <div className="rounded-xl p-5 text-center mt-4" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
            <div className="text-sm font-semibold text-white mb-1">Registre seu primeiro check-in</div>
            <div className="text-xs mb-4" style={{ color: 'rgba(197,205,240,0.45)' }}>
              Acompanhe sua evolução registrando peso e aderência ao plano.
            </div>
            <CheckInForm lastWeight={null} />
          </div>
        )}

        {/* Active goals */}
        {activeGoals && activeGoals.length > 0 && (
          <>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mt-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Minhas Metas
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
              <div className="divide-y" style={{ borderColor: 'var(--dark-border)' }}>
                {activeGoals.map((goal: { id: string; label: string; target_value: number; current_value: number | null; start_value: number | null; unit: string; direction: string; deadline: string | null }) => {
                  const start = goal.start_value
                  const current = goal.current_value
                  const target = goal.target_value
                  const pct = start != null && current != null && Math.abs(target - start) > 0
                    ? Math.min(100, Math.round((Math.abs(current - start) / Math.abs(target - start)) * 100))
                    : 0
                  const remaining = current != null ? Math.abs(target - current).toFixed(1) : null
                  return (
                    <div key={goal.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-sm font-semibold text-white">{goal.label}</div>
                        <div className="text-xs font-bold" style={{ color: 'rgba(147,197,253,0.7)' }}>
                          {current ?? '—'}{goal.unit}
                          {remaining != null && (
                            <span style={{ color: 'rgba(197,205,240,0.35)' }}> → {target}{goal.unit}</span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: pct >= 80 ? '#22c55e' : 'linear-gradient(90deg, #2563EB, #60A5FA)' }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px]" style={{ color: 'rgba(197,205,240,0.3)' }}>{pct}% concluído</span>
                        {goal.deadline && (
                          <span className="text-[10px]" style={{ color: 'rgba(197,205,240,0.3)' }}>
                            📅 {new Date(goal.deadline + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Quick shortcuts with status hints */}
        {(() => {
          const waterPct = Math.min(100, Math.round((waterMl / waterGoal) * 100))
          const shortcuts = [
            {
              href: '/aluno/plano', icon: '🥗', label: 'Plano',
              hint: selectedPlan ? selectedPlan.title?.slice(0, 10) || 'Ativo' : null,
              dot: selectedPlan ? 'green' : null,
            },
            {
              href: '/aluno/diario', icon: '📔', label: 'Diário',
              hint: todayMeals > 0 ? `${todayMeals} ref.` : 'Hoje',
              dot: todayMeals > 0 ? 'green' : 'amber',
            },
            {
              href: '/aluno/agua', icon: '💧', label: 'Água',
              hint: waterMl > 0 ? `${waterPct}%` : 'Meta',
              dot: waterMl >= waterGoal ? 'green' : waterMl > 0 ? 'blue' : null,
            },
            {
              href: '/aluno/evolucao', icon: '📈', label: 'Evolução',
              hint: checkIns && checkIns.length > 0 ? `${checkIns.length} reg.` : null,
              dot: null,
            },
            {
              href: '/aluno/checkin', icon: '⚖️', label: 'Check-in',
              hint: 'Medidas', dot: null,
            },
            {
              href: '/aluno/suplementos', icon: '💊', label: 'Suplementos',
              hint: null, dot: null,
            },
            {
              href: '/aluno/exames', icon: '🔬', label: 'Exames',
              hint: null, dot: null,
            },
            {
              href: '/aluno/aderencia', icon: '📊', label: 'Aderência',
              hint: null, dot: null,
            },
            {
              href: '/aluno/metas', icon: '🎯', label: 'Metas',
              hint: activeGoals && activeGoals.length > 0 ? `${activeGoals.length} ativas` : null,
              dot: activeGoals && activeGoals.length > 0 ? 'amber' : null,
            },
            {
              href: '/aluno/fotos', icon: '📸', label: 'Fotos',
              hint: null, dot: null,
            },
            {
              href: '/aluno/treino', icon: '🏋️', label: 'Treino',
              hint: null, dot: null,
            },
            {
              href: '/aluno/consultas', icon: '📅', label: 'Consultas',
              hint: nextConsultation ? 'Próxima ↑' : null,
              dot: nextConsultation ? 'blue' : null,
            },
            {
              href: '/aluno/perfil', icon: '👤', label: 'Minha Ficha',
              hint: null, dot: null,
            },
            {
              href: '/aluno/tabela', icon: '🔍', label: 'Tabela',
              hint: 'Alimentos', dot: null,
            },
            {
              href: '/aluno/receitas', icon: '👨‍🍳', label: 'Receitas',
              hint: null, dot: null,
            },
            {
              href: '/aluno/historico', icon: '📖', label: 'Jornada',
              hint: null, dot: null,
            },
            {
              href: '/aluno/compras', icon: '🛒', label: 'Compras',
              hint: 'Lista do plano', dot: null,
            },
            {
              href: '/aluno/semana', icon: '📅', label: 'Semana',
              hint: 'Resumo semanal', dot: null,
            },
            {
              href: '/aluno/conquistas', icon: '🏅', label: 'Conquistas',
              hint: 'Badges e XP', dot: null,
            },
          ]
          const dotColors: Record<string, string> = {
            green: '#4ade80', amber: '#fbbf24', blue: '#60a5fa',
          }
          return (
            <div className="grid grid-cols-4 gap-2 mb-2 last:mb-0">
              {shortcuts.map(item => (
                <Link key={item.href} href={item.href}
                  className="flex flex-col items-center gap-1 rounded-xl py-3 px-1 transition-all relative"
                  style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                  {item.dot && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                      style={{ background: dotColors[item.dot] }} />
                  )}
                  <div className="text-xl">{item.icon}</div>
                  <div className="text-[10px] font-semibold text-white">{item.label}</div>
                  {item.hint && (
                    <div className="text-[9px] leading-none truncate max-w-full px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {item.hint}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )
        })()}

        {/* Footer ornament */}
        <div className="flex items-center justify-center gap-3 pt-4 pb-2" style={{ opacity: 0.2 }}>
          <div className="w-12 h-px bg-white" />
          <div className="w-1.5 h-1.5 rotate-45 border border-white" />
          <div className="w-1 h-1 rotate-45 bg-white" />
          <div className="w-1.5 h-1.5 rotate-45 border border-white" />
          <div className="w-12 h-px bg-white" />
        </div>
        <p className="text-center text-xs pb-4" style={{ color: 'rgba(197,205,240,0.25)' }}>
          Pedro Garrastazu Frey · Nutricionista
        </p>
      </div>
    </div>
  )
}
