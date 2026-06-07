'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface LastRecord {
  weight_kg: number | null
  body_fat_pct: number | null
  waist_cm: number | null
  hip_cm: number | null
  arm_cm: number | null
  measured_at: string
}

const MOOD_OPTIONS = [
  { emoji: '🤩', label: 'Ótimo', color: '#4ade80', value: 100 },
  { emoji: '😊', label: 'Bem', color: '#60a5fa', value: 80 },
  { emoji: '😐', label: 'Regular', color: '#fbbf24', value: 60 },
  { emoji: '😔', label: 'Cansado', color: '#f97316', value: 40 },
  { emoji: '😫', label: 'Mal', color: '#f87171', value: 20 },
]

export default function CheckinPage() {
  const router = useRouter()
  const supabase = createClient()

  const [lastRecord, setLastRecord] = useState<LastRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')
  const [arm, setArm] = useState('')
  const [adherence, setAdherence] = useState<number>(80)
  const [mood, setMood] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [weightDelta, setWeightDelta] = useState<number | null>(null)

  useEffect(() => {
    async function loadLast() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: patient } = await supabase.from('patients').select('id').eq('auth_user_id', user.id).single()
      if (!patient) return
      const { data } = await supabase.from('anthropometric_records')
        .select('weight_kg, body_fat_pct, waist_cm, hip_cm, arm_cm, measured_at')
        .eq('patient_id', patient.id)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        setLastRecord(data)
        if (data.weight_kg) setWeight(String(data.weight_kg))
        if (data.body_fat_pct) setBodyFat(String(data.body_fat_pct))
        if (data.waist_cm) setWaist(String(data.waist_cm))
        if (data.hip_cm) setHip(String(data.hip_cm))
        if (data.arm_cm) setArm(String(data.arm_cm))
      }
      setLoading(false)
    }
    loadLast()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute weight delta live
  useEffect(() => {
    if (weight && lastRecord?.weight_kg) {
      const current = parseFloat(weight)
      if (!isNaN(current)) {
        const delta = Math.round((current - lastRecord.weight_kg) * 10) / 10
        setWeightDelta(delta)
      } else {
        setWeightDelta(null)
      }
    } else {
      setWeightDelta(null)
    }
  }, [weight, lastRecord])

  async function handleSave() {
    if (!weight && !bodyFat && !waist) {
      setError('Informe pelo menos uma medida.')
      return
    }
    setSaving(true)
    setError('')

    const body: Record<string, unknown> = {
      measured_at: date,
      adherence_pct: adherence,
    }
    if (weight)  body.weight_kg    = parseFloat(weight)
    if (bodyFat) body.body_fat_pct = parseFloat(bodyFat)
    if (waist)   body.waist_cm     = parseFloat(waist)
    if (hip)     body.hip_cm       = parseFloat(hip)
    if (arm)     body.arm_cm       = parseFloat(arm)
    if (notes.trim()) body.notes   = notes.trim()

    const res = await fetch('/api/aluno/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(json.error ?? 'Erro ao registrar check-in.')
    } else {
      setSuccess(true)
      if (weight && lastRecord?.weight_kg) {
        setWeightDelta(Math.round((parseFloat(weight) - lastRecord.weight_kg) * 10) / 10)
      }
    }
  }

  if (success) {
    const isPositive = weightDelta !== null && weightDelta > 0
    const isNegative = weightDelta !== null && weightDelta < 0
    const msg = isNegative
      ? `Você perdeu ${Math.abs(weightDelta!)} kg! Continue assim! 💪`
      : isPositive
      ? `Registrado! Lembre-se: o processo é gradual. Continue focado! 🌱`
      : weight
      ? `Registrado! Mantenha a consistência! 🎯`
      : `Check-in registrado com sucesso!`

    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--dark-bg)' }}>
        <div className="max-w-sm w-full text-center">
          <div className="text-6xl mb-4">{isNegative ? '🏆' : '✅'}</div>
          <div className="text-xl font-black text-white mb-2">Check-in registrado!</div>
          {weight && (
            <div className="text-3xl font-black mb-1" style={{ color: isNegative ? '#4ade80' : '#60a5fa' }}>
              {parseFloat(weight)} kg
              {weightDelta !== null && weightDelta !== 0 && (
                <span className="text-lg ml-2" style={{ color: isNegative ? '#4ade80' : '#f87171' }}>
                  ({weightDelta > 0 ? '+' : ''}{weightDelta} kg)
                </span>
              )}
            </div>
          )}
          <div className="text-sm mt-2 mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{msg}</div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => router.push('/aluno')}
              className="py-3 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.35)' }}>
              ← Início
            </button>
            <button onClick={() => router.push('/aluno/evolucao')}
              className="py-3 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
              📈 Ver evolução
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">⚖️ Check-in</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Registre suas medidas de hoje</p>
        </div>
      </div>

      <div className="px-5 py-5 max-w-lg mx-auto space-y-5">
        {/* Date picker */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Data do check-in
          </label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>

        {/* Weight */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            ⚖️ Peso
          </label>
          <div className="flex items-center gap-3">
            <input type="number" step="0.1" value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder={lastRecord?.weight_kg ? String(lastRecord.weight_kg) : 'kg'}
              className="flex-1 px-4 py-3 rounded-xl text-xl font-black text-white outline-none text-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <span className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>kg</span>
          </div>
          {/* Delta indicator */}
          {weightDelta !== null && weightDelta !== 0 && (
            <div className="mt-2 text-center">
              <span className="text-sm font-black" style={{ color: weightDelta < 0 ? '#4ade80' : '#f87171' }}>
                {weightDelta > 0 ? '+' : ''}{weightDelta} kg
              </span>
              <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.3)' }}>desde a última medição</span>
            </div>
          )}
          {lastRecord?.weight_kg && !weight && (
            <div className="mt-2 text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Última: {lastRecord.weight_kg} kg em {new Date(lastRecord.measured_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </div>
          )}
        </div>

        {/* Adherence slider */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              📊 Aderência ao plano
            </label>
            <span className="text-lg font-black" style={{ color: adherence >= 80 ? '#4ade80' : adherence >= 60 ? '#60a5fa' : adherence >= 40 ? '#fbbf24' : '#f87171' }}>
              {adherence}%
            </span>
          </div>
          <input type="range" min="0" max="100" step="5" value={adherence}
            onChange={e => setAdherence(parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none outline-none"
            style={{
              background: `linear-gradient(to right, ${adherence >= 80 ? '#4ade80' : adherence >= 60 ? '#60a5fa' : adherence >= 40 ? '#fbbf24' : '#f87171'} ${adherence}%, rgba(255,255,255,0.1) ${adherence}%)`,
            }} />
          <div className="flex justify-between text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
          <div className="text-xs mt-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {adherence >= 90 ? '🏆 Excelente aderência!'
            : adherence >= 70 ? '👍 Boa aderência!'
            : adherence >= 50 ? '💪 Continue melhorando!'
            : adherence >= 30 ? '⚠️ Tente melhorar esta semana'
            : '🎯 Foco! Você consegue!'}
          </div>
        </div>

        {/* Mood */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            😊 Como você está se sentindo?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {MOOD_OPTIONS.map(m => (
              <button key={m.value} onClick={() => setMood(mood === m.value ? null : m.value)}
                className="flex flex-col items-center py-2.5 rounded-xl transition-all"
                style={mood === m.value ? {
                  background: `${m.color}22`, border: `2px solid ${m.color}`,
                } : {
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px] mt-1" style={{ color: mood === m.value ? m.color : 'rgba(255,255,255,0.3)' }}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Other measurements (collapsible) */}
        <details className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <summary className="px-5 py-4 cursor-pointer text-sm font-semibold select-none" style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.6)' }}>
            📏 Medidas adicionais (opcional)
          </summary>
          <div className="px-5 py-4 space-y-3" style={{ background: 'rgba(255,255,255,0.01)' }}>
            {[
              { key: 'bodyFat', label: '% Gordura corporal', val: bodyFat, set: setBodyFat, placeholder: lastRecord?.body_fat_pct ? String(lastRecord.body_fat_pct) : '%', unit: '%' },
              { key: 'waist', label: 'Cintura', val: waist, set: setWaist, placeholder: lastRecord?.waist_cm ? String(lastRecord.waist_cm) : 'cm', unit: 'cm' },
              { key: 'hip', label: 'Quadril', val: hip, set: setHip, placeholder: lastRecord?.hip_cm ? String(lastRecord.hip_cm) : 'cm', unit: 'cm' },
              { key: 'arm', label: 'Braço', val: arm, set: setArm, placeholder: lastRecord?.arm_cm ? String(lastRecord.arm_cm) : 'cm', unit: 'cm' },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="w-28 text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.label}</label>
                <input type="number" step="0.1" value={f.val} onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }} />
                <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.unit}</span>
              </div>
            ))}
          </div>
        </details>

        {/* Notes */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            📝 Observações (opcional)
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Como foi a semana? Algo importante a registrar?"
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-center py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Save button */}
        <button onClick={handleSave} disabled={saving || loading}
          className="w-full py-4 rounded-2xl text-base font-black transition-all"
          style={{
            background: saving ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.3)',
            color: '#93C5FD',
            border: '1px solid rgba(37,99,235,0.5)',
          }}>
          {saving ? 'Registrando...' : '✓ Registrar Check-in'}
        </button>
      </div>
    </div>
  )
}
