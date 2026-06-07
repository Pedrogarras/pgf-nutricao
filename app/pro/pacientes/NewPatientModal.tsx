'use client'
import { useState, useTransition } from 'react'
import { createPatient } from './actions'

export default function NewPatientModal({ professionalId }: { professionalId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.append('professional_id', professionalId)
    startTransition(async () => {
      const result = await createPatient(fd)
      if (result?.error) setError(result.error)
      else setOpen(false)
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        + Novo Paciente
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">Novo Paciente</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Nome completo *</label>
                  <input name="full_name" required className="form-input" placeholder="Ana Martins" />
                </div>
                <div>
                  <label className="form-label">Data de nascimento *</label>
                  <input name="date_of_birth" type="date" required className="form-input" />
                  <p className="text-[11px] text-gray-400 mt-1">Dados clínicos (cálculo de IMC, etc.)</p>
                </div>
                <div>
                  <label className="form-label">Sexo</label>
                  <select name="gender" className="form-select">
                    <option value="">Selecione</option>
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">E-mail</label>
                  <input name="email" type="email" className="form-input" placeholder="ana@email.com" />
                </div>
                <div>
                  <label className="form-label">Telefone</label>
                  <input name="phone" className="form-input" placeholder="(51) 99999-9999" />
                </div>
                <div>
                  <label className="form-label">Peso (kg)</label>
                  <input name="weight_kg" type="number" step="0.1" className="form-input" placeholder="62.5" />
                </div>
                <div>
                  <label className="form-label">Altura (cm)</label>
                  <input name="height_cm" type="number" step="0.1" className="form-input" placeholder="165" />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Objetivo</label>
                  <select name="goal" className="form-select">
                    <option value="">Selecione</option>
                    <option value="Emagrecimento">Emagrecimento</option>
                    <option value="Ganho de massa muscular">Ganho de massa muscular</option>
                    <option value="Manutenção de peso">Manutenção de peso</option>
                    <option value="Saúde geral">Saúde geral</option>
                    <option value="Performance esportiva">Performance esportiva</option>
                    <option value="Reabilitação">Reabilitação</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="form-label">Observações iniciais</label>
                  <textarea name="notes" className="form-textarea" rows={2} placeholder="Restrições, informações importantes..." />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? 'Salvando...' : 'Cadastrar Paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
