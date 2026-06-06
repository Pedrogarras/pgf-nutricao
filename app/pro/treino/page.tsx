import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TreinoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patients } = await supabase.from('patients').select('id,full_name').eq('professional_id', user.id).eq('active', true).order('full_name')

  return (
    <div>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-8 h-15 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Prescrição de Treino</h1>
          <p className="text-xs text-gray-400">Selecione um paciente para prescrever</p>
        </div>
        <Link href="/pro/exercicios" className="btn btn-outline btn-sm">🎥 Gerenciar Exercícios</Link>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-4">
          {(patients ?? []).map(p => (
            <Link key={p.id} href={`/pro/pacientes/${p.id}/treino`}
              className="card p-5 hover:border-pgf-200 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-full bg-pgf-100 flex items-center justify-center text-pgf-600 font-bold mb-3">
                {p.full_name.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
              </div>
              <div className="font-bold text-gray-900 group-hover:text-pgf-600">{p.full_name}</div>
              <div className="text-xs text-gray-400 mt-0.5">Clique para prescrever treino</div>
            </Link>
          ))}

          {!patients?.length && (
            <div className="col-span-3 text-center py-16">
              <div className="text-5xl mb-3">💪</div>
              <div className="font-semibold text-gray-600 mb-1">Nenhum paciente ainda</div>
              <Link href="/pro/pacientes" className="btn btn-primary mt-3">Cadastrar paciente</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
