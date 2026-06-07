import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import MedidasEditor from './MedidasEditor'

export default async function MedidasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: patient }, { data: records }] = await Promise.all([
    supabase.from('patients').select('id, full_name, weight_kg, height_cm').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('anthropometric_records').select('*').eq('patient_id', id).order('measured_at', { ascending: false }),
  ])

  if (!patient) notFound()

  return <MedidasEditor patient={patient} initialRecords={records ?? []} />
}
