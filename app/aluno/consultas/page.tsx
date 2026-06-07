import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type Consultation = {
  id: string
  scheduled_at: string
  duration_min: number | null
  type: string
  status: string
  notes: string | null
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  agendado:   { label: 'Agendado',   color: '#93C5FD', bg: 'rgba(147,197,253,0.12)' },
  confirmado: { label: 'Confirmado', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  realizado:  { label: 'Realizado',  color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  cancelado:  { label: 'Cancelado',  color: '#FCA5A5', bg: 'rgba(252,165,165,0.12)' },
  faltou:     { label: 'Faltou',     color: '#FCD34D', bg: 'rgba(252,211,77,0.12)' },
}

const TYPE_MAP: Record<string, string> = {
  presencial: '🏥 Presencial',
  online:     '💻 Online',
  telefone:   '📞 Telefone',
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default async function AlunoConsultasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, phone, professional_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!patient) redirect('/aluno')

  const now = new Date().toISOString()

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from('consultations')
      .select('id, scheduled_at, duration_min, type, status, notes')
      .eq('patient_id', patient.id)
      .in('status', ['agendado', 'confirmado'])
      .gte('scheduled_at', now)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('consultations')
      .select('id, scheduled_at, duration_min, type, status, notes')
      .eq('patient_id', patient.id)
      .or(`status.in.(realizado,cancelado,faltou),and(scheduled_at.lt.${now},status.in.(agendado,confirmado))`)
      .order('scheduled_at', { ascending: false })
      .limit(30),
  ])

  const upcomingList: Consultation[] = upcoming ?? []
  const pastList: Consultation[] = past ?? []
  const totalDone = pastList.filter(c => c.status === 'realizado').length

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">📅 Consultas</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {totalDone > 0
              ? `${totalDone} consulta${totalDone !== 1 ? 's' : ''} realizada${totalDone !== 1 ? 's' : ''}`
              : 'Histórico de consultas'}
          </p>
        </div>
      </div>

      <div className="px-5 py-5 max-w-lg mx-auto space-y-6">

        {/* Next upcoming consultation — prominent card */}
        {upcomingList.length > 0 && (() => {
          const next = upcomingList[0]
          const days = daysFromNow(next.scheduled_at)
          const statusInfo = STATUS_MAP[next.status] ?? STATUS_MAP.agendado
          return (
            <div className="rounded-2xl p-5 relative overflow-hidden"
              style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.35)' }}>
              {/* Top accent */}
              <div className="absolute top-0 left-8 right-8 h-px rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(147,197,253,0.6)' }}>
                    Próxima consulta
                  </div>
                  <div className="text-xl font-black text-white capitalize leading-tight">
                    {fmtFull(next.scheduled_at)}
                  </div>
                  <div className="text-sm mt-1 font-semibold" style={{ color: '#93C5FD' }}>
                    às {fmtTime(next.scheduled_at)}
                    {next.duration_min ? ` · ${next.duration_min} min` : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <div className="text-3xl font-black" style={{ color: days <= 1 ? '#FCD34D' : days <= 3 ? '#FB923C' : '#60A5FA' }}>
                    {days <= 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `${days}d`}
                  </div>
                  {days > 1 && (
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>dias</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: statusInfo.bg, color: statusInfo.color }}>
                  {statusInfo.label}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                  {TYPE_MAP[next.type] ?? next.type}
                </span>
              </div>

              {days <= 1 && (
                <div className="mt-3 text-xs py-2 px-3 rounded-xl text-center font-semibold animate-pulse"
                  style={{ background: 'rgba(252,211,77,0.1)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)' }}>
                  ⏰ Sua consulta é {days === 0 ? 'hoje' : 'amanhã'}! Prepare seus dados.
                </div>
              )}
            </div>
          )
        })()}

        {/* Other upcoming consultations */}
        {upcomingList.length > 1 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Próximas agendadas
            </div>
            <div className="space-y-2">
              {upcomingList.slice(1).map(c => {
                const statusInfo = STATUS_MAP[c.status] ?? STATUS_MAP.agendado
                return (
                  <div key={c.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white capitalize">{fmtShort(c.scheduled_at)}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {fmtTime(c.scheduled_at)} · {TYPE_MAP[c.type] ?? c.type}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No upcoming */}
        {upcomingList.length === 0 && (
          <div className="rounded-2xl p-5 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-3xl mb-2">📅</div>
            <div className="text-sm font-semibold text-white mb-1">Nenhuma consulta agendada</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Entre em contato com seu nutricionista para agendar.
            </div>
          </div>
        )}

        {/* Stats strip */}
        {(totalDone > 0 || pastList.length > 0) && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Realizadas', value: totalDone, color: '#4ADE80' },
              { label: 'Canceladas', value: pastList.filter(c => c.status === 'cancelado').length, color: '#FCA5A5' },
              { label: 'Total', value: upcomingList.length + pastList.length, color: '#93C5FD' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Past consultations */}
        {pastList.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Histórico
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              {pastList.map((c, i) => {
                const statusInfo = STATUS_MAP[c.status] ?? STATUS_MAP.realizado
                const isLast = i === pastList.length - 1
                return (
                  <div key={c.id}
                    className="px-4 py-3.5 flex items-start gap-4"
                    style={{
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                    {/* Date column */}
                    <div className="flex-shrink-0 w-14 text-center">
                      <div className="text-sm font-black text-white">
                        {new Date(c.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit' })}
                      </div>
                      <div className="text-[10px] uppercase font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(c.scheduled_at).toLocaleDateString('pt-BR', { month: 'short' })}
                      </div>
                      <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {new Date(c.scheduled_at).getFullYear()}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {TYPE_MAP[c.type] ?? c.type}
                        </span>
                        {c.duration_min && (
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {c.duration_min} min
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {fmtTime(c.scheduled_at)}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {pastList.length === 0 && upcomingList.length === 0 && (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">🗓️</div>
            <div className="font-bold text-white mb-1">Nenhuma consulta encontrada</div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Suas consultas aparecerão aqui após o agendamento.
            </div>
          </div>
        )}

        {/* "Prepare for next consultation" checklist */}
        {upcomingList.length > 0 && (
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.2)' }}>
            <div className="text-xs font-bold mb-3" style={{ color: '#93C5FD' }}>
              ✅ Prepare-se para a próxima consulta
            </div>
            <ul className="space-y-2">
              {[
                { icon: '📔', text: 'Registre seu diário alimentar dos últimos dias' },
                { icon: '💧', text: 'Anote sua ingestão média de água' },
                { icon: '📸', text: 'Tire fotos de evolução para comparar' },
                { icon: '⚖️', text: 'Registre seu peso atual na balança' },
                { icon: '😴', text: 'Observe padrão de sono e energia' },
              ].map(item => (
                <li key={item.text} className="flex items-start gap-2.5">
                  <span className="text-sm flex-shrink-0">{item.icon}</span>
                  <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 pt-2 pb-2" style={{ opacity: 0.18 }}>
          <div className="w-10 h-px bg-white" />
          <div className="w-1.5 h-1.5 rotate-45 border border-white" />
          <div className="w-10 h-px bg-white" />
        </div>
        <p className="text-center text-[11px] pb-2" style={{ color: 'rgba(197,205,240,0.22)' }}>
          Pedro Garrastazu Frey · Nutricionista
        </p>
      </div>
    </div>
  )
}
