import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import NewPatientModal from './NewPatientModal'

export default async function PacientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .eq('professional_id', user!.id)
    .eq('active', true)
    .order('full_name')

  return (
    <div>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-8 h-15 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Pacientes</h1>
          <p className="text-xs text-gray-400">{patients?.length ?? 0} pacientes ativos</p>
        </div>
        <NewPatientModal professionalId={user!.id} />
      </div>

      <div className="p-8">
        <div className="card">
          <table className="w-full">
            <thead>
              <tr>
                {['Paciente', 'Objetivo', 'Peso / Altura', 'Nascimento', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(patients ?? []).map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-pgf-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-pgf-100 flex items-center justify-center text-pgf-600 font-bold text-sm flex-shrink-0">
                        {p.full_name.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{p.full_name}</div>
                        <div className="text-xs text-gray-400">{p.email ?? p.phone ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${
                      p.goal?.includes('massa') ? 'badge-blue' :
                      p.goal?.includes('emagr') ? 'badge-orange' : 'badge-gray'
                    }`}>{p.goal ?? '—'}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {p.weight_kg ? `${p.weight_kg} kg` : '—'}
                    {p.height_cm ? ` / ${p.height_cm} cm` : ''}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {p.date_of_birth ? new Date(p.date_of_birth + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <Link href={`/pro/pacientes/${p.id}/dieta`} className="btn btn-primary btn-sm">🥗 Dieta</Link>
                      <Link href={`/pro/pacientes/${p.id}/treino`} className="btn btn-outline btn-sm">💪 Treino</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!patients?.length && (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-gray-400">
                  <div className="text-4xl mb-3">👥</div>
                  <div className="font-semibold text-gray-600 mb-1">Nenhum paciente cadastrado</div>
                  <div className="text-sm">Clique em "Novo Paciente" para começar.</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
