'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type LabResult = {
  id: string
  date: string
  panel_name: string | null
  exam_name: string
  value: number | null
  unit: string | null
  reference_min: number | null
  reference_max: number | null
  status: 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo' | null
  notes: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; emoji: string }> = {
  normal:        { label: 'Normal',       color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',  icon: '✓', emoji: '✅' },
  alto:          { label: 'Elevado',      color: '#FCD34D', bg: 'rgba(252,211,77,0.08)',  icon: '↑', emoji: '⚠️' },
  baixo:         { label: 'Baixo',        color: '#93C5FD', bg: 'rgba(147,197,253,0.08)', icon: '↓', emoji: '⚠️' },
  critico_alto:  { label: 'Atenção ↑',   color: '#F87171', bg: 'rgba(248,113,113,0.10)', icon: '!', emoji: '🔴' },
  critico_baixo: { label: 'Atenção ↓',   color: '#F87171', bg: 'rgba(248,113,113,0.10)', icon: '!', emoji: '🔴' },
}

export default function AlunoExamesPage() {
  const [results, setResults] = useState<LabResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get patient id from auth_user_id
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!patient) { setLoading(false); return }

      const { data } = await supabase
        .from('lab_results')
        .select('*')
        .eq('patient_id', patient.id)
        .order('date', { ascending: false })
        .order('panel_name', { ascending: true })
        .order('exam_name', { ascending: true })

      setResults(data ?? [])

      // Auto-select most recent date
      if (data && data.length > 0) {
        setSelectedDate(data[0].date)
      }

      setLoading(false)
    }
    load()
  }, [])

  const allDates = Array.from(new Set(results.map(r => r.date))).sort((a, b) => b.localeCompare(a))

  const filtered = selectedDate ? results.filter(r => r.date === selectedDate) : []

  const byPanel: Record<string, LabResult[]> = {}
  for (const r of filtered) {
    const key = r.panel_name ?? 'Outros'
    if (!byPanel[key]) byPanel[key] = []
    byPanel[key].push(r)
  }

  const abnormal = filtered.filter(r => r.status && r.status !== 'normal')

  return (
    <div className="min-h-screen pb-8" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 py-4 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}>
        <Link href="/aluno" className="text-2xl">←</Link>
        <div>
          <h1 className="text-base font-black text-white leading-none">Meus Exames</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Resultados laboratoriais</p>
        </div>
      </div>

      <div className="px-5 pt-5 max-w-lg mx-auto">
        {loading ? (
          <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <div className="text-3xl mb-2">🔬</div>
            <div>Carregando...</div>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔬</div>
            <div className="text-white font-bold mb-2">Nenhum exame disponível</div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Seus exames aparecerão aqui quando forem cadastrados pelo seu nutricionista
            </div>
          </div>
        ) : (
          <>
            {/* Alert for abnormal results */}
            {abnormal.length > 0 && (
              <div className="rounded-2xl p-4 mb-5 flex items-start gap-3"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="text-sm font-bold" style={{ color: '#F87171' }}>
                    {abnormal.length} resultado{abnormal.length !== 1 ? 's' : ''} fora do intervalo de referência
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Converse com seu nutricionista sobre os próximos passos
                  </div>
                </div>
              </div>
            )}

            {/* Date selector */}
            {allDates.length > 1 && (
              <div className="mb-5">
                <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Coleta</div>
                <div className="flex gap-2 flex-wrap">
                  {allDates.map(d => (
                    <button key={d} onClick={() => setSelectedDate(d)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: selectedDate === d ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                        color: selectedDate === d ? '#fff' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${selectedDate === d ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedDate && (
              <div className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Coleta em {new Date(selectedDate + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} · {filtered.length} exames
              </div>
            )}

            {/* Results by panel */}
            <div className="space-y-5">
              {Object.entries(byPanel).map(([panel, panelResults]) => (
                <div key={panel} className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="px-5 py-3" style={{ background: 'rgba(37,99,235,0.08)', borderBottom: '1px solid rgba(37,99,235,0.12)' }}>
                    <span className="text-xs font-bold tracking-[2px] uppercase" style={{ color: '#93C5FD' }}>{panel}</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {panelResults.map(r => {
                      const sc = r.status ? STATUS_CONFIG[r.status] : null
                      return (
                        <div key={r.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-white">{r.exam_name}</div>
                              {(r.reference_min != null || r.reference_max != null) && (
                                <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                  Referência: {r.reference_min != null && r.reference_max != null
                                    ? `${r.reference_min} – ${r.reference_max}`
                                    : r.reference_min != null ? `≥ ${r.reference_min}` : `≤ ${r.reference_max}`}
                                  {r.unit && ` ${r.unit}`}
                                </div>
                              )}
                              {r.notes && (
                                <div className="text-[11px] mt-1 italic" style={{ color: 'rgba(255,255,255,0.25)' }}>{r.notes}</div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {r.value != null ? (
                                <div className="text-xl font-black" style={{ color: sc ? sc.color : '#fff' }}>
                                  {r.value}
                                  {r.unit && <span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.unit}</span>}
                                </div>
                              ) : (
                                <div className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>—</div>
                              )}
                              {sc && (
                                <div className="mt-1">
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                                    style={{ background: sc.bg, color: sc.color }}>
                                    {sc.emoji} {sc.label}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Visual reference bar */}
                          {r.value != null && (r.reference_min != null || r.reference_max != null) && (() => {
                            const v = r.value!
                            const rMin = r.reference_min ?? (r.reference_max! * 0.5)
                            const rMax = r.reference_max ?? (r.reference_min! * 1.5)
                            const barMin = rMin * 0.6
                            const barMax = rMax * 1.4
                            const range = barMax - barMin
                            const valuePct = Math.min(100, Math.max(0, ((v - barMin) / range) * 100))
                            const refMinPct = ((rMin - barMin) / range) * 100
                            const refMaxPct = ((rMax - barMin) / range) * 100
                            return (
                              <div className="mt-3">
                                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                  {/* Normal range highlight */}
                                  <div className="absolute h-full rounded-full" style={{
                                    left: `${refMinPct}%`,
                                    width: `${refMaxPct - refMinPct}%`,
                                    background: 'rgba(74,222,128,0.2)',
                                  }} />
                                  {/* Value indicator */}
                                  <div className="absolute w-3 h-3 rounded-full -top-0.5 -ml-1.5 border-2 border-white"
                                    style={{ left: `${valuePct}%`, background: sc ? sc.color : '#fff' }} />
                                </div>
                                <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                  <span>{r.reference_min != null ? r.reference_min : ''}</span>
                                  <span>{r.reference_max != null ? r.reference_max : ''}</span>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
