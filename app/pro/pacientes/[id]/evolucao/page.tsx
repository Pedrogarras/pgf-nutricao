import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function r(n: number, d = 1) { return Math.round(n * 10 ** d) / 10 ** d }

interface ChartData {
  dates: string[]
  values: (number | null)[]
}

function LineChart({
  data, color, unit, label, goalLine,
}: {
  data: ChartData
  color: string
  unit: string
  label: string
  goalLine?: number | null
}) {
  const points = data.values.map((v, i) => ({ v, i, date: data.dates[i] })).filter(p => p.v !== null) as { v: number; i: number; date: string }[]
  if (points.length < 2) return (
    <div className="flex items-center justify-center h-28 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
      Dados insuficientes
    </div>
  )

  const W = 520, H = 110, PAD = { top: 12, right: 16, bottom: 20, left: 40 }
  const allVals = points.map(p => p.v)
  if (goalLine) allVals.push(goalLine)
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1

  const cx = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const cy = (v: number) => PAD.top + (1 - (v - minV) / range) * (H - PAD.top - PAD.bottom)

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${cy(p.v)}`).join(' ')
  const areaD = `${pathD} L${cx(points.length - 1)},${H - PAD.bottom} L${cx(0)},${H - PAD.bottom} Z`

  const first = points[0].v
  const last = points[points.length - 1].v
  const delta = r(last - first)
  const isPositive = delta > 0
  const trendColor = delta === 0 ? '#9ca3af' : (label.includes('Peso') || label.includes('Cintura') || label.includes('Gordura'))
    ? (isPositive ? '#f87171' : '#4ade80')
    : (isPositive ? '#4ade80' : '#f87171')

  // Y-axis ticks (3 ticks)
  const yTicks = [minV, (minV + maxV) / 2, maxV]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-black text-white">{last}{unit}</span>
          {delta !== 0 && (
            <span className="font-bold" style={{ color: trendColor }}>
              {delta > 0 ? '+' : ''}{delta}{unit}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>vs início</span>
        </div>
      </div>

      {/* SVG */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis ticks */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={cy(v)} x2={W - PAD.right} y2={cy(v)}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={PAD.left - 4} y={cy(v) + 4} textAnchor="end" fontSize="8"
              fill="rgba(255,255,255,0.25)">{r(v, 0)}</text>
          </g>
        ))}

        {/* Goal line */}
        {goalLine != null && (
          <line x1={PAD.left} y1={cy(goalLine)} x2={W - PAD.right} y2={cy(goalLine)}
            stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
        )}

        {/* Area fill */}
        <path d={areaD} fill={`url(#grad-${label})`} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={cx(i)} cy={cy(p.v)} r="3" fill={color}
            opacity={i === 0 || i === points.length - 1 ? '1' : '0.5'} />
        ))}

        {/* X-axis labels (first, mid, last) */}
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map(i => (
            <text key={i} x={cx(i)} y={H - 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.25)">
              {new Date(points[i].date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </text>
          ))}
      </svg>
    </div>
  )
}

function DiaryHeatmap({ entries }: { entries: { logged_at: string; total_kcal: number | null }[] }) {
  if (!entries || entries.length === 0) return (
    <div className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Sem registros de diário</div>
  )

  // Build last 84 days (12 weeks × 7)
  const today = new Date()
  const days: { date: string; logged: boolean; kcal: number | null }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const entry = entries.find(e => e.logged_at === ds)
    days.push({ date: ds, logged: !!entry, kcal: entry?.total_kcal ?? null })
  }

  const loggedCount = days.filter(d => d.logged).length
  const pct = Math.round((loggedCount / 84) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Aderência ao Diário (12 semanas)
        </div>
        <div className="text-xs font-black" style={{ color: pct >= 70 ? '#4ade80' : pct >= 40 ? '#fbbf24' : '#f87171' }}>
          {loggedCount}/84 dias · {pct}%
        </div>
      </div>
      {/* Heatmap grid: 12 columns (weeks) × 7 rows (days) */}
      <div className="flex gap-1">
        {Array.from({ length: 12 }, (_, week) => (
          <div key={week} className="flex flex-col gap-1 flex-1">
            {days.slice(week * 7, week * 7 + 7).map((d, di) => (
              <div key={di} title={`${d.date}${d.kcal ? ` · ${Math.round(d.kcal)} kcal` : ''}`}
                className="aspect-square rounded-sm"
                style={{
                  background: d.logged
                    ? d.kcal && d.kcal > 0 ? `rgba(74,222,128,${Math.min(1, 0.3 + d.kcal / 3000)})` : 'rgba(74,222,128,0.5)'
                    : 'rgba(255,255,255,0.05)',
                  minHeight: 10,
                }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-2">
        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Sem registro</span>
        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(74,222,128,0.5)' }} />
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Registrado</span>
      </div>
    </div>
  )
}

function GoalBar({ label, current, start, target, unit, achieved }: {
  label: string; current: number | null; start: number | null; target: number; unit: string; achieved: boolean
}) {
  const pct = start != null && current != null && Math.abs(target - start) > 0
    ? Math.min(100, Math.round((Math.abs(current - start) / Math.abs(target - start)) * 100))
    : (achieved ? 100 : 0)
  const color = achieved ? '#4ade80' : pct >= 70 ? '#60a5fa' : pct >= 40 ? '#fbbf24' : '#f87171'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-white">{label}</span>
        <span className="text-xs" style={{ color }}>
          {current != null ? `${current}${unit}` : '—'}
          <span style={{ color: 'rgba(255,255,255,0.25)' }}> / {target}{unit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: achieved ? '#4ade80' : 'linear-gradient(90deg, #2563EB, #60A5FA)' }} />
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {achieved ? '✅ Meta atingida' : `${pct}% do objetivo`}
      </div>
    </div>
  )
}

export default async function PatientEvolucaoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [
    { data: patient },
    { data: records },
    { data: goals },
    { data: diary },
    { data: consultations },
  ] = await Promise.all([
    supabase.from('patients').select('id, full_name, weight_kg, height_cm, gender').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('anthropometric_records')
      .select('id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, hip_cm, arm_cm, thigh_cm, calf_cm, adherence_pct')
      .eq('patient_id', id)
      .order('measured_at'),
    supabase.from('patient_goals')
      .select('id, label, metric, unit, target_value, current_value, start_value, direction, achieved, deadline')
      .eq('patient_id', id)
      .eq('professional_id', user.id)
      .eq('active', true)
      .order('created_at'),
    supabase.from('diary_entries')
      .select('logged_at, total_kcal')
      .eq('patient_id', id)
      .gte('logged_at', new Date(Date.now() - 84 * 86400000).toISOString().split('T')[0])
      .order('logged_at'),
    supabase.from('consultations')
      .select('id, scheduled_at, status')
      .eq('patient_id', id)
      .eq('professional_id', user.id)
      .eq('status', 'realizado')
      .order('scheduled_at'),
  ])

  if (!patient) redirect('/pro/pacientes')

  const recs = records ?? []

  // Build chart datasets
  const dates = recs.map(r => r.measured_at)
  function buildChart(key: keyof typeof recs[0]): ChartData {
    return { dates, values: recs.map(r => (r[key] as number | null) ?? null) }
  }

  const weightChart    = buildChart('weight_kg')
  const fatChart       = buildChart('body_fat_pct')
  const muscleChart    = buildChart('muscle_mass_kg')
  const waistChart     = buildChart('waist_cm')
  const hipChart       = buildChart('hip_cm')
  const armChart       = buildChart('arm_cm')
  const adherenceChart = buildChart('adherence_pct')

  const latestRec = recs.length > 0 ? recs[recs.length - 1] : null
  const firstRec  = recs.length > 0 ? recs[0] : null

  // Summary stats
  const weightDelta = latestRec?.weight_kg && firstRec?.weight_kg
    ? r(latestRec.weight_kg - firstRec.weight_kg) : null
  const fatDelta = latestRec?.body_fat_pct && firstRec?.body_fat_pct
    ? r(latestRec.body_fat_pct - firstRec.body_fat_pct) : null
  const muscleDelta = latestRec?.muscle_mass_kg && firstRec?.muscle_mass_kg
    ? r(latestRec.muscle_mass_kg - firstRec.muscle_mass_kg) : null

  const diaryDays = diary ?? []
  const diaryCount = diaryDays.length
  const avgKcal = diaryDays.filter(d => d.total_kcal).length > 0
    ? r(diaryDays.reduce((s, d) => s + (d.total_kcal ?? 0), 0) / diaryDays.filter(d => d.total_kcal).length, 0)
    : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-6 h-14 flex items-center gap-3"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <Link href={`/pro/pacientes/${id}`} className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
          ← {patient.full_name}
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-sm font-semibold text-white">📈 Evolução</span>
        <div className="ml-auto text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {recs.length} medições
        </div>
      </div>

      <div className="p-6 max-w-4xl space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Peso atual',  value: latestRec?.weight_kg != null ? `${latestRec.weight_kg} kg` : '—', delta: weightDelta, unit: 'kg', lowerIsBetter: true },
            { label: 'Gordura',     value: latestRec?.body_fat_pct != null ? `${latestRec.body_fat_pct}%` : '—', delta: fatDelta, unit: '%', lowerIsBetter: true },
            { label: 'Massa Magra', value: latestRec?.muscle_mass_kg != null ? `${latestRec.muscle_mass_kg} kg` : '—', delta: muscleDelta, unit: 'kg', lowerIsBetter: false },
            { label: 'Consultas',   value: String((consultations ?? []).length), delta: null, unit: '', lowerIsBetter: false },
          ].map(kpi => {
            const hasGoodDelta = kpi.delta != null
              ? (kpi.lowerIsBetter ? kpi.delta < 0 : kpi.delta > 0)
              : false
            const deltaColor = kpi.delta != null ? (hasGoodDelta ? '#4ade80' : '#f87171') : '#9ca3af'
            return (
              <div key={kpi.label} className="rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-2xl font-black text-white">{kpi.value}</div>
                <div className="text-[10px] uppercase tracking-wide mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{kpi.label}</div>
                {kpi.delta != null && (
                  <div className="text-xs font-bold mt-1" style={{ color: deltaColor }}>
                    {kpi.delta > 0 ? '+' : ''}{kpi.delta}{kpi.unit}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Weight chart */}
        {weightChart.values.filter(Boolean).length >= 2 && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <LineChart data={weightChart} color="#3B82F6" unit=" kg" label="Peso" />
          </div>
        )}

        {/* Fat + Muscle side by side */}
        {(fatChart.values.filter(Boolean).length >= 2 || muscleChart.values.filter(Boolean).length >= 2) && (
          <div className="grid grid-cols-2 gap-4">
            {fatChart.values.filter(Boolean).length >= 2 && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <LineChart data={fatChart} color="#F87171" unit="%" label="Gordura Corporal" />
              </div>
            )}
            {muscleChart.values.filter(Boolean).length >= 2 && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <LineChart data={muscleChart} color="#34D399" unit=" kg" label="Massa Magra" />
              </div>
            )}
          </div>
        )}

        {/* Circumferences */}
        {(waistChart.values.filter(Boolean).length >= 2 || hipChart.values.filter(Boolean).length >= 2) && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Circunferências
            </div>
            <div className="grid grid-cols-2 gap-6">
              {waistChart.values.filter(Boolean).length >= 2 && (
                <LineChart data={waistChart} color="#FBBF24" unit=" cm" label="Cintura" />
              )}
              {hipChart.values.filter(Boolean).length >= 2 && (
                <LineChart data={hipChart} color="#C4B5FD" unit=" cm" label="Quadril" />
              )}
              {armChart.values.filter(Boolean).length >= 2 && (
                <LineChart data={armChart} color="#6EE7B7" unit=" cm" label="Braço" />
              )}
            </div>
          </div>
        )}

        {/* Adherence chart */}
        {adherenceChart.values.filter(Boolean).length >= 2 && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <LineChart data={adherenceChart} color="#A78BFA" unit="%" label="Aderência ao Plano (%)" />
          </div>
        )}

        {/* Diary heatmap */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <DiaryHeatmap entries={diaryDays} />
          {avgKcal && (
            <div className="mt-3 pt-3 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              Média de calorias nos {diaryCount} dias registrados: <strong className="text-white">{avgKcal} kcal</strong>
            </div>
          )}
        </div>

        {/* Goals progress */}
        {goals && goals.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Metas
            </div>
            <div className="space-y-4">
              {goals.map(g => (
                <GoalBar key={g.id}
                  label={g.label}
                  current={g.current_value}
                  start={g.start_value}
                  target={g.target_value}
                  unit={g.unit ?? ''}
                  achieved={g.achieved}
                />
              ))}
            </div>
          </div>
        )}

        {/* No data state */}
        {recs.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📈</div>
            <div className="font-bold text-white">Nenhuma medição registrada ainda</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Registre avaliações físicas para visualizar a evolução.
            </div>
            <Link href={`/pro/pacientes/${id}/medidas`}
              className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.35)' }}>
              → Registrar Medidas
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
