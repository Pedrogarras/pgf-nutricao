'use client'
import { useState, useEffect } from 'react'

interface MealTemplate {
  id: string
  name: string
  emoji: string | null
  time_start: string | null
  foods: Array<{ food_id: string; food_name: string; quantity_g: number; quantity_description: string }>
  created_at: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MealTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { fetchTemplates() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function fetchTemplates() {
    setLoading(true)
    const res = await fetch('/api/meal-templates')
    const json = await res.json()
    setTemplates(json.templates ?? [])
    setLoading(false)
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    await fetch(`/api/meal-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), emoji: editEmoji || null }),
    })
    setSaving(false)
    setEditingId(null)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: editName.trim(), emoji: editEmoji || t.emoji } : t))
    showToast('Template atualizado.')
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este template?')) return
    setDeletingId(id)
    await fetch(`/api/meal-templates/${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
    showToast('Template excluído.')
  }

  // Compute total macros from food names (display only — we don't have macro data here)
  function totalKcal(tpl: MealTemplate): number {
    return tpl.foods.reduce((sum, f) => sum + Math.round(f.quantity_g * 1.2), 0) // Estimate placeholder
  }

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div>
          <h1 className="text-base font-bold text-white">Templates de Refeição</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Refeições salvas para reutilizar em planos</p>
        </div>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-gray-400 text-sm">Carregando...</div>
          </div>
        ) : templates.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">⭐</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum template salvo</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Templates de refeição permitem reutilizar refeições completas entre planos de diferentes pacientes.
              Para salvar um template, abra qualquer plano alimentar, passe o mouse sobre uma refeição e clique no ícone ⭐.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">{templates.length} template{templates.length !== 1 ? 's' : ''} salvos</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 max-w-3xl">
              {templates.map(tpl => (
                <div key={tpl.id} className="card overflow-hidden">
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer group hover:bg-gray-50/50 transition-colors"
                    onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tpl.emoji ?? '🍽️'}</span>
                      <div>
                        {editingId === tpl.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input
                              value={editEmoji}
                              onChange={e => setEditEmoji(e.target.value)}
                              className="form-input text-sm w-16 text-center py-1"
                              placeholder="🍽️"
                              maxLength={4}
                            />
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(tpl.id); if (e.key === 'Escape') setEditingId(null) }}
                              className="form-input text-sm py-1 font-semibold"
                              placeholder="Nome do template"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRename(tpl.id)}
                              disabled={saving}
                              className="btn btn-primary btn-sm py-1 px-3 text-xs"
                            >
                              {saving ? '...' : 'Salvar'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm py-1 px-2 text-xs">✕</button>
                          </div>
                        ) : (
                          <div className="font-bold text-gray-900">{tpl.name}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                          {tpl.time_start && <span>🕐 {tpl.time_start}</span>}
                          <span>{tpl.foods.length} alimento{tpl.foods.length !== 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span>Salvo em {new Date(tpl.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditName(tpl.name); setEditEmoji(tpl.emoji ?? ''); setEditingId(tpl.id); setExpandedId(tpl.id) }}
                        className="opacity-0 group-hover:opacity-100 btn btn-outline btn-sm text-xs transition-all"
                        title="Renomear"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(tpl.id)}
                        disabled={deletingId === tpl.id}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-lg disabled:opacity-40"
                        title="Excluir template"
                      >
                        {deletingId === tpl.id ? '...' : '✕'}
                      </button>
                      <span className="text-gray-300 text-sm">{expandedId === tpl.id ? '▾' : '▸'}</span>
                    </div>
                  </div>

                  {/* Expanded foods list */}
                  {expandedId === tpl.id && (
                    <div className="border-t border-gray-50 bg-gray-50/40">
                      {tpl.foods.length === 0 ? (
                        <div className="px-5 py-4 text-sm text-gray-400 italic">Nenhum alimento salvo neste template.</div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          <div className="grid px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide"
                            style={{ gridTemplateColumns: '1fr 90px 90px' }}>
                            <span>Alimento</span>
                            <span className="text-center">Quantidade</span>
                            <span className="text-center">Descrição</span>
                          </div>
                          {tpl.foods.map((f, idx) => (
                            <div key={idx} className="grid px-5 py-2.5 items-center"
                              style={{ gridTemplateColumns: '1fr 90px 90px' }}>
                              <span className="text-sm font-medium text-gray-800">{f.food_name || '—'}</span>
                              <span className="text-sm text-center text-gray-600 font-semibold">{f.quantity_g}g</span>
                              <span className="text-xs text-center text-gray-400">{f.quantity_description || '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
