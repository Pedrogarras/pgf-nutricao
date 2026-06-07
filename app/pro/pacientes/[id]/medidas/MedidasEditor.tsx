'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface Record {
  id: string
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  waist_cm: number | null
  hip_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
  calf_cm: number | null
  adherence_pct: number | null
  notes: string | null
}

interface Patient {
  id: string
  full_name: string
  weight_kg: number | null
  height_cm: number | null
}

const EMPTY: Omit<Record, 'id'> = {
  measured_at: new Date().toISOString().split('T')[0],
  weight_kg: null, body_fat_pct: null, muscle_mass_kg: null,
  waist_cm: null, hip_cm: null, arm_cm: null, thigh_cm: null, calf_cm: null,
  adherence_pct: null, notes: null,
}

function n(v: number | null | undefined, digits = 1) { return v != null ? v.toFixed(digits) : '—' }
function diff(a: number | null, b: number | null): { val: string; color: string } | null {
  if (a == null || b == null) return null
  const d = a - b
  if (Math.abs(d) < 0.01) return null
  return { val: (d > 0 ? '+' : '') + d.toFixed(1), color: d < 0 ? 'text-emerald-400' : 'text-red-400' }
}

// ── Evolution Chart ──────────────────────────────────────────────────────────
interface ChartSeries {
  key: keyof Record
  label: string
  color: string
  unit: string
  compute?: (r: Record, heightCm: number | null) => number | null
}

const CHART_SERIES: ChartSeries[] = [
  { key: 'weight_kg',      label: 'Peso',        color: '#3B82F6', unit: 'kg' },
  { key: 'body_fat_pct',   label: '% Gordura',   color: '#F87171', unit: '%' },
  { key: 'muscle_mass_kg', label: 'Massa Magra',  color: '#34D399', unit: 'kg' },
  { key: 'waist_cm',       label: 'Cintura',     color: '#FBBF24', unit: 'cm' },
  { key: 'adherence_pct',  label: 'Aderência',   color: '#A78BFA', unit: '%' },
]

function EvolutionChart({ records, heightCm }: { records: Record[]; heightCm: number | null }) {
  const [activeSeries, setActiveSeries] = useState<Set<string>>(new Set(['weight_kg', 'body_fat_pct', 'muscle_mass_kg']))
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgWidth, setSvgWidth] = useState(700)

  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(entries => {
      setSvgWidth(entries[0].contentRect.width)
    })
    ro.observe(svgRef.current.parentElement!)
    setSvgWidth(svgRef.current.parentElement?.clientWidth ?? 700)
    return () => ro.disconnect()
  }, [])

  const sorted = [...records].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  if (sorted.length < 2) {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Adicione pelo menos 2 avaliações para ver os gráficos de evolução.
      </div>
    )
  }

  const PAD = { top: 24, right: 20, bottom: 52, left: 52 }
  const H = 280
  const W = svgWidth
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  // Build per-series data
  const seriesData = CHART_SERIES
    .filter(s => activeSeries.has(s.key))
    .map(s => {
      const pts = sorted.map(r => {
        const v = s.compute ? s.compute(r, heightCm) : (r[s.key] as number | null)
        return { date: r.measured_at, value: v }
      }).filter(p => p.value !== null) as { date: string; value: number }[]
      return { ...s, pts }
    })
    .filter(s => s.pts.length >= 2)

  if (!seriesData.length) return (
    <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
      Nenhum dado disponível para os indicadores selecionados.
    </div>
  )

  // X scale: date index → pixel
  const allDates = sorted.map(r => r.measured_at)
  function xScale(date: string) {
    const idx = allDates.indexOf(date)
    if (idx === -1) return PAD.left
    return PAD.left + (idx / (allDates.length - 1)) * chartW
  }

  // Y scale per series (normalize 0–1 within chart)
  function getScale(pts: { value: number }[]) {
    const vals = pts.map(p => p.value)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    return { min, max, range }
  }

  function yScale(value: number, min: number, range: number) {
    return PAD.top + chartH - ((value - min) / range) * chartH
  }

  // Build polyline + area path per series
  function buildPath(pts: { date: string; value: number }[], min: number, range: number) {
    const linePoints = pts.map(p => `${xScale(p.date).toFixed(1)},${yScale(p.value, min, range).toFixed(1)}`).join(' ')
    const first = pts[0], last = pts[pts.length - 1]
    const areaPoints = [
      `${xScale(first.date).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
      ...pts.map(p => `${xScale(p.date).toFixed(1)},${yScale(p.value, min, range).toFixed(1)}`),
      `${xScale(last.date).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
    ].join(' ')
    return { linePoints, areaPoints }
  }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const hoverRecord = hoverIdx !== null ? sorted[hoverIdx] : null

  return (
    <div>
      {/* Series toggles */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {CHART_SERIES.map(s => {
          const active = activeSeries.has(s.key)
          return (
            <button key={s.key}
              onClick={() => setActiveSeries(prev => {
                const n = new Set(prev)
                active ? n.delete(s.key) : n.add(s.key)
                return n
              })}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={active
                ? { background: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? s.color : 'rgba(255,255,255,0.15)' }} />
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
        <svg
          ref={svgRef}
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            {seriesData.map(s => {
              const scale = getScale(s.pts)
              return (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              )
            })}
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(t => {
            const y = PAD.top + chartH * (1 - t)
            return (
              <line key={t} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            )
          })}

          {/* X gridlines */}
          {allDates.map((d, i) => {
            const x = xScale(d)
            return (
              <line key={d} x1={x} y1={PAD.top} x2={x} y2={PAD.top + chartH}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            )
          })}

          {/* Series: area + line */}
          {seriesData.map(s => {
            const scale = getScale(s.pts)
            const { linePoints, areaPoints } = buildPath(s.pts, scale.min, scale.range)
            return (
              <g key={s.key}>
                <polygon points={areaPoints} fill={`url(#grad-${s.key})`} />
                <polyline points={linePoints} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {s.pts.map((p, pi) => (
                  <circle key={pi} cx={xScale(p.date)} cy={yScale(p.value, scale.min, scale.range)}
                    r={hoverIdx !== null && allDates[hoverIdx] === p.date ? 5 : 3}
                    fill={s.color} stroke="var(--dark-surface)" strokeWidth="1.5" />
                ))}
              </g>
            )
          })}

          {/* Y-axis labels (first active series) */}
          {seriesData[0] && (() => {
            const s = seriesData[0]
            const scale = getScale(s.pts)
            return [0, 0.25, 0.5, 0.75, 1].map(t => {
              const val = scale.min + scale.range * t
              const y = PAD.top + chartH * (1 - t)
              return (
                <text key={t} x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9"
                  fill="rgba(255,255,255,0.3)">{val.toFixed(1)}</text>
              )
            })
          })()}

          {/* X-axis labels */}
          {allDates.map((d, i) => {
            // Show every label if few; skip for crowded
            const skip = allDates.length > 8 && i % 2 !== 0
            if (skip) return null
            return (
              <text key={d} x={xScale(d)} y={PAD.top + chartH + 18} textAnchor="middle"
                fontSize="9" fill="rgba(255,255,255,0.3)">
                {fmtDate(d)}
              </text>
            )
          })}

          {/* Hover line */}
          {hoverIdx !== null && (() => {
            const x = xScale(allDates[hoverIdx])
            return (
              <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + chartH}
                stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
            )
          })()}

          {/* Invisible hover targets */}
          {allDates.map((d, i) => {
            const x = xScale(d)
            const segW = chartW / (allDates.length)
            return (
              <rect key={i} x={x - segW / 2} y={PAD.top} width={segW} height={chartH}
                fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
            )
          })}
        </svg>

        {/* Hover tooltip */}
        {hoverRecord && (
          <div
            className="absolute top-3 right-4 rounded-xl p-3 text-xs space-y-1 pointer-events-none"
            style={{ background: 'rgba(6,6,10,0.92)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '140px' }}
          >
            <div className="font-semibold text-white mb-1.5">
              {new Date(hoverRecord.measured_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
            </div>
            {seriesData.map(s => {
              const pt = s.pts.find(p => p.date === hoverRecord.measured_at)
              if (!pt) return null
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>{s.label}:</span>
                  <span className="font-semibold" style={{ color: s.color }}>{pt.value.toFixed(1)} {s.unit}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* First vs Last delta summary */}
      {sorted.length >= 2 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {seriesData.map(s => {
            const first = s.pts[0], last = s.pts[s.pts.length - 1]
            const delta = last.value - first.value
            const lowerBetter = ['body_fat_pct', 'waist_cm', 'weight_kg'].includes(s.key)
            const positive = lowerBetter ? delta < 0 : delta > 0
            const deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(1) + ' ' + s.unit
            return (
              <div key={s.key} className="rounded-xl p-3" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
                <div className="text-base font-black text-white">{last.value.toFixed(1)} <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.unit}</span></div>
                <div className={`text-[11px] font-semibold mt-0.5 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {deltaStr} total
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function MedidasEditor({ patient, initialRecords }: { patient: Patient; initialRecords: Record[] }) {
  const [records, setRecords] = useState<Record[]>(initialRecords)
  const [addOpen, setAddOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'tabela' | 'graficos'>('tabela')
  const [editingRec, setEditingRec] = useState<Record | null>(null)
  const [form, setForm] = useState<Omit<Record, 'id'>>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function openAdd() {
    setForm({ ...EMPTY, measured_at: new Date().toISOString().split('T')[0] })
    setEditingRec(null)
    setAddOpen(true)
  }

  function openEdit(rec: Record) {
    setForm({ ...rec })
    setEditingRec(rec)
    setAddOpen(true)
  }

  function fv(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value === '' ? null : value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      patient_id: patient.id,
      measured_at: form.measured_at,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null,
      muscle_mass_kg: form.muscle_mass_kg ? Number(form.muscle_mass_kg) : null,
      waist_cm: form.waist_cm ? Number(form.waist_cm) : null,
      hip_cm: form.hip_cm ? Number(form.hip_cm) : null,
      arm_cm: form.arm_cm ? Number(form.arm_cm) : null,
      thigh_cm: form.thigh_cm ? Number(form.thigh_cm) : null,
      calf_cm: form.calf_cm ? Number(form.calf_cm) : null,
      adherence_pct: form.adherence_pct ? Number(form.adherence_pct) : null,
      notes: form.notes || null,
    }

    if (editingRec) {
      const res = await fetch(`/api/records/${editingRec.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.record) setRecords(prev => prev.map(r => r.id === editingRec.id ? data.record : r).sort((a, b) => b.measured_at.localeCompare(a.measured_at)))
    } else {
      const res = await fetch('/api/records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.record) setRecords(prev => [data.record, ...prev].sort((a, b) => b.measured_at.localeCompare(a.measured_at)))
    }

    setLoading(false)
    setAddOpen(false)
    setEditingRec(null)
  }

  async function handleDelete(rec: Record) {
    if (!confirm(`Excluir medição de ${fmtDate(rec.measured_at)}?`)) return
    setDeletingId(rec.id)
    await fetch(`/api/records/${rec.id}`, { method: 'DELETE' })
    setRecords(prev => prev.filter(r => r.id !== rec.id))
    setDeletingId(null)
  }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Compute BMI if both weight and height available
  function bmi(weight: number | null) {
    if (!weight || !patient.height_cm) return null
    const h = patient.height_cm / 100
    return weight / (h * h)
  }

  // Weight trend: simple SVG sparkline from last 10 records
  const weightData = [...records].reverse().filter(r => r.weight_kg != null).slice(-12)

  function Sparkline() {
    if (weightData.length < 2) return null
    const vals = weightData.map(r => r.weight_kg as number)
    const min = Math.min(...vals) - 1
    const max = Math.max(...vals) + 1
    const W = 180, H = 48
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * W
      const y = H - ((v - min) / (max - min)) * H
      return `${x},${y}`
    }).join(' ')

    return (
      <div className="mt-3">
        <div className="text-[10px] text-gray-400 mb-1">Evolução do peso</div>
        <svg width={W} height={H} className="overflow-visible">
          <polyline points={pts} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * W
            const y = H - ((v - min) / (max - min)) * H
            return <circle key={i} cx={x} cy={y} r="3" fill="#3B82F6" />
          })}
        </svg>
        <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
          <span>{fmtDate(weightData[0].measured_at)}</span>
          <span>{fmtDate(weightData[weightData.length - 1].measured_at)}</span>
        </div>
      </div>
    )
  }

  const latest = records[0]
  const previous = records[1]

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between" style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patient.id}`} className="btn btn-ghost btn-sm text-white/60">← {patient.full_name}</Link>
          <div>
            <div className="font-bold text-white">Medidas & Evolução</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{records.length} avaliação{records.length !== 1 ? 'ões' : ''} registradas</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['tabela', 'graficos'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={activeTab === tab
                ? { background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.4)' }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
              }>
              {tab === 'tabela' ? '📋 Tabela' : '📈 Gráficos'}
            </button>
          ))}
          <button onClick={openAdd} className="btn btn-primary">+ Nova Avaliação</button>
        </div>
      </div>

      <div className="p-8 max-w-5xl">

        {/* Summary cards */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {([
              { label: 'Peso', val: n(latest.weight_kg), unit: 'kg', prev: previous?.weight_kg, cur: latest.weight_kg, lowerBetter: true },
              { label: '% Gordura', val: n(latest.body_fat_pct), unit: '%', prev: previous?.body_fat_pct, cur: latest.body_fat_pct, lowerBetter: true },
              { label: 'Massa Magra', val: n(latest.muscle_mass_kg), unit: 'kg', prev: previous?.muscle_mass_kg, cur: latest.muscle_mass_kg, lowerBetter: false },
              { label: 'Cintura', val: n(latest.waist_cm), unit: 'cm', prev: previous?.waist_cm, cur: latest.waist_cm, lowerBetter: true },
            ] as { label: string; val: string; unit: string; prev: number | null | undefined; cur: number | null; lowerBetter: boolean }[]).map(card => {
              const d = diff(card.cur, card.prev ?? null)
              const color = d ? (card.lowerBetter ? (d.val.startsWith('-') ? 'text-emerald-400' : 'text-red-400') : (d.val.startsWith('+') ? 'text-emerald-400' : 'text-red-400')) : ''
              return (
                <div key={card.label} className="card p-4">
                  <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                  <div className="text-2xl font-black text-gray-900">{card.val} <span className="text-sm font-normal text-gray-400">{card.unit}</span></div>
                  {d && <div className={`text-xs font-semibold mt-1 ${color}`}>{d.val} {card.unit} vs anterior</div>}
                  {!d && previous && <div className="text-xs text-gray-300 mt-1">Sem alteração</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* Evolution Charts Tab */}
        {activeTab === 'graficos' && (
          <div className="mb-8">
            <EvolutionChart records={records} heightCm={patient.height_cm} />
          </div>
        )}

        {/* Sparkline + BMI */}
        {activeTab === 'tabela' && weightData.length >= 2 && (
          <div className="card p-5 mb-8 flex gap-8 flex-wrap">
            <div className="flex-shrink-0">
              <Sparkline />
            </div>
            {latest?.weight_kg && patient.height_cm && (
              <div>
                <div className="text-xs text-gray-400 mb-1">IMC atual</div>
                <div className="text-3xl font-black text-gray-900">{n(bmi(latest.weight_kg))}</div>
                <div className="text-xs text-gray-400 mt-1">{(() => {
                  const b = bmi(latest.weight_kg)!
                  if (b < 18.5) return '⚠ Abaixo do peso'
                  if (b < 25) return '✓ Peso normal'
                  if (b < 30) return '⚠ Sobrepeso'
                  return '⚠ Obesidade'
                })()}</div>
              </div>
            )}
            {latest && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Aderência última avaliação</div>
                {latest.adherence_pct != null ? (
                  <>
                    <div className="text-3xl font-black text-gray-900">{latest.adherence_pct}<span className="text-sm font-normal text-gray-400">%</span></div>
                    <div className="w-32 bg-gray-100 rounded-full h-2 mt-2">
                      <div className="h-2 rounded-full" style={{ width: `${latest.adherence_pct}%`, background: latest.adherence_pct >= 80 ? '#10B981' : latest.adherence_pct >= 60 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                  </>
                ) : <div className="text-2xl font-black text-gray-300">—</div>}
              </div>
            )}
          </div>
        )}

        {/* Records table (only in tabela view) */}
        {activeTab === 'graficos' ? null : records.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="font-semibold text-gray-500 mb-1">Nenhuma avaliação registrada</div>
            <div className="text-sm text-gray-400 mb-4">Registre a primeira medição do paciente</div>
            <button onClick={openAdd} className="btn btn-primary">+ Primeira Avaliação</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Data', 'Peso', 'Gordura', 'Massa Magra', 'Cintura', 'Quadril', 'Braço', 'Coxa', 'Panturr.', 'Aderência', ''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec, idx) => {
                  const prev = records[idx + 1]
                  const isExpanded = expandedId === rec.id
                  const weightDiff = diff(rec.weight_kg, prev?.weight_kg ?? null)
                  const fatDiff = diff(rec.body_fat_pct, prev?.body_fat_pct ?? null)
                  return (
                    <>
                      <tr key={rec.id} className="border-b border-gray-50 hover:bg-pgf-50/30 group cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : rec.id)}>
                        <td className="px-3 py-3 font-semibold text-pgf-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <svg className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            {fmtDate(rec.measured_at)}
                            {idx === 0 && <span className="badge badge-blue text-[9px] py-0 px-1 ml-1">Atual</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold">{n(rec.weight_kg)} <span className="text-gray-400 font-normal text-xs">kg</span></div>
                          {weightDiff && <div className={`text-[10px] font-semibold ${weightDiff.val.startsWith('-') ? 'text-emerald-500' : 'text-red-400'}`}>{weightDiff.val}kg</div>}
                        </td>
                        <td className="px-3 py-3">
                          <div>{n(rec.body_fat_pct)}<span className="text-gray-400 text-xs">%</span></div>
                          {fatDiff && <div className={`text-[10px] font-semibold ${fatDiff.val.startsWith('-') ? 'text-emerald-500' : 'text-red-400'}`}>{fatDiff.val}%</div>}
                        </td>
                        <td className="px-3 py-3 text-gray-600">{n(rec.muscle_mass_kg)} <span className="text-gray-400 text-xs">kg</span></td>
                        <td className="px-3 py-3 text-gray-600">{n(rec.waist_cm)} <span className="text-gray-400 text-xs">cm</span></td>
                        <td className="px-3 py-3 text-gray-600">{n(rec.hip_cm)} <span className="text-gray-400 text-xs">cm</span></td>
                        <td className="px-3 py-3 text-gray-600">{n(rec.arm_cm)} <span className="text-gray-400 text-xs">cm</span></td>
                        <td className="px-3 py-3 text-gray-600">{n(rec.thigh_cm)} <span className="text-gray-400 text-xs">cm</span></td>
                        <td className="px-3 py-3 text-gray-600">{n(rec.calf_cm)} <span className="text-gray-400 text-xs">cm</span></td>
                        <td className="px-3 py-3">
                          {rec.adherence_pct != null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-14 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${rec.adherence_pct}%`, background: rec.adherence_pct >= 80 ? '#10B981' : rec.adherence_pct >= 60 ? '#F59E0B' : '#EF4444' }} />
                              </div>
                              <span className="text-xs font-semibold">{rec.adherence_pct}%</span>
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(rec)} className="text-gray-300 hover:text-pgf-500 transition-colors" title="Editar">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(rec)} disabled={deletingId === rec.id} className="text-gray-200 hover:text-red-400 transition-colors" title="Excluir">
                              {deletingId === rec.id ? '...' : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && rec.notes && (
                        <tr key={rec.id + '-notes'} className="bg-pgf-50/20 border-b border-gray-100">
                          <td colSpan={11} className="px-6 py-3 text-sm text-gray-600 italic">{rec.notes}</td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">{editingRec ? 'Editar Avaliação' : 'Nova Avaliação'}</h2>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="form-label">Data da avaliação *</label>
                <input name="measured_at" type="date" required value={form.measured_at ?? ''} onChange={fv} className="form-input" style={{ colorScheme: 'light' }} />
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Composição corporal</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Peso (kg)</label>
                    <input name="weight_kg" type="number" step="0.1" value={form.weight_kg ?? ''} onChange={fv} className="form-input" placeholder="70.5" />
                  </div>
                  <div>
                    <label className="form-label">% Gordura</label>
                    <input name="body_fat_pct" type="number" step="0.1" value={form.body_fat_pct ?? ''} onChange={fv} className="form-input" placeholder="22.0" />
                  </div>
                  <div>
                    <label className="form-label">Massa Magra (kg)</label>
                    <input name="muscle_mass_kg" type="number" step="0.1" value={form.muscle_mass_kg ?? ''} onChange={fv} className="form-input" placeholder="54.0" />
                  </div>
                  <div>
                    <label className="form-label">Aderência à dieta (%)</label>
                    <input name="adherence_pct" type="number" min="0" max="100" value={form.adherence_pct ?? ''} onChange={fv} className="form-input" placeholder="85" />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Perimetria (cm)</div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'waist_cm', label: 'Cintura' },
                    { key: 'hip_cm', label: 'Quadril' },
                    { key: 'arm_cm', label: 'Braço' },
                    { key: 'thigh_cm', label: 'Coxa' },
                    { key: 'calf_cm', label: 'Panturrilha' },
                  ] as { key: keyof Omit<Record, 'id'>; label: string }[]).map(({ key, label }) => (
                    <div key={key}>
                      <label className="form-label">{label}</label>
                      <input name={key} type="number" step="0.1" value={(form[key] as number | null) ?? ''} onChange={fv} className="form-input" placeholder="—" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Observações clínicas</label>
                <textarea name="notes" value={form.notes ?? ''} onChange={fv} rows={3} className="form-input" placeholder="Evolução do paciente, ajustes realizados, intercorrências..." />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Salvando...' : editingRec ? 'Salvar alterações' : 'Registrar avaliação'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
