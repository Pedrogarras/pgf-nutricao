'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Supplement {
  id: string
  name: string
  brand: string | null
  dosage: string
  timing: string
  with_food: boolean
  instructions: string | null
}

const TIMING_OPTIONS = [
  { value: 'ao_acordar',    label: '☀️ Ao acordar',      color: '#FCD34D' },
  { value: 'cafe_manha',    label: '🍳 Café da manhã',   color: '#FDE68A' },
  { value: 'pre_treino',    label: '💪 Pré-treino',      color: '#6EE7B7' },
  { value: 'pos_treino',    label: '🏋️ Pós-treino',     color: '#34D399' },
  { value: 'almoco',        label: '🍽️ Almoço',          color: '#93C5FD' },
  { value: 'lanche',        label: '🥪 Lanche',          color: '#C4B5FD' },
  { value: 'jantar',        label: '🌙 Jantar',          color: '#A5B4FC' },
  { value: 'antes_dormir',  label: '😴 Antes de dormir', color: '#818CF8' },
  { value: 'qualquer_hora', label: '🕐 Qualquer hora',   color: '#9CA3AF' },
]

function timingLabel(v: string) { return TIMING_OPTIONS.find(o => o.value === v)?.label ?? v }
function timingColor(v: string) { return TIMING_OPTIONS.find(o => o.value === v)?.color ?? '#9CA3AF' }

export default function AlunoSupplementsPage() {
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/supplements')
      .then(r => r.json())
      .then(d => { setSupplements((d.supplements ?? []).filter((s: any) => s.active)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Group by timing
  const grouped: Record<string, Supplement[]> = {}
  for (const s of supplements) {
    if (!grouped[s.timing]) grouped[s.timing] = []
    grouped[s.timing].push(s)
  }
  const timingOrder = TIMING_OPTIONS.map(t => t.value).filter(v => grouped[v])

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-6 h-14 flex items-center justify-between"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/aluno" className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>←</Link>
          <h1 className="font-bold text-white">💊 Meus Suplementos</h1>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}>
          {supplements.length} prescritos
        </span>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando...</div>
        ) : supplements.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">💊</div>
            <p className="font-semibold text-white mb-2">Nenhum suplemento</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Seu nutricionista ainda não prescreveu suplementos.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {timingOrder.map(timing => (
              <div key={timing}>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: timingColor(timing) + '20', color: timingColor(timing) }}
                  >
                    {timingLabel(timing)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--dark-border)' }} />
                </div>

                <div className="space-y-2">
                  {grouped[timing].map(s => (
                    <div
                      key={s.id}
                      className="rounded-xl p-4 flex items-start gap-4"
                      style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: timingColor(timing) + '15' }}
                      >
                        💊
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm">{s.name}</div>
                        {s.brand && (
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.brand}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: timingColor(timing) }}>
                            {s.dosage}
                          </span>
                          {s.with_food && (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              🍽 Com alimentos
                            </span>
                          )}
                        </div>
                        {s.instructions && (
                          <p className="text-xs mt-1.5 italic" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {s.instructions}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div
              className="rounded-xl p-4 text-center text-xs"
              style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', color: 'rgba(255,255,255,0.35)' }}
            >
              Em caso de dúvidas sobre seus suplementos, entre em contato com seu nutricionista.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
