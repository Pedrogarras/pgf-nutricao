import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface WorkoutLog {
  id: string
  workout_day_id: string | null
  logged_at: string
  duration_min: number | null
  rpe: number | null
  notes: string | null
}

interface WorkoutDay {
  id: string
  name: string
  sort_order: number
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function SectionHead({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-bold mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
      {title}
    </h2>
  )
}

const RPE_COLOR = (rpe: number) => {
  if (rpe <= 3) return '#34D399'
  if (rpe <= 6) return '#FBBF24'
  if (rpe <= 8) return '#FB923C'
  return '#F87171'
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default async function WorkoutLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: patient },
    { data: logs },
    { data: workoutDays },
  ] = await Promise.all([
    supabase.from('patients').select('id, full_name').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('workout_logs')
      .select('id, workout_day_id, logged_at, duration_min, rpe, notes')
      .eq('patient_id', id)
      .gte('logged_at', ninetyDaysAgo)
      .order('logged_at', { ascending: false }),
    supabase.from('workout_days')
      .select('id, name, sort_order')
      .in(
        'workout_plan_id',
        supabase.from('workout_plans').select('id').eq('patient_id', id).eq('active', true)
      )
      .order('sort_order'),
  ])

  if (!patient) notFound()

  const allLogs: WorkoutLog[] = logs ?? []
  const dayMap: Record<string, WorkoutDay> = {}
  for (const d of (workoutDays ?? [])) dayMap[d.id] = d

  // ── Stats ──
  const last30 = allLogs.filter(l => l.logged_at >= new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const last7  = allLogs.filter(l => l.logged_at >= new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])

  const avgRpe90 = allLogs.filter(l => l.rpe).length > 0
    ? (allLogs.filter(l => l.rpe).reduce((s, l) => s + (l.rpe ?? 0), 0) / allLogs.filter(l => l.rpe).length).toFixed(1)
    : null

  const avgDur30 = last30.filter(l => l.duration_min).length > 0
    ? Math.round(last30.filter(l => l.duration_min).reduce((s, l) => s + (l.duration_min ?? 0), 0) / last30.filter(l => l.duration_min).length)
    : null

  // ── Streak (consecutive days working out from today going backwards) ──
  const logDates = new Set(allLogs.map(l => l.logged_at))
  let streak = 0
  for (let i = 0; i <= 90; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    if (logDates.has(d)) streak++
    else if (i > 0) break
  }

  // ── Frequency by day-of-week ──
  const dowCounts = Array(7).fill(0)
  for (const l of allLogs) {
    const dow = new Date(l.logged_at + 'T12:00').getDay()
    dowCounts[dow]++
  }
  const maxDow = Math.max(...dowCounts, 1)
  const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  // ── Generate 90-day calendar grid ──
  const gridDays: { date: string; count: number }[] = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    gridDays.push({ date: d, count: allLogs.filter(l => l.logged_at === d).length })
  }

  // ── Per-day breakdown ──
  const dayBreakdown: Record<string, { count: number; avgRpe: number | null }> = {}
  for (const l of allLogs) {
    const dayName = l.workout_day_id && dayMap[l.workout_day_id]
      ? dayMap[l.workout_day_id].name
      : 'Livre'
    if (!dayBreakdown[dayName]) dayBreakdown[dayName] = { count: 0, avgRpe: null }
    dayBreakdown[dayName].count++
  }
  // recalc avgRpe per day
  for (const dayName of Object.keys(dayBreakdown)) {
    const dayLogs = allLogs.filter(l => {
      const n = l.workout_day_id && dayMap[l.workout_day_id] ? dayMap[l.workout_day_id].name : 'Livre'
      return n === dayName
    })
    const withRpe = dayLogs.filter(l => l.rpe)
    dayBreakdown[dayName].avgRpe = withRpe.length > 0
      ? Math.round(withRpe.reduce((s, l) => s + (l.rpe ?? 0), 0) / withRpe.length * 10) / 10
      : null
  }

  const firstLogDate = allLogs.length > 0 ? allLogs[allLogs.length - 1].logged_at : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <Link href={`/pro/pacientes/${id}/treino`} className="text-pgf-400 hover:text-pgf-300 text-sm flex-shrink-0">
          ← Plano
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">📋 Histórico de Treinos</div>
          <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{patient.full_name}</div>
        </div>
        <Link
          href={`/pro/pacientes/${id}/treino`}
          className="ml-auto text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
          style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA', border: '1px solid rgba(37,99,235,0.3)' }}
        >
          ✏️ Editar plano
        </Link>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4">

        {/* ── KPI strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '7 dias', value: last7.length, unit: 'treinos', color: last7.length >= 3 ? '#4ADE80' : last7.length > 0 ? '#FBBF24' : '#9CA3AF' },
            { label: '30 dias', value: last30.length, unit: 'treinos', color: '#60A5FA' },
            { label: 'RPE médio', value: avgRpe90 ?? '—', unit: '90d', color: avgRpe90 ? RPE_COLOR(Number(avgRpe90)) : '#9CA3AF' },
            { label: 'Duração', value: avgDur30 ? `${avgDur30}` : '—', unit: avgDur30 ? 'min/sessão' : '', color: '#A78BFA' },
          ].map(k => (
            <div
              key={k.label}
              className="card p-3 text-center"
            >
              <div className="text-lg font-black" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{k.unit}</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Streak badge */}
        {streak > 1 && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
          >
            <span className="text-xl">🔥</span>
            <div>
              <span className="text-sm font-black text-amber-400">{streak} dias</span>
              <span className="text-sm text-amber-200/60"> de sequência ativa</span>
            </div>
          </div>
        )}

        {allLogs.length === 0 ? (
          <div
            className="card p-10 text-center"
          >
            <div className="text-4xl mb-3">🏋️</div>
            <div className="font-bold text-white mb-1">Nenhum treino registrado</div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              O paciente ainda não registrou nenhuma sessão de treino.
            </div>
          </div>
        ) : (
          <>
            {/* ── 90-day heatmap ──────────────────────────────────────── */}
            <div className="card p-5">
              <SectionHead title="📅 Heatmap 90 dias" />
              <div className="flex gap-0.5 flex-wrap">
                {gridDays.map(day => {
                  const isToday = day.date === today
                  const bg = day.count === 0
                    ? 'rgba(255,255,255,0.05)'
                    : day.count === 1
                      ? 'rgba(74,222,128,0.45)'
                      : 'rgba(74,222,128,0.85)'
                  return (
                    <div
                      key={day.date}
                      title={`${day.date}${day.count > 0 ? ` · ${day.count} treino${day.count > 1 ? 's' : ''}` : ''}`}
                      style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: bg,
                        outline: isToday ? '1.5px solid #2563EB' : undefined,
                        outlineOffset: isToday ? 1 : undefined,
                      }}
                    />
                  )
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <div className="flex items-center gap-1">
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }} />
                  <span>Sem treino</span>
                </div>
                <div className="flex items-center gap-1">
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(74,222,128,0.45)' }} />
                  <span>1 sessão</span>
                </div>
                <div className="flex items-center gap-1">
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(74,222,128,0.85)' }} />
                  <span>2+ sessões</span>
                </div>
                {firstLogDate && (
                  <span className="ml-auto">Desde {new Date(firstLogDate + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                )}
              </div>
            </div>

            {/* ── Day-of-week frequency ───────────────────────────────── */}
            <div className="card p-5">
              <SectionHead title="📊 Frequência por dia da semana" />
              <div className="flex items-end gap-1.5 h-16">
                {DOW_LABELS.map((label, i) => {
                  const h = Math.round((dowCounts[i] / maxDow) * 52)
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: Math.max(4, h),
                          background: dowCounts[i] === maxDow
                            ? 'rgba(74,222,128,0.7)'
                            : 'rgba(37,99,235,0.45)',
                          transition: 'height 0.3s',
                        }}
                      />
                      <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Total de {allLogs.length} sessão{allLogs.length !== 1 ? 'ões' : ''} nos últimos 90 dias
              </div>
            </div>

            {/* ── Per-workout-day breakdown ───────────────────────────── */}
            {Object.keys(dayBreakdown).length > 0 && (
              <div className="card p-5">
                <SectionHead title="🏋️ Por divisão de treino" />
                <div className="space-y-2">
                  {Object.entries(dayBreakdown)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([name, info]) => (
                      <div key={name} className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-white flex-1 truncate">{name}</div>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {info.count}× realizado
                        </div>
                        {info.avgRpe && (
                          <div
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${RPE_COLOR(info.avgRpe)}20`, color: RPE_COLOR(info.avgRpe) }}
                          >
                            RPE {info.avgRpe}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* ── Recent sessions list ────────────────────────────────── */}
            <div className="card p-5">
              <SectionHead title="📝 Sessões recentes" />
              <div className="space-y-2">
                {allLogs.slice(0, 30).map(log => {
                  const dayName = log.workout_day_id && dayMap[log.workout_day_id]
                    ? dayMap[log.workout_day_id].name
                    : '📌 Treino livre'
                  const dateLabel = new Date(log.logged_at + 'T12:00').toLocaleDateString('pt-BR', {
                    weekday: 'short', day: '2-digit', month: 'short'
                  })
                  return (
                    <div
                      key={log.id}
                      className="rounded-xl p-3"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{dayName}</div>
                          <div className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.4)' }}>{dateLabel}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {log.duration_min && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}>
                              ⏱ {log.duration_min}min
                            </span>
                          )}
                          {log.rpe && (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${RPE_COLOR(log.rpe)}20`, color: RPE_COLOR(log.rpe) }}
                            >
                              RPE {log.rpe}
                            </span>
                          )}
                        </div>
                      </div>
                      {log.notes && (
                        <div className="mt-2 text-xs italic" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          &ldquo;{log.notes}&rdquo;
                        </div>
                      )}
                    </div>
                  )
                })}
                {allLogs.length > 30 && (
                  <div className="text-xs text-center py-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    +{allLogs.length - 30} sessões mais antigas (90 dias exibidos)
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="pb-8" />
      </div>
    </div>
  )
}
