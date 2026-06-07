'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const QUICK_ADD = [
  { label: 'Copo', ml: 200, icon: '🥛' },
  { label: 'Garrafa pequena', ml: 350, icon: '🫗' },
  { label: 'Garrafa média', ml: 500, icon: '🧴' },
  { label: 'Garrafa 1L', ml: 1000, icon: '🍶' },
]

function formatMl(ml: number) {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1).replace('.0', '')}L`
  return `${ml}ml`
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

export default function AguaPage() {
  const [date] = useState(getToday())
  const [amountMl, setAmountMl] = useState(0)
  const [goalMl, setGoalMl] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editGoal, setEditGoal] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [justAdded, setJustAdded] = useState<number | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/water?date=${date}`)
    const data = await res.json()
    setAmountMl(data.water?.amount_ml ?? 0)
    setGoalMl(data.water?.goal_ml ?? 2000)
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  async function save(amount: number, goal?: number) {
    setSaving(true)
    const res = await fetch('/api/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, amount_ml: amount, goal_ml: goal ?? goalMl }),
    })
    await res.json()
    setSaving(false)
  }

  async function addWater(ml: number) {
    const newAmount = Math.min(amountMl + ml, goalMl * 2) // cap at 2x goal
    setAmountMl(newAmount)
    setJustAdded(ml)
    setTimeout(() => setJustAdded(null), 1200)
    await save(newAmount)
  }

  async function removeWater(ml: number) {
    const newAmount = Math.max(0, amountMl - ml)
    setAmountMl(newAmount)
    await save(newAmount)
  }

  async function resetDay() {
    setAmountMl(0)
    await save(0)
  }

  async function saveGoal() {
    const g = parseInt(newGoal)
    if (!g || g < 500 || g > 6000) return
    setGoalMl(g)
    setEditGoal(false)
    await save(amountMl, g)
  }

  const pct = Math.min(100, Math.round((amountMl / goalMl) * 100))
  const remaining = Math.max(0, goalMl - amountMl)
  const achieved = amountMl >= goalMl

  // Water fill visual
  const glasses = Math.ceil(goalMl / 250)
  const filledGlasses = Math.floor((amountMl / goalMl) * glasses)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-6 h-14 flex items-center justify-between"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/aluno" className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>←</Link>
          <h1 className="font-bold text-white">💧 Hidratação</h1>
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Carregando...
        </div>
      ) : (
        <div className="px-6 py-6 space-y-5">

          {/* Main progress card */}
          <div
            className="rounded-2xl p-6 text-center relative overflow-hidden"
            style={{ background: 'var(--dark-card)', border: `1px solid ${achieved ? 'rgba(16,185,129,0.4)' : 'var(--dark-border)'}` }}
          >
            {achieved && (
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, transparent 70%)' }} />
            )}

            {/* Circular progress */}
            <div className="relative w-36 h-36 mx-auto mb-4">
              <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
                <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle cx="72" cy="72" r="60" fill="none"
                  stroke={achieved ? '#34D399' : '#3B82F6'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-black text-white leading-none">{pct}%</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>da meta</div>
              </div>
            </div>

            {/* Amount display */}
            <div className="text-4xl font-black text-white leading-none">
              {formatMl(amountMl)}
            </div>
            <div className="text-sm mt-1 mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {achieved ? (
                <span className="text-emerald-400 font-semibold">🎉 Meta atingida!</span>
              ) : (
                <>Faltam <span className="text-white font-semibold">{formatMl(remaining)}</span> para a meta</>
              )}
            </div>

            {/* Goal display */}
            <button
              onClick={() => { setEditGoal(!editGoal); setNewGoal(String(goalMl)) }}
              className="text-xs px-3 py-1 rounded-full transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
            >
              Meta: {formatMl(goalMl)} {editGoal ? '▲' : '✏️'}
            </button>

            {editGoal && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <input
                  type="number"
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  min={500}
                  max={6000}
                  step={250}
                  className="w-24 px-3 py-1.5 rounded-lg text-sm text-white text-center outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  placeholder="2000"
                  autoFocus
                />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>ml</span>
                <button onClick={saveGoal} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(37,99,235,0.25)', color: '#93C5FD' }}>
                  Salvar
                </button>
              </div>
            )}

            {/* Just-added feedback */}
            {justAdded && (
              <div
                className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold animate-bounce"
                style={{ background: 'rgba(59,130,246,0.3)', color: '#93C5FD' }}
              >
                +{formatMl(justAdded)}
              </div>
            )}
          </div>

          {/* Quick add buttons */}
          <div>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3"
              style={{ color: 'rgba(255,255,255,0.25)' }}>Adicionar</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ADD.map(item => (
                <button
                  key={item.ml}
                  onClick={() => addWater(item.ml)}
                  disabled={saving}
                  className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all active:scale-95"
                  style={{
                    background: 'var(--dark-card)',
                    border: '1px solid var(--dark-border)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dark-border)')}
                >
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-white">+{formatMl(item.ml)}</div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.label}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <CustomAddRow onAdd={addWater} saving={saving} />
          </div>

          {/* Glass visualization */}
          <div>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              Copos de 250ml ({filledGlasses}/{glasses})
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: glasses }, (_, i) => (
                <div
                  key={i}
                  className="text-xl transition-all"
                  style={{ opacity: i < filledGlasses ? 1 : 0.2 }}
                >
                  🥛
                </div>
              ))}
            </div>
          </div>

          {/* Reset */}
          <div className="flex justify-center">
            <button
              onClick={() => { if (confirm('Zerar hidratação de hoje?')) resetDay() }}
              className="text-xs px-4 py-2 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              Zerar o dia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomAddRow({ onAdd, saving }: { onAdd: (ml: number) => void; saving: boolean }) {
  const [custom, setCustom] = useState('')

  function submit() {
    const ml = parseInt(custom)
    if (!ml || ml < 50 || ml > 3000) return
    onAdd(ml)
    setCustom('')
  }

  return (
    <div className="flex gap-2 mt-2">
      <input
        type="number"
        value={custom}
        onChange={e => setCustom(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Outro valor (ml)"
        min={50}
        max={3000}
        className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none"
        style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
      />
      <button
        onClick={submit}
        disabled={saving || !custom}
        className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: custom ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.05)',
          color: custom ? '#93C5FD' : 'rgba(255,255,255,0.25)',
          border: '1px solid rgba(37,99,235,0.2)',
        }}
      >
        + Adicionar
      </button>
    </div>
  )
}
