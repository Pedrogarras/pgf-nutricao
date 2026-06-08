'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface MealFood {
  food_name: string
  quantity_g: number
  quantity_description: string | null
  food_group: string | null
}

interface GroceryItem {
  name: string
  totalQtyG: number
  displayQty: string
  group: string
  checked: boolean
  entries: { meal: string; qty: string }[]
}

const GROUP_ICONS: Record<string, string> = {
  'Cereais e derivados':               '🌾',
  'Verduras, hortaliças e derivados':  '🥦',
  'Frutas e derivados':                '🍎',
  'Gorduras e óleos':                  '🫒',
  'Pescados e frutos do mar':          '🐟',
  'Carnes e derivados':                '🥩',
  'Leite e derivados':                 '🥛',
  'Bebidas':                           '🥤',
  'Ovos e derivados':                  '🥚',
  'Produtos açucarados':               '🍫',
  'Leguminosas e derivados':           '🫘',
  'Nozes e sementes':                  '🥜',
  'Outros alimentos industrializados': '🛒',
  'Miscelâneas':                       '🍲',
  'Suplementos':                       '💊',
  'Sem categoria':                     '🍽️',
}

const DAYS_OPTIONS = [1, 3, 5, 7, 14]

const STORAGE_KEY = 'pgf-grocery-checked'

function roundGrams(g: number) {
  if (g < 10)  return `${Math.round(g)}g`
  if (g < 100) return `${Math.round(g / 5) * 5}g`
  if (g < 1000) return `${Math.round(g / 10) * 10}g`
  return `${(g / 1000).toFixed(2).replace(/\.?0+$/, '')} kg`
}

export default function ComprasPage() {
  const supabase = createClient()

  const [planTitle, setPlanTitle] = useState('')
  const [items, setItems] = useState<GroceryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [noplan, setNoplan] = useState(false)
  const [days, setDays] = useState(7)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  useEffect(() => {
    // Restore checked from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
      setChecked(new Set(saved))
    } catch (_) { /* ignore */ }
  }, [])

  useEffect(() => {
    buildList()
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  async function buildList() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); setNoplan(true); return }

    const { data: patient } = await supabase.from('patients').select('id').eq('auth_user_id', user.id).single()
    if (!patient) { setLoading(false); setNoplan(true); return }

    const { data: plan } = await supabase
      .from('diet_plans')
      .select(`
        id, title,
        meals(
          id, name,
          meal_foods(
            quantity_g, quantity_description,
            food:foods(name, food_group, portion_g)
          )
        )
      `)
      .eq('patient_id', patient.id)
      .eq('active', true)
      .not('published_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!plan) { setLoading(false); setNoplan(true); return }
    setPlanTitle(plan.title ?? 'Plano Atual')

    // Aggregate foods across all meals × days
    const map = new Map<string, { totalG: number; group: string; entries: { meal: string; qty: string }[] }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meals = (plan.meals ?? []) as any[]
    for (const meal of meals) {
      for (const mf of (meal.meal_foods ?? [])) {
        const food = mf.food
        if (!food) continue
        const name = food.name
        const key = name.toLowerCase().trim()
        const qty = mf.quantity_g * days
        const existing = map.get(key)
        const display = mf.quantity_description ?? `${mf.quantity_g}g`
        const mealEntry = { meal: meal.name, qty: days === 1 ? display : `${display} × ${days}d` }
        if (existing) {
          existing.totalG += qty
          existing.entries.push(mealEntry)
        } else {
          map.set(key, {
            totalG: qty,
            group: food.food_group ?? 'Sem categoria',
            entries: [mealEntry],
          })
        }
      }
    }

    // Build sorted grocery items
    const list: GroceryItem[] = Array.from(map.entries()).map(([key, v]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      totalQtyG: v.totalG,
      displayQty: roundGrams(v.totalG),
      group: v.group,
      checked: false,
      entries: v.entries,
    }))

    // Sort by group then name
    list.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group)
      return a.name.localeCompare(b.name)
    })

    setItems(list)
    setLoading(false)
  }

  function toggleItem(name: string) {
    const key = name.toLowerCase()
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch (_) { /* ignore */ }
      return next
    })
  }

  function clearChecked() {
    setChecked(new Set())
    try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ }
  }

  // Group items by food group
  const groups = new Map<string, GroceryItem[]>()
  for (const item of items) {
    const key = item.group
    if (!groups.has(key)) groups.set(key, [])
    const isChecked = checked.has(item.name.toLowerCase())
    const listItem = { ...item, checked: isChecked }
    if (filter === 'pending' && isChecked) continue
    if (filter === 'done' && !isChecked) continue
    groups.get(key)!.push(listItem)
  }

  // Remove empty groups
  for (const [k, v] of groups.entries()) {
    if (v.length === 0) groups.delete(k)
  }

  const totalItems = items.length
  const checkedCount = items.filter(i => checked.has(i.name.toLowerCase())).length
  const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">🛒 Lista de Compras</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {planTitle || 'Gerado do plano alimentar'}
          </p>
        </div>
        {checkedCount > 0 && (
          <button onClick={clearChecked} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Limpar
          </button>
        )}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Days selector */}
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Quantos dias de compras?
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {DAYS_OPTIONS.map(d => (
              <button key={d} onClick={() => setDays(d)}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={days === d ? {
                  background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.4)',
                } : {
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Gerando lista...</div>
        ) : noplan ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🛒</div>
            <div className="font-bold text-white">Plano alimentar não encontrado</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Você precisa ter um plano alimentar ativo para gerar a lista de compras.
            </div>
          </div>
        ) : (
          <>
            {/* Progress strip */}
            <div className="rounded-xl p-3 mb-4 flex items-center gap-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex-1">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: pct === 100 ? '#4ade80' : 'linear-gradient(90deg, #2563EB, #60A5FA)' }} />
                </div>
              </div>
              <div className="text-xs font-black flex-shrink-0" style={{ color: pct === 100 ? '#4ade80' : '#93C5FD' }}>
                {checkedCount}/{totalItems}
              </div>
              {pct === 100 && <span className="text-sm">🎉</span>}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4">
              {([
                { v: 'all', label: `Todos (${totalItems})` },
                { v: 'pending', label: `Faltam (${totalItems - checkedCount})` },
                { v: 'done', label: `Comprado (${checkedCount})` },
              ] as const).map(f => (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={filter === f.v ? {
                    background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.35)',
                  } : {
                    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Groups */}
            <div className="space-y-4">
              {[...groups.entries()].map(([group, groupItems]) => (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{GROUP_ICONS[group] ?? '🍽️'}</span>
                    <span className="text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {group}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  </div>
                  <div className="space-y-1">
                    {groupItems.map(item => (
                      <button key={item.name} onClick={() => toggleItem(item.name)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                        style={item.checked ? {
                          background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)',
                        } : {
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                        }}>
                        {/* Checkbox */}
                        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                          style={item.checked ? {
                            background: 'rgba(74,222,128,0.3)', border: '2px solid #4ade80',
                          } : {
                            background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.15)',
                          }}>
                          {item.checked && <span className="text-[10px]" style={{ color: '#4ade80' }}>✓</span>}
                        </div>
                        {/* Name */}
                        <span className="flex-1 text-sm font-medium"
                          style={{ color: item.checked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)', textDecoration: item.checked ? 'line-through' : 'none' }}>
                          {item.name}
                        </span>
                        {/* Quantity */}
                        <span className="text-xs font-bold flex-shrink-0"
                          style={{ color: item.checked ? 'rgba(255,255,255,0.2)' : '#93C5FD' }}>
                          {item.displayQty}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Empty filtered state */}
            {groups.size === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {filter === 'done' ? 'Nenhum item comprado ainda' : 'Todos os itens foram comprados! 🎉'}
              </div>
            )}

            {/* Tip */}
            <div className="mt-6 rounded-xl px-4 py-3 text-xs leading-relaxed"
              style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', color: 'rgba(255,255,255,0.4)' }}>
              💡 <strong className="text-white">Dica:</strong> Toque em um item para marcá-lo como comprado. As quantidades são calculadas para {days} dia{days !== 1 ? 's' : ''} do seu plano alimentar.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
