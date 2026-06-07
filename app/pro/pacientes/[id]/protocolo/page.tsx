import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function r(n: number, d = 1) { return Math.round(n * 10 ** d) / 10 ** d }
function age(dob: string | null) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob + 'T12:00').getTime()) / (365.25 * 86400000))
}
function bmiClass(bmi: number) {
  if (bmi < 18.5) return { label: 'Abaixo do peso', color: '#93C5FD' }
  if (bmi < 25)   return { label: 'Peso normal',    color: '#4ADE80' }
  if (bmi < 30)   return { label: 'Sobrepeso',      color: '#FCD34D' }
  if (bmi < 35)   return { label: 'Ob. I',          color: '#FB923C' }
  if (bmi < 40)   return { label: 'Ob. II',         color: '#F87171' }
  return               { label: 'Ob. III',       color: '#EF4444' }
}
function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00').getTime()) / 86400000)
}

/* ─── Section heading ─────────────────────────────────────────────────────── */
function SectionHead({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-[11px] font-bold uppercase tracking-[2px]"
        style={{ color: 'rgba(255,255,255,0.35)' }}>{title}</div>
      {href && linkLabel && (
        <Link href={href} className="text-[11px] font-semibold"
          style={{ color: '#60A5FA' }}>{linkLabel} →</Link>
      )}
    </div>
  )
}

/* ─── Goal progress bar ───────────────────────────────────────────────────── */
function GoalBar({ label, current, start, target, unit, direction }: {
  label: string; current: number | null; start: number | null; target: number; unit: string; direction: string
}) {
  const cur = current ?? start ?? 0
  const str = start ?? target
  const progressRange = Math.abs(target - str)
  const progressMade  = direction === 'down' ? Math.max(str - cur, 0) : Math.max(cur - str, 0)
  const pct = progressRange > 0 ? Math.min((progressMade / progressRange) * 100, 100) : (cur === target ? 100 : 0)
  const achieved = direction === 'down' ? cur <= target : cur >= target

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>{label}</span>
        <span className="text-xs font-black" style={{ color: achieved ? '#4ADE80' : '#93C5FD' }}>
          {cur}{unit}
          <span style={{ color: 'rgba(255,255,255,0.3)' }}> → {target}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full"
          style={{ width: `${pct}%`, background: achieved ? '#4ADE80' : 'linear-gradient(90deg,#2563EB,#60A5FA)' }} />
      </div>
      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        <span>{r(pct, 0)}% concluído</span>
        {!achieved && <span>{direction === 'down' ? `-${r(cur - target)}` : `+${r(target - cur)}`}{unit} restante</span>}
        {achieved && <span style={{ color: '#4ADE80' }}>✓ Alcançado!</span>}
      </div>
    </div>
  )
}

/* ─── Macro bar ───────────────────────────────────────────────────────────── */
function MacroBarSimple({ p, c, f, kcal }: { p: number; c: number; f: number; kcal: number }) {
  const total = p * 4 + c * 4 + f * 9 || 1
  const pp = (p * 4 / total) * 100
  const cp = (c * 4 / total) * 100
  const fp = (f * 9 / total) * 100
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        <div style={{ width: `${pp}%`, background: '#60A5FA' }} />
        <div style={{ width: `${cp}%`, background: '#FBBF24' }} />
        <div style={{ width: `${fp}%`, background: '#F87171' }} />
      </div>
      <div className="flex gap-3 text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <span><span style={{ color: '#60A5FA' }}>●</span> {r(p, 0)}g prot</span>
        <span><span style={{ color: '#FBBF24' }}>●</span> {r(c, 0)}g carb</span>
        <span><span style={{ color: '#F87171' }}>●</span> {r(f, 0)}g gord</span>
        <span style={{ color: '#A78BFA' }}>{r(kcal, 0)} kcal</span>
      </div>
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default async function ProtocoloPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [
    { data: patient },
    { data: records },
    { data: activePlan },
    { data: supplements },
    { data: goals },
    { data: recentNotes },
    { data: lastConsultation },
    { data: anamnesis },
    { data: lastDiary },
    { data: upcomingConsultation },
  ] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('anthropometric_records')
      .select('measured_at, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, hip_cm, arm_cm, adherence_pct, notes')
      .eq('patient_id', id).order('measured_at', { ascending: false }).limit(4),
    supabase.from('diet_plans')
      .select('id, title, target_kcal, target_protein_g, target_carbs_g, target_fat_g, meals(meal_foods(quantity_g, food:foods(kcal, protein_g, carbs_g, fat_g)))')
      .eq('patient_id', id).eq('professional_id', user.id).eq('active', true)
      .not('published_at', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('supplement_prescriptions')
      .select('name, dosage, unit, frequency, timing, notes, active')
      .eq('patient_id', id).eq('professional_id', user.id).eq('active', true)
      .order('timing'),
    supabase.from('patient_goals')
      .select('label, metric, unit, target_value, current_value, start_value, direction, deadline, achieved')
      .eq('patient_id', id).eq('professional_id', user.id).eq('achieved', false).eq('active', true)
      .order('created_at').limit(5),
    supabase.from('patient_notes')
      .select('content, created_at, note_type')
      .eq('patient_id', id).eq('professional_id', user.id)
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('consultations')
      .select('scheduled_at, type, notes, status')
      .eq('patient_id', id).eq('professional_id', user.id).eq('status', 'realizado')
      .order('scheduled_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('patient_anamnesis')
      .select('food_restrictions, food_preferences, health_conditions, medications, allergies, lifestyle_notes')
      .eq('patient_id', id).eq('professional_id', user.id).maybeSingle(),
    supabase.from('diary_entries')
      .select('logged_at, total_kcal, total_protein_g, total_carbs_g, total_fat_g')
      .eq('patient_id', id).order('logged_at', { ascending: false }).limit(7),
    supabase.from('consultations')
      .select('scheduled_at, type, status, duration_min')
      .eq('patient_id', id).eq('professional_id', user.id)
      .in('status', ['agendado', 'confirmado'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at').limit(1).maybeSingle(),
  ])

  if (!patient) redirect('/pro/pacientes')

  // ── Compute vitals ────────────────────────────────────────────────────
  const latestRecord = records?.[0] ?? null
  const prevRecord   = records?.[1] ?? null
  const patientAge = age(patient.date_of_birth)
  const heightM = (patient.height_cm ?? 0) / 100
  const bmi = latestRecord?.weight_kg && heightM > 0
    ? r(latestRecord.weight_kg / (heightM * heightM))
    : null
  const bmiInfo = bmi ? bmiClass(bmi) : null

  const weightDelta = latestRecord?.weight_kg && prevRecord?.weight_kg
    ? r(latestRecord.weight_kg - prevRecord.weight_kg)
    : null
  const fatDelta = latestRecord?.body_fat_pct && prevRecord?.body_fat_pct
    ? r(latestRecord.body_fat_pct - prevRecord.body_fat_pct)
    : null

  // ── Compute plan macros ───────────────────────────────────────────────
  let planKcal = 0, planProtein = 0, planCarbs = 0, planFat = 0
  if (activePlan) {
    if (activePlan.target_kcal) {
      planKcal    = activePlan.target_kcal ?? 0
      planProtein = activePlan.target_protein_g ?? 0
      planCarbs   = activePlan.target_carbs_g ?? 0
      planFat     = activePlan.target_fat_g ?? 0
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const meal of (activePlan.meals ?? []) as any[]) {
        for (const mf of (meal.meal_foods ?? [])) {
          const f = mf.food
          if (!f) continue
          const ratio = mf.quantity_g / 100
          planKcal    += (f.kcal     ?? 0) * ratio
          planProtein += (f.protein_g ?? 0) * ratio
          planCarbs   += (f.carbs_g  ?? 0) * ratio
          planFat     += (f.fat_g    ?? 0) * ratio
        }
      }
    }
  }

  // ── Last 7 diary days logged ──────────────────────────────────────────
  const diaryDates = new Set((lastDiary ?? []).map(d => (d.logged_at as string).split('T')[0]))
  const today = new Date().toISOString().split('T')[0]
  let recentStreak = 0
  for (let i = 0; i <= 7; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    if (diaryDates.has(d)) recentStreak++
    else if (i > 0) break
  }

  // Avg kcal last 7 diary entries
  const diaryWithKcal = (lastDiary ?? []).filter(d => d.total_kcal)
  const avgKcal = diaryWithKcal.length > 0
    ? diaryWithKcal.reduce((s, d) => s + (d.total_kcal ?? 0), 0) / diaryWithKcal.length
    : 0

  // ── Supplement timing labels ──────────────────────────────────────────
  const TIMING_LABELS: Record<string, string> = {
    manha: 'Manhã', almoco: 'Almoço', treino: 'Pré-treino',
    pos_treino: 'Pós-treino', noite: 'Noite', jejum: 'Em jejum',
    com_refeicao: 'Com refeição', antes_dormir: 'Antes de dormir',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 px-6 h-14 flex items-center gap-3"
        style={{
          background: 'rgba(6,6,10,0.95)',
          borderBottom: '1px solid rgba(37,99,235,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href={`/pro/pacientes/${id}`}
          className="text-sm font-semibold"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← {patient.full_name}
        </Link>
        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="text-sm font-black text-white">Protocolo</span>
        <div className="flex-1" />
        <span className="text-xs px-2 py-1 rounded-lg font-semibold"
          style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD' }}>
          Consulta
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-5">

          {/* ── COLUMN 1: Vitals + Records + Diary ──────────────────── */}
          <div className="space-y-5">

            {/* Patient vitals */}
            <div className="card p-5">
              <SectionHead title="Identificação" href={`/pro/pacientes/${id}`} linkLabel="Editar" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(37,99,235,0.15)' }}>
                  {patient.gender === 'F' ? '👩' : patient.gender === 'M' ? '👨' : '🧑'}
                </div>
                <div>
                  <div className="font-black text-gray-900 leading-tight">{patient.full_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {patientAge ? `${patientAge} anos` : ''}
                    {patient.goal ? ` · ${patient.goal}` : ''}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Peso cadastro', value: patient.weight_kg ? `${patient.weight_kg} kg` : '—' },
                  { label: 'Altura', value: patient.height_cm ? `${patient.height_cm} cm` : '—' },
                  { label: 'IMC', value: bmi ? `${bmi}` : '—', note: bmiInfo?.label, color: bmiInfo?.color },
                ].map(v => (
                  <div key={v.label} className="rounded-xl p-2.5 text-center"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                    <div className="text-[10px] text-gray-400 font-medium mb-0.5">{v.label}</div>
                    <div className="text-sm font-black text-gray-800"
                      style={{ color: v.color ?? undefined }}>{v.value}</div>
                    {v.note && <div className="text-[9px]" style={{ color: v.color }}>{v.note}</div>}
                  </div>
                ))}
              </div>
              {patient.phone && (
                <a href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span>📱</span> WhatsApp {patient.phone}
                </a>
              )}
            </div>

            {/* Latest measurements */}
            <div className="card p-5">
              <SectionHead title="Medidas" href={`/pro/pacientes/${id}/medidas`} linkLabel="Ver histórico" />
              {latestRecord ? (
                <>
                  <div className="text-xs text-gray-400 mb-3">
                    Última avaliação: {new Date(latestRecord.measured_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' '}({daysAgo(latestRecord.measured_at)}d atrás)
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Peso',      val: latestRecord.weight_kg,       unit: 'kg', delta: weightDelta, lowerBetter: false },
                      { label: 'Gordura',   val: latestRecord.body_fat_pct,    unit: '%',  delta: fatDelta,    lowerBetter: true  },
                      { label: 'M. Magra',  val: latestRecord.muscle_mass_kg,  unit: 'kg', delta: null,        lowerBetter: false },
                      { label: 'Cintura',   val: latestRecord.waist_cm,        unit: 'cm', delta: null,        lowerBetter: true  },
                      { label: 'Quadril',   val: latestRecord.hip_cm,          unit: 'cm', delta: null,        lowerBetter: false },
                      { label: 'Braço',     val: latestRecord.arm_cm,          unit: 'cm', delta: null,        lowerBetter: false },
                      { label: 'Aderência', val: latestRecord.adherence_pct,   unit: '%',  delta: null,        lowerBetter: false },
                    ].filter(m => m.val != null).map(m => (
                      <div key={m.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{m.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-800">{r(m.val!)} {m.unit}</span>
                          {m.delta !== null && m.delta !== undefined && m.delta !== 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: ((m.delta < 0) === m.lowerBetter) ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                                color: ((m.delta < 0) === m.lowerBetter) ? '#4ADE80' : '#F87171',
                              }}>
                              {m.delta > 0 ? '+' : ''}{r(m.delta)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {latestRecord.notes && (
                    <div className="mt-3 text-xs p-2.5 rounded-lg italic"
                      style={{ background: 'rgba(255,255,255,0.5)', color: '#374151' }}>
                      &ldquo;{latestRecord.notes}&rdquo;
                    </div>
                  )}
                </>
              ) : (
                <Link href={`/pro/pacientes/${id}/medidas`}
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                  <span>+</span> Registrar avaliação física
                </Link>
              )}
            </div>

            {/* Diary summary */}
            <div className="card p-5">
              <SectionHead title="Diário Alimentar" href={`/pro/pacientes/${id}/diario`} linkLabel="Ver diário" />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-xl p-3 text-center"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-xl font-black" style={{ color: '#FBBF24' }}>{recentStreak}</div>
                  <div className="text-[10px] text-gray-500">dias seguidos</div>
                </div>
                <div className="rounded-xl p-3 text-center"
                  style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-xl font-black text-pgf-600">{avgKcal > 0 ? `${Math.round(avgKcal)}` : '—'}</div>
                  <div className="text-[10px] text-gray-500">kcal/dia (7d)</div>
                </div>
              </div>
              {planKcal > 0 && avgKcal > 0 && (
                <div className="text-xs text-gray-500">
                  Aderência calórica:{' '}
                  <span className="font-bold"
                    style={{ color: Math.abs((avgKcal / planKcal) - 1) < 0.1 ? '#4ADE80' : '#FBBF24' }}>
                    {Math.round((avgKcal / planKcal) * 100)}%
                  </span>
                  <span className="text-gray-400"> (meta: {Math.round(planKcal)} kcal)</span>
                </div>
              )}
              {diaryDates.has(today) ? (
                <div className="mt-2 text-xs text-emerald-600 font-semibold">✓ Registrou hoje</div>
              ) : (
                <div className="mt-2 text-xs text-amber-500">⚠ Sem registro hoje</div>
              )}
            </div>

          </div>

          {/* ── COLUMN 2: Diet plan + Supplements ───────────────────── */}
          <div className="space-y-5">

            {/* Diet plan */}
            <div className="card p-5">
              <SectionHead title="Plano Alimentar" href={`/pro/pacientes/${id}/dieta`} linkLabel="Editar plano" />
              {activePlan ? (
                <>
                  <div className="font-bold text-gray-800 mb-3">{activePlan.title}</div>
                  <MacroBarSimple p={planProtein} c={planCarbs} f={planFat} kcal={planKcal} />
                  {activePlan.meals && activePlan.meals.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(activePlan.meals as any[]).slice(0, 6).map((meal: { id: string; name: string; time_start: string | null }, i: number) => (
                        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
                          <span className="text-xs text-gray-500 w-10 flex-shrink-0">
                            {meal.time_start ? meal.time_start.slice(0, 5) : '—'}
                          </span>
                          <span className="text-xs font-medium text-gray-700">{meal.name}</span>
                        </div>
                      ))}
                      {(activePlan.meals as unknown as { id: string }[]).length > 6 && (
                        <div className="text-xs text-gray-400 pt-1">
                          +{(activePlan.meals as unknown as { id: string }[]).length - 6} refeições...
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Link href={`/pro/pacientes/${id}/dieta`}
                      className="flex-1 text-center text-xs font-semibold py-2 rounded-xl transition-all"
                      style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.2)' }}>
                      Editar
                    </Link>
                    <Link href={`/pro/pacientes/${id}/dieta/imprimir`}
                      className="flex-1 text-center text-xs font-semibold py-2 rounded-xl transition-all"
                      style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                      Imprimir
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">🥗</div>
                  <div className="text-sm text-gray-500 mb-3">Nenhum plano ativo</div>
                  <Link href={`/pro/pacientes/${id}/dieta`}
                    className="text-xs font-semibold px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>
                    Criar plano
                  </Link>
                </div>
              )}
            </div>

            {/* Supplements */}
            <div className="card p-5">
              <SectionHead title="Suplementação" href={`/pro/pacientes/${id}/suplementos`} linkLabel="Editar" />
              {supplements && supplements.length > 0 ? (
                <div className="space-y-2">
                  {supplements.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.1)' }}>💊</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-800 leading-tight">{s.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {s.dosage} {s.unit} · {TIMING_LABELS[s.timing ?? ''] ?? s.timing ?? '—'}
                          {s.frequency ? ` · ${s.frequency}` : ''}
                        </div>
                        {s.notes && <div className="text-[10px] text-gray-400 italic mt-0.5">{s.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-4">
                  Nenhum suplemento prescrito
                </div>
              )}
            </div>

            {/* Anamnesis highlights */}
            {anamnesis && (
              <div className="card p-5">
                <SectionHead title="Anamnese" href={`/pro/pacientes/${id}/anamnese`} linkLabel="Ver completo" />
                <div className="space-y-2 text-xs">
                  {anamnesis.health_conditions && (
                    <div>
                      <span className="font-bold text-gray-600">Condições: </span>
                      <span className="text-gray-800">{anamnesis.health_conditions}</span>
                    </div>
                  )}
                  {anamnesis.medications && (
                    <div>
                      <span className="font-bold text-gray-600">Medicamentos: </span>
                      <span className="text-gray-800">{anamnesis.medications}</span>
                    </div>
                  )}
                  {anamnesis.allergies && (
                    <div>
                      <span className="font-bold text-red-600">⚠ Alergias: </span>
                      <span className="font-semibold text-red-700">{anamnesis.allergies}</span>
                    </div>
                  )}
                  {anamnesis.food_restrictions && (
                    <div>
                      <span className="font-bold text-amber-600">Restrições: </span>
                      <span className="text-gray-800">{anamnesis.food_restrictions}</span>
                    </div>
                  )}
                  {anamnesis.food_preferences && (
                    <div>
                      <span className="font-bold text-gray-600">Preferências: </span>
                      <span className="text-gray-800">{anamnesis.food_preferences}</span>
                    </div>
                  )}
                  {anamnesis.lifestyle_notes && (
                    <div>
                      <span className="font-bold text-gray-600">Estilo de vida: </span>
                      <span className="text-gray-800">{anamnesis.lifestyle_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ── COLUMN 3: Goals + Notes + Actions ───────────────────── */}
          <div className="space-y-5">

            {/* Goals */}
            <div className="card p-5">
              <SectionHead title="Metas Ativas" href={`/pro/pacientes/${id}/metas`} linkLabel="Gerenciar" />
              {goals && goals.length > 0 ? (
                <div className="space-y-4">
                  {goals.map((g, i) => (
                    <GoalBar
                      key={i}
                      label={g.label ?? g.metric ?? 'Meta'}
                      current={g.current_value}
                      start={g.start_value}
                      target={g.target_value}
                      unit={g.unit ?? ''}
                      direction={g.direction ?? 'down'}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-400 mb-3">Nenhuma meta ativa</div>
                  <Link href={`/pro/pacientes/${id}/metas`}
                    className="text-xs font-semibold px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED' }}>
                    Definir metas
                  </Link>
                </div>
              )}
            </div>

            {/* Last consultation notes */}
            {(lastConsultation || recentNotes?.length) && (
              <div className="card p-5">
                <SectionHead title="Notas Clínicas" href={`/pro/pacientes/${id}/notas`} linkLabel="Ver todas" />
                {lastConsultation?.notes && (
                  <div className="mb-3">
                    <div className="text-[10px] font-semibold text-gray-400 mb-1">
                      Última consulta — {new Date(lastConsultation.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed p-3 rounded-xl"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                      {lastConsultation.notes}
                    </div>
                  </div>
                )}
                {(recentNotes ?? []).slice(0, 2).map((n, i) => (
                  <div key={i} className="mb-2">
                    <div className="text-[10px] font-semibold text-gray-400 mb-1">
                      {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {n.note_type ? ` · ${n.note_type}` : ''}
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed p-2.5 rounded-xl"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                      {n.content?.slice(0, 150)}{n.content && n.content.length > 150 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Next consultation */}
            {upcomingConsultation && (
              <div className="card p-4"
                style={{ borderLeft: '3px solid #2563EB' }}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-pgf-600 mb-1">Próxima consulta</div>
                <div className="font-bold text-gray-800">
                  {new Date(upcomingConsultation.scheduled_at).toLocaleDateString('pt-BR', {
                    weekday: 'long', day: '2-digit', month: 'long',
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(upcomingConsultation.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}{upcomingConsultation.duration_min}min
                  {' · '}{upcomingConsultation.type}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="card p-5">
              <SectionHead title="Ações Rápidas" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/pro/pacientes/${id}/medidas`,     icon: '📏', label: 'Nova Avaliação' },
                  { href: `/pro/pacientes/${id}/consultas`,   icon: '📅', label: 'Agendar Consulta' },
                  { href: `/pro/pacientes/${id}/notas`,       icon: '📝', label: 'Adicionar Nota' },
                  { href: `/pro/pacientes/${id}/diario`,      icon: '📔', label: 'Ver Diário' },
                  { href: `/pro/pacientes/${id}/evolucao`,    icon: '📈', label: 'Ver Evolução' },
                  { href: `/pro/pacientes/${id}/metas`,       icon: '🎯', label: 'Atualizar Meta' },
                ].map(a => (
                  <Link key={a.href} href={a.href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', color: '#4B5563' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.3)'; e.currentTarget.style.color = '#2563EB' }}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'var(--dark-border)'; e.currentTarget.style.color = '#4B5563' }}
                  >
                    <span>{a.icon}</span> {a.label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
