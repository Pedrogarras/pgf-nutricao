'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckInForm({ lastWeight }: { lastWeight?: number | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState(lastWeight ? String(lastWeight) : '')
  const [adherence, setAdherence] = useState('')
  const [waist, setWaist] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function handleOpen() {
    setWeight(lastWeight ? String(lastWeight) : '')
    setAdherence('')
    setWaist('')
    setNotes('')
    setError('')
    setSuccess(false)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!weight && !adherence) {
      setError('Informe pelo menos o peso ou a aderência.')
      return
    }
    setLoading(true)
    setError('')
    const body: Record<string, unknown> = {
      measured_at: new Date().toISOString().split('T')[0],
    }
    if (weight) body.weight_kg = parseFloat(weight)
    if (adherence) body.adherence_pct = parseInt(adherence)
    if (waist) body.waist_cm = parseFloat(waist)
    if (notes.trim()) body.notes = notes.trim()

    const res = await fetch('/api/aluno/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error ?? 'Erro ao registrar check-in.')
    } else {
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 1500)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          background: 'rgba(37,99,235,0.15)',
          color: '#93B4FA',
          border: '1px solid rgba(37,99,235,0.3)',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Registrar check-in
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#111827', borderRadius: '16px', width: '100%', maxWidth: '400px',
              border: '1px solid rgba(37,99,235,0.25)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#E2E8F8' }}>
                    Check-in de hoje
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(197,205,240,0.5)' }}>
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'rgba(197,205,240,0.4)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {success ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
                <p style={{ color: '#6EE7B7', fontSize: '15px', fontWeight: 600, margin: 0 }}>Check-in registrado!</p>
                <p style={{ color: 'rgba(197,205,240,0.5)', fontSize: '12px', marginTop: '4px' }}>Atualizando seus dados...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Peso */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(197,205,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Peso atual (kg)
                  </label>
                  <input
                    type="number" step="0.1" min="20" max="300"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder={lastWeight ? `Anterior: ${lastWeight} kg` : 'ex: 75.5'}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F8', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Aderência */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(197,205,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Aderência ao plano esta semana
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[25, 50, 75, 100].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAdherence(String(v))}
                        style={{
                          padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                          background: adherence === String(v) ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.05)',
                          border: adherence === String(v) ? '1px solid rgba(37,99,235,0.6)' : '1px solid rgba(255,255,255,0.1)',
                          color: adherence === String(v) ? '#93B4FA' : 'rgba(197,205,240,0.6)',
                          transition: 'all 0.1s',
                        }}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" min="0" max="100"
                    value={adherence}
                    onChange={e => setAdherence(e.target.value)}
                    placeholder="ou digite 0–100"
                    style={{
                      marginTop: '8px', width: '100%', padding: '8px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F8', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Cintura (opcional) */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(197,205,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Circunferência abdominal — cm (opcional)
                  </label>
                  <input
                    type="number" step="0.5" min="40" max="200"
                    value={waist}
                    onChange={e => setWaist(e.target.value)}
                    placeholder="ex: 82"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F8', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Observações */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(197,205,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Observações (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Como foi a semana? Dificuldades, dúvidas..."
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F8', fontSize: '13px', outline: 'none', resize: 'vertical',
                      boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                </div>

                {error && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#F87171' }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '11px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                    background: loading ? 'rgba(37,99,235,0.3)' : 'rgba(37,99,235,0.85)',
                    border: 'none', color: '#fff', transition: 'background 0.15s',
                  }}
                >
                  {loading ? 'Registrando...' : 'Confirmar check-in'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
