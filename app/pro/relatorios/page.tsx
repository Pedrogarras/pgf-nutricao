import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function r(n: number, d = 1) { return Math.round(n * 10 ** d) / 10 ** d }

function bmiClass(bmi: number) {
  if (bmi < 18.5) return { label: 'Abaixo do peso', color: '#93C5FD' }
  if (bmi < 25)   return { label: 'Peso normal',    color: '#4ADE80' }
  if (bmi < 30)   return { label: 'Sobrepeso',      color: '#FCD34D' }
  if (bmi < 35)   return { label: 'Ob. grau I',     color: '#FB923C' }
  if (bmi < 40)   return { label: 'Ob. grau II',    color: '#F87171' }
  return               { label: 'Ob. grau III',  color: '#EF4444' }
}

// Simple SVG bar for distribution charts
function DistBar({ pct, color, label, count }: { pct: number; color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 group">
      <div className="text-[10px] w-24 flex-shrink-0 text-right" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</div>
      <div className="flex-1 h-5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(pct, 2)}%`, background: color }}
        />
      </div>
      <div className="text-[10px] w-8 flex-shrink-0 font-bold" style={{ color }}>{count}</div>
    </div>
  )
}

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nowISO = new Date().toISOString()
  const thirtyDaysAgo  = new Date(Date.now() - 30  * 86400000).toISOString()
  const ninetyDaysAgo  = new Date(Date.now() - 90  * 86400000).toISOString()
  const oneYearAgo     = new Date(Date.now() - 365 * 86400000).toISOString()
  const sevenDaysAgo   = new Date(Date.now() - 7   * 86400000).toISOString()

  const [
    { data: allPatients },
    { data: recentDiary },
    { data: allRecords },
    { data: consultations },
    { data: activeGoals },
    { data: achievedGoals },
    { data: allPlans },
  ] = await Promise.all([
    supabase.from('patients')
      .select('id, full_name, weight_kg, height_cm, date_of_birth, gender, goal, active, created_at, auth_user_id')
      .eq('professional_id', user.id)
      .order('full_name'),

    // Diary entries last 7 days for compliance rate
    supabase.from('diary_entries')
      .select('patient_id, logged_at, total_kcal')
      .gte('logged_at', sevenDaysAgo),

    // All anthropometric records (first + last per patient)
    supabase.from('anthropometric_records')
      .select('patient_id, measured_at, weight_kg, body_fat_pct, muscle_mass_kg, adherence_pct')
      .eq('professional_id', user.id)
      .order('measured_at', { ascending: true }),

    // Consultations last 90 days
    supabase.from('consultations')
      .select('patient_id, scheduled_at, type, status')
      .eq('professional_id', user.id)
      .gte('scheduled_at', ninetyDaysAgo)
      .order('scheduled_at', { ascending: false }),

    // Active goals
    supabase.from('patient_goals')
      .select('patient_id, metric, label, target_value, current_value, start_value, achieved, deadline')
      .eq('professional_id', user.id)
      .eq('achieved', false),

    // Goals achieved last 90 days
    supabase.from('patient_goals')
      .select('patient_id, label, achieved_at')
      .eq('professional_id', user.id)
      .eq('achieved', true)
      .gte('achieved_at', ninetyDaysAgo),

    // Active diet plans
    supabase.from('diet_plans')
      .select('patient_id, kcal_goal, active, published_at, created_at')
      .eq('professional_id', user.id),
  ])

  const patients = allPatients ?? []
  const activePatients = patients.filter(p => p.active)
  const hasAppAccess = patients.filter(p => p.auth_user_id)

  // --- Diary compliance (last 7 days) ---
  const diaryByPatient = new Map<string, number>()
  for (const e of recentDiary ?? []) {
    diaryByPatient.set(e.patient_id, (diaryByPatient.get(e.patient_id) ?? 0) + 1)
  }
  const loggedThisWeek = activePatients.filter(p => (diaryByPatient.get(p.id) ?? 0) >= 3).length
  const notLoggedThisWeek = activePatients.filter(p => (diaryByPatient.get(p.id) ?? 0) === 0).length
  const avgDiaryDaysPerPatient = activePatients.length > 0
    ? r([...diaryByPatient.values()].reduce((s, v) => s + v, 0) / activePatients.length)
    : 0

  // --- Weight change ---
  const recordsByPatient = new Map<string, { first: typeof allRecords[0]; last: typeof allRecords[0] }>()
  for (const rec of allRecords ?? []) {
    const cur = recordsByPatient.get(rec.patient_id)
    if (!cur) {
      recordsByPatient.set(rec.patient_id, { first: rec, last: rec })
    } else {
      if (rec.measured_at > cur.last.measured_at) cur.last = rec
    }
  }

  const weightChanges: { id: string; name: string; delta: number; first: number; last: number }[] = []
  for (const p of activePatients) {
    const recs = recordsByPatient.get(p.id)
    if (recs && recs.first.weight_kg && recs.last.weight_kg && recs.first.id !== recs.last.id) {
      weightChanges.push({
        id: p.id,
        name: p.full_name,
        delta: r(recs.last.weight_kg - recs.first.weight_kg),
        first: recs.first.weight_kg,
        last: recs.last.weight_kg,
      })
    }
  }
  weightChanges.sort((a, b) => a.delta - b.delta) // best losers first

  const lossCount = weightChanges.filter(w => w.delta < -0.5).length
  const gainCount = weightChanges.filter(w => w.delta > 0.5).length
  const stableCount = weightChanges.filter(w => Math.abs(w.delta) <= 0.5).length
  const avgWeightChange = weightChanges.length > 0
    ? r(weightChanges.reduce((s, w) => s + w.delta, 0) / weightChanges.length)
    : 0

  // --- BMI distribution ---
  const bmiGroups = { low: 0, normal: 0, over: 0, ob1: 0, ob2: 0, ob3: 0 }
  for (const p of activePatients) {
    if (!p.weight_kg || !p.height_cm) continue
    const bmi = p.weight_kg / (p.height_cm / 100) ** 2
    if (bmi < 18.5)      bmiGroups.low++
    else if (bmi < 25)   bmiGroups.normal++
    else if (bmi < 30)   bmiGroups.over++
    else if (bmi < 35)   bmiGroups.ob1++
    else if (bmi < 40)   bmiGroups.ob2++
    else                 bmiGroups.ob3++
  }
  const bmiTotal = Object.values(bmiGroups).reduce((s, v) => s + v, 0)

  // --- Consultations ---
  const consultationsDone = (consultations ?? []).filter(c => c.status === 'realizado').length
  const consultationsPending = (consultations ?? []).filter(c => ['agendado', 'confirmado'].includes(c.status) && c.scheduled_at >= nowISO).length
  const consultationByType = { presencial: 0, online: 0, telefone: 0 }
  for (const c of (consultations ?? []).filter(c => c.status === 'realizado')) {
    const t = c.type as keyof typeof consultationByType
    if (t in consultationByType) consultationByType[t]++
  }

  // Consultations per patient
  const consultsByPatient = new Map<string, number>()
  for (const c of (consultations ?? []).filter(c => c.status === 'realizado')) {
    consultsByPatient.set(c.patient_id, (consultsByPatient.get(c.patient_id) ?? 0) + 1)
  }
  const avgConsults = activePatients.length > 0
    ? r([...consultsByPatient.values()].reduce((s, v) => s + v, 0) / activePatients.length)
    : 0

  // --- Goals ---
  const activeGoalCount = (activeGoals ?? []).length
  const achievedGoalCount = (achievedGoals ?? []).length
  const goalMetrics: Record<string, number> = {}
  for (const g of activeGoals ?? []) {
    goalMetrics[g.metric] = (goalMetrics[g.metric] ?? 0) + 1
  }
  const topGoalMetrics = Object.entries(goalMetrics).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const metricLabel: Record<string, string> = {
    peso: '⚖️ Peso', gordura: '📊 Gordura', cintura: '📏 Cintura',
    massa: '💪 Massa magra', pressao: '🩺 Pressão', outro: '🎯 Outro',
  }

  // --- Diet plans ---
  const activePlansCount = (allPlans ?? []).filter(p => p.active && p.published_at).length
  const patientsWithActivePlan = new Set((allPlans ?? []).filter(p => p.active && p.published_at).map(p => p.patient_id)).size
  const avgKcal = (() => {
    const goals = (allPlans ?? []).filter(p => p.kcal_goal && p.active && p.published_at).map(p => p.kcal_goal!)
    return goals.length > 0 ? Math.round(goals.reduce((s, v) => s + v, 0) / goals.length) : null
  })()

  // --- Patient growth ---
  const joinedThisMonth = patients.filter(p => {
    const d = new Date(p.created_at)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  const joinedThisYear = patients.filter(p => new Date(p.created_at) >= new Date(oneYearAgo)).length

  // --- Gender split ---
  const genderCount = { M: 0, F: 0, other: 0 }
  for (const p of activePatients) {
    if (p.gender === 'M') genderCount.M++
    else if (p.gender === 'F') genderCount.F++
    else genderCount.other++
  }

  // --- Top engaged patients (most diary this week) ---
  const topEngaged = activePatients
    .map(p => ({ ...p, diaryDays: diaryByPatient.get(p.id) ?? 0 }))
    .filter(p => p.diaryDays > 0)
    .sort((a, b) => b.diaryDays - a.diaryDays)
    .slice(0, 5)

  // --- Top weight loss ---
  const topLoss = weightChanges.filter(w => w.delta < 0).slice(0, 5)

  // --- Month label ---
  const now = new Date()
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        <Link href="/pro/dashboard" className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Dashboard</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-xs font-semibold text-white">Relatórios da Prática</span>
      </div>

      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">📊 Relatórios da Prática</h1>
          <p className="text-sm mt-1 capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Visão geral · {monthLabel}
          </p>
        </div>
        <div className="text-right text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Dados em tempo real
        </div>
      </div>

      {/* ─── Row 1: key KPIs ─── */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          {
            label: 'Pacientes ativos',
            value: activePatients.length,
            sub: `${patients.length} total`,
            color: '#93C5FD',
            icon: '👥',
          },
          {
            label: 'Com acesso app',
            value: hasAppAccess.length,
            sub: `${activePatients.length > 0 ? Math.round(hasAppAccess.length / activePatients.length * 100) : 0}% dos ativos`,
            color: '#60A5FA',
            icon: '📱',
          },
          {
            label: 'Diário (7 dias)',
            value: `${loggedThisWeek}/${activePatients.length}`,
            sub: `${notLoggedThisWeek} sem nenhum log`,
            color: notLoggedThisWeek > activePatients.length * 0.5 ? '#F87171' : '#4ADE80',
            icon: '📔',
          },
          {
            label: 'Consultas (90d)',
            value: consultationsDone,
            sub: `${consultationsPending} agendadas`,
            color: '#34D399',
            icon: '📅',
          },
          {
            label: 'Metas atingidas',
            value: achievedGoalCount,
            sub: `${activeGoalCount} em progresso`,
            color: '#FCD34D',
            icon: '🏆',
          },
        ].map(kpi => (
          <div key={kpi.label}
            className="rounded-2xl p-4"
            style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{kpi.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-[1.5px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{kpi.label}</span>
            </div>
            <div className="text-2xl font-black" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ─── Row 2: Weight + Diary engagement ─── */}
      <div className="grid grid-cols-2 gap-6 mb-8">

        {/* Weight outcomes */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[2px] mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Resultados de Peso
              </div>
              <div className="text-sm font-black text-white">
                {weightChanges.length} pacientes com histórico
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black" style={{ color: avgWeightChange < 0 ? '#4ADE80' : avgWeightChange > 0 ? '#F87171' : '#9CA3AF' }}>
                {avgWeightChange > 0 ? '+' : ''}{avgWeightChange} kg
              </div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>variação média</div>
            </div>
          </div>
          <div className="space-y-2 mb-5">
            {[
              { label: `Emagrecimento (${lossCount})`, pct: weightChanges.length > 0 ? Math.round(lossCount / weightChanges.length * 100) : 0, color: '#4ADE80', count: lossCount },
              { label: `Estável (${stableCount})`, pct: weightChanges.length > 0 ? Math.round(stableCount / weightChanges.length * 100) : 0, color: '#60A5FA', count: stableCount },
              { label: `Ganho (${gainCount})`, pct: weightChanges.length > 0 ? Math.round(gainCount / weightChanges.length * 100) : 0, color: '#FCD34D', count: gainCount },
            ].map(bar => (
              <DistBar key={bar.label} {...bar} />
            ))}
          </div>
          {/* Top 5 weight loss */}
          {topLoss.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Top emagrecimento
              </div>
              <div className="space-y-1.5">
                {topLoss.map((w, i) => (
                  <div key={w.id} className="flex items-center gap-2">
                    <div className="text-[11px] font-bold w-4 text-center flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>{i + 1}</div>
                    <Link href={`/pro/pacientes/${w.id}`} className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-white truncate block hover:text-blue-300 transition-colors">
                        {w.name.split(' ')[0]} {w.name.split(' ').slice(-1)[0]}
                      </span>
                    </Link>
                    <div className="text-xs font-black" style={{ color: '#4ADE80' }}>
                      {w.delta} kg
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {w.first}→{w.last}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Diary engagement */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Engajamento no Diário (últimos 7 dias)
          </div>
          <div className="text-sm font-black text-white mb-4">
            Média: {avgDiaryDaysPerPatient} dias/paciente
          </div>
          {/* Distribution: 0, 1-2, 3-5, 6-7 */}
          {(() => {
            const none = activePatients.filter(p => (diaryByPatient.get(p.id) ?? 0) === 0).length
            const low  = activePatients.filter(p => { const d = diaryByPatient.get(p.id) ?? 0; return d >= 1 && d <= 2 }).length
            const mid  = activePatients.filter(p => { const d = diaryByPatient.get(p.id) ?? 0; return d >= 3 && d <= 5 }).length
            const high = activePatients.filter(p => (diaryByPatient.get(p.id) ?? 0) >= 6).length
            const total = activePatients.length || 1
            return (
              <div className="space-y-2 mb-5">
                {[
                  { label: 'Sem registros', pct: Math.round(none/total*100), color: '#F87171', count: none },
                  { label: '1-2 dias',      pct: Math.round(low/total*100),  color: '#FCD34D', count: low },
                  { label: '3-5 dias',      pct: Math.round(mid/total*100),  color: '#60A5FA', count: mid },
                  { label: '6-7 dias',      pct: Math.round(high/total*100), color: '#4ADE80', count: high },
                ].map(bar => <DistBar key={bar.label} {...bar} />)}
              </div>
            )
          })()}
          {/* Top engaged */}
          {topEngaged.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Mais engajados esta semana
              </div>
              <div className="space-y-1.5">
                {topEngaged.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="text-[11px] font-bold w-4 text-center flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>{i + 1}</div>
                    <Link href={`/pro/pacientes/${p.id}`} className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-white truncate block hover:text-blue-300 transition-colors">
                        {p.full_name.split(' ')[0]} {p.full_name.split(' ').slice(-1)[0]}
                      </span>
                    </Link>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 7 }).map((_, d) => (
                        <div key={d} className="w-2.5 h-2.5 rounded-sm" style={{
                          background: d < p.diaryDays ? '#4ADE80' : 'rgba(255,255,255,0.05)'
                        }} />
                      ))}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: '#4ADE80' }}>{p.diaryDays}/7</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Row 3: IMC + Metas + Consultas ─── */}
      <div className="grid grid-cols-3 gap-6 mb-8">

        {/* BMI distribution */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Distribuição IMC
          </div>
          <div className="text-sm font-black text-white mb-4">
            {bmiTotal} com dados disponíveis
          </div>
          <div className="space-y-2">
            {[
              { label: 'Abaixo do peso', count: bmiGroups.low,    color: '#93C5FD' },
              { label: 'Peso normal',    count: bmiGroups.normal, color: '#4ADE80' },
              { label: 'Sobrepeso',      count: bmiGroups.over,   color: '#FCD34D' },
              { label: 'Ob. grau I',     count: bmiGroups.ob1,    color: '#FB923C' },
              { label: 'Ob. grau II',    count: bmiGroups.ob2,    color: '#F87171' },
              { label: 'Ob. grau III',   count: bmiGroups.ob3,    color: '#EF4444' },
            ].filter(b => b.count > 0).map(b => (
              <DistBar key={b.label} label={b.label} count={b.count}
                pct={bmiTotal > 0 ? Math.round(b.count / bmiTotal * 100) : 0} color={b.color} />
            ))}
          </div>
          {activePatients.length - bmiTotal > 0 && (
            <div className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {activePatients.length - bmiTotal} pacientes sem medidas cadastradas
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Metas dos Pacientes
          </div>
          <div className="text-sm font-black text-white mb-4">
            {achievedGoalCount} atingidas · {activeGoalCount} em progresso
          </div>
          {topGoalMetrics.length > 0 ? (
            <div className="space-y-2 mb-4">
              {topGoalMetrics.map(([metric, count]) => (
                <DistBar key={metric}
                  label={metricLabel[metric] ?? metric}
                  count={count}
                  pct={activeGoalCount > 0 ? Math.round(count / activeGoalCount * 100) : 0}
                  color="#93C5FD" />
              ))}
            </div>
          ) : (
            <div className="text-xs py-4 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>Nenhuma meta ativa</div>
          )}
          {achievedGoalCount > 0 && (
            <div className="mt-3 rounded-xl p-3 text-center"
              style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)' }}>
              <div className="text-2xl font-black" style={{ color: '#4ADE80' }}>{achievedGoalCount}</div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>metas atingidas em 90 dias</div>
            </div>
          )}
        </div>

        {/* Consultations breakdown */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Consultas (90 dias)
          </div>
          <div className="text-sm font-black text-white mb-4">
            {consultationsDone} realizadas
          </div>
          <div className="space-y-2 mb-4">
            {[
              { label: '🏥 Presencial', count: consultationByType.presencial, color: '#93C5FD' },
              { label: '💻 Online',     count: consultationByType.online,     color: '#60A5FA' },
              { label: '📞 Telefone',   count: consultationByType.telefone,   color: '#818CF8' },
            ].filter(t => t.count > 0).map(t => (
              <DistBar key={t.label} label={t.label} count={t.count}
                pct={consultationsDone > 0 ? Math.round(t.count / consultationsDone * 100) : 0}
                color={t.color} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-base font-black text-white">{avgConsults}</div>
              <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>média/paciente</div>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <div className="text-base font-black" style={{ color: '#93C5FD' }}>{consultationsPending}</div>
              <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>agendadas</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Row 4: Diet plans + patient growth ─── */}
      <div className="grid grid-cols-2 gap-6 mb-8">

        {/* Diet plans */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Planos Alimentares
          </div>
          <div className="text-sm font-black text-white mb-4">
            {activePlansCount} planos ativos publicados
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Com plano ativo', value: patientsWithActivePlan, color: '#4ADE80', icon: '✅' },
              { label: 'Sem plano ativo', value: activePatients.length - patientsWithActivePlan, color: '#FCD34D', icon: '⚠️' },
              { label: 'Kcal médio', value: avgKcal ? `${avgKcal}` : '—', color: '#93C5FD', icon: '🔥', sub: 'kcal/dia' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xl mb-1">{stat.icon}</div>
                <div className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</div>
                {'sub' in stat && <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.sub}</div>}
                <div className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Patient growth + gender */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Crescimento da Carteira
          </div>
          <div className="text-sm font-black text-white mb-4">
            {patients.length} pacientes cadastrados
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Novos este mês', value: joinedThisMonth, color: '#4ADE80' },
              { label: 'Último ano',     value: joinedThisYear,  color: '#93C5FD' },
              { label: 'Feminino',       value: genderCount.F,   color: '#F9A8D4' },
              { label: 'Masculino',      value: genderCount.M,   color: '#60A5FA' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <Link href="/pro/pacientes"
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-center block transition-all"
            style={{ background: 'rgba(37,99,235,0.1)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.25)' }}>
            Ver lista de pacientes →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-3 pt-4 pb-2 mt-4" style={{ opacity: 0.12 }}>
        <div className="w-16 h-px bg-white" />
        <div className="w-1.5 h-1.5 rotate-45 border border-white" />
        <div className="w-1 h-1 rotate-45 bg-white" />
        <div className="w-1.5 h-1.5 rotate-45 border border-white" />
        <div className="w-16 h-px bg-white" />
      </div>
    </div>
  )
}
