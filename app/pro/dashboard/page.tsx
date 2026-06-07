import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0,0,0,0)
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999)
  const todayDateStr = new Date().toISOString().split('T')[0]

  const [
    { count: totalPatients },
    { count: patientsWithAccess },
    { count: activePlans },
    { count: newThisMonth },
    { data: recentCheckIns },
    { data: todayConsultations },
    { data: allPatients },
    { data: recentlyCheckedIn },
    { data: activeGoals },
    { data: weekCheckIns },
    { data: supplementCount },
    { data: todayDiaryEntries },
    { data: recentDiaryEntries },
    { data: nearGoals },
    { data: upcomingConsultations },
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('professional_id', user.id).eq('active', true),
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('professional_id', user.id).eq('active', true).not('auth_user_id', 'is', null),
    supabase.from('diet_plans').select('*', { count: 'exact', head: true }).eq('professional_id', user.id).eq('active', true),
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('professional_id', user.id).gte('created_at', thisMonthStart.toISOString()),
    supabase.from('anthropometric_records').select('id, patient_id, measured_at, weight_kg, body_fat_pct, adherence_pct, patients(id, full_name)').eq('professional_id', user.id).order('measured_at', { ascending: false }).limit(10),
    supabase.from('consultations').select('id, scheduled_at, duration_min, type, status, patient:patients(id, full_name)').eq('professional_id', user.id).gte('scheduled_at', todayStart.toISOString()).lte('scheduled_at', todayEnd.toISOString()).order('scheduled_at'),
    supabase.from('patients').select('id, full_name, phone').eq('professional_id', user.id).eq('active', true),
    supabase.from('anthropometric_records').select('patient_id, measured_at, adherence_pct').eq('professional_id', user.id).gte('measured_at', thirtyDaysAgo),
    supabase.from('patient_goals').select('id', { count: 'exact', head: true }).eq('professional_id', user.id).eq('achieved', false),
    supabase.from('anthropometric_records').select('patient_id').eq('professional_id', user.id).gte('measured_at', sevenDaysAgo),
    supabase.from('supplement_prescriptions').select('id', { count: 'exact', head: true }).eq('professional_id', user.id).eq('active', true),
    // Today's diary entries (deduplicated by patient)
    supabase.from('diary_entries').select('patient_id, logged_at, total_kcal').eq('logged_at', todayDateStr),
    // Recent diary — last 30d (to find inactive patients)
    supabase.from('diary_entries').select('patient_id, logged_at').gte('logged_at', sevenDaysAgo),
    // Goals near completion (≥80%)
    supabase.from('patient_goals').select('id, label, metric, target_value, current_value, start_value, direction, deadline, patient_id, patients(id, full_name)').eq('professional_id', user.id).eq('achieved', false).limit(20),
    // Upcoming consultations (next 7 days)
    supabase.from('consultations').select('id, scheduled_at, duration_min, type, status, patient:patients(id, full_name)').eq('professional_id', user.id).in('status', ['agendado', 'confirmado']).gt('scheduled_at', todayEnd.toISOString()).lte('scheduled_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()).order('scheduled_at').limit(5),
  ])

  const recentIds = new Set((recentlyCheckedIn ?? []).map(r => r.patient_id))
  const needsAttention = (allPatients ?? []).filter(p => !recentIds.has(p.id))
  const weekCheckInPatients = new Set((weekCheckIns ?? []).map(r => r.patient_id)).size

  // Diary stats
  const todayDiaryPatients = new Set((todayDiaryEntries ?? []).map(e => e.patient_id)).size
  const recentDiaryPatients = new Set((recentDiaryEntries ?? []).map(e => e.patient_id))
  const noRecentDiary = (allPatients ?? []).filter(p => !recentDiaryPatients.has(p.id))

  // Goals near completion
  const nearCompletionGoals = (nearGoals ?? []).filter(g => {
    const start = g.start_value
    const current = g.current_value
    const target = g.target_value
    if (start == null || current == null) return false
    const totalDelta = Math.abs(target - start)
    if (totalDelta === 0) return false
    const progressDelta = Math.abs(current - start)
    const pct = (progressDelta / totalDelta) * 100
    return pct >= 80 && pct < 100
  }).slice(0, 4)

  // Average adherence from most recent check-ins
  const patientLatestAdherence: Record<string, number> = {}
  for (const r of (recentlyCheckedIn ?? [])) {
    if (r.adherence_pct !== null && !(r.patient_id in patientLatestAdherence)) {
      patientLatestAdherence[r.patient_id] = r.adherence_pct
    }
  }
  const adherenceValues = Object.values(patientLatestAdherence)
  const avgAdherence = adherenceValues.length
    ? Math.round(adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length)
    : null

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
        <Link href="/pro/pacientes" className="btn btn-primary btn-sm">+ Novo Paciente</Link>
      </div>

      <div className="p-8">

        {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="card p-5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Pacientes Ativos</div>
            <div className="text-3xl font-black text-pgf-600">{totalPatients ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1">
              {newThisMonth ? <><span className="text-emerald-500 font-semibold">+{newThisMonth}</span> este mês</> : 'total cadastrados'}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Diário hoje</div>
            <div className="text-3xl font-black text-emerald-600">{todayDiaryPatients}</div>
            <div className="text-xs text-gray-400 mt-1">
              {patientsWithAccess ? (
                <><span className={noRecentDiary.length > 0 ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                  {noRecentDiary.length > 0 ? `${noRecentDiary.length} sem registro 7d` : 'todos ativos ✓'}
                </span></>
              ) : '—'}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Check-ins / 7 dias</div>
            <div className="text-3xl font-black text-blue-600">{weekCheckInPatients}</div>
            <div className="text-xs text-gray-400 mt-1">
              {needsAttention.length > 0
                ? <><span className="text-red-400 font-semibold">{needsAttention.length}</span> sem check-in 30d</>
                : 'todos em dia ✓'}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Aderência Média</div>
            <div className={`text-3xl font-black ${avgAdherence != null ? avgAdherence >= 80 ? 'text-emerald-600' : avgAdherence >= 60 ? 'text-amber-500' : 'text-red-500' : 'text-gray-300'}`}>
              {avgAdherence != null ? `${avgAdherence}%` : '—'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {adherenceValues.length > 0 ? `${adherenceValues.length} pacientes com dado` : 'sem registros'}
            </div>
          </div>
        </div>

        {/* ── Secondary KPIs ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(139,92,246,0.1)' }}>
              <span className="text-lg">🎯</span>
            </div>
            <div>
              <div className="text-xl font-black text-gray-900">{(activeGoals as unknown as { count: number })?.count ?? '—'}</div>
              <div className="text-xs text-gray-400">Metas ativas</div>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(37,99,235,0.1)' }}>
              <span className="text-lg">🥗</span>
            </div>
            <div>
              <div className="text-xl font-black text-gray-900">{activePlans ?? 0}</div>
              <div className="text-xs text-gray-400">Planos alimentares ativos</div>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)' }}>
              <span className="text-lg">💊</span>
            </div>
            <div>
              <div className="text-xl font-black text-gray-900">{(supplementCount as unknown as { count: number })?.count ?? '—'}</div>
              <div className="text-xs text-gray-400">Suplementos prescritos</div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {[
            { href: '/pro/pacientes',  icon: '👤', label: 'Pacientes',         desc: 'Gerenciar cadastros',     color: '#2563EB' },
            { href: '/pro/mensagens',  icon: '💬', label: 'Mensagens',          desc: 'Templates WhatsApp',       color: '#10B981' },
            { href: '/pro/templates',  icon: '⭐', label: 'Templates',          desc: 'Refeições reutilizáveis',  color: '#F59E0B' },
            { href: '/pro/alimentos',  icon: '🥦', label: 'Alimentos',          desc: 'Banco TACO + custom',      color: '#8B5CF6' },
            { href: '/pro/agenda',     icon: '📅', label: 'Agenda',             desc: 'Consultas agendadas',      color: '#EF4444' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="card p-4 hover:shadow-md transition-all group block text-center"
            >
              <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center text-xl"
                style={{ background: a.color + '12' }}>
                {a.icon}
              </div>
              <div className="text-xs font-bold text-gray-800 group-hover:text-pgf-600">{a.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{a.desc}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* ── Today's consultations ─────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="card-title">Consultas de Hoje</span>
              </div>
              <Link href="/pro/agenda" className="btn btn-outline btn-sm">Agenda</Link>
            </div>
            {todayConsultations && todayConsultations.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {todayConsultations.map(c => {
                  const patient = c.patient as unknown as { id: string; full_name: string } | null
                  const dt = new Date(c.scheduled_at)
                  const time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const statusColors: Record<string, string> = { agendado: 'badge-blue', confirmado: 'badge-green', realizado: 'badge-gray', cancelado: 'badge-red' }
                  const statusLabel: Record<string, string> = { agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado', faltou: 'Faltou' }
                  return (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-black text-pgf-600 w-12">{time}</div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{patient?.full_name ?? '—'}</div>
                          <div className="text-xs text-gray-400">{c.duration_min} min · {c.type === 'presencial' ? '🏥' : c.type === 'online' ? '💻' : '📞'} {c.type}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge text-[10px] ${statusColors[c.status as string] ?? 'badge-blue'}`}>{statusLabel[c.status as string] ?? c.status}</span>
                        {patient && <Link href={`/pro/pacientes/${patient.id}`} className="btn btn-outline btn-sm">→</Link>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <div className="text-2xl mb-2">🌴</div>
                <div className="text-sm text-gray-400">Nenhuma consulta hoje</div>
              </div>
            )}
          </div>

          {/* ── Recent check-ins ──────────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Check-ins Recentes</span>
              <Link href="/pro/pacientes" className="btn btn-outline btn-sm">Ver todos</Link>
            </div>
            {recentCheckIns?.length ? (
              <div className="divide-y divide-gray-50">
                {recentCheckIns.slice(0, 8).map(ci => {
                  const p = ci.patients as unknown as { id: string; full_name: string } | null
                  const days = Math.floor((Date.now() - new Date(ci.measured_at + 'T12:00').getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={ci.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-pgf-100 flex items-center justify-center text-pgf-600 font-bold text-xs flex-shrink-0">
                          {p?.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p?.full_name ?? '—'}</div>
                          <div className="text-xs text-gray-400">
                            {days === 0 ? 'Hoje' : days === 1 ? 'Ontem' : `${days}d atrás`}
                            {ci.weight_kg != null && ` · ${ci.weight_kg} kg`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ci.adherence_pct != null && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ci.adherence_pct >= 80 ? 'text-emerald-600 bg-emerald-50' : ci.adherence_pct >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50'}`}>
                            {ci.adherence_pct}%
                          </span>
                        )}
                        {p && <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm text-xs">→</Link>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhum check-in registrado.</div>
            )}
          </div>
        </div>

        {/* ── Needs Attention ───────────────────────────────────────────────── */}
        {needsAttention.length > 0 && (
          <div className="card mt-6">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="card-title">Atenção: Sem check-in há 30+ dias</span>
              </div>
              <span className="badge badge-red">{needsAttention.length} paciente{needsAttention.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0 divide-x divide-y divide-gray-50">
              {needsAttention.slice(0, 9).map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium text-gray-700">{p.full_name}</span>
                  <div className="flex gap-1.5">
                    <Link href={`/pro/mensagens`} className="btn btn-outline btn-sm text-xs" title="Enviar mensagem">💬</Link>
                    <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm text-xs">→</Link>
                  </div>
                </div>
              ))}
            </div>
            {needsAttention.length > 9 && (
              <div className="px-5 py-2 text-xs text-gray-400 border-t">
                +{needsAttention.length - 9} outros · <Link href="/pro/pacientes" className="text-pgf-600 underline">Ver todos</Link>
              </div>
            )}
          </div>
        )}

        {/* ── Row 3: No-diary / Near-goals / Upcoming ──────────────────────── */}
        <div className={`grid gap-6 mt-6 ${nearCompletionGoals.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {/* Sem diário 7d */}
          {noRecentDiary.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="card-title">Sem diário há 7+ dias</span>
                </div>
                <span className="badge badge-orange text-[10px]">{noRecentDiary.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {noRecentDiary.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-sm font-medium text-gray-700">{p.full_name}</span>
                    <div className="flex gap-1.5">
                      {(p as {id: string; full_name: string; phone?: string | null}).phone && (
                        <a href={`https://wa.me/55${((p as {id: string; full_name: string; phone?: string | null}).phone ?? '').replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn btn-outline btn-sm text-xs"
                          style={{ color: '#6EE7B7', borderColor: 'rgba(16,185,129,0.25)' }}>
                          💬
                        </a>
                      )}
                      <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm text-xs">→</Link>
                    </div>
                  </div>
                ))}
              </div>
              {noRecentDiary.length > 6 && (
                <div className="px-5 py-2 text-xs text-gray-400 border-t">
                  +{noRecentDiary.length - 6} outros
                </div>
              )}
            </div>
          )}

          {/* Near-completion goals */}
          {nearCompletionGoals.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏆</span>
                  <span className="card-title">Metas quase atingidas</span>
                </div>
                <span className="badge badge-blue text-[10px]">{nearCompletionGoals.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {nearCompletionGoals.map(g => {
                  const start = g.start_value as number | null
                  const current = g.current_value as number | null
                  const target = g.target_value as number
                  const totalDelta = Math.abs(target - (start ?? target))
                  const progressDelta = current != null && start != null ? Math.abs(current - start) : 0
                  const pct = totalDelta > 0 ? Math.min(100, Math.round((progressDelta / totalDelta) * 100)) : 0
                  const patient = g.patients as unknown as { id: string; full_name: string } | null
                  return (
                    <div key={g.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <div className="text-xs font-semibold text-gray-800">{patient?.full_name}</div>
                          <div className="text-[11px] text-gray-500">{g.label}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-600">{pct}%</span>
                          {patient && <Link href={`/pro/pacientes/${patient.id}/metas`} className="btn btn-outline btn-sm text-[10px]">→</Link>}
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming consultations (next 7 days) */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="text-sm">📅</span>
                <span className="card-title">Próximas consultas</span>
              </div>
              <Link href="/pro/agenda" className="btn btn-outline btn-sm text-xs">Agenda</Link>
            </div>
            {upcomingConsultations && upcomingConsultations.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {upcomingConsultations.map(c => {
                  const dt = new Date(c.scheduled_at)
                  const patient = c.patient as unknown as { id: string; full_name: string } | null
                  const daysUntil = Math.floor((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{patient?.full_name ?? '—'}</div>
                        <div className="text-xs text-gray-400">
                          {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `em ${daysUntil} dias`}
                          {' · '}
                          {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {c.type === 'presencial' ? '🏥' : c.type === 'online' ? '💻' : '📞'}
                        </div>
                      </div>
                      {patient && <Link href={`/pro/pacientes/${patient.id}`} className="btn btn-outline btn-sm text-xs">→</Link>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Nenhuma consulta nos próximos 7 dias
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
