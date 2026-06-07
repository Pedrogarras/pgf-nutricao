'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ─── types ──────────────────────────────────────────────────────────────── */
interface AchievementDef {
  id: string
  icon: string
  name: string
  desc: string
  xp: number
  category: 'diario' | 'checkin' | 'metas' | 'programa' | 'nutricao'
  check: (data: PlayerData) => { earned: boolean; earnedAt?: string; progress?: number; max?: number }
}

interface PlayerData {
  firstDiaryAt: string | null
  diaryCount: number
  longestStreak: number
  currentStreak: number
  firstCheckInAt: string | null
  checkInCount: number
  goalsAchieved: number
  firstGoalAt: string | null
  daysInProgram: number
  patientCreatedAt: string
  photosCount: number
  hasActivePlan: boolean
  waterDays: number
  diaryDates: string[]
  achievedGoalDates: string[]
}

/* ─── Achievement definitions ────────────────────────────────────────────── */
const ACHIEVEMENTS: AchievementDef[] = [
  // Diário
  {
    id: 'first_diary', icon: '📔', name: 'Primeiro Registro', category: 'diario', xp: 50,
    desc: 'Registrou sua primeira refeição no diário',
    check: (d) => ({ earned: !!d.firstDiaryAt, earnedAt: d.firstDiaryAt ?? undefined }),
  },
  {
    id: 'streak_3', icon: '🔥', name: 'Sequência de 3 dias', category: 'diario', xp: 75,
    desc: 'Registrou o diário por 3 dias seguidos',
    check: (d) => ({ earned: d.longestStreak >= 3, progress: Math.min(d.longestStreak, 3), max: 3 }),
  },
  {
    id: 'streak_7', icon: '🔥', name: 'Semana Completa', category: 'diario', xp: 150,
    desc: 'Registrou o diário por 7 dias consecutivos',
    check: (d) => ({ earned: d.longestStreak >= 7, progress: Math.min(d.longestStreak, 7), max: 7 }),
  },
  {
    id: 'streak_14', icon: '🔥', name: '2 Semanas de Fogo', category: 'diario', xp: 300,
    desc: 'Registrou o diário por 14 dias consecutivos',
    check: (d) => ({ earned: d.longestStreak >= 14, progress: Math.min(d.longestStreak, 14), max: 14 }),
  },
  {
    id: 'streak_30', icon: '🏆', name: 'Mês Lendário', category: 'diario', xp: 750,
    desc: 'Registrou o diário por 30 dias consecutivos',
    check: (d) => ({ earned: d.longestStreak >= 30, progress: Math.min(d.longestStreak, 30), max: 30 }),
  },
  {
    id: 'diary_10', icon: '📖', name: '10 Registros', category: 'diario', xp: 100,
    desc: 'Registrou o diário em 10 dias diferentes',
    check: (d) => ({ earned: d.diaryCount >= 10, progress: Math.min(d.diaryCount, 10), max: 10 }),
  },
  {
    id: 'diary_30', icon: '📚', name: '30 Registros', category: 'diario', xp: 200,
    desc: 'Registrou o diário em 30 dias diferentes',
    check: (d) => ({ earned: d.diaryCount >= 30, progress: Math.min(d.diaryCount, 30), max: 30 }),
  },
  {
    id: 'diary_100', icon: '🌟', name: 'Centenário do Diário', category: 'diario', xp: 500,
    desc: 'Registrou o diário em 100 dias diferentes',
    check: (d) => ({ earned: d.diaryCount >= 100, progress: Math.min(d.diaryCount, 100), max: 100 }),
  },
  // Check-in
  {
    id: 'first_checkin', icon: '⚖️', name: 'Primeiro Check-in', category: 'checkin', xp: 50,
    desc: 'Realizou seu primeiro check-in de peso e medidas',
    check: (d) => ({ earned: !!d.firstCheckInAt, earnedAt: d.firstCheckInAt ?? undefined }),
  },
  {
    id: 'checkin_5', icon: '📏', name: '5 Check-ins', category: 'checkin', xp: 100,
    desc: 'Realizou 5 check-ins de medidas',
    check: (d) => ({ earned: d.checkInCount >= 5, progress: Math.min(d.checkInCount, 5), max: 5 }),
  },
  {
    id: 'checkin_10', icon: '📐', name: '10 Check-ins', category: 'checkin', xp: 200,
    desc: 'Realizou 10 check-ins de medidas',
    check: (d) => ({ earned: d.checkInCount >= 10, progress: Math.min(d.checkInCount, 10), max: 10 }),
  },
  {
    id: 'checkin_20', icon: '🎖️', name: '20 Check-ins', category: 'checkin', xp: 400,
    desc: 'Realizou 20 check-ins de medidas',
    check: (d) => ({ earned: d.checkInCount >= 20, progress: Math.min(d.checkInCount, 20), max: 20 }),
  },
  // Metas
  {
    id: 'first_goal', icon: '🎯', name: 'Primeira Meta', category: 'metas', xp: 200,
    desc: 'Alcançou a sua primeira meta',
    check: (d) => ({ earned: d.goalsAchieved >= 1, earnedAt: d.firstGoalAt ?? undefined }),
  },
  {
    id: 'goals_3', icon: '🎪', name: 'Caçador de Metas', category: 'metas', xp: 400,
    desc: 'Alcançou 3 metas no programa',
    check: (d) => ({ earned: d.goalsAchieved >= 3, progress: Math.min(d.goalsAchieved, 3), max: 3 }),
  },
  {
    id: 'goals_5', icon: '🏅', name: 'Colecionador', category: 'metas', xp: 750,
    desc: 'Alcançou 5 metas no programa',
    check: (d) => ({ earned: d.goalsAchieved >= 5, progress: Math.min(d.goalsAchieved, 5), max: 5 }),
  },
  // Programa
  {
    id: 'program_7', icon: '🌱', name: 'Primeira Semana', category: 'programa', xp: 50,
    desc: '7 dias no programa de nutrição',
    check: (d) => ({ earned: d.daysInProgram >= 7, progress: Math.min(d.daysInProgram, 7), max: 7 }),
  },
  {
    id: 'program_30', icon: '🗓️', name: 'Um Mês Dedicado', category: 'programa', xp: 100,
    desc: '1 mês no programa de nutrição',
    check: (d) => ({ earned: d.daysInProgram >= 30, progress: Math.min(d.daysInProgram, 30), max: 30 }),
  },
  {
    id: 'program_90', icon: '🚀', name: '3 Meses de Jornada', category: 'programa', xp: 300,
    desc: '3 meses no programa de nutrição',
    check: (d) => ({ earned: d.daysInProgram >= 90, progress: Math.min(d.daysInProgram, 90), max: 90 }),
  },
  {
    id: 'program_180', icon: '⭐', name: '6 Meses de Transformação', category: 'programa', xp: 600,
    desc: '6 meses no programa de nutrição',
    check: (d) => ({ earned: d.daysInProgram >= 180, progress: Math.min(d.daysInProgram, 180), max: 180 }),
  },
  {
    id: 'program_365', icon: '👑', name: 'Um Ano Incrível', category: 'programa', xp: 1500,
    desc: 'Um ano completo no programa de nutrição',
    check: (d) => ({ earned: d.daysInProgram >= 365, progress: Math.min(d.daysInProgram, 365), max: 365 }),
  },
  // Nutrição / extras
  {
    id: 'active_plan', icon: '🥗', name: 'Plano Ativo', category: 'nutricao', xp: 50,
    desc: 'Tem um plano alimentar ativo e publicado',
    check: (d) => ({ earned: d.hasActivePlan }),
  },
  {
    id: 'first_photo', icon: '📸', name: 'Registro Fotográfico', category: 'nutricao', xp: 100,
    desc: 'Adicionou sua primeira foto de progresso',
    check: (d) => ({ earned: d.photosCount >= 1, progress: Math.min(d.photosCount, 1), max: 1 }),
  },
  {
    id: 'photos_5', icon: '🖼️', name: 'Álbum de Progresso', category: 'nutricao', xp: 250,
    desc: 'Tem 5 fotos de progresso no histórico',
    check: (d) => ({ earned: d.photosCount >= 5, progress: Math.min(d.photosCount, 5), max: 5 }),
  },
]

/* ─── Level thresholds ───────────────────────────────────────────────────── */
const LEVELS = [
  { level: 1, minXp: 0,    title: 'Iniciante',      color: '#6B7280' },
  { level: 2, minXp: 100,  title: 'Comprometido',   color: '#3B82F6' },
  { level: 3, minXp: 300,  title: 'Determinado',    color: '#8B5CF6' },
  { level: 4, minXp: 600,  title: 'Consistente',    color: '#10B981' },
  { level: 5, minXp: 1000, title: 'Dedicado',       color: '#F59E0B' },
  { level: 6, minXp: 1700, title: 'Avançado',       color: '#EF4444' },
  { level: 7, minXp: 2700, title: 'Elite',          color: '#EC4899' },
  { level: 8, minXp: 4000, title: 'Lendário',       color: '#F97316' },
]

function getLevel(xp: number) {
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l
    else break
  }
  const idx = LEVELS.indexOf(current)
  const next = LEVELS[idx + 1] ?? null
  const progress = next ? ((xp - current.minXp) / (next.minXp - current.minXp)) * 100 : 100
  return { ...current, next, progress, idx }
}

const CAT_LABELS: Record<string, string> = {
  diario: '📔 Diário',
  checkin: '⚖️ Check-in',
  metas: '🎯 Metas',
  programa: '📅 Programa',
  nutricao: '🥗 Nutrição',
}

/* ─── Compute streak from diary dates ───────────────────────────────────── */
function computeStreaks(dates: string[]): { longest: number; current: number } {
  if (dates.length === 0) return { longest: 0, current: 0 }
  const sorted = [...new Set(dates)].sort()
  let longest = 1, current = 1
  // Current streak: count backwards from today
  const todayStr = new Date().toISOString().split('T')[0]
  const dateSet = new Set(sorted)
  let cur = 0
  for (let i = 0; i <= 365; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    if (dateSet.has(d)) cur++
    else if (i > 0) break // allow today to be missing (might not have logged yet)
  }
  // If today isn't logged, check from yesterday
  if (!dateSet.has(todayStr)) {
    cur = 0
    for (let i = 1; i <= 365; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
      if (dateSet.has(d)) cur++
      else break
    }
  }
  current = cur
  // Longest streak from sorted array
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00')
    const curr = new Date(sorted[i] + 'T12:00')
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    if (diff === 1) { run++; if (run > longest) longest = run }
    else run = 1
  }
  return { longest: Math.max(longest, current), current }
}

/* ─── Badge card component ───────────────────────────────────────────────── */
function BadgeCard({
  def, earned, earnedAt, progress, max,
}: {
  def: AchievementDef
  earned: boolean
  earnedAt?: string
  progress?: number
  max?: number
}) {
  const pct = progress !== undefined && max ? (progress / max) * 100 : 0

  return (
    <div
      className="rounded-2xl p-4 flex gap-3 items-start transition-all"
      style={earned ? {
        background: 'rgba(37,99,235,0.1)',
        border: '1px solid rgba(37,99,235,0.3)',
      } : {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        opacity: 0.65,
      }}
    >
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={earned ? {
          background: 'rgba(37,99,235,0.2)',
          filter: 'none',
        } : {
          background: 'rgba(255,255,255,0.05)',
          filter: 'grayscale(1)',
        }}
      >
        {def.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-bold leading-tight" style={{ color: earned ? 'white' : 'rgba(255,255,255,0.55)' }}>
              {def.name}
            </div>
            <div className="text-[11px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {def.desc}
            </div>
          </div>
          <div className="text-xs font-black flex-shrink-0 px-2 py-0.5 rounded-full"
            style={earned ? {
              background: 'rgba(74,222,128,0.15)',
              color: '#4ADE80',
            } : {
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.3)',
            }}>
            +{def.xp} XP
          </div>
        </div>

        {/* Progress bar */}
        {!earned && progress !== undefined && max && (
          <div className="mt-2">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%`, background: '#2563EB' }} />
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {progress} / {max}
            </div>
          </div>
        )}

        {/* Earned date */}
        {earned && earnedAt && (
          <div className="text-[10px] mt-1.5" style={{ color: 'rgba(74,222,128,0.7)' }}>
            ✓ {new Date(earnedAt + (earnedAt.includes('T') ? '' : 'T12:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        )}
        {earned && !earnedAt && (
          <div className="text-[10px] mt-1.5" style={{ color: 'rgba(74,222,128,0.7)' }}>✓ Conquistado</div>
        )}
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function ConquistasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: patient } = await supabase
      .from('patients')
      .select('id, created_at')
      .eq('auth_user_id', user.id)
      .single()
    if (!patient) { setLoading(false); return }

    const [
      { data: diaryDates },
      { data: checkIns },
      { data: goals },
      { data: photos },
      { data: plan },
    ] = await Promise.all([
      supabase.from('diary_entries')
        .select('logged_at')
        .eq('patient_id', patient.id)
        .order('logged_at', { ascending: true }),
      supabase.from('anthropometric_records')
        .select('measured_at')
        .eq('patient_id', patient.id)
        .order('measured_at', { ascending: true }),
      supabase.from('patient_goals')
        .select('achieved_at, achieved')
        .eq('patient_id', patient.id)
        .eq('achieved', true),
      supabase.from('progress_photos')
        .select('id')
        .eq('patient_id', patient.id),
      supabase.from('diet_plans')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('active', true)
        .not('published_at', 'is', null)
        .limit(1),
    ])

    const dates = (diaryDates ?? []).map(d => (d.logged_at as string).split('T')[0])
    const uniqueDates = [...new Set(dates)]
    const { longest, current } = computeStreaks(uniqueDates)

    const achievedGoalDates = (goals ?? [])
      .filter(g => g.achieved_at)
      .map(g => g.achieved_at as string)
      .sort()

    const createdAt = patient.created_at as string
    const daysInProgram = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)

    setPlayerData({
      firstDiaryAt: diaryDates && diaryDates.length > 0 ? (diaryDates[0].logged_at as string) : null,
      diaryCount: uniqueDates.length,
      longestStreak: longest,
      currentStreak: current,
      firstCheckInAt: checkIns && checkIns.length > 0 ? checkIns[0].measured_at : null,
      checkInCount: (checkIns ?? []).length,
      goalsAchieved: (goals ?? []).length,
      firstGoalAt: achievedGoalDates[0] ?? null,
      daysInProgram,
      patientCreatedAt: createdAt,
      photosCount: (photos ?? []).length,
      hasActivePlan: (plan ?? []).length > 0,
      waterDays: 0,
      diaryDates: uniqueDates,
      achievedGoalDates,
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dark-bg)' }}>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando conquistas...</div>
      </div>
    )
  }
  if (!playerData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dark-bg)' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🏅</div>
          <div className="text-white font-bold">Perfil não encontrado</div>
        </div>
      </div>
    )
  }

  // Compute achievements
  const computed = ACHIEVEMENTS.map(def => {
    const result = def.check(playerData)
    return { def, ...result }
  })

  const earnedList = computed.filter(a => a.earned)
  const totalXP = earnedList.reduce((s, a) => s + a.def.xp, 0)
  const maxXP = ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0)
  const level = getLevel(totalXP)

  // Categories
  const cats = ['all', ...Object.keys(CAT_LABELS)]
  const displayed = activeCategory === 'all'
    ? computed
    : computed.filter(a => a.def.category === activeCategory)

  // Sort: earned first (newest), then in-progress, then locked
  displayed.sort((a, b) => {
    if (a.earned && !b.earned) return -1
    if (!a.earned && b.earned) return 1
    if (!a.earned && !b.earned) {
      const aP = a.progress ?? 0
      const bP = b.progress ?? 0
      return bP - aP
    }
    return 0
  })

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">🏅 Conquistas</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {earnedList.length} de {ACHIEVEMENTS.length} desbloqueadas
          </p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">

        {/* ── Level card ────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5"
          style={{
            background: `linear-gradient(135deg, rgba(37,99,235,0.15), rgba(139,92,246,0.1))`,
            border: '1px solid rgba(37,99,235,0.3)',
          }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl font-black"
              style={{ background: level.color + '22', border: `2px solid ${level.color}44`, color: level.color }}>
              {level.level}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-widest mb-0.5"
                style={{ color: level.color }}>
                Nível {level.level}
              </div>
              <div className="text-xl font-black text-white leading-none">{level.title}</div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {totalXP} XP de {level.next ? `${level.next.minXp} para o nível ${level.level + 1}` : `${maxXP} (máximo)`}
              </div>
            </div>
          </div>
          {/* Level progress bar */}
          {level.next && (
            <div className="mt-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${level.progress}%`, background: `linear-gradient(90deg, ${level.color}, ${level.next.color})` }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <span>{level.minXp} XP</span>
                <span>{level.next.title} em {level.next.minXp - totalXP} XP</span>
                <span>{level.next.minXp} XP</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Stats strip ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-black text-white">{playerData.currentStreak}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {playerData.currentStreak === 1 ? '🔥 dia atual' : '🔥 dias seguidos'}
            </div>
          </div>
          <div className="rounded-2xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-black" style={{ color: '#FBBF24' }}>{playerData.longestStreak}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>melhor sequência</div>
          </div>
          <div className="rounded-2xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl font-black" style={{ color: '#A78BFA' }}>{playerData.daysInProgram}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>dias no programa</div>
          </div>
        </div>

        {/* ── Category filter ───────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cats.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={activeCategory === cat ? {
                background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.35)',
              } : {
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
              {cat === 'all' ? `Todas (${earnedList.length}/${ACHIEVEMENTS.length})` : CAT_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* ── Achievement grid ──────────────────────────────────────── */}
        <div className="space-y-3">
          {displayed.map(a => (
            <BadgeCard
              key={a.def.id}
              def={a.def}
              earned={a.earned}
              earnedAt={a.earnedAt}
              progress={a.progress}
              max={a.max}
            />
          ))}
        </div>

        {/* ── XP total summary ──────────────────────────────────────── */}
        <div className="rounded-2xl p-4 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-2xl font-black text-white">{totalXP} <span className="text-base font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>XP</span></div>
          <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {earnedList.length} conquistas · {maxXP - totalXP} XP restantes
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(totalXP / maxXP) * 100}%`, background: 'linear-gradient(90deg, #2563EB, #A78BFA, #F59E0B)' }} />
          </div>
        </div>

      </div>
    </div>
  )
}
