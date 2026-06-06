'use client'
import { useState, useTransition } from 'react'
import Image from 'next/image'
import { loginProfessional, loginStudent } from './actions'

/* Polycyclic aromatic ring (benzene/naphthalene honeycomb) SVG background */
function AromaticRingPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.07 }}>
      <defs>
        <pattern id="hex" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
          <polygon points="30,2 56,17 56,47 30,62 4,47 4,17" fill="none" stroke="white" strokeWidth="1.5" />
          <polygon points="30,13 46,22 46,42 30,51 14,42 14,22" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="8 4" />
          <circle cx="30" cy="32" r="2" fill="white" />
        </pattern>
        <pattern id="hex2" x="30" y="26" width="60" height="52" patternUnits="userSpaceOnUse">
          <polygon points="30,2 56,17 56,47 30,62 4,47 4,17" fill="none" stroke="white" strokeWidth="1.5" />
          <polygon points="30,13 46,22 46,42 30,51 14,42 14,22" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="8 4" />
          <circle cx="30" cy="32" r="2" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
      <rect width="100%" height="100%" fill="url(#hex2)" />
    </svg>
  )
}

function Pendant() {
  return (
    <svg width="60" height="72" viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <line x1="30" y1="0" x2="30" y2="20" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <polygon points="30,18 50,38 30,58 10,38" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <polygon points="30,26 42,38 30,50 18,38" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <circle cx="30" cy="38" r="3" fill="rgba(255,255,255,0.5)" />
      <line x1="30" y1="58" x2="30" y2="70" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <circle cx="30" cy="70" r="1.5" fill="rgba(255,255,255,0.3)" />
    </svg>
  )
}

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
    <div className="min-h-screen bg-pgf-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <AromaticRingPattern />

      {/* Top ornamental rule */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-25">
        <div className="w-16 h-px bg-white" />
        <div className="w-2 h-2 rotate-45 border border-white" />
        <div className="w-1.5 h-1.5 rotate-45 bg-white" />
        <div className="w-2 h-2 rotate-45 border border-white" />
        <div className="w-16 h-px bg-white" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo-pgf-branco.png" alt="PGF Nutricionista" width={220} height={110} className="object-contain" priority />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button onClick={() => { setTab('pro'); setError('') }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === 'pro' ? 'text-pgf-600 border-b-2 border-pgf-600 bg-pgf-50' : 'text-gray-400 hover:text-gray-600'}`}>
              🩺 Sou Nutricionista
            </button>
            <button onClick={() => { setTab('aluno'); setError('') }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === 'aluno' ? 'text-pgf-600 border-b-2 border-pgf-600 bg-pgf-50' : 'text-gray-400 hover:text-gray-600'}`}>
              🏋️ Sou Aluno
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {tab === 'pro' ? (
              <form onSubmit={handleProLogin} className="space-y-4">
                <div>
                  <label className="form-label">E-mail</label>
                  <input name="email" type="email" required placeholder="seu@email.com" className="form-input" autoComplete="email" />
                </div>
                <div>
                  <label className="form-label">Senha</label>
                  <input name="password" type="password" required placeholder="••••••••" className="form-input" autoComplete="current-password" />
                </div>
                <button type="submit" disabled={isPending} className="btn btn-primary w-full justify-center py-2.5 text-base">
                  {isPending ? 'Entrando...' : 'Entrar como Nutricionista'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAlunoLogin} className="space-y-4">
                <div className="p-3 bg-pgf-50 rounded-lg text-xs text-pgf-600 border border-pgf-100">
                  Seu usuário é o seu <strong>nome completo</strong> e sua senha é a sua <strong>data de nascimento</strong> (DD/MM/AAAA).
                </div>
                <div>
                  <label className="form-label">Nome completo</label>
                  <input name="full_name" type="text" required placeholder="Ex: Ana Martins" className="form-input" autoComplete="name" />
                </div>
                <div>
                  <label className="form-label">Data de nascimento</label>
                  <input name="date_of_birth" type="text" required placeholder="DD/MM/AAAA" maxLength={10} className="form-input" pattern="\d{2}/\d{2}/\d{4}" />
                  <p className="text-xs text-gray-400 mt-1">Formato: 25/03/1995</p>
                </div>
                <button type="submit" disabled={isPending} className="btn btn-primary w-full justify-center py-2.5 text-base">
                  {isPending ? 'Entrando...' : 'Ver meu plano'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-6"><Pendant /></div>
        <p className="text-center text-white/40 text-xs mt-4">
          © {new Date().getFullYear()} Pedro Garrastazu Frey · Nutricionista
        </p>
      </div>

      {/* Bottom ornamental rule */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-25">
        <div className="w-16 h-px bg-white" />
        <div className="w-2 h-2 rotate-45 border border-white" />
        <div className="w-1.5 h-1.5 rotate-45 bg-white" />
        <div className="w-2 h-2 rotate-45 border border-white" />
        <div className="w-16 h-px bg-white" />
      </div>
    </div>
  )
}
