import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MetasClient from './MetasClient'

export default async function MetasPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, weight_kg, height_cm')
    .eq('id', id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) redirect('/pro/pacientes')

  const { data: goals } = await supabase
    .from('patient_goals')
    .select('*')
    .eq('patient_id', id)
    .order('created_at')

  // Latest measurements for auto-fill
  const { data: latestRecord } = await supabase
    .from('anthropometric_records')
    .select('weight_kg, body_fat_pct, muscle_mass_kg, waist_cm')
    .eq('patient_id', id)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <MetasClient
      patient={patient}
      initialGoals={goals ?? []}
      latestRecord={latestRecord ?? null}
      patientId={id}
    />
  )
}
