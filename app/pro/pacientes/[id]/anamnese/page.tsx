import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AnamneseEditor from './AnamneseEditor'

export default async function AnamnesePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, weight_kg, height_cm, date_of_birth, gender, goal, activity_level, phone, email')
    .eq('id', id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) redirect('/pro/pacientes')

  const { data: anamnesis } = await supabase
    .from('patient_anamnesis')
    .select('*')
    .eq('patient_id', id)
    .eq('professional_id', user.id)
    .maybeSingle()

  return (
    <AnamneseEditor
      patient={patient}
      anamnesis={anamnesis ?? null}
      patientId={id}
    />
  )
}
