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

  const { data: dietPlans } = await supabase
    .from('diet_plans')
    .select('id, title, active, kcal_goal, created_at, published_at')
    .eq('patient_id', id)
    .order('created_at', { ascending: false })

  return <PatientHub patient={patient} dietPlans={dietPlans ?? []} />
}
