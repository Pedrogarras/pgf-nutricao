'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createDietPlan, deleteDietPlan, togglePlanActive, renameDietPlan, createPatientAccount, updatePatientPassword, revokePatientAccess, updatePatient, duplicateDietPlan } from './actions'

function WhatsAppButton({ phone, name, gridMode }: { phone: string; name: string; gridMode?: boolean }) {
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
      {gridMode ? (
        <button onClick={loadAndOpen} className="flex flex-col items-center gap-1.5 w-full h-full">
          <span className="text-2xl">💬</span>
          <span className="text-xs font-bold text-white">WhatsApp</span>
          <span className="text-[10px] text-center leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>Enviar mensagem</span>
        </button>
      ) : (
      <button onClick={loadAndOpen} className="btn btn-outline btn-sm" style={{ color: '#6EE7B7', borderColor: 'rgba(16,185,129,0.3)' }}>
        💬 WhatsApp
      </button>
      )}
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
  public_message?: string | null
}

interface ActivitySummary {
  lastDiary: string | null
  lastConsultation: string | null
  lastRecord: string | null
  lastWeight: number | null
  diaryCount30d: number
}

interface PatientGoal {
  id: string
  label: string
  metric: string
  unit: string | null
  target_value: number
  current_value: number | null
  start_value: number | null
  direction: string
  achieved: boolean
  deadline: string | null
}

interface Props {
  patient: Patient
  dietPlans: DietPlan[]
  activitySummary?: ActivitySummary
  activeGoals?: PatientGoal[]
}

export default function PatientHub({ patient, dietPlans: initialPlans, activitySummary, activeGoals = [] }: Props) {
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
    public_message: patient.public_message ?? '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const handleEditPatient = async () => {
    if (!patientData.full_name.trim()) return
    setEditLoading(true)
    setEditError('')
    const msgTrimmed = patientData.public_message.trim() || null
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
      public_message: msgTrimmed,
      public_message_at: msgTrimmed ? new Date().toISOString() : null,
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

  // Consultation recording state
  const [consultaOpen, setConsultaOpen] = useState(false)
  const [consultaForm, setConsultaForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    type: 'presencial' as 'presencial' | 'online' | 'telefone',
    duration_min: 60,
    notes: '',
    weight_kg: '',
    adherence_pct: '',
  })
  const [consultaSaving, setConsultaSaving] = useState(false)
  const [consultaSuccess, setConsultaSuccess] = useState(false)
  const [consultaResumo, setConsultaResumo] = useState('')
  const [resumoCopied, setResumoCopied] = useState(false)

  function buildConsultaResumo(form: typeof consultaForm): string {
    const firstName = patient.full_name.split(' ')[0]
    const dateFormatted = new Date(form.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    const typeLabel = form.type === 'presencial' ? 'presencial' : form.type === 'online' ? 'online' : 'por telefone'
    let msg = `Olá, ${firstName}! 😊\n\nPassando o resumo da nossa consulta ${typeLabel} de hoje (${dateFormatted}):\n\n`
    if (form.weight_kg) {
      msg += `⚖️ *Peso:* ${form.weight_kg} kg\n`
    }
    if (form.adherence_pct) {
      const pct = parseInt(form.adherence_pct)
      const adherenceEmoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '⚠️'
      msg += `${adherenceEmoji} *Aderência ao plano:* ${form.adherence_pct}%\n`
    }
    if (form.notes && form.notes.trim()) {
      msg += `\n📋 *Anotações:*\n${form.notes.trim()}\n`
    }
    msg += `\nQualquer dúvida estou à disposição! 🌱\n\n_Pedro Garrastazu Frey – Nutricionista_`
    return msg
  }

  async function handleSaveConsulta() {
    setConsultaSaving(true)
    // Create consultation record
    const scheduled_at = `${consultaForm.date}T${consultaForm.time}:00`
    await fetch('/api/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patient.id,
        scheduled_at,
        duration_min: Number(consultaForm.duration_min),
        type: consultaForm.type,
        status: 'realizado',
        notes: consultaForm.notes || null,
      }),
    })
    // Create anthropometric record if weight entered
    if (consultaForm.weight_kg) {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          measured_at: consultaForm.date,
          weight_kg: parseFloat(consultaForm.weight_kg),
          adherence_pct: consultaForm.adherence_pct ? parseInt(consultaForm.adherence_pct) : null,
        }),
      })
    }
    const resumo = buildConsultaResumo(consultaForm)
    setConsultaResumo(resumo)
    setResumoCopied(false)
    setConsultaSaving(false)
    setConsultaSuccess(true)
  }

  function closeConsulta() {
    setConsultaSuccess(false)
    setConsultaOpen(false)
    setConsultaResumo('')
    setResumoCopied(false)
    setConsultaForm(prev => ({ ...prev, notes: '', weight_kg: '', adherence_pct: '' }))
  }

  async function copyResumo() {
    try {
      await navigator.clipboard.writeText(consultaResumo)
      setResumoCopied(true)
      setTimeout(() => setResumoCopied(false), 2500)
    } catch {
      // fallback
    }
  }

  const initials = patient.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const activeCount = plans.filter(p => p.active).length

  // BMI calculation
  const bmiRaw = patientData.weight_kg && patientData.height_cm
    ? parseFloat(patientData.weight_kg) / Math.pow(parseFloat(patientData.height_cm) / 100, 2)
    : null
  const bmi = bmiRaw ? Math.round(bmiRaw * 10) / 10 : null
  const bmiClass = bmi
    ? bmi < 18.5 ? 'Baixo peso' : bmi < 25 ? 'Eutrófico' : bmi < 30 ? 'Sobrepeso' : bmi < 35 ? 'Ob. I' : bmi < 40 ? 'Ob. II' : 'Ob. III'
    : null
  const bmiColor = bmi
    ? bmi < 18.5 ? '#60a5fa' : bmi < 25 ? '#4ade80' : bmi < 30 ? '#fbbf24' : '#f87171'
    : '#9ca3af'

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
              {bmi && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: `${bmiColor}18`, color: bmiColor, border: `1px solid ${bmiColor}35` }}
                >
                  IMC {bmi} · {bmiClass}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setConsultaOpen(true)}
              className="btn btn-sm"
              style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
            >
              📅 Consulta
            </button>
            <button
              onClick={() => { setEditError(''); setShowEditPatient(true) }}
              className="btn btn-ghost btn-sm"
            >
              ✏️ Editar
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
          </div>
        </div>

        {/* Navigation grid */}
        <div className="grid grid-cols-5 gap-3 mb-10">
          {[
            { href: `/pro/pacientes/${patient.id}/consultas`,    icon: '📅', label: 'Consultas',  desc: 'Agendamento' },
            { href: `/pro/pacientes/${patient.id}/historico`,    icon: '🗓️', label: 'Histórico',  desc: 'Timeline clínica' },
            { href: `/pro/pacientes/${patient.id}/anamnese`,    icon: '📋', label: 'Anamnese',   desc: 'Dados clínicos' },
            { href: `/pro/pacientes/${patient.id}/metas`,       icon: '🎯', label: 'Metas',      desc: 'Objetivos e progresso' },
            { href: `/pro/pacientes/${patient.id}/medidas`,     icon: '📏', label: 'Medidas',    desc: 'Avaliações físicas' },
            { href: `/pro/pacientes/${patient.id}/fotos`,       icon: '📸', label: 'Fotos',      desc: 'Evolução visual' },
            { href: `/pro/pacientes/${patient.id}/diario`,      icon: '📔', label: 'Diário',     desc: 'Registro alimentar' },
            { href: `/pro/pacientes/${patient.id}/aderencia`,    icon: '📊', label: 'Aderência',  desc: 'Análise do diário' },
            { href: `/pro/pacientes/${patient.id}/exames`,      icon: '🔬', label: 'Exames',     desc: 'Laboratoriais' },
            { href: `/pro/pacientes/${patient.id}/suplementos`, icon: '💊', label: 'Suplementos',desc: 'Prescrição ativa' },
            { href: `/pro/pacientes/${patient.id}/treino`,      icon: '🏋️', label: 'Treino',     desc: 'Prescrição física' },
            { href: `/pro/pacientes/${patient.id}/notas`,       icon: '📝', label: 'Notas',      desc: 'Anotações clínicas' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-all group"
              style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)'
                e.currentTarget.style.background = 'rgba(37,99,235,0.06)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--dark-border)'
                e.currentTarget.style.background = 'var(--dark-surface)'
              }}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-bold text-white">{item.label}</span>
              <span className="text-[10px] text-center leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.desc}</span>
            </Link>
          ))}
          {/* WhatsApp card */}
          {patient.phone ? (
            <div className="flex flex-col items-center gap-1.5 p-4 rounded-2xl transition-all cursor-pointer"
              style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(18,222,107,0.3)'
                e.currentTarget.style.background = 'rgba(18,222,107,0.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--dark-border)'
                e.currentTarget.style.background = 'var(--dark-surface)'
              }}>
              <WhatsAppButton phone={patient.phone ?? ''} name={patient.full_name} gridMode />
            </div>
          ) : null}
        </div>

        {/* Activity summary */}
        {activitySummary && (() => {
          function daysAgo(dateStr: string | null): string {
            if (!dateStr) return '—'
            const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00' : dateStr)
            const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
            if (days === 0) return 'Hoje'
            if (days === 1) return 'Ontem'
            return `${days}d atrás`
          }
          const diaryPct = Math.round((activitySummary.diaryCount30d / 30) * 100)
          const diaryColor = diaryPct >= 70 ? '#4ade80' : diaryPct >= 40 ? '#fbbf24' : '#f87171'
          return (
            <div className="grid grid-cols-4 gap-3 mb-8">
              {[
                { icon: '📔', label: 'Diário', value: daysAgo(activitySummary.lastDiary), sub: activitySummary.lastDiary ? 'último registro' : 'sem registros', warn: !activitySummary.lastDiary },
                { icon: '📏', label: 'Medição', value: daysAgo(activitySummary.lastRecord), sub: activitySummary.lastWeight ? `${activitySummary.lastWeight} kg` : 'sem dados', warn: !activitySummary.lastRecord },
                { icon: '📅', label: 'Consulta', value: daysAgo(activitySummary.lastConsultation), sub: 'última realizada', warn: !activitySummary.lastConsultation },
                {
                  icon: '📊',
                  label: 'Log 30 dias',
                  value: `${activitySummary.diaryCount30d} dias`,
                  sub: `${diaryPct}% do período`,
                  warn: diaryPct < 40,
                  color: diaryColor,
                },
              ].map(item => (
                <div key={item.label}
                  className="rounded-xl p-3.5"
                  style={{
                    background: item.warn ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${item.warn ? 'rgba(239,68,68,0.18)' : 'var(--dark-border)'}`,
                  }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.label}</span>
                  </div>
                  <div className="text-sm font-black" style={{ color: (item as {color?: string}).color ?? 'white' }}>{item.value}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.sub}</div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Active goals mini-section */}
        {activeGoals.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Metas Ativas
              </div>
              <Link href={`/pro/pacientes/${patient.id}/metas`} className="text-xs" style={{ color: 'rgba(37,99,235,0.7)' }}>
                Ver todas →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {activeGoals.slice(0, 4).map(goal => {
                const totalDelta = Math.abs((goal.target_value ?? 0) - (goal.start_value ?? goal.target_value ?? 0))
                const progressDelta = goal.current_value != null && goal.start_value != null
                  ? Math.abs(goal.current_value - goal.start_value) : 0
                const pct = totalDelta > 0 ? Math.min(100, Math.round((progressDelta / totalDelta) * 100)) : 0
                const remaining = goal.current_value != null ? Math.abs(goal.target_value - goal.current_value).toFixed(1) : null
                const daysLeft = goal.deadline
                  ? Math.ceil((new Date(goal.deadline + 'T12:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null
                const color = pct >= 80 ? '#4ade80' : pct >= 50 ? '#60a5fa' : '#fbbf24'
                return (
                  <div key={goal.id} className="rounded-xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-white leading-tight">{goal.label}</span>
                      {daysLeft !== null && (
                        <span className="text-[10px] font-bold flex-shrink-0" style={{ color: daysLeft <= 7 ? '#f87171' : daysLeft <= 30 ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
                          {daysLeft > 0 ? `${daysLeft}d` : 'Vencida'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className="text-base font-black" style={{ color }}>
                        {goal.current_value != null ? goal.current_value : '—'}{goal.unit ?? ''}
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        / {goal.target_value}{goal.unit ?? ''}
                        {remaining && ` · faltam ${remaining}`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{pct}% concluído</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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

      {/* ── Quick Consultation Modal ── */}
      {consultaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && closeConsulta()}
        >
          <div
            className="relative rounded-2xl p-7 w-full max-w-md shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)' }}
          >
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            {consultaSuccess ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-black text-white text-base">Consulta registrada!</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(consultaForm.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* WhatsApp summary */}
                <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.2)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(74,222,128,0.7)' }}>
                      Resumo para WhatsApp
                    </span>
                    <button onClick={copyResumo}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                      style={{ background: resumoCopied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.07)', color: resumoCopied ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
                      {resumoCopied ? '✓ Copiado!' : '📋 Copiar'}
                    </button>
                  </div>
                  <textarea
                    value={consultaResumo}
                    onChange={e => setConsultaResumo(e.target.value)}
                    rows={8}
                    className="w-full text-xs leading-relaxed resize-none outline-none bg-transparent"
                    style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace' }}
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={closeConsulta} className="btn btn-ghost btn-sm flex-1">Fechar</button>
                  {patient.phone && (
                    <a
                      href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(consultaResumo)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold flex-1"
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
            ) : (
              <>
                <div className="font-black text-white text-lg tracking-tight mb-0.5">📅 Registrar Consulta</div>
                <div className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.38)' }}>{patient.full_name}</div>

                <div className="space-y-4">
                  {/* Date + Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Data</label>
                      <input type="date" value={consultaForm.date}
                        onChange={e => setConsultaForm(p => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Horário</label>
                      <input type="time" value={consultaForm.time}
                        onChange={e => setConsultaForm(p => ({ ...p, time: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                  </div>

                  {/* Type + Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Tipo</label>
                      <select value={consultaForm.type}
                        onChange={e => setConsultaForm(p => ({ ...p, type: e.target.value as typeof consultaForm.type }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }}>
                        <option value="presencial">🏥 Presencial</option>
                        <option value="online">💻 Online</option>
                        <option value="telefone">📞 Telefone</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Duração (min)</label>
                      <input type="number" value={consultaForm.duration_min} min="15" max="240"
                        onChange={e => setConsultaForm(p => ({ ...p, duration_min: Number(e.target.value) }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                  </div>

                  {/* Weight + Adherence */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Peso aferido (kg)</label>
                      <input type="number" step="0.1" value={consultaForm.weight_kg} placeholder="ex: 72.5"
                        onChange={e => setConsultaForm(p => ({ ...p, weight_kg: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Aderência (%)</label>
                      <input type="number" min="0" max="100" value={consultaForm.adherence_pct} placeholder="0–100"
                        onChange={e => setConsultaForm(p => ({ ...p, adherence_pct: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Notas da consulta</label>
                    <textarea value={consultaForm.notes}
                      onChange={e => setConsultaForm(p => ({ ...p, notes: e.target.value }))}
                      rows={3} placeholder="Queixas, evoluções, orientações dadas..."
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-5">
                  <button onClick={closeConsulta} className="btn btn-ghost btn-sm">Cancelar</button>
                  <button
                    onClick={handleSaveConsulta}
                    disabled={consultaSaving}
                    className="btn btn-primary btn-sm"
                  >
                    {consultaSaving ? 'Salvando...' : '✓ Registrar Consulta'}
                  </button>
                </div>
              </>
            )}
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

              {/* Public message */}
              <div>
                <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1"
                  style={{ color: 'rgba(37,99,235,0.8)' }}>💬 Mensagem para o paciente</label>
                <div className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Aparece em destaque na tela inicial do paciente
                </div>
                <textarea
                  value={patientData.public_message}
                  onChange={e => setPatientData(p => ({ ...p, public_message: e.target.value }))}
                  placeholder="Ex: Parabéns pela dedicação esta semana! Continue assim 💪"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.3)' }}
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
