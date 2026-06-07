import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FotosClient from './FotosClient'

export default async function FotosPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  // Verify patient ownership
  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, weight_kg')
    .eq('id', id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) redirect('/pro/pacientes')

  // Load photo metadata
  const { data: photos } = await supabase
    .from('progress_photos')
    .select('id, taken_at, category, weight_kg, notes, storage_path, created_at')
    .eq('patient_id', id)
    .order('taken_at', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <FotosClient
      patient={patient}
      initialPhotos={photos ?? []}
      patientId={id}
    />
  )
}
