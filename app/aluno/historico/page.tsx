import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function r(n: number, d = 1) { return Math.round(n * 10 ** d) / 10 ** d }

function fmtDate(iso: string) {
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDateShort(iso: string) {
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function daysAgo(iso: string) {
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00')
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff < 30) return `${diff}d atrás`
  if (diff < 365) return `${Math.floor(diff / 30)} mes${Math.floor(diff / 30) === 1 ? '' : 'es'} atrás`
  const years = Math.floor(diff / 365)
  return `${years} ano${years === 1 ? '' : 's'} atrás`
}

interface TimelineItem {
  id: string
  date: string
  dateForSort: string
  type: 'medida' | 'meta' | 'consulta' | 'diario_start' | 'foto' | 'plano' | 'meta_achieved' | 'milestone'
  title: string
  subtitle?: string
  detail?: string
  icon: string
  color: string
  border: string
  bg: string
  badge?: string
  badgeColor?: string
}

export default async function AlunoHistoricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, created_at')
    .eq('auth_user_id', user.id)
    .single()

  if (!patient) redirect('/aluno')

  const [
    { data: records },
    { data: goals },
    { data: consultations },
    { data: photoCount },
    { data: plans },
    { data: diaryDays },
  ] = await Promise.all([
    supabase.from('anthropometric_records')
      .select('id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, adherence_pct')
      .eq('patient_id', patient.id)
      .order('measured_at'),
    supabase.from('patient_goals')
      .select('id, label, metric, unit, target_value, current_value, achieved, achieved_at, created_at, deadline')
      .eq('patient_id', patient.id)
      .order('created_at'),
    supabase.from('consultations')
      .select('id, scheduled_at, type, status, notes, duration_min')
      .eq('patient_id', patient.id)
      .in('status', ['realizado', 'confirmado', 'agendado'])
      .order('scheduled_at', { ascending: false })
      .limit(20),
    supabase.from('progress_photos')
      .select('id, taken_at, category, weight_kg')
      .eq('patient_id', patient.id)
      .order('taken_at', { ascending: false })
      .limit(10),
    supabase.from('diet_plans')
      .select('id, title, published_at, active')
      .eq('patient_id', patient.id)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(5),
    supabase.from('diary_entries')
      .select('logged_at')
      .eq('patient_id', patient.id)
      .order('logged_at')
      .limit(1),
  ])

  const items: TimelineItem[] = []

  // Account creation milestone
  if (patient.created_at) {
    items.push({
      id: 'join',
      date: fmtDate(patient.created_at),
      dateForSort: patient.created_at,
      type: 'milestone',
      title: '🎉 Início da jornada',
      subtitle: 'Você começou seu acompanhamento nutricional',
      icon: '🌱',
      color: '#4ade80',
      border: 'rgba(74,222,128,0.3)',
      bg: 'rgba(74,222,128,0.07)',
      badge: 'Marco',
      badgeColor: '#4ade80',
    })
  }

  // First diary entry
  if (diaryDays && diaryDays.length > 0) {
    const firstLog = diaryDays[0].logged_at
    items.push({
      id: 'first-diary',
      date: fmtDate(firstLog),
      dateForSort: firstLog,
      type: 'diario_start',
      title: '📔 Primeiro registro no diário',
      subtitle: fmtDateShort(firstLog),
      icon: '📔',
      color: '#93C5FD',
      border: 'rgba(147,197,253,0.25)',
      bg: 'rgba(147,197,253,0.06)',
    })
  }

  // Anthropometric records
  const sortedRecs = [...(records ?? [])].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  sortedRecs.forEach((rec, i) => {
    const prev = i > 0 ? sortedRecs[i - 1] : null
    const weightDelta = rec.weight_kg && prev?.weight_kg ? r(rec.weight_kg - prev.weight_kg) : null
    const fatDelta = rec.body_fat_pct && prev?.body_fat_pct ? r(rec.body_fat_pct - prev.body_fat_pct) : null

    let subtitle = ''
    if (rec.weight_kg) subtitle += `${rec.weight_kg} kg`
    if (weightDelta != null) subtitle += ` (${weightDelta > 0 ? '+' : ''}${weightDelta} kg)`
    if (rec.body_fat_pct) subtitle += ` · ${rec.body_fat_pct}% gordura`
    if (rec.adherence_pct) subtitle += ` · ${rec.adherence_pct}% aderência`

    const isProgress = weightDelta != null && weightDelta < -0.5
    items.push({
      id: rec.id,
      date: fmtDate(rec.measured_at),
      dateForSort: rec.measured_at,
      type: 'medida',
      title: i === 0 ? '⚖️ Primeira medição' : `⚖️ Avaliação física`,
      subtitle,
      detail: isProgress ? `Perdeu ${Math.abs(weightDelta!)} kg desde a última medição 💪` : undefined,
      icon: '⚖️',
      color: '#60a5fa',
      border: 'rgba(96,165,250,0.2)',
      bg: 'rgba(96,165,250,0.05)',
      badge: i === 0 ? 'Início' : `${i + 1}ª`,
      badgeColor: '#60a5fa',
    })
  })

  // Achieved goals
  ;(goals ?? []).filter(g => g.achieved && g.achieved_at).forEach(g => {
    items.push({
      id: `goal-${g.id}`,
      date: fmtDate(g.achieved_at!),
      dateForSort: g.achieved_at!,
      type: 'meta_achieved',
      title: `🏆 Meta atingida: ${g.label}`,
      subtitle: `${g.target_value}${g.unit ?? ''} alcançado!`,
      icon: '🏆',
      color: '#fbbf24',
      border: 'rgba(251,191,36,0.35)',
      bg: 'rgba(251,191,36,0.08)',
      badge: 'Conquista',
      badgeColor: '#fbbf24',
    })
  })

  // Consultations (realizado)
  ;(consultations ?? []).filter(c => c.status === 'realizado').forEach(c => {
    const typeLabel = c.type === 'presencial' ? '🏥 Presencial' : c.type === 'online' ? '💻 Online' : '📞 Telefone'
    items.push({
      id: `consult-${c.id}`,
      date: fmtDate(c.scheduled_at),
      dateForSort: c.scheduled_at,
      type: 'consulta',
      title: `📅 Consulta ${typeLabel}`,
      subtitle: c.duration_min ? `${c.duration_min} min` : '',
      detail: c.notes ? c.notes.slice(0, 80) + (c.notes.length > 80 ? '…' : '') : undefined,
      icon: '📅',
      color: '#a78bfa',
      border: 'rgba(167,139,250,0.2)',
      bg: 'rgba(167,139,250,0.05)',
    })
  })

  // Upcoming consultations
  ;(consultations ?? []).filter(c => ['agendado', 'confirmado'].includes(c.status) && new Date(c.scheduled_at) > new Date()).forEach(c => {
    const typeLabel = c.type === 'presencial' ? '🏥 Presencial' : c.type === 'online' ? '💻 Online' : '📞 Telefone'
    const st = c.status === 'confirmado' ? { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)' } : { color: '#93C5FD', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)' }
    const daysUntil = Math.ceil((new Date(c.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    items.push({
      id: `upcoming-${c.id}`,
      date: fmtDate(c.scheduled_at),
      dateForSort: c.scheduled_at,
      type: 'consulta',
      title: `📅 Próxima consulta — ${typeLabel}`,
      subtitle: daysUntil === 0 ? 'Hoje!' : daysUntil === 1 ? 'Amanhã!' : `Em ${daysUntil} dias`,
      icon: '📅',
      color: st.color,
      border: st.border,
      bg: st.bg,
      badge: c.status === 'confirmado' ? 'Confirmada' : 'Agendada',
      badgeColor: st.color,
    })
  })

  // Published diet plans
  ;(plans ?? []).forEach((plan, i) => {
    if (!plan.published_at) return
    items.push({
      id: `plan-${plan.id}`,
      date: fmtDate(plan.published_at),
      dateForSort: plan.published_at,
      type: 'plano',
      title: `🥗 Plano alimentar ${plan.active ? '(ativo)' : ''}`,
      subtitle: plan.title ?? 'Plano sem título',
      icon: '🥗',
      color: '#34d399',
      border: 'rgba(52,211,153,0.2)',
      bg: 'rgba(52,211,153,0.05)',
      badge: plan.active ? 'Atual' : undefined,
      badgeColor: '#34d399',
    })
  })

  // Progress photos (just show count milestones)
  const photos = photoCount ?? []
  if (photos.length > 0) {
    const latestPhoto = photos[0]
    items.push({
      id: `photo-${latestPhoto.id}`,
      date: fmtDate(latestPhoto.taken_at),
      dateForSort: latestPhoto.taken_at,
      type: 'foto',
      title: `📸 Foto de progresso`,
      subtitle: `${photos.length} foto${photos.length !== 1 ? 's' : ''} no total${latestPhoto.weight_kg ? ` · ${latestPhoto.weight_kg} kg` : ''}`,
      icon: '📸',
      color: '#f472b6',
      border: 'rgba(244,114,182,0.2)',
      bg: 'rgba(244,114,182,0.05)',
    })
  }

  // Sort all items by date desc
  items.sort((a, b) => b.dateForSort.localeCompare(a.dateForSort))

  // Compute total weight loss (if any)
  const firstWeight = sortedRecs.length > 0 ? sortedRecs[0].weight_kg : null
  const lastWeight  = sortedRecs.length > 0 ? sortedRecs[sortedRecs.length - 1].weight_kg : null
  const totalDelta  = firstWeight && lastWeight ? r(lastWeight - firstWeight) : null

  // Diary streak stats
  const totalDiaryDays = (diaryDays ?? []).length

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">📖 Minha Jornada</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Sua história de evolução</p>
        </div>
      </div>

      <div className="px-5 py-5 max-w-lg mx-auto">
        {/* Stats strip */}
        {(totalDelta !== null || sortedRecs.length > 0) && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-xl font-black" style={{ color: totalDelta != null ? (totalDelta < 0 ? '#4ade80' : '#f87171') : '#9ca3af' }}>
                {totalDelta != null ? `${totalDelta > 0 ? '+' : ''}${totalDelta} kg` : '—'}
              </div>
              <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Desde o início</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-xl font-black text-white">{sortedRecs.length}</div>
              <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Avaliações</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-xl font-black" style={{ color: '#4ade80' }}>
                {(goals ?? []).filter(g => g.achieved).length}
              </div>
              <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Metas alcançadas</div>
            </div>
          </div>
        )}

        {/* Timeline */}
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🌱</div>
            <div className="font-bold text-white">Sua jornada começa aqui!</div>
            <div className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Registre medidas, fotos e diário para construir seu histórico de evolução.
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-px"
              style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.4) 0%, rgba(37,99,235,0.1) 100%)' }} />

            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex gap-4 relative">
                  {/* Icon circle */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg z-10"
                    style={{ background: item.bg, border: `2px solid ${item.border}` }}>
                    {item.icon}
                  </div>

                  {/* Content card */}
                  <div className="flex-1 rounded-xl p-4 -mt-0.5"
                    style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                    {/* Badge + date row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      {item.badge ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${item.badgeColor}22`, color: item.badgeColor, border: `1px solid ${item.badgeColor}44` }}>
                          {item.badge}
                        </span>
                      ) : <div />}
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {daysAgo(item.dateForSort)} · {fmtDateShort(item.dateForSort)}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white leading-tight">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.subtitle}</div>
                    )}
                    {item.detail && (
                      <div className="text-[11px] mt-1.5 leading-relaxed" style={{ color: item.color, opacity: 0.85 }}>
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline end marker */}
            <div className="flex items-center gap-3 mt-6 pl-3">
              <div className="w-4 h-4 rounded-full border-2 border-dashed"
                style={{ borderColor: 'rgba(37,99,235,0.4)' }} />
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Início do acompanhamento · {patient.created_at ? fmtDateShort(patient.created_at) : '—'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
