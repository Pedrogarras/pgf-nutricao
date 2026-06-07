'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Goal {
  id: string
  label: string
  metric: string
  unit: string
  target_value: number
  current_value: number | null
  start_value: number | null
  direction: 'decrease' | 'increase' | 'maintain'
  deadline: string | null
  achieved: boolean
  achieved_at: string | null
  notes: string | null
  created_at: string
}

const METRIC_ICONS: Record<string, string> = {
  peso: '⚖️',
  gordura: '📊',
  massa_muscular: '💪',
  imc: '📏',
  cintura: '📐',
  quadril: '📐',
  custom: '🎯',
}

const DIRECTION_LABELS: Record<string, { label: string; color: string }> = {
  decrease: { label: 'Reduzir', color: '#22c55e' },
  increase: { label: 'Aumentar', color: '#3b82f6' },
  maintain: { label: 'Manter', color: '#f59e0b' },
}

function GoalCard({ goal }: { goal: Goal }) {
  const start = goal.start_value
  const current = goal.current_value
  const target = goal.target_value

  const totalDelta = Math.abs((target ?? 0) - (start ?? target ?? 0))
  const progressDelta = current != null && start != null ? Math.abs(current - start) : 0
  const pct = totalDelta > 0 ? Math.min(100, Math.round((progressDelta / totalDelta) * 100)) : current === target ? 100 : 0

  const remaining = current != null ? Math.abs(target - current).toFixed(1) : null
  const dirInfo = DIRECTION_LABELS[goal.direction] ?? { label: goal.direction, color: '#9ca3af' }
  const isAchieved = goal.achieved || pct >= 100

  const daysLeft = goal.deadline
    ? Math.ceil((new Date(goal.deadline + 'T12:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{
        background: isAchieved ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.04)',
        border: isAchieved ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: isAchieved ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)' }}
          >
            {isAchieved ? '🏆' : (METRIC_ICONS[goal.metric] ?? '🎯')}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{goal.label}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${dirInfo.color}22`, color: dirInfo.color }}
              >
                {dirInfo.label}
              </span>
              {isAchieved && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                  ✓ Conquistada!
                </span>
              )}
            </div>
          </div>
        </div>
        {!isAchieved && daysLeft !== null && (
          <div className="text-right">
            <div className={`text-xs font-bold ${daysLeft <= 7 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-white/40'}`}>
              {daysLeft > 0 ? `${daysLeft}d` : 'Vencida'}
            </div>
            <div className="text-[10px] text-white/25">prazo</div>
          </div>
        )}
      </div>

      {/* Values row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Início', value: start != null ? `${start}${goal.unit}` : '—', dim: true },
          { label: 'Atual', value: current != null ? `${current}${goal.unit}` : '—', dim: false },
          { label: 'Meta', value: `${target}${goal.unit}`, dim: true },
        ].map(v => (
          <div key={v.label} className="text-center rounded-xl py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className={`text-sm font-black ${v.dim ? 'text-white/40' : 'text-white'}`}>{v.value}</div>
            <div className="text-[10px] text-white/25 uppercase">{v.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-white/40">{pct}% concluído</span>
          {!isAchieved && remaining != null && (
            <span className="text-[11px] text-white/40">Faltam {remaining}{goal.unit}</span>
          )}
          {isAchieved && goal.achieved_at && (
            <span className="text-[11px] text-green-400/60">
              {new Date(goal.achieved_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: isAchieved
                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                : pct >= 70
                  ? 'linear-gradient(90deg, #2563EB, #22c55e)'
                  : 'linear-gradient(90deg, #2563EB, #60A5FA)',
            }}
          />
        </div>
      </div>

      {goal.notes && (
        <div className="mt-2 text-xs text-white/30 italic">{goal.notes}</div>
      )}
    </div>
  )
}

export default function AlunoMetasPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showAchieved, setShowAchieved] = useState(false)

  useEffect(() => {
    loadGoals()
  }, [])

  async function loadGoals() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (!patient) { setLoading(false); return }

      const { data } = await supabase
        .from('patient_goals')
        .select('*')
        .eq('patient_id', patient.id)
        .order('achieved')
        .order('created_at', { ascending: false })

      setGoals(data ?? [])
    } catch {
      // ignore
    }
    setLoading(false)
  }

  const activeGoals = goals.filter(g => !g.achieved)
  const achievedGoals = goals.filter(g => g.achieved)

  // Summary stats
  const totalGoals = goals.length
  const completedCount = achievedGoals.length
  const inProgressCount = activeGoals.length
  const avgProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => {
        const start = g.start_value
        const current = g.current_value
        const target = g.target_value
        const totalDelta = Math.abs((target ?? 0) - (start ?? target ?? 0))
        const progressDelta = current != null && start != null ? Math.abs(current - start) : 0
        return sum + (totalDelta > 0 ? Math.min(100, (progressDelta / totalDelta) * 100) : 0)
      }, 0) / activeGoals.length)
    : 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-6 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/aluno" className="text-pgf-400 hover:text-pgf-300 text-sm">← Início</Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">🎯 Minhas Metas</h1>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-4xl animate-pulse">🎯</div>
            <div className="text-white/40 text-sm">Carregando metas...</div>
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-6">
            <div className="text-5xl">🎯</div>
            <div className="text-white font-bold text-lg">Nenhuma meta definida</div>
            <p className="text-white/40 text-sm leading-relaxed">
              Seu nutricionista irá definir metas personalizadas para acompanhar sua evolução.
            </p>
            <Link href="/aluno" className="btn btn-primary mt-2">← Voltar ao início</Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Em andamento', value: inProgressCount, color: 'text-blue-400', bg: 'rgba(37,99,235,0.1)', border: 'rgba(37,99,235,0.2)' },
                { label: 'Conquistadas', value: completedCount, color: 'text-green-400', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' },
                { label: 'Progresso médio', value: `${avgProgress}%`, color: 'text-amber-400', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Active goals */}
            {activeGoals.length > 0 && (
              <>
                <div className="text-[10px] font-bold uppercase tracking-[2px] text-white/30 mb-3 px-1">
                  Em andamento ({inProgressCount})
                </div>
                <div className="space-y-3 mb-5">
                  {activeGoals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              </>
            )}

            {/* Achieved goals toggle */}
            {achievedGoals.length > 0 && (
              <>
                <button
                  onClick={() => setShowAchieved(!showAchieved)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3 transition-all"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-base">🏆</span>
                    <span className="text-sm font-semibold text-green-400">
                      Metas conquistadas ({completedCount})
                    </span>
                  </div>
                  <span className="text-white/30">{showAchieved ? '▾' : '▸'}</span>
                </button>

                {showAchieved && (
                  <div className="space-y-3 mb-5">
                    {achievedGoals.map(goal => (
                      <GoalCard key={goal.id} goal={goal} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Motivational footer */}
            <div
              className="rounded-2xl p-5 text-center mt-2 mb-6"
              style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}
            >
              <div className="text-2xl mb-2">
                {avgProgress >= 80 ? '🔥' : avgProgress >= 50 ? '💪' : avgProgress >= 25 ? '📈' : '🌱'}
              </div>
              <div className="text-sm font-semibold text-white mb-1">
                {avgProgress >= 80 ? 'Você está arrasando!' : avgProgress >= 50 ? 'Mais da metade do caminho!' : avgProgress >= 25 ? 'Continue assim!' : 'Cada passo conta!'}
              </div>
              <div className="text-xs text-white/40">
                {inProgressCount > 0
                  ? `${inProgressCount} meta${inProgressCount !== 1 ? 's' : ''} em progresso · acompanhe com seu nutricionista`
                  : `${completedCount} meta${completedCount !== 1 ? 's' : ''} conquistada${completedCount !== 1 ? 's' : ''}! 🎉`
                }
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
