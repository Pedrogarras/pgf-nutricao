'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Patient { id: string; full_name: string }
interface Consultation {
  id: string
  scheduled_at: string
  duration_min: number
  type: 'presencial' | 'online' | 'telefone'
  status: 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'faltou'
  notes: string | null
  patient: Patient | null
}

type Status = Consultation['status']
type ConsultType = Consultation['type']

const STATUS_LABELS: Record<Status, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado', faltou: 'Faltou',
}
const STATUS_COLORS: Record<Status, string> = {
  agendado: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmado: 'bg-green-50 text-green-700 border-green-200',
  realizado: 'bg-gray-50 text-gray-600 border-gray-200',
  cancelado: 'bg-red-50 text-red-500 border-red-200',
  faltou: 'bg-amber-50 text-amber-700 border-amber-200',
}
const TYPE_LABELS: Record<ConsultType, string> = { presencial: '🏥 Presencial', online: '💻 Online', telefone: '📞 Telefone' }

function emptyForm(date?: string): { patient_id: string; date: string; time: string; duration_min: number; type: ConsultType; status: Status; notes: string } {
  const now = new Date()
  return {
    patient_id: '',
    date: date ?? now.toISOString().split('T')[0],
    time: '09:00',
    duration_min: 60,
    type: 'presencial',
    status: 'agendado',
    notes: '',
  }
}

export default function AgendaClient({ patients, initialMonth }: { patients: Patient[]; initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth) // YYYY-MM
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  const fetchConsultations = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/consultations?month=${month}`)
    const data = await res.json()
    setConsultations(data.consultations ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchConsultations() }, [fetchConsultations])

  function openAdd(date?: string) {
    setEditingId(null)
    setForm(emptyForm(date))
    setModalOpen(true)
  }

  function openEdit(c: Consultation) {
    const dt = new Date(c.scheduled_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    setEditingId(c.id)
    setForm({
      patient_id: c.patient?.id ?? '',
      date: dt.toISOString().split('T')[0],
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
      duration_min: c.duration_min,
      type: c.type,
      status: c.status,
      notes: c.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString()
    const payload = {
      patient_id: form.patient_id || null,
      scheduled_at,
      duration_min: form.duration_min,
      type: form.type,
      status: form.status,
      notes: form.notes || null,
    }
    const res = editingId
      ? await fetch(`/api/consultations/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/consultations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.consultation) {
      if (editingId) setConsultations(prev => prev.map(c => c.id === editingId ? data.consultation : c).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
      else setConsultations(prev => [...prev, data.consultation].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    }
    setSaving(false)
    setModalOpen(false)
  }

  async function handleDelete(c: Consultation) {
    if (!confirm(`Excluir consulta de ${c.patient?.full_name ?? 'paciente'}?`)) return
    setDeletingId(c.id)
    await fetch(`/api/consultations/${c.id}`, { method: 'DELETE' })
    setConsultations(prev => prev.filter(x => x.id !== c.id))
    setDeletingId(null)
  }

  async function updateStatus(id: string, status: Status) {
    const res = await fetch(`/api/consultations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const data = await res.json()
    if (data.consultation) setConsultations(prev => prev.map(c => c.id === id ? data.consultation : c))
  }

  function prevMonth() {
    const [y, m] = month.split('-').map(Number)
    if (m === 1) setMonth(`${y - 1}-12`)
    else setMonth(`${y}-${String(m - 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = month.split('-').map(Number)
    if (m === 12) setMonth(`${y + 1}-01`)
    else setMonth(`${y}-${String(m + 1).padStart(2, '0')}`)
  }

  const [year, monthNum] = month.split('-').map(Number)
  const monthName = new Date(year, monthNum - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function fmtTime(iso: string) {
    const dt = new Date(iso)
    return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Group by date for list view
  const byDate: Record<string, Consultation[]> = {}
  for (const c of consultations) {
    const d = c.scheduled_at.split('T')[0]
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(c)
  }

  // Calendar grid
  const firstDay = new Date(year, monthNum - 1, 1)
  const lastDay = new Date(year, monthNum, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Monday = 0
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7
  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length < totalCells) cells.push(null)
  const today = new Date().toISOString().split('T')[0]

  const stats = {
    total: consultations.length,
    realizadas: consultations.filter(c => c.status === 'realizado').length,
    pendentes: consultations.filter(c => c.status === 'agendado' || c.status === 'confirmado').length,
    faltaram: consultations.filter(c => c.status === 'faltou').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-40 px-8 h-14 flex items-center justify-between" style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-bold text-white">Agenda</h1>
            <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>{monthName}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="btn btn-ghost btn-sm px-2 py-1">‹</button>
            <button onClick={() => setMonth(new Date().toISOString().slice(0, 7))} className="btn btn-ghost btn-sm text-xs">Hoje</button>
            <button onClick={nextMonth} className="btn btn-ghost btn-sm px-2 py-1">›</button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setView('list')} className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`}>Lista</button>
            <button onClick={() => setView('calendar')} className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}>Calendário</button>
          </div>
        </div>
        <button onClick={() => openAdd()} className="btn btn-primary">+ Nova Consulta</button>
      </div>

      <div className="p-8">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Realizadas', value: stats.realizadas, color: 'text-green-600' },
            { label: 'Pendentes', value: stats.pendentes, color: 'text-blue-600' },
            { label: 'Faltaram', value: stats.faltaram, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="text-xs text-gray-400 mb-1">{s.label}</div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando...</div>
        ) : view === 'calendar' ? (
          /* ── Calendar view ── */
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="px-2 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="border-r border-b border-gray-50 min-h-[80px] bg-gray-50/40" />
                const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayConsults = byDate[dateStr] ?? []
                const isToday = dateStr === today
                return (
                  <div key={i} className="border-r border-b border-gray-50 min-h-[80px] p-1.5 hover:bg-pgf-50/20 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-pgf-600 text-white' : 'text-gray-600'}`}>
                        {day}
                      </span>
                      <button onClick={() => openAdd(dateStr)} className="opacity-0 hover:opacity-100 text-gray-300 hover:text-pgf-500 transition-all text-xs leading-none w-5 h-5 flex items-center justify-center rounded">+</button>
                    </div>
                    {dayConsults.map(c => (
                      <div
                        key={c.id}
                        onClick={() => openEdit(c)}
                        className="cursor-pointer text-[10px] mb-0.5 px-1.5 py-0.5 rounded truncate font-medium"
                        style={{
                          background: c.status === 'realizado' ? 'rgba(16,185,129,0.08)' : c.status === 'cancelado' ? 'rgba(239,68,68,0.08)' : c.status === 'faltou' ? 'rgba(245,158,11,0.1)' : 'rgba(37,99,235,0.08)',
                          color: c.status === 'realizado' ? '#059669' : c.status === 'cancelado' ? '#dc2626' : c.status === 'faltou' ? '#b45309' : '#1d4ed8',
                          border: `1px solid ${c.status === 'realizado' ? 'rgba(16,185,129,0.2)' : c.status === 'cancelado' ? 'rgba(239,68,68,0.2)' : c.status === 'faltou' ? 'rgba(245,158,11,0.2)' : 'rgba(37,99,235,0.2)'}`,
                        }}
                      >
                        {fmtTime(c.scheduled_at)} {c.patient?.full_name.split(' ')[0] ?? '—'}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ── List view ── */
          consultations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="font-semibold text-gray-500 mb-1">Nenhuma consulta em {monthName}</div>
              <div className="text-sm text-gray-400 mb-4">Agende a primeira consulta do mês</div>
              <button onClick={() => openAdd()} className="btn btn-primary">+ Nova Consulta</button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(byDate).sort().map(([date, dayConsults]) => (
                <div key={date}>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
                    <span>{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    {date === today && <span className="badge badge-blue text-[9px] py-0">Hoje</span>}
                  </div>
                  <div className="card divide-y divide-gray-50">
                    {dayConsults.map(c => (
                      <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-pgf-50/20 group transition-colors">
                        {/* Time */}
                        <div className="text-sm font-bold text-gray-700 w-14 flex-shrink-0 pt-0.5">
                          {fmtTime(c.scheduled_at)}
                        </div>
                        {/* Main */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">
                              {c.patient ? (
                                <Link href={`/pro/pacientes/${c.patient.id}`} className="hover:text-pgf-600">{c.patient.full_name}</Link>
                              ) : '(sem paciente)'}
                            </span>
                            <span className="text-xs text-gray-400">{c.duration_min} min</span>
                            <span className="text-xs text-gray-400">{TYPE_LABELS[c.type]}</span>
                          </div>
                          {c.notes && <div className="text-xs text-gray-400 mt-0.5 truncate">{c.notes}</div>}
                          {/* Quick status change */}
                          <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(['agendado', 'confirmado', 'realizado', 'faltou', 'cancelado'] as Status[]).map(s => (
                              <button
                                key={s}
                                onClick={() => updateStatus(c.id, s)}
                                className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-all ${c.status === s ? STATUS_COLORS[s] + ' ring-1 ring-offset-0' : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'}`}
                              >
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Status badge + actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status]}`}>
                            {STATUS_LABELS[c.status]}
                          </span>
                          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                            <button onClick={() => openEdit(c)} className="text-gray-300 hover:text-pgf-500 transition-colors" title="Editar">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(c)} disabled={deletingId === c.id} className="text-gray-200 hover:text-red-400 transition-colors" title="Excluir">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">{editingId ? 'Editar Consulta' : 'Nova Consulta'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="form-label">Paciente</label>
                <select value={form.patient_id} onChange={e => setForm(p => ({ ...p, patient_id: e.target.value }))} className="form-select">
                  <option value="">Sem paciente vinculado</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Data *</label>
                  <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="form-input" style={{ colorScheme: 'light' }} />
                </div>
                <div>
                  <label className="form-label">Horário *</label>
                  <input required type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className="form-input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Duração (min)</label>
                  <select value={form.duration_min} onChange={e => setForm(p => ({ ...p, duration_min: Number(e.target.value) }))} className="form-select">
                    {[30, 45, 60, 75, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Modalidade</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ConsultType }))} className="form-select">
                    <option value="presencial">🏥 Presencial</option>
                    <option value="online">💻 Online</option>
                    <option value="telefone">📞 Telefone</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))} className="form-select">
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="realizado">Realizado</option>
                  <option value="faltou">Faltou</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="form-label">Anotações</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="form-input" placeholder="Objetivos da consulta, lembretes..." />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Agendar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
