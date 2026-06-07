'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

type Patient = {
  id: string
  full_name: string
  phone: string
  loggedThisWeek: boolean
  hasUpcomingConsult: boolean
  birthdayInDays: number | null
  hasBirthdaySoon: boolean
}

type Template = {
  id: string
  name: string
  content: string
  category: string
}

const FILTERS = [
  { id: 'all',             label: '👥 Todos',                  fn: (_p: Patient) => true },
  { id: 'no_diary',        label: '📔 Sem diário (7d)',         fn: (p: Patient) => !p.loggedThisWeek },
  { id: 'with_diary',      label: '✅ Com diário (7d)',         fn: (p: Patient) => p.loggedThisWeek },
  { id: 'upcoming_consult',label: '📅 Consulta esta semana',   fn: (p: Patient) => p.hasUpcomingConsult },
  { id: 'birthday_soon',   label: '🎂 Aniversário (7d)',       fn: (p: Patient) => p.hasBirthdaySoon },
]

// Built-in quick messages
const QUICK_MESSAGES = [
  {
    label: '💪 Motivação segunda',
    text: 'Boa semana, {{nome}}! 💪\n\nLembre-se: cada escolha alimentar correta te aproxima do seu objetivo. Vamos com tudo essa semana! 🌱\n\n_Pedro Garrastazu Frey – Nutricionista_',
  },
  {
    label: '📔 Lembrete diário',
    text: 'Oi, {{nome}}! 😊\n\nNão esqueça de registrar seu diário alimentar de hoje no app. Esse acompanhamento é fundamental para o seu resultado! 📝\n\n_Pedro Garrastazu Frey – Nutricionista_',
  },
  {
    label: '💧 Lembrete água',
    text: 'Oi, {{nome}}! 💧\n\nHidratação é fundamental! Lembre-se de tomar água ao longo do dia — a meta é atingir seu objetivo diário. Seu corpo agradece! 🌊\n\n_Pedro Garrastazu Frey – Nutricionista_',
  },
  {
    label: '🎉 Parabenização',
    text: 'Parabéns, {{nome}}! 🎉\n\nVocê está de parabéns pela dedicação ao plano! Continue assim — os resultados são fruto da consistência. Orgulho de acompanhar sua jornada! 🏆\n\n_Pedro Garrastazu Frey – Nutricionista_',
  },
  {
    label: '📅 Lembrete consulta',
    text: 'Oi, {{nome}}! 📅\n\nSua próxima consulta está chegando! Para aproveitar ao máximo, lembre de:\n• Registrar o diário dos últimos dias\n• Pesar-se na manhã do dia\n• Anotar dúvidas que surgirem\n\nAté lá! 😊\n\n_Pedro Garrastazu Frey – Nutricionista_',
  },
  {
    label: '🎂 Feliz aniversário',
    text: '🎂 Feliz aniversário, {{nome}}!\n\nQue este novo ano de vida seja repleto de saúde, conquistas e muita energia! É uma honra acompanhar sua jornada de bem-estar.\n\nParabéns! 🎉\n\n_Pedro Garrastazu Frey – Nutricionista_',
  },
]

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '')
  const number = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export default function BroadcastClient({ patients, templates }: { patients: Patient[]; templates: Template[] }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [showCustom, setShowCustom] = useState(false)

  const visiblePatients = useMemo(() =>
    patients.filter(FILTERS.find(f => f.id === activeFilter)?.fn ?? (() => true)),
    [patients, activeFilter]
  )

  // Select all visible by default when filter changes
  const handleFilterChange = (fid: string) => {
    setActiveFilter(fid)
    const newVisible = patients.filter(FILTERS.find(f => f.id === fid)?.fn ?? (() => true))
    setSelectedIds(new Set(newVisible.map(p => p.id)))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll  = () => setSelectedIds(new Set(visiblePatients.map(p => p.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const selectedPatients = visiblePatients.filter(p => selectedIds.has(p.id))

  function buildMessage(patient: Patient) {
    return message.replace(/\{\{nome\}\}/g, patient.full_name.split(' ')[0])
  }

  function markSent(id: string) {
    setSent(prev => new Set([...prev, id]))
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/pro/mensagens" className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Mensagens</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-xs font-semibold text-white">Envio em Massa</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">📣 Envio em Massa</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Gere links WhatsApp para múltiplos pacientes de uma vez
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr,380px] gap-6">

        {/* Left: Compose */}
        <div className="space-y-5">

          {/* Filters */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              1. Selecione os destinatários
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {FILTERS.map(f => {
                const count = patients.filter(f.fn).length
                return (
                  <button key={f.id}
                    onClick={() => handleFilterChange(f.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: activeFilter === f.id ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                      color: activeFilter === f.id ? '#fff' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${activeFilter === f.id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {f.label} <span style={{ opacity: 0.5 }}>({count})</span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {visiblePatients.length} paciente{visiblePatients.length !== 1 ? 's' : ''} no filtro
                {' · '}{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(37,99,235,0.1)', color: '#93C5FD' }}>
                  Todos
                </button>
                <button onClick={deselectAll} className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                  Nenhum
                </button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {visiblePatients.map(p => (
                <label key={p.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: selectedIds.has(p.id) ? 'rgba(37,99,235,0.07)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedIds.has(p.id) ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                    className="w-4 h-4 rounded accent-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.full_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!p.loggedThisWeek && <span className="text-[10px]" style={{ color: '#F87171' }}>sem diário</span>}
                      {p.hasUpcomingConsult && <span className="text-[10px]" style={{ color: '#93C5FD' }}>consulta</span>}
                      {p.hasBirthdaySoon && <span className="text-[10px]" style={{ color: '#FCD34D' }}>🎂 {p.birthdayInDays}d</span>}
                    </div>
                  </div>
                  {sent.has(p.id) && <span className="text-[10px] font-bold" style={{ color: '#4ADE80' }}>✓ enviado</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Message composer */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              2. Escreva a mensagem
            </div>

            {/* Quick messages */}
            <div className="mb-3">
              <div className="text-[10px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Mensagens rápidas</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MESSAGES.map(q => (
                  <button key={q.label}
                    onClick={() => { setMessage(q.text); setShowCustom(false) }}
                    className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                    style={{
                      background: message === q.text ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)',
                      color: message === q.text ? '#93C5FD' : 'rgba(255,255,255,0.45)',
                      border: `1px solid ${message === q.text ? 'rgba(37,99,235,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template selector */}
            {templates.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Templates salvos</div>
                <div className="flex flex-wrap gap-1.5">
                  {templates.slice(0, 8).map(t => (
                    <button key={t.id}
                      onClick={() => { setMessage(t.content); setShowCustom(false) }}
                      className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                      style={{
                        background: message === t.content ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)',
                        color: message === t.content ? '#93C5FD' : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${message === t.content ? 'rgba(37,99,235,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom text area */}
            <button onClick={() => setShowCustom(!showCustom)}
              className="text-xs mb-2 flex items-center gap-1.5"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              ✏️ {showCustom ? 'Fechar' : 'Personalizar mensagem'}
            </button>
            {(showCustom || message === '') && (
              <textarea
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite sua mensagem aqui. Use {{nome}} para o nome do paciente..."
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none font-mono"
                style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)', color: 'rgba(226,232,248,0.85)', lineHeight: '1.6' }}
              />
            )}
            {message && !showCustom && (
              <div className="rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed"
                style={{ background: 'rgba(18,222,107,0.05)', border: '1px solid rgba(18,222,107,0.12)', color: 'rgba(255,255,255,0.65)', maxHeight: 180, overflowY: 'auto', fontFamily: 'inherit' }}>
                {message.replace(/\{\{nome\}\}/g, '[nome]')}
              </div>
            )}
            <div className="mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              💡 Use {'{{nome}}'} para o primeiro nome do paciente
            </div>
          </div>
        </div>

        {/* Right: Send links */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--dark-border)' }}>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
              3. Abrir WhatsApp
            </div>
            <div className="text-sm text-white">
              {selectedPatients.length} paciente{selectedPatients.length !== 1 ? 's' : ''} selecionado{selectedPatients.length !== 1 ? 's' : ''}
            </div>
            {!message && (
              <div className="text-xs mt-1" style={{ color: '#FCD34D' }}>
                ⚠️ Escreva a mensagem primeiro
              </div>
            )}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {selectedPatients.length === 0 ? (
              <div className="p-5 text-center text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Selecione pacientes à esquerda
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--dark-border)' }}>
                {selectedPatients.map(p => {
                  const msg = message ? buildMessage(p) : ''
                  const link = msg ? waLink(p.phone, msg) : ''
                  const isSent = sent.has(p.id)
                  return (
                    <div key={p.id} className="px-4 py-3 flex items-center gap-3"
                      style={{ background: isSent ? 'rgba(74,222,128,0.04)' : 'transparent' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {p.full_name.split(' ')[0]} {p.full_name.split(' ').slice(-1)[0]}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {p.phone}
                        </div>
                      </div>
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markSent(p.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                          style={{
                            background: isSent ? 'rgba(34,197,94,0.12)' : '#25D366',
                            color: isSent ? '#4ADE80' : '#fff',
                            border: isSent ? '1px solid rgba(74,222,128,0.3)' : 'none',
                          }}>
                          {isSent ? '✓ Enviado' : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.118 1.528 5.845L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-4.999-1.364l-.359-.213-3.712.968.992-3.614-.233-.372A9.818 9.818 0 112.182 12c0-5.42 4.41-9.818 9.818-9.818s9.818 4.398 9.818 9.818-4.398 9.818-9.818 9.818z"/>
                              </svg>
                              Abrir
                            </>
                          )}
                        </a>
                      ) : (
                        <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          aguarde msg
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selectedPatients.length > 0 && message && (
            <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--dark-border)' }}>
              <div className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Clique em "Abrir" para abrir o WhatsApp de cada paciente
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
