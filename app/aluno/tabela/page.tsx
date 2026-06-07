'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Food {
  id: string
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sodium_mg: number | null
  portion_g: number
  portion_description: string | null
  food_group: string | null
}

const FOOD_GROUPS = [
  'Cereais e derivados',
  'Verduras, hortaliças e derivados',
  'Frutas e derivados',
  'Gorduras e óleos',
  'Pescados e frutos do mar',
  'Carnes e derivados',
  'Leite e derivados',
  'Bebidas',
  'Ovos e derivados',
  'Produtos açucarados',
  'Miscelâneas',
  'Outros alimentos industrializados',
  'Leguminosas e derivados',
  'Nozes e sementes',
]

const GROUP_ICONS: Record<string, string> = {
  'Cereais e derivados': '🌾',
  'Verduras, hortaliças e derivados': '🥦',
  'Frutas e derivados': '🍎',
  'Gorduras e óleos': '🫒',
  'Pescados e frutos do mar': '🐟',
  'Carnes e derivados': '🥩',
  'Leite e derivados': '🥛',
  'Bebidas': '🥤',
  'Ovos e derivados': '🥚',
  'Produtos açucarados': '🍫',
  'Miscelâneas': '🍲',
  'Outros alimentos industrializados': '🛒',
  'Leguminosas e derivados': '🫘',
  'Nozes e sementes': '🥜',
}

function r(n: number, d = 1) { return Math.round(n * 10 ** d) / 10 ** d }

function calcFor(food: Food, qty: number) {
  const ratio = qty / (food.portion_g || 100)
  return {
    kcal:    r(food.kcal * ratio, 0),
    protein: r(food.protein_g * ratio),
    carbs:   r(food.carbs_g * ratio),
    fat:     r(food.fat_g * ratio),
    fiber:   food.fiber_g != null ? r(food.fiber_g * ratio) : null,
    sodium:  food.sodium_mg != null ? r(food.sodium_mg * ratio, 0) : null,
  }
}

function MacroRing({ kcal, protein, carbs, fat }: { kcal: number; protein: number; carbs: number; fat: number }) {
  const totalMacroKcal = protein * 4 + carbs * 4 + fat * 9
  if (totalMacroKcal === 0) return null
  const protPct  = Math.round((protein * 4 / totalMacroKcal) * 100)
  const carbsPct = Math.round((carbs * 4 / totalMacroKcal) * 100)
  const fatPct   = 100 - protPct - carbsPct

  // Build SVG donut segments
  const cx = 40, cy = 40, R = 32, strokeW = 10
  const circ = 2 * Math.PI * R

  function segment(pct: number, offset: number, color: string) {
    const dash = (pct / 100) * circ
    return (
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={-offset * circ / 100}
        strokeLinecap="butt"
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }} />
    )
  }

  return (
    <div className="flex items-center gap-3">
      <svg width="80" height="80" viewBox="0 0 80 80" className="flex-shrink-0">
        {segment(protPct, 0, '#93C5FD')}
        {segment(carbsPct, protPct, '#FCD34D')}
        {segment(fatPct, protPct + carbsPct, '#FCA5A5')}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="12" fontWeight="800" fill="white">{kcal}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.4)">kcal</text>
      </svg>
      <div className="space-y-1">
        {[
          { label: 'Proteína', pct: protPct, color: '#93C5FD' },
          { label: 'Carbo', pct: carbsPct, color: '#FCD34D' },
          { label: 'Gordura', pct: fatPct, color: '#FCA5A5' },
        ].map(m => (
          <div key={m.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: m.color }} />
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{m.label}</span>
            <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AlunoTabelaPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Food | null>(null)
  const [qty, setQty] = useState(100)
  const [custom, setCustom] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const { data } = await supabase
        .from('foods')
        .select('id, name, kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, portion_g, portion_description, food_group')
        .ilike('name', `%${query.trim()}%`)
        .eq('active', true)
        .order('name')
        .limit(25)
      setResults(data ?? [])
      setSearching(false)
    }, 300)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectFood(food: Food) {
    setSelected(food)
    setQty(food.portion_g || 100)
    setCustom(String(food.portion_g || 100))
    setQuery('')
    setResults([])
  }

  const macros = selected ? calcFor(selected, qty) : null

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">🔍 Tabela Nutricional</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Consulte calorias e macros de qualquer alimento</p>
        </div>
      </div>

      <div className="px-5 py-5 max-w-lg mx-auto">
        {/* Search bar */}
        <div className="relative mb-5">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar alimento (ex: arroz, frango, banana...)"
            autoFocus
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm text-white outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: 15,
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
          )}
        </div>

        {/* Search results dropdown */}
        {(results.length > 0 || searching) && (
          <div className="rounded-2xl overflow-hidden mb-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {searching ? (
              <div className="py-4 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Buscando...
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {results.map(food => (
                  <button key={food.id} onClick={() => selectFood(food)}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}>
                    <span className="text-lg flex-shrink-0">
                      {GROUP_ICONS[food.food_group ?? ''] ?? '🍽️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{food.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {food.kcal} kcal / {food.portion_description ?? `${food.portion_g}g`}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs font-bold" style={{ color: '#93C5FD' }}>{food.protein_g}g P</div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{food.carbs_g}g C · {food.fat_g}g G</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {query.length >= 2 && !searching && results.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Nenhum alimento encontrado para "{query}"
          </div>
        )}

        {/* Selected food detail */}
        {selected && macros && (
          <div className="space-y-4">
            {/* Food name + group */}
            <div className="rounded-2xl p-5 relative overflow-hidden"
              style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)' }}>
              <div className="absolute top-0 left-8 right-8 h-px rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />
              <div className="flex items-start gap-3">
                <span className="text-3xl flex-shrink-0">
                  {GROUP_ICONS[selected.food_group ?? ''] ?? '🍽️'}
                </span>
                <div className="flex-1">
                  <div className="font-black text-white text-base leading-tight">{selected.name}</div>
                  {selected.food_group && (
                    <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{selected.food_group}</div>
                  )}
                  <div className="text-[11px] mt-0.5" style={{ color: 'rgba(147,197,253,0.7)' }}>
                    Porção de referência: {selected.portion_description ?? `${selected.portion_g}g`}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-xl flex-shrink-0"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
              </div>
            </div>

            {/* Quantity adjuster */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Ajustar quantidade
              </div>
              <div className="flex items-center gap-3 mb-3">
                {[50, 100, 150, 200].map(q => (
                  <button key={q} onClick={() => { setQty(q); setCustom(String(q)) }}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: qty === q && custom === String(q) ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                      color: qty === q && custom === String(q) ? '#fff' : 'rgba(255,255,255,0.45)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                    {q}g
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={custom}
                  onChange={e => {
                    setCustom(e.target.value)
                    const n = parseFloat(e.target.value)
                    if (n > 0 && n <= 2000) setQty(n)
                  }}
                  className="flex-1 px-3 py-2 rounded-xl text-sm text-white outline-none text-center"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  min="1" max="2000"
                />
                <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>gramas</span>
              </div>
            </div>

            {/* Macro ring + numbers */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-[10px] font-bold uppercase tracking-[2px] mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Valores para {qty}g
              </div>
              <MacroRing kcal={macros.kcal} protein={macros.protein} carbs={macros.carbs} fat={macros.fat} />
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Calorias',  value: `${macros.kcal} kcal`,  color: '#FFFFFF' },
                  { label: 'Proteína',  value: `${macros.protein} g`,  color: '#93C5FD' },
                  { label: 'Carboidrato', value: `${macros.carbs} g`, color: '#FCD34D' },
                  { label: 'Gordura',   value: `${macros.fat} g`,     color: '#FCA5A5' },
                  ...(macros.fiber  !== null ? [{ label: 'Fibra',   value: `${macros.fiber} g`,   color: '#4ADE80' }] : []),
                  ...(macros.sodium !== null ? [{ label: 'Sódio',   value: `${macros.sodium} mg`, color: '#FCD34D' }] : []),
                ].map(m => (
                  <div key={m.label} className="rounded-xl p-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-base font-black" style={{ color: m.color }}>{m.value}</div>
                    <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparison tip */}
            <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
              style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', color: 'rgba(255,255,255,0.45)' }}>
              💡 <strong className="text-white">Dica:</strong> Compare os macros deste alimento com os do seu plano alimentar para fazer escolhas mais informadas.
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selected && !query && (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">🥗</div>
            <div className="font-bold text-white mb-2">Consulte qualquer alimento</div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Digite o nome do alimento na barra acima para ver calorias e macros.
            </div>
            {/* Quick suggestions */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['🍗 Frango', '🍚 Arroz', '🥚 Ovo', '🫘 Feijão', '🐟 Salmão', '🥦 Brócolis', '🍌 Banana', '🥛 Leite'].map(s => (
                <button key={s} onClick={() => setQuery(s.split(' ').slice(1).join(' '))}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
