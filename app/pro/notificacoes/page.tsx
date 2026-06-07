import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function waLink(phone: string, message?: string) {
  const cleaned = phone.replace(/\D/g, '')
  const full = cleaned.startsWith('55') ? cleaned : `55${cleaned}`
  const encoded = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${full}${encoded}`
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00').getTime()) / (1000 * 60 * 60 * 24))
}

function daysUntil(dateStr: string) {
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00')
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default async function NotificacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const thirtyDaysFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const fourteenDaysFuture = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const sevenDaysFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

  const [
    { data: allPatients },
    { data: recentDiary },
    { data: recentCheckIns },
    { data: recentlyAchievedGoals },
    { data: nearDeadlineGoals },
    { data: upcomingConsultations },
    { data: birthdayPatients },
  ] = await Promise.all([
    supabase.from('patients').select('id, full_name, phone, auth_user_id, date_of_birth').eq('professional_id', user.id).eq('active', true),
    // Who logged in last 7 days (RLS filters to this professional's patients)
    supabase.from('diary_entries').select('patient_id, logged_at').gte('logged_at', sevenDaysAgo),
    // Who had a check-in in last 30 days
    supabase.from('anthropometric_records').select('patient_id, measured_at').eq('professional_id', user.id).gte('measured_at', thirtyDaysAgo),
    // Goals achieved in last 30 days
    supabase.from('patient_goals').select('id, label, metric, unit, target_value, achieved_at, patient_id, patients(id, full_name, phone)').eq('professional_id', user.id).eq('achieved', true).gte('achieved_at', thirtyDaysAgo).order('achieved_at', { ascending: false }).limit(10),
    // Goals with deadline in next 14 days (not yet achieved)
    supabase.from('patient_goals').select('id, label, metric, unit, target_value, current_value, start_value, deadline, patient_id, patients(id, full_name, phone)').eq('professional_id', user.id).eq('achieved', false).lte('deadline', fourteenDaysFuture).gte('deadline', today).order('deadline').limit(10),
    // Upcoming consultations next 7 days
    supabase.from('consultations').select('id, scheduled_at, type, status, duration_min, patient:patients(id, full_name, phone)').eq('professional_id', user.id).in('status', ['agendado', 'confirmado']).gt('scheduled_at', todayEnd.toISOString()).lte('scheduled_at', sevenDaysFuture).order('scheduled_at').limit(10),
    // Birthdays in next 30 days (rough calculation with month/day)
    supabase.from('patients').select('id, full_name, phone, date_of_birth').eq('professional_id', user.id).eq('active', true).not('date_of_birth', 'is', null),
  ])

  // Compute patients without recent diary (7+ days)
  const recentDiaryIds = new Set((recentDiary ?? []).map(d => d.patient_id))
  const noRecentDiary = (allPatients ?? []).filter(p => !recentDiaryIds.has(p.id))

  // Compute patients without recent diary 14+ days
  const recentDiary14 = (recentDiary ?? []).filter(d => d.logged_at >= fourteenDaysAgo)
  const recentDiary14Ids = new Set(recentDiary14.map(d => d.patient_id))
  const noRecentDiary14 = (allPatients ?? []).filter(p => !recentDiary14Ids.has(p.id))

  // Compute patients without check-in 30+ days
  const recentCheckInIds = new Set((recentCheckIns ?? []).map(r => r.patient_id))
  const noRecentCheckIn = (allPatients ?? []).filter(p => !recentCheckInIds.has(p.id))

  // Upcoming birthdays (next 30 days)
  const todayDate = new Date()
  const upcomingBirthdays = (birthdayPatients ?? [])
    .filter(p => {
      if (!p.date_of_birth) return false
      const [, bMonth, bDay] = p.date_of_birth.split('-').map(Number)
      // Create birthday date for current/next year
      let bd = new Date(todayDate.getFullYear(), bMonth - 1, bDay)
      if (bd < todayDate) bd = new Date(todayDate.getFullYear() + 1, bMonth - 1, bDay)
      const diff = Math.ceil((bd.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 30
    })
    .map(p => {
      const [, bMonth, bDay] = p.date_of_birth!.split('-').map(Number)
      let bd = new Date(todayDate.getFullYear(), bMonth - 1, bDay)
      if (bd < todayDate) bd = new Date(todayDate.getFullYear() + 1, bMonth - 1, bDay)
      const diff = Math.ceil((bd.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
      return { ...p, daysUntilBirthday: diff, birthdayDate: bd }
    })
    .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)

  const totalAlerts = noRecentDiary.length + noRecentCheckIn.length +
    (recentlyAchievedGoals?.length ?? 0) + (nearDeadlineGoals?.length ?? 0) +
    (upcomingBirthdays?.length ?? 0)

  function fmtDate(iso: string) {
    return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <h1 className="text-base font-bold text-white">🔔 Notificações & Follow-up</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {totalAlerts} item{totalAlerts !== 1 ? 'ns' : ''} pendente{totalAlerts !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/pro/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
      </div>

      <div className="p-8 space-y-6">

        {/* Summary strip */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Sem diário 7d', count: noRecentDiary.length, color: 'text-amber-400', icon: '📔' },
            { label: 'Sem check-in 30d', count: noRecentCheckIn.length, color: 'text-red-400', icon: '⚖️' },
            { label: 'Metas atingidas', count: recentlyAchievedGoals?.length ?? 0, color: 'text-emerald-400', icon: '🏆' },
            { label: 'Prazo de metas', count: nearDeadlineGoals?.length ?? 0, color: 'text-blue-400', icon: '⏰' },
            { label: 'Aniversários 30d', count: upcomingBirthdays.length, color: 'text-pink-400', icon: '🎂' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`text-2xl font-black ${s.color}`}>{s.count}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* ── Sem diário 7+ dias ──────────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="card-title">Sem diário há 7+ dias</span>
              </div>
              <span className="badge badge-orange">{noRecentDiary.length}</span>
            </div>
            {noRecentDiary.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">✓ Todos os pacientes com acesso registraram esta semana</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {noRecentDiary.slice(0, 8).map(p => {
                  const firstName = p.full_name.split(' ')[0]
                  const msg = `Olá, ${firstName}! 😊 Como está a alimentação esta semana? Que tal registrar suas refeições no app para acompanharmos juntos o seu progresso? 💪\n\n_Pedro Garrastazu Frey – Nutricionista_`
                  return (
                    <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.full_name}</div>
                        {!p.auth_user_id && (
                          <div className="text-[10px] text-gray-400">Sem acesso ao app</div>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {p.phone && (
                          <a href={waLink(p.phone, msg)} target="_blank" rel="noopener noreferrer"
                            className="btn btn-sm text-xs"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
                            💬 WA
                          </a>
                        )}
                        <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm text-xs">→</Link>
                      </div>
                    </div>
                  )
                })}
                {noRecentDiary.length > 8 && (
                  <div className="px-5 py-2 text-xs text-gray-400">+{noRecentDiary.length - 8} outros</div>
                )}
              </div>
            )}
          </div>

          {/* ── Sem check-in 30+ dias ───────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="card-title">Sem avaliação há 30+ dias</span>
              </div>
              <span className="badge badge-red">{noRecentCheckIn.length}</span>
            </div>
            {noRecentCheckIn.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">✓ Todos com avaliação recente</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {noRecentCheckIn.slice(0, 8).map(p => {
                  const firstName = p.full_name.split(' ')[0]
                  const msg = `Olá, ${firstName}! 😊 Está na hora de fazermos uma nova avaliação de peso e medidas para acompanhar sua evolução. Que tal agendarmos? 📅\n\n_Pedro Garrastazu Frey – Nutricionista_`
                  return (
                    <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="text-sm font-medium text-gray-900">{p.full_name}</div>
                      <div className="flex gap-1.5">
                        {p.phone && (
                          <a href={waLink(p.phone, msg)} target="_blank" rel="noopener noreferrer"
                            className="btn btn-sm text-xs"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
                            💬 WA
                          </a>
                        )}
                        <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm text-xs">→</Link>
                      </div>
                    </div>
                  )
                })}
                {noRecentCheckIn.length > 8 && (
                  <div className="px-5 py-2 text-xs text-gray-400">+{noRecentCheckIn.length - 8} outros</div>
                )}
              </div>
            )}
          </div>

          {/* ── Metas atingidas recentemente ────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="text-sm">🏆</span>
                <span className="card-title">Metas atingidas (últimos 30 dias)</span>
              </div>
              <span className="badge badge-green">{recentlyAchievedGoals?.length ?? 0}</span>
            </div>
            {!recentlyAchievedGoals || recentlyAchievedGoals.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">Nenhuma meta atingida recentemente</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentlyAchievedGoals.map(g => {
                  const patient = g.patients as unknown as { id: string; full_name: string; phone: string | null } | null
                  const firstName = patient?.full_name?.split(' ')[0] ?? ''
                  const metricLabels: Record<string, string> = {
                    peso: 'peso', gordura: 'gordura corporal', massa: 'massa muscular',
                    cintura: 'cintura', imc: 'IMC', custom: 'meta',
                  }
                  const metricLabel = metricLabels[g.metric] ?? g.metric
                  const msg = `Parabéns, ${firstName}! 🏆🎉 Você atingiu sua meta de ${metricLabel}: ${g.target_value}${g.unit ?? ''}! Incrível conquista! Continue assim! 💪\n\n_Pedro Garrastazu Frey – Nutricionista_`
                  return (
                    <div key={g.id} className="flex items-center justify-between px-5 py-2.5">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{patient?.full_name}</div>
                        <div className="text-xs text-gray-400">
                          {g.label} · {g.target_value}{g.unit ?? ''} · atingida em {g.achieved_at ? fmtDate(g.achieved_at.split('T')[0]) : '—'}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {patient?.phone && (
                          <a href={waLink(patient.phone, msg)} target="_blank" rel="noopener noreferrer"
                            className="btn btn-sm text-xs"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
                            🎉 WA
                          </a>
                        )}
                        {patient && <Link href={`/pro/pacientes/${patient.id}/metas`} className="btn btn-outline btn-sm text-xs">→</Link>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Prazo de metas se aproximando ───────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="text-sm">⏰</span>
                <span className="card-title">Metas com prazo nos próximos 14 dias</span>
              </div>
              <span className="badge badge-blue">{nearDeadlineGoals?.length ?? 0}</span>
            </div>
            {!nearDeadlineGoals || nearDeadlineGoals.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">Nenhuma meta com prazo próximo</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {nearDeadlineGoals.map(g => {
                  const patient = g.patients as unknown as { id: string; full_name: string; phone: string | null } | null
                  const start = g.start_value as number | null
                  const current = g.current_value as number | null
                  const target = g.target_value as number
                  const totalDelta = Math.abs(target - (start ?? target))
                  const progressDelta = current != null && start != null ? Math.abs(current - start) : 0
                  const pct = totalDelta > 0 ? Math.min(100, Math.round((progressDelta / totalDelta) * 100)) : 0
                  const days = g.deadline ? daysUntil(g.deadline) : null
                  const firstName = patient?.full_name?.split(' ')[0] ?? ''
                  const msg = `Olá, ${firstName}! 💪 O prazo da sua meta (${g.label}) está chegando! Você está a ${pct}% do seu objetivo de ${target}${g.unit ?? ''}. Vamos acelerar? 🚀\n\n_Pedro Garrastazu Frey – Nutricionista_`
                  return (
                    <div key={g.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{patient?.full_name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-2">
                            <span>{g.label} · {target}{g.unit ?? ''}</span>
                            {days !== null && (
                              <span className={`font-semibold ${days <= 3 ? 'text-red-500' : days <= 7 ? 'text-amber-500' : 'text-blue-500'}`}>
                                {days === 0 ? 'Hoje!' : days === 1 ? 'Amanhã' : `em ${days} dias`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-600">{pct}%</span>
                          {patient?.phone && (
                            <a href={waLink(patient.phone, msg)} target="_blank" rel="noopener noreferrer"
                              className="btn btn-sm text-xs"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
                              💬
                            </a>
                          )}
                          {patient && <Link href={`/pro/pacientes/${patient.id}/metas`} className="btn btn-outline btn-sm text-xs">→</Link>}
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Próximas consultas ──────────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="text-sm">📅</span>
                <span className="card-title">Consultas — próximos 7 dias</span>
              </div>
              <Link href="/pro/agenda" className="btn btn-outline btn-sm text-xs">Agenda completa</Link>
            </div>
            {!upcomingConsultations || upcomingConsultations.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">Nenhuma consulta nos próximos 7 dias</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingConsultations.map(c => {
                  const dt = new Date(c.scheduled_at)
                  const patient = c.patient as unknown as { id: string; full_name: string; phone: string | null } | null
                  const days = Math.floor((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  const firstName = patient?.full_name?.split(' ')[0] ?? ''
                  const dateLabel = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                  const timeLabel = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const typeLabel = c.type === 'presencial' ? 'presencial' : c.type === 'online' ? 'online' : 'por telefone'
                  const msg = `Olá, ${firstName}! 😊 Lembrando que temos consulta ${typeLabel} marcada para ${dateLabel} às ${timeLabel}. Confirma? 📅\n\n_Pedro Garrastazu Frey – Nutricionista_`
                  return (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{patient?.full_name ?? '—'}</div>
                        <div className="text-xs text-gray-400">
                          {days === 0 ? 'Amanhã' : `em ${days} dias`} ·{' '}
                          {dt.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} às{' '}
                          {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                          {c.type === 'presencial' ? '🏥' : c.type === 'online' ? '💻' : '📞'}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {patient?.phone && (
                          <a href={waLink(patient.phone, msg)} target="_blank" rel="noopener noreferrer"
                            className="btn btn-sm text-xs"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
                            ✓ Confirmar
                          </a>
                        )}
                        {patient && <Link href={`/pro/pacientes/${patient.id}`} className="btn btn-outline btn-sm text-xs">→</Link>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Aniversários próximos ───────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎂</span>
                <span className="card-title">Aniversários nos próximos 30 dias</span>
              </div>
              {upcomingBirthdays.length > 0 && <span className="badge badge-orange">{upcomingBirthdays.length}</span>}
            </div>
            {upcomingBirthdays.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">Nenhum aniversariante nos próximos 30 dias</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingBirthdays.map(p => {
                  const firstName = p.full_name.split(' ')[0]
                  const msg = `Feliz aniversário, ${firstName}! 🎂🎉 Desejo que este novo ciclo seja cheio de saúde, conquistas e muito bem-estar! Continue arrasando! 🌟\n\n_Pedro Garrastazu Frey – Nutricionista_`
                  return (
                    <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {p.full_name}
                          {p.daysUntilBirthday === 0 && <span className="text-xs font-bold text-pink-500 animate-pulse">🎉 Hoje!</span>}
                        </div>
                        <div className="text-xs text-gray-400">
                          {p.daysUntilBirthday === 0
                            ? 'Hoje é o aniversário!'
                            : p.daysUntilBirthday === 1
                              ? 'Amanhã!'
                              : `em ${p.daysUntilBirthday} dias`
                          } · {p.birthdayDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {p.phone && (
                          <a href={waLink(p.phone, msg)} target="_blank" rel="noopener noreferrer"
                            className="btn btn-sm text-xs"
                            style={{ background: 'rgba(236,72,153,0.1)', color: '#f9a8d4', border: '1px solid rgba(236,72,153,0.2)' }}>
                            🎂 WA
                          </a>
                        )}
                        <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm text-xs">→</Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sem diário 14+ dias — more urgent subset */}
        {noRecentDiary14.length > 0 && (
          <div className="card border-amber-200">
            <div className="card-header" style={{ background: 'rgba(245,158,11,0.05)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="card-title text-amber-700">Sem registro há 14+ dias — atenção urgente</span>
              </div>
              <span className="badge badge-orange font-bold">{noRecentDiary14.length}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0 divide-x divide-y divide-gray-50">
              {noRecentDiary14.slice(0, 6).map(p => {
                const firstName = p.full_name.split(' ')[0]
                const msg = `Olá, ${firstName}! 😊 Percebi que faz alguns dias que você não registra suas refeições. Tudo bem? Estou aqui para te apoiar! 💚\n\n_Pedro Garrastazu Frey – Nutricionista_`
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm font-medium text-gray-700">{p.full_name}</span>
                    <div className="flex gap-1.5">
                      {p.phone && (
                        <a href={waLink(p.phone, msg)} target="_blank" rel="noopener noreferrer"
                          className="btn btn-sm text-xs"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
                          💬
                        </a>
                      )}
                      <Link href={`/pro/pacientes/${p.id}`} className="btn btn-outline btn-sm text-xs">→</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
