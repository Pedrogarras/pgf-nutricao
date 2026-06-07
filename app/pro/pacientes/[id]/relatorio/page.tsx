import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function r(n: number) { return Math.round(n * 10) / 10 }

export default async function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [
    { data: patient },
    { data: records },
    { data: activePlan },
    { data: anamnesis },
    { data: photoCount },
    { data: diaryCount },
    { data: supplements },
    { data: labResults },
    { data: goals },
  ] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('anthropometric_records').select('*').eq('patient_id', id).order('measured_at', { ascending: false }).limit(12),
    supabase.from('diet_plans').select('*, meals(id, name, time_start, meal_foods(*, food:foods(*)))').eq('patient_id', id).eq('professional_id', user.id).eq('active', true).not('published_at', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('patient_anamnesis').select('*').eq('patient_id', id).eq('professional_id', user.id).maybeSingle(),
    supabase.from('progress_photos').select('id', { count: 'exact', head: true }).eq('patient_id', id),
    supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('patient_id', id),
    supabase.from('supplement_prescriptions').select('*').eq('patient_id', id).eq('professional_id', user.id).eq('active', true).order('timing'),
    supabase.from('lab_results').select('*').eq('patient_id', id).eq('professional_id', user.id).order('date', { ascending: false }).limit(50),
    supabase.from('patient_goals').select('*').eq('patient_id', id).eq('professional_id', user.id).eq('active', true),
  ])

  if (!patient) redirect('/pro/pacientes')

  // Derived metrics
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth + 'T12:00').getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const bmi = patient.weight_kg && patient.height_cm
    ? r(patient.weight_kg / Math.pow(patient.height_cm / 100, 2))
    : null

  const bmiClass = bmi
    ? bmi < 18.5 ? 'Abaixo do peso' : bmi < 25 ? 'Peso normal' : bmi < 30 ? 'Sobrepeso' : bmi < 35 ? 'Obesidade grau I' : bmi < 40 ? 'Obesidade grau II' : 'Obesidade grau III'
    : null

  const firstRecord = records && records.length > 0 ? records[records.length - 1] : null
  const latestRecord = records && records.length > 0 ? records[0] : null

  const weightDelta = firstRecord?.weight_kg && latestRecord?.weight_kg && firstRecord.id !== latestRecord.id
    ? r(latestRecord.weight_kg - firstRecord.weight_kg)
    : null

  const fatDelta = firstRecord?.body_fat_pct && latestRecord?.body_fat_pct && firstRecord.id !== latestRecord.id
    ? r(latestRecord.body_fat_pct - firstRecord.body_fat_pct)
    : null

  // Diet plan macros
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meals = (activePlan?.meals ?? []) as any[]
  const planTotals = meals.reduce((acc: { kcal: number; protein: number; carbs: number; fat: number }, m: { meal_foods: { quantity_g: number; food: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion_g: number } }[] }) => {
    m.meal_foods?.forEach(mf => {
      const ratio = mf.quantity_g / (mf.food?.portion_g || 100)
      acc.kcal += (mf.food?.kcal ?? 0) * ratio
      acc.protein += (mf.food?.protein_g ?? 0) * ratio
      acc.carbs += (mf.food?.carbs_g ?? 0) * ratio
      acc.fat += (mf.food?.fat_g ?? 0) * ratio
    })
    return acc
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  // Weight sparkline for PDF
  const sorted = records ? [...records].reverse() : []
  const weights = sorted.map(r => r.weight_kg).filter((w): w is number => w != null)
  let sparklinePath = ''
  let sparklineArea = ''
  const W = 300, H = 60, PAD = 8
  if (weights.length >= 2) {
    const min = Math.min(...weights) - 1
    const max = Math.max(...weights) + 1
    const range = max - min
    const xs = weights.map((_, i) => PAD + (i / (weights.length - 1)) * (W - PAD * 2))
    const ys = weights.map(w => H - PAD - ((w - min) / range) * (H - PAD * 2))
    sparklinePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${Math.round(x)},${Math.round(ys[i])}`).join(' ')
    sparklineArea = `${sparklinePath} L${Math.round(xs[xs.length-1])},${H} L${PAD},${H} Z`
  }
  const trend = weights.length >= 2 ? weights[weights.length-1] - weights[0] : 0
  const sparkColor = trend <= 0 ? '#22c55e' : '#ef4444'

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const activityLabels: Record<string, string> = {
    sedentario: 'Sedentário', levemente_ativo: 'Levemente ativo', moderadamente_ativo: 'Moderadamente ativo',
    muito_ativo: 'Muito ativo', extremamente_ativo: 'Extremamente ativo',
  }

  return (
    <div>
      {/* Screen nav — hidden on print */}
      <div
        className="no-print sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${id}`} className="text-pgf-400 hover:text-pgf-300 text-sm">
            ← {patient.full_name}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">Relatório do Paciente</h1>
        </div>
        <button onClick={() => {}} className="btn btn-primary btn-sm" id="print-btn">
          🖨️ Imprimir / PDF
        </button>
      </div>

      {/* Print trigger script */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('print-btn')?.addEventListener('click', () => window.print())
      `}} />

      {/* REPORT BODY */}
      <div className="max-w-3xl mx-auto p-8 print:p-6 print:max-w-none">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-200">
          <div>
            <div className="text-xs font-bold tracking-[3px] uppercase text-pgf-600 mb-1">Relatório Nutricional</div>
            <h1 className="text-3xl font-black text-gray-900">{patient.full_name}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 flex-wrap">
              {age && <span>👤 {age} anos</span>}
              {patient.gender && <span>{patient.gender === 'F' ? '♀ Feminino' : '♂ Masculino'}</span>}
              {patient.weight_kg && <span>⚖️ {patient.weight_kg} kg</span>}
              {patient.height_cm && <span>📏 {patient.height_cm} cm</span>}
              {bmi && <span className="font-semibold text-gray-700">IMC {bmi} — {bmiClass}</span>}
            </div>
          </div>
          <div className="text-right text-sm text-gray-400">
            <div className="font-black text-2xl text-pgf-600 font-serif italic">PGF</div>
            <div className="text-xs text-gray-400 mt-1">Pedro Garrastazu Frey</div>
            <div className="text-xs text-gray-400">Nutricionista</div>
            <div className="text-xs text-gray-300 mt-2">{today}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left column */}
          <div className="space-y-6">
            {/* Patient info */}
            <section>
              <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Dados do Paciente</h2>
              <div className="card p-4 space-y-2 text-sm">
                {patient.goal && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Objetivo</span>
                    <span className="font-semibold text-gray-900">{patient.goal}</span>
                  </div>
                )}
                {patient.activity_level && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nível de atividade</span>
                    <span className="font-semibold text-gray-900">{activityLabels[patient.activity_level] ?? patient.activity_level}</span>
                  </div>
                )}
                {patient.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Telefone</span>
                    <span className="font-semibold text-gray-900">{patient.phone}</span>
                  </div>
                )}
                {patient.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">E-mail</span>
                    <span className="font-semibold text-gray-900">{patient.email}</span>
                  </div>
                )}
                {bmi && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">IMC</span>
                    <span className={`font-bold ${bmi < 18.5 || bmi >= 30 ? 'text-red-600' : bmi < 25 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {bmi} — {bmiClass}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Fotos registradas</span>
                  <span className="font-semibold text-gray-900">{(photoCount as unknown as { count: number } | null)?.count ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Registros no diário</span>
                  <span className="font-semibold text-gray-900">{(diaryCount as unknown as { count: number } | null)?.count ?? 0}</span>
                </div>
              </div>
            </section>

            {/* Evolution summary */}
            {latestRecord && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Evolução Antropométrica</h2>
                <div className="card p-4 space-y-3 text-sm">
                  {/* Weight sparkline */}
                  {weights.length >= 2 && (
                    <div className="mb-3">
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={sparkColor} stopOpacity="0.15"/>
                            <stop offset="100%" stopColor={sparkColor} stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d={sparklineArea} fill="url(#areaGrad)" />
                        <path d={sparklinePath} fill="none" stroke={sparkColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        {weights.map((w, i) => {
                          const x = PAD + (i / (weights.length - 1)) * (W - PAD * 2)
                          const min2 = Math.min(...weights) - 1
                          const max2 = Math.max(...weights) + 1
                          const y = H - PAD - ((w - min2) / (max2 - min2)) * (H - PAD * 2)
                          return <circle key={i} cx={Math.round(x)} cy={Math.round(y)} r="3" fill={sparkColor} fillOpacity="0.8"/>
                        })}
                        <text x={PAD} y={H - 1} fontSize="9" fill={sparkColor} fontWeight="bold">{weights[0]} kg</text>
                        <text x={W - PAD} y={H - 1} fontSize="9" fill={sparkColor} fontWeight="bold" textAnchor="end">{weights[weights.length-1]} kg</text>
                      </svg>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Peso atual', val: latestRecord.weight_kg ? `${latestRecord.weight_kg} kg` : '—', delta: weightDelta },
                      { label: '% Gordura', val: latestRecord.body_fat_pct ? `${latestRecord.body_fat_pct}%` : '—', delta: fatDelta },
                      { label: 'Massa magra', val: latestRecord.muscle_mass_kg ? `${latestRecord.muscle_mass_kg} kg` : '—', delta: null },
                      { label: 'Cintura', val: latestRecord.waist_cm ? `${latestRecord.waist_cm} cm` : '—', delta: null },
                    ].map(m => (
                      <div key={m.label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">{m.label}</div>
                        <div className="font-black text-gray-900 mt-0.5">{m.val}</div>
                        {m.delta !== null && (
                          <div className={`text-[10px] font-bold mt-0.5 ${m.delta < 0 ? 'text-emerald-600' : m.delta > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {m.delta > 0 ? '+' : ''}{m.delta} kg vs 1ª avaliação
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-gray-400 text-center">
                    {records!.length} avaliação{records!.length !== 1 ? 'ões' : ''} registrada{records!.length !== 1 ? 's' : ''}
                    {firstRecord && firstRecord.id !== latestRecord.id && (
                      <> · {new Date(firstRecord.measured_at + 'T12:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })} → {new Date(latestRecord.measured_at + 'T12:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Anamnese summary */}
            {anamnesis && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Resumo da Anamnese</h2>
                <div className="card p-4 space-y-2 text-sm">
                  {anamnesis.chief_complaint && (
                    <div><span className="text-gray-500 text-xs">Queixa: </span>{anamnesis.chief_complaint}</div>
                  )}
                  {anamnesis.pathologies && (
                    <div><span className="text-gray-500 text-xs">Patologias: </span>{anamnesis.pathologies}</div>
                  )}
                  {anamnesis.medications && (
                    <div><span className="text-gray-500 text-xs">Medicamentos: </span>{anamnesis.medications}</div>
                  )}
                  {anamnesis.allergies && (
                    <div><span className="text-gray-500 text-xs">Alergias: </span>{anamnesis.allergies}</div>
                  )}
                  {anamnesis.exercise_type && (
                    <div><span className="text-gray-500 text-xs">Exercício: </span>{anamnesis.exercise_type}{anamnesis.exercise_freq_week ? ` · ${anamnesis.exercise_freq_week}×/sem` : ''}</div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Active diet plan */}
            {activePlan && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Plano Alimentar Ativo</h2>
                <div className="card p-4">
                  <div className="font-bold text-gray-900 mb-3">{activePlan.title || 'Plano atual'}</div>

                  {/* Macro targets */}
                  {(activePlan.kcal_goal || activePlan.protein_goal_g) && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { label: 'Meta Kcal', val: activePlan.kcal_goal, unit: 'kcal', color: 'text-gray-900' },
                        { label: 'Meta Prot', val: activePlan.protein_goal_g, unit: 'g', color: 'text-blue-600' },
                        { label: 'Meta Carb', val: activePlan.carbs_goal_g, unit: 'g', color: 'text-amber-600' },
                        { label: 'Meta Gord', val: activePlan.fat_goal_g, unit: 'g', color: 'text-red-500' },
                      ].filter(m => m.val).map(m => (
                        <div key={m.label} className="bg-gray-50 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-gray-400 uppercase font-semibold">{m.label}</div>
                          <div className={`font-black ${m.color}`}>{m.val}{m.unit}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Calculated totals vs targets */}
                  {planTotals.kcal > 0 && (
                    <div className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg p-2.5">
                      <div className="font-semibold text-gray-700 mb-1">Total calculado do plano</div>
                      <div className="flex gap-3">
                        <span>{Math.round(planTotals.kcal)} kcal</span>
                        <span className="text-blue-600">P {Math.round(planTotals.protein)}g</span>
                        <span className="text-amber-600">C {Math.round(planTotals.carbs)}g</span>
                        <span className="text-red-500">G {Math.round(planTotals.fat)}g</span>
                      </div>
                    </div>
                  )}

                  {/* Meals list */}
                  <div className="space-y-1.5">
                    {meals.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order).map((m: { id: string; name: string; emoji: string; time_start: string | null; meal_foods: { quantity_g: number; food: { kcal: number; portion_g: number; protein_g: number; carbs_g: number; fat_g: number } }[] }) => {
                      const mKcal = m.meal_foods?.reduce((s, mf) => s + mf.food.kcal * (mf.quantity_g / (mf.food.portion_g || 100)), 0) ?? 0
                      return (
                        <div key={m.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{m.emoji || '🍽️'} {m.name}</span>
                          <div className="text-xs text-gray-400 flex items-center gap-2">
                            {m.time_start && <span>{m.time_start}</span>}
                            <span className="font-semibold text-gray-600">{Math.round(mKcal)} kcal</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Professional diagnosis */}
            {anamnesis?.nutritional_diagnosis && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Diagnóstico Nutricional</h2>
                <div className="card p-4 text-sm text-gray-700">
                  {anamnesis.nutritional_diagnosis}
                </div>
              </section>
            )}

            {/* Recommendations */}
            {anamnesis?.recommendations && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Recomendações</h2>
                <div className="card p-4 text-sm text-gray-700">
                  {anamnesis.recommendations}
                </div>
              </section>
            )}

            {/* Supplements */}
            {supplements && supplements.length > 0 && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Suplementação Prescrita</h2>
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Suplemento</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Dosagem</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Momento</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Orientação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplements.map((s: { id: string; name: string; brand: string | null; dosage: string; timing: string; with_food: boolean; instructions: string | null }) => {
                        const timingLabels: Record<string, string> = {
                          ao_acordar: 'Ao acordar', cafe_manha: 'Café da manhã', pre_treino: 'Pré-treino',
                          pos_treino: 'Pós-treino', almoco: 'Almoço', lanche: 'Lanche',
                          jantar: 'Jantar', antes_dormir: 'Antes de dormir', qualquer_hora: 'Qualquer horário',
                        }
                        return (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="px-4 py-2 font-medium text-gray-800">
                              {s.name}{s.brand && <span className="text-xs text-gray-400 ml-1">({s.brand})</span>}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{s.dosage}</td>
                            <td className="px-4 py-2 text-gray-600">{timingLabels[s.timing] ?? s.timing}</td>
                            <td className="px-4 py-2 text-gray-500 text-xs">
                              {s.with_food && 'Com refeição. '}{s.instructions ?? ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Goals */}
            {goals && goals.length > 0 && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Metas Ativas</h2>
                <div className="grid grid-cols-3 gap-3">
                  {goals.map((g: { id: string; metric: string; target_value: number; current_value: number | null; unit: string | null }) => {
                    const pct = g.current_value != null && g.target_value
                      ? Math.min(100, Math.round(Math.abs(g.current_value - g.target_value) / Math.abs((g.current_value || g.target_value) - g.target_value + 0.001) * 100))
                      : 0
                    const metricLabels: Record<string, string> = {
                      peso: 'Peso', gordura: 'Gordura corporal', massa: 'Massa magra',
                      cintura: 'Cintura', quadril: 'Quadril', imc: 'IMC',
                    }
                    return (
                      <div key={g.id} className="card p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">{metricLabels[g.metric] ?? g.metric}</div>
                        <div className="text-lg font-bold text-gray-800">{g.target_value}{g.unit && <span className="text-xs text-gray-400 ml-1">{g.unit}</span>}</div>
                        {g.current_value != null && (
                          <div className="text-xs text-gray-400 mt-1">Atual: {g.current_value} {g.unit}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Latest lab results */}
            {labResults && labResults.length > 0 && (() => {
              // Get the most recent date
              const latestDate = labResults[0].date
              const latestResults = labResults.filter((r: { date: string }) => r.date === latestDate)
              const statusLabels: Record<string, string> = {
                normal: 'Normal', alto: 'Elevado', baixo: 'Baixo',
                critico_alto: 'Crítico ↑', critico_baixo: 'Crítico ↓',
              }
              const statusColors: Record<string, string> = {
                normal: '#22c55e', alto: '#f59e0b', baixo: '#3b82f6',
                critico_alto: '#ef4444', critico_baixo: '#ef4444',
              }
              const byPanel: Record<string, typeof latestResults> = {}
              for (const r of latestResults) {
                const key = r.panel_name ?? 'Outros'
                if (!byPanel[key]) byPanel[key] = []
                byPanel[key].push(r)
              }
              return (
                <section>
                  <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-1">Exames Laboratoriais</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Última coleta: {new Date(latestDate + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  {Object.entries(byPanel).map(([panel, panelResults]) => (
                    <div key={panel} className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{panel}</div>
                      <div className="card overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Exame</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Resultado</th>
                              <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Status</th>
                              <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Referência</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(panelResults as Array<{ id: string; exam_name: string; value: number | null; unit: string | null; status: string | null; reference_min: number | null; reference_max: number | null }>).map(r => (
                              <tr key={r.id} className="border-t border-gray-100">
                                <td className="px-4 py-2 text-gray-800">{r.exam_name}</td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-800">
                                  {r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : '—'}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {r.status && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                      style={{ background: `${statusColors[r.status]}20`, color: statusColors[r.status] }}>
                                      {statusLabels[r.status]}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-center text-xs text-gray-400">
                                  {r.reference_min != null && r.reference_max != null
                                    ? `${r.reference_min} – ${r.reference_max}`
                                    : r.reference_min != null ? `≥ ${r.reference_min}`
                                    : r.reference_max != null ? `≤ ${r.reference_max}` : ''}
                                  {r.unit && r.reference_min != null || r.reference_max != null ? ` ${r.unit ?? ''}` : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </section>
              )
            })()}

            {/* Clinical notes */}
            {(anamnesis?.clinical_notes || patient.notes) && (
              <section>
                <h2 className="text-xs font-bold tracking-[2px] uppercase text-pgf-600 mb-3">Observações Clínicas</h2>
                <div className="card p-4 text-sm text-gray-700">
                  {anamnesis?.clinical_notes || patient.notes}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
          <div>Relatório gerado em {today}</div>
          <div className="font-semibold text-gray-600">Pedro Garrastazu Frey · Nutricionista</div>
          <div>pedro-garrastazu-emagrecimento.vercel.app</div>
        </div>
      </div>
    </div>
  )
}
