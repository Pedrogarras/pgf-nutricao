'use client'
import { useState, useTransition } from 'react'
import { createPatient } from './actions'

interface Credentials { email: string; password: string; patientId: string }

export default function NewPatientModal({ professionalId }: { professionalId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.append('professional_id', professionalId)
    startTransition(async () => {
      const result = await createPatient(fd)
      if (result?.error) { setError(result.error); return }
      if (result?.credentials) {
        setCredentials(result.credentials)
      } else {
        setOpen(false)
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setCredentials(null)
    setError('')
  }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text) } catch {}
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setCredentials(null); setError('') }} className="btn btn-primary">
        + Novo Paciente
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

            {/* ── Success screen with credentials ── */}
            {credentials ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Paciente cadastrado!</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Compartilhe as credenciais abaixo com o paciente para que ele acesse o app.
                </p>

                <div className="space-y-3 text-left mb-6">
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">E-mail</div>
                      <div className="text-sm font-mono font-semibold text-gray-800">{credentials.email}</div>
                    </div>
                    <button
                      onClick={() => copyText(credentials.email)}
                      className="text-xs text-pgf-600 font-semibold hover:text-pgf-700 ml-4 shrink-0"
                    >Copiar</button>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Senha inicial</div>
                      <div className="text-sm font-mono font-semibold text-gray-800">{credentials.password}</div>
                    </div>
                    <button
                      onClick={() => copyText(credentials.password)}
                      className="text-xs text-pgf-600 font-semibold hover:text-pgf-700 ml-4 shrink-0"
                    >Copiar</button>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mb-6">
                  O paciente pode alterar a senha depois. Você pode redefinir a qualquer momento na ficha do paciente.
                </p>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => copyText(`Login PGF Nutrição\nE-mail: ${credentials.email}\nSenha: ${credentials.password}\nAcesse: ${window.location.origin}/login?tipo=aluno`)}
                    className="btn btn-outline btn-sm"
                  >
                    Copiar tudo
                  </button>
                  <button onClick={handleClose} className="btn btn-primary btn-sm">
                    Fechar
                  </button>
                </div>
              </div>

            ) : (
              /* ── Form screen ── */
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <h2 className="text-lg font-bold">Novo Paciente</h2>
                  <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
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
                      <label className="form-label">
                        E-mail
                        <span className="ml-1 text-pgf-600 font-normal text-[10px]">→ cria acesso automático</span>
                      </label>
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
                    <div>
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
                    <div>
                      <label className="form-label">Nível de atividade</label>
                      <select name="activity_level" defaultValue="levemente_ativo" className="form-select">
                        <option value="sedentario">Sedentário</option>
                        <option value="levemente_ativo">Levemente ativo</option>
                        <option value="moderadamente_ativo">Moderadamente ativo</option>
                        <option value="muito_ativo">Muito ativo</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="form-label">Observações iniciais</label>
                      <textarea name="notes" className="form-textarea" rows={2} placeholder="Restrições, informações importantes..." />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={handleClose} className="btn btn-ghost">Cancelar</button>
                    <button type="submit" disabled={isPending} className="btn btn-primary">
                      {isPending ? 'Cadastrando...' : 'Cadastrar Paciente'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
