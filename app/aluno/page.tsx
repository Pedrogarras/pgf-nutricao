import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import Link from 'next/link'

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
          <div className="text-4xl mb-3">⚠️</div>
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

  const { plan: selectedPlanId } = await searchParams

  // Seleciona o plano a exibir: ?plan=ID ou o primeiro da lista
  const plans = activePlans ?? []
  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? plans[0] ?? null

  const meals = selectedPlan?.meals?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order) ?? []
  const days = workoutPlan?.workout_days?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order) ?? []

  function r(n: number) { return Math.round(n * 10) / 10 }

  const totals = meals.reduce((acc: { kcal: number; protein: number; carbs: number; fat: number }, meal: { meal_foods: { quantity_g: number; food: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion_g: number } }[] }) => {
    meal.meal_foods?.forEach((mf: { quantity_g: number; food: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion_g: number } }) => {
      const ratio = mf.quantity_g / (mf.food.portion_g || 100)
      acc.kcal += mf.food.kcal * ratio
      acc.protein += mf.food.protein_g * ratio
      acc.carbs += mf.food.carbs_g * ratio
      acc.fat += mf.food.fat_g * ratio
    })
    return acc
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  return (
    <div className="max-w-md mx-auto pb-10">
      {/* Header */}
      <div className="px-6 pt-10 pb-20 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #06060A 0%, #0C0C18 100%)' }}>
        {/* Top blue accent line */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

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
        {/* Macro card */}
        {selectedPlan && (
          <div className="rounded-2xl p-4 shadow-xl" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: 'rgba(197,205,240,0.5)' }}>
              Meta do dia{selectedPlan.kcal_goal ? ` — ${selectedPlan.kcal_goal} kcal` : ''}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-xl font-black text-white">{r(totals.kcal)}</div>
                <div className="text-[10px]" style={{ color: 'rgba(197,205,240,0.45)' }}>kcal</div>
              </div>
              <div>
                <div className="text-xl font-black" style={{ color: '#93C5FD' }}>{r(totals.protein)}g</div>
                <div className="text-[10px]" style={{ color: 'rgba(197,205,240,0.45)' }}>Prot</div>
              </div>
              <div>
                <div className="text-xl font-black" style={{ color: '#FCD34D' }}>{r(totals.carbs)}g</div>
                <div className="text-[10px]" style={{ color: 'rgba(197,205,240,0.45)' }}>Carb</div>
              </div>
              <div>
                <div className="text-xl font-black" style={{ color: '#FCA5A5' }}>{r(totals.fat)}g</div>
                <div className="text-[10px]" style={{ color: 'rgba(197,205,240,0.45)' }}>Gord</div>
              </div>
            </div>
          </div>
        )}

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
              <div className="text-[10px] font-bold tracking-[2px] uppercase mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Plano Alimentar
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
                        substitutes?: { id: string; food: { name: string }; quantity_g: number; quantity_description: string | null }[]
                      }) => (
                        <div key={mf.id}>
                          {/* Alimento principal */}
                          <div className="flex items-center justify-between px-4 py-2.5"
                            style={{ borderBottom: mf.substitutes?.length ? undefined : '1px solid var(--dark-border)' }}>
                            <span className="text-sm font-medium" style={{ color: 'rgba(226,232,248,0.9)' }}>
                              {mf.food.name}
                            </span>
                            <span className="text-xs ml-3 text-right flex-shrink-0" style={{ color: 'rgba(197,205,240,0.55)' }}>
                              {mf.quantity_description ?? `${mf.quantity_g}g`}
                            </span>
                          </div>
                          {/* Substitutos */}
                          {mf.substitutes?.map((sub, si) => (
                            <div key={sub.id}
                              className="flex items-center justify-between pl-6 pr-4 py-2"
                              style={{
                                borderBottom: si === (mf.substitutes!.length - 1) ? '1px solid var(--dark-border)' : '1px solid rgba(37,99,235,0.08)',
                                background: 'rgba(251,191,36,0.04)',
                              }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D' }}>
                                  OU
                                </span>
                                <span className="text-xs truncate" style={{ color: 'rgba(197,205,240,0.75)' }}>
                                  {sub.food.name}
                                </span>
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
                        <span>📋</span>
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
                <div className="text-xs font-bold mb-1" style={{ color: '#9BAAE6' }}>📋 Orientações</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(226,232,248,0.7)' }}>{selectedPlan.notes}</div>
              </div>
            )}

            <button onClick={() => window.print()}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)', color: '#9BAAE6' }}>
              📄 Baixar Plano em PDF
            </button>
          </>
        ) : (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
            <div className="text-3xl mb-2">🥗</div>
            <div className="font-semibold" style={{ color: 'rgba(226,232,248,0.7)' }}>Plano alimentar ainda não publicado</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(197,205,240,0.4)' }}>Seu nutricionista irá liberar em breve.</div>
          </div>
        )}

        {/* Workout plan */}
        {workoutPlan && days.length > 0 && (
          <>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mt-4" style={{ color: 'rgba(255,255,255,0.35)' }}>Treino</div>
            {days.map((day: { id: string; name: string; workout_exercises: { id: string; exercise: { name: string; muscle_group: string | null; video_url: string | null }; sets: number | null; reps: string | null; rest_seconds: number | null; notes: string | null }[] }) => (
              <div key={day.id} className="rounded-xl overflow-hidden shadow-md"
                style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                <div className="px-4 py-3 font-bold text-sm"
                  style={{ background: 'rgba(90,111,204,0.15)', color: '#C5CDF0', borderBottom: '1px solid var(--dark-border)' }}>
                  💪 {day.name}
                </div>
                {day.workout_exercises.map(we => (
                  <div key={we.id} className="px-4 py-3" style={{ borderBottom: '1px solid var(--dark-border)' }}>
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium text-sm" style={{ color: 'rgba(226,232,248,0.9)' }}>{we.exercise.name}</div>
                        {we.exercise.muscle_group && (
                          <div className="text-xs" style={{ color: '#9BAAE6' }}>{we.exercise.muscle_group}</div>
                        )}
                      </div>
                      <div className="text-right text-xs" style={{ color: 'rgba(197,205,240,0.5)' }}>
                        <div>{we.sets ? `${we.sets}×` : ''}{we.reps ?? ''}</div>
                        {we.rest_seconds && <div>{we.rest_seconds}s descanso</div>}
                      </div>
                    </div>
                    {we.exercise.video_url && (
                      <a href={we.exercise.video_url} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs underline" style={{ color: '#9BAAE6' }}>
                        🎥 Ver vídeo
                      </a>
                    )}
                    {we.notes && (
                      <div className="text-xs mt-1 italic" style={{ color: 'rgba(197,205,240,0.4)' }}>{we.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

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
