'use client'
import { useState, useTransition } from 'react'
import { loginProfessional, loginStudent } from './actions'

export default function LoginPage() {
  const [tab, setTab] = useState<'pro' | 'aluno'>('pro')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleProLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginProfessional(fd)
      if (result?.error) setError(result.error)
    })
  }

  async function handleAlunoLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginStudent(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-pgf-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl font-black text-white font-serif italic tracking-tighter leading-none mb-3">
            PGF
          </div>
          <div className="text-xs font-bold text-white/80 tracking-[3px] uppercase">
            Pedro Garrastazu Frey
          </div>
          <div className="text-sm text-white/50 mt-1">Nutricionista</div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => { setTab('pro'); setError('') }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'pro'
                  ? 'text-pgf-600 border-b-2 border-pgf-600 bg-pgf-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              🩺 Sou Nutricionista
            </button>
            <button
              onClick={() => { setTab('aluno'); setError('') }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'aluno'
                  ? 'text-pgf-600 border-b-2 border-pgf-600 bg-pgf-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              🏋️ Sou Aluno
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {tab === 'pro' ? (
              <form onSubmit={handleProLogin} className="space-y-4">
                <div>
                  <label className="form-label">E-mail</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="seu@email.com"
                    className="form-input"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="form-label">Senha</label>
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="form-input"
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn btn-primary w-full justify-center py-2.5 text-base"
                >
                  {isPending ? 'Entrando...' : 'Entrar como Nutricionista'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAlunoLogin} className="space-y-4">
                <div className="p-3 bg-pgf-50 rounded-lg text-xs text-pgf-600 border border-pgf-100">
                  Seu usuário é o seu <strong>nome completo</strong> e sua senha é a sua{' '}
                  <strong>data de nascimento</strong> (DD/MM/AAAA).
                </div>
                <div>
                  <label className="form-label">Nome completo</label>
                  <input
                    name="full_name"
                    type="text"
                    required
                    placeholder="Ex: Ana Martins"
                    className="form-input"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="form-label">Data de nascimento</label>
                  <input
                    name="date_of_birth"
                    type="text"
                    required
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className="form-input"
                    pattern="\d{2}/\d{2}/\d{4}"
                  />
                  <p className="text-xs text-gray-400 mt-1">Formato: 25/03/1995</p>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn btn-primary w-full justify-center py-2.5 text-base"
                >
                  {isPending ? 'Entrando...' : 'Ver meu plano'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Pedro Garrastazu Frey · Nutricionista
        </p>
      </div>
    </div>
  )
}
