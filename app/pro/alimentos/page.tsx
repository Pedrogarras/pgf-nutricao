'use client'
import { useState, useEffect } from 'react'
import type { Food } from '@/lib/types'

export default function AlimentosPage() {
  const [foods, setFoods] = useState<Food[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'TACO' | 'custom'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = search.length >= 2 ? `?q=${encodeURIComponent(search)}` : '?q=a'
      const res = await fetch(`/api/foods${q}`)
      const data = await res.json()
      setFoods(data.foods ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name'), kcal: Number(fd.get('kcal')),
      protein_g: Number(fd.get('protein_g') || 0), carbs_g: Number(fd.get('carbs_g') || 0),
      fat_g: Number(fd.get('fat_g') || 0), fiber_g: Number(fd.get('fiber_g') || 0),
      sodium_mg: Number(fd.get('sodium_mg') || 0), portion_g: Number(fd.get('portion_g') || 100),
      portion_description: fd.get('portion_description') || null, food_group: fd.get('food_group') || null,
    }
    const res = await fetch('/api/foods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.food) setFoods(prev => [data.food, ...prev])
    setAddOpen(false)
    setLoading(false)
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingFood) return
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name'), kcal: Number(fd.get('kcal')),
      protein_g: Number(fd.get('protein_g') || 0), carbs_g: Number(fd.get('carbs_g') || 0),
      fat_g: Number(fd.get('fat_g') || 0), fiber_g: Number(fd.get('fiber_g') || 0),
      sodium_mg: Number(fd.get('sodium_mg') || 0), portion_g: Number(fd.get('portion_g') || 100),
      portion_description: fd.get('portion_description') || null, food_group: fd.get('food_group') || null,
    }
    const res = await fetch(`/api/foods/${editingFood.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.food) setFoods(prev => prev.map(f => f.id === data.food.id ? data.food : f))
    setEditingFood(null)
    setLoading(false)
  }

  async function handleDelete(food: Food) {
    if (!confirm(`Excluir "${food.name}"?\nEste alimento será removido do banco.`)) return
    setDeleting(food.id)
    await fetch(`/api/foods/${food.id}`, { method: 'DELETE' })
    setFoods(prev => prev.filter(f => f.id !== food.id))
    setDeleting(null)
  }

  const filtered = foods.filter(f => filter === 'all' || f.source === filter)

  const foodGroupOptions = [
    'Cereais e derivados', 'Carnes bovinas', 'Aves', 'Pescados', 'Ovos',
    'Laticínios', 'Leguminosas', 'Verduras e hortaliças', 'Frutas',
    'Gorduras e óleos', 'Açúcares', 'Oleaginosas', 'Bebidas', 'Suplementos', 'Outros',
  ]

  function FoodForm({ food, onSubmit, onCancel }: { food?: Food; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
    return (
      <form onSubmit={onSubmit} className="p-6 space-y-4">
        <div>
          <label className="form-label">Nome do alimento *</label>
          <input name="name" required defaultValue={food?.name} className="form-input" placeholder="Ex: Pão de queijo low carb" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Porção base (g ou ml)</label>
            <input name="portion_g" type="number" defaultValue={food?.portion_g ?? 100} className="form-input" />
          </div>
          <div>
            <label className="form-label">Descrição da porção</label>
            <input name="portion_description" defaultValue={food?.portion_description ?? ''} className="form-input" placeholder="1 unidade (30g)" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="form-label">Calorias (kcal) *</label><input name="kcal" type="number" step="0.1" required defaultValue={food?.kcal} className="form-input" /></div>
          <div><label className="form-label">Proteína (g)</label><input name="protein_g" type="number" step="0.1" defaultValue={food?.protein_g ?? 0} className="form-input" /></div>
          <div><label className="form-label">Carboidrato (g)</label><input name="carbs_g" type="number" step="0.1" defaultValue={food?.carbs_g ?? 0} className="form-input" /></div>
          <div><label className="form-label">Gordura (g)</label><input name="fat_g" type="number" step="0.1" defaultValue={food?.fat_g ?? 0} className="form-input" /></div>
          <div><label className="form-label">Fibra (g)</label><input name="fiber_g" type="number" step="0.1" defaultValue={food?.fiber_g ?? 0} className="form-input" /></div>
          <div><label className="form-label">Sódio (mg)</label><input name="sodium_mg" type="number" step="0.1" defaultValue={food?.sodium_mg ?? 0} className="form-input" /></div>
        </div>
        <div>
          <label className="form-label">Grupo alimentar</label>
          <select name="food_group" defaultValue={food?.food_group ?? ''} className="form-select">
            <option value="">Selecione</option>
            {foodGroupOptions.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Salvando...' : food ? 'Salvar alterações' : 'Adicionar Alimento'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div>
      <div
        className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div>
          <h1 className="text-base font-bold text-white">Banco de Alimentos</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>TACO + alimentos personalizados</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn btn-primary">+ Novo Alimento</button>
      </div>

      <div className="p-8">
        <div className="flex gap-4 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar alimento..."
            className="form-input flex-1 max-w-sm"
          />
          <div className="flex gap-2">
            {(['all', 'TACO', 'custom'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>
                {f === 'all' ? 'Todos' : f === 'TACO' ? 'TACO' : 'Personalizados'}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <table className="w-full">
            <thead>
              <tr>
                {['Alimento', 'Grupo', 'Kcal', 'Prot (g)', 'Carb (g)', 'Gord (g)', 'Fibra (g)', 'Sódio (mg)', 'Porção', 'Fonte', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(food => (
                <tr key={food.id} className="border-b border-gray-50 hover:bg-pgf-50/20 group">
                  <td className="px-4 py-3 font-medium text-sm">{food.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{food.food_group ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{food.kcal}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">{food.protein_g}</td>
                  <td className="px-4 py-3 text-sm text-amber-600">{food.carbs_g}</td>
                  <td className="px-4 py-3 text-sm text-red-500">{food.fat_g}</td>
                  <td className="px-4 py-3 text-sm text-emerald-600">{food.fiber_g ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{food.sodium_mg ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{food.portion_description ?? `${food.portion_g}g`}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${food.source === 'TACO' ? 'badge-green' : 'badge-blue'}`}>
                      {food.source === 'TACO' ? 'TACO' : 'Meu'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {food.source !== 'TACO' && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingFood(food)}
                          className="btn btn-ghost btn-sm text-xs px-2 py-1"
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(food)}
                          disabled={deleting === food.id}
                          className="btn btn-ghost btn-sm text-xs px-2 py-1 text-red-400 hover:text-red-600"
                          title="Excluir"
                        >
                          {deleting === food.id ? '...' : 'Excluir'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {search.length >= 2 ? 'Nenhum alimento encontrado.' : 'Digite ao menos 2 letras para buscar.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: novo alimento */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">Novo Alimento Personalizado</h2>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <FoodForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
          </div>
        </div>
      )}

      {/* Modal: editar alimento */}
      {editingFood && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingFood(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">Editar Alimento</h2>
              <button onClick={() => setEditingFood(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <FoodForm food={editingFood} onSubmit={handleEdit} onCancel={() => setEditingFood(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
