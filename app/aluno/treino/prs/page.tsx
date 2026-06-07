'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface PR {
  id: string
  exercise_name: string
  metric: 'weight_kg' | 'reps' | 'time_sec' | 'distance_m' | 'custom'
  value: number
  unit_label: string | null
  notes: string | null
  achieved_at: string
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const METRICS = [
  { key: 'weight_kg',  label: 'Carga máxima',    unit: 'kg',   icon: '🏋️' },
  { key: 'reps',       label: 'Máx. repetições',  unit: 'reps', icon: '🔢' },
  { key: 'time_sec',   label: 'Melhor tempo',     unit: 's',    icon: '⏱' },
  { key: 'distance_m', label: 'Maior distância',  unit: 'm',    icon: '📏' },
  { key: 'custom',     label: 'Personalizado',    unit: '',     icon: '✏️' },
] as const

type MetricKey = typeof METRICS[number]['key']

function metricInfo(key: string) {
  return METRICS.find(m => m.key === key) ?? METRICS[4]
}

function fmtValue(pr: PR) {
  if (pr.metric === 'time_sec') {
    const min = Math.floor(pr.value / 60)
    const sec = Math.round(pr.value % 60)
    return min > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${sec}s`
  }
  const unit = pr.unit_label ?? metricInfo(pr.metric).unit
  return `${pr.value}${unit ? ` ${unit}` : ''}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ─── Quick exercise suggestions ────────────────────────────────────────── */
const QUICK_EXERCISES = [
  'Supino reto', 'Agachamento', 'Levantamento terra', 'Desenvolvimento',
  'Remada curvada', 'Rosca direta', 'Tríceps testa', 'Leg press',
  'Cadeira extensora', 'Mesa flexora', 'Pulldown', 'Crucifixo',
]

/* ─── Add PR Modal ──────────────────────────────────────────────────────── */
function AddPRModal({
  onClose,
  onSave,
  editing,
}: {
  onClose: () => void
  onSave: (pr: PR) => void
  editing: PR | null
}) {
  const [exerciseName, setExerciseName] = useState(editing?.exercise_name ?? '')
  const [metric, setMetric] = useState<MetricKey>(editing?.metric ?? 'weight_kg')
  const [value, setValue] = useState(editing ? String(editing.value) : '')
  const [unitLabel, setUnitLabel] = useState(editing?.unit_label ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [achievedAt, setAchievedAt] = useState(editing?.achieved_at ?? new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = QUICK_EXERCISES.filter(e =>
    exerciseName.length >= 1 && e.toLowerCase().includes(exerciseName.toLowerCase()) && e !== exerciseName
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(value)
    if (!exerciseName.trim() || isNaN(v) || v <= 0) return
    setSaving(true)

    const payload = {
      exercise_name: exerciseName.trim(),
      metric,
      value: v,
      unit_label: metric === 'custom' ? (unitLabel || null) : null,
      notes: notes.trim() || null,
      achieved_at: achievedAt,
    }

    const url = editing ? `/api/exercise-prs/${editing.id}` : '/api/exercise-prs'
    const method = editing ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.pr) onSave(data.pr)
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl overflow-y-auto max-h-[90vh]"
        style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-8 pt-2 space-y-4">
          <h2 className="text-base font-black text-white">
            {editing ? '✏️ Editar PR' : '🏆 Novo PR'}
          </h2>

          {/* Exercise name */}
          <div className="relative">
            <label className="text-[10px] font-bold uppercase tracking-[2px] mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Exercício
            </label>
            <input
              type="text"
              value={exerciseName}
              onChange={e => { setExerciseName(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="ex: Supino reto, Agachamento…"
              className="w-full rounded-xl px-4 py-3 text-white text-sm"
              style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
              required
            />
            {showSuggestions && filtered.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl overflow-hidden shadow-xl"
                style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
              >
                {filtered.slice(0, 6).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setExerciseName(s); setShowSuggestions(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:opacity-80"
                    style={{ borderBottom: '1px solid var(--dark-border)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Metric */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[2px] mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Tipo de marca
            </label>
            <div className="grid grid-cols-3 gap-2">
              {METRICS.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  className="rounded-xl py-2.5 px-2 text-center transition-all active:scale-95"
                  style={{
                    background: metric === m.key ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${metric === m.key ? 'rgba(37,99,235,0.6)' : 'var(--dark-border)'}`,
                    color: metric === m.key ? '#93C5FD' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <div className="text-base mb-0.5">{m.icon}</div>
                  <div className="text-[9px] font-bold leading-tight">{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Value */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-[2px] mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {metric === 'weight_kg' ? 'Carga (kg)' : metric === 'reps' ? 'Repetições' : metric === 'time_sec' ? 'Tempo (s)' : metric === 'distance_m' ? 'Distância (m)' : 'Valor'}
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm"
                style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
                placeholder={metric === 'weight_kg' ? '0.0' : '0'}
                required
              />
            </div>
            {metric === 'custom' && (
              <div className="w-24">
                <label className="text-[10px] font-bold uppercase tracking-[2px] mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Unidade
                </label>
                <input
                  type="text"
                  value={unitLabel}
                  onChange={e => setUnitLabel(e.target.value)}
                  className="w-full rounded-xl px-3 py-3 text-white text-sm"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
                  placeholder="kg, m…"
                />
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[2px] mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Data
            </label>
            <input
              type="date"
              value={achievedAt}
              onChange={e => setAchievedAt(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-white text-sm"
              style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', colorScheme: 'dark' }}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[2px] mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="ex: Série completa, padrão de movimento bom…"
              className="w-full rounded-xl px-4 py-2.5 text-white text-sm resize-none"
              style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl text-sm font-black text-white transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
            >
              {saving ? 'Salvando…' : editing ? 'Atualizar' : '🏆 Registrar PR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Exercise group card ─────────────────────────────────────────────────── */
function ExerciseCard({
  name,
  records,
  onEdit,
  onDelete,
}: {
  name: string
  records: PR[]
  onEdit: (pr: PR) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const best = records[0] // sorted newest first; but we want best value
  const sorted = [...records].sort((a, b) => {
    // For time, lower is better; for everything else, higher is better
    if (a.metric === 'time_sec') return a.value - b.value
    return b.value - a.value
  })
  const allTimeBest = sorted[0]

  const m = metricInfo(best.metric)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: 'rgba(37,99,235,0.12)' }}
        >
          {m.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white truncate">{name}</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {m.label} · {records.length} registro{records.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-black" style={{ color: '#FCD34D' }}>
            🏆 {fmtValue(allTimeBest)}
          </div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {fmtDate(allTimeBest.achieved_at)}
          </div>
        </div>
        <div className="ml-2 text-gray-600 text-sm">{expanded ? '▲' : '▼'}</div>
      </button>

      {/* History */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--dark-border)' }}>
          {records.map((pr, i) => {
            const isBest = pr.id === allTimeBest.id
            return (
              <div
                key={pr.id}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{
                  borderBottom: i < records.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                  background: isBest ? 'rgba(251,191,36,0.04)' : undefined,
                }}
              >
                <div className="w-5 text-center flex-shrink-0">
                  {isBest ? <span className="text-sm">🥇</span> : (
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: isBest ? '#FCD34D' : 'rgba(255,255,255,0.8)' }}>
                    {fmtValue(pr)}
                  </div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {fmtDate(pr.achieved_at)}
                    {pr.notes && ` · ${pr.notes}`}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => onEdit(pr)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD' }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDelete(pr.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function PRsPage() {
  const [prs, setPRs] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PR | null>(null)
  const [search, setSearch] = useState('')

  const loadPRs = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/exercise-prs')
    const data = await res.json()
    setPRs(data.prs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadPRs() }, [loadPRs])

  function handleSave(pr: PR) {
    setPRs(prev => {
      const existing = prev.findIndex(p => p.id === pr.id)
      if (existing >= 0) return prev.map(p => p.id === pr.id ? pr : p)
      return [pr, ...prev]
    })
    setShowModal(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return
    await fetch(`/api/exercise-prs/${id}`, { method: 'DELETE' })
    setPRs(prev => prev.filter(p => p.id !== id))
  }

  function openEdit(pr: PR) {
    setEditing(pr)
    setShowModal(true)
  }

  // Group by exercise name, sorted newest first within each group
  const grouped = prs
    .filter(pr => !search || pr.exercise_name.toLowerCase().includes(search.toLowerCase()))
    .reduce((acc, pr) => {
      const key = pr.exercise_name
      if (!acc[key]) acc[key] = []
      acc[key].push(pr)
      return acc
    }, {} as Record<string, PR[]>)

  // Sort groups by most recent PR date
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const latestA = a[1].reduce((m, p) => p.achieved_at > m ? p.achieved_at : m, '')
    const latestB = b[1].reduce((m, p) => p.achieved_at > m ? p.achieved_at : m, '')
    return latestB.localeCompare(latestA)
  })

  const totalExercises = Object.keys(grouped).length
  const thisMonthPRs = prs.filter(pr => {
    const now = new Date()
    const d = new Date(pr.achieved_at + 'T12:00')
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <Link href="/aluno/treino" className="text-pgf-400 hover:text-pgf-300 text-sm">
          ← Treino
        </Link>
        <h1 className="text-sm font-bold text-white">🏆 Meus PRs</h1>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="text-xs font-bold px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.3)' }}
        >
          + Novo
        </button>
      </div>

      <div className="p-4 max-w-sm mx-auto space-y-4">

        {/* KPI strip */}
        {prs.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Exercícios', value: totalExercises, color: '#93C5FD' },
              { label: 'Total PRs', value: prs.length, color: '#4ADE80' },
              { label: 'Este mês', value: thisMonthPRs, color: '#FCD34D' },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-2xl p-3 text-center"
                style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
              >
                <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {prs.length > 3 && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar exercício…"
            className="w-full rounded-2xl px-4 py-3 text-white text-sm"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
          />
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-4xl animate-pulse">🏆</div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Carregando…</div>
          </div>
        ) : sortedGroups.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
          >
            <div className="text-5xl mb-4">🏆</div>
            <div className="text-base font-black text-white mb-2">
              {search ? 'Nenhum exercício encontrado' : 'Nenhum PR registrado'}
            </div>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {search
                ? `Tente outro nome de exercício.`
                : 'Registre suas marcas pessoais para acompanhar sua evolução!'
              }
            </p>
            {!search && (
              <button
                onClick={() => { setEditing(null); setShowModal(true) }}
                className="px-6 py-3 rounded-xl text-sm font-black text-white"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
              >
                🏆 Registrar meu primeiro PR
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedGroups.map(([name, records]) => (
              <ExerciseCard
                key={name}
                name={name}
                records={records.sort((a, b) => b.achieved_at.localeCompare(a.achieved_at))}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Tips card */}
        {prs.length === 0 && !loading && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}
          >
            <div className="text-xs font-bold text-amber-400 mb-2">💡 Por que registrar seus PRs?</div>
            <ul className="space-y-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <li>• Acompanhe sua evolução de força ao longo do tempo</li>
              <li>• Celebrate cada novo recorde pessoal</li>
              <li>• Identifique exercícios onde você mais evolui</li>
              <li>• Compartilhe progressos com seu profissional</li>
            </ul>
          </div>
        )}

        <div style={{ height: 'env(safe-area-inset-bottom, 24px)', minHeight: 24 }} />
      </div>

      {showModal && (
        <AddPRModal
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
          editing={editing}
        />
      )}
    </div>
  )
}
