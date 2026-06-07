'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import WorkoutDayTabs from '@/app/aluno/WorkoutDayTabs'

interface WorkoutDay {
  id: string
  name: string
  sort_order: number
  workout_exercises: {
    id: string
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    sort_order: number
    exercise: {
      name: string
      muscle_group: string | null
      video_url: string | null
      description: string | null
    }
  }[]
}

interface WorkoutPlan {
  id: string
  title: string | null
  description: string | null
  published_at: string | null
  workout_days: WorkoutDay[]
}

export default function AlunoTreinoPage() {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [noPlan, setNoPlan] = useState(false)

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

      const { data } = await supabase
        .from('workout_plans')
        .select(`
          id, title, description, published_at,
          workout_days(
            id, name, sort_order,
            workout_exercises(
              id, sets, reps, rest_seconds, notes, sort_order,
              exercise:exercises(name, muscle_group, video_url, description)
            )
          )
        `)
        .eq('patient_id', patient.id)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .single()

      if (!data) {
        setNoPlan(true)
      } else {
        // Sort days and exercises
        const sorted: WorkoutPlan = {
          ...data,
          workout_days: (data.workout_days ?? [])
            .sort((a: WorkoutDay, b: WorkoutDay) => a.sort_order - b.sort_order)
            .map((d: WorkoutDay) => ({
              ...d,
              workout_exercises: (d.workout_exercises ?? [])
                .sort((a, b) => a.sort_order - b.sort_order),
            })),
        }
        setPlan(sorted)
      }
    } catch {
      setNoPlan(true)
    }
    setLoading(false)
  }

  // Calculate total exercises across all days
  const totalExercises = plan?.workout_days.reduce(
    (sum, d) => sum + d.workout_exercises.length,
    0
  ) ?? 0

  // Unique muscle groups across all days
  const allMuscles = [...new Set(
    plan?.workout_days.flatMap(d =>
      d.workout_exercises.map(e => e.exercise.muscle_group).filter(Boolean)
    ) ?? []
  )]

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
          <h1 className="text-base font-bold text-white">🏋️ Meu Treino</h1>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-4xl animate-pulse">🏋️</div>
            <div className="text-white/40 text-sm">Carregando plano de treino...</div>
          </div>
        ) : noPlan ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-6">
            <div className="text-5xl">🏋️</div>
            <div className="text-white font-bold text-lg">Nenhum treino prescrito</div>
            <p className="text-white/40 text-sm leading-relaxed">
              Seu nutricionista ainda não publicou um plano de treino para você.
            </p>
            <Link href="/aluno" className="btn btn-primary mt-2">← Voltar ao início</Link>
          </div>
        ) : plan ? (
          <>
            {/* Plan header */}
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ background: 'rgba(90,111,204,0.1)', border: '1px solid rgba(90,111,204,0.25)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-white font-bold text-base">{plan.title ?? 'Plano de Treino'}</div>
                  {plan.description && (
                    <div className="text-white/50 text-xs mt-0.5">{plan.description}</div>
                  )}
                </div>
                {plan.published_at && (
                  <div className="text-xs text-white/30 text-right">
                    <div>Publicado</div>
                    <div>{new Date(plan.published_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Dias/semana', value: plan.workout_days.length, color: 'text-white' },
                  { label: 'Exercícios', value: totalExercises, color: 'text-blue-300' },
                  { label: 'Grupos', value: allMuscles.length, color: 'text-purple-300' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wide">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Muscle groups */}
              {allMuscles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {allMuscles.map(m => (
                    <span
                      key={m}
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(90,111,204,0.2)', color: '#9BAAE6' }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Workout day tabs */}
            <WorkoutDayTabs days={plan.workout_days} planTitle={null} />

            {/* Tips card */}
            <div
              className="mt-4 rounded-2xl p-4"
              style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <div className="text-xs font-bold text-amber-400 mb-2">💡 Dicas para seu treino</div>
              <ul className="space-y-1.5 text-xs text-white/50">
                <li>• Faça um aquecimento de 5–10 minutos antes de começar</li>
                <li>• Mantenha a técnica correta em todos os exercícios</li>
                <li>• Respeite os tempos de descanso prescritos</li>
                <li>• Hidrate-se bem durante toda a sessão</li>
                <li>• Em caso de dor intensa, interrompa e consulte seu profissional</li>
              </ul>
            </div>

            <div className="pb-8" />
          </>
        ) : null}
      </div>
    </div>
  )
}
