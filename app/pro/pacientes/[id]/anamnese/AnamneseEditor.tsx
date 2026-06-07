'use client'
import { useState } from 'react'
import Link from 'next/link'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Anamnesis = Record<string, any> | null

interface Patient {
  id: string
  full_name: string
  weight_kg: number | null
  height_cm: number | null
  date_of_birth: string | null
  gender: string | null
  goal: string | null
  activity_level: string | null
  phone: string | null
  email: string | null
}

interface Props {
  patient: Patient
  anamnesis: Anamnesis
  patientId: string
}

const SECTIONS = [
  { id: 'queixa',     label: 'Queixa e Objetivo',    icon: '🎯' },
  { id: 'alimentar',  label: 'Histórico Alimentar',   icon: '🥗' },
  { id: 'clinico',    label: 'Histórico Clínico',     icon: '🏥' },
  { id: 'lifestyle',  label: 'Estilo de Vida',        icon: '🌿' },
  { id: 'peso',       label: 'Histórico de Peso',     icon: '⚖️' },
  { id: 'avaliacao',  label: 'Avaliação Profissional', icon: '📋' },
]

export default function AnamneseEditor({ patient, anamnesis, patientId }: Props) {
  const a = anamnesis ?? {}
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState('queixa')
  const [toast, setToast] = useState('')

  // All form state
  const [form, setForm] = useState({
    chief_complaint: a.chief_complaint ?? '',
    objective: a.objective ?? '',
    allergies: a.allergies ?? '',
    intolerances: a.intolerances ?? '',
    dislikes: a.dislikes ?? '',
    preferences: a.preferences ?? '',
    meals_per_day: a.meals_per_day ?? '5',
    meal_times: a.meal_times ?? '',
    water_intake_l: a.water_intake_l ?? '',
    alcohol_freq: a.alcohol_freq ?? 'nunca',
    smoking: a.smoking ?? 'nunca',
    pathologies: a.pathologies ?? '',
    family_history: a.family_history ?? '',
    surgeries: a.surgeries ?? '',
    medications: a.medications ?? '',
    supplements: a.supplements ?? '',
    sleep_hours: a.sleep_hours ?? '',
    sleep_quality: a.sleep_quality ?? 'regular',
    stress_level: a.stress_level ?? '',
    work_schedule: a.work_schedule ?? 'diurno',
    exercise_type: a.exercise_type ?? '',
    exercise_freq_week: a.exercise_freq_week ?? '',
    exercise_duration_min: a.exercise_duration_min ?? '',
    sedentary_hours: a.sedentary_hours ?? '',
    weight_history: a.weight_history ?? '',
    previous_diets: a.previous_diets ?? '',
    diet_adherence: a.diet_adherence ?? '',
    goal_detail: a.goal_detail ?? '',
    goal_timeframe: a.goal_timeframe ?? '',
    barriers: a.barriers ?? '',
    clinical_notes: a.clinical_notes ?? '',
    nutritional_diagnosis: a.nutritional_diagnosis ?? '',
    recommendations: a.recommendations ?? '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      ...form,
      water_intake_l: form.water_intake_l ? Number(form.water_intake_l) : null,
      stress_level: form.stress_level ? Number(form.stress_level) : null,
      sleep_hours: form.sleep_hours ? Number(form.sleep_hours) : null,
      exercise_freq_week: form.exercise_freq_week ? Number(form.exercise_freq_week) : null,
      exercise_duration_min: form.exercise_duration_min ? Number(form.exercise_duration_min) : null,
      sedentary_hours: form.sedentary_hours ? Number(form.sedentary_hours) : null,
    }

    const res = await fetch(`/api/anamnesis/${patientId}`, {
      method: anamnesis ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    if (res.ok) {
      setSaved(true)
      showToast('Anamnese salva com sucesso! ✓')
    } else {
      showToast('Erro ao salvar. Tente novamente.')
    }
  }

  // Completion indicator per section
  function sectionScore(id: string): number {
    const fields: Record<string, string[]> = {
      queixa:    ['chief_complaint', 'objective'],
      alimentar: ['allergies', 'dislikes', 'preferences', 'meals_per_day', 'water_intake_l'],
      clinico:   ['pathologies', 'medications', 'supplements'],
      lifestyle: ['sleep_hours', 'sleep_quality', 'stress_level', 'exercise_type', 'exercise_freq_week'],
      peso:      ['weight_history', 'previous_diets'],
      avaliacao: ['clinical_notes', 'nutritional_diagnosis'],
    }
    const f = fields[id] ?? []
    const filled = f.filter(k => form[k as keyof typeof form] && String(form[k as keyof typeof form]).trim()).length
    return Math.round((filled / f.length) * 100)
  }

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth + 'T12:00').getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patientId}`} className="text-pgf-400 hover:text-pgf-300 text-sm">
            ← {patient.full_name}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">Anamnese Clínica</h1>
          {saved && <span className="badge badge-green text-[10px]">Salvo</span>}
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? 'Salvando...' : 'Salvar anamnese'}
        </button>
      </div>

      <div className="p-8 flex gap-6">
        {/* Left nav */}
        <div className="w-52 flex-shrink-0">
          {/* Patient summary card */}
          <div className="card p-4 mb-4">
            <div className="font-bold text-gray-900 text-sm">{patient.full_name}</div>
            <div className="text-xs text-gray-400 mt-1 space-y-0.5">
              {age && <div>👤 {age} anos · {patient.gender === 'F' ? 'Feminina' : patient.gender === 'M' ? 'Masculino' : '—'}</div>}
              {patient.weight_kg && <div>⚖️ {patient.weight_kg} kg{patient.height_cm ? ` · ${patient.height_cm} cm` : ''}</div>}
              {patient.goal && <div>🎯 {patient.goal}</div>}
              {patient.phone && <div>📞 {patient.phone}</div>}
            </div>
          </div>

          {/* Section nav */}
          <div className="space-y-1">
            {SECTIONS.map(sec => {
              const score = sectionScore(sec.id)
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm ${activeSection === sec.id ? 'bg-pgf-50 text-pgf-700 font-semibold border border-pgf-200' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{sec.icon} {sec.label}</span>
                    {score > 0 && (
                      <span className={`text-[10px] font-bold ${score === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {score}%
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Overall completion */}
          <div className="mt-4 card p-3">
            <div className="text-xs text-gray-400 mb-2">Preenchimento geral</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pgf-500 rounded-full transition-all"
                  style={{ width: `${Math.round(SECTIONS.reduce((sum, s) => sum + sectionScore(s.id), 0) / SECTIONS.length)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-gray-700">
                {Math.round(SECTIONS.reduce((sum, s) => sum + sectionScore(s.id), 0) / SECTIONS.length)}%
              </span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {activeSection === 'queixa' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">🎯 Queixa Principal e Objetivos</span>
                </div>
                <div className="card-body space-y-4">
                  <div>
                    <label className="form-label">Queixa principal do paciente</label>
                    <textarea value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)} className="form-textarea" rows={3} placeholder="Motivo da consulta, queixas relatadas pelo paciente..." />
                  </div>
                  <div>
                    <label className="form-label">Objetivo declarado</label>
                    <textarea value={form.objective} onChange={e => set('objective', e.target.value)} className="form-textarea" rows={2} placeholder="O que o paciente quer alcançar com o acompanhamento..." />
                  </div>
                  <div>
                    <label className="form-label">Detalhamento do objetivo</label>
                    <textarea value={form.goal_detail} onChange={e => set('goal_detail', e.target.value)} className="form-textarea" rows={2} placeholder="Mais detalhes sobre o objetivo..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Prazo desejado</label>
                      <input value={form.goal_timeframe} onChange={e => set('goal_timeframe', e.target.value)} className="form-input" placeholder="Ex: 3 meses, 6 meses..." />
                    </div>
                    <div>
                      <label className="form-label">Barreiras percebidas</label>
                      <input value={form.barriers} onChange={e => set('barriers', e.target.value)} className="form-input" placeholder="Falta de tempo, ansiedade..." />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'alimentar' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header"><span className="card-title">🥗 Histórico Alimentar</span></div>
                <div className="card-body space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Alergias</label>
                      <input value={form.allergies} onChange={e => set('allergies', e.target.value)} className="form-input" placeholder="Amendoim, frutos do mar..." />
                    </div>
                    <div>
                      <label className="form-label">Intolerâncias</label>
                      <input value={form.intolerances} onChange={e => set('intolerances', e.target.value)} className="form-input" placeholder="Lactose, glúten, frutose..." />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Alimentos que não gosta</label>
                    <input value={form.dislikes} onChange={e => set('dislikes', e.target.value)} className="form-input" placeholder="Fígado, peixe, beterraba..." />
                  </div>
                  <div>
                    <label className="form-label">Alimentos preferidos / que come com frequência</label>
                    <input value={form.preferences} onChange={e => set('preferences', e.target.value)} className="form-input" placeholder="Frango, arroz, ovos, frutas..." />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Refeições por dia</label>
                      <select value={form.meals_per_day} onChange={e => set('meals_per_day', e.target.value)} className="form-select">
                        {['2','3','4','5','6','7'].map(n => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Ingestão de água (L/dia)</label>
                      <input type="number" step="0.5" value={form.water_intake_l} onChange={e => set('water_intake_l', e.target.value)} className="form-input" placeholder="2.0" />
                    </div>
                    <div>
                      <label className="form-label">Álcool</label>
                      <select value={form.alcohol_freq} onChange={e => set('alcohol_freq', e.target.value)} className="form-select">
                        <option value="nunca">Nunca</option>
                        <option value="ocasional">Ocasional</option>
                        <option value="semanal">Semanal</option>
                        <option value="diario">Diário</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Horários habituais das refeições</label>
                    <input value={form.meal_times} onChange={e => set('meal_times', e.target.value)} className="form-input" placeholder="Café 7h, almoço 12h, lanche 15h, jantar 19h..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'clinico' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header"><span className="card-title">🏥 Histórico Clínico</span></div>
                <div className="card-body space-y-4">
                  <div>
                    <label className="form-label">Patologias / doenças crônicas</label>
                    <textarea value={form.pathologies} onChange={e => set('pathologies', e.target.value)} className="form-textarea" rows={2} placeholder="Diabetes tipo 2, hipertensão, hipotireoidismo, PCOS..." />
                  </div>
                  <div>
                    <label className="form-label">Histórico familiar relevante</label>
                    <textarea value={form.family_history} onChange={e => set('family_history', e.target.value)} className="form-textarea" rows={2} placeholder="Pai com DM2, mãe hipertensa, histórico de obesidade familiar..." />
                  </div>
                  <div>
                    <label className="form-label">Cirurgias anteriores</label>
                    <input value={form.surgeries} onChange={e => set('surgeries', e.target.value)} className="form-input" placeholder="Bariátrica (2019), colecistectomia..." />
                  </div>
                  <div>
                    <label className="form-label">Medicamentos em uso</label>
                    <textarea value={form.medications} onChange={e => set('medications', e.target.value)} className="form-textarea" rows={2} placeholder="Metformina 850mg, levotiroxina 75mcg, anticoncepcional..." />
                  </div>
                  <div>
                    <label className="form-label">Suplementação atual</label>
                    <textarea value={form.supplements} onChange={e => set('supplements', e.target.value)} className="form-textarea" rows={2} placeholder="Whey protein, creatina, vitamina D, ômega 3..." />
                  </div>
                  <div>
                    <label className="form-label">Tabagismo</label>
                    <select value={form.smoking} onChange={e => set('smoking', e.target.value)} className="form-select">
                      <option value="nunca">Nunca fumou</option>
                      <option value="ex">Ex-fumante</option>
                      <option value="fumante">Fumante atual</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'lifestyle' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header"><span className="card-title">🌿 Estilo de Vida</span></div>
                <div className="card-body space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Horas de sono/noite</label>
                      <input type="number" step="0.5" value={form.sleep_hours} onChange={e => set('sleep_hours', e.target.value)} className="form-input" placeholder="7.5" />
                    </div>
                    <div>
                      <label className="form-label">Qualidade do sono</label>
                      <select value={form.sleep_quality} onChange={e => set('sleep_quality', e.target.value)} className="form-select">
                        <option value="ruim">Ruim</option>
                        <option value="regular">Regular</option>
                        <option value="bom">Bom</option>
                        <option value="excelente">Excelente</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Nível de estresse (1–10)</label>
                      <input type="number" min="1" max="10" value={form.stress_level} onChange={e => set('stress_level', e.target.value)} className="form-input" placeholder="7" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Horário de trabalho</label>
                      <select value={form.work_schedule} onChange={e => set('work_schedule', e.target.value)} className="form-select">
                        <option value="diurno">Diurno</option>
                        <option value="noturno">Noturno</option>
                        <option value="variado">Variado/Turnos</option>
                        <option value="homeoffice">Home office</option>
                        <option value="nao_trabalha">Não trabalha</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Horas sentado por dia</label>
                      <input type="number" step="0.5" value={form.sedentary_hours} onChange={e => set('sedentary_hours', e.target.value)} className="form-input" placeholder="8" />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Tipo de exercício praticado</label>
                    <input value={form.exercise_type} onChange={e => set('exercise_type', e.target.value)} className="form-input" placeholder="Musculação, corrida, natação, yoga..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Frequência (dias/semana)</label>
                      <input type="number" min="0" max="7" value={form.exercise_freq_week} onChange={e => set('exercise_freq_week', e.target.value)} className="form-input" placeholder="3" />
                    </div>
                    <div>
                      <label className="form-label">Duração por sessão (min)</label>
                      <input type="number" value={form.exercise_duration_min} onChange={e => set('exercise_duration_min', e.target.value)} className="form-input" placeholder="60" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'peso' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header"><span className="card-title">⚖️ Histórico de Peso e Dietas</span></div>
                <div className="card-body space-y-4">
                  <div>
                    <label className="form-label">Histórico de peso</label>
                    <textarea value={form.weight_history} onChange={e => set('weight_history', e.target.value)} className="form-textarea" rows={3} placeholder="Peso máximo atingido, menor peso adulto, flutuações ao longo dos anos..." />
                  </div>
                  <div>
                    <label className="form-label">Dietas anteriores tentadas</label>
                    <textarea value={form.previous_diets} onChange={e => set('previous_diets', e.target.value)} className="form-textarea" rows={3} placeholder="Low carb por 3 meses (2021), dieta do IG em 2020, emagrecimento pós-parto..." />
                  </div>
                  <div>
                    <label className="form-label">Avaliação de adesão histórica</label>
                    <textarea value={form.diet_adherence} onChange={e => set('diet_adherence', e.target.value)} className="form-textarea" rows={2} placeholder="Consegue manter quando tem rotina, dificuldade nos fins de semana..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'avaliacao' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📋 Avaliação do Profissional</span>
                  <span className="badge badge-blue text-[10px]">Visível apenas para você</span>
                </div>
                <div className="card-body space-y-4">
                  <div>
                    <label className="form-label">Diagnóstico nutricional</label>
                    <textarea value={form.nutritional_diagnosis} onChange={e => set('nutritional_diagnosis', e.target.value)} className="form-textarea" rows={3} placeholder="Sobrepeso grau I com IMC 27.3 associado a resistência insulínica, hábitos alimentares irregulares..." />
                  </div>
                  <div>
                    <label className="form-label">Recomendações gerais</label>
                    <textarea value={form.recommendations} onChange={e => set('recommendations', e.target.value)} className="form-textarea" rows={3} placeholder="Redução gradual de 500kcal/dia, distribuição proteica de 2g/kg, jejum máximo de 4h entre refeições..." />
                  </div>
                  <div>
                    <label className="form-label">Notas clínicas</label>
                    <textarea value={form.clinical_notes} onChange={e => set('clinical_notes', e.target.value)} className="form-textarea" rows={4} placeholder="Observações relevantes para o acompanhamento, conduta clínica, pontos de atenção..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save button at bottom */}
          <div className="flex justify-end mt-6">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary px-8">
              {saving ? 'Salvando...' : '✓ Salvar anamnese'}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
