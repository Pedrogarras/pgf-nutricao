'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Goal {
  id: string
  metric: string
  label: string
  target_value: number
  current_value: number | null
  start_value: number | null
  unit: string
  direction: 'decrease' | 'increase'
  deadline: string | null
  achieved: boolean
  achieved_at: string | null
  notes: string | null
}

interface Props {
  patient: { id: string; full_name: string; weight_kg: number | null; height_cm: number | null }
  initialGoals: Goal[]
  latestRecord: { weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null; waist_cm: number | null } | null
  patientId: string
}

const METRIC_PRESETS = [
  { metric: 'weight_kg',      label: 'Peso',            unit: 'kg',  direction: 'decrease' as const, icon: '⚖️' },
  { metric: 'body_fat_pct',   label: '% Gordura',       unit: '%',   direction: 'decrease' as const, icon: '🔥' },
  { metric: 'muscle_mass_kg', label: 'Massa muscular',  unit: 'kg',  direction: 'increase' as const, icon: '💪' },
  { metric: 'waist_cm',       label: 'Cintura',         unit: 'cm',  direction: 'decrease' as const, icon: '📏' },
  { metric: 'bmi',            label: 'IMC',             unit: '',    direction: 'decrease' as const, icon: '📊' },
  { metric: 'custom',         label: 'Personalizado',   unit: '',    direction: 'decrease' as const, icon: '🎯' },
]

function GoalProgressBar({ goal }: { goal: Goal }) {
  const start = goal.start_value
  const current = goal.current_value
  const target = goal.target_value

  if (start == null || current == null) {
    return (
      <div className="mt-2">
        <div className="h-2 bg-gray-100 rounded-full" />
        <div className="text-[10px] text-gray-400 mt-1">Sem medição inicial</div>
      </div>
    )
  }

  const totalChange = Math.abs(target - start)
  const achievedChange = Math.abs(current - start)
  const pct = totalChange > 0 ? Math.min(100, Math.round((achievedChange / totalChange) * 100)) : (goal.achieved ? 100 : 0)

  const isOnTrack = goal.direction === 'decrease'
    ? current <= start
    : current >= start

  const remaining = Math.abs(target - current)
  const color = goal.achieved ? 'bg-emerald-500' : isOnTrack ? 'bg-pgf-500' : 'bg-amber-500'

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Inicial: <strong>{start}{goal.unit}</strong></span>
        <span className={`font-bold ${goal.achieved ? 'text-emerald-600' : ''}`}>
          {goal.achieved ? '✓ Atingido!' : `Faltam ${remaining.toFixed(1)}${goal.unit}`}
        </span>
        <span>Meta: <strong>{target}{goal.unit}</strong></span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-400 mt-1 text-right">{pct}% concluído</div>
    </div>
  )
}

export default function MetasClient({ patient, initialGoals, latestRecord, patientId }: Props) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [addOpen, setAddOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // Form state
  const [selectedPreset, setSelectedPreset] = useState(METRIC_PRESETS[0])
  const [customLabel, setCustomLabel] = useState('')
  const [customUnit, setCustomUnit] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [startValue, setStartValue] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [deadline, setDeadline] = useState('')
  const [direction, setDirection] = useState<'decrease' | 'increase'>('decrease')
  const [notes, setNotes] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openAdd() {
    setEditingGoal(null)
    setSelectedPreset(METRIC_PRESETS[0])
    setCustomLabel('')
    setCustomUnit('')
    setTargetValue('')
    setStartValue(String(latestRecord?.weight_kg ?? patient.weight_kg ?? ''))
    setCurrentValue(String(latestRecord?.weight_kg ?? patient.weight_kg ?? ''))
    setDeadline('')
    setDirection('decrease')
    setNotes('')
    setAddOpen(true)
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal)
    const preset = METRIC_PRESETS.find(p => p.metric === goal.metric) ?? METRIC_PRESETS[METRIC_PRESETS.length - 1]
    setSelectedPreset(preset)
    setCustomLabel(goal.label)
    setCustomUnit(goal.unit)
    setTargetValue(String(goal.target_value))
    setStartValue(String(goal.start_value ?? ''))
    setCurrentValue(String(goal.current_value ?? ''))
    setDeadline(goal.deadline ?? '')
    setDirection(goal.direction)
    setNotes(goal.notes ?? '')
    setAddOpen(true)
  }

  function handlePresetChange(preset: typeof METRIC_PRESETS[0]) {
    setSelectedPreset(preset)
    setDirection(preset.direction)
    if (preset.metric !== 'custom') {
      // Auto-fill current value from latest record
      const recordMap: Record<string, number | null | undefined> = {
        weight_kg: latestRecord?.weight_kg ?? patient.weight_kg,
        body_fat_pct: latestRecord?.body_fat_pct,
        muscle_mass_kg: latestRecord?.muscle_mass_kg,
        waist_cm: latestRecord?.waist_cm,
      }
      const val = recordMap[preset.metric]
      if (val) { setStartValue(String(val)); setCurrentValue(String(val)) }
    }
  }

  async function handleSave() {
    const label = selectedPreset.metric === 'custom' ? customLabel : selectedPreset.label
    const unit = selectedPreset.metric === 'custom' ? customUnit : selectedPreset.unit
    if (!label || !targetValue) return
    setSaving(true)

    const payload = {
      patient_id: patientId,
      metric: selectedPreset.metric,
      label,
      unit,
      target_value: Number(targetValue),
      start_value: startValue ? Number(startValue) : null,
      current_value: currentValue ? Number(currentValue) : null,
      direction,
      deadline: deadline || null,
      notes: notes || null,
    }

    const url = editingGoal ? `/api/goals/${editingGoal.id}` : '/api/goals'
    const method = editingGoal ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    setSaving(false)

    if (json.goal) {
      if (editingGoal) {
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? json.goal : g))
        showToast('Meta atualizada.')
      } else {
        setGoals(prev => [...prev, json.goal])
        showToast('Meta criada!')
      }
      setAddOpen(false)
    }
  }

  async function handleToggleAchieved(goal: Goal) {
    const achieved = !goal.achieved
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achieved, achieved_at: achieved ? new Date().toISOString().split('T')[0] : null }),
    })
    const json = await res.json()
    if (json.goal) {
      setGoals(prev => prev.map(g => g.id === goal.id ? json.goal : g))
      showToast(achieved ? '🎉 Meta marcada como atingida!' : 'Meta reaberta.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta meta?')) return
    setDeletingId(id)
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(g => g.id !== id))
    setDeletingId(null)
    showToast('Meta excluída.')
  }

  const activeGoals = goals.filter(g => !g.achieved)
  const achievedGoals = goals.filter(g => g.achieved)

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patientId}`} className="text-pgf-400 hover:text-pgf-300 text-sm">
            ← {patient.full_name}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">🎯 Metas Clínicas</h1>
        </div>
        <button onClick={openAdd} className="btn btn-primary btn-sm">+ Nova meta</button>
      </div>

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Metas ativas</div>
            <div className="text-2xl font-black text-pgf-600 my-1">{activeGoals.length}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Metas atingidas</div>
            <div className="text-2xl font-black text-emerald-600 my-1">{achievedGoals.length}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Taxa de sucesso</div>
            <div className="text-2xl font-black text-gray-900 my-1">
              {goals.length > 0 ? `${Math.round((achievedGoals.length / goals.length) * 100)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Metas em andamento</h2>
            <div className="grid grid-cols-2 gap-4">
              {activeGoals.map(goal => {
                const preset = METRIC_PRESETS.find(p => p.metric === goal.metric)
                return (
                  <div key={goal.id} className="card p-5 group">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{preset?.icon ?? '🎯'}</span>
                        <div>
                          <div className="font-bold text-gray-900">{goal.label}</div>
                          <div className="text-2xl font-black text-pgf-600">{goal.current_value ?? '—'}{goal.unit}</div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(goal)} className="text-gray-400 hover:text-pgf-600 text-xs px-2 py-1 rounded hover:bg-pgf-50 transition-all">Editar</button>
                        <button onClick={() => handleToggleAchieved(goal)} className="text-emerald-600 text-xs px-2 py-1 rounded hover:bg-emerald-50 transition-all font-semibold">✓ Atingida</button>
                        <button onClick={() => handleDelete(goal.id)} disabled={deletingId === goal.id} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                      </div>
                    </div>

                    <GoalProgressBar goal={goal} />

                    {goal.deadline && (
                      <div className="mt-2 text-xs text-gray-400">
                        📅 Prazo: {new Date(goal.deadline + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {goal.notes && <div className="mt-2 text-xs text-gray-500 italic">{goal.notes}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Achieved goals */}
        {achievedGoals.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">🎉 Metas atingidas</h2>
            <div className="grid grid-cols-2 gap-4">
              {achievedGoals.map(goal => {
                const preset = METRIC_PRESETS.find(p => p.metric === goal.metric)
                return (
                  <div key={goal.id} className="card p-5 bg-emerald-50/50 border-emerald-200 group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{preset?.icon ?? '🎯'}</span>
                        <div>
                          <div className="font-bold text-gray-700">{goal.label}</div>
                          <div className="text-sm text-emerald-600 font-semibold">
                            {goal.target_value}{goal.unit} ✓
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleToggleAchieved(goal)} className="text-xs text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-all">Reabrir</button>
                        <button onClick={() => handleDelete(goal.id)} disabled={deletingId === goal.id} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                      </div>
                    </div>
                    {goal.achieved_at && (
                      <div className="mt-2 text-xs text-emerald-600">
                        ✓ Atingida em {new Date(goal.achieved_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {goals.length === 0 && (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma meta definida</h3>
            <p className="text-sm text-gray-500 mb-6">
              Defina metas clínicas mensuráveis para acompanhar o progresso do paciente.
            </p>
            <button onClick={openAdd} className="btn btn-primary mx-auto">+ Criar primeira meta</button>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">{editingGoal ? 'Editar Meta' : 'Nova Meta Clínica'}</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Metric selector */}
              <div>
                <label className="form-label">Tipo de meta</label>
                <div className="grid grid-cols-3 gap-2">
                  {METRIC_PRESETS.map(p => (
                    <button
                      key={p.metric}
                      type="button"
                      onClick={() => handlePresetChange(p)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm ${selectedPreset.metric === p.metric ? 'border-pgf-400 bg-pgf-50 text-pgf-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      <span>{p.icon}</span><span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedPreset.metric === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Nome da meta</label>
                    <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} className="form-input" placeholder="Ex: Percentual de aderência" />
                  </div>
                  <div>
                    <label className="form-label">Unidade</label>
                    <input value={customUnit} onChange={e => setCustomUnit(e.target.value)} className="form-input" placeholder="%, kg, cm..." />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Valor inicial</label>
                  <input type="number" step="0.1" value={startValue} onChange={e => setStartValue(e.target.value)} className="form-input" placeholder="Atual" />
                </div>
                <div>
                  <label className="form-label">Valor alvo</label>
                  <input type="number" step="0.1" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="form-input" placeholder="Meta" required />
                </div>
                <div>
                  <label className="form-label">Valor atual</label>
                  <input type="number" step="0.1" value={currentValue} onChange={e => setCurrentValue(e.target.value)} className="form-input" placeholder="Agora" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Direção</label>
                  <select value={direction} onChange={e => setDirection(e.target.value as 'decrease' | 'increase')} className="form-select">
                    <option value="decrease">↓ Diminuir</option>
                    <option value="increase">↑ Aumentar</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Prazo</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="form-input" />
                </div>
              </div>

              <div>
                <label className="form-label">Observações</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="form-input" rows={2} placeholder="Notas sobre esta meta..." />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost flex-1">Cancelar</button>
                <button type="button" onClick={handleSave} disabled={saving || !targetValue} className="btn btn-primary flex-1">
                  {saving ? 'Salvando...' : editingGoal ? 'Atualizar meta' : '🎯 Criar meta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
