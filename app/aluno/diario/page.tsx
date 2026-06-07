'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface DiaryFood {
  food_name: string
  quantity_g: number
  quantity_description: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

interface DiaryEntry {
  id: string
  logged_at: string
  meal_name: string
  meal_time: string | null
  foods: DiaryFood[]
  total_kcal: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  notes: string | null
  adherence_score: number | null
}

interface FoodSearchResult {
  id: string
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  portion_g: number | null
  portion_description: string | null
}

const MEAL_EMOJIS: Record<string, string> = {
  'Café da manhã': '☀️',
  'Lanche da manhã': '🍎',
  'Almoço': '🍽️',
  'Lanche da tarde': '⚡',
  'Jantar': '🌙',
  'Ceia': '🌛',
  'Pré-treino': '🏋️',
  'Pós-treino': '💪',
}

export default function AlunoDiarioPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // Add meal form
  const [mealName, setMealName] = useState('Café da manhã')
  const [mealTime, setMealTime] = useState('')
  const [mealNotes, setMealNotes] = useState('')
  const [adherenceScore, setAdherenceScore] = useState<number>(3)
  const [foods, setFoods] = useState<DiaryFood[]>([])
  const [saving, setSaving] = useState(false)

  // Food search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
  const [foodQty, setFoodQty] = useState('100')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchEntries(selectedDate) }, [selectedDate])

  async function fetchEntries(date: string) {
    setLoading(true)
    const res = await fetch(`/api/diary?date=${date}`)
    const json = await res.json()
    setEntries(json.entries ?? [])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Food search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/foods?q=${encodeURIComponent(searchQuery)}&limit=8`)
      const json = await res.json()
      setSearchResults(json.foods ?? [])
      setSearching(false)
    }, 350)
  }, [searchQuery])

  function addFood() {
    if (!selectedFood) return
    const qty = Number(foodQty) || 100
    const base = selectedFood.portion_g || 100
    const ratio = qty / base
    const desc = selectedFood.portion_description
      ? `${Math.round(ratio * 10) / 10} ${selectedFood.portion_description} (${qty}g)`
      : `${qty}g`

    const food: DiaryFood = {
      food_name: selectedFood.name,
      quantity_g: qty,
      quantity_description: desc,
      kcal: Math.round(selectedFood.kcal * ratio * 10) / 10,
      protein: Math.round(selectedFood.protein_g * ratio * 10) / 10,
      carbs: Math.round(selectedFood.carbs_g * ratio * 10) / 10,
      fat: Math.round(selectedFood.fat_g * ratio * 10) / 10,
    }
    setFoods(prev => [...prev, food])
    setSelectedFood(null)
    setSearchQuery('')
    setFoodQty('100')
    setSearchResults([])
  }

  function removeFood(idx: number) {
    setFoods(prev => prev.filter((_, i) => i !== idx))
  }

  const mealTotals = {
    kcal: foods.reduce((s, f) => s + f.kcal, 0),
    protein: foods.reduce((s, f) => s + f.protein, 0),
    carbs: foods.reduce((s, f) => s + f.carbs, 0),
    fat: foods.reduce((s, f) => s + f.fat, 0),
  }

  async function handleSave() {
    if (!mealName.trim()) return
    setSaving(true)
    const res = await fetch('/api/diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logged_at: selectedDate,
        meal_name: mealName,
        meal_time: mealTime || null,
        foods,
        total_kcal: Math.round(mealTotals.kcal * 10) / 10,
        total_protein_g: Math.round(mealTotals.protein * 10) / 10,
        total_carbs_g: Math.round(mealTotals.carbs * 10) / 10,
        total_fat_g: Math.round(mealTotals.fat * 10) / 10,
        notes: mealNotes || null,
        adherence_score: adherenceScore,
        source: 'patient',
      }),
    })
    setSaving(false)
    if (res.ok) {
      const json = await res.json()
      setEntries(prev => [...prev, json.entry])
      setAddOpen(false)
      setMealName('Café da manhã')
      setMealTime('')
      setMealNotes('')
      setAdherenceScore(3)
      setFoods([])
      showToast('Refeição registrada! 📔')
    } else {
      showToast('Erro ao salvar.')
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/diary/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
    showToast('Registro removido.')
  }

  const dayTotals = {
    kcal: entries.reduce((s, e) => s + (e.total_kcal ?? 0), 0),
    protein: entries.reduce((s, e) => s + (e.total_protein_g ?? 0), 0),
    carbs: entries.reduce((s, e) => s + (e.total_carbs_g ?? 0), 0),
    fat: entries.reduce((s, e) => s + (e.total_fat_g ?? 0), 0),
  }

  // Navigation dates (last 7 days)
  const dates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-6 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/aluno" className="text-pgf-400 hover:text-pgf-300 text-sm">← Início</Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">📔 Meu Diário</h1>
        </div>
        <button
          onClick={() => { setAddOpen(true) }}
          className="btn btn-primary btn-sm"
        >
          + Registrar refeição
        </button>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {/* Date picker */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {dates.map(d => {
            const isToday = d === new Date().toISOString().split('T')[0]
            const isSelected = d === selectedDate
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-center transition-all ${isSelected ? 'bg-pgf-600 text-white' : 'text-white/50 hover:text-white/80'}`}
                style={!isSelected ? { background: 'rgba(255,255,255,0.05)' } : undefined}
              >
                <div className="text-[10px] font-bold uppercase">
                  {isToday ? 'Hoje' : new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div className="text-base font-black mt-0.5">
                  {new Date(d + 'T12:00').getDate()}
                </div>
              </button>
            )
          })}
        </div>

        {/* Day totals */}
        {entries.length > 0 && (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-xs text-white/40 font-semibold uppercase tracking-wide mb-2">Total do dia</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Kcal', value: Math.round(dayTotals.kcal), color: 'text-white' },
                { label: 'Prot', value: `${Math.round(dayTotals.protein)}g`, color: 'text-blue-400' },
                { label: 'Carb', value: `${Math.round(dayTotals.carbs)}g`, color: 'text-amber-400' },
                { label: 'Gord', value: `${Math.round(dayTotals.fat)}g`, color: 'text-red-400' },
              ].map(m => (
                <div key={m.label}>
                  <div className={`text-lg font-black ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-white/30 font-semibold uppercase">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entries */}
        {loading ? (
          <div className="text-center py-12 text-white/30 text-sm">Carregando...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📔</div>
            <p className="text-white/40 text-sm">Nenhuma refeição registrada hoje.</p>
            <button onClick={() => setAddOpen(true)} className="btn btn-primary mt-4">
              Registrar primeira refeição
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{MEAL_EMOJIS[entry.meal_name] ?? '🍽️'}</span>
                    <div>
                      <div className="font-semibold text-white text-sm">{entry.meal_name}</div>
                      <div className="text-xs text-white/40">
                        {entry.meal_time?.slice(0,5)} · {entry.foods.length} alimento{entry.foods.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-black text-white">{Math.round(entry.total_kcal ?? 0)} kcal</div>
                      <div className="text-[10px] text-white/40">
                        P{Math.round(entry.total_protein_g ?? 0)} C{Math.round(entry.total_carbs_g ?? 0)} G{Math.round(entry.total_fat_g ?? 0)}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(entry.id) }}
                      className="text-white/20 hover:text-red-400 transition-colors text-sm"
                    >✕</button>
                    <span className="text-white/30">{expandedId === entry.id ? '▾' : '▸'}</span>
                  </div>
                </div>
                {expandedId === entry.id && entry.foods.length > 0 && (
                  <div className="px-4 pb-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {entry.foods.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-white/70">{f.food_name}</span>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>{f.quantity_description}</span>
                          <span className="text-white/60 font-semibold">{Math.round(f.kcal)} kcal</span>
                        </div>
                      </div>
                    ))}
                    {entry.notes && <p className="text-xs text-white/30 italic mt-2">{entry.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add meal modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setAddOpen(false)}>
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg">Registrar Refeição</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Meal name */}
              <div>
                <label className="form-label">Refeição</label>
                <select value={mealName} onChange={e => setMealName(e.target.value)} className="form-select">
                  {Object.keys(MEAL_EMOJIS).map(n => <option key={n}>{n}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Horário</label>
                  <input type="time" value={mealTime} onChange={e => setMealTime(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Adesão ao plano</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAdherenceScore(n)}
                        className={`flex-1 py-1.5 rounded text-sm font-bold transition-all ${adherenceScore === n ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Food search */}
              <div>
                <label className="form-label">Buscar alimento</label>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input"
                  placeholder="Nome do alimento..."
                />
                {searching && <div className="text-xs text-gray-400 mt-1">Buscando...</div>}
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg">
                    {searchResults.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSelectedFood(f); setFoodQty(String(f.portion_g ?? 100)); setSearchResults([]) }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${selectedFood?.id === f.id ? 'bg-pgf-50' : ''}`}
                      >
                        <div className="text-sm font-medium text-gray-900">{f.name}</div>
                        <div className="text-xs text-gray-400">{Math.round(f.kcal)} kcal/100g · P{Math.round(f.protein_g)}g C{Math.round(f.carbs_g)}g G{Math.round(f.fat_g)}g</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected food quantity */}
              {selectedFood && (
                <div className="bg-pgf-50 rounded-xl p-4 border border-pgf-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-sm text-pgf-800">{selectedFood.name}</div>
                    <button onClick={() => setSelectedFood(null)} className="text-gray-400 text-xs">✕</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="form-label">Quantidade (g)</label>
                      <input type="number" value={foodQty} onChange={e => setFoodQty(e.target.value)} className="form-input" min="1" />
                    </div>
                    <div className="pt-5">
                      <button type="button" onClick={addFood} className="btn btn-primary">+ Adicionar</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Added foods */}
              {foods.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Alimentos adicionados</div>
                  <div className="space-y-1.5">
                    {foods.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{f.food_name}</div>
                          <div className="text-xs text-gray-400">{f.quantity_description} · {Math.round(f.kcal)} kcal</div>
                        </div>
                        <button onClick={() => removeFood(i)} className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Mini totals */}
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center bg-gray-900 rounded-xl p-3">
                    {[
                      { label: 'Kcal', value: Math.round(mealTotals.kcal) },
                      { label: 'Prot', value: `${Math.round(mealTotals.protein)}g` },
                      { label: 'Carb', value: `${Math.round(mealTotals.carbs)}g` },
                      { label: 'Gord', value: `${Math.round(mealTotals.fat)}g` },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="text-sm font-black text-white">{m.value}</div>
                        <div className="text-[10px] text-white/40 uppercase">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Observações</label>
                <textarea value={mealNotes} onChange={e => setMealNotes(e.target.value)} className="form-input" rows={2} placeholder="Comi fora de casa, não tinha o alimento..." />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (!mealName.trim())}
                className="btn btn-primary w-full"
              >
                {saving ? 'Salvando...' : '✓ Salvar refeição'}
              </button>
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
