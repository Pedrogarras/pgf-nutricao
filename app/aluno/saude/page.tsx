import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/* ─── helpers ────────────────────────────────────────────────────────────── */
function r(n: number, d = 1) { return Math.round(n * 10 ** d) / 10 ** d }

function calcAge(dob: string) {
  return Math.floor((Date.now() - new Date(dob + 'T12:00').getTime()) / (365.25 * 86400000))
}

function calcBMI(weight: number, height: number) {
  return r(weight / Math.pow(height / 100, 2))
}

function bmiInfo(bmi: number): { label: string; color: string; bg: string; border: string; text: string } {
  if (bmi < 16.0) return { label: 'Magreza grave',   color: '#60A5FA', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.25)',   text: 'IMC muito abaixo do ideal — acompanhamento médico necessário.' }
  if (bmi < 18.5) return { label: 'Abaixo do peso',  color: '#93C5FD', bg: 'rgba(147,197,253,0.08)',  border: 'rgba(147,197,253,0.22)',  text: 'Peso abaixo do ideal. Seu plano alimentar pode ajudar a atingir um peso saudável.' }
  if (bmi < 25.0) return { label: 'Peso normal ✓',   color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.25)',   text: 'Parabéns! IMC na faixa saudável. Continue seguindo seu plano alimentar.' }
  if (bmi < 30.0) return { label: 'Sobrepeso',       color: '#FCD34D', bg: 'rgba(252,211,77,0.08)',   border: 'rgba(252,211,77,0.22)',   text: 'IMC indica sobrepeso. Com consistência no plano alimentar você chegará ao peso ideal.' }
  if (bmi < 35.0) return { label: 'Obesidade I',     color: '#FB923C', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.22)',   text: 'Cada consulta e cada dia seguindo o plano conta para sua evolução.' }
  if (bmi < 40.0) return { label: 'Obesidade II',    color: '#F87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.22)',  text: 'Acompanhamento nutricional contínuo é fundamental. Você está no caminho certo.' }
  return                  { label: 'Obesidade III',   color: '#EF4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)',     text: 'Acompanhamento nutricional e médico essencial. Cada passo pequeno conta!' }
}

function fatInfo(pct: number, gender: string | null): { label: string; color: string; desc: string } {
  const m = gender === 'M'
  if (m) {
    if (pct < 6)  return { label: 'Essencial',  color: '#93C5FD', desc: 'Nível mínimo vital' }
    if (pct < 14) return { label: 'Atlético',   color: '#34D399', desc: 'Alto rendimento' }
    if (pct < 18) return { label: 'Fitness',    color: '#4ADE80', desc: 'Excelente' }
    if (pct < 25) return { label: 'Médio',      color: '#FCD34D', desc: 'Aceitável' }
    return               { label: 'Elevado',    color: '#F87171', desc: 'Acima do ideal' }
  } else {
    if (pct < 14) return { label: 'Essencial',  color: '#93C5FD', desc: 'Nível mínimo vital' }
    if (pct < 21) return { label: 'Atlético',   color: '#34D399', desc: 'Alto rendimento' }
    if (pct < 25) return { label: 'Fitness',    color: '#4ADE80', desc: 'Excelente' }
    if (pct < 32) return { label: 'Médio',      color: '#FCD34D', desc: 'Aceitável' }
    return               { label: 'Elevado',    color: '#F87171', desc: 'Acima do ideal' }
  }
}

/** Harris-Benedict revisada (Mifflin-St Jeor, 2001) */
function calcTMB(weight: number, height: number, age: number, gender: string | null) {
  if (gender === 'M') return Math.round(10 * weight + 6.25 * height - 5 * age + 5)
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161)
}

/** Hamwi ideal weight */
function idealWeightRange(height: number, gender: string | null): [number, number] {
  if (gender === 'M') {
    const base = 48.0 + 2.7 * ((height - 152.4) / 2.54)
    return [r(base * 0.9), r(base * 1.1)]
  } else {
    const base = 45.4 + 2.3 * ((height - 152.4) / 2.54)
    return [r(base * 0.9), r(base * 1.1)]
  }
}

function daysUntil(iso: string) {
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00')
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

function fmtDate(iso: string) {
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtShort(iso: string) {
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T12:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/* ─── Mini Sparkline ─────────────────────────────────────────────────────── */
function Sparkline({ values, color = '#60A5FA', w = 80, h = 32 }: { values: number[]; color?: string; w?: number; h?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2
    const y = h - 2 - ((v - min) / range) * (h - 4)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(' ').pop()!.split(',')[0]} cy={pts.split(' ').pop()!.split(',')[1]} r="2.5" fill={color} />
    </svg>
  )
}

/* ─── Ring chart ─────────────────────────────────────────────────────────── */
function Ring({ pct, color, size = 56, strokeW = 5 }: { pct: number; color: string; size?: number; strokeW?: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const r2 = (size - strokeW * 2) / 2
  const circ = 2 * Math.PI * r2
  const dash = (clamped / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r2} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
      <circle cx={size/2} cy={size/2} r={r2} fill="none" stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

/* ─── Metric row ──────────────────────────────────────────────────────────── */
function MetricRow({ label, value, unit, sub, color, delta }: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string; delta?: number | null
}) {
  const deltaColor = delta == null ? '' : delta < 0 ? '#4ADE80' : delta > 0 ? '#F87171' : '#9CA3AF'
  const deltaSign = delta == null ? '' : delta < 0 ? '▼' : delta > 0 ? '▲' : '—'
  return (
    <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div>
        <div className="text-xs font-semibold text-white">{label}</div>
        {sub && <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</div>}
      </div>
      <div className="text-right">
        <span className="text-sm font-black" style={{ color: color ?? 'white' }}>
          {value}{unit && <span className="text-[10px] font-normal ml-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit}</span>}
        </span>
        {delta != null && delta !== 0 && (
          <div className="text-[10px] font-bold" style={{ color: deltaColor }}>
            {deltaSign} {Math.abs(delta)}{unit}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Section header ──────────────────────────────────────────────────────── */
function SectionHead({ label, icon, action }: { label: string; icon: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-6">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[2px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      </div>
      {action}
    </div>
  )
}

/* ─── Status badge ────────────────────────────────────────────────────────── */
const LAB_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  normal:        { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',   label: 'Normal' },
  alto:          { color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',   label: 'Elevado' },
  baixo:         { color: '#93C5FD', bg: 'rgba(147,197,253,0.12)',  label: 'Baixo' },
  critico_alto:  { color: '#F87171', bg: 'rgba(248,113,113,0.14)',  label: 'Atenção ↑' },
  critico_baixo: { color: '#F87171', bg: 'rgba(248,113,113,0.14)',  label: 'Atenção ↓' },
}

const TIMING_ORDER = ['manha', 'antes_treino', 'almoco', 'tarde', 'apos_treino', 'jantar', 'dormir', 'qualquer']
const TIMING_LABELS: Record<string, { label: string; icon: string }> = {
  manha:        { label: 'Manhã',        icon: '🌅' },
  antes_treino: { label: 'Pré-Treino',   icon: '🏋️' },
  almoco:       { label: 'Almoço',       icon: '☀️' },
  tarde:        { label: 'Tarde',        icon: '🌤️' },
  apos_treino:  { label: 'Pós-Treino',   icon: '💪' },
  jantar:       { label: 'Jantar',       icon: '🌙' },
  dormir:       { label: 'Antes de dormir', icon: '😴' },
  qualquer:     { label: 'Qualquer horário', icon: '⏰' },
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default async function MinhaSaudePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  if (!patient) redirect('/aluno')

  const [
    { data: records },
    { data: activePlan },
    { data: labResults },
    { data: supplements },
    { data: goals },
    { data: nextConsult },
    { data: anamnesis },
  ] = await Promise.all([
    // All anthropometric records sorted oldest→newest
    supabase.from('anthropometric_records')
      .select('id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, hip_cm, arm_cm, adherence_pct, notes')
      .eq('patient_id', patient.id)
      .order('measured_at', { ascending: true }),

    // Active published plan
    supabase.from('diet_plans')
      .select('id, title, kcal_goal, protein_goal_g, carbs_goal_g, fat_goal_g, target_kcal, published_at')
      .eq('patient_id', patient.id)
      .eq('active', true)
      .not('published_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Latest 2 lab panels (most recent date and one before)
    supabase.from('lab_results')
      .select('id, date, panel_name, exam_name, value, unit, status, reference_min, reference_max')
      .eq('patient_id', patient.id)
      .order('date', { ascending: false })
      .limit(30),

    // Active supplements
    supabase.from('supplement_prescriptions')
      .select('id, name, dose, unit, timing, instructions, active')
      .eq('patient_id', patient.id)
      .eq('active', true)
      .order('timing'),

    // Active goals
    supabase.from('patient_goals')
      .select('id, label, metric, unit, target_value, current_value, start_value, direction, deadline, achieved')
      .eq('patient_id', patient.id)
      .eq('achieved', false)
      .order('deadline', { nullsFirst: false })
      .limit(4),

    // Next upcoming consultation
    supabase.from('consultations')
      .select('id, scheduled_at, type, status, duration_min, notes')
      .eq('patient_id', patient.id)
      .in('status', ['agendado', 'confirmado'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(1)
      .maybeSingle(),

    // Anamnesis for medical highlights
    supabase.from('patient_anamnesis')
      .select('allergies, intolerances, medical_conditions, medications, supplements')
      .eq('patient_id', patient.id)
      .maybeSingle(),
  ])

  // ── Derive metrics ───────────────────────────────────────────────────────
  const latest = records && records.length > 0 ? records[records.length - 1] : null
  const first  = records && records.length > 0 ? records[0] : null
  const w      = latest?.weight_kg ?? patient.weight_kg
  const h      = patient.height_cm
  const age    = patient.date_of_birth ? calcAge(patient.date_of_birth) : null
  const gender = patient.gender as string | null

  const bmi = w && h ? calcBMI(w, h) : null
  const bmiData = bmi ? bmiInfo(bmi) : null
  const fatData = latest?.body_fat_pct ? fatInfo(latest.body_fat_pct, gender) : null
  const tmb = w && h && age ? calcTMB(w, h, age, gender) : null
  const idealRange = h ? idealWeightRange(h, gender) : null

  // Deltas (latest vs oldest)
  const wDelta  = first?.weight_kg  && latest?.weight_kg  && first.id !== latest.id ? r(latest.weight_kg  - first.weight_kg)  : null
  const fatDelta = first?.body_fat_pct && latest?.body_fat_pct && first.id !== latest.id ? r(latest.body_fat_pct - first.body_fat_pct) : null
  const muscleDelta = first?.muscle_mass_kg && latest?.muscle_mass_kg && first.id !== latest.id ? r(latest.muscle_mass_kg - first.muscle_mass_kg) : null
  const waistDelta  = first?.waist_cm && latest?.waist_cm && first.id !== latest.id ? r(latest.waist_cm - first.waist_cm) : null

  // Weight sparkline values (last 8 records with weight)
  const weightHistory = (records ?? []).filter(r2 => r2.weight_kg != null).slice(-8).map(r2 => r2.weight_kg!)
  const fatHistory    = (records ?? []).filter(r2 => r2.body_fat_pct != null).slice(-8).map(r2 => r2.body_fat_pct!)

  // Plan macros
  const kcalGoal    = activePlan?.kcal_goal ?? activePlan?.target_kcal
  const proteinGoal = activePlan?.protein_goal_g
  const carbsGoal   = activePlan?.carbs_goal_g
  const fatGoal     = activePlan?.fat_goal_g
  const totalMacroKcal = proteinGoal && carbsGoal && fatGoal
    ? proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9 : null

  // Lab results — most recent panel
  const labDates = Array.from(new Set((labResults ?? []).map(l => l.date))).sort((a, b) => b.localeCompare(a))
  const latestLabDate = labDates[0] ?? null
  const latestLabPanel = latestLabDate ? (labResults ?? []).filter(l => l.date === latestLabDate) : []
  const abnormalLabs = latestLabPanel.filter(l => l.status && l.status !== 'normal')

  // Supplement groups by timing
  const suppByTiming: Record<string, typeof supplements> = {}
  for (const s of supplements ?? []) {
    const t = s.timing ?? 'qualquer'
    if (!suppByTiming[t]) suppByTiming[t] = []
    suppByTiming[t]!.push(s)
  }
  const suppTimings = TIMING_ORDER.filter(t => suppByTiming[t]?.length)

  // Goals with progress %
  const goalsWithPct = (goals ?? []).map(g => {
    const totalDelta = Math.abs((g.target_value ?? 0) - (g.start_value ?? g.target_value ?? 0))
    const progressDelta = g.current_value != null && g.start_value != null
      ? Math.abs(g.current_value - g.start_value) : 0
    const pct = totalDelta > 0 ? Math.min(100, Math.round((progressDelta / totalDelta) * 100)) : 0
    const color = pct >= 80 ? '#4ADE80' : pct >= 50 ? '#60A5FA' : '#FCD34D'
    const daysLeft = g.deadline
      ? Math.ceil((new Date(g.deadline + 'T12:00').getTime() - Date.now()) / 86400000)
      : null
    return { ...g, pct, color, daysLeft }
  })

  // Next consult
  const consultDays = nextConsult ? daysUntil(nextConsult.scheduled_at) : null
  const consultType: Record<string, string> = { presencial: '🏥 Presencial', online: '💻 Online', telefone: '📞 Telefone' }

  const todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">🩺 Minha Saúde</h1>
          <p className="text-[10px] mt-0.5 capitalize" style={{ color: 'rgba(255,255,255,0.3)' }}>{todayStr}</p>
        </div>
        <a href="/aluno/checkin" className="text-xs font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.25)' }}>
          + Check-in
        </a>
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-0">

        {/* ── 1. BMI Card ───────────────────────────────────────────────── */}
        {bmiData && bmi && (
          <div className="rounded-2xl p-4 mb-4"
            style={{ background: bmiData.bg, border: `1px solid ${bmiData.border}` }}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="relative w-14 h-14">
                  <Ring pct={Math.min(100, ((bmi - 14) / (45 - 14)) * 100)} color={bmiData.color} size={56} strokeW={5} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black" style={{ color: bmiData.color }}>{bmi}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold mt-1" style={{ color: bmiData.color }}>IMC</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-white">{bmiData.label}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {bmiData.text}
                </p>
                {idealRange && (
                  <div className="text-[10px] mt-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Peso ideal: {idealRange[0]}–{idealRange[1]} kg
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 2. Biometrics grid ───────────────────────────────────────── */}
        <SectionHead label="Biometria atual" icon="📏"
          action={
            <Link href="/aluno/evolucao" className="text-[10px] font-bold" style={{ color: 'rgba(37,99,235,0.7)' }}>
              Ver evolução →
            </Link>
          }
        />

        {!latest && !w ? (
          <div className="rounded-2xl p-5 text-center mb-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-2xl mb-2">📏</div>
            <div className="text-sm text-white font-semibold">Sem medidas registradas</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Faça seu primeiro check-in para ver seus dados aqui
            </div>
            <Link href="/aluno/checkin"
              className="inline-block mt-3 text-xs font-bold px-4 py-2 rounded-xl"
              style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD' }}>
              Iniciar Check-in
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden mb-4"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
            <div className="px-4 pt-3 pb-0">

              {/* Weight row with sparkline */}
              {w && (
                <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div>
                    <div className="text-xs font-semibold text-white">Peso corporal</div>
                    {latest?.measured_at && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Última medição: {fmtShort(latest.measured_at)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {weightHistory.length >= 2 && (
                      <Sparkline values={weightHistory} color="#60A5FA" w={60} h={24} />
                    )}
                    <div className="text-right">
                      <span className="text-sm font-black text-white">{w}</span>
                      <span className="text-[10px] ml-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>kg</span>
                      {wDelta != null && wDelta !== 0 && (
                        <div className="text-[10px] font-bold"
                          style={{ color: wDelta < 0 ? '#4ADE80' : '#F87171' }}>
                          {wDelta < 0 ? '▼' : '▲'} {Math.abs(wDelta)} kg total
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Body fat */}
              {latest?.body_fat_pct && fatData && (
                <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div>
                    <div className="text-xs font-semibold text-white">Gordura corporal</div>
                    <div className="text-[10px] mt-0.5" style={{ color: fatData.color }}>{fatData.label} · {fatData.desc}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {fatHistory.length >= 2 && (
                      <Sparkline values={fatHistory} color={fatData.color} w={60} h={24} />
                    )}
                    <div className="text-right">
                      <span className="text-sm font-black" style={{ color: fatData.color }}>{latest.body_fat_pct}</span>
                      <span className="text-[10px] ml-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>%</span>
                      {fatDelta != null && fatDelta !== 0 && (
                        <div className="text-[10px] font-bold"
                          style={{ color: fatDelta < 0 ? '#4ADE80' : '#F87171' }}>
                          {fatDelta < 0 ? '▼' : '▲'} {Math.abs(fatDelta)}% total
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Muscle mass */}
              {latest?.muscle_mass_kg && (
                <MetricRow
                  label="Massa magra"
                  value={latest.muscle_mass_kg}
                  unit="kg"
                  color="#34D399"
                  delta={muscleDelta}
                />
              )}

              {/* Waist */}
              {latest?.waist_cm && (
                <MetricRow
                  label="Circunferência da cintura"
                  value={latest.waist_cm}
                  unit=" cm"
                  color="#FCD34D"
                  delta={waistDelta}
                />
              )}

              {/* TMB */}
              {tmb && (
                <div className="flex items-center justify-between py-2.5" >
                  <div>
                    <div className="text-xs font-semibold text-white">Taxa Metabólica Basal</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Fórmula Mifflin-St Jeor</div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-white">{tmb}</span>
                    <span className="text-[10px] ml-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>kcal/dia</span>
                  </div>
                </div>
              )}
            </div>

            {/* Record count footer */}
            {records && records.length > 0 && (
              <div className="px-4 py-2.5 border-t flex items-center justify-between"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {records.length} avaliação{records.length !== 1 ? 'ões' : ''} registrada{records.length !== 1 ? 's' : ''}
                  {first?.measured_at && ` · desde ${fmtShort(first.measured_at)}`}
                </span>
                <Link href="/aluno/checkin" className="text-[10px] font-bold" style={{ color: '#60A5FA' }}>
                  Novo check-in →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Plano alimentar atual ──────────────────────────────────── */}
        {activePlan && (
          <>
            <SectionHead label="Plano alimentar ativo" icon="🥗"
              action={
                <Link href="/aluno/plano" className="text-[10px] font-bold" style={{ color: 'rgba(37,99,235,0.7)' }}>
                  Ver plano →
                </Link>
              }
            />
            <div className="rounded-2xl p-4 mb-4"
              style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
              <div className="text-sm font-bold text-white mb-3 leading-tight">
                {activePlan.title}
              </div>

              {/* Macro bars */}
              <div className="space-y-2.5">
                {kcalGoal && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Meta calórica</span>
                    <span className="text-sm font-black text-white">{kcalGoal} <span className="text-[10px] font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>kcal/dia</span></span>
                  </div>
                )}

                {totalMacroKcal && (
                  <>
                    {/* Visual macro bar */}
                    <div className="h-3 rounded-full overflow-hidden flex"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ width: `${Math.round(((proteinGoal! * 4) / totalMacroKcal) * 100)}%`, background: '#60A5FA' }} />
                      <div style={{ width: `${Math.round(((carbsGoal! * 4) / totalMacroKcal) * 100)}%`, background: '#FCD34D' }} />
                      <div style={{ width: `${Math.round(((fatGoal! * 9) / totalMacroKcal) * 100)}%`, background: '#F87171' }} />
                    </div>
                    <div className="flex items-center gap-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      <span><span className="font-bold text-white">{proteinGoal}g</span> proteína</span>
                      <span><span className="font-bold text-white">{carbsGoal}g</span> carboidratos</span>
                      <span><span className="font-bold text-white">{fatGoal}g</span> gorduras</span>
                    </div>
                  </>
                )}
              </div>

              {/* If nutritionist entered targets but no macros breakdown */}
              {kcalGoal && !totalMacroKcal && (
                <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Detalhamento de macros não disponível
                </div>
              )}

              {activePlan.published_at && (
                <div className="text-[10px] mt-3 pt-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.22)' }}>
                  Publicado em {fmtShort(activePlan.published_at)}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 4. Exames laboratoriais ───────────────────────────────────── */}
        {latestLabPanel.length > 0 && (
          <>
            <SectionHead label="Exames laboratoriais" icon="🔬"
              action={
                <Link href="/aluno/exames" className="text-[10px] font-bold" style={{ color: 'rgba(37,99,235,0.7)' }}>
                  Ver todos →
                </Link>
              }
            />
            <div className="rounded-2xl overflow-hidden mb-4"
              style={{ background: 'var(--dark-card)', border: `1px solid ${abnormalLabs.length > 0 ? 'rgba(248,113,113,0.25)' : 'var(--dark-border)'}` }}>

              {/* Coleta header */}
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-xs font-semibold text-white">
                  Coleta de {latestLabDate ? new Date(latestLabDate + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                </span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {latestLabPanel.length} exame{latestLabPanel.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Alert if abnormal */}
              {abnormalLabs.length > 0 && (
                <div className="px-4 py-3 flex items-start gap-2 border-b"
                  style={{ borderColor: 'rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.05)' }}>
                  <span className="text-base">⚠️</span>
                  <div>
                    <div className="text-xs font-bold" style={{ color: '#F87171' }}>
                      {abnormalLabs.length} resultado{abnormalLabs.length !== 1 ? 's' : ''} fora do intervalo de referência
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Converse com seu nutricionista
                    </div>
                  </div>
                </div>
              )}

              {/* Show abnormal first, then up to 4 normals */}
              {[
                ...abnormalLabs,
                ...latestLabPanel.filter(l => l.status === 'normal' || !l.status).slice(0, Math.max(0, 6 - abnormalLabs.length)),
              ].map((lab, i, arr) => {
                const st = lab.status ? LAB_STATUS[lab.status] : LAB_STATUS.normal
                return (
                  <div key={lab.id}
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-xs text-white truncate">{lab.exam_name}</div>
                      {lab.panel_name && (
                        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{lab.panel_name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-white">
                        {lab.value ?? '—'}{lab.unit ? ` ${lab.unit}` : ''}
                      </span>
                      {lab.status && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {latestLabPanel.length > 6 && (
                <div className="px-4 py-2.5 border-t text-center"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <Link href="/aluno/exames" className="text-[10px] font-bold" style={{ color: '#60A5FA' }}>
                    Ver todos os {latestLabPanel.length} exames →
                  </Link>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 5. Suplementos ────────────────────────────────────────────── */}
        {suppTimings.length > 0 && (
          <>
            <SectionHead label="Protocolo de suplementação" icon="💊"
              action={
                <Link href="/aluno/suplementos" className="text-[10px] font-bold" style={{ color: 'rgba(37,99,235,0.7)' }}>
                  Ver detalhes →
                </Link>
              }
            />
            <div className="rounded-2xl overflow-hidden mb-4"
              style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
              {suppTimings.map((timing, ti) => (
                <div key={timing} className={ti < suppTimings.length - 1 ? 'border-b' : ''}
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2 px-4 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-sm">{TIMING_LABELS[timing]?.icon ?? '⏰'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[1px]"
                      style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {TIMING_LABELS[timing]?.label ?? timing}
                    </span>
                  </div>
                  {suppByTiming[timing]?.map((s, si) => (
                    <div key={s.id}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderTop: si > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                      <span className="text-xs text-white">{s.name}</span>
                      <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {s.dose} {s.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── 6. Metas ativas ───────────────────────────────────────────── */}
        {goalsWithPct.length > 0 && (
          <>
            <SectionHead label="Metas ativas" icon="🎯"
              action={
                <Link href="/aluno/metas" className="text-[10px] font-bold" style={{ color: 'rgba(37,99,235,0.7)' }}>
                  Ver todas →
                </Link>
              }
            />
            <div className="space-y-2 mb-4">
              {goalsWithPct.map(g => (
                <div key={g.id} className="rounded-xl p-3.5"
                  style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-xs font-semibold text-white leading-snug">{g.label}</div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {g.daysLeft !== null && g.daysLeft > 0 && (
                        <span className="text-[10px] font-bold"
                          style={{ color: g.daysLeft <= 7 ? '#F87171' : g.daysLeft <= 30 ? '#FCD34D' : 'rgba(255,255,255,0.3)' }}>
                          {g.daysLeft}d
                        </span>
                      )}
                      <span className="text-[10px] font-black" style={{ color: g.color }}>{g.pct}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${g.pct}%`, background: `linear-gradient(90deg, ${g.color}88, ${g.color})` }} />
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {g.current_value ?? '—'}{g.unit ?? ''} / {g.target_value}{g.unit ?? ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── 7. Próxima consulta ────────────────────────────────────────── */}
        {nextConsult && consultDays !== null && (
          <>
            <SectionHead label="Próxima consulta" icon="📅" />
            <div className="rounded-2xl p-4 mb-4"
              style={{
                background: consultDays <= 1 ? 'rgba(245,158,11,0.07)' : 'rgba(139,92,246,0.07)',
                border: `1px solid ${consultDays <= 1 ? 'rgba(245,158,11,0.25)' : 'rgba(139,92,246,0.25)'}`,
              }}>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="text-2xl font-black text-white">{Math.max(0, consultDays)}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {consultDays === 0 ? 'HOJE' : consultDays === 1 ? 'AMANHÃ' : 'dias'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white capitalize">{fmtDate(nextConsult.scheduled_at)}</div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {consultType[nextConsult.type] ?? '📅'} · {nextConsult.duration_min ?? 60}min
                  </div>
                  {nextConsult.notes && (
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {nextConsult.notes}
                    </div>
                  )}
                </div>
                {consultDays <= 1 && (
                  <span className="text-xs font-black px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#FCD34D' }}>
                    {consultDays === 0 ? 'Hoje!' : 'Amanhã!'}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── 8. Medical alerts from anamnesis ──────────────────────────── */}
        {anamnesis && (anamnesis.allergies || anamnesis.intolerances || anamnesis.medical_conditions || anamnesis.medications) && (
          <>
            <SectionHead label="Informações clínicas" icon="📋" />
            <div className="rounded-2xl overflow-hidden mb-4"
              style={{ background: 'var(--dark-card)', border: '1px solid rgba(248,113,113,0.2)' }}>
              {anamnesis.allergies && (
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#F87171' }}>Alergias</div>
                  <div className="text-xs text-white">{anamnesis.allergies}</div>
                </div>
              )}
              {anamnesis.intolerances && (
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#FCD34D' }}>Intolerâncias</div>
                  <div className="text-xs text-white">{anamnesis.intolerances}</div>
                </div>
              )}
              {anamnesis.medical_conditions && (
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#93C5FD' }}>Condições de saúde</div>
                  <div className="text-xs text-white">{anamnesis.medical_conditions}</div>
                </div>
              )}
              {anamnesis.medications && (
                <div className="px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Medicamentos em uso</div>
                  <div className="text-xs text-white">{anamnesis.medications}</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 9. Quick links ────────────────────────────────────────────── */}
        <SectionHead label="Acesso rápido" icon="⚡" />
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { href: '/aluno/exames',       icon: '🔬', label: 'Exames',    color: '#60A5FA' },
            { href: '/aluno/fotos',        icon: '📸', label: 'Fotos',     color: '#A78BFA' },
            { href: '/aluno/suplementos',  icon: '💊', label: 'Suplement.',color: '#34D399' },
            { href: '/aluno/agua',         icon: '💧', label: 'Hidratação',color: '#38BDF8' },
            { href: '/aluno/conquistas',   icon: '🏅', label: 'Conquistas',color: '#FCD34D' },
            { href: '/aluno/semana',       icon: '📅', label: 'Semana',    color: '#FB923C' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95"
              style={{ background: `${item.color}10`, border: `1px solid ${item.color}22` }}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-bold text-white">{item.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
