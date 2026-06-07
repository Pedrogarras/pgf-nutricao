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
  const [toast, setToast] = useState('')
  const [publishing, setPublishing] = useState(false)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

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
  }

  async function handlePublish() {
    setPublishing(true)
    await fetch('/api/workout/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_id: plan.id }) })
    showToast('Treino publicado! O aluno já pode visualizar.')
    setPublishing(false)
  }

  async function removeExercise(dayId: string, weId: string) {
    await fetch(`/api/workout/exercises/${weId}`, { method: 'DELETE' })
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, workout_exercises: d.workout_exercises.filter(e => e.id !== weId) } : d))
  }

  return (
    <div>
      <div className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between" style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patient.id}`} className="btn btn-ghost btn-sm text-white/60">← {patient.full_name}</Link>
          <div>
            <div className="font-bold text-white">Plano de Treino</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/pro/exercicios" className="btn btn-outline btn-sm">Gerenciar exercícios</Link>
          <button onClick={handlePublish} disabled={publishing} className="btn btn-primary btn-sm">
            {publishing ? 'Publicando...' : 'Publicar treino'}
          </button>
        </div>
      </div>

      <div className="p-8">
        {days.length === 0 && (
          <div className="text-center py-16">
            <div className="font-semibold text-gray-600 mb-1">Nenhum dia de treino</div>
            <div className="text-sm text-gray-400 mb-4">Adicione o primeiro dia (ex: Treino A, Treino B...)</div>
            <button onClick={() => setAddDayOpen(true)} className="btn btn-primary">+ Adicionar Dia de Treino</button>
          </div>
        )}

        <div className="space-y-4">
          {days.map(day => (
            <div key={day.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-pgf-50 border-b border-pgf-100">
                <div className="font-bold text-pgf-700">{day.name}</div>
                <div className="text-xs text-gray-400">{day.workout_exercises.length} exercício(s)</div>
              </div>
              <div className="px-5 pb-4">
                {day.workout_exercises.length > 0 && (
                  <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 border-b border-gray-100"
                    style={{ gridTemplateColumns: '1fr 80px 80px 80px 1fr 32px' }}>
                    <span>Exercício</span>
                    <span className="text-center">Séries</span>
                    <span className="text-center">Reps</span>
                    <span className="text-center">Descanso</span>
                    <span>Observação</span>
                    <span></span>
                  </div>
                )}
                {day.workout_exercises.map(we => (
                  <div key={we.id} className="grid items-center py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/40"
                    style={{ gridTemplateColumns: '1fr 80px 80px 80px 1fr 32px' }}>
                    <div>
                      <div className="font-medium text-sm">{we.exercise.name}</div>
                      {we.exercise.muscle_group && <div className="text-xs text-pgf-500">{we.exercise.muscle_group}</div>}
                    </div>
                    <span className="text-center text-sm font-semibold">{we.sets ?? '—'}</span>
                    <span className="text-center text-sm font-semibold">{we.reps ?? '—'}</span>
                    <span className="text-center text-xs text-gray-400">{we.rest_seconds ? `${we.rest_seconds}s` : '—'}</span>
                    <span className="text-xs text-gray-400 px-2">{we.notes ?? ''}</span>
                    <button onClick={() => removeExercise(day.id, we.id)} className="text-gray-200 hover:text-red-400 text-base">✕</button>
                  </div>
                ))}

                <button onClick={() => setAddExerciseFor(day.id)}
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
                          <select name="exercise_id" required className="form-select">
                            <option value="">Selecione um exercício</option>
                            {exercises.map(ex => (
                              <option key={ex.id} value={ex.id}>{ex.name}{ex.muscle_group ? ` — ${ex.muscle_group}` : ''}</option>
                            ))}
                          </select>
                          {exercises.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">Nenhum exercício cadastrado ainda. <Link href="/pro/exercicios" className="underline">Adicionar exercícios</Link></p>
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

      {addDayOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddDayOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Novo Dia de Treino</h3>
            <form onSubmit={handleAddDay} className="space-y-4">
              <div>
                <label className="form-label">Nome do treino *</label>
                <input name="name" required className="form-input" placeholder="Ex: Treino A — Peito e Tríceps" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setAddDayOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar</button>
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
