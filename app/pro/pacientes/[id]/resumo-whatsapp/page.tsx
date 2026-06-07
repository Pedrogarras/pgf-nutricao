'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface Patient {
  id: string
  full_name: string
  phone: string | null
  goal: string | null
}

interface DiaryDay {
  date: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  hasEntry: boolean
}

interface CheckIn {
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  adherence_pct: number | null
}

interface Goal {
  label: string | null
  metric: string | null
  target_value: number
  current_value: number | null
  start_value: number | null
  unit: string | null
  direction: string | null
  achieved: boolean
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function r0(n: number) { return Math.round(n) }
function r1(n: number) { return Math.round(n * 10) / 10 }
function fmtShort(dateStr: string) {
  return new Date(dateStr + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function firstName(full: string) {
  return full.split(' ')[0]
}

/* ─── Build message ───────────────────────────────────────────────────────── */
function buildMessage(params: {
  patient: Patient
  days: DiaryDay[]
  checkIn: CheckIn | null
  prevCheckIn: CheckIn | null
  goals: Goal[]
  planKcal: number
  weekStart: string
  weekEnd: string
  customNote: string
  tone: 'motivacional' | 'neutro' | 'clinico'
}): string {
  const { patient, days, checkIn, prevCheckIn, goals, planKcal, weekStart, weekEnd, customNote, tone } = params
  const name = firstName(patient.full_name)
  const loggedDays = days.filter(d => d.hasEntry)
  const loggedCount = loggedDays.length
  const avgKcal = loggedCount > 0
    ? loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedCount
    : 0
  const avgProtein = loggedCount > 0
    ? loggedDays.reduce((s, d) => s + d.protein, 0) / loggedCount
    : 0
  const adherencePct = planKcal > 0 && avgKcal > 0
    ? Math.round((avgKcal / planKcal) * 100)
    : null
  const diaryPct = Math.round((loggedCount / 7) * 100)
  const weightDelta = checkIn?.weight_kg && prevCheckIn?.weight_kg
    ? r1(checkIn.weight_kg - prevCheckIn.weight_kg)
    : null
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })

  const lines: string[] = []

  // Greeting
  if (tone === 'motivacional') {
    lines.push(`Olá ${name}! 👋 Aqui vai o resumo da sua semana (${fmtShort(weekStart)} a ${fmtShort(weekEnd)}):`)
  } else if (tone === 'clinico') {
    lines.push(`${name}, segue seu relatório semanal — ${fmtShort(weekStart)} a ${fmtShort(weekEnd)}:`)
  } else {
    lines.push(`Oi ${name}, tudo bem? Segue um resumo da sua semana (${fmtShort(weekStart)} a ${fmtShort(weekEnd)}):`)
  }
  lines.push('')

  // Diary section
  lines.push('📔 *Diário Alimentar*')
  lines.push(`• Dias registrados: *${loggedCount}/7* (${diaryPct}%)`)
  if (avgKcal > 0) {
    lines.push(`• Média diária: *${r0(avgKcal)} kcal* / ${r0(avgProtein)}g proteína`)
  }
  if (adherencePct != null) {
    const emoji = adherencePct >= 90 && adherencePct <= 115 ? '✅' : adherencePct < 90 ? '⚠️' : '📈'
    lines.push(`• Aderência ao plano: *${adherencePct}%* ${emoji}`)
  }
  if (tone === 'motivacional') {
    if (loggedCount >= 6) lines.push('Consistência excelente, continue assim! 🔥')
    else if (loggedCount >= 4) lines.push('Bom resultado! Tenta fechar a semana nos próximos dias 💪')
    else if (loggedCount <= 2) lines.push('Precisamos melhorar o registro para acompanhar melhor sua evolução ⚠️')
  }
  lines.push('')

  // Check-in section
  if (checkIn) {
    lines.push('⚖️ *Avaliação Física*')
    if (checkIn.weight_kg) {
      const deltaStr = weightDelta != null
        ? ` (${weightDelta > 0 ? '+' : ''}${weightDelta} kg vs anterior)`
        : ''
      lines.push(`• Peso atual: *${checkIn.weight_kg} kg*${deltaStr}`)
      if (weightDelta != null) {
        if (weightDelta < -0.5) {
          if (tone === 'motivacional') lines.push('Ótima redução de peso! 🎉')
        } else if (weightDelta > 0.5) {
          if (tone === 'motivacional') lines.push('Vamos manter o foco no plano 💪')
        }
      }
    }
    if (checkIn.body_fat_pct) lines.push(`• % Gordura: *${checkIn.body_fat_pct}%*`)
    if (checkIn.adherence_pct) lines.push(`• Aderência reportada: *${checkIn.adherence_pct}%*`)
    lines.push('')
  }

  // Goals section
  const activeGoals = goals.filter(g => !g.achieved)
  const achievedGoals = goals.filter(g => g.achieved)
  if (achievedGoals.length > 0) {
    lines.push('🎯 *Metas Alcançadas*')
    achievedGoals.forEach(g => {
      lines.push(`• ✅ ${g.label ?? g.metric ?? 'Meta'}: ${g.target_value}${g.unit ?? ''}`)
    })
    if (tone === 'motivacional') lines.push('Parabéns pelas conquistas! 🏆')
    lines.push('')
  }
  if (activeGoals.length > 0) {
    lines.push('🎯 *Metas em Andamento*')
    activeGoals.slice(0, 3).forEach(g => {
      const cur = g.current_value ?? g.start_value
      const label = g.label ?? g.metric ?? 'Meta'
      if (cur != null) {
        const pct = Math.abs(g.target_value - (g.start_value ?? cur)) > 0
          ? Math.round(
              (Math.abs(cur - (g.start_value ?? cur)) /
               Math.abs(g.target_value - (g.start_value ?? cur))) * 100
            )
          : 0
        lines.push(`• ${label}: ${cur}${g.unit ?? ''} → meta ${g.target_value}${g.unit ?? ''} (${pct}% concluído)`)
      } else {
        lines.push(`• ${label}: meta ${g.target_value}${g.unit ?? ''}`)
      }
    })
    lines.push('')
  }

  // Custom note
  if (customNote.trim()) {
    lines.push('📝 *Orientações*')
    lines.push(customNote.trim())
    lines.push('')
  }

  // Footer
  if (tone === 'motivacional') {
    lines.push('Continue firme! Qualquer dúvida estou à disposição 😊')
  } else if (tone === 'neutro') {
    lines.push('Qualquer dúvida pode me chamar.')
  } else {
    lines.push('Atenciosamente,')
    lines.push('Pedro Garrastazu Frey — Nutricionista')
  }
  lines.push(`_${today}_`)

  return lines.join('\n')
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function ResumoWhatsAppPage() {
  const params  = useParams()
  const patientId = params.id as string
  const supabase  = createClient()

  const [loading, setLoading]     = useState(true)
  const [patient, setPatient]     = useState<Patient | null>(null)
  const [days, setDays]           = useState<DiaryDay[]>([])
  const [checkIn, setCheckIn]     = useState<CheckIn | null>(null)
  const [prevCheckIn, setPrevCheckIn] = useState<CheckIn | null>(null)
  const [goals, setGoals]         = useState<Goal[]>([])
  const [planKcal, setPlanKcal]   = useState(0)
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd]     = useState('')

  const [message, setMessage]     = useState('')
  const [customNote, setCustomNote] = useState('')
  const [tone, setTone]           = useState<'motivacional' | 'neutro' | 'clinico'>('motivacional')
  const [copied, setCopied]       = useState(false)

  useEffect(() => { loadData() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const today = new Date()
    const ws = new Date(today.getTime() - 6 * 86400000).toISOString().split('T')[0]
    const we = today.toISOString().split('T')[0]
    setWeekStart(ws)
    setWeekEnd(we)

    const dayWindow: string[] = []
    for (let i = 6; i >= 0; i--) {
      dayWindow.push(new Date(today.getTime() - i * 86400000).toISOString().split('T')[0])
    }

    const [
      { data: p },
      { data: diary },
      { data: checkIns },
      { data: goalsData },
      { data: plan },
    ] = await Promise.all([
      supabase.from('patients').select('id, full_name, phone, goal').eq('id', patientId).single(),
      supabase.from('diary_entries')
        .select('logged_at, total_kcal, total_protein_g, total_carbs_g, total_fat_g')
        .eq('patient_id', patientId)
        .gte('logged_at', ws).lte('logged_at', we),
      supabase.from('anthropometric_records')
        .select('measured_at, weight_kg, body_fat_pct, adherence_pct')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false }).limit(2),
      supabase.from('patient_goals')
        .select('label, metric, target_value, current_value, start_value, unit, direction, achieved')
        .eq('patient_id', patientId)
        .eq('active', true)
        .order('created_at'),
      supabase.from('diet_plans')
        .select('target_kcal, kcal_goal')
        .eq('patient_id', patientId).eq('active', true).limit(1).maybeSingle(),
    ])

    setPatient(p ?? null)
    setGoals(goalsData ?? [])
    setPlanKcal(plan?.target_kcal ?? plan?.kcal_goal ?? 0)

    // Group diary by date
    const byDate = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>()
    for (const e of (diary ?? [])) {
      const date = (e.logged_at as string).split('T')[0]
      const ex = byDate.get(date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ex.kcal    += e.total_kcal    ?? 0
      ex.protein += e.total_protein_g ?? 0
      ex.carbs   += e.total_carbs_g ?? 0
      ex.fat     += e.total_fat_g   ?? 0
      byDate.set(date, ex)
    }
    const daysArr = dayWindow.map(date => {
      const d = byDate.get(date)
      return { date, kcal: d?.kcal ?? 0, protein: d?.protein ?? 0, carbs: d?.carbs ?? 0, fat: d?.fat ?? 0, hasEntry: !!d }
    })
    setDays(daysArr)

    const cis = checkIns ?? []
    setCheckIn(cis[0] ?? null)
    setPrevCheckIn(cis[1] ?? null)

    setLoading(false)
  }

  // Regenerate message whenever inputs change
  const regenerate = useCallback(() => {
    if (!patient) return
    const msg = buildMessage({ patient, days, checkIn, prevCheckIn, goals, planKcal, weekStart, weekEnd, customNote, tone })
    setMessage(msg)
  }, [patient, days, checkIn, prevCheckIn, goals, planKcal, weekStart, weekEnd, customNote, tone])

  useEffect(() => {
    if (!loading) regenerate()
  }, [loading, regenerate])

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback: select textarea
    }
  }

  const waUrl = patient?.phone
    ? `https://wa.me/55${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    : null

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dark-bg)' }}>
      <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Gerando resumo...</div>
    </div>
  )

  if (!patient) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dark-bg)' }}>
      <div className="text-white">Paciente não encontrado</div>
    </div>
  )

  const loggedCount = days.filter(d => d.hasEntry).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-6 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href={`/pro/pacientes/${patientId}`}
          className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← {patient.full_name}
        </Link>
        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="text-sm font-black text-white">💬 Resumo WhatsApp</span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-2 gap-6">

        {/* ── Left: controls ─────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Stats summary */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Dados da semana</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xl font-black"
                  style={{ color: loggedCount >= 5 ? '#4ADE80' : loggedCount >= 3 ? '#FBBF24' : '#F87171' }}>
                  {loggedCount}/7
                </div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>dias registrados</div>
              </div>
              <div className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xl font-black text-white">
                  {checkIn?.weight_kg ? `${checkIn.weight_kg}kg` : '—'}
                </div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>último peso</div>
              </div>
              <div className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xl font-black" style={{ color: '#A78BFA' }}>
                  {goals.filter(g => !g.achieved).length}
                </div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>metas ativas</div>
              </div>
            </div>
          </div>

          {/* Tone selector */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Tom da mensagem</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'motivacional', label: '🔥 Motivacional', desc: 'Celebra conquistas, encoraja' },
                { v: 'neutro',       label: '😊 Neutro',       desc: 'Equilibrado e amigável' },
                { v: 'clinico',      label: '📋 Clínico',      desc: 'Formal e objetivo' },
              ] as const).map(t => (
                <button key={t.v} onClick={() => setTone(t.v)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={tone === t.v ? {
                    background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.4)',
                  } : {
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <div className="text-xs font-bold text-white">{t.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom note */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Orientação personalizada (opcional)</div>
            <textarea
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              placeholder="Ex: Aumentar proteína no café da manhã. Tentar incluir mais vegetais no almoço..."
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                outline: 'none',
              }}
            />
          </div>

          {/* Regenerate button */}
          <button onClick={regenerate}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all"
            style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}>
            🔄 Regenerar mensagem
          </button>

        </div>

        {/* ── Right: message preview ──────────────────────────────── */}
        <div className="space-y-4">

          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.35)' }}>Prévia da mensagem</span>
              <button onClick={copyToClipboard}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={copied ? {
                  background: 'rgba(74,222,128,0.2)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)',
                } : {
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                }}>
                {copied ? '✓ Copiado!' : '📋 Copiar'}
              </button>
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={20}
              className="w-full px-4 py-4 text-sm font-mono resize-none"
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.85)',
                outline: 'none',
                lineHeight: 1.6,
                border: 'none',
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.3)' }}>
                <span>📱</span> Abrir WhatsApp
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm opacity-40"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Sem telefone cadastrado
              </div>
            )}
            <button onClick={copyToClipboard}
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
              style={copied ? {
                background: 'rgba(74,222,128,0.15)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)',
              } : {
                background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)',
              }}>
              {copied ? '✓ Copiado!' : '📋 Copiar texto'}
            </button>
          </div>

          {/* Patient info */}
          {patient.phone && (
            <div className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Enviando para: {patient.full_name} · {patient.phone}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
