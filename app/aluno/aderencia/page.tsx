'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

type AdhStats = {
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

function RadialProgress({ pct, size = 100, strokeW = 8, color = '#4ADE80', label }: {
  pct: number; size?: number; strokeW?: number; color?: string; label?: string
}) {
  const r = (size - strokeW * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div className="text-center -mt-14">
        <div className="text-2xl font-black text-white">{pct}%</div>
        {label && <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>}
      </div>
    </div>
  )
}

function WeekCalendar({ daily }: { daily: DayData[] }) {
  const last21 = [...daily].slice(-21)
  const weeks: DayData[][] = []
  for (let i = 0; i < last21.length; i += 7) weeks.push(last21.slice(i, i + 7))

  return (
    <div className="space-y-2">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex gap-1.5">
          {week.map(d => {
            const color = !d.logged ? 'rgba(255,255,255,0.04)'
              : d.kcalPct == null ? 'rgba(37,99,235,0.55)'
              : d.kcalPct >= 90 && d.kcalPct <= 110 ? 'rgba(74,222,128,0.7)'
              : d.kcalPct > 110 ? 'rgba(248,113,113,0.65)'
              : 'rgba(252,211,77,0.55)'
            const dayNum = new Date(d.date + 'T12:00').getDate()
            return (
              <div key={d.date} className="flex-1 rounded-lg aspect-square flex flex-col items-center justify-center"
                style={{ background: color }}>
                <span className="text-[11px] font-black" style={{ color: d.logged ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.2)' }}>{dayNum}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function AlunoAderenciaPage() {
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [daily, setDaily] = useState<DayData[]>([])
  const [targets, setTargets] = useState<{ kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }>({ kcal: null, protein: null, carbs: null, fat: null })
  const [stats, setStats] = useState<AdhStats | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    async function loadPatient() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (patient) setPatientId(patient.id)
    }
    loadPatient()
  }, [])

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    fetch(`/api/adherence?patient_id=${patientId}&days=${days}`)
      .then(r => r.json())
      .then(data => {
        setDaily(data.daily ?? [])
        setTargets(data.targets ?? {})
        setStats(data.summary ?? null)

        // Calculate streak (consecutive logged days from today backwards)
        const sorted = [...(data.daily ?? [])].sort((a: DayData, b: DayData) => b.date.localeCompare(a.date))
        let s = 0
        for (const d of sorted) {
          if (d.logged) s++
          else break
        }
        setStreak(s)
        setLoading(false)
      })
  }, [patientId, days])

  const motivationEmoji = stats
    ? stats.complianceRate >= 80 ? '🔥'
    : stats.complianceRate >= 60 ? '💪'
    : stats.complianceRate >= 40 ? '📈'
    : '🌱'
    : '📊'

  const motivationText = stats
    ? stats.complianceRate >= 80 ? 'Excelente consistência!'
    : stats.complianceRate >= 60 ? 'Boa evolução!'
    : stats.complianceRate >= 40 ? 'Continue progredindo!'
    : 'Foque na consistência!'
    : ''

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 py-4 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}>
        <Link href="/aluno" className="text-2xl">←</Link>
        <div>
          <h1 className="text-base font-black text-white leading-none">Minha Aderência</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Registros ao plano alimentar</p>
        </div>
        <div className="ml-auto flex gap-1.5">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
              style={{
                background: days === d ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                color: days === d ? '#fff' : 'rgba(255,255,255,0.4)',
              }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-5 max-w-lg mx-auto space-y-5">
        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <div className="text-4xl mb-3">📊</div>
            <div>Carregando...</div>
          </div>
        ) : !stats ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <div className="text-white font-bold mb-2">Nenhum dado disponível</div>
            <div className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Registre refeições no diário para ver suas estatísticas aqui
            </div>
            <Link href="/aluno/diario" className="px-5 py-2.5 rounded-xl text-sm font-bold text-white inline-block"
              style={{ background: 'var(--dark-accent)' }}>
              Ir para o Diário
            </Link>
          </div>
        ) : (
          <>
            {/* Hero card */}
            <div className="rounded-2xl p-5 text-center relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.05) 100%)', border: '1px solid rgba(37,99,235,0.2)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />
              <div className="text-3xl mb-1">{motivationEmoji}</div>
              <div className="text-xl font-black text-white mb-0.5">{motivationText}</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {stats.loggedDays} de {stats.totalDays} dias registrados
              </div>
              {streak > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(252,211,77,0.1)', border: '1px solid rgba(252,211,77,0.2)' }}>
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold" style={{ color: '#FCD34D' }}>Sequência de {streak} dia{streak !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Radial progress */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="text-xs font-bold tracking-[2px] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Taxa de Registros
              </div>
              <div className="flex items-center justify-around">
                <RadialProgress
                  pct={stats.complianceRate}
                  size={110}
                  strokeW={9}
                  color={stats.complianceRate >= 80 ? '#4ADE80' : stats.complianceRate >= 60 ? '#FCD34D' : '#F87171'}
                  label="registros"
                />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4ADE80' }} />
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Na meta</div>
                    <div className="text-sm font-bold text-white ml-auto">{stats.inRangeDays}d</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F87171' }} />
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Acima</div>
                    <div className="text-sm font-bold text-white ml-auto">{stats.aboveDays}d</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FCD34D' }} />
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Abaixo</div>
                    <div className="text-sm font-bold text-white ml-auto">{stats.belowDays}d</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Sem registro</div>
                    <div className="text-sm font-bold text-white ml-auto">{stats.totalDays - stats.loggedDays}d</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Average kcal */}
            {stats.avgKcal && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                <div className="text-xs font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Média diária (dias registrados)
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-black text-white">{stats.avgKcal}</span>
                  <span className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>kcal</span>
                  {targets.kcal && (
                    <span className="text-sm ml-2 font-semibold" style={{
                      color: Math.abs(stats.avgKcal - targets.kcal) <= targets.kcal * 0.1 ? '#4ADE80'
                        : stats.avgKcal > targets.kcal ? '#F87171' : '#FCD34D'
                    }}>
                      {stats.avgKcal > targets.kcal ? `+${stats.avgKcal - targets.kcal}` : stats.avgKcal - targets.kcal} vs meta
                    </span>
                  )}
                </div>
                {targets.kcal && (
                  <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (stats.avgKcal / targets.kcal) * 100)}%`,
                        background: Math.abs(stats.avgKcal - targets.kcal) <= targets.kcal * 0.1 ? '#4ADE80'
                          : stats.avgKcal > targets.kcal ? '#F87171' : '#FCD34D' }} />
                  </div>
                )}
                {targets.kcal && <div className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Meta: {targets.kcal} kcal/dia</div>}

                {/* Macros */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label: 'Proteína', avg: stats.avgProtein, target: targets.protein, color: '#818CF8' },
                    { label: 'Carb.', avg: stats.avgCarbs, target: targets.carbs, color: '#FCD34D' },
                    { label: 'Gordura', avg: stats.avgFat, target: targets.fat, color: '#F97316' },
                  ].map(m => (
                    <div key={m.label} className="text-center">
                      <div className="text-lg font-black" style={{ color: m.color }}>{m.avg ?? '—'}</div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>g {m.label.toLowerCase()}</div>
                      {m.target && m.avg != null && (
                        <div className="text-[10px] mt-0.5 font-semibold" style={{ color: Math.abs(m.avg - m.target) <= m.target * 0.1 ? '#4ADE80' : '#FCD34D' }}>
                          {Math.round((m.avg / m.target) * 100)}% meta
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="text-xs font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Calendário (últimos {Math.min(21, days)} dias)
              </div>
              <WeekCalendar daily={daily} />
              <div className="flex items-center justify-center gap-4 mt-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(74,222,128,0.7)' }} /> Na meta
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(248,113,113,0.65)' }} /> Acima
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(252,211,77,0.55)' }} /> Abaixo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.04)' }} /> Não registrado
                </span>
              </div>
            </div>

            {/* CTA to diary */}
            <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
              <div className="text-sm font-semibold text-white mb-1">Lembre-se de registrar suas refeições</div>
              <div className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                O registro diário é fundamental para o acompanhamento do seu plano
              </div>
              <Link href="/aluno/diario" className="px-5 py-2.5 rounded-xl text-sm font-bold text-white inline-block"
                style={{ background: 'var(--dark-accent)' }}>
                📔 Registrar refeições
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
