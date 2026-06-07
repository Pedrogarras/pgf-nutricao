import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DiarioClient from './DiarioClient'

export default async function DiarioPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, weight_kg')
    .eq('id', id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) redirect('/pro/pacientes')

  // Load last 30 diary entries
  const { data: entries } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('patient_id', id)
    .order('logged_at', { ascending: false })
    .order('meal_time', { ascending: true })
    .limit(60)

  // Load active diet plan for comparison
  const { data: activePlan } = await supabase
    .from('diet_plans')
    .select('id, title, kcal_goal, protein_goal_g, carbs_goal_g, fat_goal_g')
    .eq('patient_id', id)
    .eq('professional_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <DiarioClient
      patient={patient}
      initialEntries={entries ?? []}
      activePlan={activePlan ?? null}
      patientId={id}
    />
  )
}
