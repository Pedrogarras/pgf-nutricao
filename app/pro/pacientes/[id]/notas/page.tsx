'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Note {
  id: string
  date: string
  category: string
  title: string | null
  content: string
  created_at: string
  updated_at: string
}

const CATEGORIES = [
  { id: 'geral',        label: 'Geral',          icon: '📝', color: '#9CA3AF' },
  { id: 'consulta',     label: 'Consulta',       icon: '🏥', color: '#93C5FD' },
  { id: 'avaliacao',    label: 'Avaliação',      icon: '📊', color: '#34D399' },
  { id: 'laboratorio',  label: 'Exames',         icon: '🧪', color: '#FCD34D' },
  { id: 'intercorrencia', label: 'Intercorrência', icon: '⚠️', color: '#F87171' },
  { id: 'observacao',   label: 'Observação',     icon: '👁', color: '#C4B5FD' },
]

function catInfo(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0]
}

const EMPTY_FORM = { date: '', category: 'consulta', title: '', content: '' }

export default function NotasPage() {
  const params = useParams()
  const patientId = params.id as string

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [patientName, setPatientName] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const [notesRes, patRes] = await Promise.all([
      fetch(`/api/notes?patient_id=${patientId}`),
      fetch(`/api/patients/${patientId}`),
    ])
    const nd = await notesRes.json()
    const pd = await patRes.json().catch(() => ({}))
    setNotes(nd.notes ?? [])
    setPatientName(pd.patient?.full_name ?? '')
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0], category: 'consulta' })
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(n: Note) {
    setForm({ date: n.date, category: n.category, title: n.title ?? '', content: n.content })
    setEditId(n.id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.content.trim()) return
    setSaving(true)
    const body = {
      patient_id: patientId,
      date: form.date,
      category: form.category,
      title: form.title.trim() || null,
      content: form.content.trim(),
    }

    if (editId) {
      await fetch(`/api/notes/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
    setDeleteConfirm(null)
  }

  // Group by month
  const grouped: Record<string, Note[]> = {}
  for (const n of notes) {
    const key = n.date.slice(0, 7) // YYYY-MM
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(n)
  }
  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function fmtMonth(ym: string) {
    const [y, m] = ym.split('-')
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  function fmtDate(d: string) {
    return new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patientId}`} className="text-xs hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {patientName || 'Paciente'}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
          <h1 className="text-base font-bold text-white">📝 Notas Clínicas</h1>
          {notes.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
              {notes.length}
            </span>
          )}
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm">
          + Nova Nota
        </button>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando...</div>
        ) : notes.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
          >
            <div className="text-5xl mb-4">📝</div>
            <p className="font-bold text-white mb-2">Nenhuma nota clínica</p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Registre observações, resultados de exames e anotações das consultas.
            </p>
            <button onClick={openNew} className="btn btn-primary">+ Criar primeira nota</button>
          </div>
        ) : (
          <div className="max-w-2xl space-y-8">
            {months.map(month => (
              <div key={month}>
                {/* Month header */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-sm font-bold capitalize" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {fmtMonth(month)}
                  </h3>
                  <div className="flex-1 h-px" style={{ background: 'var(--dark-border)' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {grouped[month].length} nota{grouped[month].length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Notes in this month */}
                <div className="relative space-y-3">
                  {/* Timeline line */}
                  <div className="absolute left-[18px] top-6 bottom-2 w-px" style={{ background: 'var(--dark-border)' }} />

                  {grouped[month].map(note => {
                    const cat = catInfo(note.category)
                    const isExpanded = expanded.has(note.id)
                    const isLong = note.content.length > 200
                    return (
                      <div key={note.id} className="flex gap-4">
                        {/* Timeline dot */}
                        <div className="flex-shrink-0 mt-1.5">
                          <div
                            className="w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center text-[8px] relative z-10"
                            style={{ background: 'var(--dark-bg)', borderColor: cat.color, boxShadow: `0 0 6px ${cat.color}50` }}
                          />
                        </div>

                        {/* Note card */}
                        <div
                          className="flex-1 rounded-xl p-4 transition-all"
                          style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
                        >
                          {/* Note header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: cat.color + '15', color: cat.color }}
                              >
                                {cat.icon} {cat.label}
                              </span>
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {fmtDate(note.date)}
                              </span>
                              {note.updated_at !== note.created_at && (
                                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>editado</span>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => openEdit(note)}
                                className="text-xs px-2 py-1 rounded-lg transition-all"
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
                                ✏️
                              </button>
                              <button onClick={() => setDeleteConfirm(note.id)}
                                className="text-xs px-2 py-1 rounded-lg transition-all"
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}>
                                🗑
                              </button>
                            </div>
                          </div>

                          {/* Title */}
                          {note.title && (
                            <div className="text-sm font-semibold text-white mt-2">{note.title}</div>
                          )}

                          {/* Content */}
                          <div
                            className="text-sm mt-2 leading-relaxed whitespace-pre-wrap"
                            style={{ color: 'rgba(255,255,255,0.55)', overflow: isLong && !isExpanded ? 'hidden' : 'visible', maxHeight: isLong && !isExpanded ? '80px' : 'none' }}
                          >
                            {note.content}
                          </div>
                          {isLong && (
                            <button onClick={() => toggleExpand(note.id)}
                              className="text-xs mt-1 transition-colors"
                              style={{ color: '#93C5FD' }}>
                              {isExpanded ? '↑ Recolher' : '↓ Ver tudo'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
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
            className="relative rounded-2xl w-full max-w-lg shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            <div className="px-7 pt-7 pb-5">
              <div className="font-black text-white text-lg tracking-tight mb-5">
                {editId ? 'Editar Nota' : 'Nova Nota Clínica'}
              </div>

              <div className="space-y-4">
                {/* Date + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Data</label>
                    <input type="date" value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)', colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Categoria</label>
                    <select value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Título (opcional)</label>
                  <input type="text" value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="ex: Resultado exame de sangue, Ajuste do plano..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Conteúdo *</label>
                  <textarea
                    value={form.content}
                    onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                    placeholder="Anotações da consulta, observações clínicas, orientações dadas..."
                    rows={6}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.content.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ opacity: saving || !form.content.trim() ? 0.5 : 1 }}
                >
                  {saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar nota'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}>
          <div className="rounded-2xl p-7 w-full max-w-sm shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="text-lg font-bold text-white mb-2">Excluir nota?</div>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost btn-sm">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-sm"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
