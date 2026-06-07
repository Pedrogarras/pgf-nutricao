'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Record {
  id: string
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  waist_cm: number | null
  adherence_pct: number | null
}

interface Goal {
  metric: string
  target_value: number
  direction: string
  label: string
}

const METRICS = [
  { key: 'weight_kg',      label: 'Peso',       unit: 'kg', color: '#3B82F6', icon: '⚖️' },
  { key: 'body_fat_pct',   label: 'Gordura',    unit: '%',  color: '#F87171', icon: '📊' },
  { key: 'muscle_mass_kg', label: 'Massa Magra', unit: 'kg', color: '#34D399', icon: '💪' },
  { key: 'waist_cm',       label: 'Cintura',    unit: 'cm', color: '#FBBF24', icon: '📏' },
] as const

type MetricKey = (typeof METRICS)[number]['key']

// Maps chart metric key → patient_goals.metric values
const METRIC_TO_GOAL: Record<MetricKey, string[]> = {
  weight_kg:      ['peso'],
  body_fat_pct:   ['gordura'],
  muscle_mass_kg: ['massa', 'massa_muscular'],
  waist_cm:       ['cintura'],
}

export default function EvolucaoPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<Record[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMetric, setActiveMetric] = useState<MetricKey>('weight_kg')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgW, setSvgW] = useState(340)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: patient } = await supabase
        .from('patients').select('id').eq('auth_user_id', user.id).single()
      if (!patient) return

      const [{ data: recordsData }, { data: goalsData }] = await Promise.all([
        supabase
          .from('anthropometric_records')
          .select('id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, adherence_pct')
          .eq('patient_id', patient.id)
          .order('measured_at', { ascending: true }),
        supabase
          .from('patient_goals')
          .select('metric, target_value, direction, label')
          .eq('patient_id', patient.id)
          .eq('achieved', false),
      ])

      setRecords(recordsData ?? [])
      setGoals(goalsData ?? [])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(entries => setSvgW(entries[0].contentRect.width))
    ro.observe(svgRef.current.parentElement!)
    setSvgW(svgRef.current.parentElement?.clientWidth ?? 340)
    return () => ro.disconnect()
  }, [loading])

  const metric = METRICS.find(m => m.key === activeMetric)!
  const pts = records
    .map(r => ({ date: r.measured_at, value: r[activeMetric] as number | null, rec: r }))
    .filter(p => p.value !== null) as { date: string; value: number; rec: Record }[]

  // Find active goal for the current metric
  const activeGoal = goals.find(g =>
    METRIC_TO_GOAL[activeMetric]?.includes((g.metric ?? '').toLowerCase())
  ) ?? null

  const latest = records[records.length - 1]
  const first = records[0]

  // Chart dimensions
  const PAD = { top: 20, right: 16, bottom: 44, left: 44 }
  const H = 220
  const chartW = svgW - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  function buildChart() {
    if (pts.length < 2) return null
    const vals = pts.map(p => p.value)
    const min = Math.min(...vals) - (Math.max(...vals) - Math.min(...vals)) * 0.1 || 0
    const max = Math.max(...vals) + (Math.max(...vals) - Math.min(...vals)) * 0.1 || 1
    const range = max - min || 1

    function xp(i: number) { return PAD.left + (i / (pts.length - 1)) * chartW }
    function yp(v: number) { return PAD.top + chartH - ((v - min) / range) * chartH }

    const linePoints = pts.map((p, i) => `${xp(i).toFixed(1)},${yp(p.value).toFixed(1)}`).join(' ')
    const areaPoints = [
      `${xp(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
      ...pts.map((p, i) => `${xp(i).toFixed(1)},${yp(p.value).toFixed(1)}`),
      `${xp(pts.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
    ].join(' ')

    return { linePoints, areaPoints, min, max, range, xp, yp }
  }

  const chart = buildChart()

  function fmtDate(d: string) {
    return new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const hoverPt = hoverIdx !== null ? pts[hoverIdx] : null
  const lastPt = pts[pts.length - 1]
  const firstPt = pts[0]
  const delta = lastPt && firstPt ? lastPt.value - firstPt.value : null
  const lowerBetter = ['body_fat_pct', 'waist_cm', 'weight_kg'].includes(activeMetric)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-6 h-14 flex items-center justify-between"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/aluno" className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>←</Link>
          <h1 className="font-bold text-white">📈 Minha Evolução</h1>
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {records.length} avaliações
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Carregando...
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-32 px-8">
          <div className="text-5xl mb-4">📊</div>
          <p className="font-bold text-white mb-2">Nenhuma avaliação ainda</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Seu nutricionista ainda não registrou avaliações físicas.
          </p>
        </div>
      ) : (
        <div className="px-6 py-6 space-y-5">
          {/* Latest summary cards */}
          {latest && (
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map(m => {
                const val = latest[m.key as keyof Record] as number | null
                const firstVal = first ? first[m.key as keyof Record] as number | null : null
                const d = val !== null && firstVal !== null ? val - firstVal : null
                const lb = ['body_fat_pct', 'waist_cm', 'weight_kg'].includes(m.key)
                const positive = d !== null ? (lb ? d < 0 : d > 0) : null
                return (
                  <button
                    key={m.key}
                    onClick={() => setActiveMetric(m.key)}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      background: activeMetric === m.key ? m.color + '15' : 'var(--dark-card)',
                      border: `1px solid ${activeMetric === m.key ? m.color + '40' : 'var(--dark-border)'}`,
                    }}
                  >
                    <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {m.icon} {m.label}
                    </div>
                    <div className="text-xl font-black" style={{ color: val !== null ? 'white' : 'rgba(255,255,255,0.2)' }}>
                      {val !== null ? val.toFixed(1) : '—'}
                      <span className="text-xs font-normal ml-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.unit}</span>
                    </div>
                    {d !== null && (
                      <div className={`text-[11px] font-semibold mt-0.5 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d > 0 ? '+' : ''}{d.toFixed(1)}{m.unit} total
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Chart */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-bold" style={{ color: metric.color }}>{metric.label} ({metric.unit})</span>
              <div className="flex items-center gap-2">
                {activeGoal && (() => {
                  const currentVal = pts.length > 0 ? pts[pts.length - 1].value : null
                  const start = pts.length > 0 ? pts[0].value : null
                  const target = activeGoal.target_value
                  const lowerG = activeGoal.direction === 'decrease'
                  const isAchieved = currentVal != null && (lowerG ? currentVal <= target : currentVal >= target)
                  const totalDelta = Math.abs(target - (start ?? target))
                  const progressDelta = currentVal != null && start != null ? Math.abs(currentVal - start) : 0
                  const pct = totalDelta > 0 ? Math.min(100, Math.round((progressDelta / totalDelta) * 100)) : 0
                  return (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{
                        background: isAchieved ? 'rgba(34,197,94,0.15)' : 'rgba(74,222,128,0.08)',
                        color: isAchieved ? '#4ade80' : 'rgba(74,222,128,0.8)',
                        border: `1px solid ${isAchieved ? 'rgba(34,197,94,0.3)' : 'rgba(74,222,128,0.2)'}`,
                      }}>
                      🎯 Meta {target}{metric.unit} · {isAchieved ? '✓ atingida!' : `${pct}%`}
                    </span>
                  )
                })()}
                {delta !== null && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    (lowerBetter ? delta < 0 : delta > 0) ? 'text-emerald-400' : 'text-red-400'
                  }`} style={{ background: (lowerBetter ? delta < 0 : delta > 0) ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)' }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}{metric.unit}
                  </span>
                )}
              </div>
            </div>

            {pts.length < 2 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Sem dados suficientes para este indicador.
              </div>
            ) : chart && (
              <div className="relative">
                <svg
                  ref={svgRef}
                  width="100%"
                  height={H}
                  viewBox={`0 0 ${svgW} ${H}`}
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <defs>
                    <linearGradient id="water-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metric.color} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Grid */}
                  {[0.25, 0.5, 0.75].map(t => (
                    <line key={t}
                      x1={PAD.left} y1={PAD.top + chartH * (1 - t)}
                      x2={svgW - PAD.right} y2={PAD.top + chartH * (1 - t)}
                      stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                    />
                  ))}

                  {/* Y labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map(t => {
                    const v = chart.min + chart.range * t
                    return (
                      <text key={t}
                        x={PAD.left - 6} y={PAD.top + chartH * (1 - t) + 4}
                        textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.25)">
                        {v.toFixed(1)}
                      </text>
                    )
                  })}

                  {/* Area + Line */}
                  <polygon points={chart.areaPoints} fill="url(#water-grad)" />
                  <polyline points={chart.linePoints} fill="none"
                    stroke={metric.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Goal target line */}
                  {activeGoal && (() => {
                    const gv = activeGoal.target_value
                    if (gv < chart.min || gv > chart.max) return null
                    const gy = chart.yp(gv)
                    return (
                      <>
                        <line
                          x1={PAD.left} y1={gy}
                          x2={svgW - PAD.right} y2={gy}
                          stroke="rgba(74,222,128,0.55)" strokeWidth="1.5" strokeDasharray="5,4"
                        />
                        <text
                          x={svgW - PAD.right - 2} y={gy - 3}
                          textAnchor="end" fontSize="9" fill="rgba(74,222,128,0.75)" fontWeight="600">
                          {gv}{metric.unit}
                        </text>
                      </>
                    )
                  })()}

                  {/* Points */}
                  {pts.map((p, i) => (
                    <circle key={i}
                      cx={chart.xp(i)} cy={chart.yp(p.value)}
                      r={hoverIdx === i ? 5 : 3}
                      fill={metric.color} stroke="var(--dark-card)" strokeWidth="1.5"
                    />
                  ))}

                  {/* X labels */}
                  {pts.map((p, i) => {
                    if (pts.length > 6 && i % 2 !== 0 && i !== pts.length - 1) return null
                    return (
                      <text key={i}
                        x={chart.xp(i)} y={PAD.top + chartH + 18}
                        textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.25)">
                        {fmtDate(p.date)}
                      </text>
                    )
                  })}

                  {/* Hover line */}
                  {hoverIdx !== null && (
                    <line
                      x1={chart.xp(hoverIdx)} y1={PAD.top}
                      x2={chart.xp(hoverIdx)} y2={PAD.top + chartH}
                      stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3"
                    />
                  )}

                  {/* Invisible hover targets */}
                  {pts.map((_, i) => {
                    const segW = chartW / pts.length
                    return (
                      <rect key={i}
                        x={chart.xp(i) - segW / 2} y={PAD.top}
                        width={segW} height={chartH}
                        fill="transparent"
                        onMouseEnter={() => setHoverIdx(i)}
                      />
                    )
                  })}
                </svg>

                {/* Hover tooltip */}
                {hoverPt && (
                  <div className="absolute top-2 right-3 rounded-xl p-3 pointer-events-none text-xs"
                    style={{ background: 'rgba(6,6,10,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="font-semibold text-white mb-1">{fmtDate(hoverPt.date)}</div>
                    <div style={{ color: metric.color }}>
                      {hoverPt.value.toFixed(1)} {metric.unit}
                    </div>
                    {hoverPt.rec.adherence_pct !== null && (
                      <div className="mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Aderência: {hoverPt.rec.adherence_pct}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History list */}
          <div>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Histórico
            </div>
            <div className="space-y-1.5">
              {[...records].reverse().map((rec, idx) => {
                const val = rec[activeMetric] as number | null
                const prevRec = [...records].reverse()[idx + 1]
                const prevVal = prevRec ? prevRec[activeMetric] as number | null : null
                const d = val !== null && prevVal !== null ? val - prevVal : null
                const lb = lowerBetter
                const positive = d !== null ? (lb ? d < 0 : d > 0) : null
                return (
                  <div key={rec.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {new Date(rec.measured_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                      {rec.adherence_pct !== null && (
                        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Aderência: {rec.adherence_pct}%
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black" style={{ color: val !== null ? metric.color : 'rgba(255,255,255,0.2)' }}>
                        {val !== null ? val.toFixed(1) : '—'} {val !== null ? metric.unit : ''}
                      </div>
                      {d !== null && (
                        <div className={`text-[10px] font-semibold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {d > 0 ? '+' : ''}{d.toFixed(1)}{metric.unit}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
