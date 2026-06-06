'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'
import type { Profile } from '@/lib/types'

interface Props { profile: Profile }

const NAV = [
  { label: 'Principal', items: [
    { href: '/pro/dashboard', icon: '📊', label: 'Dashboard' },
  ]},
  { label: 'Clínico', items: [
    { href: '/pro/pacientes', icon: '👥', label: 'Pacientes' },
    { href: '/pro/dieta',     icon: '🥗', label: 'Prescrição de Dieta' },
    { href: '/pro/treino',    icon: '💪', label: 'Prescrição de Treino' },
  ]},
  { label: 'Ferramentas', items: [
    { href: '/pro/alimentos',  icon: '🥦', label: 'Banco de Alimentos' },
    { href: '/pro/exercicios', icon: '🎥', label: 'Biblioteca de Exercícios' },
    { href: '/pro/agenda',     icon: '📅', label: 'Agenda' },
  ]},
]

export default function Sidebar({ profile }: Props) {
  const pathname = usePathname()

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-60 bg-pgf-600 flex flex-col z-50 shadow-xl">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10 text-center">
        <div className="text-4xl font-black text-white font-serif italic tracking-tighter leading-none mb-1">
          PGF
        </div>
        <div className="text-[9px] font-bold text-white/75 tracking-[2px] uppercase">
          Pedro Garrastazu
        </div>
        <div className="text-[10px] text-white/45 mt-0.5">Nutricionista</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {NAV.map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-white/35 px-3 py-2 mt-2">
              {group.label}
            </p>
            {group.items.map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/8">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {profile.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{profile.full_name}</div>
            <div className="text-[10px] text-white/45">Nutricionista</div>
          </div>
          <form action={logout}>
            <button type="submit" className="text-white/40 hover:text-white text-lg" title="Sair">
              ⏻
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
