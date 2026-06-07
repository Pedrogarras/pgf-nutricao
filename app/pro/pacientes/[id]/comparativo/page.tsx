'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface EvalRecord {
  id: string
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  waist_cm: number | null
  hip_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
  calf_cm: number | null
  adherence_pct: number | null
  notes: string | null
}

interface Patient {
  full_name: string
  height_cm: number | null
  weight_kg: number | null
  date_of_birth: string | null
}

/* ─── Metric definitions ──────────────────────────────────────────────────── */
const METRICS: {
  key: keyof EvalRecord
  label: string
  unit: string
  icon: string
  lowerBetter: boolean
  compute?: (r: EvalRecord, height: number | null) => number | null
}[] = [
  { key: 'weight_kg',      label: 'Peso',         unit: 'kg', icon: '⚖️', lowerBetter: false },
  { key: 'body_fat_pct',   label: 'Gordura',       unit: '%',  icon: '🔴', lowerBetter: true  },
  { key: 'muscle_mass_kg', label: 'Massa Magra',   unit: 'kg', icon: '💪', lowerBetter: false },
  { key: 'waist_cm',       label: 'Cintura',       unit: 'cm', icon: '📏', lowerBetter: true  },
  { key: 'hip_cm',         label: 'Quadril',       unit: 'cm', icon: '📐', lowerBetter: false },
  { key: 'arm_cm',         label: 'Braço',         unit: 'cm', icon: '💪', lowerBetter: false },
  { key: 'thigh_cm',       label: 'Coxa',          unit: 'cm', icon: '📏', lowerBetter: false },
  { key: 'calf_cm',        label: 'Panturrilha',   unit: 'cm', icon: '📏', lowerBetter: false },
  { key: 'adherence_pct',  label: 'Aderência',     unit: '%',  icon: '📊', lowerBetter: false },
]

function r(n: number | null, d = 1) {
  if (n == null) return null
  return Math.round(n * 10 ** d) / 10 ** d
}

function fmtDate(s: string) {
  return new Date(s + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysApart(a: string, b: string) {
  return Math.abs(Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86400000))
}

/* ─── Comparison row ──────────────────────────────────────────────────────── */
function CompareRow({
  label, unit, icon, valA, valB, lowerBetter,
}: {
  label: string; unit: string; icon: string
  valA: number | null; valB: number | null; lowerBetter: boolean
}) {
  const hasData = valA != null || valB != null
  if (!hasData) return null

  const delta = valA != null && valB != null ? r(valB - valA) : null
  const improved = delta != null && ((lowerBetter && delta < 0) || (!lowerBetter && delta > 0))
  const regressed = delta != null && ((lowerBetter && delta > 0) || (!lowerBetter && delta < 0))

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-3 border-b"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      {/* Left value */}
      <div className="text-right">
        {valA != null
          ? <span className="text-lg font-black text-white">{r(valA)}<span className="text-xs ml-0.5 font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit}</span></span>
          : <span className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
        }
      </div>

      {/* Center label + delta */}
      <div className="text-center min-w-[100px]">
        <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {icon} {label}
        </div>
        {delta != null && delta !== 0 && (
          <div className="mt-1">
            <span className="text-sm font-black px-2 py-0.5 rounded-full"
              style={{
                background: improved ? 'rgba(74,222,128,0.12)' : regressed ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)',
                color: improved ? '#4ADE80' : regressed ? '#F87171' : 'rgba(255,255,255,0.6)',
              }}>
              {delta > 0 ? '+' : ''}{delta}{unit}
            </span>
          </div>
        )}
        {delta === 0 && (
          <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>sem mudança</div>
        )}
        {delta == null && (valA != null || valB != null) && (
          <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>—</div>
        )}
      </div>

      {/* Right value */}
      <div className="text-left">
        {valB != null
          ? <span className="text-lg font-black text-white">{r(valB)}<span className="text-xs ml-0.5 font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit}</span></span>
          : <span className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
        }
      </div>
    </div>
  )
}

/* ─── Body composition visual ─────────────────────────────────────────────── */
function BodyCompBar({
  label, fatPct, musclePct, color,
}: {
  label: string; fatPct: number | null; musclePct: number | null; color: string
}) {
  if (fatPct == null && musclePct == null) return null
  const lean = musclePct != null ? musclePct : fatPct != null ? 100 - fatPct : 0
  const fat = fatPct ?? (100 - lean)
  return (
    <div>
      <div className="text-xs font-semibold mb-1.5" style={{ color }}>{label}</div>
      <div className="flex h-5 rounded-full overflow-hidden gap-px">
        <div style={{ width: `${Math.min(fat, 100)}%`, background: '#F87171' }} title={`Gordura ${fat.toFixed(1)}%`} />
        <div style={{ width: `${Math.min(Math.max(100 - fat - 15, 0), 100)}%`, background: '#60A5FA' }} title="Massa magra" />
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)' }} />
      </div>
      <div className="flex gap-3 mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {fatPct != null && <span><span style={{ color: '#F87171' }}>●</span> Gordura {fatPct.toFixed(1)}%</span>}
        {musclePct != null && <span><span style={{ color: '#60A5FA' }}>●</span> Massa {musclePct.toFixed(1)} kg</span>}
      </div>
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function ComparativoPage() {
  const params = useParams()
  const patientId = params.id as string
  const supabase = createClient()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [records, setRecords] = useState<EvalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [idxA, setIdxA] = useState(0)
  const [idxB, setIdxB] = useState(0)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: recs }] = await Promise.all([
        supabase.from('patients')
          .select('full_name, height_cm, weight_kg, date_of_birth')
          .eq('id', patientId).single(),
        supabase.from('anthropometric_records')
          .select('id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, hip_cm, arm_cm, thigh_cm, calf_cm, adherence_pct, notes')
          .eq('patient_id', patientId)
          .order('measured_at', { ascending: true }),
      ])
      setPatient(p ?? null)
      const sorted = recs ?? []
      setRecords(sorted)
      if (sorted.length >= 2) {
        setIdxA(0)             // oldest
        setIdxB(sorted.length - 1) // newest
      } else if (sorted.length === 1) {
        setIdxA(0)
        setIdxB(0)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dark-bg)' }}>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando avaliações...</div>
      </div>
    )
  }

  const recA = records[idxA]
  const recB = records[idxB]
  const daysDiff = recA && recB && recA.measured_at !== recB.measured_at
    ? daysApart(recA.measured_at, recB.measured_at)
    : null
  const bmi = (rec: EvalRecord | undefined) => {
    if (!rec?.weight_kg || !patient?.height_cm) return null
    const h = patient.height_cm / 100
    return r(rec.weight_kg / (h * h))
  }

  // ── Summary improvements ─────────────────────────────────────────────
  const improvements: string[] = []
  const regressions: string[] = []
  if (recA && recB) {
    for (const m of METRICS) {
      const va = recA[m.key] as number | null
      const vb = recB[m.key] as number | null
      if (va == null || vb == null || va === vb) continue
      const delta = vb - va
      const improved = (m.lowerBetter && delta < 0) || (!m.lowerBetter && delta > 0)
      const label = `${m.label}: ${delta > 0 ? '+' : ''}${r(delta)}${m.unit}`
      if (improved) improvements.push(label)
      else regressions.push(label)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-6 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href={`/pro/pacientes/${patientId}`}
          className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← {patient?.full_name}
        </Link>
        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="text-sm font-black text-white">Comparativo de Avaliações</span>
        <div className="flex-1" />
        {records.length > 0 && (
          <Link href={`/pro/pacientes/${patientId}/medidas`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.2)' }}>
            + Nova avaliação
          </Link>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">

        {records.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📏</div>
            <div className="text-white font-bold text-lg mb-2">Nenhuma avaliação registrada</div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Registre pelo menos 2 avaliações físicas para comparar a evolução.
            </div>
            <Link href={`/pro/pacientes/${patientId}/medidas`}
              className="inline-block px-6 py-3 rounded-xl font-bold text-white"
              style={{ background: '#2563EB' }}>
              Registrar avaliação
            </Link>
          </div>
        ) : (
          <>
            {/* ── Period selectors ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {([
                { label: 'Avaliação A', idx: idxA, setIdx: setIdxA, color: '#60A5FA', tag: records.length > 1 && idxA === 0 ? 'inicial' : '' },
                { label: 'Avaliação B', idx: idxB, setIdx: setIdxB, color: '#F87171', tag: records.length > 1 && idxB === records.length - 1 ? 'atual' : '' },
              ] as const).map(({ label, idx, setIdx, color, tag }) => (
                <div key={label} className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold" style={{ color }}>{label}</span>
                    {tag && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${color}18`, color }}>
                        {tag}
                      </span>
                    )}
                  </div>
                  <select
                    value={idx}
                    onChange={e => setIdx(Number(e.target.value))}
                    className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${color}44`,
                      color: 'white',
                      outline: 'none',
                    }}
                  >
                    {records.map((rec, i) => (
                      <option key={rec.id} value={i}>
                        {fmtDate(rec.measured_at)} — {rec.weight_kg ? `${rec.weight_kg} kg` : '?'}
                      </option>
                    ))}
                  </select>
                  {records[idx] && (
                    <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {fmtDate(records[idx].measured_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Period summary ───────────────────────────────────── */}
            {daysDiff != null && (
              <div className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <div className="text-2xl font-black text-white">{daysDiff} dias</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>entre as avaliações</div>
              </div>
            )}

            {/* ── Body composition comparison ──────────────────────── */}
            {(recA?.body_fat_pct != null || recA?.muscle_mass_kg != null || recB?.body_fat_pct != null || recB?.muscle_mass_kg != null) && (
              <div className="rounded-2xl p-5 space-y-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-[11px] font-bold uppercase tracking-[2px]"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>Composição corporal</div>
                <BodyCompBar label="Avaliação A" fatPct={recA?.body_fat_pct ?? null} musclePct={recA?.muscle_mass_kg ?? null} color="#60A5FA" />
                <BodyCompBar label="Avaliação B" fatPct={recB?.body_fat_pct ?? null} musclePct={recB?.muscle_mass_kg ?? null} color="#F87171" />
              </div>
            )}

            {/* ── Measurements comparison ──────────────────────────── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-5 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-right">
                  <div className="text-xs font-black" style={{ color: '#60A5FA' }}>Avaliação A</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {recA ? fmtDate(recA.measured_at) : '—'}
                  </div>
                </div>
                <div className="w-[100px]" />
                <div className="text-left">
                  <div className="text-xs font-black" style={{ color: '#F87171' }}>Avaliação B</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {recB ? fmtDate(recB.measured_at) : '—'}
                  </div>
                </div>
              </div>

              {/* Rows */}
              <div className="px-5">
                {METRICS.map(m => (
                  <CompareRow
                    key={m.key}
                    label={m.label}
                    unit={m.unit}
                    icon={m.icon}
                    valA={(recA?.[m.key] as number | null) ?? null}
                    valB={(recB?.[m.key] as number | null) ?? null}
                    lowerBetter={m.lowerBetter}
                  />
                ))}

                {/* BMI row */}
                <CompareRow
                  label="IMC" unit="" icon="📊"
                  valA={bmi(recA) ?? null}
                  valB={bmi(recB) ?? null}
                  lowerBetter={true}
                />
              </div>
            </div>

            {/* ── Summary ──────────────────────────────────────────── */}
            {(improvements.length > 0 || regressions.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {improvements.length > 0 && (
                  <div className="rounded-2xl p-4"
                    style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <div className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#4ADE80' }}>
                      ✓ Melhorias
                    </div>
                    <div className="space-y-1.5">
                      {improvements.map((item, i) => (
                        <div key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{item}</div>
                      ))}
                    </div>
                  </div>
                )}
                {regressions.length > 0 && (
                  <div className="rounded-2xl p-4"
                    style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <div className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#F87171' }}>
                      ⚠ Atenção
                    </div>
                    <div className="space-y-1.5">
                      {regressions.map((item, i) => (
                        <div key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{item}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes from both records */}
            {(recA?.notes || recB?.notes) && (
              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-[11px] font-bold uppercase tracking-[2px]"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>Observações</div>
                {recA?.notes && (
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: '#60A5FA' }}>Avaliação A: </span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{recA.notes}</span>
                  </div>
                )}
                {recB?.notes && (
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: '#F87171' }}>Avaliação B: </span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{recB.notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick actions */}
            <div className="flex gap-3">
              <Link href={`/pro/pacientes/${patientId}/medidas`}
                className="flex-1 text-center text-sm font-semibold py-3 rounded-xl transition-all"
                style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)' }}>
                📏 Ver histórico completo
              </Link>
              <Link href={`/pro/pacientes/${patientId}/evolucao`}
                className="flex-1 text-center text-sm font-semibold py-3 rounded-xl transition-all"
                style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.2)' }}>
                📈 Ver gráficos
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
