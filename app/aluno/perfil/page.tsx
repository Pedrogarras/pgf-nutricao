import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function r(n: number, d = 1) { return Math.round(n * 10 ** d) / 10 ** d }

function bmiInfo(bmi: number): { label: string; color: string; bg: string; text: string } {
  if (bmi < 18.5) return {
    label: 'Abaixo do peso', color: '#93C5FD', bg: 'rgba(147,197,253,0.1)',
    text: 'Seu IMC indica peso abaixo do ideal. Seu nutricionista pode ajustar seu plano para ganho de peso saudável.',
  }
  if (bmi < 25) return {
    label: 'Peso normal', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',
    text: 'Parabéns! Seu IMC está na faixa saudável. Mantenha seus hábitos e siga o plano alimentar.',
  }
  if (bmi < 30) return {
    label: 'Sobrepeso', color: '#FCD34D', bg: 'rgba(252,211,77,0.1)',
    text: 'Seu IMC indica sobrepeso. Seguir o plano alimentar com consistência é o caminho para atingir o peso ideal.',
  }
  if (bmi < 35) return {
    label: 'Obesidade grau I', color: '#FB923C', bg: 'rgba(251,146,60,0.1)',
    text: 'Obesidade grau I. Com o acompanhamento nutricional correto você pode atingir um peso mais saudável.',
  }
  if (bmi < 40) return {
    label: 'Obesidade grau II', color: '#F87171', bg: 'rgba(248,113,113,0.1)',
    text: 'Obesidade grau II. A evolução progressiva com seu plano alimentar trará melhoras gradativas e seguras.',
  }
  return {
    label: 'Obesidade grau III', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',
    text: 'Obesidade grau III. O acompanhamento nutricional e médico é fundamental. Cada passo conta!',
  }
}

function fatInfo(pct: number, gender: string | null): { label: string; color: string } {
  const isMale = gender === 'M'
  if (isMale) {
    if (pct < 6)  return { label: 'Essencial', color: '#93C5FD' }
    if (pct < 14) return { label: 'Atlético',  color: '#4ADE80' }
    if (pct < 18) return { label: 'Fitness',   color: '#34D399' }
    if (pct < 25) return { label: 'Médio',     color: '#FCD34D' }
    return              { label: 'Alto',       color: '#F87171' }
  } else {
    if (pct < 14) return { label: 'Essencial', color: '#93C5FD' }
    if (pct < 21) return { label: 'Atlético',  color: '#4ADE80' }
    if (pct < 25) return { label: 'Fitness',   color: '#34D399' }
    if (pct < 32) return { label: 'Médio',     color: '#FCD34D' }
    return              { label: 'Alto',       color: '#F87171' }
  }
}

function activityLabel(v: string | null) {
  const m: Record<string, string> = {
    sedentario: '🪑 Sedentário',
    levemente_ativo: '🚶 Levemente ativo',
    moderadamente_ativo: '🚴 Moderadamente ativo',
    muito_ativo: '🏃 Muito ativo',
    extremamente_ativo: '⚡ Extremamente ativo',
  }
  return v ? (m[v] ?? v) : '—'
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function calcAge(dob: string) {
  return Math.floor((Date.now() - new Date(dob + 'T12:00').getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

export default async function AlunoPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, weight_kg, height_cm, date_of_birth, gender, goal, activity_level, phone, email, created_at')
    .eq('auth_user_id', user.id)
    .single()

  if (!patient) redirect('/aluno')

  // Latest 5 anthropometric records
  const { data: records } = await supabase
    .from('anthropometric_records')
    .select('measured_at, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, adherence_pct')
    .eq('patient_id', patient.id)
    .order('measured_at', { ascending: false })
    .limit(5)

  // Active anamnesis for health info
  const { data: anamnesis } = await supabase
    .from('patient_anamnesis')
    .select('allergies, dislikes, supplements, health_conditions, medications')
    .eq('patient_id', patient.id)
    .maybeSingle()

  const latestRecord = records?.[0] ?? null
  const currentWeight = latestRecord?.weight_kg ?? patient.weight_kg
  const heightM = patient.height_cm ? patient.height_cm / 100 : null
  const bmi = currentWeight && heightM ? r(currentWeight / (heightM ** 2)) : null
  const bmiData = bmi ? bmiInfo(bmi) : null

  // Ideal weight range (BMI 18.5–24.9)
  const idealMin = heightM ? r(18.5 * heightM ** 2) : null
  const idealMax = heightM ? r(24.9 * heightM ** 2) : null
  const weightToLose = bmi && bmi > 25 && idealMax && currentWeight
    ? r(currentWeight - idealMax)
    : null

  const age = patient.date_of_birth ? calcAge(patient.date_of_birth) : null

  // BMI gauge position (0–100% across range 15–45)
  const bmiGaugePct = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / (45 - 15)) * 100)) : null

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">👤 Minha Ficha</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Dados de saúde e composição corporal</p>
        </div>
      </div>

      <div className="px-5 py-5 max-w-lg mx-auto space-y-5">

        {/* Profile header card */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)' }}>
          <div className="absolute top-0 left-8 right-8 h-px rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}>
              {patient.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-black text-white leading-tight">{patient.full_name}</div>
              <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {age ? `${age} anos` : ''}{age && patient.gender ? ' · ' : ''}{patient.gender === 'M' ? 'Masculino' : patient.gender === 'F' ? 'Feminino' : ''}
              </div>
              {patient.goal && (
                <div className="text-xs mt-1 font-semibold" style={{ color: '#93C5FD' }}>
                  🎯 {patient.goal}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Biometric stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Peso atual', value: currentWeight ? `${currentWeight} kg` : '—', icon: '⚖️', color: '#93C5FD' },
            { label: 'Altura', value: patient.height_cm ? `${patient.height_cm} cm` : '—', icon: '📏', color: '#60A5FA' },
            { label: 'IMC', value: bmi ? `${bmi}` : '—', icon: '📊', color: bmiData?.color ?? '#9CA3AF',
              sub: bmiData?.label ?? '' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-lg mb-0.5">{s.icon}</div>
              <div className="text-base font-black" style={{ color: s.color }}>{s.value}</div>
              {('sub' in s && s.sub) && (
                <div className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.sub}</div>
              )}
              <div className="text-[9px] mt-0.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.25)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* BMI gauge + classification */}
        {bmi && bmiData && (
          <div className="rounded-2xl p-5" style={{ background: bmiData.bg, border: `1px solid ${bmiData.color}30` }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[2px] mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Índice de Massa Corporal
                </div>
                <div className="text-2xl font-black" style={{ color: bmiData.color }}>{bmi}</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: bmiData.color }}>{bmiData.label}</div>
              </div>
              {idealMin && idealMax && (
                <div className="text-right">
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Peso ideal</div>
                  <div className="text-sm font-bold text-white">{idealMin}–{idealMax} kg</div>
                  {weightToLose && weightToLose > 0 && (
                    <div className="text-[10px] mt-0.5" style={{ color: '#FCD34D' }}>
                      faltam {weightToLose} kg
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BMI gauge bar */}
            {bmiGaugePct !== null && (
              <div className="mb-3">
                <div className="h-3 rounded-full overflow-hidden relative"
                  style={{ background: 'linear-gradient(90deg, #93C5FD 0%, #4ADE80 20%, #FCD34D 40%, #FB923C 60%, #F87171 80%, #EF4444 100%)' }}>
                  <div className="absolute top-0 bottom-0 w-1 rounded-full bg-white shadow-lg"
                    style={{ left: `calc(${bmiGaugePct}% - 2px)` }} />
                </div>
                <div className="flex justify-between text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <span>15</span><span>18.5</span><span>25</span><span>30</span><span>35</span><span>40+</span>
                </div>
              </div>
            )}

            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{bmiData.text}</p>
          </div>
        )}

        {/* Body composition (latest record) */}
        {latestRecord && (latestRecord.body_fat_pct || latestRecord.muscle_mass_kg || latestRecord.waist_cm) && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-[10px] font-bold uppercase tracking-[2px] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Composição Corporal · {fmtDate(latestRecord.measured_at)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {latestRecord.body_fat_pct != null && (() => {
                const fi = fatInfo(latestRecord.body_fat_pct, patient.gender)
                return (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-xl font-black" style={{ color: fi.color }}>{latestRecord.body_fat_pct}%</div>
                    <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: fi.color }}>{fi.label}</div>
                    <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Gordura corporal</div>
                  </div>
                )
              })()}
              {latestRecord.muscle_mass_kg != null && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xl font-black" style={{ color: '#34D399' }}>{latestRecord.muscle_mass_kg} kg</div>
                  <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Massa magra</div>
                </div>
              )}
              {latestRecord.waist_cm != null && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xl font-black" style={{ color: '#FBBF24' }}>{latestRecord.waist_cm} cm</div>
                  <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Cintura</div>
                </div>
              )}
              {latestRecord.adherence_pct != null && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xl font-black" style={{ color: latestRecord.adherence_pct >= 70 ? '#4ADE80' : '#FCD34D' }}>
                    {latestRecord.adherence_pct}%
                  </div>
                  <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Aderência</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Measurement history mini-table */}
        {records && records.length > 1 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Histórico de Medidas
              </div>
              <Link href="/aluno/evolucao" className="text-[11px]" style={{ color: '#93C5FD' }}>
                Gráficos →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['Data', 'Peso', 'Gordura', 'Massa magra', 'Aderência'].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-semibold"
                        style={{ color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={rec.measured_at}
                      style={{
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderBottom: i < records.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                        {fmtDate(rec.measured_at)}
                      </td>
                      <td className="px-4 py-2.5 font-bold" style={{ color: '#93C5FD' }}>
                        {rec.weight_kg != null ? `${rec.weight_kg} kg` : '—'}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: '#F87171' }}>
                        {rec.body_fat_pct != null ? `${rec.body_fat_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: '#34D399' }}>
                        {rec.muscle_mass_kg != null ? `${rec.muscle_mass_kg} kg` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {rec.adherence_pct != null ? (
                          <span className="font-bold" style={{ color: rec.adherence_pct >= 70 ? '#4ADE80' : '#FCD34D' }}>
                            {rec.adherence_pct}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Health info (activity + anamnesis) */}
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[2px] mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Informações de Saúde
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Nível de atividade</span>
              <span className="text-xs font-semibold text-white">{activityLabel(patient.activity_level)}</span>
            </div>
            {anamnesis?.health_conditions && (
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>🩺 Condições de saúde</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{anamnesis.health_conditions}</div>
              </div>
            )}
            {anamnesis?.medications && (
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>💊 Medicamentos</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{anamnesis.medications}</div>
              </div>
            )}
            {anamnesis?.allergies && (
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(248,113,113,0.7)' }}>⚠️ Alergias</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{anamnesis.allergies}</div>
              </div>
            )}
            {anamnesis?.dislikes && (
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(252,211,77,0.7)' }}>🚫 Alimentos a evitar</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{anamnesis.dislikes}</div>
              </div>
            )}
            {anamnesis?.supplements && (
              <div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(147,197,253,0.7)' }}>💊 Suplementação</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{anamnesis.supplements}</div>
              </div>
            )}
            {!anamnesis && (
              <div className="text-xs italic" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Anamnese não preenchida ainda.
              </div>
            )}
          </div>
        </div>

        {/* Since when patient */}
        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Paciente desde</span>
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {new Date(patient.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 pt-2" style={{ opacity: 0.18 }}>
          <div className="w-10 h-px bg-white" />
          <div className="w-1.5 h-1.5 rotate-45 border border-white" />
          <div className="w-10 h-px bg-white" />
        </div>
        <p className="text-center text-[11px] pb-2" style={{ color: 'rgba(197,205,240,0.22)' }}>
          Pedro Garrastazu Frey · Nutricionista
        </p>
      </div>
    </div>
  )
}
