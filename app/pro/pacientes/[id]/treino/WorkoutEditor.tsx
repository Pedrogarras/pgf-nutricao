'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Patient, Exercise } from '@/lib/types'

interface WExercise { id: string; exercise: Exercise; sets: number | null; reps: string | null; rest_seconds: number | null; notes: string | null; sort_order: number }
interface WDay { id: string; name: string; sort_order: number; workout_exercises: WExercise[] }
interface WPlan { id: string; title: string; published_at: string | null; workout_days: WDay[] }

export default function WorkoutEditor({ patient, plan, exercises }: { patient: Patient; plan: WPlan; exercises: Exercise[] }) {
  const [days, setDays] = useState<WDay[]>(plan.workout_days ?? [])
  const [addDayOpen, setAddDayOpen] = useState(false)
  const [addExerciseFor, setAddExerciseFor] = useState<string | null>(null)
  const [editingEx, setEditingEx] = useState<{ we: WExercise; dayId: string } | null>(null)
  const [renamingDayId, setRenamingDayId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [toast, setToast] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [deletingDay, setDeletingDay] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [exSearch, setExSearch] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Day operations ──

  async function handleAddDay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/workout/days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workout_plan_id: plan.id, name: fd.get('name'), sort_order: days.length })
    })
    const data = await res.json()
    if (data.day) setDays(prev => [...prev, { ...data.day, workout_exercises: [] }])
    setAddDayOpen(false)
  }

  async function handleRenameDay(dayId: string) {
    const name = renameVal.trim()
    if (!name) { setRenamingDayId(null); return }
    await fetch(`/api/workout/days/${dayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, name } : d))
    setRenamingDayId(null)
  }

  async function handleDeleteDay(day: WDay) {
    if (!confirm(`Excluir "${day.name}" e todos os seus ${day.workout_exercises.length} exercício(s)?`)) return
    setDeletingDay(day.id)
    await fetch(`/api/workout/days/${day.id}`, { method: 'DELETE' })
    setDays(prev => prev.filter(d => d.id !== day.id))
    setDeletingDay(null)
  }

  // ── Exercise operations ──

  async function handleAddExercise(dayId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/workout/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workout_day_id: dayId, exercise_id: fd.get('exercise_id'),
        sets: Number(fd.get('sets') || 0), reps: fd.get('reps'),
        rest_seconds: Number(fd.get('rest_seconds') || 60), notes: fd.get('notes'),
        sort_order: days.find(d => d.id === dayId)?.workout_exercises.length ?? 0
      })
    })
    const data = await res.json()
    if (data.exercise) {
      const ex = exercises.find(e => e.id === data.exercise.exercise_id)
      setDays(prev => prev.map(d => d.id === dayId ? { ...d, workout_exercises: [...d.workout_exercises, { ...data.exercise, exercise: ex! }] } : d))
    }
    setAddExerciseFor(null)
    setExSearch('')
  }

  async function handleEditExercise(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingEx) return
    setEditLoading(true)
    const fd = new FormData(e.currentTarget)
    const res = await fetch(`/api/workout/exercises/${editingEx.we.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sets: fd.get('sets') || null,
        reps: fd.get('reps') || null,
        rest_seconds: fd.get('rest_seconds') || null,
        notes: fd.get('notes') || null,
      }),
    })
    const data = await res.json()
    if (data.exercise) {
      setDays(prev => prev.map(d =>
        d.id === editingEx.dayId
          ? { ...d, workout_exercises: d.workout_exercises.map(we => we.id === editingEx.we.id ? { ...we, ...data.exercise } : we) }
          : d
      ))
    }
    setEditingEx(null)
    setEditLoading(false)
  }

  async function removeExercise(dayId: string, weId: string) {
    if (!confirm('Remover este exercício?')) return
    await fetch(`/api/workout/exercises/${weId}`, { method: 'DELETE' })
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, workout_exercises: d.workout_exercises.filter(e => e.id !== weId) } : d))
  }

  async function moveExercise(dayId: string, weId: string, dir: 'up' | 'down') {
    setDays(prev => prev.map(d => {
      if (d.id !== dayId) return d
      const exs = [...d.workout_exercises]
      const idx = exs.findIndex(e => e.id === weId)
      if (idx < 0) return d
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= exs.length) return d
      ;[exs[idx], exs[swapIdx]] = [exs[swapIdx], exs[idx]]
      return { ...d, workout_exercises: exs }
    }))
    // Persist sort orders
    const day = days.find(d => d.id === dayId)
    if (!day) return
    const exs = [...day.workout_exercises]
    const idx = exs.findIndex(e => e.id === weId)
    if (idx < 0) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= exs.length) return
    await Promise.all([
      fetch(`/api/workout/exercises/${exs[idx].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: exs[swapIdx].sort_order }) }),
      fetch(`/api/workout/exercises/${exs[swapIdx].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: exs[idx].sort_order }) }),
    ])
  }

  async function handlePublish() {
    setPublishing(true)
    await fetch('/api/workout/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_id: plan.id }) })
    showToast('Treino publicado! O aluno já pode visualizar.')
    setPublishing(false)
  }

  const filteredExercises = exercises.filter(ex =>
    exSearch.length < 2 || ex.name.toLowerCase().includes(exSearch.toLowerCase()) || (ex.muscle_group ?? '').toLowerCase().includes(exSearch.toLowerCase())
  )

  const totalExercises = days.reduce((sum, d) => sum + d.workout_exercises.length, 0)

  return (
    <div>
      <div className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between" style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patient.id}`} className="btn btn-ghost btn-sm text-white/60">← {patient.full_name}</Link>
          <div>
            <div className="font-bold text-white">Plano de Treino</div>
            {days.length > 0 && (
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {days.length} dia{days.length !== 1 ? 's' : ''} · {totalExercises} exercício{totalExercises !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/pro/pacientes/${patient.id}/treino/logs`} className="btn btn-outline btn-sm">📋 Histórico</Link>
          <Link href="/pro/exercicios" className="btn btn-outline btn-sm">Gerenciar exercícios</Link>
          <button onClick={handlePublish} disabled={publishing} className="btn btn-primary btn-sm">
            {publishing ? 'Publicando...' : 'Publicar treino'}
          </button>
        </div>
      </div>

      <div className="p-8">
        {days.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 6.5h11"/><path d="M6.5 12h11"/><path d="M6.5 17.5h11"/>
                <path d="M3 6.5h.01M3 12h.01M3 17.5h.01"/>
              </svg>
            </div>
            <div className="font-semibold text-gray-600 mb-1">Nenhum dia de treino</div>
            <div className="text-sm text-gray-400 mb-4">Adicione o primeiro dia (ex: Treino A, Treino B...)</div>
            <button onClick={() => setAddDayOpen(true)} className="btn btn-primary">+ Adicionar Dia de Treino</button>
          </div>
        )}

        <div className="space-y-4">
          {days.map((day, dayIdx) => (
            <div key={day.id} className="card overflow-hidden">
              {/* Day header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-pgf-50 border-b border-pgf-100">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {renamingDayId === day.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameDay(day.id)
                          if (e.key === 'Escape') setRenamingDayId(null)
                        }}
                        className="form-input text-sm py-1 flex-1"
                        autoFocus
                      />
                      <button onClick={() => handleRenameDay(day.id)} className="text-pgf-600 text-xs font-bold">✓</button>
                      <button onClick={() => setRenamingDayId(null)} className="text-gray-400 text-xs">✕</button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-pgf-700">{day.name}</span>
                      <span className="text-xs text-gray-400">{day.workout_exercises.length} exercício{day.workout_exercises.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
                {renamingDayId !== day.id && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setRenamingDayId(day.id); setRenameVal(day.name) }}
                      className="text-gray-300 hover:text-pgf-500 transition-colors"
                      title="Renomear dia"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {/* Move day up/down */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={dayIdx === 0}
                        onClick={() => {
                          const newDays = [...days]
                          ;[newDays[dayIdx - 1], newDays[dayIdx]] = [newDays[dayIdx], newDays[dayIdx - 1]]
                          setDays(newDays)
                        }}
                        className="text-gray-300 hover:text-pgf-500 disabled:opacity-20 transition-colors"
                        title="Mover para cima"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <button
                        disabled={dayIdx === days.length - 1}
                        onClick={() => {
                          const newDays = [...days]
                          ;[newDays[dayIdx], newDays[dayIdx + 1]] = [newDays[dayIdx + 1], newDays[dayIdx]]
                          setDays(newDays)
                        }}
                        className="text-gray-300 hover:text-pgf-500 disabled:opacity-20 transition-colors"
                        title="Mover para baixo"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                    <button
                      onClick={() => handleDeleteDay(day)}
                      disabled={deletingDay === day.id}
                      className="text-gray-200 hover:text-red-400 transition-colors ml-1"
                      title="Excluir dia"
                    >
                      {deletingDay === day.id ? '...' : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="px-5 pb-4">
                {day.workout_exercises.length > 0 && (
                  <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 border-b border-gray-100"
                    style={{ gridTemplateColumns: '1fr 70px 80px 80px 1fr 56px' }}>
                    <span>Exercício</span>
                    <span className="text-center">Séries</span>
                    <span className="text-center">Reps</span>
                    <span className="text-center">Descanso</span>
                    <span>Observação</span>
                    <span></span>
                  </div>
                )}
                {day.workout_exercises.map((we, exIdx) => (
                  <div key={we.id} className="grid items-center py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/40 group"
                    style={{ gridTemplateColumns: '1fr 70px 80px 80px 1fr 56px' }}>
                    <div>
                      <div className="font-medium text-sm">{we.exercise.name}</div>
                      {we.exercise.muscle_group && <div className="text-xs text-pgf-500">{we.exercise.muscle_group}</div>}
                      {we.exercise.video_url && (
                        <a href={we.exercise.video_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-pgf-400 hover:text-pgf-600 underline">Ver vídeo</a>
                      )}
                    </div>
                    <span className="text-center text-sm font-bold text-gray-700">{we.sets ?? '—'}</span>
                    <span className="text-center text-sm font-bold text-gray-700">{we.reps ?? '—'}</span>
                    <span className="text-center text-xs text-gray-400">{we.rest_seconds ? `${we.rest_seconds}s` : '—'}</span>
                    <span className="text-xs text-gray-400 px-2 truncate">{we.notes ?? ''}</span>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0">
                        <button
                          disabled={exIdx === 0}
                          onClick={() => moveExercise(day.id, we.id, 'up')}
                          className="text-gray-200 hover:text-pgf-500 disabled:opacity-20 transition-colors"
                          title="Mover para cima"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button
                          disabled={exIdx === day.workout_exercises.length - 1}
                          onClick={() => moveExercise(day.id, we.id, 'down')}
                          className="text-gray-200 hover:text-pgf-500 disabled:opacity-20 transition-colors"
                          title="Mover para baixo"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>
                      <button
                        onClick={() => setEditingEx({ we, dayId: day.id })}
                        className="text-gray-300 hover:text-pgf-500 transition-colors"
                        title="Editar"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => removeExercise(day.id, we.id)}
                        className="text-gray-200 hover:text-red-400 transition-colors"
                        title="Remover"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                <button onClick={() => { setAddExerciseFor(day.id); setExSearch('') }}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-pgf-200 rounded-lg text-sm text-pgf-500 hover:bg-pgf-50 hover:border-pgf-400 transition-all">
                  + Adicionar exercício
                </button>

                {addExerciseFor === day.id && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddExerciseFor(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                      <h3 className="font-bold text-lg mb-4">Adicionar Exercício — {day.name}</h3>
                      <form onSubmit={e => handleAddExercise(day.id, e)} className="space-y-4">
                        <div>
                          <label className="form-label">Exercício *</label>
                          <input
                            value={exSearch}
                            onChange={e => setExSearch(e.target.value)}
                            className="form-input mb-2"
                            placeholder="Filtrar exercícios..."
                          />
                          <select name="exercise_id" required className="form-select">
                            <option value="">Selecione um exercício</option>
                            {filteredExercises.map(ex => (
                              <option key={ex.id} value={ex.id}>{ex.name}{ex.muscle_group ? ` — ${ex.muscle_group}` : ''}</option>
                            ))}
                          </select>
                          {exercises.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">Nenhum exercício cadastrado ainda.{' '}
                              <Link href="/pro/exercicios" className="underline">Adicionar exercícios</Link>
                            </p>
                          )}
                          {exercises.length > 0 && filteredExercises.length === 0 && (
                            <p className="text-xs text-gray-400 mt-1">Nenhum exercício encontrado para &ldquo;{exSearch}&rdquo;.</p>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="form-label">Séries</label><input name="sets" type="number" defaultValue="3" className="form-input" /></div>
                          <div><label className="form-label">Reps</label><input name="reps" defaultValue="12" placeholder="12 ou 8-12" className="form-input" /></div>
                          <div><label className="form-label">Descanso (s)</label><input name="rest_seconds" type="number" defaultValue="60" className="form-input" /></div>
                        </div>
                        <div><label className="form-label">Observações</label><input name="notes" className="form-input" placeholder="Cadência, atenção ao movimento..." /></div>
                        <div className="flex justify-end gap-3">
                          <button type="button" onClick={() => setAddExerciseFor(null)} className="btn btn-ghost">Cancelar</button>
                          <button type="submit" className="btn btn-primary">Adicionar</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {days.length > 0 && (
          <button onClick={() => setAddDayOpen(true)} className="btn btn-outline mt-4">+ Novo Dia de Treino</button>
        )}
      </div>

      {/* Add Day Modal */}
      {addDayOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddDayOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Novo Dia de Treino</h3>
            <form onSubmit={handleAddDay} className="space-y-4">
              <div>
                <label className="form-label">Nome do treino *</label>
                <input name="name" required className="form-input" placeholder="Ex: Treino A — Peito e Tríceps" autoFocus />
                <div className="text-[10px] text-gray-400 mt-1">Sugestões: Treino A · B · C · Full Body · Superior · Inferior · Cardio</div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setAddDayOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Exercise Modal */}
      {editingEx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingEx(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Editar Exercício</h3>
            <div className="text-sm text-gray-500 mb-4">{editingEx.we.exercise.name}</div>
            <form onSubmit={handleEditExercise} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="form-label">Séries</label><input name="sets" type="number" defaultValue={editingEx.we.sets ?? ''} className="form-input" placeholder="3" /></div>
                <div><label className="form-label">Reps</label><input name="reps" defaultValue={editingEx.we.reps ?? ''} placeholder="12" className="form-input" /></div>
                <div><label className="form-label">Descanso (s)</label><input name="rest_seconds" type="number" defaultValue={editingEx.we.rest_seconds ?? ''} className="form-input" placeholder="60" /></div>
              </div>
              <div><label className="form-label">Observações</label><input name="notes" defaultValue={editingEx.we.notes ?? ''} className="form-input" placeholder="Cadência, atenção ao movimento..." /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditingEx(null)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
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
