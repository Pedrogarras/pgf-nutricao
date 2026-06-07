'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createDietPlan, deleteDietPlan, togglePlanActive, renameDietPlan } from './actions'

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
}

interface Props {
  patient: Patient
  dietPlans: DietPlan[]
}

export default function PatientHub({ patient, dietPlans: initialPlans }: Props) {
  const [plans, setPlans] = useState(initialPlans)
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [isPending, startTransition] = useTransition()

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

  const initials = patient.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const activeCount = plans.filter(p => p.active).length

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
        <span className="text-xs font-semibold text-white">{patient.full_name}</span>
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
              {patient.full_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {patient.goal && (
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {patient.goal}
                </span>
              )}
              {patient.weight_kg && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD' }}
                >
                  {patient.weight_kg} kg
                </span>
              )}
              {patient.height_cm && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
                >
                  {patient.height_cm} cm
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/pro/pacientes/${patient.id}/treino`}
            className="btn btn-outline btn-sm flex-shrink-0"
          >
            Prescrição de Treino
          </Link>
        </div>

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
                  gridTemplateColumns: '12px 1fr 90px 80px 210px',
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
                    gridTemplateColumns: '12px 1fr 90px 80px 210px',
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
      </div>

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
