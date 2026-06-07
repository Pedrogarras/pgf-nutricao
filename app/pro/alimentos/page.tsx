'use client'
import { useState, useEffect } from 'react'
import type { Food } from '@/lib/types'

export default function AlimentosPage() {
  const [foods, setFoods] = useState<Food[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'TACO' | 'custom'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)

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
    const res = await fetch('/api/foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'), kcal: Number(fd.get('kcal')),
        protein_g: Number(fd.get('protein_g') || 0), carbs_g: Number(fd.get('carbs_g') || 0),
        fat_g: Number(fd.get('fat_g') || 0), fiber_g: Number(fd.get('fiber_g') || 0),
        sodium_mg: Number(fd.get('sodium_mg') || 0), portion_g: Number(fd.get('portion_g') || 100),
        portion_description: fd.get('portion_description'), food_group: fd.get('food_group'),
      })
    })
    const data = await res.json()
    if (data.food) setFoods(prev => [data.food, ...prev])
    setAddOpen(false)
    setLoading(false)
  }

  const filtered = foods.filter(f => filter === 'all' || f.source === filter)

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
                {['Alimento', 'Grupo', 'Kcal', 'Prot (g)', 'Carb (g)', 'Gord (g)', 'PorÃ§Ã£o', 'Fonte'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(food => (
                <tr key={food.id} className="border-b border-gray-50 hover:bg-pgf-50/20">
                  <td className="px-4 py-3 font-medium text-sm">{food.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{food.food_group ?? 'â€”'}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{food.kcal}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">{food.protein_g}</td>
                  <td className="px-4 py-3 text-sm text-amber-600">{food.carbs_g}</td>
                  <td className="px-4 py-3 text-sm text-red-500">{food.fat_g}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{food.portion_description ?? `${food.portion_g}g`}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${food.source === 'TACO' ? 'badge-green' : 'badge-blue'}`}>
                      {food.source === 'TACO' ? 'TACO' : 'Meu'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {search.length >= 2 ? 'Nenhum alimento encontrado.' : 'Digite ao menos 2 letras para buscar.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal novo alimento */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">Novo Alimento Personalizado</h2>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="form-label">Nome do alimento *</label>
                <input name="name" required className="form-input" placeholder="Ex: PÃ£o de queijo low carb" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">PorÃ§Ã£o base (g ou ml)</label>
                  <input name="portion_g" type="number" defaultValue="100" className="form-input" />
                </div>
                <div>
                  <label className="form-label">DescriÃ§Ã£o da porÃ§Ã£o</label>
                  <input name="portion_description" className="form-input" placeholder="1 unidade (30g)" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Calorias (kcal) *</label><input name="kcal" type="number" step="0.1" required className="form-input" /></div>
                <div><label className="form-label">Proteína (g)</label><input name="protein_g" type="number" step="0.1" defaultValue="0" className="form-input" /></div>
                <div><label className="form-label">Carboidrato (g)</label><input name="carbs_g" type="number" step="0.1" defaultValue="0" className="form-input" /></div>
                <div><label className="form-label">Gordura (g)</label><input name="fat_g" type="number" step="0.1" defaultValue="0" className="form-input" /></div>
                <div><label className="form-label">Fibra (g)</label><input name="fiber_g" type="number" step="0.1" defaultValue="0" className="form-input" /></div>
                <div><label className="form-label">SÃ³dio (mg)</label><input name="sodium_mg" type="number" step="0.1" defaultValue="0" className="form-input" /></div>
              </div>
              <div>
                <label className="form-label">Grupo alimentar</label>
                <select name="food_group" className="form-select">
                  <option value="">Selecione</option>
                  <option>Cereais e derivados</option><option>Carnes bovinas</option>
                  <option>Aves</option><option>Pescados</option><option>Ovos</option>
                  <option>Laticínios</option><option>Leguminosas</option>
                  <option>Verduras e hortaliÃ§as</option><option>Frutas</option>
                  <option>Gorduras e Ã³leos</option><option>AÃ§Ãºcares</option>
                  <option>Oleaginosas</option><option>Bebidas</option><option>Suplementos</option>
                  <option>Outros</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Salvando...' : 'Adicionar Alimento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
