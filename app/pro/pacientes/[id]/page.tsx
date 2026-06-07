import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import PatientHub from './PatientHub'

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) notFound()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { data: dietPlans },
    { data: lastDiary },
    { data: lastConsultation },
    { data: lastRecord },
    { count: diaryCount30d },
    { data: activeGoals },
  ] = await Promise.all([
    supabase.from('diet_plans')
      .select('id, title, active, kcal_goal, created_at, published_at')
      .eq('patient_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('diary_entries')
      .select('logged_at, total_kcal')
      .eq('patient_id', id)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('consultations')
      .select('scheduled_at, type, status')
      .eq('patient_id', id)
      .eq('professional_id', user.id)
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('anthropometric_records')
      .select('measured_at, weight_kg')
      .eq('patient_id', id)
      .eq('professional_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('diary_entries')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', id)
      .gte('logged_at', thirtyDaysAgo),
    supabase.from('patient_goals')
      .select('id, label, metric, unit, target_value, current_value, start_value, direction, achieved, deadline')
      .eq('patient_id', id)
      .eq('achieved', false)
      .order('created_at'),
  ])

  const activitySummary = {
    lastDiary: lastDiary?.logged_at ?? null,
    lastConsultation: lastConsultation?.scheduled_at ?? null,
    lastRecord: lastRecord?.measured_at ?? null,
    lastWeight: lastRecord?.weight_kg ?? null,
    diaryCount30d: diaryCount30d ?? 0,
  }

  return <PatientHub patient={patient} dietPlans={dietPlans ?? []} activitySummary={activitySummary} activeGoals={activeGoals ?? []} />
}
