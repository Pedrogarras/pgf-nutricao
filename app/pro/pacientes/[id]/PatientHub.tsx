'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createDietPlan, deleteDietPlan, togglePlanActive, renameDietPlan, createPatientAccount, updatePatientPassword, revokePatientAccess, updatePatient, duplicateDietPlan } from './actions'

function WhatsAppButton({ phone, name }: { phone: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; content: string; variables: string[]; category: string }>>([])
  const [chosen, setChosen] = useState<typeof templates[0] | null>(null)
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState('')

  async function loadAndOpen() {
    if (templates.length === 0) {
      const res = await fetch('/api/message-templates')
      const data = await res.json()
      setTemplates(data.templates ?? [])
    }
    setOpen(true)
    setChosen(null)
    setPreview('')
  }

  function selectTemplate(t: typeof templates[0]) {
    setChosen(t)
    const vars: Record<string, string> = {}
    t.variables.filter(v => v !== '{{nome}}').forEach(v => { vars[v] = '' })
    setVarValues(vars)
    // Initial preview with patient name
    let text = t.content.replace(/\{\{nome\}\}/g, name)
    setPreview(text)
  }

  function updatePreview(newVars: Record<string, string>) {
    if (!chosen) return
    let text = chosen.content.replace(/\{\{nome\}\}/g, name)
    Object.entries(newVars).forEach(([k, v]) => {
      if (v) text = text.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v)
    })
    setPreview(text)
  }

  const cleanPhone = phone.replace(/\D/g, '')
  const whatsappLink = cleanPhone
    ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(preview)}`
    : ''

  if (!phone) return null

  return (
    <>
      <button onClick={loadAndOpen} className="btn btn-outline btn-sm" style={{ color: '#6EE7B7', borderColor: 'rgba(16,185,129,0.3)' }}>
        💬 WhatsApp
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="relative rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}>
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            <div className="px-7 pt-7 pb-4 border-b" style={{ borderColor: 'var(--dark-border)' }}>
              <div className="font-black text-white text-base tracking-tight">💬 Enviar Mensagem</div>
              <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{name} · {phone}</div>
            </div>

            {!chosen ? (
              <div className="overflow-y-auto px-7 py-4 flex-1">
                <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Escolha um template
                </div>
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando...</div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => selectTemplate(t)}
                        className="w-full text-left p-3 rounded-xl transition-all"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--dark-border)')}>
                        <div className="text-sm font-semibold text-white">{t.name}</div>
                        <div className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.content}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto px-7 py-4 flex-1 space-y-4">
                <button onClick={() => setChosen(null)} className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  ← Escolher outro template
                </button>
                {Object.keys(varValues).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Variáveis
                    </div>
                    <div className="space-y-2">
                      {Object.keys(varValues).map(k => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-1 rounded min-w-[100px]"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D' }}>{k}</span>
                          <input type="text" value={varValues[k]}
                            onChange={e => { const v = { ...varValues, [k]: e.target.value }; setVarValues(v); updatePreview(v) }}
                            className="flex-1 px-3 py-1.5 rounded-lg text-sm text-white outline-none"
                            style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Prévia
                  </div>
                  <div className="rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ background: 'rgba(18,222,107,0.06)', border: '1px solid rgba(18,222,107,0.15)', color: 'rgba(255,255,255,0.7)', maxHeight: '160px', overflowY: 'auto' }}>
                    {preview}
                  </div>
                </div>
              </div>
            )}

            <div className="px-7 py-4 border-t flex gap-2 justify-between items-center" style={{ borderColor: 'var(--dark-border)' }}>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Fechar</button>
              {chosen && whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: '#25D366', color: '#fff' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.118 1.528 5.845L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-4.999-1.364l-.359-.213-3.712.968.992-3.614-.233-.372A9.818 9.818 0 112.182 12c0-5.42 4.41-9.818 9.818-9.818s9.818 4.398 9.818 9.818-4.398 9.818-9.818 9.818z"/>
                  </svg>
                  Abrir WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

type DietPlan = {
  id: string
  title: string
  active: boolean
  kcal_goal: number | null
  created_at: string
  published_at: string | null
}

type Patient = {
  id: string
  full_name: string
  goal: string | null
  weight_kg: number | null
  height_cm?: number | null
  phone?: string | null
  email?: string | null
  auth_user_id?: string | null
  activity_level?: string | null
  notes?: string | null
  date_of_birth?: string | null
  gender?: string | null
}

interface Props {
  patient: Patient
  dietPlans: DietPlan[]
}

export default function PatientHub({ patient, dietPlans: initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [isPending, startTransition] = useTransition()

  // Edit patient data
  const [showEditPatient, setShowEditPatient] = useState(false)
  const [patientData, setPatientData] = useState({
    full_name: patient.full_name,
    weight_kg: patient.weight_kg ? String(patient.weight_kg) : '',
    height_cm: patient.height_cm ? String(patient.height_cm) : '',
    goal: patient.goal ?? '',
    activity_level: patient.activity_level ?? 'levemente_ativo',
    phone: patient.phone ?? '',
    notes: patient.notes ?? '',
    date_of_birth: patient.date_of_birth ?? '',
    gender: patient.gender ?? '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const handleEditPatient = async () => {
    if (!patientData.full_name.trim()) return
    setEditLoading(true)
    setEditError('')
    const result = await updatePatient(patient.id, {
      full_name: patientData.full_name.trim(),
      weight_kg: patientData.weight_kg ? parseFloat(patientData.weight_kg) : null,
      height_cm: patientData.height_cm ? parseFloat(patientData.height_cm) : null,
      goal: patientData.goal.trim() || null,
      activity_level: patientData.activity_level || null,
      phone: patientData.phone.trim() || null,
      notes: patientData.notes.trim() || null,
      date_of_birth: patientData.date_of_birth || null,
      gender: patientData.gender || null,
    })
    setEditLoading(false)
    if (result?.error) { setEditError(result.error); return }
    setShowEditPatient(false)
  }

  // Patient account management
  const [hasAccess, setHasAccess] = useState(!!patient.auth_user_id)
  const [patientEmail, setPatientEmail] = useState(patient.email ?? '')
  const [showAccessModal, setShowAccessModal] = useState<'create' | 'password' | null>(null)
  const [accessEmail, setAccessEmail] = useState(patient.email ?? '')
  const [accessPassword, setAccessPassword] = useState('')
  const [accessError, setAccessError] = useState('')
  const [accessLoading, setAccessLoading] = useState(false)

  const handleCreate = () => {
    if (!newTitle.trim()) return
    startTransition(async () => {
      await createDietPlan(patient.id, newTitle.trim())
    })
  }

  const handleDelete = (planId: string, title: string) => {
    if (!confirm(`Excluir "${title}"?\n\nTodos os dados deste plano serão perdidos permanentemente.`)) return
    setPlans(prev => prev.filter(p => p.id !== planId))
    startTransition(async () => {
      await deleteDietPlan(planId, patient.id)
    })
  }

  const handleToggle = (planId: string, active: boolean) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, active: !active } : p))
    startTransition(async () => {
      await togglePlanActive(planId, !active, patient.id)
    })
  }

  const handleRename = (planId: string) => {
    if (!renameVal.trim()) { setRenamingId(null); return }
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, title: renameVal.trim() } : p))
    setRenamingId(null)
    startTransition(async () => {
      await renameDietPlan(planId, renameVal.trim(), patient.id)
    })
  }

  const handleCreateAccess = async () => {
    if (!accessEmail.trim() || !accessPassword.trim()) return
    setAccessLoading(true)
    setAccessError('')
    const result = await createPatientAccount(patient.id, accessEmail, accessPassword)
    setAccessLoading(false)
    if (result?.error) { setAccessError(result.error); return }
    setHasAccess(true)
    setPatientEmail(accessEmail.trim().toLowerCase())
    setShowAccessModal(null)
    setAccessPassword('')
  }

  const handleUpdatePassword = async () => {
    if (!accessPassword.trim()) return
    setAccessLoading(true)
    setAccessError('')
    const result = await updatePatientPassword(patient.id, accessPassword)
    setAccessLoading(false)
    if (result?.error) { setAccessError(result.error); return }
    setShowAccessModal(null)
    setAccessPassword('')
  }

  const handleRevokeAccess = async () => {
    if (!confirm(`Revogar acesso de ${patient.full_name}?\n\nEla não conseguirá mais fazer login.`)) return
    setAccessLoading(true)
    const result = await revokePatientAccess(patient.id)
    setAccessLoading(false)
    if (result?.error) { alert(result.error); return }
    setHasAccess(false)
    setPatientEmail('')
  }

  const initials = patient.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const activeCount = plans.filter(p => p.active).length

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

  return (
    <div>
      {/* Breadcrumb */}
      <div
        className="sticky top-0 z-40 flex items-center gap-2 px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <Link
          href="/pro/pacientes"
          className="text-xs transition-colors hover:text-white"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Pacientes
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-xs font-semibold text-white">{patientData.full_name}</span>
      </div>

      <div className="p-8 max-w-5xl">
        {/* Patient header */}
        <div className="flex items-start gap-5 mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0"
            style={{
              background: 'rgba(37,99,235,0.18)',
              color: '#93C5FD',
              border: '1px solid rgba(37,99,235,0.28)',
            }}
          >
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              {patientData.full_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {patientData.goal && (
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {patientData.goal}
                </span>
              )}
              {patientData.weight_kg && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD' }}
                >
                  {patientData.weight_kg} kg
                </span>
              )}
              {patientData.height_cm && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
                >
                  {patientData.height_cm} cm
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => { setEditError(''); setShowEditPatient(true) }}
              className="btn btn-ghost btn-sm"
            >
              Editar dados
            </button>
            <a
              href={`/pro/pacientes/${patient.id}/relatorio`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              📄 Relatório
            </a>
            <a
              href={`/pro/pacientes/${patient.id}/dieta/imprimir`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              title="Imprimir plano alimentar"
            >
              🖨️ Imprimir
            </a>
            <Link
              href={`/pro/pacientes/${patient.id}/anamnese`}
              className="btn btn-outline btn-sm"
            >
              Anamnese
            </Link>
            <Link
              href={`/pro/pacientes/${patient.id}/metas`}
              className="btn btn-outline btn-sm"
            >
              🎯 Metas
            </Link>
            <Link
              href={`/pro/pacientes/${patient.id}/medidas`}
              className="btn btn-outline btn-sm"
            >
              Medidas
            </Link>
            <Link
              href={`/pro/pacientes/${patient.id}/fotos`}
              className="btn btn-outline btn-sm"
            >
              📸 Fotos
            </Link>
            <Link
              href={`/pro/pacientes/${patient.id}/diario`}
              className="btn btn-outline btn-sm"
            >
              📔 Diário
            </Link>
            <WhatsAppButton phone={patient.phone ?? ''} name={patient.full_name} />
            <Link
              href={`/pro/pacientes/${patient.id}/notas`}
              className="btn btn-outline btn-sm"
            >
              📝 Notas
            </Link>
            <Link
              href={`/pro/pacientes/${patient.id}/suplementos`}
              className="btn btn-outline btn-sm"
            >
              💊 Suplementos
            </Link>
            <Link
              href={`/pro/pacientes/${patient.id}/treino`}
              className="btn btn-outline btn-sm"
            >
              Prescrição de Treino
            </Link>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <div
              className="text-[10px] font-bold tracking-[2px] uppercase mb-1"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              Clínico
            </div>
            <div className="text-lg font-bold text-white leading-none">
              Planos Alimentares
              {plans.length > 0 && (
                <span className="ml-3 text-sm font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {activeCount} ativo{activeCount !== 1 ? 's' : ''} · {plans.length} total
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { setShowNewPlan(true); setNewTitle('') }}
            className="btn btn-primary btn-sm"
          >
            + Nova Dieta
          </button>
        </div>

        {/* Plans list */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
        >
          {plans.length === 0 ? (
            <div className="py-16 text-center">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                style={{
                  background: 'rgba(37,99,235,0.1)',
                  border: '1px solid rgba(37,99,235,0.2)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                  <line x1="9" y1="16" x2="13" y2="16" />
                </svg>
              </div>
              <div className="font-semibold mb-1" style={{ color: 'rgba(226,232,248,0.6)' }}>
                Nenhum plano alimentar
              </div>
              <div className="text-sm mb-6" style={{ color: 'rgba(197,205,240,0.35)' }}>
                Crie o primeiro plano para este paciente
              </div>
              <button
                onClick={() => { setShowNewPlan(true); setNewTitle('') }}
                className="btn btn-primary btn-sm"
              >
                + Nova Dieta
              </button>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div
                className="grid items-center px-6 py-3 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  gridTemplateColumns: '12px 1fr 90px 80px 260px',
                  background: 'var(--dark-surface)',
                  borderBottom: '1px solid var(--dark-border)',
                  color: 'rgba(255,255,255,0.25)',
                  gap: '16px',
                }}
              >
                <div />
                <div>Plano</div>
                <div className="text-right">Meta</div>
                <div className="text-right">Publicado</div>
                <div className="text-right">Ações</div>
              </div>

              {plans.map((plan, i) => (
                <div
                  key={plan.id}
                  className="grid items-center px-6 py-4 transition-colors"
                  style={{
                    gridTemplateColumns: '12px 1fr 90px 80px 260px',
                    gap: '16px',
                    borderBottom: i < plans.length - 1 ? '1px solid var(--dark-border)' : undefined,
                    cursor: 'default',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {/* Active dot */}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
                    style={{
                      background: plan.active ? '#34d399' : 'rgba(255,255,255,0.15)',
                      boxShadow: plan.active ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
                    }}
                  />

                  {/* Name + date */}
                  <div className="min-w-0">
                    {renamingId === plan.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(plan.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="text-sm font-semibold bg-transparent outline-none text-white border-b pb-0.5 flex-1 min-w-0"
                          style={{ borderColor: '#2563EB' }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(plan.id)}
                          className="text-xs font-bold flex-shrink-0"
                          style={{ color: '#60A5FA' }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="text-xs flex-shrink-0"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white leading-snug">
                            {plan.title || 'Plano sem nome'}
                          </span>
                          {plan.active && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                              style={{ background: 'rgba(52,211,153,0.15)', color: '#6ee7b7' }}
                            >
                              Ativo
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                          Criado {fmtDate(plan.created_at)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* kcal goal */}
                  <div
                    className="text-sm text-right"
                    style={{ color: 'rgba(255,255,255,0.38)' }}
                  >
                    {plan.kcal_goal ? `${plan.kcal_goal} kcal` : '—'}
                  </div>

                  {/* Published date */}
                  <div
                    className="text-xs text-right"
                    style={{ color: 'rgba(255,255,255,0.28)' }}
                  >
                    {plan.published_at ? fmtDate(plan.published_at) : '—'}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
                    <Link
                      href={`/pro/pacientes/${patient.id}/dieta?plan=${plan.id}`}
                      className="btn btn-outline btn-sm"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleToggle(plan.id, plan.active)}
                      disabled={isPending}
                      className="btn btn-ghost btn-sm"
                      title={plan.active ? 'Desativar plano' : 'Ativar plano para o paciente'}
                    >
                      {plan.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => { setRenamingId(plan.id); setRenameVal(plan.title || '') }}
                      className="btn btn-ghost btn-sm"
                      title="Renomear plano"
                    >
                      Renomear
                    </button>
                    <button
                      onClick={() => {
                        const title = prompt(`Nome para a cópia de "${plan.title || 'Plano'}"?`, `${plan.title || 'Plano'} (cópia)`)
                        if (!title) return
                        startTransition(async () => { await duplicateDietPlan(plan.id, patient.id, title) })
                      }}
                      disabled={isPending}
                      className="btn btn-ghost btn-sm"
                      title="Duplicar plano completo (com substitutos)"
                    >
                      Duplicar
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id, plan.title || 'Plano')}
                      disabled={isPending}
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#fca5a5' }}
                      title="Excluir plano"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Helper tip */}
        {activeCount > 0 && (
          <div className="mt-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Múltiplos planos podem estar ativos ao mesmo tempo — o paciente escolhe entre eles no app.
          </div>
        )}

        {/* ── Patient Account Access ── */}
        <div className="mt-10">
          <div className="mb-4">
            <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Acesso
            </div>
            <div className="text-lg font-bold text-white leading-none">Login do Paciente</div>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Status dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    background: hasAccess ? '#34d399' : 'rgba(255,255,255,0.18)',
                    boxShadow: hasAccess ? '0 0 8px rgba(52,211,153,0.5)' : 'none',
                  }}
                />
                <div>
                  {hasAccess ? (
                    <>
                      <div className="text-sm font-semibold text-white">Acesso ativo</div>
                      {patientEmail && (
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{patientEmail}</div>
                      )}
                      <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        Link:{' '}
                        <span style={{ color: '#93C5FD' }}>
                          pedro-garrastazu-emagrecimento.vercel.app/login?tipo=aluno
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold" style={{ color: 'rgba(226,232,248,0.5)' }}>
                        Sem acesso
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(197,205,240,0.3)' }}>
                        Crie um login para o paciente acessar o app
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {hasAccess ? (
                  <>
                    <button
                      onClick={() => { setAccessError(''); setAccessPassword(''); setShowAccessModal('password') }}
                      className="btn btn-outline btn-sm"
                    >
                      Alterar senha
                    </button>
                    <button
                      onClick={handleRevokeAccess}
                      disabled={accessLoading}
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#fca5a5' }}
                    >
                      Revogar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setAccessError(''); setAccessPassword(''); setShowAccessModal('create') }}
                    className="btn btn-primary btn-sm"
                  >
                    + Criar Login
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Access Modal (create / change password) ── */}
      {showAccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.78)' }}
          onClick={e => e.target === e.currentTarget && setShowAccessModal(null)}
        >
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            <div className="font-black text-white text-lg tracking-tight mb-1">
              {showAccessModal === 'create' ? 'Criar Login' : 'Alterar Senha'}
            </div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {showAccessModal === 'create'
                ? `Definir credenciais de acesso para ${patient.full_name}`
                : `Nova senha para ${patient.full_name}`
              }
            </div>

            <div className="space-y-4">
              {showAccessModal === 'create' && (
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>E-mail</label>
                  <input
                    type="email"
                    value={accessEmail}
                    onChange={e => setAccessEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {showAccessModal === 'create' ? 'Senha' : 'Nova Senha'}
                </label>
                <input
                  type="password"
                  value={accessPassword}
                  onChange={e => setAccessPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (showAccessModal === 'create' ? handleCreateAccess() : handleUpdatePassword())}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  autoFocus
                />
              </div>

              {accessError && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}>
                  {accessError}
                </div>
              )}

              {showAccessModal === 'create' && (
                <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(37,99,235,0.08)', color: 'rgba(147,197,253,0.8)', border: '1px solid rgba(37,99,235,0.2)' }}>
                  Link de acesso:{' '}
                  <span className="font-semibold">pedro-garrastazu-emagrecimento.vercel.app/login?tipo=aluno</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => { setShowAccessModal(null); setAccessError('') }}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={showAccessModal === 'create' ? handleCreateAccess : handleUpdatePassword}
                disabled={accessLoading || !accessPassword.trim() || (showAccessModal === 'create' && !accessEmail.trim())}
                className="btn btn-primary btn-sm"
                style={{ opacity: accessLoading ? 0.6 : 1 }}
              >
                {accessLoading ? 'Salvando...' : showAccessModal === 'create' ? 'Criar acesso' : 'Salvar senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditPatient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.78)' }}
          onClick={e => e.target === e.currentTarget && setShowEditPatient(false)}
        >
          <div
            className="relative rounded-2xl p-7 w-full max-w-md shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            <div className="font-black text-white text-lg tracking-tight mb-1">Editar Paciente</div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Dados de {patient.full_name}
            </div>

            <div className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Nome completo</label>
                <input
                  type="text"
                  value={patientData.full_name}
                  onChange={e => setPatientData(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  autoFocus
                />
              </div>

              {/* Weight + Height */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="300"
                    value={patientData.weight_kg}
                    onChange={e => setPatientData(p => ({ ...p, weight_kg: e.target.value }))}
                    placeholder="ex: 72.5"
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Altura (cm)</label>
                  <input
                    type="number"
                    step="1"
                    min="100"
                    max="220"
                    value={patientData.height_cm}
                    onChange={e => setPatientData(p => ({ ...p, height_cm: e.target.value }))}
                    placeholder="ex: 165"
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  />
                </div>
              </div>

              {/* Date of birth + Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Data de nascimento</label>
                  <input
                    type="date"
                    value={patientData.date_of_birth}
                    onChange={e => setPatientData(p => ({ ...p, date_of_birth: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>Sexo biológico</label>
                  <select
                    value={patientData.gender}
                    onChange={e => setPatientData(p => ({ ...p, gender: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                  >
                    <option value="">Não informado</option>
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                  </select>
                </div>
              </div>

              {/* Goal */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Objetivo</label>
                <input
                  type="text"
                  value={patientData.goal}
                  onChange={e => setPatientData(p => ({ ...p, goal: e.target.value }))}
                  placeholder="ex: Emagrecimento, Ganho de massa..."
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                />
              </div>

              {/* Activity level */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Nivel de Atividade</label>
                <select
                  value={patientData.activity_level}
                  onChange={e => setPatientData(p => ({ ...p, activity_level: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                >
                  <option value="sedentario">Sedentário</option>
                  <option value="levemente_ativo">Levemente ativo (1–2x/sem)</option>
                  <option value="moderadamente_ativo">Moderadamente ativo (3–5x/sem)</option>
                  <option value="muito_ativo">Muito ativo (6–7x/sem)</option>
                  <option value="extremamente_ativo">Extremamente ativo</option>
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={patientData.phone}
                  onChange={e => setPatientData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(51) 99999-0000"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>Observações internas</label>
                <textarea
                  value={patientData.notes}
                  onChange={e => setPatientData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Notas sobre o paciente..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
                />
              </div>

              {editError && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}>
                  {editError}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowEditPatient(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditPatient}
                disabled={editLoading || !patientData.full_name.trim()}
                className="btn btn-primary btn-sm"
                style={{ opacity: editLoading || !patientData.full_name.trim() ? 0.5 : 1 }}
              >
                {editLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Plan Modal */}
      {showNewPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.78)' }}
          onClick={e => e.target === e.currentTarget && setShowNewPlan(false)}
        >
          <div
            className="relative rounded-2xl p-7 w-full max-w-sm shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }}
            />

            <div className="font-black text-white text-lg tracking-tight mb-1">Nova Dieta</div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Nomeie o plano para identificá-lo facilmente
            </div>

            <label
              className="block text-[10px] font-bold tracking-[2px] uppercase mb-2"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              Nome do Plano
            </label>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setShowNewPlan(false)
              }}
              placeholder="ex: Plano Base, Dia de Treino, Cutting..."
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none mb-2"
              style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}
              autoFocus
            />
            <div className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Sugestões: &quot;Dia de treino&quot; · &quot;Final de semana&quot; · &quot;Cutting&quot; · &quot;Manutenção&quot;
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowNewPlan(false); setNewTitle('') }}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || isPending}
                className="btn btn-primary btn-sm"
                style={{ opacity: !newTitle.trim() || isPending ? 0.5 : 1 }}
              >
                {isPending ? 'Criando...' : 'Criar e Abrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
