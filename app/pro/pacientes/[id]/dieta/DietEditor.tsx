'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { Patient, Food } from '@/lib/types'
import {
  saveDietPlan, addMeal, removeMeal, addFoodToMeal, removeFoodFromMeal,
  updateMealFood, addSubstitute, removeSubstitute, publishPlan, applyTemplate, updateMeal
} from './actions'

// ===================== TIPOS =====================
interface FoodMeasure { id: string; description: string; grams: number }
interface LocalFood extends Food { }
interface LocalSubstitute { id: string; food: LocalFood; quantity_g: number; quantity_description: string; sort_order: number }
interface LocalMealFood { id: string; food: LocalFood; quantity_g: number; quantity_description: string; food_id: string; meal_id: string; sort_order: number; notes: string | null; substitutes: LocalSubstitute[] }
interface LocalMeal { id: string; name: string; time_start: string; emoji: string; sort_order: number; meal_foods: LocalMealFood[]; notes: string | null }
interface LocalPlan { id: string; title?: string | null; kcal_goal: number | null; protein_goal_g: number | null; carbs_goal_g: number | null; fat_goal_g: number | null; notes: string | null; published_at: string | null; meals: LocalMeal[] }

// ===================== HELPERS =====================
function calcMacros(qty: number, food: LocalFood) {
  const ratio = qty / (food.portion_g || 100)
  return { kcal: food.kcal * ratio, protein: food.protein_g * ratio, carbs: food.carbs_g * ratio, fat: food.fat_g * ratio }
}
function mealTotal(meal: LocalMeal) {
  return meal.meal_foods.reduce((acc, mf) => {
    const m = calcMacros(mf.quantity_g, mf.food)
    return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}
function planTotal(meals: LocalMeal[]) {
  return meals.reduce((acc, meal) => {
    const t = mealTotal(meal)
    return { kcal: acc.kcal + t.kcal, protein: acc.protein + t.protein, carbs: acc.carbs + t.carbs, fat: acc.fat + t.fat }
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}
function r(n: number) { return Math.round(n * 10) / 10 }

// Regra de 3: calcula descrição proporcional ao peso com base na porção do alimento
function computeDesc(qty: number, food: LocalFood): string {
  const base = food.portion_g || 100
  const baseDesc = food.portion_description
  if (baseDesc && base > 0) {
    const ratio = qty / base
    const fmt = ratio % 1 === 0 ? ratio.toString() : (Math.round(ratio * 10) / 10).toString()
    return `${fmt} ${baseDesc} (${qty}g)`
  }
  return `${qty}g`
}

function sourceBadge(source?: string | null, label?: string | null) {
  const text = label || source || ''
  if (!text || text === 'custom') return null
  const color = text === 'TACO' ? 'bg-emerald-100 text-emerald-700' : text === 'IBGE' ? 'bg-blue-100 text-blue-700' : text === 'USDA' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
  return <span className={`${color} px-1.5 py-0.5 rounded text-[9px] font-bold ml-1`}>{text}</span>
}

// ===================== FOOD SEARCH =====================
function FoodSearch({ onSelect, placeholder }: { onSelect: (food: LocalFood) => void; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocalFood[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)
    if (timeout.current) clearTimeout(timeout.current)
    if (q.length < 2) { setResults([]); setOpen(false); return }
    timeout.current = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.foods ?? [])
      setOpen(true)
      setLoading(false)
    }, 300)
  }, [])

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder ?? 'Buscar alimento (ex: frango, arroz, ovo...)'}
        className="form-input text-sm"
      />
      {loading && <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Buscando...</div>}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {results.map(food => (
            <button key={food.id} type="button"
              onClick={() => { onSelect(food); setQuery(''); setResults([]); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 hover:bg-pgf-50 border-b border-gray-50 last:border-0 transition-colors"
            >
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-900">{food.name}</span>
                {sourceBadge(food.source, food.source_label)}
              </div>
              <div className="text-xs text-gray-400">
                {r(food.kcal)} kcal · P {r(food.protein_g)}g · C {r(food.carbs_g)}g · G {r(food.fat_g)}g
                <span className="ml-2 text-gray-300">(base {food.portion_g}g)</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ===================== MEASURE SELECT =====================
function MeasureSelect({ foodId, onMeasureSelect }: { foodId: string; onMeasureSelect: (grams: number, desc: string) => void }) {
  const [measures, setMeasures] = useState<FoodMeasure[]>([])

  useEffect(() => {
    fetch(`/api/foods/${foodId}/measures`)
      .then(r => r.json())
      .then(d => setMeasures(d.measures ?? []))
  }, [foodId])

  if (!measures.length) return null

  return (
    <div>
      <label className="form-label">Medida caseira</label>
      <select
        className="form-select text-sm"
        defaultValue=""
        onChange={e => {
          const m = measures.find(m => m.id === e.target.value)
          if (m) onMeasureSelect(m.grams, m.description)
        }}
      >
        <option value="">Selecionar medida caseira...</option>
        {measures.map(m => (
          <option key={m.id} value={m.id}>{m.description}</option>
        ))}
      </select>
    </div>
  )
}

// ===================== ADD FOOD MODAL =====================
function AddFoodModal({ meal, onClose, onAdded }: { meal: LocalMeal; onClose: () => void; onAdded: (mf: LocalMealFood) => void }) {
  const [selectedFood, setSelectedFood] = useState<LocalFood | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const macros = selectedFood ? (() => {
    const m = calcMacros(Number(quantity || 0), selectedFood)
    return { kcal: r(m.kcal), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) }
  })() : null

  function handleFoodSelect(food: LocalFood) {
    setSelectedFood(food)
    setQuantity(String(food.portion_g || 100))
    setDescription(food.portion_description ?? `${food.portion_g || 100}g`)
  }

  function handleMeasureSelect(grams: number, desc: string) {
    setQuantity(String(grams))
    setDescription(desc)
  }

  async function handleAdd() {
    if (!selectedFood || !quantity) return
    setLoading(true)
    const result = await addFoodToMeal(meal.id, selectedFood.id, Number(quantity), description || `${quantity}g`)
    if (result?.data) onAdded({ ...result.data, food: selectedFood, substitutes: [] } as LocalMealFood)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold">Adicionar alimento — {meal.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <FoodSearch onSelect={handleFoodSelect} />

          {selectedFood && (
            <>
              <div className="p-3 bg-pgf-50 rounded-lg border border-pgf-100">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-sm text-pgf-700">{selectedFood.name}</span>
                  {sourceBadge(selectedFood.source, selectedFood.source_label)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Base: {selectedFood.portion_g}g · {r(selectedFood.kcal)} kcal · P {r(selectedFood.protein_g)}g · C {r(selectedFood.carbs_g)}g · G {r(selectedFood.fat_g)}g
                </div>
              </div>

              <MeasureSelect foodId={selectedFood.id} onMeasureSelect={handleMeasureSelect} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Quantidade (g ou ml)</label>
                  <input type="number" step="0.5" min="0.5" value={quantity}
                    onChange={e => {
                      setQuantity(e.target.value)
                      const q = parseFloat(e.target.value)
                      if (selectedFood && !isNaN(q) && q > 0) setDescription(computeDesc(q, selectedFood))
                    }} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Medida caseira (editável)</label>
                  <input value={description}
                    onChange={e => setDescription(e.target.value)} className="form-input"
                    placeholder="ex: 2 col. de sopa (30g)" />
                </div>
              </div>

              {macros && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Kcal', value: macros.kcal, color: 'text-gray-900' },
                    { label: 'Prot', value: `${macros.protein}g`, color: 'text-blue-600' },
                    { label: 'Carb', value: `${macros.carbs}g`, color: 'text-amber-600' },
                    { label: 'Gord', value: `${macros.fat}g`, color: 'text-red-600' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-lg p-2">
                      <div className={`text-base font-black ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-gray-400">{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleAdd} disabled={!selectedFood || loading} className="btn btn-primary">
            {loading ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===================== ADD SUBSTITUTE MODAL =====================
function AddSubstituteModal({ mealFood, onClose, onAdded }: {
  mealFood: LocalMealFood
  onClose: () => void
  onAdded: (sub: LocalSubstitute) => void
}) {
  const [selectedFood, setSelectedFood] = useState<LocalFood | null>(null)
  const [quantity, setQuantity] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  // Kcal total do alimento principal
  const targetKcal = calcMacros(mealFood.quantity_g, mealFood.food).kcal

  function handleFoodSelect(food: LocalFood) {
    setSelectedFood(food)
    // auto-calcula quantidade equivalente em calorias
    const autoQty = food.kcal > 0 ? Math.round((targetKcal / food.kcal) * (food.portion_g || 100)) : food.portion_g || 100
    setQuantity(String(autoQty))
    setDescription(`${autoQty}g`)
  }

  function handleMeasureSelect(grams: number, desc: string) {
    setQuantity(String(grams))
    setDescription(desc)
  }

  const macros = selectedFood && quantity ? (() => {
    const m = calcMacros(Number(quantity), selectedFood)
    return { kcal: r(m.kcal), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) }
  })() : null

  async function handleAdd() {
    if (!selectedFood || !quantity) return
    setLoading(true)
    const result = await addSubstitute(mealFood.id, selectedFood.id, Number(quantity), description || `${quantity}g`)
    if (result?.data) onAdded({ ...result.data, food: selectedFood } as LocalSubstitute)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold">Adicionar substituto</h3>
            <div className="text-xs text-gray-400 mt-0.5">
              Para: {mealFood.food.name} ({mealFood.quantity_description || `${mealFood.quantity_g}g`}) · {r(targetKcal)} kcal
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <FoodSearch onSelect={handleFoodSelect} placeholder="Buscar substituto equivalente..." />

          {selectedFood && (
            <>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-sm text-amber-700">{selectedFood.name}</span>
                  {sourceBadge(selectedFood.source, selectedFood.source_label)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Quantidade calculada para ~{r(targetKcal)} kcal
                </div>
              </div>

              <MeasureSelect foodId={selectedFood.id} onMeasureSelect={handleMeasureSelect} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Quantidade (g ou ml)</label>
                  <input type="number" step="0.5" min="0.5" value={quantity}
                    onChange={e => {
                      setQuantity(e.target.value)
                      const q = parseFloat(e.target.value)
                      if (selectedFood && !isNaN(q) && q > 0) setDescription(computeDesc(q, selectedFood))
                    }} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Medida caseira (editável)</label>
                  <input value={description}
                    onChange={e => setDescription(e.target.value)} className="form-input"
                    placeholder="ex: 2 col. de sopa (30g)" />
                </div>
              </div>

              {macros && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Kcal', value: macros.kcal, color: Number(quantity) > 0 && Math.abs(macros.kcal - targetKcal) < 20 ? 'text-emerald-600' : 'text-gray-900' },
                    { label: 'Prot', value: `${macros.protein}g`, color: 'text-blue-600' },
                    { label: 'Carb', value: `${macros.carbs}g`, color: 'text-amber-600' },
                    { label: 'Gord', value: `${macros.fat}g`, color: 'text-red-600' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-lg p-2">
                      <div className={`text-base font-black ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-gray-400">{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleAdd} disabled={!selectedFood || loading} className="btn btn-primary">
            {loading ? 'Adicionando...' : '+ Substituto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===================== EDIT SUBSTITUTE MODAL =====================
function EditSubstituteModal({ sub, mainMf, onClose, onSaved }: {
  sub: LocalSubstitute
  mainMf: LocalMealFood
  onClose: () => void
  onSaved: (updated: LocalSubstitute) => void
}) {
  const [quantity, setQuantity] = useState(String(sub.quantity_g))
  const [description, setDescription] = useState(sub.quantity_description || `${sub.quantity_g}g`)
  const [loading, setLoading] = useState(false)

  const qty = parseFloat(quantity) || 0
  const macros = (() => {
    const m = calcMacros(qty, sub.food)
    return { kcal: r(m.kcal), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) }
  })()

  const mainFood = mainMf.food
  const mainKcal = r(calcMacros(mainMf.quantity_g, mainFood).kcal)
  const diff = Math.abs(macros.kcal - mainKcal)
  const kcalMatch = diff < 30

  function handleMeasureSelect(grams: number, desc: string) {
    setQuantity(String(grams))
    setDescription(desc)
  }

  async function handleSave() {
    if (!quantity || qty <= 0) return
    setLoading(true)
    const desc = description || `${qty}g`
    await fetch('/api/substitutes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sub.id, quantity_g: qty, quantity_description: desc }),
    })
    onSaved({ ...sub, quantity_g: qty, quantity_description: desc })
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-900">Editar substituto</h3>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <span className="font-medium text-amber-600">OU</span>
              <span>{sub.food.name}</span>
              {sourceBadge(sub.food.source, sub.food.source_label)}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Referência: alimento principal */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Alimento principal: </span>
            {mainFood.name} · {mainMf.quantity_g}g · {mainKcal} kcal
          </div>

          {/* Referência base do substituto */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Base do substituto</div>
            <div className="text-sm font-semibold text-amber-700">
              {sub.food.portion_g}g = {sub.food.portion_description ?? `${sub.food.portion_g}g`}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {r(sub.food.kcal)} kcal · P {r(sub.food.protein_g)}g · C {r(sub.food.carbs_g)}g · G {r(sub.food.fat_g)}g
            </div>
          </div>

          <MeasureSelect foodId={sub.food.id} onMeasureSelect={handleMeasureSelect} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Gramatura (g)</label>
              <input
                type="number" step="0.5" min="0.5" value={quantity}
                onChange={e => {
                  setQuantity(e.target.value)
                  const q = parseFloat(e.target.value)
                  if (!isNaN(q) && q > 0) setDescription(computeDesc(q, sub.food))
                }}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Medida caseira</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="form-input"
                placeholder="ex: 2 col. sopa (30g)"
              />
            </div>
          </div>

          {/* Preview macros com indicador de equivalência kcal */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Kcal', value: macros.kcal, color: kcalMatch ? 'text-emerald-600' : 'text-orange-500' },
              { label: 'Prot', value: `${macros.protein}g`, color: 'text-blue-600' },
              { label: 'Carb', value: `${macros.carbs}g`, color: 'text-amber-600' },
              { label: 'Gord', value: `${macros.fat}g`, color: 'text-red-600' },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-lg p-2">
                <div className={`text-base font-black ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-gray-400">{m.label}</div>
              </div>
            ))}
          </div>
          {!kcalMatch && qty > 0 && (
            <p className="text-[11px] text-orange-500">
              Diferença de {r(diff)} kcal em relação ao alimento principal ({mainKcal} kcal).
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={!quantity || qty <= 0 || loading} className="btn btn-primary">
            {loading ? 'Salvando...' : 'Salvar substituto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===================== EDIT FOOD MODAL =====================
function EditFoodModal({ mf, onClose, onSaved }: {
  mf: LocalMealFood
  onClose: () => void
  onSaved: (updatedMf: LocalMealFood) => void
}) {
  const [quantity, setQuantity] = useState(String(mf.quantity_g))
  const [description, setDescription] = useState(mf.quantity_description || `${mf.quantity_g}g`)
  const [loading, setLoading] = useState(false)

  const qty = parseFloat(quantity) || 0
  const macros = (() => {
    const m = calcMacros(qty, mf.food)
    return { kcal: r(m.kcal), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) }
  })()

  function handleMeasureSelect(grams: number, desc: string) {
    setQuantity(String(grams))
    setDescription(desc)
  }

  async function handleSave() {
    if (!quantity || qty <= 0) return
    setLoading(true)
    await updateMealFood(mf.id, qty, description || `${qty}g`)
    onSaved({ ...mf, quantity_g: qty, quantity_description: description || `${qty}g` })
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-900">Editar quantidade</h3>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              {mf.food.name}{sourceBadge(mf.food.source, mf.food.source_label)}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Referência base */}
          <div className="p-3 bg-pgf-50 rounded-lg border border-pgf-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Referência base do alimento</div>
            <div className="text-sm font-semibold text-pgf-700">
              {mf.food.portion_g}g = {mf.food.portion_description ?? `${mf.food.portion_g}g`}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {r(mf.food.kcal)} kcal · P {r(mf.food.protein_g)}g · C {r(mf.food.carbs_g)}g · G {r(mf.food.fat_g)}g
            </div>
          </div>

          {/* Medida caseira dropdown */}
          <MeasureSelect foodId={mf.food_id} onMeasureSelect={handleMeasureSelect} />

          {/* Inputs de quantidade e descrição */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Gramatura (g)</label>
              <input
                type="number" step="0.5" min="0.5" value={quantity}
                onChange={e => {
                  setQuantity(e.target.value)
                  const q = parseFloat(e.target.value)
                  if (!isNaN(q) && q > 0) setDescription(computeDesc(q, mf.food))
                }}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Medida caseira</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="form-input"
                placeholder="ex: 1.5 fatia (75g)"
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            Selecione uma medida caseira para preencher automaticamente, ou digite a gramatura para calcular a descrição proporcional.
          </p>

          {/* Preview macros */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Kcal', value: macros.kcal, color: 'text-gray-900' },
              { label: 'Prot', value: `${macros.protein}g`, color: 'text-blue-600' },
              { label: 'Carb', value: `${macros.carbs}g`, color: 'text-amber-600' },
              { label: 'Gord', value: `${macros.fat}g`, color: 'text-red-600' },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-lg p-2">
                <div className={`text-base font-black ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-gray-400">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={!quantity || qty <= 0 || loading} className="btn btn-primary">
            {loading ? 'Salvando...' : 'Salvar alteração'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===================== MEAL FOOD ROW =====================
function MealFoodRow({ mf, onQtyChange, onRemove, onSubAdded, onSubRemoved, onSubUpdated, onFullUpdate }: {
  mf: LocalMealFood
  onQtyChange: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onSubAdded: (mfId: string, sub: LocalSubstitute) => void
  onSubRemoved: (mfId: string, subId: string) => void
  onSubUpdated: (mfId: string, updatedSub: LocalSubstitute) => void
  onFullUpdate: (updatedMf: LocalMealFood) => void
}) {
  const [addSubOpen, setAddSubOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<LocalSubstitute | null>(null)
  const [showSubs, setShowSubs] = useState(true)

  const m = calcMacros(mf.quantity_g, mf.food)
  const mainKcal = m.kcal
  const subs = mf.substitutes ?? []
  const hasSubs = subs.length > 0

  const COL = '1fr 90px 60px 60px 60px 55px 105px'

  return (
    <>
      {/* ── Main food row ── */}
      <div
        className="grid items-center py-2.5 hover:bg-gray-50/40 transition-colors"
        style={{
          gridTemplateColumns: COL,
          borderBottom: hasSubs && showSubs ? 'none' : '1px solid #f3f4f6',
        }}
      >
        <div className="pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Collapse toggle when substitutes exist */}
            {hasSubs && (
              <button
                onClick={() => setShowSubs(v => !v)}
                title={showSubs ? 'Ocultar opções' : 'Mostrar opções'}
                className="text-amber-400 hover:text-amber-600 font-bold text-xs leading-none transition-colors flex-shrink-0 w-3"
              >
                {showSubs ? '▾' : '▸'}
              </button>
            )}
            <span className="text-sm font-semibold text-gray-800">{mf.food.name}</span>
            {sourceBadge(mf.food.source, mf.food.source_label)}
            {/* Substitute count badge */}
            {hasSubs && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full cursor-pointer select-none"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)' }}
                onClick={() => setShowSubs(v => !v)}
                title="Opções de substituição"
              >
                {subs.length} OU
              </span>
            )}
          </div>
          {mf.quantity_description && (
            <div className="text-[11px] text-gray-400 mt-0.5 pl-4">{mf.quantity_description}</div>
          )}
        </div>

        <input
          type="number" step="0.5" value={mf.quantity_g}
          onChange={e => onQtyChange(mf.id, Number(e.target.value))}
          className="form-input text-xs text-center py-1 px-2"
        />
        <span className="text-center text-sm font-semibold text-blue-600">{r(m.protein)}g</span>
        <span className="text-center text-sm font-semibold text-amber-600">{r(m.carbs)}g</span>
        <span className="text-center text-sm font-semibold text-red-500">{r(m.fat)}g</span>
        <span className="text-center text-sm font-bold text-gray-700">{r(m.kcal)}</span>

        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setEditOpen(true)}
            title="Editar quantidade/medida"
            className="text-gray-300 hover:text-pgf-500 transition-colors w-6 flex items-center justify-center"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            onClick={() => setAddSubOpen(true)}
            title="Adicionar substituto"
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors"
            style={{ color: '#D97706', borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.15)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.06)' }}
          >
            + OU
          </button>
          <button
            onClick={() => onRemove(mf.id)}
            className="text-gray-200 hover:text-red-400 text-base transition-colors w-5 text-center"
          >✕</button>
        </div>
      </div>

      {/* ── Substitutes block ── */}
      {hasSubs && showSubs && (
        <div
          className="relative mb-0"
          style={{
            borderLeft: '3px solid rgba(245,158,11,0.35)',
            marginLeft: '12px',
            background: 'rgba(254,252,243,0.6)',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          {subs.map((sub, idx) => {
            const sm = calcMacros(sub.quantity_g, sub.food)
            const kcalDiff = Math.abs(sm.kcal - mainKcal)
            const kcalPct = mainKcal > 0 ? kcalDiff / mainKcal : 1
            const kcalOk = kcalPct < 0.12
            const isLast = idx === subs.length - 1

            return (
              <div
                key={sub.id}
                className="grid items-center py-2 px-3 hover:bg-amber-50/50 transition-colors"
                style={{
                  gridTemplateColumns: COL,
                  borderBottom: isLast ? 'none' : '1px solid rgba(245,158,11,0.1)',
                }}
              >
                {/* Food name + badges */}
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* OU tag */}
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: 'rgba(245,158,11,0.18)', color: '#B45309', letterSpacing: '0.05em' }}
                    >
                      OU
                    </span>
                    <span className="text-xs font-medium text-gray-700">{sub.food.name}</span>
                    {sourceBadge(sub.food.source, sub.food.source_label)}
                    {/* Kcal equivalence badge */}
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={kcalOk
                        ? { background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }
                        : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }
                      }
                      title={`${r(sm.kcal)} kcal vs ${r(mainKcal)} kcal do alimento principal`}
                    >
                      {r(sm.kcal)} kcal {kcalOk ? '≈' : '≠'}
                    </span>
                  </div>
                  {sub.quantity_description && (
                    <div className="text-[10px] text-gray-400 mt-0.5 pl-5">{sub.quantity_description}</div>
                  )}
                </div>

                {/* Qtd */}
                <span className="text-center text-xs text-gray-400">{sub.quantity_g}g</span>
                {/* Macros */}
                <span className="text-center text-xs text-blue-400">{r(sm.protein)}g</span>
                <span className="text-center text-xs text-amber-400">{r(sm.carbs)}g</span>
                <span className="text-center text-xs text-red-400">{r(sm.fat)}g</span>
                {/* Kcal (muted, since shown in badge) */}
                <span className="text-center text-xs text-gray-400">{r(sm.kcal)}</span>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => setEditingSub(sub)}
                    title="Editar substituto"
                    className="text-gray-300 hover:text-amber-500 transition-colors w-6 flex items-center justify-center"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={async () => { await removeSubstitute(sub.id); onSubRemoved(mf.id, sub.id) }}
                    className="text-gray-200 hover:text-red-400 text-sm transition-colors w-5 text-center"
                  >✕</button>
                </div>
              </div>
            )
          })}

          {/* Add substitute row at bottom of block */}
          <button
            onClick={() => setAddSubOpen(true)}
            className="w-full flex items-center gap-1.5 py-1.5 px-3 text-xs transition-colors"
            style={{ color: 'rgba(180,83,9,0.6)', borderTop: '1px dashed rgba(245,158,11,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
          >
            <span className="font-bold">+</span>
            <span>Adicionar outra opção</span>
          </button>
        </div>
      )}

      {/* Modals */}
      {addSubOpen && (
        <AddSubstituteModal
          mealFood={mf}
          onClose={() => setAddSubOpen(false)}
          onAdded={sub => { onSubAdded(mf.id, sub); setAddSubOpen(false) }}
        />
      )}
      {editOpen && (
        <EditFoodModal
          mf={mf}
          onClose={() => setEditOpen(false)}
          onSaved={updatedMf => { onFullUpdate(updatedMf); setEditOpen(false) }}
        />
      )}
      {editingSub && (
        <EditSubstituteModal
          sub={editingSub}
          mainMf={mf}
          onClose={() => setEditingSub(null)}
          onSaved={updated => { onSubUpdated(mf.id, updated); setEditingSub(null) }}
        />
      )}
    </>
  )
}

// ===================== MEAL CARD =====================
function MealCard({ meal, planId, onUpdate, onRemoveMeal }: {
  meal: LocalMeal; planId: string
  onUpdate: (updated: LocalMeal) => void
  onRemoveMeal: (mealId: string) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mealNotes, setMealNotes] = useState(meal.notes ?? '')
  const [notesDirty, setNotesDirty] = useState(false)
  const total = mealTotal(meal)

  function handleFoodAdded(mf: LocalMealFood) {
    onUpdate({ ...meal, meal_foods: [...meal.meal_foods, mf] })
  }

  async function handleRemoveFood(mfId: string) {
    await removeFoodFromMeal(mfId)
    onUpdate({ ...meal, meal_foods: meal.meal_foods.filter(mf => mf.id !== mfId) })
  }

  async function handleQtyChange(mfId: string, qty: number) {
    const mf = meal.meal_foods.find(m => m.id === mfId)
    if (!mf) return

    const newDesc = computeDesc(qty, mf.food)
    const targetKcal = calcMacros(qty, mf.food).kcal

    // Atualização otimista imediata na UI
    onUpdate({
      ...meal,
      meal_foods: meal.meal_foods.map(m => {
        if (m.id !== mfId) return m
        const tKcal = calcMacros(qty, m.food).kcal
        const updatedSubs = (m.substitutes ?? []).map(sub => {
          const newQty = sub.food.kcal > 0 ? Math.round((tKcal / sub.food.kcal) * (sub.food.portion_g || 100)) : sub.quantity_g
          return { ...sub, quantity_g: newQty, quantity_description: computeDesc(newQty, sub.food) }
        })
        return { ...m, quantity_g: qty, quantity_description: newDesc, substitutes: updatedSubs }
      })
    })

    // Persiste no banco em background
    for (const sub of mf.substitutes ?? []) {
      const newQty = sub.food.kcal > 0 ? Math.round((targetKcal / sub.food.kcal) * (sub.food.portion_g || 100)) : sub.quantity_g
      await fetch('/api/substitutes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, quantity_g: newQty, quantity_description: computeDesc(newQty, sub.food) })
      })
    }
    await updateMealFood(mfId, qty, newDesc)
  }

  // Chamado pelo EditFoodModal — atualiza a refeição completa (alimento + substitutos recalculados)
  async function handleFullUpdate(updatedMf: LocalMealFood) {
    const prevMf = meal.meal_foods.find(m => m.id === updatedMf.id)
    if (!prevMf) return

    const targetKcal = calcMacros(updatedMf.quantity_g, updatedMf.food).kcal
    const updatedSubs = (prevMf.substitutes ?? []).map(sub => {
      const newQty = sub.food.kcal > 0
        ? Math.round((targetKcal / sub.food.kcal) * (sub.food.portion_g || 100))
        : sub.quantity_g
      return { ...sub, quantity_g: newQty, quantity_description: computeDesc(newQty, sub.food) }
    })

    const newMf = { ...updatedMf, substitutes: updatedSubs }
    onUpdate({ ...meal, meal_foods: meal.meal_foods.map(m => m.id === newMf.id ? newMf : m) })

    // Persiste substitutos atualizados em background
    for (const sub of updatedSubs) {
      await fetch('/api/substitutes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, quantity_g: sub.quantity_g, quantity_description: sub.quantity_description })
      })
    }
  }

  function handleSubAdded(mfId: string, sub: LocalSubstitute) {
    onUpdate({
      ...meal,
      meal_foods: meal.meal_foods.map(mf =>
        mf.id === mfId ? { ...mf, substitutes: [...(mf.substitutes ?? []), sub] } : mf
      )
    })
  }

  function handleSubRemoved(mfId: string, subId: string) {
    onUpdate({
      ...meal,
      meal_foods: meal.meal_foods.map(mf =>
        mf.id === mfId ? { ...mf, substitutes: (mf.substitutes ?? []).filter(s => s.id !== subId) } : mf
      )
    })
  }

  function handleSubUpdated(mfId: string, updatedSub: LocalSubstitute) {
    onUpdate({
      ...meal,
      meal_foods: meal.meal_foods.map(mf =>
        mf.id === mfId
          ? { ...mf, substitutes: (mf.substitutes ?? []).map(s => s.id === updatedSub.id ? updatedSub : s) }
          : mf
      )
    })
  }

  async function handleRemoveMeal() {
    if (!confirm(`Remover refeição "${meal.name}"?`)) return
    await removeMeal(meal.id)
    onRemoveMeal(meal.id)
  }

  async function handleNotesSave() {
    if (!notesDirty) return
    await updateMeal(meal.id, { notes: mealNotes })
    setNotesDirty(false)
  }

  return (
    <div className="card mb-4 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 bg-pgf-50 border-b border-pgf-100 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          {meal.emoji
            ? <span className="text-xl">{meal.emoji}</span>
            : <span className="w-7 h-7 rounded-lg bg-pgf-100 flex items-center justify-center text-[10px] font-black text-pgf-600">R</span>
          }
          <div>
            <div className="font-bold text-pgf-700">{meal.name}</div>
            {meal.time_start && <div className="text-xs text-gray-400">{meal.time_start}</div>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm">
            <span className="font-black text-gray-900">{r(total.kcal)} kcal</span>
            <span className="text-blue-600 font-semibold hidden sm:block">P {r(total.protein)}g</span>
            <span className="text-amber-600 font-semibold hidden sm:block">C {r(total.carbs)}g</span>
            <span className="text-red-500 font-semibold hidden sm:block">G {r(total.fat)}g</span>
          </div>
          <button onClick={e => { e.stopPropagation(); handleRemoveMeal() }}
            className="text-gray-300 hover:text-red-400 text-lg transition-colors">✕</button>
          <span className="text-gray-400 text-sm">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-4">
          {meal.meal_foods.length > 0 && (
            <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 border-b border-gray-100"
              style={{ gridTemplateColumns: '1fr 90px 60px 60px 60px 55px 80px' }}>
              <span>Alimento</span>
              <span className="text-center">Qtd (g)</span>
              <span className="text-center text-blue-500">Prot</span>
              <span className="text-center text-amber-500">Carb</span>
              <span className="text-center text-red-500">Gord</span>
              <span className="text-center">Kcal</span>
              <span className="text-center">Ações</span>
            </div>
          )}

          {meal.meal_foods.map(mf => (
            <MealFoodRow
              key={mf.id}
              mf={mf}
              onQtyChange={handleQtyChange}
              onRemove={handleRemoveFood}
              onSubAdded={handleSubAdded}
              onSubRemoved={handleSubRemoved}
              onSubUpdated={handleSubUpdated}
              onFullUpdate={handleFullUpdate}
            />
          ))}

          {/* Orientações da refeição */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <label className="flex items-center gap-1.5 form-label mb-1.5">
              <span>Orientações da refeição</span>
              {notesDirty && (
                <span className="text-[10px] font-normal normal-case tracking-normal text-amber-500 ml-1">
                  • não salvo
                </span>
              )}
            </label>
            <textarea
              value={mealNotes}
              onChange={e => { setMealNotes(e.target.value); setNotesDirty(true) }}
              onBlur={handleNotesSave}
              rows={3}
              className="form-textarea text-xs w-full resize-y"
              placeholder="Orientações para esta refeição: substituições permitidas, dicas de preparo, alimentos livres, horário flexível..."
            />
            <div className="text-[10px] text-gray-400 mt-1">Salvo automaticamente ao sair do campo.</div>
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 border-2 border-dashed border-pgf-200 rounded-lg text-sm text-pgf-500 hover:bg-pgf-50 hover:border-pgf-400 transition-all"
          >
            + Adicionar alimento
          </button>
        </div>
      )}

      {addOpen && (
        <AddFoodModal meal={meal} onClose={() => setAddOpen(false)} onAdded={handleFoodAdded} />
      )}
    </div>
  )
}

// ===================== TEMPLATE PICKER =====================
function TemplatePickerModal({ planId, onPicked, onBlank }: {
  planId: string
  onPicked: (meals: LocalMeal[]) => void
  onBlank: () => void
}) {
  const [loading, setLoading] = useState<'feminino' | 'masculino' | null>(null)

  async function pick(tpl: 'feminino' | 'masculino') {
    setLoading(tpl)
    const result = await applyTemplate(planId, tpl)
    if (result?.meals) onPicked(result.meals as LocalMeal[])
  }

  const options = [
    {
      id: 'feminino' as const,
      icon: 'F',
      label: 'Modelo Feminino',
      kcal: '~1300 kcal',
      desc: 'Porções menores, 4 refeições',
      accent: 'border-pink-200 hover:border-pink-400',
      badge: 'bg-pink-100 text-pink-700',
    },
    {
      id: 'masculino' as const,
      icon: 'M',
      label: 'Modelo Masculino',
      kcal: '~1800 kcal',
      desc: 'Porções maiores, 4 refeições',
      accent: 'border-blue-200 hover:border-blue-400',
      badge: 'bg-blue-100 text-blue-700',
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Novo Plano Alimentar</h2>
          <p className="text-sm text-gray-400 mt-0.5">Como deseja iniciar o plano?</p>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          {options.map(opt => (
            <button
              key={opt.id}
              disabled={loading !== null}
              onClick={() => pick(opt.id)}
              className={`border-2 rounded-xl p-5 text-left transition-all hover:shadow-md disabled:opacity-60 ${opt.accent}`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black mb-3"
                style={{ background: opt.id === 'feminino' ? 'rgba(236,72,153,0.1)' : 'rgba(37,99,235,0.1)', color: opt.id === 'feminino' ? '#DB2777' : '#2563EB' }}
              >
                {opt.icon}
              </div>
              <div className="font-bold text-gray-900 text-sm">{opt.label}</div>
              <div className="mt-1">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${opt.badge}`}>{opt.kcal}</span>
              </div>
              <div className="text-xs text-gray-400 mt-2">{opt.desc}</div>
              {loading === opt.id && (
                <div className="text-xs text-gray-400 mt-2 font-medium">Aplicando template...</div>
              )}
            </button>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button
            disabled={loading !== null}
            onClick={onBlank}
            className="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-60"
          >
            Começar do zero (plano em branco)
          </button>
        </div>
      </div>
    </div>
  )
}

// ===================== EDITOR PRINCIPAL =====================
export default function DietEditor({ patient, plan, professionalId }: {
  patient: Patient
  plan: LocalPlan
  professionalId: string
}) {
  const [meals, setMeals] = useState<LocalMeal[]>(
    (plan.meals ?? []).map(m => ({
      ...m,
      meal_foods: (m.meal_foods ?? []).map(mf => ({
        ...mf,
        substitutes: (mf as LocalMealFood).substitutes ?? []
      }))
    }))
  )
  // Show template picker when the plan has no meals yet
  const [showTemplatePicker, setShowTemplatePicker] = useState(plan.meals?.length === 0)
  const [tab, setTab] = useState<'plano' | 'metas' | 'anamnese' | 'evolucao' | 'pdf'>('plano')
  const [addMealOpen, setAddMealOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState('')

  const totals = planTotal(meals)
  const goals = { kcal: plan.kcal_goal ?? 0, protein: plan.protein_goal_g ?? 0, carbs: plan.carbs_goal_g ?? 0, fat: plan.fat_goal_g ?? 0 }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleAddMeal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const result = await addMeal(plan.id, fd.get('name') as string, fd.get('time') as string, fd.get('emoji') as string)
    if (result?.data) {
      setMeals(prev => [...prev, { ...result.data, meal_foods: [] } as LocalMeal])
    }
    setAddMealOpen(false)
  }

  async function handlePublish() {
    if (meals.length === 0) {
      showToast('Adicione pelo menos uma refeição antes de publicar.')
      return
    }
    const totalFoods = meals.reduce((sum, m) => sum + m.meal_foods.length, 0)
    if (totalFoods === 0) {
      showToast('Adicione alimentos às refeições antes de publicar.')
      return
    }
    setPublishing(true)
    await publishPlan(plan.id)
    showToast('Plano publicado! O aluno já pode acessar.')
    setPublishing(false)
  }

  return (
    <div>
      {showTemplatePicker && (
        <TemplatePickerModal
          planId={plan.id}
          onPicked={newMeals => { setMeals(newMeals); setShowTemplatePicker(false); showToast('Template aplicado. Ajuste as quantidades conforme necessário.') }}
          onBlank={() => setShowTemplatePicker(false)}
        />
      )}

      {/* Topbar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-8 h-15 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patient.id}`} className="btn btn-ghost btn-sm">← {patient.full_name}</Link>
          <div>
            <div className="font-bold text-gray-900">{plan.title || 'Plano Alimentar'}</div>
            <div className="text-xs text-gray-400">{patient.goal} · {patient.weight_kg}kg · {patient.height_cm}cm</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('pdf')} className="btn btn-outline btn-sm">Pré-visualizar PDF</button>
          <button onClick={handlePublish} disabled={publishing} className="btn btn-primary btn-sm">
            {publishing ? 'Publicando...' : 'Publicar para aluno'}
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 no-print">
          {(['plano', 'metas', 'anamnese', 'evolucao', 'pdf'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'active' : ''}`}>
              {t === 'plano' && 'Plano Alimentar'}
              {t === 'metas' && 'Metas & Macros'}
              {t === 'anamnese' && 'Anamnese'}
              {t === 'evolucao' && 'Evolução'}
              {t === 'pdf' && 'Visualizar PDF'}
            </button>
          ))}
        </div>

        {/* TAB: PLANO */}
        {tab === 'plano' && (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Calorias', value: r(totals.kcal), goal: goals.kcal, unit: 'kcal', color: 'text-gray-900', bar: '#2B3A8E' },
                { label: 'Proteína', value: r(totals.protein), goal: goals.protein, unit: 'g', color: 'text-blue-600', bar: '#2563EB' },
                { label: 'Carboidrato', value: r(totals.carbs), goal: goals.carbs, unit: 'g', color: 'text-amber-600', bar: '#D97706' },
                { label: 'Gordura', value: r(totals.fat), goal: goals.fat, unit: 'g', color: 'text-red-500', bar: '#EF4444' },
              ].map(macro => {
                const pct = macro.goal > 0 ? Math.min(Math.round((macro.value / macro.goal) * 100), 110) : 0
                return (
                  <div key={macro.label} className="card p-4">
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{macro.label}</div>
                    <div className={`text-2xl font-black my-0.5 ${macro.color}`}>{macro.value}</div>
                    <div className="text-xs text-gray-400">{macro.unit} {macro.goal > 0 ? `· meta ${macro.goal}` : ''}</div>
                    {macro.goal > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: macro.bar }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {meals.map(meal => (
              <MealCard
                key={meal.id}
                meal={meal}
                planId={plan.id}
                onUpdate={updated => setMeals(prev => prev.map(m => m.id === updated.id ? updated : m))}
                onRemoveMeal={id => setMeals(prev => prev.filter(m => m.id !== id))}
              />
            ))}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setAddMealOpen(true)} className="btn btn-outline">+ Nova Refeição</button>
            </div>
          </div>
        )}

        {tab === 'metas' && <MetasTab plan={plan} patient={patient} planId={plan.id} onSaved={showToast} />}
        {tab === 'anamnese' && <AnamneseTab patient={patient} planId={plan.id} onSaved={showToast} />}
        {tab === 'evolucao' && <EvolucaoTab patientId={patient.id} professionalId={professionalId} />}
        {tab === 'pdf' && <PdfPreview patient={patient} plan={plan} meals={meals} totals={totals} />}
      </div>

      {/* Modal nova refeição */}
      {addMealOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddMealOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Nova Refeição</h3>
            <form onSubmit={handleAddMeal} className="space-y-4">
              <div>
                <label className="form-label">Nome</label>
                <input name="name" required className="form-input" placeholder="Café da manhã, Almoço..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Horário</label>
                  <input name="time" type="time" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Ícone</label>
                  <select name="emoji" className="form-select">
                    <option>☀️</option><option>🍎</option><option>🍽️</option>
                    <option>🌙</option><option>⚡</option><option>🏋️</option>
                    <option>🥗</option><option>💊</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setAddMealOpen(false)} className="btn btn-ghost">Cancelar</button>
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

// ===================== METAS TAB =====================
function MetasTab({ plan, patient, planId, onSaved }: { plan: LocalPlan; patient: Patient; planId: string; onSaved: (msg: string) => void }) {
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    await saveDietPlan(planId, {
      kcal_goal: Number(fd.get('kcal_goal')),
      protein_goal_g: Number(fd.get('protein_goal_g')),
      carbs_goal_g: Number(fd.get('carbs_goal_g')),
      fat_goal_g: Number(fd.get('fat_goal_g')),
      notes: fd.get('notes') as string,
    })
    setSaving(false)
    onSaved('Metas salvas.')
  }

  const w = patient.weight_kg ?? 0, h = patient.height_cm ?? 0
  const tmb = patient.gender === 'F'
    ? 655.1 + (9.563 * w) + (1.850 * h)
    : 66.5 + (13.75 * w) + (5.003 * h)
  const fatores: Record<string, number> = { sedentario: 1.2, levemente_ativo: 1.375, moderadamente_ativo: 1.55, muito_ativo: 1.725 }
  const get = Math.round(tmb * (fatores[patient.activity_level ?? 'levemente_ativo'] ?? 1.375))

  return (
    <form onSubmit={handleSave}>
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><span className="card-title">Metas Calóricas</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-pgf-50 rounded-lg text-sm">
              <div><div className="text-gray-400 text-xs">TMB estimada</div><div className="font-black text-pgf-600">{Math.round(tmb)} kcal</div></div>
              <div><div className="text-gray-400 text-xs">GET (com atividade)</div><div className="font-black text-pgf-600">{get} kcal</div></div>
            </div>
            <div>
              <label className="form-label">Meta calórica diária (kcal)</label>
              <input name="kcal_goal" type="number" defaultValue={plan.kcal_goal ?? ''} className="form-input" placeholder={String(get)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="form-label">Proteína (g)</label><input name="protein_goal_g" type="number" defaultValue={plan.protein_goal_g ?? ''} className="form-input" /></div>
              <div><label className="form-label">Carboidrato (g)</label><input name="carbs_goal_g" type="number" defaultValue={plan.carbs_goal_g ?? ''} className="form-input" /></div>
              <div><label className="form-label">Gordura (g)</label><input name="fat_goal_g" type="number" defaultValue={plan.fat_goal_g ?? ''} className="form-input" /></div>
            </div>
            <div>
              <label className="form-label">Orientações do plano</label>
              <textarea name="notes" defaultValue={plan.notes ?? ''} className="form-textarea" rows={3} placeholder="Orientações gerais, restrições..." />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Dados do Paciente</span></div>
          <div className="card-body space-y-3 text-sm">
            {[
              { label: 'Nome', value: patient.full_name },
              { label: 'Peso', value: patient.weight_kg ? `${patient.weight_kg} kg` : '—' },
              { label: 'Altura', value: patient.height_cm ? `${patient.height_cm} cm` : '—' },
              { label: 'Objetivo', value: patient.goal ?? '—' },
              { label: 'Atividade', value: patient.activity_level ?? '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-semibold">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Salvando...' : 'Salvar Metas'}
        </button>
      </div>
    </form>
  )
}

// ===================== ANAMNESE TAB =====================
function AnamneseTab({ patient, planId, onSaved }: { patient: Patient; planId: string; onSaved: (msg: string) => void }) {
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    await saveDietPlan(planId, {
      anamnesis: {
        allergies: fd.get('allergies'), dislikes: fd.get('dislikes'),
        preferences: fd.get('preferences'), meals_per_day: fd.get('meals_per_day'),
        supplements: fd.get('supplements'), medications: fd.get('medications'),
        pathologies: fd.get('pathologies'), sleep_quality: fd.get('sleep_quality'),
        stress_level: fd.get('stress_level'), notes: fd.get('notes'),
      }
    })
    setSaving(false)
    onSaved('Anamnese salva.')
  }

  return (
    <form onSubmit={handleSave}>
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><span className="card-title">Anamnese Alimentar</span></div>
          <div className="card-body space-y-4">
            <div><label className="form-label">Alergias e intolerâncias</label><input name="allergies" className="form-input" placeholder="Lactose, glúten..." /></div>
            <div><label className="form-label">Alimentos que não gosta</label><input name="dislikes" className="form-input" placeholder="Fígado, peixe seco..." /></div>
            <div><label className="form-label">Alimentos preferidos</label><input name="preferences" className="form-input" placeholder="Frango, ovos, frutas..." /></div>
            <div>
              <label className="form-label">Refeições por dia</label>
              <select name="meals_per_day" className="form-select">
                <option value="3">3 refeições</option>
                <option value="4">4 refeições</option>
                <option value="5">5 refeições</option>
                <option value="6">6 refeições</option>
              </select>
            </div>
            <div><label className="form-label">Observações</label><textarea name="notes" className="form-textarea" rows={3} placeholder="Rotina alimentar, horários especiais..." /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Histórico Clínico</span></div>
          <div className="card-body space-y-4">
            <div><label className="form-label">Patologias</label><input name="pathologies" className="form-input" placeholder="Diabetes, hipertensão..." /></div>
            <div><label className="form-label">Medicamentos em uso</label><input name="medications" className="form-input" placeholder="Metformina, anticoncepcional..." /></div>
            <div><label className="form-label">Suplementação atual</label><input name="supplements" className="form-input" placeholder="Whey protein, vitamina D..." /></div>
            <div>
              <label className="form-label">Qualidade do sono</label>
              <select name="sleep_quality" className="form-select">
                <option value="ruim">Ruim (menos de 5h)</option>
                <option value="regular">Regular (5–7h)</option>
                <option value="bom">Bom (7–9h)</option>
              </select>
            </div>
            <div><label className="form-label">Nível de estresse (1–10)</label><input name="stress_level" type="number" min="1" max="10" className="form-input" placeholder="7" /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar Anamnese'}</button>
      </div>
    </form>
  )
}

// ===================== EVOLUÇÃO TAB =====================
function EvolucaoTab({ patientId, professionalId }: { patientId: string; professionalId: string }) {
  const [records, setRecords] = useState<{ id: string; measured_at: string; weight_kg: number | null; body_fat_pct: number | null; waist_cm: number | null; hip_cm: number | null; adherence_pct: number | null; notes: string | null }[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, professional_id: professionalId, measured_at: fd.get('measured_at'), weight_kg: fd.get('weight_kg') || null, body_fat_pct: fd.get('body_fat_pct') || null, waist_cm: fd.get('waist_cm') || null, hip_cm: fd.get('hip_cm') || null, adherence_pct: fd.get('adherence_pct') || null, notes: fd.get('notes') || null })
    })
    const data = await res.json()
    if (data.record) setRecords(prev => [data.record, ...prev])
    setAddOpen(false)
    setLoading(false)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setAddOpen(true)} className="btn btn-primary">+ Novo check-in</button>
      </div>
      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              {['Data', 'Peso', '% Gordura', 'Cintura', 'Quadril', 'Adesão', 'Obs'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map(rec => (
              <tr key={rec.id} className="border-b border-gray-50">
                <td className="px-5 py-3 font-semibold text-sm">{new Date(rec.measured_at + 'T12:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-5 py-3 text-sm">{rec.weight_kg ? `${rec.weight_kg} kg` : '—'}</td>
                <td className="px-5 py-3 text-sm">{rec.body_fat_pct ? `${rec.body_fat_pct}%` : '—'}</td>
                <td className="px-5 py-3 text-sm">{rec.waist_cm ? `${rec.waist_cm} cm` : '—'}</td>
                <td className="px-5 py-3 text-sm">{rec.hip_cm ? `${rec.hip_cm} cm` : '—'}</td>
                <td className="px-5 py-3">{rec.adherence_pct ? <span className="badge badge-green">{rec.adherence_pct}%</span> : '—'}</td>
                <td className="px-5 py-3 text-xs text-gray-400">{rec.notes ?? ''}</td>
              </tr>
            ))}
            {!records.length && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                Nenhum check-in registrado. Clique em "Novo check-in" para começar.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Novo Check-in</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="form-label">Data da avaliação</label><input name="measured_at" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="form-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Peso (kg)</label><input name="weight_kg" type="number" step="0.1" className="form-input" /></div>
                <div><label className="form-label">% Gordura</label><input name="body_fat_pct" type="number" step="0.1" className="form-input" /></div>
                <div><label className="form-label">Cintura (cm)</label><input name="waist_cm" type="number" step="0.1" className="form-input" /></div>
                <div><label className="form-label">Quadril (cm)</label><input name="hip_cm" type="number" step="0.1" className="form-input" /></div>
                <div><label className="form-label">Adesão (%)</label><input name="adherence_pct" type="number" min="0" max="100" className="form-input" /></div>
              </div>
              <div><label className="form-label">Observações</label><textarea name="notes" className="form-textarea" rows={2} /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== PDF PREVIEW — estilo Webdiet =====================
function PdfPreview({ patient, plan, meals, totals }: {
  patient: Patient; plan: LocalPlan; meals: LocalMeal[]; totals: ReturnType<typeof planTotal>
}) {
  return (
    <div>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <button onClick={() => window.print()} className="btn btn-primary">Imprimir / Salvar PDF</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg max-w-3xl mx-auto" id="pdf-content">
        {/* Header */}
        <div className="bg-pgf-600 px-8 py-6 flex items-center justify-between">
          <div className="text-white">
            <div className="text-4xl font-black italic tracking-tighter leading-none">PGF</div>
            <div className="text-xs font-bold tracking-[2px] uppercase mt-1 opacity-90">Pedro Garrastazu Frey</div>
            <div className="text-xs opacity-50">Nutricionista · CRN-2 00000</div>
          </div>
          <div className="text-white text-right">
            <div className="text-lg font-bold">{patient.full_name}</div>
            <div className="text-xs opacity-70 mt-0.5">
              {patient.gender === 'F' ? 'Feminino' : 'Masculino'} · {patient.weight_kg ?? '—'}kg · {patient.height_cm ?? '—'}cm
            </div>
            <div className="text-xs opacity-50">Emitido em {new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Metas diárias */}
          <div className="text-[10px] font-bold text-pgf-600 uppercase tracking-widest border-b-2 border-pgf-600 pb-1 mb-3">Metas Diárias</div>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { l: 'Calorias', v: `${r(totals.kcal)} kcal`, c: 'text-gray-900' },
              { l: 'Proteína', v: `${r(totals.protein)}g`, c: 'text-blue-600' },
              { l: 'Carboidrato', v: `${r(totals.carbs)}g`, c: 'text-amber-600' },
              { l: 'Gordura', v: `${r(totals.fat)}g`, c: 'text-red-500' },
            ].map(m => (
              <div key={m.l} className="border border-gray-200 rounded-lg p-2.5 text-center">
                <div className="text-[9px] text-gray-400 uppercase tracking-wide">{m.l}</div>
                <div className={`text-lg font-black ${m.c}`}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Plano alimentar */}
          <div className="text-[10px] font-bold text-pgf-600 uppercase tracking-widest border-b-2 border-pgf-600 pb-1 mb-4">Plano Alimentar</div>

          {meals.map(meal => {
            const mt = mealTotal(meal)
            return (
              <div key={meal.id} className="mb-6">
                {/* Meal header */}
                <div className="flex justify-between items-center bg-pgf-50 px-3 py-2 rounded-t border border-pgf-100 border-b-0">
                  <div className="font-bold text-sm text-pgf-700">
                    {meal.emoji ? `${meal.emoji} ` : ''}{meal.name}{meal.time_start ? ` — ${meal.time_start}` : ''}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {r(mt.kcal)} kcal · P {r(mt.protein)}g · C {r(mt.carbs)}g · G {r(mt.fat)}g
                  </div>
                </div>

                {/* Food rows */}
                <div className="border border-pgf-100 border-t-0 rounded-b overflow-hidden">
                  {/* Column header */}
                  <div className="grid text-[9px] font-bold text-gray-400 uppercase tracking-wide bg-gray-50 px-3 py-1.5 border-b border-gray-100"
                    style={{ gridTemplateColumns: '1fr 120px 50px 50px 50px 50px' }}>
                    <span>Alimento</span>
                    <span className="text-right">Medida / Qtd</span>
                    <span className="text-right">Prot</span>
                    <span className="text-right">Carb</span>
                    <span className="text-right">Gord</span>
                    <span className="text-right">Kcal</span>
                  </div>

                  {meal.meal_foods.map((mf, idx) => {
                    const m = calcMacros(mf.quantity_g, mf.food)
                    const isLast = idx === meal.meal_foods.length - 1
                    return (
                      <div key={mf.id}>
                        {/* Main food */}
                        <div className={`grid items-center px-3 py-2 ${!isLast || mf.substitutes?.length ? 'border-b border-gray-100' : ''}`}
                          style={{ gridTemplateColumns: '1fr 120px 50px 50px 50px 50px' }}>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-gray-800">{mf.food.name}</span>
                            {(mf.food.source_label || mf.food.source) && mf.food.source !== 'custom' && (
                              <span className="text-[8px] text-gray-400">({mf.food.source_label || mf.food.source})</span>
                            )}
                          </div>
                          <div className="text-right text-xs text-gray-600">{mf.quantity_description || `${mf.quantity_g}g`}</div>
                          <div className="text-right text-xs text-blue-600">{r(m.protein)}g</div>
                          <div className="text-right text-xs text-amber-600">{r(m.carbs)}g</div>
                          <div className="text-right text-xs text-red-500">{r(m.fat)}g</div>
                          <div className="text-right text-xs font-bold text-gray-700">{r(m.kcal)}</div>
                        </div>

                        {/* Substitutes */}
                        {mf.substitutes?.map((sub, si) => {
                          const sm = calcMacros(sub.quantity_g, sub.food)
                          const subIsLast = si === (mf.substitutes.length - 1) && isLast
                          return (
                            <div key={sub.id}
                              className={`grid items-center px-3 py-1.5 bg-gray-50 ${!subIsLast ? 'border-b border-gray-100' : ''}`}
                              style={{ gridTemplateColumns: '1fr 120px 50px 50px 50px 50px' }}>
                              <div className="flex items-center gap-1 pl-2">
                                <span className="text-[9px] font-bold text-amber-500 border border-amber-300 px-1 rounded mr-1">OU</span>
                                <span className="text-[11px] text-gray-600">{sub.food.name}</span>
                                {(sub.food.source_label || sub.food.source) && sub.food.source !== 'custom' && (
                                  <span className="text-[8px] text-gray-400">({sub.food.source_label || sub.food.source})</span>
                                )}
                              </div>
                              <div className="text-right text-[11px] text-gray-500">{sub.quantity_description || `${sub.quantity_g}g`}</div>
                              <div className="text-right text-[11px] text-blue-400">{r(sm.protein)}g</div>
                              <div className="text-right text-[11px] text-amber-400">{r(sm.carbs)}g</div>
                              <div className="text-right text-[11px] text-red-400">{r(sm.fat)}g</div>
                              <div className="text-right text-[11px] text-gray-500">{r(sm.kcal)}</div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {/* Orientações por refeição */}
                  {meal.notes && (
                    <div className="px-3 py-2.5 border-t border-pgf-100 bg-pgf-50/60">
                      <div className="text-[9px] font-bold text-pgf-600 uppercase tracking-wider mb-1">
                        Orientações
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">{meal.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Orientações */}
          {plan.notes && (
            <>
              <div className="text-[10px] font-bold text-pgf-600 uppercase tracking-widest border-b-2 border-pgf-600 pb-1 mb-3 mt-2">Orientações</div>
              <p className="text-xs text-gray-600 leading-relaxed">{plan.notes}</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-pgf-50 px-8 py-3 flex justify-between items-center border-t border-pgf-100">
          <div className="text-[10px] text-gray-400">pedro_frey@hotmail.com</div>
          <div className="text-[10px] font-bold text-pgf-600 tracking-wider">PGF · PEDRO GARRASTAZU FREY · Nutricionista</div>
          <div className="text-[10px] text-gray-400">Tabela: TACO / IBGE</div>
        </div>
      </div>
    </div>
  )
}
