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
        <PatientList patients={patients ?? []} />
      </div>
    </div>
  )
}
