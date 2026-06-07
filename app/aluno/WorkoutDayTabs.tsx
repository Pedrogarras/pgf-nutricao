'use client'
import { useState, useEffect } from 'react'

type WorkoutExercise = {
  id: string
  sets: number | null
  reps: string | null
  rest_seconds: number | null
  notes: string | null
  sort_order: number
  exercise: {
    name: string
    muscle_group: string | null
    video_url: string | null
    description: string | null
  }
}

type WorkoutDay = {
  id: string
  name: string
  sort_order: number
  workout_exercises: WorkoutExercise[]
}

// Returns hh:mm:ss or mm:ss from seconds
function fmtTimer(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function WorkoutDayTabs({ days, planTitle }: { days: WorkoutDay[]; planTitle?: string | null }) {
  const [activeIdx, setActiveIdx] = useState(0)
  // exerciseId → completed set count
  const [completedSets, setCompletedSets] = useState<Record<string, number>>({})
  // Rest timer state
  const [restTimer, setRestTimer] = useState<{ seconds: number; active: boolean; exerciseId: string | null }>({ seconds: 0, active: false, exerciseId: null })

  // Reset completion when day changes
  useEffect(() => {
    setCompletedSets({})
    setRestTimer({ seconds: 0, active: false, exerciseId: null })
  }, [activeIdx])

  // Countdown timer
  useEffect(() => {
    if (!restTimer.active || restTimer.seconds <= 0) return
    const t = setTimeout(() => {
      setRestTimer(prev => {
        if (prev.seconds <= 1) return { ...prev, seconds: 0, active: false }
        return { ...prev, seconds: prev.seconds - 1 }
      })
    }, 1000)
    return () => clearTimeout(t)
  }, [restTimer.active, restTimer.seconds])

  if (!days.length) return null

  const day = days[activeIdx]
  const muscles = [...new Set(day.workout_exercises.map(we => we.exercise.muscle_group).filter(Boolean))]

  function completeSet(we: WorkoutExercise) {
    const totalSets = we.sets ?? 1
    const done = completedSets[we.id] ?? 0
    if (done >= totalSets) {
      // Undo last set
      setCompletedSets(prev => ({ ...prev, [we.id]: Math.max(0, done - 1) }))
      setRestTimer({ seconds: 0, active: false, exerciseId: null })
    } else {
      const next = done + 1
      setCompletedSets(prev => ({ ...prev, [we.id]: next }))
      // Start rest timer if set (and not last set)
      if (we.rest_seconds && next < totalSets) {
        setRestTimer({ seconds: we.rest_seconds, active: true, exerciseId: we.id })
      } else {
        setRestTimer({ seconds: 0, active: false, exerciseId: null })
      }
    }
  }

  // Calculate day completion
  const totalSetsForDay = day.workout_exercises.reduce((s, we) => s + (we.sets ?? 1), 0)
  const completedSetsForDay = day.workout_exercises.reduce((s, we) => s + Math.min(we.sets ?? 1, completedSets[we.id] ?? 0), 0)
  const dayPct = totalSetsForDay > 0 ? Math.round((completedSetsForDay / totalSetsForDay) * 100) : 0
  const dayComplete = completedSetsForDay >= totalSetsForDay && totalSetsForDay > 0

  return (
    <div className="rounded-xl overflow-hidden shadow-md" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
      {/* Plan title */}
      {planTitle && (
        <div className="px-4 py-2 text-[10px] font-bold tracking-[2px] uppercase" style={{ background: 'rgba(90,111,204,0.08)', color: '#9BAAE6', borderBottom: '1px solid var(--dark-border)' }}>
          {planTitle}
        </div>
      )}

      {/* Day tabs */}
      <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid var(--dark-border)' }}>
        {days.map((d, i) => {
          // Check completion for this day (only show for active day)
          const dayDoneExs = i === activeIdx ? day.workout_exercises.filter(we => (completedSets[we.id] ?? 0) >= (we.sets ?? 1)).length : 0
          const dayTotalExs = i === activeIdx ? day.workout_exercises.length : 0
          return (
            <button
              key={d.id}
              onClick={() => setActiveIdx(i)}
              className="flex-shrink-0 px-4 py-3 text-xs font-bold transition-all relative"
              style={i === activeIdx ? {
                color: '#93C5FD',
                background: 'rgba(37,99,235,0.12)',
              } : {
                color: 'rgba(197,205,240,0.4)',
                background: 'transparent',
              }}
            >
              {d.name}
              {i === activeIdx && dayDoneExs > 0 && (
                <span className="ml-1.5 text-[9px] font-black" style={{ color: dayDoneExs === dayTotalExs ? '#4ade80' : '#fcd34d' }}>
                  {dayDoneExs}/{dayTotalExs}
                </span>
              )}
              {i === activeIdx && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ background: '#2563EB' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Progress bar (only when started) */}
      {completedSetsForDay > 0 && (
        <div className="px-4 py-2.5" style={{ background: 'rgba(37,99,235,0.04)', borderBottom: '1px solid rgba(37,99,235,0.1)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold" style={{ color: dayComplete ? '#4ade80' : '#93c5fd' }}>
              {dayComplete ? '🏁 Treino concluído! Ótimo trabalho!' : `${dayPct}% concluído · ${completedSetsForDay}/${totalSetsForDay} séries`}
            </span>
            <button
              onClick={() => setCompletedSets({})}
              className="text-[9px]"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              Resetar
            </button>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{
              width: `${dayPct}%`,
              background: dayComplete ? 'linear-gradient(90deg, #22c55e, #4ade80)' : 'linear-gradient(90deg, #2563EB, #60a5fa)',
            }} />
          </div>
        </div>
      )}

      {/* Muscle groups bar */}
      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(37,99,235,0.1)', background: 'rgba(37,99,235,0.05)' }}>
          {muscles.map(m => (
            <span key={m} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(90,111,204,0.2)', color: '#9BAAE6' }}>
              {m}
            </span>
          ))}
          <span className="text-[10px] ml-auto" style={{ color: 'rgba(197,205,240,0.35)' }}>
            {day.workout_exercises.length} exercício{day.workout_exercises.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Exercises */}
      {day.workout_exercises.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs" style={{ color: 'rgba(197,205,240,0.35)' }}>
          Nenhum exercício neste dia.
        </div>
      ) : (
        <div>
          {day.workout_exercises.map((we, i) => {
            const totalSets = we.sets ?? 1
            const done = completedSets[we.id] ?? 0
            const isComplete = done >= totalSets
            const isResting = restTimer.active && restTimer.exerciseId === we.id

            return (
              <div key={we.id} className="px-4 py-3.5 transition-colors"
                style={{
                  borderBottom: i < day.workout_exercises.length - 1 ? '1px solid var(--dark-border)' : 'none',
                  background: isComplete ? 'rgba(34,197,94,0.05)' : 'transparent',
                }}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isComplete ? 'rgba(34,197,94,0.25)' : 'rgba(37,99,235,0.2)',
                          color: isComplete ? '#4ade80' : '#93C5FD',
                        }}>
                        {isComplete ? '✓' : i + 1}
                      </span>
                      <span className="text-sm font-semibold" style={{
                        color: isComplete ? 'rgba(74,222,128,0.8)' : 'rgba(226,232,248,0.95)',
                        textDecoration: isComplete ? 'line-through' : 'none',
                      }}>
                        {we.exercise.name}
                      </span>
                    </div>
                    {we.exercise.muscle_group && (
                      <div className="text-xs mt-0.5 ml-7" style={{ color: '#9BAAE6' }}>
                        {we.exercise.muscle_group}
                      </div>
                    )}
                    {we.notes && (
                      <div className="text-xs mt-1 ml-7 italic" style={{ color: 'rgba(197,205,240,0.4)' }}>
                        {we.notes}
                      </div>
                    )}
                    {we.exercise.video_url && (
                      <a href={we.exercise.video_url} target="_blank" rel="noopener noreferrer"
                        className="mt-1.5 ml-7 inline-flex items-center gap-1 text-xs transition-colors"
                        style={{ color: '#9BAAE6' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Ver vídeo
                      </a>
                    )}

                    {/* Rest timer */}
                    {isResting && (
                      <div className="mt-2 ml-7 flex items-center gap-2">
                        <div className="text-xs font-bold px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(234,179,8,0.15)', color: '#fcd34d', border: '1px solid rgba(234,179,8,0.25)' }}>
                          ⏱ Descanso: {fmtTimer(restTimer.seconds)}
                        </div>
                        <button
                          onClick={() => setRestTimer({ seconds: 0, active: false, exerciseId: null })}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}
                        >
                          Pular
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right side: sets info + complete button */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {(we.sets || we.reps || we.rest_seconds) && (
                      <div className="text-right">
                        {(we.sets || we.reps) && (
                          <div className="text-sm font-black" style={{ color: '#93C5FD' }}>
                            {we.sets ? `${we.sets} × ` : ''}{we.reps ?? ''}
                          </div>
                        )}
                        {we.rest_seconds && (
                          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(197,205,240,0.4)' }}>
                            {we.rest_seconds >= 60 ? `${Math.floor(we.rest_seconds / 60)}min${we.rest_seconds % 60 ? ` ${we.rest_seconds % 60}s` : ''}` : `${we.rest_seconds}s`} desc.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Set completion dots + button */}
                    <div className="flex items-center gap-1.5">
                      {/* Dots showing set completion */}
                      {totalSets > 1 && totalSets <= 8 && (
                        <div className="flex gap-0.5">
                          {Array.from({ length: totalSets }, (_, si) => (
                            <div key={si} className="w-2 h-2 rounded-full transition-all"
                              style={{ background: si < done ? '#4ade80' : 'rgba(255,255,255,0.1)' }} />
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => completeSet(we)}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
                        style={{
                          background: isComplete ? 'rgba(34,197,94,0.15)' : 'rgba(37,99,235,0.2)',
                          color: isComplete ? '#4ade80' : '#93c5fd',
                          border: `1px solid ${isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(37,99,235,0.3)'}`,
                          minWidth: '2.5rem',
                        }}
                      >
                        {isComplete ? '✓' : totalSets > 1 ? `${done}/${totalSets}` : '+'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
