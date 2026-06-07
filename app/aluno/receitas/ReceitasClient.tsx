'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

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

const CAT_ICONS: Record<string, string> = {
  'proteína':     '💪',
  'low carb':     '🥗',
  'lanche':       '🥪',
  'sobremesa':    '🍫',
  'vegano':       '🌱',
  'café da manhã':'☀️',
  'almoço':       '🍽️',
  'jantar':       '🌙',
  'snack':        '⚡',
}

const CAT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'proteína':     { bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.3)',  text: '#93C5FD' },
  'low carb':     { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)', text: '#4ade80' },
  'lanche':       { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',text: '#fbbf24' },
  'sobremesa':    { bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.25)',text: '#f472b6' },
  'vegano':       { bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.25)',text: '#86efac' },
  'café da manhã':{ bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',text: '#fde68a' },
  'almoço':       { bg: 'rgba(147,51,234,0.1)',  border: 'rgba(147,51,234,0.25)',text: '#c4b5fd' },
  'jantar':       { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)',text: '#a5b4fc' },
  'snack':        { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)', text: '#fef08a' },
}

function catStyle(cat: string | null) {
  return CAT_COLORS[cat ?? ''] ?? { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.5)' }
}

function r(n: number | null | undefined, d = 0) {
  if (n == null) return null
  return Math.round(n * 10 ** d) / 10 ** d
}

function MacroBar({ protein, carbs, fat }: { protein: number | null; carbs: number | null; fat: number | null }) {
  const total = (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9
  if (total === 0) return null
  const pPct = Math.round(((protein ?? 0) * 4 / total) * 100)
  const cPct = Math.round(((carbs ?? 0) * 4 / total) * 100)
  const fPct = 100 - pPct - cPct
  return (
    <div className="h-1.5 flex rounded-full overflow-hidden gap-px mt-2">
      <div style={{ width: `${pPct}%`, background: '#93C5FD' }} />
      <div style={{ width: `${cPct}%`, background: '#FCD34D' }} />
      <div style={{ width: `${fPct}%`, background: '#FCA5A5' }} />
    </div>
  )
}

export default function ReceitasClient({ recipes }: { recipes: Recipe[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const cats = new Set(recipes.map(r => r.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [recipes])

  const filtered = useMemo(() => {
    return recipes.filter(rec => {
      if (filter !== 'all' && rec.category !== filter) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!rec.name.toLowerCase().includes(q) &&
            !(rec.description ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [recipes, filter, search])

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">👨‍🍳 Receitas</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {recipes.length} receita{recipes.length !== 1 ? 's' : ''} saudáveis do seu nutricionista
          </p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Search */}
        <div className="relative mb-3">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base">🔍</div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar receita..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          />
        </div>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            <button
              onClick={() => setFilter('all')}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={filter === 'all' ? {
                background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.4)',
              } : {
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
              🍽️ Todas
            </button>
            {categories.map(cat => {
              const st = catStyle(cat)
              return (
                <button key={cat} onClick={() => setFilter(cat === filter ? 'all' : cat)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
                  style={filter === cat ? {
                    background: st.bg, color: st.text, border: `1px solid ${st.border}`,
                  } : {
                    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                  {CAT_ICONS[cat] ?? '🍴'} {cat}
                </button>
              )
            })}
          </div>
        )}

        {/* Recipe count */}
        {search || filter !== 'all' ? (
          <div className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </div>
        ) : null}

        {/* Recipe cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🍳</div>
            <div className="font-semibold text-white">Nenhuma receita encontrada</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {search ? `Tente outra busca` : 'Receitas aparecerão aqui quando adicionadas.'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rec => {
              const expanded = expandedId === rec.id
              const st = catStyle(rec.category)
              return (
                <div key={rec.id} className="rounded-2xl overflow-hidden"
                  style={{ border: `1px solid ${expanded ? st.border : 'rgba(255,255,255,0.07)'}`, background: 'rgba(255,255,255,0.02)' }}>
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(expanded ? null : rec.id)}
                    className="w-full text-left px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0 mt-0.5">{CAT_ICONS[rec.category ?? ''] ?? '🍴'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-white text-sm leading-tight">{rec.name}</div>
                        {rec.description && (
                          <div className="text-[11px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {rec.description}
                          </div>
                        )}
                        {/* Macros strip */}
                        {rec.kcal_per_portion != null && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs font-black text-white">{r(rec.kcal_per_portion)} kcal</span>
                            {rec.protein_g_per_portion != null && (
                              <span className="text-[11px]" style={{ color: '#93C5FD' }}>P {r(rec.protein_g_per_portion)}g</span>
                            )}
                            {rec.carbs_g_per_portion != null && (
                              <span className="text-[11px]" style={{ color: '#FCD34D' }}>C {r(rec.carbs_g_per_portion)}g</span>
                            )}
                            {rec.fat_g_per_portion != null && (
                              <span className="text-[11px]" style={{ color: '#FCA5A5' }}>G {r(rec.fat_g_per_portion)}g</span>
                            )}
                            {rec.fiber_g_per_portion != null && (
                              <span className="text-[11px]" style={{ color: '#4ade80' }}>Fibra {r(rec.fiber_g_per_portion, 1)}g</span>
                            )}
                          </div>
                        )}
                        <MacroBar
                          protein={rec.protein_g_per_portion}
                          carbs={rec.carbs_g_per_portion}
                          fat={rec.fat_g_per_portion}
                        />
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 gap-2">
                        {rec.category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                            style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>
                            {rec.category}
                          </span>
                        )}
                        {rec.yield_portions != null && (
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {rec.yield_portions} porç.
                          </span>
                        )}
                        <span className="text-lg" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {expanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {expanded && (
                    <div style={{ borderTop: `1px solid ${st.border}` }}>
                      {/* Ingredients */}
                      {rec.ingredients && rec.ingredients.length > 0 && (
                        <div className="px-4 py-4">
                          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: st.text }}>
                            🧺 Ingredientes
                            {rec.yield_portions != null && (
                              <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                (para {rec.yield_portions} porç.{rec.yield_g_per_portion ? ` · ${rec.yield_g_per_portion}g/porç.` : ''})
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {rec.ingredients.map((ing, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.text }} />
                                  <span className="text-sm text-white">{ing.ingredient}</span>
                                </div>
                                <span className="text-xs flex-shrink-0 font-semibold"
                                  style={{ color: 'rgba(255,255,255,0.45)' }}>
                                  {ing.quantity}{ing.grams ? ` (${ing.grams}g)` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Instructions */}
                      {rec.instructions && (
                        <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="text-[10px] font-bold uppercase tracking-[2px] mt-4 mb-3" style={{ color: st.text }}>
                            👨‍🍳 Modo de preparo
                          </div>
                          <div className="text-sm leading-relaxed whitespace-pre-line"
                            style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {rec.instructions}
                          </div>
                        </div>
                      )}

                      {/* Per portion info */}
                      {rec.kcal_per_portion != null && (
                        <div className="mx-4 mb-4 rounded-xl p-3 grid grid-cols-3 gap-3"
                          style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                          <div className="text-center">
                            <div className="text-base font-black text-white">{r(rec.kcal_per_portion)}</div>
                            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>kcal</div>
                          </div>
                          {rec.protein_g_per_portion != null && (
                            <div className="text-center">
                              <div className="text-base font-black" style={{ color: '#93C5FD' }}>{r(rec.protein_g_per_portion)}g</div>
                              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>proteína</div>
                            </div>
                          )}
                          {rec.carbs_g_per_portion != null && (
                            <div className="text-center">
                              <div className="text-base font-black" style={{ color: '#FCD34D' }}>{r(rec.carbs_g_per_portion)}g</div>
                              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>carbo</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
