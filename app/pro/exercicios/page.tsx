'use client'
import { useState, useEffect } from 'react'
import type { Exercise } from '@/lib/types'

const MUSCLE_GROUPS = ['Peito','Costas','Ombros','Bíceps','Tríceps','Abdômen','Glúteo','Quadríceps','Posterior de coxa','Panturrilha','Full body','Cardio','Mobilidade']

export default function ExerciciosPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/exercises').then(r => r.json()).then(d => setExercises(d.exercises ?? []))
  }, [])

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'), muscle_group: fd.get('muscle_group'),
        description: fd.get('description'), video_url: fd.get('video_url'),
      })
    })
    const data = await res.json()
    if (data.exercise) setExercises(prev => [data.exercise, ...prev])
    setAddOpen(false)
    setLoading(false)
  }

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-8 h-15 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Biblioteca de Exercícios</h1>
          <p className="text-xs text-gray-400">{exercises.length} exercícios cadastrados</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn btn-primary">+ Novo Exercício</button>
      </div>

      <div className="p-8">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar exercício..." className="form-input max-w-sm mb-6" />

        <div className="grid grid-cols-3 gap-4">
          {filtered.map(ex => (
            <div key={ex.id} className="card overflow-hidden hover:shadow-md transition-shadow">
              {ex.video_url ? (
                <div className="aspect-video bg-gray-100 relative">
                  {ex.video_url.includes('youtube') || ex.video_url.includes('youtu.be') ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(ex.video_url)}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : (
                    <video src={ex.video_url} controls className="w-full h-full object-cover" />
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-pgf-50 flex items-center justify-center">
                  <span className="text-4xl">🎥</span>
                </div>
              )}
              <div className="p-4">
                <div className="font-bold text-gray-900">{ex.name}</div>
                {ex.muscle_group && (
                  <span className="badge badge-blue mt-1 text-xs">{ex.muscle_group}</span>
                )}
                {ex.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{ex.description}</p>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16">
              <div className="text-5xl mb-3">🎥</div>
              <div className="font-semibold text-gray-600 mb-1">Biblioteca vazia</div>
              <div className="text-sm text-gray-400 mb-4">Adicione seus primeiros exercícios com vídeos</div>
              <button onClick={() => setAddOpen(true)} className="btn btn-primary">+ Adicionar exercício</button>
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">Novo Exercício</h2>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="form-label">Nome do exercício *</label>
                <input name="name" required className="form-input" placeholder="Ex: Supino reto com barra" />
              </div>
              <div>
                <label className="form-label">Grupo muscular</label>
                <select name="muscle_group" className="form-select">
                  <option value="">Selecione</option>
                  {MUSCLE_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">URL do vídeo</label>
                <input name="video_url" type="url" className="form-input" placeholder="https://youtube.com/watch?v=... ou link do Supabase" />
                <p className="text-xs text-gray-400 mt-1">Aceita links do YouTube ou URLs de vídeos do Supabase Storage</p>
              </div>
              <div>
                <label className="form-label">Descrição / orientações</label>
                <textarea name="description" className="form-textarea" rows={3} placeholder="Dicas de execução, atenção para..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Salvando...' : 'Salvar Exercício'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function extractYouTubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return match?.[1] ?? ''
}
