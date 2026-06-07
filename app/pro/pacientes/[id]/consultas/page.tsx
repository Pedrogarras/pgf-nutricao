'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Status = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'faltou'
type CType = 'presencial' | 'online' | 'telefone'

interface Consultation {
  id: string
  scheduled_at: string
  duration_min: number
  type: CType
  status: Status
  notes: string | null
}

const STATUS_MAP: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  agendado:  { label: 'Agendado',  color: '#93C5FD', bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.3)'  },
  confirmado:{ label: 'Confirmado',color: '#4ade80', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.28)' },
  realizado: { label: 'Realizado', color: '#a3a3a3', bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.1)'},
  cancelado: { label: 'Cancelado', color: '#f87171', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)' },
  faltou:    { label: 'Faltou',    color: '#fbbf24', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)'},
}

const TYPE_MAP: Record<CType, string> = {
  presencial: '🏥 Presencial',
  online:     '💻 Online',
  telefone:   '📞 Telefone',
}

function pad(n: number) { return String(n).padStart(2, '0') }

function emptyForm() {
  const now = new Date()
  return {
    date: now.toISOString().split('T')[0],
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    duration_min: 60,
    type: 'presencial' as CType,
    status: 'agendado' as Status,
    notes: '',
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtRelative(iso: string) {
  const now = new Date()
  const d = new Date(iso)
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Amanhã'
  if (diffDays === -1) return 'Ontem'
  if (diffDays > 0) return `em ${diffDays}d`
  return `há ${Math.abs(diffDays)}d`
}

export default function PatientConsultasPage() {
  const params = useParams()
  const patientId = params.id as string

  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [patientName, setPatientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/consultations?patient_id=${patientId}&limit=100`)
    const data = await res.json()
    setConsultations(data.consultations ?? [])
    if (data.patient_name) setPatientName(data.patient_name)
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(c: Consultation) {
    const d = new Date(c.scheduled_at)
    setEditingId(c.id)
    setForm({
      date: d.toISOString().split('T')[0],
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      duration_min: c.duration_min,
      type: c.type,
      status: c.status,
      notes: c.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const scheduled_at = `${form.date}T${form.time}:00`
    const body = { patient_id: patientId, scheduled_at, duration_min: form.duration_min, type: form.type, status: form.status, notes: form.notes || null }
    if (editingId) {
      await fetch(`/api/consultations/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/consultations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta consulta?')) return
    setDeletingId(id)
    await fetch(`/api/consultations/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    load()
  }

  async function patchStatus(id: string, status: Status) {
    await fetch(`/api/consultations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setConsultations(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const upcoming = consultations
    .filter(c => ['agendado', 'confirmado'].includes(c.status) && new Date(c.scheduled_at) >= new Date())
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))

  const filtered = consultations.filter(c => statusFilter === 'all' || c.status === statusFilter)
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))

  const stats = {
    total: consultations.length,
    agendado:   consultations.filter(c => c.status === 'agendado').length,
    confirmado: consultations.filter(c => c.status === 'confirmado').length,
    realizado:  consultations.filter(c => c.status === 'realizado').length,
    cancelado:  consultations.filter(c => c.status === 'cancelado').length,
    faltou:     consultations.filter(c => c.status === 'faltou').length,
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-6 h-14 flex items-center gap-3"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <Link href={`/pro/pacientes/${patientId}`} className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
          ← {patientName || 'Paciente'}
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-sm font-semibold text-white">📅 Consultas</span>
        <div className="ml-auto">
          <button onClick={openAdd}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.35)' }}>
            + Nova Consulta
          </button>
        </div>
      </div>

      <div className="p-6 max-w-3xl">
        {/* Next upcoming card */}
        {upcoming.length > 0 && (() => {
          const next = upcoming[0]
          const st = STATUS_MAP[next.status]
          return (
            <div className="rounded-2xl p-5 mb-6 relative overflow-hidden"
              style={{ background: st.bg, border: `1px solid ${st.border}` }}>
              <div className="absolute top-0 left-8 right-8 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${st.color}, transparent)` }} />
              <div className="text-[10px] font-bold uppercase tracking-[2px] mb-2" style={{ color: st.color }}>
                Próxima consulta
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xl font-black text-white">{fmtDate(next.scheduled_at)}</div>
                  <div className="text-base font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {fmtTime(next.scheduled_at)} · {next.duration_min} min · {TYPE_MAP[next.type]}
                  </div>
                  {next.notes && (
                    <div className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{next.notes}</div>
                  )}
                </div>
                <div className="text-center flex-shrink-0">
                  <div className="text-3xl font-black" style={{ color: st.color }}>{fmtRelative(next.scheduled_at)}</div>
                  <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(next.scheduled_at) > new Date() ? 'contagem' : 'status'}
                  </div>
                </div>
              </div>
              {/* Status quick-change */}
              <div className="flex gap-2 mt-4">
                {(['confirmado', 'realizado', 'cancelado', 'faltou'] as Status[]).map(s => (
                  <button key={s} onClick={() => patchStatus(next.id, s)}
                    disabled={next.status === s}
                    className="flex-1 py-1 rounded-lg text-[10px] font-bold transition-all"
                    style={next.status === s ? {
                      background: STATUS_MAP[s].bg, color: STATUS_MAP[s].color, border: `1px solid ${STATUS_MAP[s].border}`,
                    } : {
                      background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                    {STATUS_MAP[s].label}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Stats strip */}
        {stats.total > 0 && (
          <div className="grid grid-cols-5 gap-2 mb-6">
            {([
              { key: 'realizado',  label: 'Realizadas', },
              { key: 'agendado',   label: 'Agendadas', },
              { key: 'confirmado', label: 'Confirmadas', },
              { key: 'cancelado',  label: 'Canceladas', },
              { key: 'faltou',     label: 'Faltas', },
            ] as { key: Status; label: string }[]).map(s => {
              const st = STATUS_MAP[s.key]
              const count = stats[s.key]
              return (
                <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
                  className="rounded-xl p-3 text-center transition-all"
                  style={statusFilter === s.key ? {
                    background: st.bg, border: `1px solid ${st.border}`,
                  } : {
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <div className="text-xl font-black" style={{ color: statusFilter === s.key ? st.color : 'rgba(255,255,255,0.6)' }}>
                    {count}
                  </div>
                  <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {s.label}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📅</div>
            <div className="font-bold text-white">Nenhuma consulta encontrada</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {statusFilter !== 'all' ? 'Tente outro filtro' : 'Agende a primeira consulta.'}
            </div>
            <button onClick={openAdd} className="mt-4 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.35)' }}>
              + Agendar Consulta
            </button>
          </div>
        ) : (
          <>
            {statusFilter !== 'all' && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Filtro: {STATUS_MAP[statusFilter].label} ({filtered.length})
                </span>
                <button onClick={() => setStatusFilter('all')} className="text-xs" style={{ color: '#93C5FD' }}>
                  × limpar
                </button>
              </div>
            )}
            <div className="space-y-2">
              {filtered.map(c => {
                const st = STATUS_MAP[c.status]
                const expanded = expandedId === c.id
                const isPast = new Date(c.scheduled_at) < new Date()
                return (
                  <div key={c.id} className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${expanded ? st.border : 'rgba(255,255,255,0.07)'}`, background: 'rgba(255,255,255,0.02)' }}>
                    <button className="w-full text-left px-4 py-3 flex items-center gap-4"
                      onClick={() => setExpandedId(expanded ? null : c.id)}>
                      {/* Date block */}
                      <div className="flex-shrink-0 text-center w-12">
                        <div className="text-base font-black text-white leading-none">
                          {new Date(c.scheduled_at).getDate()}
                        </div>
                        <div className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {new Date(c.scheduled_at).toLocaleDateString('pt-BR', { month: 'short' })}
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {fmtTime(c.scheduled_at)} · {c.duration_min} min
                          </span>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{TYPE_MAP[c.type]}</span>
                        </div>
                        {c.notes && !expanded && (
                          <div className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{c.notes}</div>
                        )}
                      </div>
                      {/* Status badge + relative date */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                          {st.label}
                        </span>
                        <span className="text-[10px]" style={{ color: isPast ? 'rgba(255,255,255,0.25)' : '#93C5FD' }}>
                          {fmtRelative(c.scheduled_at)}
                        </span>
                      </div>
                      <span className="text-sm flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {expanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {c.notes && (
                          <div className="mb-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            {c.notes}
                          </div>
                        )}
                        {/* Status change buttons */}
                        <div className="text-[10px] font-bold uppercase tracking-[2px] mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          Alterar status
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(['agendado', 'confirmado', 'realizado', 'cancelado', 'faltou'] as Status[]).map(s => (
                            <button key={s} onClick={() => patchStatus(c.id, s)}
                              disabled={c.status === s}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                              style={c.status === s ? {
                                background: STATUS_MAP[s].bg, color: STATUS_MAP[s].color, border: `1px solid ${STATUS_MAP[s].border}`,
                              } : {
                                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                              }}>
                              {STATUS_MAP[s].label}
                            </button>
                          ))}
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(c)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.09)' }}>
                            ✏️ Editar
                          </button>
                          <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {deletingId === c.id ? '...' : '🗑 Excluir'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="relative rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}>
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />
            <div className="px-6 py-5">
              <div className="font-black text-white text-base mb-5">
                {editingId ? '✏️ Editar Consulta' : '📅 Nova Consulta'}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Data</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Horário</label>
                  <input type="time" value={form.time}
                    onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Tipo</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as CType }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}>
                    <option value="presencial">🏥 Presencial</option>
                    <option value="online">💻 Online</option>
                    <option value="telefone">📞 Telefone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Duração (min)</label>
                  <input type="number" min="15" max="240" value={form.duration_min}
                    onChange={e => setForm(p => ({ ...p, duration_min: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}>
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="realizado">Realizado</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="faltou">Faltou</option>
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-[10px] font-bold uppercase tracking-[2px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} placeholder="Observações, queixas, orientações..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.4)' }}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Agendar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
