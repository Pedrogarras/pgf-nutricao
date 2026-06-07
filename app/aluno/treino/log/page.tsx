'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface WorkoutDay {
  id: string
  name: string
  sort_order: number
  workout_exercises: { id: string; exercise: { name: string; muscle_group: string | null } }[]
}

interface WorkoutLog {
  id: string
  workout_day_id: string | null
  logged_at: string
  duration_min: number | null
  rpe: number | null
  notes: string | null
}

/* ─── RPE emoji scale ───────────────────────────────────────────────────── */
const RPE_LABELS: Record<number, { emoji: string; label: string; color: string }> = {
  1:  { emoji: '😴', label: 'Muito leve', color: '#9CA3AF' },
  2:  { emoji: '🚶', label: 'Leve',       color: '#9CA3AF' },
  3:  { emoji: '😌', label: 'Moderado-',  color: '#60A5FA' },
  4:  { emoji: '💪', label: 'Moderado',   color: '#60A5FA' },
  5:  { emoji: '😤', label: 'Moderado+',  color: '#34D399' },
  6:  { emoji: '🔥', label: 'Intenso-',   color: '#34D399' },
  7:  { emoji: '😅', label: 'Intenso',    color: '#FCD34D' },
  8:  { emoji: '🥵', label: 'Muito inten.', color: '#FB923C' },
  9:  { emoji: '😰', label: 'Máximo-',    color: '#F87171' },
  10: { emoji: '💀', label: 'Máximo',     color: '#EF4444' },
}

/* ─── helpers ────────────────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().split('T')[0] }

function getLast30Days(): string[] {
  const result: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    result.push(d.toISOString().split('T')[0])
  }
  return result
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function getWeekDays(): string[] {
  const result: string[] = []
  const today = new Date()
  const dayOfWeek = today.getDay()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - dayOfWeek + 1) // Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    result.push(d.toISOString().split('T')[0])
  }
  return result
}

/* ─── Modal ──────────────────────────────────────────────────────────────── */
function LogModal({
  day, date, existingLog, onSave, onClose, saving,
}: {
  day: WorkoutDay | null
  date: string
  existingLog: WorkoutLog | null
  onSave: (payload: { workout_day_id: string | null; logged_at: string; duration_min: number | null; rpe: number | null; notes: string }) => void
  onClose: () => void
  saving: boolean
}) {
  const [duration, setDuration] = useState(existingLog?.duration_min ? String(existingLog.duration_min) : '60')
  const [rpe, setRpe] = useState<number>(existingLog?.rpe ?? 7)
  const [notes, setNotes] = useState(existingLog?.notes ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl"
        style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.3)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--dark-border)' }}>
          <div className="font-black text-white text-lg leading-tight">
            {existingLog ? '✏️ Editar treino' : '✅ Registrar treino'}
          </div>
          <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {day ? day.name : 'Treino livre'} · {fmtDate(date)}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Duration */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-2"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              ⏱ Duração (minutos)
            </label>
            <div className="flex gap-2">
              {[30, 45, 60, 75, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(String(d))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: duration === String(d) ? '#2563EB' : 'rgba(255,255,255,0.05)',
                    color: duration === String(d) ? '#fff' : 'rgba(255,255,255,0.45)',
                    border: `1px solid ${duration === String(d) ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {d}
                </button>
              ))}
              <input
                type="number" min="5" max="300" value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-16 text-center py-2 rounded-xl text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </div>

          {/* RPE scale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-[2px]"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                💪 Esforço percebido (RPE {rpe}/10)
              </label>
              <span className="text-sm">{RPE_LABELS[rpe]?.emoji}</span>
            </div>
            {/* RPE slider */}
            <div className="flex gap-1">
              {[1,2,3,4,5,6,7,8,9,10].map(v => (
                <button
                  key={v}
                  onClick={() => setRpe(v)}
                  className="flex-1 h-7 rounded-lg text-xs font-black transition-all"
                  style={{
                    background: v <= rpe ? RPE_LABELS[rpe]?.color + '33' : 'rgba(255,255,255,0.04)',
                    color: v <= rpe ? RPE_LABELS[rpe]?.color : 'rgba(255,255,255,0.25)',
                    border: v === rpe ? `2px solid ${RPE_LABELS[rpe]?.color}` : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="text-[10px] mt-1.5 font-semibold" style={{ color: RPE_LABELS[rpe]?.color ?? '#9CA3AF' }}>
              {RPE_LABELS[rpe]?.label ?? ''}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-2"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              📝 Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Como foi o treino? Algo que quer lembrar..."
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave({
              workout_day_id: day?.id ?? null,
              logged_at: date,
              duration_min: parseInt(duration) || null,
              rpe,
              notes: notes.trim() || null as unknown as string,
            })}
            disabled={saving}
            className="flex-2 flex-1 py-3 rounded-xl text-sm font-black"
            style={{ background: saving ? 'rgba(37,99,235,0.4)' : '#2563EB', color: '#fff' }}
          >
            {saving ? 'Salvando...' : existingLog ? '✓ Atualizar' : '✓ Salvar treino'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function TreinoLogPage() {
  const supabase = createClient()
  const [days, setDays] = useState<WorkoutDay[]>([])
  const [planTitle, setPlanTitle] = useState('')
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal state
  const [modal, setModal] = useState<{
    day: WorkoutDay | null
    date: string
    existingLog: WorkoutLog | null
  } | null>(null)

  const today = todayStr()
  const weekDays = getWeekDays()
  const last30 = getLast30Days()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: patient } = await supabase
        .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
      if (!patient) { setLoading(false); return }

      // Load plan days
      const { data: planData } = await supabase
        .from('workout_plans')
        .select(`id, title, workout_days(id, name, sort_order, workout_exercises(id, exercise:exercises(name, muscle_group)))`)
        .eq('patient_id', patient.id)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planData) {
        setPlanTitle(planData.title ?? 'Plano de Treino')
        setDays(
          ((planData.workout_days as WorkoutDay[]) ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
        )
      }

      // Load logs for last 30 days
      const res = await fetch(`/api/workout-log?from=${last30[0]}&to=${today}`)
      const data = await res.json()
      setLogs(data.logs ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  /* ── Log management ─────────────────────────────────────────────────── */
  const logsByDate = new Map<string, WorkoutLog>()
  for (const log of logs) {
    const key = log.workout_day_id ? `${log.logged_at}_${log.workout_day_id}` : log.logged_at
    logsByDate.set(key, log)
  }

  const loggedDates = new Set(logs.map(l => l.logged_at))

  async function handleSave(payload: {
    workout_day_id: string | null
    logged_at: string
    duration_min: number | null
    rpe: number | null
    notes: string
  }) {
    setSaving(true)
    try {
      const existingLog = modal?.existingLog
      if (existingLog) {
        await fetch(`/api/workout-log/${existingLog.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            duration_min: payload.duration_min,
            rpe: payload.rpe,
            notes: payload.notes,
          }),
        })
      } else {
        await fetch('/api/workout-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      await load()
      setModal(null)
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleDelete(logId: string) {
    if (!confirm('Remover este registro de treino?')) return
    await fetch(`/api/workout-log/${logId}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== logId))
  }

  /* ── Streak calculation ─────────────────────────────────────────────── */
  let streak = 0
  const startOffset = loggedDates.has(today) ? 0 : 1
  for (let i = startOffset; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    if (loggedDates.has(d.toISOString().split('T')[0])) streak++
    else if (i > 0) break
  }
  const totalThisMonth = loggedDates.size
  const avgRpe = logs.length > 0
    ? Math.round(logs.filter(l => l.rpe).reduce((s, l) => s + (l.rpe ?? 0), 0) / logs.filter(l => l.rpe).length * 10) / 10
    : null

  const WEEKDAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dark-bg)' }}>
        <div className="text-center">
          <div className="text-3xl mb-3">🏋️</div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/aluno/treino" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">🏋️ Registro de Treinos</h1>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {planTitle || 'Seu histórico de atividade física'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/aluno/treino/timer"
            className="text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(251,191,36,0.12)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.25)' }}
          >
            ⏱ Timer
          </Link>
          {/* Quick log button for today without a specific day */}
          <button
            onClick={() => setModal({ day: null, date: today, existingLog: null })}
            className="text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
          >
            + Livre
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto">

        {/* ── KPI strip ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { icon: '🔥', label: 'Sequência', value: streak > 0 ? `${streak}d` : '—', color: streak >= 7 ? '#F59E0B' : streak >= 3 ? '#FB923C' : '#9CA3AF' },
            { icon: '📅', label: '30 dias', value: `${totalThisMonth}`, color: '#60A5FA', sub: `treino${totalThisMonth !== 1 ? 's' : ''}` },
            { icon: '💪', label: 'RPE médio', value: avgRpe ? `${avgRpe}/10` : '—', color: avgRpe ? (RPE_LABELS[Math.round(avgRpe)]?.color ?? '#9CA3AF') : '#9CA3AF' },
          ].map(kpi => (
            <div key={kpi.label}
              className="rounded-xl p-3 flex flex-col items-center gap-1"
              style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
              <span className="text-xl">{kpi.icon}</span>
              <span className="text-lg font-black leading-none" style={{ color: kpi.color }}>{kpi.value}</span>
              <span className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {kpi.sub ?? kpi.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── This week ─────────────────────────────────────────────── */}
        <div className="mb-2">
          <div className="text-[10px] font-black uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Esta semana
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(d => {
              const hasLog = loggedDates.has(d)
              const isToday = d === today
              const isPast = d < today
              const date = new Date(d + 'T12:00')
              const weekdayNum = date.getDay()
              const dayLogs = logs.filter(l => l.logged_at === d)
              return (
                <button
                  key={d}
                  onClick={() => {
                    if (!isPast && !isToday) return
                    const existingLog = dayLogs[0] ?? null
                    setModal({ day: null, date: d, existingLog })
                  }}
                  disabled={!isPast && !isToday}
                  className="flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all"
                  style={{
                    background: hasLog ? 'rgba(74,222,128,0.12)' : isToday ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${hasLog ? 'rgba(74,222,128,0.25)' : isToday ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    opacity: !isPast && !isToday ? 0.4 : 1,
                  }}
                >
                  <span className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {WEEKDAY_ABBR[weekdayNum]}
                  </span>
                  <span className="text-base">{hasLog ? '✅' : isToday ? '⬜' : '—'}</span>
                  <span className="text-[10px] font-bold"
                    style={{ color: hasLog ? '#4ADE80' : isToday ? '#93C5FD' : 'rgba(255,255,255,0.2)' }}>
                    {date.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Workout days to log ────────────────────────────────────── */}
        {days.length > 0 && (
          <div className="mb-5">
            <div className="text-[10px] font-black uppercase tracking-[2px] mb-3 mt-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Registrar pelo plano
            </div>
            <div className="space-y-2">
              {days.map(day => {
                const key = `${today}_${day.id}`
                const todayLog = logsByDate.get(key)
                const muscles = [...new Set(day.workout_exercises.map(e => e.exercise.muscle_group).filter(Boolean))]
                return (
                  <div key={day.id}
                    className="rounded-xl p-4 flex items-center gap-4"
                    style={{
                      background: todayLog ? 'rgba(74,222,128,0.08)' : 'var(--dark-card)',
                      border: `1px solid ${todayLog ? 'rgba(74,222,128,0.22)' : 'var(--dark-border)'}`,
                    }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{day.name}</div>
                      <div className="text-[10px] mt-0.5 flex flex-wrap gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {day.workout_exercises.length} exercício{day.workout_exercises.length !== 1 ? 's' : ''}
                        {muscles.slice(0, 3).map(m => (
                          <span key={m}
                            className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                            {m}
                          </span>
                        ))}
                      </div>
                      {todayLog && (
                        <div className="flex items-center gap-2 mt-1">
                          {todayLog.duration_min && (
                            <span className="text-[10px]" style={{ color: '#4ADE80' }}>
                              ⏱ {todayLog.duration_min}min
                            </span>
                          )}
                          {todayLog.rpe && (
                            <span className="text-[10px]" style={{ color: RPE_LABELS[todayLog.rpe]?.color }}>
                              RPE {todayLog.rpe} {RPE_LABELS[todayLog.rpe]?.emoji}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setModal({ day, date: today, existingLog: todayLog ?? null })}
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all"
                      style={{
                        background: todayLog ? 'rgba(74,222,128,0.15)' : 'rgba(37,99,235,0.15)',
                        border: `1px solid ${todayLog ? 'rgba(74,222,128,0.3)' : 'rgba(37,99,235,0.3)'}`,
                      }}
                      title={todayLog ? 'Editar registro' : 'Marcar como feito'}
                    >
                      {todayLog ? '✅' : '⬜'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Recent history ─────────────────────────────────────────── */}
        {logs.length > 0 && (
          <div className="mb-5">
            <div className="text-[10px] font-black uppercase tracking-[2px] mb-3 mt-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Histórico recente
            </div>

            {/* Heatmap for last 30 days */}
            <div className="rounded-xl p-4 mb-3"
              style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
              <div className="text-[10px] font-bold mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Últimos 30 dias
              </div>
              <div className="flex gap-1 flex-wrap">
                {last30.map(d => {
                  const has = loggedDates.has(d)
                  const isT = d === today
                  return (
                    <div key={d}
                      className="w-6 h-6 rounded flex items-center justify-center text-xs"
                      title={`${fmtDate(d)}${has ? ' ✅' : ''}`}
                      style={{
                        background: has ? 'rgba(74,222,128,0.4)' : isT ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${has ? 'rgba(74,222,128,0.3)' : isT ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        fontSize: '8px',
                      }}
                    >
                      {has ? '✓' : ''}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Log list */}
            <div className="space-y-2">
              {[...logs]
                .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
                .slice(0, 10)
                .map(log => {
                  const dayName = days.find(d => d.id === log.workout_day_id)?.name ?? 'Treino livre'
                  return (
                    <div key={log.id}
                      className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                      <div className="text-xl">✅</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">{dayName}</div>
                        <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          <span>{fmtDate(log.logged_at)}</span>
                          {log.duration_min && <span>⏱ {log.duration_min}min</span>}
                          {log.rpe && (
                            <span style={{ color: RPE_LABELS[log.rpe]?.color }}>
                              RPE {log.rpe} {RPE_LABELS[log.rpe]?.emoji}
                            </span>
                          )}
                        </div>
                        {log.notes && (
                          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {log.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-xs p-1.5 rounded-lg"
                        style={{ color: 'rgba(255,255,255,0.2)' }}
                        title="Remover registro"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && logs.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏋️</div>
            <div className="text-white font-bold text-lg mb-2">Nenhum treino registrado</div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Comece marcando seu primeiro treino de hoje!
            </div>
            <button
              onClick={() => setModal({ day: days[0] ?? null, date: today, existingLog: null })}
              className="px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: '#2563EB', color: '#fff' }}
            >
              ✅ Registrar treino de hoje
            </button>
          </div>
        )}

      </div>

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {modal && (
        <LogModal
          day={modal.day}
          date={modal.date}
          existingLog={modal.existingLog}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
