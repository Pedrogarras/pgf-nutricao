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
    <aside
      className="fixed top-0 left-0 bottom-0 w-60 flex flex-col z-50 shadow-2xl"
      style={{
        background: 'linear-gradient(180deg, #080E25 0%, #0D163A 40%, #091530 100%)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Subtle ring accent at top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(90,111,204,0.6), transparent)' }} />

      {/* Logo */}
      <div className="px-6 py-7 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-4xl font-black text-white font-serif italic tracking-tighter leading-none mb-1">
          PGF
        </div>
        <div className="text-[9px] font-bold tracking-[2px] uppercase" style={{ color: 'rgba(197,205,240,0.6)' }}>
          Pedro Garrastazu
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(197,205,240,0.35)' }}>Nutricionista</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {NAV.map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-bold tracking-[1.5px] uppercase px-3 py-2 mt-2" style={{ color: 'rgba(197,205,240,0.3)' }}>
              {group.label}
            </p>
            {group.items.map(item => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={active
                    ? { background: 'rgba(90,111,204,0.28)', color: '#C5CDF0', fontWeight: 600, boxShadow: 'inset 0 0 0 1px rgba(90,111,204,0.35)' }
                    : { color: 'rgba(197,205,240,0.55)' }
                  }
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                      ;(e.currentTarget as HTMLElement).style.color = '#E2E8F8'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = ''
                      ;(e.currentTarget as HTMLElement).style.color = 'rgba(197,205,240,0.55)'
                    }
                  }}
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
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(90,111,204,0.35)', color: '#C5CDF0' }}>
            {profile.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: '#E2E8F8' }}>{profile.full_name}</div>
            <div className="text-[10px]" style={{ color: 'rgba(197,205,240,0.4)' }}>Nutricionista</div>
          </div>
          <form action={logout}>
            <button type="submit" className="text-lg transition-colors" style={{ color: 'rgba(197,205,240,0.35)' }}
              title="Sair"
              onMouseEnter={e => (e.currentTarget.style.color = '#E2E8F8')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(197,205,240,0.35)')}
            >
              ⏻
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
