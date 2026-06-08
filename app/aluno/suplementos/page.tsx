'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface SupplementLog {
  supplement_id: string
  logged_date: string
  taken: boolean
}

interface Supplement {
  id: string
  name: string
  brand: string | null
  dosage: string
  timing: string
  with_food: boolean
  instructions: string | null
}

const TIMING_OPTIONS = [
  { value: 'ao_acordar',    label: '☀️ Ao acordar',      color: '#FCD34D' },
  { value: 'cafe_manha',    label: '🍳 Café da manhã',   color: '#FDE68A' },
  { value: 'pre_treino',    label: '💪 Pré-treino',      color: '#6EE7B7' },
  { value: 'pos_treino',    label: '🏋️ Pós-treino',     color: '#34D399' },
  { value: 'almoco',        label: '🍽️ Almoço',          color: '#93C5FD' },
  { value: 'lanche',        label: '🥪 Lanche',          color: '#C4B5FD' },
  { value: 'jantar',        label: '🌙 Jantar',          color: '#A5B4FC' },
  { value: 'antes_dormir',  label: '😴 Antes de dormir', color: '#818CF8' },
  { value: 'qualquer_hora', label: '🕐 Qualquer hora',   color: '#9CA3AF' },
]

function timingLabel(v: string) { return TIMING_OPTIONS.find(o => o.value === v)?.label ?? v }
function timingColor(v: string) { return TIMING_OPTIONS.find(o => o.value === v)?.color ?? '#9CA3AF' }

const TODAY = new Date().toISOString().split('T')[0]
const STORAGE_KEY = `pgf-supp-check-${TODAY}`

export default function AlunoSupplementsPage() {
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'hoje' | 'todos' | 'historico'>('hoje')
  const [history30, setHistory30] = useState<SupplementLog[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const [suppRes, logRes] = await Promise.all([
          fetch('/api/supplements').then(r => r.json()),
          fetch(`/api/supplement-logs?date=${TODAY}`).then(r => r.json()).catch(() => ({ logs: [] })),
        ])
        const activeSups = (suppRes.supplements ?? []).filter((s: { active: boolean }) => s.active)
        setSupplements(activeSups)
        // DB logs take priority over localStorage
        const dbChecked = new Set<string>((logRes.logs ?? []).filter((l: { taken: boolean }) => l.taken).map((l: { supplement_id: string }) => l.supplement_id))
        if (dbChecked.size > 0) {
          setChecked(dbChecked)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...dbChecked])) } catch { /* ignore */ }
        } else {
          // Fall back to localStorage for offline state
          try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) setChecked(new Set(JSON.parse(saved)))
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function toggleCheck(id: string) {
    if (toggling.has(id)) return
    const willCheck = !checked.has(id)

    // Optimistic update
    setChecked(prev => {
      const next = new Set(prev)
      willCheck ? next.add(id) : next.delete(id)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
    setToggling(prev => new Set([...prev, id]))

    try {
      if (willCheck) {
        await fetch('/api/supplement-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplement_id: id, logged_date: TODAY, taken: true }),
        })
      } else {
        await fetch('/api/supplement-logs', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplement_id: id, logged_date: TODAY }),
        })
      }
    } catch { /* revert on error */
      setChecked(prev => {
        const next = new Set(prev)
        willCheck ? next.delete(id) : next.add(id)
        return next
      })
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // Group by timing
  const grouped: Record<string, Supplement[]> = {}
  for (const s of supplements) {
    if (!grouped[s.timing]) grouped[s.timing] = []
    grouped[s.timing].push(s)
  }
  const timingOrder = TIMING_OPTIONS.map(t => t.value).filter(v => grouped[v])

  const loadHistory = useCallback(async () => {
    if (histLoading || history30.length > 0) return
    setHistLoading(true)
    const from = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
    const to = TODAY
    try {
      const res = await fetch(`/api/supplement-logs?from=${from}&to=${to}`)
      const data = await res.json()
      setHistory30(data.logs ?? [])
    } catch { /* ignore */ }
    setHistLoading(false)
  }, [histLoading, history30.length])

  const checkedCount = supplements.filter(s => checked.has(s.id)).length
  const totalCount = supplements.length
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0
  const allDone = checkedCount === totalCount && totalCount > 0

  // Determine "current" timing based on hour
  const hour = new Date().getHours()
  const currentTiming = hour < 8 ? 'ao_acordar'
    : hour < 10 ? 'cafe_manha'
    : hour < 12 ? 'pre_treino'
    : hour < 14 ? 'almoco'
    : hour < 16 ? 'pos_treino'
    : hour < 18 ? 'lanche'
    : hour < 21 ? 'jantar'
    : 'antes_dormir'

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl">←</Link>
        <div className="flex-1">
          <h1 className="font-black text-white text-base leading-none">💊 Suplementos</h1>
          {!loading && totalCount > 0 && (
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {allDone ? '🎉 Todos tomados hoje!' : `${checkedCount}/${totalCount} tomados hoje`}
            </p>
          )}
        </div>
        {!loading && totalCount > 0 && (
          <div className="text-right">
            <div className="text-sm font-black" style={{ color: allDone ? '#4ade80' : '#fbbf24' }}>{pct}%</div>
            <div className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>hoje</div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 max-w-lg mx-auto">
        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <div className="text-3xl mb-2">💊</div>
            <div>Carregando...</div>
          </div>
        ) : supplements.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">💊</div>
            <p className="font-semibold text-white mb-2">Nenhum suplemento prescrito</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Seu nutricionista ainda não prescreveu suplementos.
            </p>
          </div>
        ) : (
          <>
            {/* Daily progress bar */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">
                  {allDone ? '🏆 Suplementação completa!' : `Progresso de hoje`}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {checkedCount}/{totalCount}
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: allDone
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                      : pct >= 50
                      ? 'linear-gradient(90deg, #2563EB, #34d399)'
                      : 'linear-gradient(90deg, #2563EB, #60a5fa)',
                  }} />
              </div>
              {!allDone && checkedCount > 0 && (
                <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Faltam {totalCount - checkedCount} suplemento{totalCount - checkedCount !== 1 ? 's' : ''} para completar o dia
                </p>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              {[
                { key: 'hoje', label: '📅 Hoje' },
                { key: 'historico', label: '📆 Histórico' },
                { key: 'todos', label: '📋 Todos' },
              ].map(t => (
                <button key={t.key} onClick={() => {
                  setTab(t.key as typeof tab)
                  if (t.key === 'historico') loadHistory()
                }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: tab === t.key ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                    color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${tab === t.key ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'hoje' ? (
              // Checklist view — all supplements with checkboxes
              <div className="space-y-3">
                {TIMING_OPTIONS.filter(t => grouped[t.value]).map(timing => {
                  const timingSupps = grouped[timing.value]
                  const isCurrent = timing.value === currentTiming
                  const allTimingChecked = timingSupps.every(s => checked.has(s.id))
                  return (
                    <div key={timing.value}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: timing.color + '18', color: timing.color }}>
                          {timing.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                            agora
                          </span>
                        )}
                        {allTimingChecked && (
                          <span className="text-[10px]" style={{ color: '#4ade80' }}>✓</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {timingSupps.map(s => {
                          const isChecked = checked.has(s.id)
                          return (
                            <button key={s.id} onClick={() => toggleCheck(s.id)}
                              disabled={toggling.has(s.id)}
                              className="w-full rounded-xl p-4 flex items-center gap-4 text-left transition-all active:scale-[0.98] disabled:opacity-70"
                              style={{
                                background: isChecked ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isChecked ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)'}`,
                              }}>
                              {/* Checkbox circle */}
                              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                                style={{
                                  background: isChecked ? '#22c55e' : 'rgba(255,255,255,0.06)',
                                  border: `2px solid ${isChecked ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
                                }}>
                                {toggling.has(s.id)
                                  ? <span className="text-white text-xs animate-spin">↻</span>
                                  : isChecked
                                    ? <span className="text-white text-xs font-black">✓</span>
                                    : null
                                }
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold transition-all"
                                  style={{
                                    color: isChecked ? 'rgba(74,222,128,0.8)' : 'rgba(226,232,248,0.9)',
                                    textDecoration: isChecked ? 'line-through' : 'none',
                                  }}>
                                  {s.name}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs font-bold" style={{ color: timing.color }}>{s.dosage}</span>
                                  {s.with_food && (
                                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>🍽 com alimentos</span>
                                  )}
                                  {s.brand && (
                                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{s.brand}</span>
                                  )}
                                </div>
                                {s.instructions && !isChecked && (
                                  <p className="text-[11px] mt-1 italic" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                    {s.instructions}
                                  </p>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Reset button */}
                {checkedCount > 0 && (
                  <button
                    onClick={() => {
                      setChecked(new Set())
                      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all mt-2"
                    style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    Resetar checklist de hoje
                  </button>
                )}
              </div>
            ) : (
              // All prescribed supplements — grouped by timing
              <div className="space-y-5">
                {timingOrder.map(timing => (
                  <div key={timing}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: timingColor(timing) + '20', color: timingColor(timing) }}>
                        {timingLabel(timing)}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--dark-border)' }} />
                    </div>
                    <div className="space-y-2">
                      {grouped[timing].map(s => (
                        <div key={s.id} className="rounded-xl p-4 flex items-start gap-4"
                          style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: timingColor(timing) + '15' }}>
                            💊
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white text-sm">{s.name}</div>
                            {s.brand && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.brand}</div>}
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-sm font-semibold" style={{ color: timingColor(timing) }}>{s.dosage}</span>
                              {s.with_food && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>🍽 Com alimentos</span>}
                            </div>
                            {s.instructions && (
                              <p className="text-xs mt-1.5 italic" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.instructions}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 30-day History calendar */}
            {tab === 'historico' && (() => {
              if (histLoading) return (
                <div className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando histórico…</div>
              )
              // Build 30-day array
              const days = Array.from({ length: 30 }, (_, i) => {
                const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0]
                const dayLogs = history30.filter(l => l.logged_date === d && l.taken)
                const expected = totalCount
                const taken = dayLogs.length
                const pct = expected > 0 ? Math.round((taken / expected) * 100) : 0
                return { date: d, taken, expected, pct }
              })
              const monthAdherence = (() => {
                const totalTaken = days.reduce((s, d) => s + d.taken, 0)
                const totalExpected = days.reduce((s, d) => s + d.expected, 0)
                return totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0
              })()
              const loggedDays = days.filter(d => d.taken > 0).length
              // Streak
              let streak = 0
              for (let i = days.length - 1; i >= 0; i--) {
                if (days[i].pct >= 100) streak++
                else if (i === days.length - 1) continue // allow missing today
                else break
              }
              return (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Aderência 30d', value: `${monthAdherence}%`, color: monthAdherence >= 80 ? '#4ADE80' : monthAdherence >= 50 ? '#FBBF24' : '#F87171' },
                      { label: 'Dias registrados', value: loggedDays, color: '#60A5FA' },
                      { label: 'Sequência', value: streak, color: streak >= 7 ? '#FCD34D' : '#9CA3AF' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3 text-center"
                        style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                        <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Calendar heatmap */}
                  <div className="rounded-2xl p-4"
                    style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Calendário de 30 dias
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {days.map(day => {
                        const isToday = day.date === TODAY
                        const bg = day.pct === 0
                          ? 'rgba(255,255,255,0.05)'
                          : day.pct >= 100
                            ? 'rgba(74,222,128,0.75)'
                            : day.pct >= 50
                              ? 'rgba(251,191,36,0.55)'
                              : 'rgba(251,191,36,0.25)'
                        const label = new Date(day.date + 'T12:00').getDate()
                        return (
                          <div
                            key={day.date}
                            title={`${day.date}: ${day.taken}/${day.expected} suplementos (${day.pct}%)`}
                            className="flex flex-col items-center gap-0.5"
                            style={{ width: 32 }}
                          >
                            <div
                              style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: bg,
                                outline: isToday ? '2px solid #2563EB' : undefined,
                                outlineOffset: isToday ? 1 : undefined,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 700,
                                color: day.pct >= 50 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <div className="flex items-center gap-1"><div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.05)' }} /><span>0%</span></div>
                      <div className="flex items-center gap-1"><div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(251,191,36,0.35)' }} /><span>Parcial</span></div>
                      <div className="flex items-center gap-1"><div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(74,222,128,0.75)' }} /><span>100%</span></div>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="rounded-xl p-4 text-center text-xs mt-4"
              style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', color: 'rgba(255,255,255,0.35)' }}>
              Em caso de dúvidas sobre seus suplementos, entre em contato com seu nutricionista.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
