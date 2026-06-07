'use client'
import { useState, useEffect, useCallback } from 'react'

interface MessageTemplate {
  id: string
  name: string
  category: string
  content: string
  variables: string[]
  active: boolean
}

const CATEGORIES = [
  { id: 'todos',      label: 'Todos',       emoji: '📋' },
  { id: 'geral',      label: 'Geral',       emoji: '💬' },
  { id: 'check_in',   label: 'Check-in',    emoji: '⚖️' },
  { id: 'motivacao',  label: 'Motivação',   emoji: '🌟' },
  { id: 'retorno',    label: 'Retorno',     emoji: '📅' },
  { id: 'dieta',      label: 'Dieta',       emoji: '🥗' },
  { id: 'treino',     label: 'Treino',      emoji: '🏋️' },
]

const CATEGORY_COLORS: Record<string, string> = {
  geral:      'rgba(156,163,175,0.15)',
  check_in:   'rgba(37,99,235,0.15)',
  motivacao:  'rgba(245,158,11,0.15)',
  retorno:    'rgba(139,92,246,0.15)',
  dieta:      'rgba(16,185,129,0.15)',
  treino:     'rgba(239,68,68,0.15)',
}
const CATEGORY_TEXT: Record<string, string> = {
  geral:     '#9CA3AF', check_in: '#93C5FD', motivacao: '#FCD34D',
  retorno:   '#C4B5FD', dieta:    '#6EE7B7', treino:    '#FCA5A5',
}

function formatPhone(phone: string) {
  // Remove all non-digits
  return phone.replace(/\D/g, '')
}

export default function MensagensPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('todos')

  // "Usar template" modal state
  const [useModal, setUseModal] = useState<MessageTemplate | null>(null)
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const [previewText, setPreviewText] = useState('')

  // Create/Edit modal
  const [editModal, setEditModal] = useState<Partial<MessageTemplate> | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/message-templates')
    const data = await res.json()
    setTemplates(data.templates ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  // Auto-preview whenever vars change
  useEffect(() => {
    if (!useModal) { setPreviewText(''); return }
    let text = useModal.content
    // Replace {{nome}} with patient name
    if (patientName) text = text.replace(/\{\{nome\}\}/g, patientName)
    // Replace other variables
    Object.entries(varValues).forEach(([k, v]) => {
      if (v) text = text.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v)
    })
    setPreviewText(text)
  }, [useModal, patientName, varValues])

  function openUseModal(t: MessageTemplate) {
    setUseModal(t)
    setPatientName('')
    setPatientPhone('')
    const initVars: Record<string, string> = {}
    t.variables.filter(v => v !== '{{nome}}').forEach(v => { initVars[v] = '' })
    setVarValues(initVars)
    setPreviewText(t.content)
  }

  function buildWhatsAppLink() {
    const phone = formatPhone(patientPhone)
    const text = encodeURIComponent(previewText)
    return `https://wa.me/55${phone}?text=${text}`
  }

  function openEditModal(t?: MessageTemplate) {
    if (t) {
      setEditModal({ ...t })
    } else {
      setEditModal({ name: '', category: 'geral', content: '', variables: [], active: true })
    }
  }

  function detectVariables(content: string): string[] {
    const matches = content.match(/\{\{[^}]+\}\}/g) ?? []
    return [...new Set(matches)]
  }

  async function handleSave() {
    if (!editModal || !editModal.name?.trim() || !editModal.content?.trim()) return
    setSaving(true)
    const vars = detectVariables(editModal.content ?? '')
    const body = { name: editModal.name, category: editModal.category, content: editModal.content, variables: vars }

    if (editModal.id) {
      await fetch(`/api/message-templates/${editModal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/message-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    setEditModal(null)
    loadTemplates()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/message-templates/${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
  }

  const filtered = activeCategory === 'todos' ? templates : templates.filter(t => t.category === activeCategory)
  const catInfo = CATEGORIES.find(c => c.id === activeCategory)

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <h1 className="text-base font-bold text-white">Templates de Mensagem</h1>
        <div className="flex items-center gap-2">
          <a href="/pro/mensagens/enviar"
            className="btn btn-sm"
            style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}>
            📣 Envio em Massa
          </a>
          <button onClick={() => openEditModal()} className="btn btn-primary btn-sm">
            + Novo Template
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Category tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {CATEGORIES.map(cat => {
            const count = cat.id === 'todos' ? templates.length : templates.filter(t => t.category === cat.id).length
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={activeCategory === cat.id
                  ? { background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.4)' }
                  : { background: 'var(--dark-card)', color: 'rgba(255,255,255,0.45)', border: '1px solid var(--dark-border)' }
                }
              >
                {cat.emoji} {cat.label}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando templates...</div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
          >
            <div className="text-4xl mb-3">💬</div>
            <p className="font-semibold text-white mb-1">Nenhum template</p>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Crie templates prontos para agilizar sua comunicação com pacientes.
            </p>
            <button onClick={() => openEditModal()} className="btn btn-primary btn-sm">
              + Criar primeiro template
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(t => {
              const catData = CATEGORIES.find(c => c.id === t.category)
              return (
                <div
                  key={t.id}
                  className="rounded-2xl p-5 transition-all"
                  style={{
                    background: 'var(--dark-card)',
                    border: '1px solid var(--dark-border)',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{t.name}</span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: CATEGORY_COLORS[t.category] ?? 'rgba(255,255,255,0.08)', color: CATEGORY_TEXT[t.category] ?? '#9CA3AF' }}
                        >
                          {catData?.emoji} {catData?.label ?? t.category}
                        </span>
                        {t.variables.length > 0 && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#FCD34D' }}
                          >
                            {t.variables.length} variável{t.variables.length !== 1 ? 'is' : ''}
                          </span>
                        )}
                      </div>

                      {/* Content preview */}
                      <p
                        className="text-xs leading-relaxed whitespace-pre-wrap line-clamp-3"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                      >
                        {t.content}
                      </p>

                      {/* Variables chips */}
                      {t.variables.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {t.variables.map(v => (
                            <span
                              key={v}
                              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                              style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => openUseModal(t)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
                      >
                        💬 Usar
                      </button>
                      <button
                        onClick={() => openEditModal(t)}
                        className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(t.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── "Usar template" Modal ── */}
      {useModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && setUseModal(null)}
        >
          <div
            className="relative rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            {/* Modal header */}
            <div className="px-7 pt-7 pb-4 border-b" style={{ borderColor: 'var(--dark-border)' }}>
              <div className="font-black text-white text-lg tracking-tight mb-0.5">💬 Usar Template</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>{useModal.name}</div>
            </div>

            <div className="overflow-y-auto px-7 py-5 space-y-4 flex-1">
              {/* Patient info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Nome do Paciente</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={e => setPatientName(e.target.value)}
                    placeholder="ex: Maria Silva"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>WhatsApp (com DDD)</label>
                  <input
                    type="tel"
                    value={patientPhone}
                    onChange={e => setPatientPhone(e.target.value)}
                    placeholder="(51) 99999-0000"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  />
                </div>
              </div>

              {/* Other variables */}
              {Object.keys(varValues).length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Preencha as variáveis</div>
                  <div className="space-y-2">
                    {Object.keys(varValues).map(varKey => (
                      <div key={varKey} className="flex items-center gap-3">
                        <span
                          className="text-[10px] font-mono px-2 py-1 rounded flex-shrink-0 min-w-[120px]"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}
                        >
                          {varKey}
                        </span>
                        <input
                          type="text"
                          value={varValues[varKey]}
                          onChange={e => setVarValues(prev => ({ ...prev, [varKey]: e.target.value }))}
                          placeholder={`Valor para ${varKey}`}
                          className="flex-1 px-3 py-1.5 rounded-lg text-sm text-white outline-none"
                          style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-[2px] uppercase"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Prévia da mensagem</span>
                  <button
                    onClick={() => navigator.clipboard?.writeText(previewText)}
                    className="text-[10px] px-2 py-1 rounded-lg transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    📋 Copiar
                  </button>
                </div>
                <div
                  className="rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed"
                  style={{ background: 'rgba(18,222,107,0.06)', border: '1px solid rgba(18,222,107,0.15)', color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui', maxHeight: '220px', overflowY: 'auto' }}
                >
                  {previewText || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Preencha as variáveis para ver a prévia...</span>}
                </div>
              </div>

              {/* WhatsApp deep link hint */}
              {patientPhone && (
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ background: 'rgba(18,222,107,0.08)', border: '1px solid rgba(18,222,107,0.2)', color: '#6EE7B7' }}
                >
                  📱 WhatsApp pronto para: +55 {formatPhone(patientPhone)}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t flex gap-3 justify-between items-center" style={{ borderColor: 'var(--dark-border)' }}>
              <button
                onClick={() => setUseModal(null)}
                className="btn btn-ghost btn-sm"
              >
                Fechar
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(previewText)
                    // Brief visual feedback handled by browser
                  }}
                  className="btn btn-outline btn-sm"
                >
                  📋 Copiar texto
                </button>
                {patientPhone && (
                  <a
                    href={buildWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    style={{ background: '#25D366', color: '#fff' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.118 1.528 5.845L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-4.999-1.364l-.359-.213-3.712.968.992-3.614-.233-.372A9.818 9.818 0 112.182 12c0-5.42 4.41-9.818 9.818-9.818s9.818 4.398 9.818 9.818-4.398 9.818-9.818 9.818z"/>
                    </svg>
                    Enviar no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Template Modal ── */}
      {editModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && setEditModal(null)}
        >
          <div
            className="relative rounded-2xl w-full max-w-lg shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            <div className="px-7 pt-7 pb-5">
              <div className="font-black text-white text-lg tracking-tight mb-5">
                {editModal.id ? 'Editar Template' : 'Novo Template'}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Nome</label>
                    <input
                      type="text"
                      value={editModal.name ?? ''}
                      onChange={e => setEditModal(prev => ({ ...prev!, name: e.target.value }))}
                      placeholder="Nome do template"
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>Categoria</label>
                    <select
                      value={editModal.category ?? 'geral'}
                      onChange={e => setEditModal(prev => ({ ...prev!, category: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                    >
                      {CATEGORIES.filter(c => c.id !== 'todos').map(c => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Mensagem
                    <span className="ml-2 normal-case font-normal" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      use {'{{nome}}'}, {'{{peso}}'} etc. para variáveis
                    </span>
                  </label>
                  <textarea
                    value={editModal.content ?? ''}
                    onChange={e => setEditModal(prev => ({ ...prev!, content: e.target.value }))}
                    placeholder={`Olá {{nome}}!\n\nSua mensagem aqui...`}
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none font-mono"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)', fontSize: '13px' }}
                  />
                </div>

                {/* Detected variables preview */}
                {editModal.content && detectVariables(editModal.content).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-500">Variáveis detectadas:</span>
                    {detectVariables(editModal.content).map(v => (
                      <span key={v} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}>
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button onClick={() => setEditModal(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editModal.name?.trim() || !editModal.content?.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ opacity: saving || !editModal.name?.trim() || !editModal.content?.trim() ? 0.5 : 1 }}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
        >
          <div
            className="rounded-2xl p-7 w-full max-w-sm shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="text-lg font-bold text-white mb-2">Excluir template?</div>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              O template será removido da sua biblioteca.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost btn-sm">Cancelar</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="btn btn-sm"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
