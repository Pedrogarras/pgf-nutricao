'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Supplement {
  id: string
  name: string
  brand: string | null
  dosage: string
  timing: string
  with_food: boolean
  instructions: string | null
  active: boolean
  start_date: string | null
  end_date: string | null
}

const TIMING_OPTIONS = [
  { value: 'ao_acordar',       label: '☀️ Ao acordar',         color: '#FCD34D' },
  { value: 'cafe_manha',       label: '🍳 Café da manhã',      color: '#FDE68A' },
  { value: 'pre_treino',       label: '💪 Pré-treino',         color: '#6EE7B7' },
  { value: 'pos_treino',       label: '🏋️ Pós-treino',        color: '#34D399' },
  { value: 'almoco',           label: '🍽️ Almoço',             color: '#93C5FD' },
  { value: 'lanche',           label: '🥪 Lanche',             color: '#C4B5FD' },
  { value: 'jantar',           label: '🌙 Jantar',             color: '#A5B4FC' },
  { value: 'antes_dormir',     label: '😴 Antes de dormir',    color: '#818CF8' },
  { value: 'qualquer_hora',    label: '🕐 Qualquer hora',      color: '#9CA3AF' },
]

function timingLabel(v: string) {
  return TIMING_OPTIONS.find(o => o.value === v)?.label ?? v
}
function timingColor(v: string) {
  return TIMING_OPTIONS.find(o => o.value === v)?.color ?? '#9CA3AF'
}

const POPULAR_SUPPLEMENTS = [
  'Whey Protein', 'Creatina', 'BCAA', 'Glutamina', 'Cafeína', 'Beta-Alanina',
  'Ômega-3', 'Vitamina D', 'Vitamina C', 'Magnésio', 'Zinco', 'Vitamina B12',
  'Melatonina', 'Colágeno', 'Ferro', 'Cálcio', 'Pré-Treino', 'Termogênico',
]

const EMPTY_FORM = {
  name: '', brand: '', dosage: '', timing: 'qualquer_hora',
  with_food: false, instructions: '', start_date: '', end_date: '',
}

export default function SuplementosPage() {
  const params = useParams()
  const patientId = params.id as string

  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [nameSearch, setNameSearch] = useState('')

  const [patientName, setPatientName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/supplements?patient_id=${patientId}`)
    const data = await res.json()
    setSupplements(data.supplements ?? [])
    setLoading(false)
  }, [patientId])

  useEffect(() => {
    load()
    // Get patient name from breadcrumb
    fetch(`/api/patients/${patientId}`).then(r => r.json()).then(d => {
      setPatientName(d.patient?.full_name ?? '')
    }).catch(() => {})
  }, [patientId, load])

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setNameSearch('')
    setModalOpen(true)
  }

  function openEdit(s: Supplement) {
    setForm({
      name: s.name, brand: s.brand ?? '', dosage: s.dosage,
      timing: s.timing, with_food: s.with_food,
      instructions: s.instructions ?? '',
      start_date: s.start_date ?? '', end_date: s.end_date ?? '',
    })
    setEditId(s.id)
    setNameSearch(s.name)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.dosage.trim()) return
    setSaving(true)
    const body = {
      patient_id: patientId,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      dosage: form.dosage.trim(),
      timing: form.timing,
      with_food: form.with_food,
      instructions: form.instructions.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }

    if (editId) {
      await fetch(`/api/supplements/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/supplements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }

    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleToggleActive(s: Supplement) {
    await fetch(`/api/supplements/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !s.active }),
    })
    setSupplements(prev => prev.map(x => x.id === s.id ? { ...x, active: !s.active } : x))
  }

  // Group by timing
  const visible = supplements.filter(s => showInactive ? true : s.active)
  const grouped: Record<string, Supplement[]> = {}
  for (const s of visible) {
    if (!grouped[s.timing]) grouped[s.timing] = []
    grouped[s.timing].push(s)
  }
  const timingOrder = TIMING_OPTIONS.map(t => t.value).filter(v => grouped[v])

  const activeCount = supplements.filter(s => s.active).length

  // Popular name autocomplete
  const suggestions = nameSearch.length > 0
    ? POPULAR_SUPPLEMENTS.filter(n => n.toLowerCase().includes(nameSearch.toLowerCase())).slice(0, 5)
    : []

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patientId}`} className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {patientName || 'Paciente'}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
          <h1 className="text-base font-bold text-white">💊 Suplementos</h1>
          {activeCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}
            >
              {activeCount} ativo{activeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={showInactive
              ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {showInactive ? '👁 Mostrando inativos' : 'Mostrar inativos'}
          </button>
          <button onClick={openNew} className="btn btn-primary btn-sm">
            + Adicionar Suplemento
          </button>
        </div>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando...</div>
        ) : visible.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
          >
            <div className="text-5xl mb-4">💊</div>
            <p className="font-bold text-white text-lg mb-2">Nenhum suplemento prescrito</p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Prescreva suplementos e organize por horário do dia.
            </p>
            <button onClick={openNew} className="btn btn-primary">
              + Adicionar primeiro suplemento
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {timingOrder.map(timing => (
              <div key={timing}>
                {/* Timing group header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: timingColor(timing) + '20', color: timingColor(timing) }}
                  >
                    {timingLabel(timing)}
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'var(--dark-border)' }} />
                </div>

                {/* Supplements in this timing */}
                <div className="grid gap-2">
                  {grouped[timing].map(s => (
                    <div
                      key={s.id}
                      className="rounded-xl p-4 flex items-start gap-4 transition-all"
                      style={{
                        background: 'var(--dark-card)',
                        border: `1px solid ${s.active ? 'var(--dark-border)' : 'rgba(255,255,255,0.04)'}`,
                        opacity: s.active ? 1 : 0.45,
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: timingColor(s.timing) + '15' }}
                      >
                        💊
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{s.name}</span>
                          {s.brand && (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.brand}</span>
                          )}
                          {!s.active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}>
                              Inativo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs font-semibold" style={{ color: timingColor(s.timing) }}>
                            {s.dosage}
                          </span>
                          {s.with_food && (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              🍽 Com alimentos
                            </span>
                          )}
                          {s.start_date && (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              Desde {new Date(s.start_date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                          {s.end_date && (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              Até {new Date(s.end_date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>

                        {s.instructions && (
                          <p className="text-xs mt-1.5 italic" style={{ color: 'rgba(255,255,255,0.38)' }}>
                            {s.instructions}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEdit(s)}
                          className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleToggleActive(s)}
                          className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                          style={{
                            background: s.active ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
                            color: s.active ? '#34D399' : 'rgba(255,255,255,0.3)',
                          }}
                          title={s.active ? 'Desativar' : 'Reativar'}
                        >
                          {s.active ? '✓ Ativo' : '○ Inativo'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div
            className="relative rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            <div className="px-7 pt-7 pb-4 border-b" style={{ borderColor: 'var(--dark-border)' }}>
              <div className="font-black text-white text-lg tracking-tight">
                {editId ? 'Editar Suplemento' : 'Novo Suplemento'}
              </div>
            </div>

            <div className="overflow-y-auto px-7 py-5 space-y-4 flex-1">
              {/* Name with autocomplete */}
              <div className="relative">
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Nome do suplemento *</label>
                <input
                  type="text"
                  value={nameSearch}
                  onChange={e => { setNameSearch(e.target.value); setForm(p => ({ ...p, name: e.target.value })) }}
                  placeholder="ex: Whey Protein"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                    {suggestions.map(s => (
                      <button key={s} className="w-full text-left px-4 py-2 text-sm transition-all"
                        style={{ color: 'rgba(255,255,255,0.7)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                        onClick={() => { setNameSearch(s); setForm(p => ({ ...p, name: s })) }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Brand */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Marca (opcional)</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
                  placeholder="ex: Optimum Nutrition"
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                />
              </div>

              {/* Dosage */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Dose *</label>
                <input
                  type="text"
                  value={form.dosage}
                  onChange={e => setForm(p => ({ ...p, dosage: e.target.value }))}
                  placeholder="ex: 30g, 2 cápsulas, 5mg"
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                />
              </div>

              {/* Timing */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Horário</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TIMING_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setForm(p => ({ ...p, timing: t.value }))}
                      className="px-2 py-2 rounded-lg text-xs font-medium transition-all text-center"
                      style={form.timing === t.value
                        ? { background: t.color + '25', color: t.color, border: `1px solid ${t.color}50` }
                        : { background: 'var(--dark-surface)', color: 'rgba(255,255,255,0.35)', border: '1px solid var(--dark-border)' }
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* With food */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className="w-10 h-5 rounded-full relative transition-all flex-shrink-0"
                  style={{ background: form.with_food ? '#2563EB' : 'rgba(255,255,255,0.1)' }}
                  onClick={() => setForm(p => ({ ...p, with_food: !p.with_food }))}
                >
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: form.with_food ? '22px' : '2px' }} />
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Tomar com alimentos 🍽
                </span>
              </label>

              {/* Instructions */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Instruções adicionais</label>
                <textarea
                  value={form.instructions}
                  onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
                  placeholder="Instruções especiais para o paciente..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Início</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Fim (opcional)</label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)', colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>

            <div className="px-7 py-5 border-t flex gap-2 justify-end" style={{ borderColor: 'var(--dark-border)' }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.dosage.trim()}
                className="btn btn-primary btn-sm"
                style={{ opacity: saving || !form.name.trim() || !form.dosage.trim() ? 0.5 : 1 }}
              >
                {saving ? 'Salvando...' : editId ? 'Salvar alterações' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
