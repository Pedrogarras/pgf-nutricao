'use client'
import { useState } from 'react'

type Gender = 'M' | 'F'
type Formula = 'mifflin' | 'harris' | 'who' | 'cunningham'
type ActivityLevel = 'sedentario' | 'levemente_ativo' | 'moderadamente_ativo' | 'muito_ativo' | 'extremamente_ativo'
type Goal = 'emagrecer_moderado' | 'emagrecer_agressivo' | 'manutenção' | 'ganho_moderado' | 'ganho_rápido'

const ACTIVITY_FACTORS: Record<ActivityLevel, { label: string; factor: number; desc: string }> = {
  sedentario:            { label: 'Sedentário',             factor: 1.2,  desc: 'Sem exercício' },
  levemente_ativo:       { label: 'Levemente ativo',        factor: 1.375, desc: '1-3x por semana' },
  moderadamente_ativo:   { label: 'Moderadamente ativo',    factor: 1.55, desc: '3-5x por semana' },
  muito_ativo:           { label: 'Muito ativo',            factor: 1.725, desc: '6-7x por semana' },
  extremamente_ativo:    { label: 'Extremamente ativo',     factor: 1.9,  desc: '2x por dia / atleta' },
}

const GOAL_ADJUSTMENTS: Record<Goal, { label: string; kcalAdj: number; color: string }> = {
  emagrecer_agressivo: { label: 'Emagrecer agressivo (-500)',  kcalAdj: -500, color: '#F87171' },
  emagrecer_moderado:  { label: 'Emagrecer moderado (-300)',   kcalAdj: -300, color: '#FCD34D' },
  manutenção:          { label: 'Manutenção de peso',          kcalAdj: 0,    color: '#60A5FA' },
  ganho_moderado:      { label: 'Ganho moderado (+300)',       kcalAdj: 300,  color: '#4ADE80' },
  ganho_rápido:        { label: 'Ganho rápido (+500)',         kcalAdj: 500,  color: '#34D399' },
}

function r(n: number, dec = 1) { return Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec) }
function ri(n: number) { return Math.round(n) }

function calcTMB(weight: number, height: number, age: number, gender: Gender, formula: Formula, fatPct?: number): number {
  switch (formula) {
    case 'mifflin':
      return gender === 'M'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161
    case 'harris':
      return gender === 'M'
        ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
        : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age
    case 'who':
      // WHO/FAO 1985 simplified
      if (gender === 'M') {
        if (age < 18) return 17.5 * weight + 651
        if (age < 30) return 15.3 * weight + 679
        if (age < 60) return 11.6 * weight + 879
        return 13.5 * weight + 487
      } else {
        if (age < 18) return 12.2 * weight + 746
        if (age < 30) return 14.7 * weight + 496
        if (age < 60) return 8.7 * weight + 829
        return 10.5 * weight + 596
      }
    case 'cunningham':
      // Requires fat% — uses lean mass
      if (fatPct != null) {
        const leanMass = weight * (1 - fatPct / 100)
        return 500 + 22 * leanMass
      }
      // Fallback to Mifflin
      return gender === 'M'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161
  }
}

export default function CalculadoraPage() {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<Gender>('F')
  const [fatPct, setFatPct] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('levemente_ativo')
  const [goal, setGoal] = useState<Goal>('emagrecer_moderado')
  const [formula, setFormula] = useState<Formula>('mifflin')

  // Macro targets
  const [proteinRatio, setProteinRatio] = useState('1.8') // g/kg
  const [carbPct, setCarbPct] = useState('45')
  const [fatPctDiet, setFatPctDiet] = useState('25')

  const w = parseFloat(weight)
  const h = parseFloat(height)
  const a = parseInt(age)
  const fp = fatPct ? parseFloat(fatPct) : undefined
  const valid = !isNaN(w) && !isNaN(h) && !isNaN(a) && w > 0 && h > 0 && a > 0

  const tmb = valid ? ri(calcTMB(w, h, a, gender, formula, fp)) : null
  const bmi = valid ? r(w / ((h / 100) ** 2)) : null
  const bmiClass = bmi
    ? bmi < 18.5 ? { label: 'Abaixo do peso', color: '#93C5FD' }
    : bmi < 25 ? { label: 'Eutrófico', color: '#4ADE80' }
    : bmi < 30 ? { label: 'Sobrepeso', color: '#FCD34D' }
    : bmi < 35 ? { label: 'Obesidade grau I', color: '#F87171' }
    : bmi < 40 ? { label: 'Obesidade grau II', color: '#F87171' }
    : { label: 'Obesidade grau III', color: '#F87171' }
    : null

  const vet = tmb ? ri(tmb * ACTIVITY_FACTORS[activity].factor) : null
  const targetKcal = vet ? ri(vet + GOAL_ADJUSTMENTS[goal].kcalAdj) : null

  // Macros from target
  const proteinG = valid && targetKcal ? ri(w * parseFloat(proteinRatio || '1.8')) : null
  const proteinKcal = proteinG ? proteinG * 4 : null
  const fatG = valid && targetKcal ? ri((targetKcal * parseFloat(fatPctDiet || '25') / 100) / 9) : null
  const fatKcal = fatG ? fatG * 9 : null
  const carbKcal = targetKcal && proteinKcal && fatKcal ? targetKcal - proteinKcal - fatKcal : null
  const carbG = carbKcal ? ri(carbKcal / 4) : null
  const actualCarbPct = targetKcal && carbKcal ? r((carbKcal / targetKcal) * 100) : null
  const actualProtPct = targetKcal && proteinKcal ? r((proteinKcal / targetKcal) * 100) : null
  const actualFatPct = targetKcal && fatKcal ? r((fatKcal / targetKcal) * 100) : null

  // Lean mass
  const leanMass = fp != null && valid ? r(w * (1 - fp / 100)) : null
  const fatMass = fp != null && valid ? r(w * fp / 100) : null

  // Ideal weight range (BMI 18.5–24.9)
  const idealMin = valid ? r(18.5 * ((h / 100) ** 2)) : null
  const idealMax = valid ? r(24.9 * ((h / 100) ** 2)) : null
  const weightToLose = bmi && bmi > 25 && idealMax ? r(w - idealMax) : null

  // Hydration needs (35ml/kg)
  const waterNeeds = valid ? r(w * 0.035) : null

  // Fiber needs
  const fiberMin = 25, fiberMax = 38

  return (
    <div>
      <div className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <h1 className="text-base font-bold text-white">Calculadora Nutricional</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>TMB · VET · Macros · IMC</p>
        </div>
      </div>

      <div className="p-8 max-w-5xl">
        <div className="grid grid-cols-5 gap-6">
          {/* Input panel */}
          <div className="col-span-2 space-y-5">
            <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Dados do Paciente</div>

              {/* Gender toggle */}
              <div className="mb-4">
                <label className="block text-xs text-white mb-1.5">Sexo biológico</label>
                <div className="flex gap-2">
                  {(['F', 'M'] as Gender[]).map(g => (
                    <button key={g} onClick={() => setGender(g)}
                      className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: gender === g ? (g === 'F' ? 'rgba(236,72,153,0.2)' : 'rgba(37,99,235,0.2)') : 'var(--dark-bg)',
                        border: `1px solid ${gender === g ? (g === 'F' ? 'rgba(236,72,153,0.4)' : 'rgba(37,99,235,0.4)') : 'var(--dark-border2)'}`,
                        color: gender === g ? (g === 'F' ? '#F9A8D4' : '#93C5FD') : 'rgba(255,255,255,0.4)',
                      }}>
                      {g === 'F' ? '♀ Feminino' : '♂ Masculino'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data fields */}
              {[
                { label: 'Peso (kg)', value: weight, set: setWeight, placeholder: '70', unit: 'kg' },
                { label: 'Altura (cm)', value: height, set: setHeight, placeholder: '165', unit: 'cm' },
                { label: 'Idade (anos)', value: age, set: setAge, placeholder: '30', unit: 'anos' },
                { label: '% Gordura corporal (opcional)', value: fatPct, set: setFatPct, placeholder: '25', unit: '%' },
              ].map(f => (
                <div key={f.label} className="mb-3">
                  <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.label}</label>
                  <div className="relative">
                    <input type="number" step="any" value={f.value} onChange={e => f.set(e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm pr-12"
                      style={{ background: 'var(--dark-bg)', border: '1px solid var(--dark-border2)' }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Configurações</div>

              <div className="mb-4">
                <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Fórmula de TMB</label>
                <div className="space-y-1.5">
                  {([
                    { id: 'mifflin', label: 'Mifflin-St Jeor', desc: 'Mais precisa (recomendada)' },
                    { id: 'harris', label: 'Harris-Benedict revisada', desc: 'Clássica, amplamente usada' },
                    { id: 'cunningham', label: 'Cunningham', desc: 'Requer % gordura (atletas)' },
                    { id: 'who', label: 'FAO/WHO/ONU', desc: 'Por faixa etária' },
                  ] as { id: Formula; label: string; desc: string }[]).map(f => (
                    <button key={f.id} onClick={() => setFormula(f.id)}
                      className="w-full text-left px-3 py-2 rounded-xl transition-all"
                      style={{
                        background: formula === f.id ? 'rgba(37,99,235,0.15)' : 'var(--dark-bg)',
                        border: `1px solid ${formula === f.id ? 'rgba(37,99,235,0.4)' : 'var(--dark-border2)'}`,
                      }}>
                      <div className="text-xs font-semibold text-white">{f.label}</div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Nível de atividade</label>
                <div className="space-y-1.5">
                  {(Object.entries(ACTIVITY_FACTORS) as [ActivityLevel, typeof ACTIVITY_FACTORS[ActivityLevel]][]).map(([k, v]) => (
                    <button key={k} onClick={() => setActivity(k)}
                      className="w-full text-left px-3 py-2 rounded-xl transition-all"
                      style={{
                        background: activity === k ? 'rgba(37,99,235,0.15)' : 'var(--dark-bg)',
                        border: `1px solid ${activity === k ? 'rgba(37,99,235,0.4)' : 'var(--dark-border2)'}`,
                      }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{v.label}</span>
                        <span className="text-[10px] font-mono" style={{ color: '#93C5FD' }}>×{v.factor}</span>
                      </div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{v.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Objetivo calórico</label>
                <div className="space-y-1.5">
                  {(Object.entries(GOAL_ADJUSTMENTS) as [Goal, typeof GOAL_ADJUSTMENTS[Goal]][]).map(([k, v]) => (
                    <button key={k} onClick={() => setGoal(k)}
                      className="w-full text-left px-3 py-2 rounded-xl transition-all"
                      style={{
                        background: goal === k ? `${v.color}18` : 'var(--dark-bg)',
                        border: `1px solid ${goal === k ? `${v.color}44` : 'var(--dark-border2)'}`,
                      }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{v.label}</span>
                        {v.kcalAdj !== 0 && (
                          <span className="text-[10px] font-bold font-mono" style={{ color: v.color }}>
                            {v.kcalAdj > 0 ? '+' : ''}{v.kcalAdj} kcal
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Macro customization */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
              <div className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Distribuição de Macros</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Proteína (g/kg de peso)
                    <span className="ml-2 font-mono" style={{ color: '#818CF8' }}>{proteinRatio}g/kg</span>
                    {w > 0 && <span className="ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>= {ri(w * parseFloat(proteinRatio || '1.8'))}g/dia</span>}
                  </label>
                  <input type="range" min="1.0" max="3.0" step="0.1" value={proteinRatio}
                    onChange={e => setProteinRatio(e.target.value)}
                    className="w-full accent-indigo-400" />
                  <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    <span>1.0 (mín.)</span><span>1.8 (recomendado)</span><span>3.0 (máx.)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Gordura (% das calorias)
                    <span className="ml-2 font-mono" style={{ color: '#F97316' }}>{fatPctDiet}%</span>
                  </label>
                  <input type="range" min="15" max="40" step="5" value={fatPctDiet}
                    onChange={e => setFatPctDiet(e.target.value)}
                    className="w-full accent-orange-400" />
                  <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    <span>15% (mín.)</span><span>25% (padrão)</span><span>40% (máx.)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results panel */}
          <div className="col-span-3 space-y-4">
            {!valid ? (
              <div className="rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[200px]"
                style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                <div className="text-4xl mb-3">🧮</div>
                <div className="text-white font-semibold">Preencha os dados do paciente</div>
                <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Peso, altura e idade são obrigatórios
                </div>
              </div>
            ) : (
              <>
                {/* TMB + VET */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                    <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: 'rgba(147,197,253,0.7)' }}>TMB</div>
                    <div className="text-3xl font-black text-white">{tmb}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>kcal/dia</div>
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(147,197,253,0.5)' }}>Taxa metabólica basal</div>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: 'rgba(167,139,250,0.7)' }}>VET</div>
                    <div className="text-3xl font-black text-white">{vet}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>kcal/dia</div>
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(167,139,250,0.5)' }}>Gasto total estimado</div>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{
                    background: `${GOAL_ADJUSTMENTS[goal].color}10`,
                    border: `1px solid ${GOAL_ADJUSTMENTS[goal].color}30`,
                  }}>
                    <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: `${GOAL_ADJUSTMENTS[goal].color}88` }}>Meta</div>
                    <div className="text-3xl font-black text-white">{targetKcal}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>kcal/dia</div>
                    <div className="text-[10px] mt-1" style={{ color: `${GOAL_ADJUSTMENTS[goal].color}88` }}>{GOAL_ADJUSTMENTS[goal].label}</div>
                  </div>
                </div>

                {/* BMI */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Composição Corporal</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>IMC</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black" style={{ color: bmiClass?.color }}>{bmi}</span>
                        <span className="text-xs font-bold" style={{ color: bmiClass?.color }}>{bmiClass?.label}</span>
                      </div>
                      {idealMin && idealMax && (
                        <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Peso ideal: {idealMin}–{idealMax} kg
                        </div>
                      )}
                      {weightToLose && (
                        <div className="text-xs mt-0.5" style={{ color: '#FCD34D' }}>
                          Excesso: ~{weightToLose} kg para eutrofia
                        </div>
                      )}
                    </div>
                    {leanMass && (
                      <div>
                        <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Composição corporal</div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: '#4ADE80' }}>Massa magra</span>
                            <span className="font-bold text-white">{leanMass} kg</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span style={{ color: '#F87171' }}>Massa gorda</span>
                            <span className="font-bold text-white">{fatMass} kg ({fp}%)</span>
                          </div>
                          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full" style={{ width: `${fp}%`, background: '#F87171' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Macros */}
                {targetKcal && carbG != null && proteinG != null && fatG != null && (
                  <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                    <div className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Distribuição de Macronutrientes</div>

                    {/* Visual pie-like bar */}
                    <div className="flex h-4 rounded-full overflow-hidden mb-4">
                      <div style={{ width: `${actualProtPct}%`, background: '#818CF8' }} />
                      <div style={{ width: `${actualCarbPct}%`, background: '#FCD34D' }} />
                      <div style={{ width: `${actualFatPct}%`, background: '#F97316' }} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { name: 'Proteína', g: proteinG, pct: actualProtPct, kcal: proteinKcal, color: '#818CF8', gPerKg: r(proteinG / w) },
                        { name: 'Carboidrato', g: carbG, pct: actualCarbPct, kcal: carbKcal, color: '#FCD34D', gPerKg: r(carbG / w) },
                        { name: 'Gordura', g: fatG, pct: actualFatPct, kcal: fatKcal, color: '#F97316', gPerKg: r(fatG / w) },
                      ].map(m => (
                        <div key={m.name} className="rounded-xl p-3 text-center" style={{ background: `${m.color}10`, border: `1px solid ${m.color}25` }}>
                          <div className="text-2xl font-black" style={{ color: m.color }}>{m.g}g</div>
                          <div className="text-xs font-bold text-white mt-0.5">{m.name}</div>
                          <div className="text-[10px] mt-1 space-y-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <div>{m.pct}% · {m.kcal} kcal</div>
                            <div>{m.gPerKg} g/kg</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other recommendations */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Outras Recomendações</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }}>
                      <div className="text-xs" style={{ color: 'rgba(147,197,253,0.7)' }}>💧 Hidratação</div>
                      <div className="text-xl font-black text-white mt-1">{waterNeeds}L/dia</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>35ml × {w}kg</div>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
                      <div className="text-xs" style={{ color: 'rgba(74,222,128,0.7)' }}>🥦 Fibra alimentar</div>
                      <div className="text-xl font-black text-white mt-1">{fiberMin}–{fiberMax}g/dia</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Recomendação DRI</div>
                    </div>
                    {fp != null && (
                      <div className="rounded-xl p-3" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}>
                        <div className="text-xs" style={{ color: 'rgba(167,139,250,0.7)' }}>💪 Proteína na massa magra</div>
                        <div className="text-xl font-black text-white mt-1">{leanMass ? r(proteinG! / leanMass, 2) : '—'}g/kg</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Por kg de massa magra</div>
                      </div>
                    )}
                    <div className="rounded-xl p-3" style={{ background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.12)' }}>
                      <div className="text-xs" style={{ color: 'rgba(252,211,77,0.7)' }}>📊 Fator atividade</div>
                      <div className="text-xl font-black text-white mt-1">×{ACTIVITY_FACTORS[activity].factor}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{ACTIVITY_FACTORS[activity].label}</div>
                    </div>
                  </div>
                </div>

                {/* Deficit/surplus per week */}
                {GOAL_ADJUSTMENTS[goal].kcalAdj !== 0 && (
                  <div className="rounded-2xl p-4" style={{
                    background: `${GOAL_ADJUSTMENTS[goal].color}06`,
                    border: `1px solid ${GOAL_ADJUSTMENTS[goal].color}20`,
                  }}>
                    <div className="text-xs font-bold mb-2" style={{ color: GOAL_ADJUSTMENTS[goal].color }}>
                      Estimativa de resultado ({GOAL_ADJUSTMENTS[goal].label})
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center text-xs">
                      <div>
                        <div className="font-black text-lg text-white">{ri(Math.abs(GOAL_ADJUSTMENTS[goal].kcalAdj) * 7 / 7700 * 100) / 100}kg</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)' }}>por semana</div>
                      </div>
                      <div>
                        <div className="font-black text-lg text-white">{ri(Math.abs(GOAL_ADJUSTMENTS[goal].kcalAdj) * 30 / 7700 * 10) / 10}kg</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)' }}>por mês</div>
                      </div>
                      <div>
                        <div className="font-black text-lg text-white">{ri(Math.abs(GOAL_ADJUSTMENTS[goal].kcalAdj) * 365 / 7700 * 10) / 10}kg</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)' }}>por ano</div>
                      </div>
                    </div>
                    <div className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      * Estimativa teórica (1kg gordura ≈ 7700 kcal). Resultados reais variam conforme aderência e metabolismo individual.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
