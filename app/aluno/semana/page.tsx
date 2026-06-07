import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function r1(n: number) { return Math.round(n * 10) / 10 }
function r0(n: number) { return Math.round(n) }

function pctColor(pct: number) {
  if (pct >= 90 && pct <= 115) return '#4ADE80'
  if (pct >= 75 || pct <= 125) return '#FBBF24'
  return '#F87171'
}

function ptBR(dateStr: string) {
  return new Date(dateStr + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function weekdayShort(dateStr: string) {
  const labels = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  return labels[new Date(dateStr + 'T12:00').getDay()]
}

/* ─── SVG bar chart ─────────────────────────────────────────────────────── */
function WeekBarChart({
  days, targetKcal,
}: {
  days: { date: string; kcal: number; hasEntry: boolean }[]
  targetKcal: number
}) {
  const W = 340; const H = 120
  const padL = 0; const padR = 0; const padT = 12; const padB = 22
  const barAreaW = W - padL - padR
  const barAreaH = H - padT - padB
  const n = days.length
  const gap = 6
  const barW = (barAreaW - gap * (n - 1)) / n

  const maxKcal = Math.max(targetKcal * 1.25, ...days.map(d => d.kcal), 1)

  function barH(kcal: number) {
    return Math.max((kcal / maxKcal) * barAreaH, kcal > 0 ? 3 : 0)
  }
  function barX(i: number) { return padL + i * (barW + gap) }
  function barY(kcal: number) { return padT + barAreaH - barH(kcal) }

  // target line Y
  const targetY = padT + barAreaH - (targetKcal / maxKcal) * barAreaH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="1" />
          <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="barGradOver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F87171" stopOpacity="1" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="barGradGood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80" stopOpacity="1" />
          <stop offset="100%" stopColor="#22C55E" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Target line */}
      {targetKcal > 0 && (
        <>
          <line
            x1={padL} y1={targetY} x2={W - padR} y2={targetY}
            stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" strokeDasharray="4 3"
          />
          <text x={W - padR - 2} y={targetY - 3} textAnchor="end"
            fill="rgba(251,191,36,0.7)" fontSize="8" fontFamily="sans-serif">
            meta
          </text>
        </>
      )}

      {/* Bars + labels */}
      {days.map((day, i) => {
        const x = barX(i)
        const bh = barH(day.kcal)
        const by = barY(day.kcal)
        const pct = targetKcal > 0 ? (day.kcal / targetKcal) * 100 : 0
        const fill = !day.hasEntry
          ? 'url(#barGrad)'
          : pct >= 90 && pct <= 115
            ? 'url(#barGradGood)'
            : pct > 115
              ? 'url(#barGradOver)'
              : 'url(#barGrad)'

        return (
          <g key={day.date}>
            {/* Background slot */}
            <rect x={x} y={padT} width={barW} height={barAreaH}
              rx="4" fill="rgba(255,255,255,0.03)" />
            {/* Actual bar */}
            {day.kcal > 0 && (
              <rect x={x} y={by} width={barW} height={bh}
                rx="4" fill={day.hasEntry ? fill : 'rgba(255,255,255,0.1)'} />
            )}
            {/* kcal label above bar */}
            {day.kcal > 0 && (
              <text x={x + barW / 2} y={by - 2} textAnchor="middle"
                fill="rgba(255,255,255,0.55)" fontSize="7.5" fontFamily="sans-serif">
                {day.kcal >= 1000 ? `${(day.kcal / 1000).toFixed(1)}k` : r0(day.kcal)}
              </text>
            )}
            {/* Weekday label */}
            <text x={x + barW / 2} y={H - 4} textAnchor="middle"
              fill={day.hasEntry ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}
              fontSize="9" fontFamily="sans-serif" fontWeight={day.hasEntry ? '600' : '400'}>
              {weekdayShort(day.date)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ─── Macro ring ─────────────────────────────────────────────────────────── */
function MacroRingSmall({ p, c, f }: { p: number; c: number; f: number }) {
  const total = p + c + f || 1
  const sizes = [p / total, c / total, f / total]
  const colors = ['#60A5FA', '#FBBF24', '#F87171']
  const R = 28; const cx = 32; const cy = 32
  const circumference = 2 * Math.PI * R

  let offset = 0
  const arcs = sizes.map((s, i) => {
    const dash = s * circumference
    const arc = { dash, offset, color: colors[i] }
    offset += dash
    return arc
  })

  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={R} fill="none"
          stroke={a.color} strokeWidth="10"
          strokeDasharray={`${a.dash} ${circumference - a.dash}`}
          strokeDashoffset={-a.offset + circumference * 0.25}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  )
}

/* ─── Progress bar ───────────────────────────────────────────────────────── */
function MacroBar({ label, actual, target, unit, color }: {
  label: string; actual: number; target: number; unit: string; color: string
}) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 130) : 0
  const realPct = target > 0 ? (actual / target) * 100 : 0
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: pctColor(realPct) }}>
          {r0(actual)}{unit} <span style={{ color: 'rgba(255,255,255,0.35)' }}>/ {r0(target)}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default async function SemanaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, professional_id')
    .eq('auth_user_id', user.id)
    .single()
  if (!patient) redirect('/aluno')

  // ── Date range: last 7 days (today inclusive) ──────────────────────────
  const todayStr = new Date().toISOString().split('T')[0]
  const sevenDaysAgoDate = new Date(Date.now() - 6 * 86400000)
  const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().split('T')[0]

  // Build the 7-day window (oldest first)
  const dayWindow: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    dayWindow.push(d.toISOString().split('T')[0])
  }

  // ── Fetch diary entries for last 7 days ────────────────────────────────
  const { data: diaryEntries } = await supabase
    .from('diary_entries')
    .select('logged_at, total_kcal, total_protein_g, total_carbs_g, total_fat_g, meal_name')
    .eq('patient_id', patient.id)
    .gte('logged_at', sevenDaysAgoStr)
    .lte('logged_at', todayStr)
    .order('logged_at', { ascending: true })

  // ── Fetch active diet plan targets ────────────────────────────────────
  const { data: activePlan } = await supabase
    .from('diet_plans')
    .select(`
      id, title,
      target_kcal, target_protein_g, target_carbs_g, target_fat_g,
      meals(
        meal_foods(
          quantity_g,
          food:foods(kcal, protein_g, carbs_g, fat_g)
        )
      )
    `)
    .eq('patient_id', patient.id)
    .eq('active', true)
    .not('published_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Compute plan daily targets ─────────────────────────────────────────
  let planKcal = 0, planProtein = 0, planCarbs = 0, planFat = 0
  if (activePlan) {
    if (activePlan.target_kcal) {
      planKcal = activePlan.target_kcal
      planProtein = activePlan.target_protein_g ?? 0
      planCarbs = activePlan.target_carbs_g ?? 0
      planFat = activePlan.target_fat_g ?? 0
    } else {
      // Compute from meals
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const meal of (activePlan.meals ?? []) as any[]) {
        for (const mf of (meal.meal_foods ?? [])) {
          const f = mf.food
          if (!f) continue
          const ratio = mf.quantity_g / 100
          planKcal    += (f.kcal    ?? 0) * ratio
          planProtein += (f.protein_g ?? 0) * ratio
          planCarbs   += (f.carbs_g  ?? 0) * ratio
          planFat     += (f.fat_g    ?? 0) * ratio
        }
      }
    }
  }

  // ── Group diary entries by date ────────────────────────────────────────
  const byDate = new Map<string, { kcal: number; protein: number; carbs: number; fat: number; meals: string[] }>()
  for (const entry of (diaryEntries ?? [])) {
    const date = (entry.logged_at as string).split('T')[0]
    const existing = byDate.get(date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, meals: [] }
    existing.kcal    += entry.total_kcal    ?? 0
    existing.protein += entry.total_protein_g ?? 0
    existing.carbs   += entry.total_carbs_g ?? 0
    existing.fat     += entry.total_fat_g   ?? 0
    if (entry.meal_name && !existing.meals.includes(entry.meal_name)) {
      existing.meals.push(entry.meal_name)
    }
    byDate.set(date, existing)
  }

  // ── Build 7-day array ─────────────────────────────────────────────────
  const days = dayWindow.map(date => {
    const d = byDate.get(date)
    return {
      date,
      kcal:    d?.kcal    ?? 0,
      protein: d?.protein ?? 0,
      carbs:   d?.carbs   ?? 0,
      fat:     d?.fat     ?? 0,
      meals:   d?.meals   ?? [],
      hasEntry: !!d,
    }
  })

  // ── Weekly aggregates ─────────────────────────────────────────────────
  const loggedDays = days.filter(d => d.hasEntry)
  const loggedCount = loggedDays.length

  const totalKcal    = loggedDays.reduce((s, d) => s + d.kcal,    0)
  const totalProtein = loggedDays.reduce((s, d) => s + d.protein, 0)
  const totalCarbs   = loggedDays.reduce((s, d) => s + d.carbs,   0)
  const totalFat     = loggedDays.reduce((s, d) => s + d.fat,     0)

  const avgKcal    = loggedCount > 0 ? totalKcal    / loggedCount : 0
  const avgProtein = loggedCount > 0 ? totalProtein / loggedCount : 0
  const avgCarbs   = loggedCount > 0 ? totalCarbs   / loggedCount : 0
  const avgFat     = loggedCount > 0 ? totalFat     / loggedCount : 0

  // Weekly plan targets (×7)
  const weeklyPlanKcal    = planKcal    * 7
  const weeklyPlanProtein = planProtein * 7
  const weeklyPlanCarbs   = planCarbs   * 7
  const weeklyPlanFat     = planFat     * 7

  // Adherence % (based on logged days and avg kcal vs target)
  const diaryAdherence = loggedCount / 7 * 100
  const kcalAdherence  = planKcal > 0 && avgKcal > 0
    ? Math.min((avgKcal / planKcal) * 100, 100)
    : 0
  const overallAdherence = (diaryAdherence * 0.5 + kcalAdherence * 0.5)

  // Streak: consecutive days ending today (backwards from today)
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].hasEntry) streak++
    else break
  }

  // Best day
  const bestDay = loggedDays.length > 0
    ? loggedDays.reduce((best, d) => {
        const planPct = planKcal > 0 ? Math.abs(d.kcal - planKcal) : 0
        const bestPct = planKcal > 0 ? Math.abs(best.kcal - planKcal) : 0
        return planPct < bestPct ? d : best
      })
    : null

  // ── Format dates for header ───────────────────────────────────────────
  const rangeStart = new Date(sevenDaysAgoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const rangeEnd   = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
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
          <h1 className="text-base font-black text-white leading-none">📅 Resumo Semanal</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {rangeStart} – {rangeEnd}
          </p>
        </div>
        <Link href="/aluno/diario"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.25)' }}>
          Diário
        </Link>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* ── Adherence KPI ─────────────────────────────────────────── */}
        <div className="rounded-2xl p-4"
          style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 64 64" width="64" height="64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke={overallAdherence >= 75 ? '#4ADE80' : overallAdherence >= 50 ? '#FBBF24' : '#F87171'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallAdherence / 100) * 2 * Math.PI * 26} ${2 * Math.PI * 26}`}
                  strokeDashoffset={2 * Math.PI * 26 * 0.25}
                  style={{ transition: 'stroke-dasharray 0.5s' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-white">{r0(overallAdherence)}%</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-base font-black text-white leading-none">
                {overallAdherence >= 85 ? '🔥 Ótima semana!' : overallAdherence >= 65 ? '👍 Boa semana' : '💪 Continue assim'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {loggedCount} de 7 dias registrados
                {streak > 0 && (
                  <span className="ml-2 font-bold" style={{ color: '#FBBF24' }}>
                    🔥 {streak}d seguidos
                  </span>
                )}
              </div>
              {planKcal > 0 && avgKcal > 0 && (
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Média de {r0(avgKcal)} kcal/dia
                  {planKcal > 0 && (
                    <span className="ml-1" style={{ color: pctColor((avgKcal / planKcal) * 100) }}>
                      ({r0((avgKcal / planKcal) * 100)}% da meta)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bar chart ─────────────────────────────────────────────── */}
        <div className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Kcal por dia
            </span>
            {planKcal > 0 && (
              <span className="text-[10px]" style={{ color: 'rgba(251,191,36,0.7)' }}>
                meta: {r0(planKcal)} kcal
              </span>
            )}
          </div>
          <WeekBarChart days={days} targetKcal={planKcal} />
        </div>

        {/* ── Macro comparison ──────────────────────────────────────── */}
        {loggedCount > 0 && (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Média diária de macros
              </span>
              {planKcal > 0 && (
                <div className="flex items-center gap-1">
                  <MacroRingSmall p={avgProtein * 4} c={avgCarbs * 4} f={avgFat * 9} />
                </div>
              )}
            </div>

            <MacroBar label="Proteína" actual={avgProtein} target={planProtein} unit="g" color="#60A5FA" />
            <MacroBar label="Carboidratos" actual={avgCarbs} target={planCarbs} unit="g" color="#FBBF24" />
            <MacroBar label="Gordura" actual={avgFat} target={planFat} unit="g" color="#F87171" />
            <MacroBar label="Energia" actual={avgKcal} target={planKcal} unit=" kcal" color="#A78BFA" />

            {planKcal === 0 && (
              <div className="text-xs text-center pt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Sem plano alimentar ativo — valores acima são médias do diário
              </div>
            )}
          </div>
        )}

        {/* ── Weekly totals ─────────────────────────────────────────── */}
        {loggedCount > 0 && (
          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Totais da semana
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Kcal', actual: totalKcal, target: weeklyPlanKcal, unit: '', color: '#A78BFA' },
                { label: 'Prot.', actual: totalProtein, target: weeklyPlanProtein, unit: 'g', color: '#60A5FA' },
                { label: 'Carb.', actual: totalCarbs, target: weeklyPlanCarbs, unit: 'g', color: '#FBBF24' },
                { label: 'Gord.', actual: totalFat, target: weeklyPlanFat, unit: 'g', color: '#F87171' },
              ].map(m => (
                <div key={m.label} className="text-center rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.label}</div>
                  <div className="text-sm font-black" style={{ color: m.color }}>{r0(m.actual)}{m.unit}</div>
                  {m.target > 0 && (
                    <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>/ {r0(m.target)}{m.unit}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Day-by-day list ───────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Cada dia
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {[...days].reverse().map(day => {
              const kcalPct = planKcal > 0 && day.kcal > 0 ? (day.kcal / planKcal) * 100 : 0
              const isToday = day.date === todayStr
              return (
                <Link
                  key={day.date}
                  href={`/aluno/diario?date=${day.date}`}
                  className="flex items-center gap-3 px-4 py-3 transition-all"
                  style={{ background: isToday ? 'rgba(37,99,235,0.06)' : 'transparent' }}
                >
                  {/* Date */}
                  <div className="w-14 flex-shrink-0">
                    <div className="text-[11px] font-black capitalize" style={{ color: isToday ? '#93C5FD' : 'rgba(255,255,255,0.7)' }}>
                      {weekdayShort(day.date)}
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(day.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="flex-1">
                    {day.hasEntry ? (
                      <>
                        <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div className="h-full rounded-full"
                            style={{
                              width: `${Math.min(kcalPct, 130)}%`,
                              background: kcalPct >= 90 && kcalPct <= 115 ? '#4ADE80' : kcalPct > 115 ? '#F87171' : '#2563EB',
                            }} />
                        </div>
                        <div className="flex gap-3 text-[10px]">
                          <span style={{ color: '#A78BFA' }}>{r0(day.kcal)} kcal</span>
                          <span style={{ color: '#60A5FA' }}>{r0(day.protein)}g prot</span>
                          <span style={{ color: '#FBBF24' }}>{r0(day.carbs)}g carb</span>
                          <span style={{ color: '#F87171' }}>{r0(day.fat)}g gord</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {isToday ? '— registre hoje!' : '— sem registro'}
                      </span>
                    )}
                  </div>

                  {/* Status dot / meals count */}
                  <div className="flex-shrink-0 text-right">
                    {day.hasEntry ? (
                      <>
                        <div className="w-2 h-2 rounded-full ml-auto"
                          style={{ background: kcalPct >= 90 && kcalPct <= 115 ? '#4ADE80' : kcalPct > 115 ? '#F87171' : '#FBBF24' }} />
                        {day.meals.length > 0 && (
                          <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            {day.meals.length} {day.meals.length === 1 ? 'refeição' : 'ref.'}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-2 h-2 rounded-full ml-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Insight card ─────────────────────────────────────────── */}
        {loggedCount > 0 && bestDay && planKcal > 0 && (
          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(74,222,128,0.8)' }}>
              🏆 Melhor dia da semana
            </div>
            <div className="text-sm text-white">
              {ptBR(bestDay.date)} — {r0(bestDay.kcal)} kcal
              {planKcal > 0 && (
                <span className="ml-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  ({r0((bestDay.kcal / planKcal) * 100)}% da meta)
                </span>
              )}
            </div>
            {bestDay.meals.length > 0 && (
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {bestDay.meals.join(' · ')}
              </div>
            )}
          </div>
        )}

        {/* ── No data state ─────────────────────────────────────────── */}
        {loggedCount === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📔</div>
            <div className="text-white font-bold text-lg mb-2">Nenhum registro esta semana</div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Registre suas refeições no diário para ver seu resumo semanal aqui.
            </div>
            <Link href="/aluno/diario"
              className="inline-block px-6 py-3 rounded-xl font-bold text-white"
              style={{ background: '#2563EB' }}>
              Abrir Diário
            </Link>
          </div>
        )}

        {/* ── Tip ──────────────────────────────────────────────────── */}
        {loggedCount > 0 && loggedCount < 5 && (
          <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
            style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', color: 'rgba(255,255,255,0.4)' }}>
            💡 <strong className="text-white">Dica:</strong> Registre pelo menos 5 dias por semana para uma análise mais precisa da sua nutrição. Você registrou {loggedCount} de 7 dias esta semana.
          </div>
        )}

      </div>
    </div>
  )
}
