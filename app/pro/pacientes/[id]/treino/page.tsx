import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import WorkoutEditor from './WorkoutEditor'

export default async function TreinoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: patient }, { data: exercises }] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('exercises').select('*').eq('professional_id', user.id).eq('active', true).order('name'),
  ])

  if (!patient) notFound()

  let { data: plan } = await supabase
    .from('workout_plans')
    .select(`*, workout_days(*, workout_exercises(*, exercise:exercises(*)))`)
    .eq('patient_id', id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!plan) {
    const { data: newPlan } = await supabase
      .from('workout_plans')
      .insert({ patient_id: id, professional_id: user.id, title: 'Plano de Treino', active: true })
      .select()
      .single()
    plan = { ...newPlan, workout_days: [] }
  }

  if (plan?.workout_days) {
    plan.workout_days.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    plan.workout_days.forEach((d: { workout_exercises: { sort_order: number }[] }) =>
      d.workout_exercises?.sort((a, b) => a.sort_order - b.sort_order)
    )
  }

  return <WorkoutEditor patient={patient} plan={plan} exercises={exercises ?? []} />
}
