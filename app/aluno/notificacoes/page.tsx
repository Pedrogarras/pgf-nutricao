import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60)  return `${mins}min atrás`
  if (hours < 24)  return `${hours}h atrás`
  if (days  < 7)   return `${days}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function daysUntil(dateStr: string) {
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00')
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

function daysAgo(dateStr: string) {
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00')
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

/* ─── notification item type ──────────────────────────────────────────────── */
interface NotifItem {
  id: string
  type: 'mensagem' | 'meta' | 'consulta' | 'plano' | 'checkin' | 'boas_vindas'
  title: string
  body: string
  date: string        // ISO for sorting
  href?: string
  icon: string
  accentColor: string
  bg: string
  border: string
  badge?: string
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default async function AlunoNotificacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, public_message, public_message_at, created_at')
    .eq('auth_user_id', user.id)
    .single()
  if (!patient) redirect('/aluno')

  const [
    { data: achievedGoals },
    { data: upcomingConsultations },
    { data: recentPlans },
    { data: recentRecords },
    { data: recentDiary },
  ] = await Promise.all([
    // Goals achieved in last 90 days
    supabase.from('patient_goals')
      .select('id, label, metric, unit, target_value, achieved_at')
      .eq('patient_id', patient.id)
      .eq('achieved', true)
      .not('achieved_at', 'is', null)
      .gte('achieved_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('achieved_at', { ascending: false })
      .limit(5),

    // Upcoming consultations (next 30 days)
    supabase.from('consultations')
      .select('id, scheduled_at, type, status, duration_min, notes')
      .eq('patient_id', patient.id)
      .in('status', ['agendado', 'confirmado'])
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', new Date(Date.now() + 30 * 86400000).toISOString())
      .order('scheduled_at')
      .limit(3),

    // Recently published diet plans (last 60 days)
    supabase.from('diet_plans')
      .select('id, title, published_at, active')
      .eq('patient_id', patient.id)
      .not('published_at', 'is', null)
      .gte('published_at', new Date(Date.now() - 60 * 86400000).toISOString())
      .order('published_at', { ascending: false })
      .limit(3),

    // Recent check-ins (last 30 days)
    supabase.from('anthropometric_records')
      .select('id, measured_at, weight_kg, notes')
      .eq('patient_id', patient.id)
      .gte('measured_at', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
      .order('measured_at', { ascending: false })
      .limit(2),

    // Diary streak check (last 14 days)
    supabase.from('diary_entries')
      .select('logged_at')
      .eq('patient_id', patient.id)
      .gte('logged_at', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      .order('logged_at', { ascending: false }),
  ])

  // ── Build notifications list ─────────────────────────────────────────
  const items: NotifItem[] = []

  // 1. Nutritionist public message
  if (patient.public_message && patient.public_message_at) {
    items.push({
      id: 'msg_main',
      type: 'mensagem',
      title: 'Mensagem do seu nutricionista',
      body: patient.public_message,
      date: patient.public_message_at,
      href: '/aluno',
      icon: '💬',
      accentColor: '#2563EB',
      bg: 'rgba(37,99,235,0.07)',
      border: 'rgba(37,99,235,0.25)',
      badge: 'Novo',
    })
  }

  // 2. Upcoming consultations
  for (const c of (upcomingConsultations ?? [])) {
    const until = daysUntil(c.scheduled_at)
    const dt = new Date(c.scheduled_at)
    const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const typeLabel = c.type === 'presencial' ? '🏥 Presencial' : c.type === 'online' ? '💻 Online' : '📞 Telefone'
    items.push({
      id: `consult_${c.id}`,
      type: 'consulta',
      title: until === 0 ? '🔔 Consulta HOJE!' : until === 1 ? 'Consulta amanhã' : `Consulta em ${until} dias`,
      body: `${dateStr} às ${timeStr} · ${typeLabel} · ${c.duration_min ?? 60}min${c.notes ? `\n${c.notes}` : ''}`,
      date: c.scheduled_at,
      href: '/aluno/consultas',
      icon: '📅',
      accentColor: until <= 1 ? '#F59E0B' : '#8B5CF6',
      bg: until <= 1 ? 'rgba(245,158,11,0.07)' : 'rgba(139,92,246,0.07)',
      border: until <= 1 ? 'rgba(245,158,11,0.25)' : 'rgba(139,92,246,0.25)',
      badge: until <= 1 ? 'Urgente' : `Em ${until}d`,
    })
  }

  // 3. Achieved goals
  for (const g of (achievedGoals ?? [])) {
    const label = g.label ?? g.metric ?? 'Meta'
    items.push({
      id: `goal_${g.id}`,
      type: 'meta',
      title: `🎉 Meta alcançada: ${label}`,
      body: `Você chegou ao seu objetivo de ${g.target_value}${g.unit ?? ''}! Continue assim!`,
      date: g.achieved_at ?? new Date().toISOString(),
      href: '/aluno/metas',
      icon: '🎯',
      accentColor: '#10B981',
      bg: 'rgba(16,185,129,0.07)',
      border: 'rgba(16,185,129,0.25)',
      badge: 'Conquista',
    })
  }

  // 4. Recently published plans
  for (const p of (recentPlans ?? [])) {
    items.push({
      id: `plan_${p.id}`,
      type: 'plano',
      title: p.active ? '🥗 Novo plano alimentar disponível' : 'Plano alimentar atualizado',
      body: `"${p.title}" — disponível para visualizar e imprimir`,
      date: p.published_at ?? new Date().toISOString(),
      href: '/aluno/plano',
      icon: '🥗',
      accentColor: '#059669',
      bg: 'rgba(5,150,105,0.07)',
      border: 'rgba(5,150,105,0.25)',
      badge: p.active ? 'Ativo' : undefined,
    })
  }

  // 5. Check-in confirmations
  for (const rec of (recentRecords ?? [])) {
    const ago = daysAgo(rec.measured_at)
    items.push({
      id: `record_${rec.id}`,
      type: 'checkin',
      title: `✅ Check-in registrado${rec.weight_kg ? ` — ${rec.weight_kg} kg` : ''}`,
      body: ago === 0 ? 'Registrado hoje · Continue monitorando sua evolução!'
        : ago === 1 ? 'Registrado ontem · Ótimo trabalho!'
        : `Registrado há ${ago} dias · Não esqueça do próximo!`,
      date: rec.measured_at + 'T12:00',
      href: '/aluno/checkin',
      icon: '⚖️',
      accentColor: '#3B82F6',
      bg: 'rgba(59,130,246,0.07)',
      border: 'rgba(59,130,246,0.25)',
    })
  }

  // 6. Diary streak encouragement
  const diaryDates = new Set((recentDiary ?? []).map(d => (d.logged_at as string).split('T')[0]))
  const todayStr = new Date().toISOString().split('T')[0]
  let streak = 0
  for (let i = 0; i <= 14; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    if (diaryDates.has(d)) streak++
    else if (i > 0) break
  }
  if (streak >= 7) {
    items.push({
      id: 'streak_7',
      type: 'meta',
      title: `🔥 ${streak} dias de sequência no diário!`,
      body: 'Incrível consistência! Manter o diário em dia é fundamental para sua evolução.',
      date: todayStr + 'T12:00',
      href: '/aluno/semana',
      icon: '🔥',
      accentColor: '#F59E0B',
      bg: 'rgba(245,158,11,0.07)',
      border: 'rgba(245,158,11,0.25)',
      badge: `${streak}🔥`,
    })
  } else if (!diaryDates.has(todayStr)) {
    items.push({
      id: 'diary_remind',
      type: 'mensagem',
      title: '📔 Não se esqueça do diário hoje!',
      body: 'Registrar suas refeições ajuda o nutricionista a ajustar seu plano com precisão.',
      date: todayStr + 'T08:00',
      href: '/aluno/diario',
      icon: '📔',
      accentColor: '#6366F1',
      bg: 'rgba(99,102,241,0.07)',
      border: 'rgba(99,102,241,0.2)',
    })
  }

  // 7. Welcome / onboarding (only if account is recent — last 14 days)
  const accountAge = daysAgo(patient.created_at)
  if (accountAge <= 14) {
    items.push({
      id: 'boas_vindas',
      type: 'boas_vindas',
      title: '👋 Bem-vindo ao PGF Nutrição!',
      body: 'Explore o app: registre suas refeições no Diário, faça seu Check-in semanal e acompanhe sua Evolução.',
      date: patient.created_at,
      href: '/aluno',
      icon: '🌟',
      accentColor: '#EC4899',
      bg: 'rgba(236,72,153,0.07)',
      border: 'rgba(236,72,153,0.2)',
    })
  }

  // ── Sort by date descending ──────────────────────────────────────────
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">🔔 Notificações</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {items.length} {items.length === 1 ? 'aviso' : 'avisos'}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔔</div>
            <div className="text-white font-bold text-lg">Nada por enquanto</div>
            <div className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Suas notificações e avisos do nutricionista aparecerão aqui.
            </div>
          </div>
        ) : (
          items.map(item => (
            <Link key={item.id} href={item.href ?? '/aluno'}
              className="block rounded-2xl p-4 transition-all active:scale-[0.98]"
              style={{ background: item.bg, border: `1px solid ${item.border}` }}>
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: `${item.accentColor}18` }}>
                  {item.icon}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold text-white leading-tight pr-2">
                      {item.title}
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${item.accentColor}22`, color: item.accentColor }}>
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="text-xs mt-1 leading-relaxed whitespace-pre-line"
                    style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {item.body}
                  </div>

                  {/* Time */}
                  <div className="text-[10px] mt-2 font-medium"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {timeAgo(item.date)}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}

        {/* ── Tip at bottom ──────────────────────────────────────── */}
        {items.length > 0 && (
          <div className="text-center pt-4 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Toque em um aviso para ir direto à seção
          </div>
        )}

      </div>
    </div>
  )
}
