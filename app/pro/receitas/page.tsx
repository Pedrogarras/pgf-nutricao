'use client'
import { useState, useEffect } from 'react'

interface Ingredient {
  ingredient: string
  quantity: string
  grams: number | null
}

interface Recipe {
  id: string
  name: string
  category: string | null
  description: string | null
  yield_portions: number | null
  yield_g_per_portion: number | null
  kcal_per_portion: number | null
  protein_g_per_portion: number | null
  carbs_g_per_portion: number | null
  fat_g_per_portion: number | null
  fiber_g_per_portion: number | null
  instructions: string | null
  ingredients: Ingredient[]
}

const CATEGORIES = ['proteína', 'low carb', 'lanche', 'sobremesa', 'vegano', 'café da manhã', 'almoço', 'jantar', 'snack']

function emptyRecipe(): Omit<Recipe, 'id'> {
  return {
    name: '', category: null, description: null, yield_portions: 1,
    yield_g_per_portion: null, kcal_per_portion: null, protein_g_per_portion: null,
    carbs_g_per_portion: null, fat_g_per_portion: null, fiber_g_per_portion: null,
    instructions: null, ingredients: [{ ingredient: '', quantity: '', grams: null }],
  }
}

function catColor(cat: string | null) {
  switch (cat) {
    case 'proteína': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'low carb': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'lanche': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'sobremesa': return 'bg-pink-50 text-pink-700 border-pink-200'
    case 'vegano': return 'bg-green-50 text-green-700 border-green-200'
    default: return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

export default function ReceitasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [form, setForm] = useState<Omit<Recipe, 'id'>>(emptyRecipe())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/recipes')
      .then(r => r.json())
      .then(d => setRecipes(d.recipes ?? []))
      .finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditingRecipe(null)
    setForm(emptyRecipe())
    setModalOpen(true)
  }

  function openEdit(recipe: Recipe) {
    setEditingRecipe(recipe)
    setForm({
      name: recipe.name,
      category: recipe.category,
      description: recipe.description,
      yield_portions: recipe.yield_portions,
      yield_g_per_portion: recipe.yield_g_per_portion,
      kcal_per_portion: recipe.kcal_per_portion,
      protein_g_per_portion: recipe.protein_g_per_portion,
      carbs_g_per_portion: recipe.carbs_g_per_portion,
      fat_g_per_portion: recipe.fat_g_per_portion,
      fiber_g_per_portion: recipe.fiber_g_per_portion,
      instructions: recipe.instructions,
      ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [{ ingredient: '', quantity: '', grams: null }],
    })
    setModalOpen(true)
  }

  function setIng(idx: number, field: keyof Ingredient, val: string | number | null) {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing),
    }))
  }

  function addIngredient() {
    setForm(prev => ({ ...prev, ingredients: [...prev.ingredients, { ingredient: '', quantity: '', grams: null }] }))
  }

  function removeIngredient(idx: number) {
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      ingredients: form.ingredients.filter(i => i.ingredient.trim()),
    }
    const res = editingRecipe
      ? await fetch(`/api/recipes/${editingRecipe.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.recipe) {
      if (editingRecipe) {
        setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? data.recipe : r))
      } else {
        setRecipes(prev => [data.recipe, ...prev])
      }
    }
    setSaving(false)
    setModalOpen(false)
  }

  async function handleDelete(recipe: Recipe) {
    if (!confirm(`Excluir "${recipe.name}"?`)) return
    setDeletingId(recipe.id)
    await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' })
    setRecipes(prev => prev.filter(r => r.id !== recipe.id))
    setDeletingId(null)
    if (expandedId === recipe.id) setExpandedId(null)
  }

  const categories = ['all', ...Array.from(new Set(recipes.map(r => r.category).filter(Boolean) as string[]))]
  const filtered = recipes.filter(r =>
    (filter === 'all' || r.category === filter) &&
    (search.length < 2 || r.name.toLowerCase().includes(search.toLowerCase()))
  )

  function n(v: number | null | undefined) { return v != null ? Math.round(v * 10) / 10 : null }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between" style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <h1 className="text-base font-bold text-white">Receitas</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{recipes.length} receita{recipes.length !== 1 ? 's' : ''} no acervo</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Nova Receita</button>
      </div>

      <div className="p-8">
        {/* Search + filter */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar receitas..."
            className="form-input flex-1 max-w-xs"
          />
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={`btn btn-sm ${filter === cat ? 'btn-primary' : 'btn-ghost'}`}>
                {cat === 'all' ? 'Todas' : cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando receitas...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2l1.5 1.5L6 2l1.5 1.5L9 2l1.5 1.5L12 2l1.5 1.5L15 2l1.5 1.5L18 2v20l-1.5-1.5L15 22l-1.5-1.5L12 22l-1.5-1.5L9 22l-1.5-1.5L6 22l-1.5-1.5L3 22V2z"/>
                <path d="M9 7h6M9 11h6M9 15h4"/>
              </svg>
            </div>
            <div className="font-semibold text-gray-500 mb-1">Nenhuma receita encontrada</div>
            <div className="text-sm text-gray-400 mb-4">Adicione receitas ao acervo para usar nos planos alimentares</div>
            <button onClick={openAdd} className="btn btn-primary">+ Primeira Receita</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(recipe => {
              const isExpanded = expandedId === recipe.id
              const hasMacros = recipe.kcal_per_portion != null
              return (
                <div key={recipe.id} className="card overflow-hidden">
                  {/* Card header */}
                  <div
                    className="px-5 pt-4 pb-3 cursor-pointer hover:bg-pgf-50/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-bold text-gray-900 leading-snug flex-1">{recipe.name}</div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <svg className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {recipe.category && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catColor(recipe.category)}`}>
                          {recipe.category}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{recipe.ingredients.length} ingrediente{recipe.ingredients.length !== 1 ? 's' : ''}</span>
                      {recipe.yield_portions && <span className="text-xs text-gray-400">· {recipe.yield_portions} porção{recipe.yield_portions !== 1 ? 'ões' : ''}</span>}
                    </div>

                    {/* Macros per portion */}
                    {hasMacros && (
                      <div className="flex gap-3 mt-2.5 text-xs">
                        <span className="text-gray-600 font-semibold">{n(recipe.kcal_per_portion)} kcal</span>
                        <span className="text-blue-600">P {n(recipe.protein_g_per_portion)}g</span>
                        <span className="text-amber-600">C {n(recipe.carbs_g_per_portion)}g</span>
                        <span className="text-red-500">G {n(recipe.fat_g_per_portion)}g</span>
                        {recipe.fiber_g_per_portion != null && <span className="text-emerald-600">Fib {n(recipe.fiber_g_per_portion)}g</span>}
                      </div>
                    )}

                    {recipe.description && (
                      <div className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{recipe.description}</div>
                    )}
                  </div>

                  {/* Expanded: ingredients + instructions */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <div className="px-5 py-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Ingredientes</div>
                        <div className="space-y-1.5">
                          {recipe.ingredients.map((ing, i) => (
                            <div key={i} className="flex items-baseline justify-between text-sm">
                              <span className="text-gray-800">{ing.ingredient}</span>
                              <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{ing.quantity}{ing.grams ? ` (${ing.grams}g)` : ''}</span>
                            </div>
                          ))}
                        </div>

                        {recipe.instructions && (
                          <div className="mt-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Modo de preparo</div>
                            <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{recipe.instructions}</div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 px-5 pb-4">
                        <button onClick={() => openEdit(recipe)} className="btn btn-outline btn-sm flex-1">Editar</button>
                        <button
                          onClick={() => handleDelete(recipe)}
                          disabled={deletingId === recipe.id}
                          className="btn btn-sm text-red-400 border border-red-100 hover:bg-red-50 hover:text-red-600 px-3"
                        >
                          {deletingId === recipe.id ? '...' : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold">{editingRecipe ? 'Editar Receita' : 'Nova Receita'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Name + category */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Nome da receita *</label>
                  <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="form-input" placeholder="ex: Omelete de claras com aveia" />
                </div>
                <div>
                  <label className="form-label">Categoria</label>
                  <select value={form.category ?? ''} onChange={e => setForm(p => ({ ...p, category: e.target.value || null }))} className="form-select">
                    <option value="">Sem categoria</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Descrição (opcional)</label>
                <input value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value || null }))} className="form-input" placeholder="Breve descrição da receita" />
              </div>

              {/* Yield */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Rendimento (porções)</label>
                  <input type="number" min="1" value={form.yield_portions ?? 1} onChange={e => setForm(p => ({ ...p, yield_portions: Number(e.target.value) || 1 }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Gramas por porção (opcional)</label>
                  <input type="number" step="0.1" value={form.yield_g_per_portion ?? ''} onChange={e => setForm(p => ({ ...p, yield_g_per_portion: e.target.value ? Number(e.target.value) : null }))} className="form-input" placeholder="ex: 150" />
                </div>
              </div>

              {/* Macros per portion */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Macros por porção (opcional — calculado automaticamente se deixado em branco)</div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="form-label">Kcal</label><input type="number" step="0.1" value={form.kcal_per_portion ?? ''} onChange={e => setForm(p => ({ ...p, kcal_per_portion: e.target.value ? Number(e.target.value) : null }))} className="form-input" placeholder="—" /></div>
                  <div><label className="form-label">Proteína (g)</label><input type="number" step="0.1" value={form.protein_g_per_portion ?? ''} onChange={e => setForm(p => ({ ...p, protein_g_per_portion: e.target.value ? Number(e.target.value) : null }))} className="form-input" placeholder="—" /></div>
                  <div><label className="form-label">Carboidrato (g)</label><input type="number" step="0.1" value={form.carbs_g_per_portion ?? ''} onChange={e => setForm(p => ({ ...p, carbs_g_per_portion: e.target.value ? Number(e.target.value) : null }))} className="form-input" placeholder="—" /></div>
                  <div><label className="form-label">Gordura (g)</label><input type="number" step="0.1" value={form.fat_g_per_portion ?? ''} onChange={e => setForm(p => ({ ...p, fat_g_per_portion: e.target.value ? Number(e.target.value) : null }))} className="form-input" placeholder="—" /></div>
                  <div><label className="form-label">Fibra (g)</label><input type="number" step="0.1" value={form.fiber_g_per_portion ?? ''} onChange={e => setForm(p => ({ ...p, fiber_g_per_portion: e.target.value ? Number(e.target.value) : null }))} className="form-input" placeholder="—" /></div>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ingredientes</div>
                <div className="space-y-2">
                  {form.ingredients.map((ing, idx) => (
                    <div key={idx} className="grid gap-2" style={{ gridTemplateColumns: '1fr 120px 90px 32px' }}>
                      <input
                        value={ing.ingredient}
                        onChange={e => setIng(idx, 'ingredient', e.target.value)}
                        className="form-input"
                        placeholder={`Ingrediente ${idx + 1}`}
                      />
                      <input
                        value={ing.quantity}
                        onChange={e => setIng(idx, 'quantity', e.target.value)}
                        className="form-input text-sm"
                        placeholder="Quantidade"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={ing.grams ?? ''}
                        onChange={e => setIng(idx, 'grams', e.target.value ? Number(e.target.value) : null)}
                        className="form-input text-sm"
                        placeholder="g"
                      />
                      <button
                        type="button"
                        onClick={() => removeIngredient(idx)}
                        disabled={form.ingredients.length === 1}
                        className="text-gray-300 hover:text-red-400 disabled:opacity-20 flex items-center justify-center"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addIngredient} className="mt-2 text-sm text-pgf-600 hover:text-pgf-700 font-medium">
                  + Adicionar ingrediente
                </button>
              </div>

              {/* Instructions */}
              <div>
                <label className="form-label">Modo de preparo (opcional)</label>
                <textarea
                  value={form.instructions ?? ''}
                  onChange={e => setForm(p => ({ ...p, instructions: e.target.value || null }))}
                  rows={5}
                  className="form-input text-sm"
                  placeholder="Descreva o passo a passo da receita..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : editingRecipe ? 'Salvar alterações' : 'Criar receita'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
