import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewPatientModal from './NewPatientModal'
import PatientList from './PatientList'

export default async function PacientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patients } = await supabase
    .from('patients')
    .select('id,full_name,email,phone,goal,weight_kg,height_cm,date_of_birth,gender,auth_user_id')
    .eq('professional_id', user.id)
    .eq('active', true)
    .order('full_name')

  // Fetch the most recent check-in and diary entry for each patient
  const patientIds = (patients ?? []).map(p => p.id)
  let latestCheckIns: Record<string, { measured_at: string; weight_kg: number | null; adherence_pct: number | null }> = {}
  let latestDiaries: Record<string, { logged_at: string; total_kcal: number | null }> = {}

  if (patientIds.length > 0) {
    const [{ data: checkIns }, { data: diaryEntries }] = await Promise.all([
      supabase
        .from('anthropometric_records')
        .select('patient_id, measured_at, weight_kg, adherence_pct')
        .in('patient_id', patientIds)
        .eq('professional_id', user.id)
        .order('measured_at', { ascending: false }),
      supabase
        .from('diary_entries')
        .select('patient_id, logged_at, total_kcal')
        .in('patient_id', patientIds)
        .order('logged_at', { ascending: false }),
    ])
    // Keep only the latest per patient
    for (const ci of checkIns ?? []) {
      if (!latestCheckIns[ci.patient_id]) {
        latestCheckIns[ci.patient_id] = { measured_at: ci.measured_at, weight_kg: ci.weight_kg, adherence_pct: ci.adherence_pct }
      }
    }
    for (const d of diaryEntries ?? []) {
      if (!latestDiaries[d.patient_id]) {
        latestDiaries[d.patient_id] = { logged_at: d.logged_at, total_kcal: d.total_kcal }
      }
    }
  }

  // Merge into patients
  const todayStr = new Date().toISOString().split('T')[0]
  const enrichedPatients = (patients ?? []).map(p => ({
    ...p,
    lastCheckIn: latestCheckIns[p.id] ?? null,
    lastDiary: latestDiaries[p.id] ?? null,
    loggedToday: latestDiaries[p.id]?.logged_at === todayStr,
  }))

  return (
    <div>
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div>
          <h1 className="text-base font-bold text-white">Pacientes</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{patients?.length ?? 0} pacientes ativos</p>
        </div>
        <NewPatientModal professionalId={user.id} />
      </div>

      <div className="p-8">
        <PatientList patients={enrichedPatients} />
      </div>
    </div>
  )
}
