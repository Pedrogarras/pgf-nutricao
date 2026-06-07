'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type DayData = {
  date: string
  logged: boolean
  kcal: number
  protein: number
  carbs: number
  fat: number
  meals: number
  kcalPct: number | null
}

type Summary = {
  loggedDays: number
  totalDays: number
  complianceRate: number
  avgKcal: number | null
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  inRangeDays: number
  aboveDays: number
  belowDays: number
}

type Targets = {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

function MacroBar({ label, actual, target, color }: { label: string; actual: number | null; target: number | null; color: string }) {
  const pct = actual && target ? Math.min(120, Math.round((actual / target) * 100)) : 0
  const isOver = pct > 100
  return (
    <div>
      <div className="flex items-end justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {actual != null ? <span className="font-bold text-white">{actual}g</span> : '—'}
          {target ? <span> / {target}g</span> : ''}
          {target && actual != null ? (
            <span className="ml-2 font-bold" style={{ color: isOver ? '#F87171' : color }}>{pct}%</span>
          ) : null}
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: isOver ? '#F87171' : color }} />
      </div>
    </div>
  )
}

function CalorieChart({ daily, targetKcal }: { daily: DayData[]; targetKcal: number | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)

  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const H = 160, PAD_L = 40, PAD_R = 12, PAD_T = 16, PAD_B = 28
  const chartW = Math.max(100, width - PAD_L - PAD_R)
  const chartH = H - PAD_T - PAD_B

  const kcals = daily.map(d => d.kcal)
  const maxKcal = Math.max(targetKcal ?? 0, ...kcals, 100)
  const barW = Math.max(3, chartW / daily.length - 2)

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none">
        {/* Target line */}
        {targetKcal && (
          <>
            <line
              x1={PAD_L} y1={PAD_T + chartH - (targetKcal / maxKcal) * chartH}
              x2={PAD_L + chartW} y2={PAD_T + chartH - (targetKcal / maxKcal) * chartH}
              stroke="rgba(37,99,235,0.5)" strokeWidth="1" strokeDasharray="4,3"
            />
            <text
              x={PAD_L + chartW + 3}
              y={PAD_T + chartH - (targetKcal / maxKcal) * chartH + 4}
              fontSize="9" fill="rgba(147,197,253,0.7)">meta</text>
          </>
        )}

        {/* Bars */}
        {daily.map((d, i) => {
          const x = PAD_L + i * (chartW / daily.length) + (chartW / daily.length - barW) / 2
          const h = d.kcal > 0 ? Math.max(2, (d.kcal / maxKcal) * chartH) : 0
          const y = PAD_T + chartH - h
          const pct = d.kcalPct
          const color = !d.logged ? 'rgba(255,255,255,0.06)'
            : pct == null ? 'rgba(37,99,235,0.6)'
            : pct >= 90 && pct <= 110 ? 'rgba(74,222,128,0.7)'
            : pct > 110 ? 'rgba(248,113,113,0.7)'
            : 'rgba(252,211,77,0.6)'
          return (
            <rect key={d.date} x={x} y={y} width={barW} height={h} rx="1.5" fill={color}>
              <title>{d.date}: {d.kcal ? `${Math.round(d.kcal)} kcal` : 'Sem registro'}</title>
            </rect>
          )
        })}

        {/* X axis — weekly labels */}
        {daily.map((d, i) => {
          if (i % 7 !== 0) return null
          const x = PAD_L + i * (chartW / daily.length)
          const date = new Date(d.date + 'T12:00')
          return (
            <text key={d.date} x={x} y={H - 4} fontSize="9" fill="rgba(255,255,255,0.25)" textAnchor="middle">
              {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
          )
        })}

        {/* Y axis labels */}
        {[0, 0.5, 1].map(frac => {
          const val = Math.round(maxKcal * frac)
          const y = PAD_T + chartH - frac * chartH
          return (
            <text key={frac} x={PAD_L - 5} y={y + 4} fontSize="9" fill="rgba(255,255,255,0.2)" textAnchor="end">
              {val}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

export default function AderenciaPage() {
  const params = useParams()
  const patientId = params.id as string

  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [patientName, setPatientName] = useState('')
  const [daily, setDaily] = useState<DayData[]>([])
  const [targets, setTargets] = useState<Targets>({ kcal: null, protein: null, carbs: null, fat: null })
  const [summary, setSummary] = useState<Summary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [resAdh, resPatient] = await Promise.all([
      fetch(`/api/adherence?patient_id=${patientId}&days=${days}`),
      fetch(`/api/patients/${patientId}`),
    ])
    const d1 = await resAdh.json()
    const d2 = await resPatient.json()
    setDaily(d1.daily ?? [])
    setTargets(d1.targets ?? {})
    setSummary(d1.summary ?? null)
    setPatientName(d2.patient?.full_name ?? '')
    setLoading(false)
  }, [patientId, days])

  useEffect(() => { load() }, [load])

  const compColor = (pct: number) =>
    pct >= 80 ? '#4ADE80' : pct >= 60 ? '#FCD34D' : '#F87171'

  // Group daily by week for weekly averages
  const weeks: DayData[][] = []
  let currentWeek: DayData[] = []
  for (const d of daily) {
    currentWeek.push(d)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="sticky top-0 z-40 flex items-center gap-2 px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <Link href="/pro/pacientes" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>Pacientes</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <Link href={`/pro/pacientes/${patientId}`} className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>{patientName || 'Paciente'}</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-xs font-semibold text-white">Aderência</span>
      </div>

      <div className="p-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Análise</div>
            <h1 className="text-2xl font-black text-white tracking-tight">📊 Aderência ao Plano</h1>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: days === d ? 'var(--dark-accent)' : 'var(--dark-surface)',
                  color: days === d ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${days === d ? 'transparent' : 'var(--dark-border)'}`,
                }}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>Carregando...</div>
        ) : (
          <>
            {/* Summary KPIs */}
            {summary && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Registros</div>
                  <div className="text-3xl font-black" style={{ color: compColor(summary.complianceRate) }}>{summary.complianceRate}%</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{summary.loggedDays}/{summary.totalDays} dias</div>
                </div>
                <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Kcal média/dia</div>
                  <div className="text-3xl font-black text-white">{summary.avgKcal ?? '—'}</div>
                  {targets.kcal && summary.avgKcal && (
                    <div className="text-xs mt-1" style={{
                      color: Math.abs(summary.avgKcal - targets.kcal) <= targets.kcal * 0.1 ? '#4ADE80'
                        : summary.avgKcal > targets.kcal ? '#F87171' : '#FCD34D'
                    }}>
                      meta: {targets.kcal} kcal
                    </div>
                  )}
                </div>
                <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Dentro da meta</div>
                  <div className="text-3xl font-black" style={{ color: '#4ADE80' }}>{summary.inRangeDays}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>dias (±10% kcal)</div>
                </div>
                <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>Distribuição</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: '#4ADE80' }}>✓ Na meta</span>
                      <span className="font-bold text-white">{summary.inRangeDays} dias</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: '#F87171' }}>↑ Acima</span>
                      <span className="font-bold text-white">{summary.aboveDays} dias</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: '#FCD34D' }}>↓ Abaixo</span>
                      <span className="font-bold text-white">{summary.belowDays} dias</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Calorie chart */}
            <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-white">Ingestão Calórica Diária</div>
                  <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(74,222,128,0.7)' }} /> Na meta</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(248,113,113,0.7)' }} /> Acima</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(252,211,77,0.6)' }} /> Abaixo</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.06)' }} /> Sem registro</span>
                  </div>
                </div>
              </div>
              <CalorieChart daily={daily} targetKcal={targets.kcal} />
            </div>

            {/* Macro averages */}
            {summary && (summary.avgKcal || summary.avgProtein) && (
              <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                <div className="text-sm font-bold text-white mb-5">Médias de Macros (dias registrados)</div>
                <div className="space-y-4">
                  <MacroBar label="Proteína" actual={summary.avgProtein} target={targets.protein} color="#818CF8" />
                  <MacroBar label="Carboidratos" actual={summary.avgCarbs} target={targets.carbs} color="#FCD34D" />
                  <MacroBar label="Gordura" actual={summary.avgFat} target={targets.fat} color="#F97316" />
                </div>
              </div>
            )}

            {/* Weekly calendar heatmap */}
            <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="text-sm font-bold text-white mb-4">Calendário de Registros</div>
              <div className="space-y-2">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex gap-2">
                    {week.map(d => {
                      const date = new Date(d.date + 'T12:00')
                      const dayLabel = date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)
                      const monthDay = date.getDate()
                      const color = !d.logged ? 'rgba(255,255,255,0.05)'
                        : d.kcalPct == null ? 'rgba(37,99,235,0.5)'
                        : d.kcalPct >= 90 && d.kcalPct <= 110 ? 'rgba(74,222,128,0.65)'
                        : d.kcalPct > 110 ? 'rgba(248,113,113,0.65)'
                        : 'rgba(252,211,77,0.5)'
                      const title = d.logged
                        ? `${d.date}\n${Math.round(d.kcal)} kcal · ${d.meals} refeição(ões)\nProteína: ${Math.round(d.protein)}g`
                        : `${d.date}\nSem registro`
                      return (
                        <div key={d.date} className="flex-1 rounded-xl overflow-hidden cursor-default" title={title}
                          style={{ background: color, minWidth: 0 }}>
                          <div className="py-2 text-center">
                            <div className="text-[9px] font-semibold leading-none mb-0.5" style={{ color: d.logged ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.2)' }}>{dayLabel}</div>
                            <div className="text-xs font-black leading-none" style={{ color: d.logged ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.2)' }}>{monthDay}</div>
                            {d.logged && d.kcal > 0 && (
                              <div className="text-[9px] leading-none mt-0.5 font-semibold" style={{ color: 'rgba(0,0,0,0.5)' }}>
                                {Math.round(d.kcal)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {/* Fill remaining days in last week */}
                    {wi === weeks.length - 1 && Array.from({ length: 7 - week.length }).map((_, i) => (
                      <div key={`pad-${i}`} className="flex-1" style={{ minWidth: 0 }} />
                    ))}
                    {/* Week average */}
                    {(() => {
                      const logged = week.filter(d => d.logged)
                      if (logged.length === 0) return <div className="w-20 text-center text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>—</div>
                      const avgKcal = Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length)
                      const compPct = targets.kcal ? Math.round((avgKcal / targets.kcal) * 100) : null
                      return (
                        <div className="w-20 text-right text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <div className="font-bold text-white">{avgKcal}</div>
                          <div style={{ color: 'rgba(255,255,255,0.2)' }}>média</div>
                          {compPct && <div style={{ color: compPct >= 90 && compPct <= 110 ? '#4ADE80' : '#FCD34D' }}>{compPct}%</div>}
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>

            {/* Day-by-day breakdown */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--dark-border)' }}>
                <div className="text-sm font-bold text-white">Detalhamento Diário</div>
              </div>
              <div className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--dark-border)' } as React.CSSProperties}>
                {[...daily].reverse().map(d => {
                  if (!d.logged) return null
                  const pct = d.kcalPct
                  const color = pct == null ? '#93C5FD'
                    : pct >= 90 && pct <= 110 ? '#4ADE80'
                    : pct > 110 ? '#F87171'
                    : '#FCD34D'
                  return (
                    <div key={d.date} className="flex items-center gap-4 px-6 py-3">
                      <div className="w-24 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {new Date(d.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          {targets.kcal && (
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, (d.kcal / targets.kcal) * 100)}%`, background: color }} />
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-bold w-20 text-right" style={{ color }}>
                        {Math.round(d.kcal)} kcal
                      </div>
                      <div className="text-xs w-12 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {d.meals} ref.
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs w-48 text-right">
                        <span style={{ color: '#818CF8' }}>{Math.round(d.protein)}g P</span>
                        <span style={{ color: '#FCD34D' }}>{Math.round(d.carbs)}g C</span>
                        <span style={{ color: '#F97316' }}>{Math.round(d.fat)}g G</span>
                      </div>
                      {pct != null && (
                        <div className="text-xs font-bold w-14 text-right" style={{ color }}>
                          {pct}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
