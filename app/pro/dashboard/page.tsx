import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ count: totalPatients }, { data: recentPatients }] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('professional_id', user.id).eq('active', true),
    supabase.from('patients').select('id,full_name,goal,weight_kg,created_at').eq('professional_id', user.id).eq('active', true).order('created_at', { ascending: false }).limit(5),
  ])

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Dark sticky header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div>
          <h1 className="text-base font-bold text-white">Dashboard</h1>
          <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>{today}</p>
        </div>
      </div>

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pacientes Ativos', value: totalPatients ?? 0, badge: 'Total', color: 'text-pgf-600' },
            { label: 'Alimentos TACO', value: '120+', badge: 'Banco', color: 'text-emerald-600' },
            { label: 'Planos Ativos', value: '—', badge: 'Dieta + Treino', color: 'text-amber-600' },
            { label: 'Versão', value: '1.0', badge: 'PGF App', color: 'text-gray-600' },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{s.label}</div>
              <div className={`text-3xl font-black my-1 ${s.color}`}>{s.value}</div>
              <span className="badge badge-blue text-[10px]">{s.badge}</span>
            </div>
          ))}
        </div>

        {/* Quick actions — icon replaced with SVG instead of emoji */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Link href="/pro/pacientes" className="card p-5 hover:border-pgf-200 hover:shadow-md transition-all group block">
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.08)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div className="font-bold text-gray-900 group-hover:text-pgf-600">Ver Pacientes</div>
            <div className="text-xs text-gray-400 mt-1">Gerenciar cadastros e planos</div>
          </Link>

          <Link href="/pro/alimentos" className="card p-5 hover:border-pgf-200 hover:shadow-md transition-all group block">
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z"/>
                <path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div className="font-bold text-gray-900 group-hover:text-pgf-600">Banco de Alimentos</div>
            <div className="text-xs text-gray-400 mt-1">TACO + alimentos personalizados</div>
          </Link>

          <Link href="/pro/exercicios" className="card p-5 hover:border-pgf-200 hover:shadow-md transition-all group block">
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <div className="font-bold text-gray-900 group-hover:text-pgf-600">Exercícios</div>
            <div className="text-xs text-gray-400 mt-1">Upload de vídeos e exercícios</div>
          </Link>
        </div>

        {/* Recent patients */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Pacientes Recentes</span>
            <Link href="/pro/pacientes" className="btn btn-outline btn-sm">Ver todos</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left">
                {['Paciente', 'Objetivo', 'Peso', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentPatients ?? []).map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-pgf-50/30">
                  <td className="px-5 py-3.5 font-semibold text-sm">{p.full_name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{p.goal ?? '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{p.weight_kg ? `${p.weight_kg} kg` : '—'}</td>
                  <td className="px-5 py-3.5">
                    <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm">Abrir</Link>
                  </td>
                </tr>
              ))}
              {!recentPatients?.length && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Nenhum paciente cadastrado ainda.{' '}
                  <Link href="/pro/pacientes" className="text-pgf-600 underline">Adicionar primeiro paciente</Link>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
