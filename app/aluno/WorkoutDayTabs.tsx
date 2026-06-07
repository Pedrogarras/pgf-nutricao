'use client'
import { useState } from 'react'

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

export default function WorkoutDayTabs({ days, planTitle }: { days: WorkoutDay[]; planTitle?: string | null }) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (!days.length) return null

  const day = days[activeIdx]

  // Group muscles for summary
  const muscles = [...new Set(day.workout_exercises.map(we => we.exercise.muscle_group).filter(Boolean))]

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
        {days.map((d, i) => (
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
            {i === activeIdx && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ background: '#2563EB' }} />
            )}
          </button>
        ))}
      </div>

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
          {day.workout_exercises.map((we, i) => (
            <div key={we.id} className="px-4 py-3.5"
              style={{ borderBottom: i < day.workout_exercises.length - 1 ? '1px solid var(--dark-border)' : 'none' }}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: 'rgba(226,232,248,0.95)' }}>
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
                </div>
                {(we.sets || we.reps || we.rest_seconds) && (
                  <div className="text-right flex-shrink-0">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
