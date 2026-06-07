'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

/* ─── Constants ─────────────────────────────────────────────────────────── */
const PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '45s', seconds: 45 },
  { label: '1min', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2min', seconds: 120 },
  { label: '3min', seconds: 180 },
]

/* ─── SVG Ring ──────────────────────────────────────────────────────────── */
function CountdownRing({
  progress, // 0..1, 1 = full (no time elapsed), 0 = done
  timeLeft,
  total,
  running,
}: {
  progress: number
  timeLeft: number
  total: number
  running: boolean
}) {
  const SIZE = 260
  const STROKE = 14
  const R = (SIZE - STROKE) / 2
  const CIRC = 2 * Math.PI * R
  const offset = CIRC * (1 - progress)

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const label = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}`

  const colour = progress > 0.5
    ? '#4ADE80'
    : progress > 0.25
      ? '#FBBF24'
      : '#F87171'

  return (
    <svg width={SIZE} height={SIZE} className="drop-shadow-xl">
      {/* Track */}
      <circle
        cx={SIZE / 2} cy={SIZE / 2} r={R}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE}
      />
      {/* Progress arc */}
      <circle
        cx={SIZE / 2} cy={SIZE / 2} r={R}
        fill="none"
        stroke={colour}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={{ transition: running ? 'stroke-dashoffset 1s linear, stroke 0.5s' : 'stroke 0.5s' }}
      />
      {/* Glow */}
      <circle
        cx={SIZE / 2} cy={SIZE / 2} r={R}
        fill="none"
        stroke={colour}
        strokeWidth={STROKE * 0.4}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={offset}
        strokeOpacity={0.25}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={{ filter: 'blur(4px)', transition: running ? 'stroke-dashoffset 1s linear, stroke 0.5s' : 'stroke 0.5s' }}
      />
      {/* Time label */}
      <text
        x={SIZE / 2} y={SIZE / 2 - 10}
        textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={timeLeft >= 60 ? 52 : 64} fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ letterSpacing: '-2px' }}
      >
        {label}
      </text>
      <text
        x={SIZE / 2} y={SIZE / 2 + 34}
        textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.3)" fontSize={14} fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {timeLeft === 0 ? '✅ Pronto!' : running ? 'descansando…' : 'pausado'}
      </text>
      {/* Total label */}
      <text
        x={SIZE / 2} y={SIZE / 2 + 58}
        textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.18)" fontSize={11}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {Math.floor(total / 60) > 0 ? `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` : `${total}s`} total
      </text>
    </svg>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function TimerPage() {
  const [total, setTotal] = useState(60)
  const [timeLeft, setTimeLeft] = useState(60)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [setCount, setSetCount] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            setDone(true)
            setSetCount(c => c + 1)
            playChime()
            vibrate()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current!)
  }, [running])

  function playChime() {
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const notes = [523.25, 659.25, 783.99] // C5 E5 G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        const startAt = ctx.currentTime + i * 0.18
        gain.gain.setValueAtTime(0, startAt)
        gain.gain.linearRampToValueAtTime(0.35, startAt + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.6)
        osc.start(startAt)
        osc.stop(startAt + 0.65)
      })
    } catch { /* ignore audio errors */ }
  }

  function vibrate() {
    try { navigator.vibrate?.([200, 100, 200, 100, 400]) } catch { /* ignore */ }
  }

  function handleStart() {
    if (done) {
      setTimeLeft(total)
      setDone(false)
    }
    setRunning(true)
  }

  function handlePause() {
    setRunning(false)
  }

  function handleReset() {
    clearInterval(intervalRef.current!)
    setRunning(false)
    setDone(false)
    setTimeLeft(total)
  }

  function selectPreset(seconds: number) {
    clearInterval(intervalRef.current!)
    setRunning(false)
    setDone(false)
    setTotal(seconds)
    setTimeLeft(seconds)
  }

  function adjust(delta: number) {
    const next = Math.max(5, total + delta)
    clearInterval(intervalRef.current!)
    setRunning(false)
    setDone(false)
    setTotal(next)
    setTimeLeft(next)
  }

  const handleCustom = useCallback(() => {
    const secs = parseInt(customInput, 10)
    if (!isNaN(secs) && secs > 0) {
      selectPreset(Math.max(5, Math.min(600, secs)))
      setShowCustom(false)
      setCustomInput('')
    }
  }, [customInput])

  const progress = total > 0 ? timeLeft / total : 0

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--dark-bg)' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <Link href="/aluno/treino" className="text-pgf-400 hover:text-pgf-300 text-sm">
          ← Treino
        </Link>
        <h1 className="text-sm font-bold text-white">⏱ Timer de Descanso</h1>
        {setCount > 0 ? (
          <div
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'rgba(74,222,128,0.15)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)' }}
          >
            {setCount} série{setCount !== 1 ? 's' : ''}
          </div>
        ) : (
          <div className="w-16" />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center px-4 pb-8 pt-6 max-w-sm mx-auto w-full">

        {/* Ring */}
        <div className="mb-6 relative">
          <CountdownRing progress={progress} timeLeft={timeLeft} total={total} running={running} />
          {done && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full animate-pulse pointer-events-none"
              style={{ background: 'rgba(74,222,128,0.06)' }}
            />
          )}
        </div>

        {/* Adjust buttons */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => adjust(-15)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid var(--dark-border)' }}
          >
            −15
          </button>
          <div
            className="text-center px-4 py-2 rounded-2xl cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--dark-border)' }}
            onClick={() => { setShowCustom(true) }}
          >
            <div className="text-[10px] text-gray-500 mb-0.5">TEMPO</div>
            <div className="text-sm font-black text-white">
              {Math.floor(total / 60) > 0
                ? `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
                : `${total}s`}
            </div>
          </div>
          <button
            onClick={() => adjust(+15)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid var(--dark-border)' }}
          >
            +15
          </button>
        </div>

        {/* Primary action */}
        <div className="flex gap-3 mb-6 w-full">
          {!running ? (
            <button
              onClick={handleStart}
              className="flex-1 py-4 rounded-2xl text-base font-black text-white transition-all active:scale-[0.97]"
              style={{
                background: done
                  ? 'linear-gradient(135deg, #34D399, #059669)'
                  : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                boxShadow: done ? '0 8px 24px rgba(52,211,153,0.3)' : '0 8px 24px rgba(37,99,235,0.4)',
              }}
            >
              {done ? '🔄 Nova série' : timeLeft === total ? '▶ Iniciar' : '▶ Continuar'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex-1 py-4 rounded-2xl text-base font-black text-white transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #FBBF24, #D97706)',
                boxShadow: '0 8px 24px rgba(251,191,36,0.3)',
              }}
            >
              ⏸ Pausar
            </button>
          )}
          <button
            onClick={handleReset}
            className="w-16 rounded-2xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid var(--dark-border)' }}
          >
            ↺
          </button>
        </div>

        {/* Presets */}
        <div className="w-full mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-2 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Presets
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(p => (
              <button
                key={p.seconds}
                onClick={() => selectPreset(p.seconds)}
                className="py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{
                  background: total === p.seconds ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.04)',
                  color: total === p.seconds ? '#60A5FA' : 'rgba(255,255,255,0.55)',
                  border: `1px solid ${total === p.seconds ? 'rgba(37,99,235,0.5)' : 'var(--dark-border)'}`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Session summary */}
        {setCount > 0 && (
          <div
            className="w-full rounded-2xl p-4 mb-4"
            style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}
          >
            <div className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
              ✅ <span className="font-black text-green-400">{setCount}</span> intervalo{setCount !== 1 ? 's' : ''} completado{setCount !== 1 ? 's' : ''}  nesta sessão
            </div>
          </div>
        )}

        {/* Tips */}
        <div
          className="w-full rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Tempo de descanso sugerido
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Força (baixas reps)', time: '2–3 min', color: '#F87171' },
              { label: 'Hipertrofia', time: '60–90 s', color: '#FBBF24' },
              { label: 'Resistência muscular', time: '30–60 s', color: '#4ADE80' },
              { label: 'Cardio / HIIT', time: '15–30 s', color: '#60A5FA' },
            ].map(t => (
              <div key={t.label} className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.label}</span>
                <span className="text-[11px] font-bold" style={{ color: t.color }}>{t.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 24px)', minHeight: 24 }} />
      </div>

      {/* Custom time input modal */}
      {showCustom && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setShowCustom(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-6"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
          >
            <div className="text-sm font-bold text-white mb-4">Tempo personalizado (segundos)</div>
            <input
              type="number"
              min={5}
              max={600}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustom()}
              className="w-full rounded-xl px-4 py-3 text-white text-lg font-bold mb-4"
              style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
              placeholder="ex: 75"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCustom}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--dark-accent)' }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
