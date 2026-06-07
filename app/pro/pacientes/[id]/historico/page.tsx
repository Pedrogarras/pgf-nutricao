import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type TimelineEvent = {
  id: string
  date: string
  type: 'consulta' | 'medicao' | 'nota' | 'exame' | 'plano' | 'diario' | 'suplemento' | 'meta' | 'foto' | 'acesso'
  title: string
  subtitle?: string
  badge?: string
  badgeColor?: string
  link?: string
  data?: Record<string, unknown>
}

function r(n: number) { return Math.round(n * 10) / 10 }

export default async function HistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [
    { data: patient },
    { data: consultations },
    { data: records },
    { data: notes },
    { data: labResults },
    { data: plans },
    { data: diaryDays },
    { data: goals },
    { data: photoCount },
  ] = await Promise.all([
    supabase.from('patients').select('id, full_name').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('consultations').select('*').eq('patient_id', id).eq('professional_id', user.id).order('scheduled_at', { ascending: false }),
    supabase.from('anthropometric_records').select('*').eq('patient_id', id).order('measured_at', { ascending: false }),
    supabase.from('patient_notes').select('*').eq('patient_id', id).eq('professional_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('lab_results').select('id, date, exam_name, value, unit, status, panel_name').eq('patient_id', id).eq('professional_id', user.id).order('date', { ascending: false }),
    supabase.from('diet_plans').select('id, title, active, published_at, created_at').eq('patient_id', id).eq('professional_id', user.id).order('created_at', { ascending: false }),
    supabase.from('diary_entries').select('logged_at, total_kcal, adherence_score').eq('patient_id', id).order('logged_at', { ascending: false }).limit(30),
    supabase.from('patient_goals').select('id, label, metric, target_value, current_value, unit, achieved, created_at, deadline').eq('patient_id', id).eq('professional_id', user.id).order('created_at', { ascending: false }),
    supabase.from('progress_photos').select('id', { count: 'exact', head: true }).eq('patient_id', id),
  ])

  if (!patient) redirect('/pro/pacientes')

  const events: TimelineEvent[] = []

  // Consultations
  for (const c of consultations ?? []) {
    const statusColors: Record<string, string> = {
      realizado: '#4ADE80', confirmado: '#60A5FA', agendado: '#93C5FD',
      cancelado: '#F87171', faltou: '#FCD34D',
    }
    const typeLabels: Record<string, string> = { presencial: '🏥', online: '💻', telefone: '📞' }
    events.push({
      id: `consulta-${c.id}`,
      date: c.scheduled_at.split('T')[0],
      type: 'consulta',
      title: `${typeLabels[c.type] ?? '📅'} Consulta ${c.type}`,
      subtitle: c.notes ?? undefined,
      badge: c.status.charAt(0).toUpperCase() + c.status.slice(1),
      badgeColor: statusColors[c.status] ?? '#93C5FD',
      data: { duration_min: c.duration_min, time: new Date(c.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
    })
  }

  // Anthropometric records
  const sortedRecords = [...(records ?? [])].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  for (let i = 0; i < (records ?? []).length; i++) {
    const rec = (records ?? [])[i]
    const prevRec = sortedRecords.find(r2 => r2.measured_at < rec.measured_at && r2.weight_kg != null)
    const delta = rec.weight_kg && prevRec?.weight_kg ? r(rec.weight_kg - prevRec.weight_kg) : null
    const parts = []
    if (rec.weight_kg != null) parts.push(`${rec.weight_kg}kg`)
    if (rec.body_fat_pct != null) parts.push(`${rec.body_fat_pct}% gordura`)
    if (rec.muscle_mass_kg != null) parts.push(`${rec.muscle_mass_kg}kg massa`)
    events.push({
      id: `medicao-${rec.id}`,
      date: rec.measured_at.split('T')[0],
      type: 'medicao',
      title: '📏 Avaliação Antropométrica',
      subtitle: parts.join(' · '),
      badge: delta != null ? (delta <= 0 ? `${delta}kg ↓` : `+${delta}kg`) : undefined,
      badgeColor: delta != null ? (delta <= 0 ? '#4ADE80' : '#F87171') : undefined,
      link: `/pro/pacientes/${id}/medidas`,
      data: { ...rec },
    })
  }

  // Patient notes
  const catColors: Record<string, string> = {
    geral: '#93C5FD', consulta: '#60A5FA', avaliacao: '#4ADE80',
    laboratorio: '#A78BFA', intercorrencia: '#F87171', observacao: '#FCD34D',
  }
  for (const note of notes ?? []) {
    events.push({
      id: `nota-${note.id}`,
      date: note.date,
      type: 'nota',
      title: `📝 ${note.title || 'Nota clínica'}`,
      subtitle: note.content.length > 120 ? note.content.slice(0, 120) + '...' : note.content,
      badge: note.category.charAt(0).toUpperCase() + note.category.slice(1),
      badgeColor: catColors[note.category] ?? '#93C5FD',
      link: `/pro/pacientes/${id}/notas`,
    })
  }

  // Lab results — group by date
  const labByDate: Record<string, typeof labResults extends null ? never : (typeof labResults)[0][]> = {}
  for (const lr of labResults ?? []) {
    if (!labByDate[lr.date]) labByDate[lr.date] = []
    labByDate[lr.date].push(lr)
  }
  for (const [date, dayResults] of Object.entries(labByDate)) {
    const abnormal = dayResults.filter(r2 => r2.status && r2.status !== 'normal')
    const panels = Array.from(new Set(dayResults.map(r2 => r2.panel_name).filter(Boolean)))
    events.push({
      id: `exame-${date}`,
      date,
      type: 'exame',
      title: `🔬 Exames laboratoriais`,
      subtitle: `${dayResults.length} exames${panels.length > 0 ? ` · ${panels.join(', ')}` : ''}`,
      badge: abnormal.length > 0 ? `${abnormal.length} alterados` : 'Dentro do normal',
      badgeColor: abnormal.length > 0 ? '#F87171' : '#4ADE80',
      link: `/pro/pacientes/${id}/exames`,
    })
  }

  // Diet plans — created/published
  for (const plan of plans ?? []) {
    if (plan.published_at) {
      events.push({
        id: `plano-pub-${plan.id}`,
        date: plan.published_at.split('T')[0],
        type: 'plano',
        title: `🍽️ Plano alimentar publicado`,
        subtitle: plan.title ?? 'Sem título',
        badge: plan.active ? 'Ativo' : 'Inativo',
        badgeColor: plan.active ? '#4ADE80' : 'rgba(255,255,255,0.3)',
        link: `/pro/pacientes/${id}/dieta?plan=${plan.id}`,
      })
    }
    events.push({
      id: `plano-create-${plan.id}`,
      date: plan.created_at.split('T')[0],
      type: 'plano',
      title: `📋 Plano alimentar criado`,
      subtitle: plan.title ?? 'Sem título',
      badge: undefined,
      link: `/pro/pacientes/${id}/dieta?plan=${plan.id}`,
    })
  }

  // Diary entries — group by day
  const diaryByDate: Record<string, { count: number; kcal: number; score: number | null }> = {}
  for (const d of diaryDays ?? []) {
    if (!diaryByDate[d.logged_at]) diaryByDate[d.logged_at] = { count: 0, kcal: 0, score: null }
    diaryByDate[d.logged_at].count++
    diaryByDate[d.logged_at].kcal += Number(d.total_kcal ?? 0)
    if (d.adherence_score != null) diaryByDate[d.logged_at].score = d.adherence_score
  }
  for (const [date, day] of Object.entries(diaryByDate)) {
    events.push({
      id: `diario-${date}`,
      date,
      type: 'diario',
      title: `📔 Diário alimentar registrado`,
      subtitle: `${day.count} refeição(ões) · ${Math.round(day.kcal)} kcal`,
      badge: day.score != null ? `${day.score}% aderência` : undefined,
      badgeColor: day.score != null ? (day.score >= 80 ? '#4ADE80' : day.score >= 60 ? '#FCD34D' : '#F87171') : undefined,
      link: `/pro/pacientes/${id}/diario`,
    })
  }

  // Goals — created
  for (const goal of goals ?? []) {
    events.push({
      id: `meta-${goal.id}`,
      date: goal.created_at.split('T')[0],
      type: 'meta',
      title: `🎯 Meta definida: ${goal.label}`,
      subtitle: `Alvo: ${goal.target_value}${goal.unit ?? ''}${goal.deadline ? ` · Prazo: ${new Date(goal.deadline + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}` : ''}`,
      badge: goal.achieved ? 'Alcançada ✓' : 'Em progresso',
      badgeColor: goal.achieved ? '#4ADE80' : 'rgba(255,255,255,0.35)',
      link: `/pro/pacientes/${id}/metas`,
    })
  }

  // Sort all events by date descending
  events.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  // Group by month
  const byMonth: Record<string, TimelineEvent[]> = {}
  for (const ev of events) {
    const m = ev.date.slice(0, 7)
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(ev)
  }

  const TYPE_ICONS: Record<string, string> = {
    consulta: '📅', medicao: '📏', nota: '📝', exame: '🔬',
    plano: '🍽️', diario: '📔', suplemento: '💊', meta: '🎯', foto: '📸', acesso: '🔑',
  }
  const TYPE_COLORS: Record<string, string> = {
    consulta: '#60A5FA', medicao: '#4ADE80', nota: '#A78BFA', exame: '#F59E0B',
    plano: '#34D399', diario: '#FCD34D', meta: '#FB923C', suplemento: '#C084FC',
  }

  return (
    <div>
      <div className="sticky top-0 z-40 flex items-center gap-2 px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <Link href="/pro/pacientes" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>Pacientes</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <Link href={`/pro/pacientes/${id}`} className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>{patient.full_name}</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-xs font-semibold text-white">Histórico</span>
      </div>

      <div className="p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Clínico</div>
            <h1 className="text-2xl font-black text-white tracking-tight">🗓️ Histórico Clínico</h1>
            {events.length > 0 && (
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {events.length} eventos · {Object.keys(byMonth).length} meses
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-8">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </div>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
            <div className="text-4xl mb-3">📋</div>
            <div className="text-white font-semibold">Nenhum evento registrado</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              O histórico aparecerá aqui conforme você registrar consultas, avaliações e outros eventos
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byMonth)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([month, monthEvents]) => {
                const [year, m] = month.split('-')
                const monthName = new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

                return (
                  <div key={month}>
                    {/* Month separator */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-xs font-bold tracking-[2px] uppercase capitalize" style={{ color: 'rgba(255,255,255,0.25)' }}>{monthName}</div>
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{monthEvents.length} eventos</div>
                    </div>

                    {/* Timeline entries */}
                    <div className="relative space-y-3 pl-6">
                      {/* Vertical line */}
                      <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                      {monthEvents.map(ev => {
                        const typeColor = TYPE_COLORS[ev.type] ?? '#93C5FD'
                        const content = (
                          <div className="flex items-start gap-3 p-4 rounded-xl transition-all"
                            style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
                            onMouseEnter={ev.link ? (e => (e.currentTarget.style.borderColor = `${typeColor}33`) ) : undefined}
                            onMouseLeave={ev.link ? (e => (e.currentTarget.style.borderColor = 'var(--dark-border)') ) : undefined}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-semibold text-white leading-tight">{ev.title}</div>
                                <div className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                  {new Date(ev.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                  {ev.data && 'time' in ev.data && ` · ${ev.data.time}`}
                                </div>
                              </div>
                              {ev.subtitle && (
                                <div className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  {ev.subtitle}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {ev.badge && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                    style={{ background: `${ev.badgeColor}18`, color: ev.badgeColor }}>
                                    {ev.badge}
                                  </span>
                                )}
                                {ev.type === 'medicao' && ev.data && (
                                  <>
                                    {(ev.data as { weight_kg?: number }).weight_kg != null && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
                                        {(ev.data as { weight_kg: number }).weight_kg} kg
                                      </span>
                                    )}
                                    {(ev.data as { body_fat_pct?: number }).body_fat_pct != null && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
                                        {(ev.data as { body_fat_pct: number }).body_fat_pct}% gord
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )

                        return (
                          <div key={ev.id} className="relative">
                            {/* Dot */}
                            <div className="absolute -left-4 top-5 w-2.5 h-2.5 rounded-full border-2 border-current flex-shrink-0"
                              style={{ borderColor: typeColor, background: 'var(--dark-bg)' }} />

                            {ev.link ? (
                              <Link href={ev.link}>{content}</Link>
                            ) : content}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
