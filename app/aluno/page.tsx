import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'

export default async function AlunoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  // Busca o paciente
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
          <div className="font-semibold">Perfil não encontrado</div>
          <div className="text-sm text-gray-400 mt-1">Contate seu nutricionista.</div>
          <form action={logout} className="mt-4"><button type="submit" className="btn btn-ghost btn-sm">Sair</button></form>
        </div>
      </div>
    )
  }

  // Busca plano de dieta publicado
  const { data: dietPlan } = await supabase
    .from('diet_plans')
    .select(`*, meals(*, meal_foods(*, food:foods(*)))`)
    .eq('patient_id', patient.id)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  // Busca plano de treino publicado
  const { data: workoutPlan } = await supabase
    .from('workout_plans')
    .select(`*, workout_days(*, workout_exercises(*, exercise:exercises(*)))`)
    .eq('patient_id', patient.id)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  const meals = dietPlan?.meals?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order) ?? []
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
    <div className="max-w-md mx-auto pb-8">
      {/* Header */}
      <div className="bg-pgf-600 px-6 pt-10 pb-16">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-xs text-white/60 mb-0.5">Olá 👋</div>
            <div className="text-2xl font-black text-white">{patient.full_name.split(' ')[0]}</div>
            <div className="text-xs text-white/60 mt-0.5">{patient.goal ?? 'Plano personalizado'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/40 font-bold tracking-widest uppercase">PGF</div>
            <div className="text-[10px] text-white/30">Nutricionista</div>
            <form action={logout} className="mt-3">
              <button type="submit" className="text-white/40 text-xs underline">Sair</button>
            </form>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 space-y-4">
        {/* Macro card */}
        {dietPlan && (
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">
              Meta do dia{dietPlan.kcal_goal ? ` — ${dietPlan.kcal_goal} kcal` : ''}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-xl font-black text-gray-900">{r(totals.kcal)}</div>
                <div className="text-[10px] text-gray-400">kcal</div>
              </div>
              <div>
                <div className="text-xl font-black text-blue-600">{r(totals.protein)}g</div>
                <div className="text-[10px] text-gray-400">Prot</div>
              </div>
              <div>
                <div className="text-xl font-black text-amber-600">{r(totals.carbs)}g</div>
                <div className="text-[10px] text-gray-400">Carb</div>
              </div>
              <div>
                <div className="text-xl font-black text-red-500">{r(totals.fat)}g</div>
                <div className="text-[10px] text-gray-400">Gord</div>
              </div>
            </div>
          </div>
        )}

        {/* Diet plan */}
        {dietPlan ? (
          <>
            <div className="text-sm font-bold text-gray-700 mt-2">🥗 Plano Alimentar</div>
            {meals.map((meal: { id: string; emoji: string; name: string; time_start: string | null; meal_foods: { id: string; food: { name: string }; quantity_g: number; quantity_description: string | null }[] }) => {
              const mealKcal = r(meal.meal_foods?.reduce((acc: number, mf: { quantity_g: number; food: { kcal: number; portion_g: number } }) => acc + mf.food.kcal * (mf.quantity_g / (mf.food.portion_g || 100)), 0) ?? 0)
              return (
                <div key={meal.id} className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className="text-xl">{meal.emoji}</span>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{meal.name}</div>
                      <div className="text-xs text-gray-400">{meal.time_start ?? ''} · {mealKcal} kcal</div>
                    </div>
                  </div>
                  {meal.meal_foods?.length > 0 && (
                    <div className="border-t border-gray-50">
                      {meal.meal_foods.map((mf: { id: string; food: { name: string }; quantity_g: number; quantity_description: string | null }) => (
                        <div key={mf.id} className="flex justify-between px-4 py-2 text-sm border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-800">{mf.food.name}</span>
                          <span className="text-gray-400 text-xs">{mf.quantity_description ?? `${mf.quantity_g}g`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {dietPlan.notes && (
              <div className="bg-pgf-50 rounded-xl px-4 py-3 border border-pgf-100">
                <div className="text-xs font-bold text-pgf-600 mb-1">📋 Orientações</div>
                <div className="text-xs text-gray-600 leading-relaxed">{dietPlan.notes}</div>
              </div>
            )}

            <button onClick={() => window.print()} className="w-full btn btn-outline justify-center py-3">
              📄 Baixar Plano em PDF
            </button>
          </>
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="text-3xl mb-2">🥗</div>
            <div className="font-semibold text-gray-600">Plano alimentar ainda não publicado</div>
            <div className="text-sm text-gray-400 mt-1">Seu nutricionista irá liberar em breve.</div>
          </div>
        )}

        {/* Workout plan */}
        {workoutPlan && days.length > 0 && (
          <>
            <div className="text-sm font-bold text-gray-700 mt-4">💪 Treino</div>
            {days.map((day: { id: string; name: string; workout_exercises: { id: string; exercise: { name: string; muscle_group: string | null; video_url: string | null }; sets: number | null; reps: string | null; rest_seconds: number | null; notes: string | null }[] }) => (
              <div key={day.id} className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                <div className="bg-pgf-50 px-4 py-3 font-bold text-pgf-700 text-sm">💪 {day.name}</div>
                {day.workout_exercises.map(we => (
                  <div key={we.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium text-sm">{we.exercise.name}</div>
                        {we.exercise.muscle_group && <div className="text-xs text-pgf-500">{we.exercise.muscle_group}</div>}
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{we.sets ? `${we.sets}×` : ''}{we.reps ?? ''}</div>
                        {we.rest_seconds && <div>{we.rest_seconds}s descanso</div>}
                      </div>
                    </div>
                    {we.exercise.video_url && (
                      <a href={we.exercise.video_url} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-pgf-500 underline">
                        🎥 Ver vídeo
                      </a>
                    )}
                    {we.notes && <div className="text-xs text-gray-400 mt-1 italic">{we.notes}</div>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
