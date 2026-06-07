'use client'
import { useState } from 'react'
import Link from 'next/link'

interface DiaryFood {
  food_name: string
  quantity_g: number
  quantity_description?: string
  kcal?: number
  protein?: number
  carbs?: number
  fat?: number
}

interface DiaryEntry {
  id: string
  logged_at: string
  meal_name: string
  meal_time: string | null
  foods: DiaryFood[]
  total_kcal: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  notes: string | null
  adherence_score: number | null
  source: string
}

interface ActivePlan {
  id: string
  title: string | null
  kcal_goal: number | null
  protein_goal_g: number | null
  carbs_goal_g: number | null
  fat_goal_g: number | null
}

interface Props {
  patient: { id: string; full_name: string; weight_kg: number | null }
  initialEntries: DiaryEntry[]
  activePlan: ActivePlan | null
  patientId: string
}

const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Muito ruim', color: 'text-red-600 bg-red-50' },
  2: { label: 'Ruim', color: 'text-orange-600 bg-orange-50' },
  3: { label: 'Regular', color: 'text-amber-600 bg-amber-50' },
  4: { label: 'Bom', color: 'text-emerald-600 bg-emerald-50' },
  5: { label: 'Ótimo', color: 'text-green-700 bg-green-50' },
}

export default function DiarioClient({ patient, initialEntries, activePlan, patientId }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Group entries by date
  const byDate: Record<string, DiaryEntry[]> = {}
  for (const e of entries) {
    if (!byDate[e.logged_at]) byDate[e.logged_at] = []
    byDate[e.logged_at].push(e)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  // Date filter
  const displayDates = selectedDate ? [selectedDate].filter(d => byDate[d]) : sortedDates

  // Per-day totals
  function dayTotals(dayEntries: DiaryEntry[]) {
    return {
      kcal: dayEntries.reduce((s, e) => s + (e.total_kcal ?? 0), 0),
      protein: dayEntries.reduce((s, e) => s + (e.total_protein_g ?? 0), 0),
      carbs: dayEntries.reduce((s, e) => s + (e.total_carbs_g ?? 0), 0),
      fat: dayEntries.reduce((s, e) => s + (e.total_fat_g ?? 0), 0),
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro do diário?')) return
    setDeletingId(id)
    await fetch(`/api/diary/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
    showToast('Registro excluído.')
  }

  // 7-day adherence stats
  const last7Days = sortedDates.slice(0, 7)
  const avgAdherence = (() => {
    const scores = entries.filter(e => e.adherence_score && last7Days.includes(e.logged_at)).map(e => e.adherence_score!)
    return scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null
  })()

  const loggedDays = new Set(entries.map(e => e.logged_at)).size
  const avgKcalPerDay = loggedDays > 0
    ? Math.round(entries.reduce((s, e) => s + (e.total_kcal ?? 0), 0) / loggedDays)
    : 0

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
          <h1 className="text-base font-bold text-white">📔 Diário Alimentar</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          {entries.length} registros · {loggedDays} dias
        </div>
      </div>

      <div className="p-8">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Dias registrados</div>
            <div className="text-2xl font-black text-pgf-600 my-1">{loggedDays}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Média kcal/dia</div>
            <div className="text-2xl font-black text-gray-900 my-1">{avgKcalPerDay || '—'}</div>
            {activePlan?.kcal_goal && avgKcalPerDay > 0 && (
              <div className={`text-xs font-semibold ${Math.abs(avgKcalPerDay - activePlan.kcal_goal) < 150 ? 'text-emerald-600' : 'text-amber-600'}`}>
                Meta: {activePlan.kcal_goal} kcal
              </div>
            )}
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Adesão média (7d)</div>
            <div className="text-2xl font-black text-amber-600 my-1">{avgAdherence ? `${avgAdherence}/5` : '—'}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Plano ativo</div>
            <div className="text-sm font-bold text-gray-900 mt-1 truncate">{activePlan?.title ?? 'Nenhum'}</div>
            {activePlan && (
              <Link href={`/pro/pacientes/${patientId}/dieta/${activePlan.id}`} className="text-xs text-pgf-600 hover:underline">
                Abrir plano →
              </Link>
            )}
          </div>
        </div>

        {/* Plan comparison bar */}
        {activePlan && avgKcalPerDay > 0 && (
          <div className="card p-4 mb-6">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Comparativo com o Plano Prescrito (média)</div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Calorias', actual: avgKcalPerDay, goal: activePlan.kcal_goal, unit: 'kcal', color: 'bg-gray-800' },
                { label: 'Proteína', actual: Math.round(entries.reduce((s,e) => s+(e.total_protein_g??0),0)/loggedDays), goal: activePlan.protein_goal_g, unit: 'g', color: 'bg-blue-500' },
                { label: 'Carboidrato', actual: Math.round(entries.reduce((s,e) => s+(e.total_carbs_g??0),0)/loggedDays), goal: activePlan.carbs_goal_g, unit: 'g', color: 'bg-amber-500' },
                { label: 'Gordura', actual: Math.round(entries.reduce((s,e) => s+(e.total_fat_g??0),0)/loggedDays), goal: activePlan.fat_goal_g, unit: 'g', color: 'bg-red-400' },
              ].map(m => {
                const pct = m.goal ? Math.min(100, Math.round((m.actual / m.goal) * 100)) : null
                const diff = m.goal ? m.actual - m.goal : null
                return (
                  <div key={m.label}>
                    <div className="flex items-end justify-between mb-1">
                      <span className="text-xs text-gray-500">{m.label}</span>
                      {diff !== null && (
                        <span className={`text-[11px] font-bold ${Math.abs(diff) < (m.goal! * 0.1) ? 'text-emerald-600' : diff > 0 ? 'text-red-500' : 'text-amber-500'}`}>
                          {diff > 0 ? '+' : ''}{diff}{m.unit}
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>{m.actual}{m.unit}</span>
                      <span>{m.goal ? `${m.goal}${m.unit}` : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Date filter */}
        {sortedDates.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedDate(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!selectedDate ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos os dias
            </button>
            {sortedDates.slice(0, 10).map(d => (
              <button
                key={d}
                onClick={() => setSelectedDate(d === selectedDate ? null : d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedDate === d ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </button>
            ))}
          </div>
        )}

        {/* Diary timeline */}
        {displayDates.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-4">📔</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum registro no diário</h3>
            <p className="text-sm text-gray-500">
              O paciente ainda não registrou nenhuma refeição no diário alimentar.
              Peça para ele usar o aplicativo para registrar o que come.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayDates.map(date => {
              const dayEntries = byDate[date]
              const totals = dayTotals(dayEntries)
              const kcalPct = activePlan?.kcal_goal ? Math.min(100, Math.round((totals.kcal / activePlan.kcal_goal) * 100)) : null
              return (
                <div key={date} className="card overflow-hidden">
                  {/* Day header */}
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-gray-900 text-sm">
                        {new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                      {dayEntries.some(e => e.adherence_score) && (() => {
                        const scores = dayEntries.filter(e => e.adherence_score).map(e => e.adherence_score!)
                        const avg = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length)
                        const s = SCORE_LABELS[avg]
                        return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                      })()}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-black text-gray-900">{Math.round(totals.kcal)} kcal</span>
                      <span className="text-blue-600 font-semibold">P {Math.round(totals.protein)}g</span>
                      <span className="text-amber-600 font-semibold">C {Math.round(totals.carbs)}g</span>
                      <span className="text-red-500 font-semibold">G {Math.round(totals.fat)}g</span>
                      {kcalPct !== null && (
                        <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${kcalPct > 110 ? 'bg-red-50 text-red-600' : kcalPct > 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {kcalPct}% da meta
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meals */}
                  <div className="divide-y divide-gray-50">
                    {dayEntries.map(entry => (
                      <div key={entry.id} className="group">
                        <div
                          className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-900">{entry.meal_name}</span>
                                {entry.meal_time && <span className="text-xs text-gray-400">{entry.meal_time.slice(0,5)}</span>}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${entry.source === 'patient' ? 'bg-pgf-50 text-pgf-600' : 'bg-gray-100 text-gray-500'}`}>
                                  {entry.source === 'patient' ? 'Paciente' : 'Profissional'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {entry.foods.length} alimento{entry.foods.length !== 1 ? 's' : ''}
                                {entry.notes && <span> · {entry.notes.slice(0, 50)}{entry.notes.length > 50 ? '...' : ''}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-black text-gray-900">{Math.round(entry.total_kcal ?? 0)} kcal</div>
                              <div className="text-xs text-gray-400">
                                P{Math.round(entry.total_protein_g ?? 0)}g C{Math.round(entry.total_carbs_g ?? 0)}g G{Math.round(entry.total_fat_g ?? 0)}g
                              </div>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(entry.id) }}
                              disabled={deletingId === entry.id}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-sm disabled:opacity-40"
                            >
                              {deletingId === entry.id ? '...' : '✕'}
                            </button>
                            <span className="text-gray-400 text-sm">{expandedId === entry.id ? '▾' : '▸'}</span>
                          </div>
                        </div>

                        {expandedId === entry.id && entry.foods.length > 0 && (
                          <div className="px-5 pb-3 bg-gray-50/40 border-t border-gray-50">
                            <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2"
                              style={{ gridTemplateColumns: '1fr 70px 50px 50px 50px 50px' }}>
                              <span>Alimento</span>
                              <span className="text-center">Qtd</span>
                              <span className="text-center">Kcal</span>
                              <span className="text-center text-blue-500">Prot</span>
                              <span className="text-center text-amber-500">Carb</span>
                              <span className="text-center text-red-500">Gord</span>
                            </div>
                            {entry.foods.map((f, i) => (
                              <div key={i} className="grid items-center py-1.5 border-t border-gray-100"
                                style={{ gridTemplateColumns: '1fr 70px 50px 50px 50px 50px' }}>
                                <span className="text-sm text-gray-800">{f.food_name}</span>
                                <span className="text-xs text-center text-gray-600">{f.quantity_description ?? `${f.quantity_g}g`}</span>
                                <span className="text-xs text-center font-semibold">{Math.round(f.kcal ?? 0)}</span>
                                <span className="text-xs text-center text-blue-600">{Math.round(f.protein ?? 0)}g</span>
                                <span className="text-xs text-center text-amber-600">{Math.round(f.carbs ?? 0)}g</span>
                                <span className="text-xs text-center text-red-500">{Math.round(f.fat ?? 0)}g</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
