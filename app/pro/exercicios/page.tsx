'use client'
import { useState, useEffect } from 'react'
import type { Exercise } from '@/lib/types'

const MUSCLE_GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Glúteo', 'Quadríceps', 'Posterior de coxa', 'Panturrilha', 'Full body', 'Cardio', 'Mobilidade']

function extractYouTubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return match?.[1] ?? ''
}

function emptyForm() { return { name: '', muscle_group: '', description: '', video_url: '' } }

export default function ExerciciosPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEx, setEditingEx] = useState<Exercise | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/exercises').then(r => r.json()).then(d => setExercises(d.exercises ?? []))
  }, [])

  function openAdd() {
    setEditingEx(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(ex: Exercise) {
    setEditingEx(ex)
    setForm({ name: ex.name, muscle_group: ex.muscle_group ?? '', description: ex.description ?? '', video_url: ex.video_url ?? '' })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const payload = { name: form.name, muscle_group: form.muscle_group || null, description: form.description || null, video_url: form.video_url || null }
    const res = editingEx
      ? await fetch(`/api/exercises/${editingEx.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.exercise) {
      if (editingEx) setExercises(prev => prev.map(e => e.id === editingEx.id ? data.exercise : e))
      else setExercises(prev => [data.exercise, ...prev])
    }
    setModalOpen(false)
    setLoading(false)
  }

  async function handleDelete(ex: Exercise) {
    if (!confirm(`Excluir "${ex.name}"?`)) return
    setDeletingId(ex.id)
    await fetch(`/api/exercises/${ex.id}`, { method: 'DELETE' })
    setExercises(prev => prev.filter(e => e.id !== ex.id))
    setDeletingId(null)
  }

  const muscleGroups = ['all', ...Array.from(new Set(exercises.map(e => e.muscle_group).filter(Boolean) as string[]))]
  const filtered = exercises.filter(e =>
    (muscleFilter === 'all' || e.muscle_group === muscleFilter) &&
    (search.length < 2 || e.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between" style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <h1 className="text-base font-bold text-white">Biblioteca de Exercícios</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{exercises.length} exercício{exercises.length !== 1 ? 's' : ''} cadastrado{exercises.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Novo Exercício</button>
      </div>

      <div className="p-8">
        <div className="flex flex-wrap gap-3 mb-6">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar exercício..." className="form-input max-w-xs" />
          <div className="flex flex-wrap gap-1.5">
            {muscleGroups.map(mg => (
              <button key={mg} onClick={() => setMuscleFilter(mg)} className={`btn btn-sm ${muscleFilter === mg ? 'btn-primary' : 'btn-ghost'}`}>
                {mg === 'all' ? 'Todos' : mg}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {filtered.map(ex => (
            <div key={ex.id} className="card overflow-hidden hover:shadow-md transition-shadow group">
              {ex.video_url ? (
                <div className="aspect-video bg-gray-100 relative">
                  {ex.video_url.includes('youtube') || ex.video_url.includes('youtu.be') ? (
                    <iframe src={`https://www.youtube.com/embed/${extractYouTubeId(ex.video_url)}`} className="w-full h-full" allowFullScreen />
                  ) : (
                    <video src={ex.video_url} controls className="w-full h-full object-cover" />
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-pgf-50 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900">{ex.name}</div>
                    {ex.muscle_group && <span className="badge badge-blue mt-1 text-xs">{ex.muscle_group}</span>}
                    {ex.description && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{ex.description}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => openEdit(ex)} className="text-gray-300 hover:text-pgf-500 p-1 transition-colors" title="Editar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(ex)} disabled={deletingId === ex.id} className="text-gray-200 hover:text-red-400 p-1 transition-colors" title="Excluir">
                      {deletingId === ex.id ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
              <div className="font-semibold text-gray-600 mb-1">Biblioteca vazia</div>
              <div className="text-sm text-gray-400 mb-4">Adicione seus primeiros exercícios com vídeos do YouTube</div>
              <button onClick={openAdd} className="btn btn-primary">+ Adicionar Exercício</button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">{editingEx ? 'Editar Exercício' : 'Novo Exercício'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="form-label">Nome do exercício *</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="form-input" placeholder="Ex: Supino reto com barra" />
              </div>
              <div>
                <label className="form-label">Grupo muscular</label>
                <select value={form.muscle_group} onChange={e => setForm(p => ({ ...p, muscle_group: e.target.value }))} className="form-select">
                  <option value="">Selecione</option>
                  {MUSCLE_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">URL do vídeo</label>
                <input value={form.video_url} onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))} type="url" className="form-input" placeholder="https://youtube.com/watch?v=... ou URL do vídeo" />
                <p className="text-xs text-gray-400 mt-1">Aceita links do YouTube ou URLs de vídeos diretos</p>
                {form.video_url && (form.video_url.includes('youtube') || form.video_url.includes('youtu.be')) && (
                  <div className="mt-2 aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <iframe src={`https://www.youtube.com/embed/${extractYouTubeId(form.video_url)}`} className="w-full h-full" allowFullScreen />
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Descrição / orientações</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="form-input" rows={3} placeholder="Dicas de execução, atenção para..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Salvando...' : editingEx ? 'Salvar alterações' : 'Salvar Exercício'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
