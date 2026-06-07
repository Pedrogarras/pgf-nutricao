import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function waLink(phone: string) {
  const d = phone.replace(/\D/g, '')
  const n = d.startsWith('55') ? d : `55${d}`
  return `https://wa.me/${n}`
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

/* ─── Cell component (server-side rendered as inline style) ──────────────── */
function Cell({
  kcal, targetKcal, hasEntry,
}: {
  kcal: number; targetKcal: number | null; hasEntry: boolean
}) {
  if (!hasEntry) return (
    <div className="w-full h-9 rounded-lg flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 12 }}>—</span>
    </div>
  )

  const pct = targetKcal && targetKcal > 0 ? (kcal / targetKcal) * 100 : null
  const bg = pct == null
    ? 'rgba(37,99,235,0.25)'
    : pct >= 90 && pct <= 115
      ? 'rgba(74,222,128,0.25)'
      : pct > 115
        ? 'rgba(248,113,113,0.25)'
        : 'rgba(251,191,36,0.25)'
  const border = pct == null
    ? 'rgba(37,99,235,0.4)'
    : pct >= 90 && pct <= 115
      ? 'rgba(74,222,128,0.4)'
      : pct > 115
        ? 'rgba(248,113,113,0.4)'
        : 'rgba(251,191,36,0.4)'
  const textColor = pct == null
    ? '#93C5FD'
    : pct >= 90 && pct <= 115
      ? '#4ADE80'
      : pct > 115
        ? '#F87171'
        : '#FCD34D'

  return (
    <div className="w-full h-9 rounded-lg flex flex-col items-center justify-center"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="text-[10px] font-black leading-none" style={{ color: textColor }}>
        {kcal >= 1000 ? `${(kcal / 1000).toFixed(1)}k` : Math.round(kcal)}
      </span>
      {pct != null && (
        <span className="text-[8px] leading-none mt-0.5" style={{ color: textColor, opacity: 0.7 }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default async function ProSemanaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Build 7-day window ─────────────────────────────────────────────
  const today = new Date()
  const dayWindow: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    dayWindow.push(d.toISOString().split('T')[0])
  }
  const weekStart = dayWindow[0]
  const weekEnd   = dayWindow[6]

  // ── Fetch data ─────────────────────────────────────────────────────
  const [
    { data: patients },
    { data: diaryEntries },
    { data: activePlans },
    { data: checkIns },
  ] = await Promise.all([
    supabase.from('patients')
      .select('id, full_name, phone, auth_user_id')
      .eq('professional_id', user.id)
      .eq('active', true)
      .order('full_name'),

    supabase.from('diary_entries')
      .select('patient_id, logged_at, total_kcal')
      .gte('logged_at', weekStart)
      .lte('logged_at', weekEnd),

    // Get target kcal from active plans (one per patient)
    supabase.from('diet_plans')
      .select('patient_id, target_kcal, kcal_goal')
      .eq('professional_id', user.id)
      .eq('active', true)
      .not('published_at', 'is', null),

    // Check-ins this week
    supabase.from('anthropometric_records')
      .select('patient_id, measured_at, weight_kg, adherence_pct')
      .eq('professional_id', user.id)
      .gte('measured_at', weekStart)
      .lte('measured_at', weekEnd),
  ])

  const allPatients = patients ?? []

  // ── Index diary entries: patient_id → date → { kcal, count } ──────
  type DayData = { kcal: number; meals: number }
  const diaryMap = new Map<string, Map<string, DayData>>()
  for (const entry of (diaryEntries ?? [])) {
    const date = (entry.logged_at as string).split('T')[0]
    if (!diaryMap.has(entry.patient_id)) diaryMap.set(entry.patient_id, new Map())
    const dayMap = diaryMap.get(entry.patient_id)!
    const existing = dayMap.get(date) ?? { kcal: 0, meals: 0 }
    existing.kcal  += entry.total_kcal ?? 0
    existing.meals += 1
    dayMap.set(date, existing)
  }

  // ── Index plan targets: patient_id → kcal ─────────────────────────
  const planTargetMap = new Map<string, number>()
  for (const plan of (activePlans ?? [])) {
    const target = plan.target_kcal ?? plan.kcal_goal ?? null
    if (target && !planTargetMap.has(plan.patient_id)) {
      planTargetMap.set(plan.patient_id, target)
    }
  }

  // ── Index check-ins this week: patient_id → true ──────────────────
  const checkinThisWeek = new Set((checkIns ?? []).map(c => c.patient_id))

  // ── Compute per-patient stats ──────────────────────────────────────
  const patientStats = allPatients.map(p => {
    const dayMap = diaryMap.get(p.id)
    const targetKcal = planTargetMap.get(p.id) ?? null
    const days = dayWindow.map(date => {
      const d = dayMap?.get(date)
      return { date, kcal: d?.kcal ?? 0, meals: d?.meals ?? 0, hasEntry: !!d }
    })
    const loggedCount    = days.filter(d => d.hasEntry).length
    const loggedToday    = days[days.length - 1].hasEntry
    const totalKcal      = days.reduce((s, d) => s + d.kcal, 0)
    const loggedDays     = days.filter(d => d.hasEntry)
    const avgKcal        = loggedDays.length > 0 ? totalKcal / loggedDays.length : 0
    const hasApp         = !!p.auth_user_id
    const hasCheckin     = checkinThisWeek.has(p.id)
    const adherenceScore = loggedCount / 7 * 100

    // Color bucket for row
    const rowAlert = !loggedToday ? 'no_today' : loggedCount <= 2 ? 'low' : loggedCount <= 4 ? 'medium' : 'good'

    return { ...p, days, loggedCount, loggedToday, avgKcal, targetKcal, hasApp, hasCheckin, adherenceScore, rowAlert }
  })

  // ── Sort: no-today first, then by logged count asc ────────────────
  patientStats.sort((a, b) => {
    if (!a.loggedToday && b.loggedToday) return -1
    if (a.loggedToday && !b.loggedToday) return 1
    return a.loggedCount - b.loggedCount
  })

  // ── Summary counts ────────────────────────────────────────────────
  const loggedToday   = patientStats.filter(p => p.loggedToday).length
  const loggedWeek5p  = patientStats.filter(p => p.loggedCount >= 5).length
  const hasAppCount   = patientStats.filter(p => p.hasApp).length
  const avgAdherence  = patientStats.length > 0
    ? Math.round(patientStats.reduce((s, p) => s + p.adherenceScore, 0) / patientStats.length)
    : 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-6 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/pro/dashboard"
          className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Dashboard
        </Link>
        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="text-sm font-black text-white">📅 Semana</span>
        <div className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {new Date(weekStart + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          {' – '}
          {new Date(weekEnd + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </div>
        <div className="flex-1" />
        <Link href="/pro/notificacoes"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.2)' }}>
          Follow-up
        </Link>
      </div>

      <div className="px-6 py-5">

        {/* ── KPI strip ───────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Registraram hoje', value: `${loggedToday}/${allPatients.length}`, color: loggedToday / allPatients.length >= 0.5 ? '#4ADE80' : '#F87171', icon: '📔' },
            { label: '≥5 dias na semana', value: `${loggedWeek5p}/${allPatients.length}`, color: '#60A5FA', icon: '🔥' },
            { label: 'Aderência média', value: `${avgAdherence}%`, color: avgAdherence >= 70 ? '#4ADE80' : avgAdherence >= 45 ? '#FBBF24' : '#F87171', icon: '📊' },
            { label: 'Com acesso ao app', value: `${hasAppCount}/${allPatients.length}`, color: '#A78BFA', icon: '📱' },
          ].map(k => (
            <div key={k.label} className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-2xl">{k.icon}</span>
              <div>
                <div className="text-xl font-black" style={{ color: k.color }}>{k.value}</div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Legend ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-4 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <span className="font-bold uppercase tracking-widest">Legenda:</span>
          {[
            { color: 'rgba(74,222,128,0.25)', border: 'rgba(74,222,128,0.4)', label: '✓ Na meta (90–115%)' },
            { color: 'rgba(251,191,36,0.25)',  border: 'rgba(251,191,36,0.4)',  label: '↓ Abaixo da meta' },
            { color: 'rgba(248,113,113,0.25)', border: 'rgba(248,113,113,0.4)', label: '↑ Acima da meta' },
            { color: 'rgba(37,99,235,0.25)',   border: 'rgba(37,99,235,0.4)',   label: 'Registrado (sem meta)' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded" style={{ background: l.color, border: `1px solid ${l.border}` }} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── Grid table ──────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Column headers */}
          <div className="grid gap-2 px-4 py-2 sticky top-14 z-30"
            style={{
              gridTemplateColumns: '200px repeat(7, 1fr) 60px 60px',
              background: 'rgba(6,6,10,0.95)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
            <div className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Paciente</div>
            {dayWindow.map(date => (
              <div key={date} className="text-center">
                <div className="text-[10px] font-bold capitalize"
                  style={{ color: isToday(date) ? '#93C5FD' : 'rgba(255,255,255,0.5)' }}>
                  {new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {new Date(date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>
                {isToday(date) && (
                  <div className="w-1 h-1 rounded-full bg-blue-400 mx-auto mt-0.5" />
                )}
              </div>
            ))}
            <div className="text-[10px] font-bold text-center uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Dias</div>
            <div className="text-[10px] font-bold text-center uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Ação</div>
          </div>

          {/* Patient rows */}
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {patientStats.map(p => (
              <div key={p.id}
                className="grid gap-2 px-4 py-2 items-center transition-all hover:bg-white/[0.02]"
                style={{ gridTemplateColumns: '200px repeat(7, 1fr) 60px 60px' }}>

                {/* Patient name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-shrink-0">
                    {!p.loggedToday ? (
                      <div className="w-2 h-2 rounded-full" style={{ background: '#F87171' }} />
                    ) : p.loggedCount >= 5 ? (
                      <div className="w-2 h-2 rounded-full" style={{ background: '#4ADE80' }} />
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ background: '#FBBF24' }} />
                    )}
                  </div>
                  <Link href={`/pro/pacientes/${p.id}`}
                    className="text-xs font-semibold truncate transition-all hover:text-blue-400"
                    style={{ color: p.loggedToday ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)' }}>
                    {p.full_name}
                  </Link>
                  {p.hasCheckin && (
                    <span className="text-[9px] flex-shrink-0" title="Check-in esta semana">⚖️</span>
                  )}
                </div>

                {/* Day cells */}
                {p.days.map(day => (
                  <Link key={day.date} href={`/pro/pacientes/${p.id}/diario`} title={day.hasEntry ? `${Math.round(day.kcal)} kcal` : 'Sem registro'}>
                    <Cell kcal={day.kcal} targetKcal={p.targetKcal} hasEntry={day.hasEntry} />
                  </Link>
                ))}

                {/* Days logged */}
                <div className="text-center">
                  <span className="text-sm font-black"
                    style={{
                      color: p.loggedCount >= 5 ? '#4ADE80' : p.loggedCount >= 3 ? '#FBBF24' : '#F87171',
                    }}>
                    {p.loggedCount}
                    <span className="text-[9px] font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>/7</span>
                  </span>
                </div>

                {/* WhatsApp quick action */}
                <div className="flex justify-center">
                  {p.phone ? (
                    <a href={waLink(p.phone)} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all hover:scale-110"
                      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}
                      title="WhatsApp">
                      💬
                    </a>
                  ) : (
                    <div className="w-7 h-7" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Empty state ──────────────────────────────────────────── */}
        {allPatients.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <div className="text-white font-bold text-lg">Nenhum paciente ativo</div>
            <Link href="/pro/pacientes" className="mt-4 inline-block text-sm text-pgf-600 hover:underline">
              Cadastrar primeiro paciente →
            </Link>
          </div>
        )}

        {/* ── Footer tip ──────────────────────────────────────────── */}
        {allPatients.length > 0 && (
          <div className="mt-4 text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Clique em uma célula para ver o diário do paciente naquele dia · Clique no nome para abrir o perfil
          </div>
        )}
      </div>
    </div>
  )
}
