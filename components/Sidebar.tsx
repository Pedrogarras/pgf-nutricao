'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'
import type { Profile } from '@/lib/types'

interface Props { profile: Profile }

const NAV = [
  { label: 'Principal', items: [
    { href: '/pro/dashboard', label: 'Dashboard' },
  ]},
  { label: 'Clínico', items: [
    { href: '/pro/pacientes',  label: 'Pacientes' },
    { href: '/pro/dieta',      label: 'Prescrição Dietética' },
    { href: '/pro/treino',     label: 'Prescrição de Treino' },
  ]},
  { label: 'Ferramentas', items: [
    { href: '/pro/alimentos',  label: 'Banco de Alimentos' },
    { href: '/pro/receitas',   label: 'Receitas' },
    { href: '/pro/templates',  label: 'Templates de Refeição' },
    { href: '/pro/mensagens',  label: 'Templates de Mensagem' },
    { href: '/pro/exercicios', label: 'Exercícios' },
    { href: '/pro/agenda',     label: 'Agenda' },
  ]},
]

export default function Sidebar({ profile }: Props) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 w-60 flex flex-col z-50"
      style={{
        background: '#06060A',
        borderRight: '1px solid rgba(37,99,235,0.18)',
      }}
    >
      {/* Top blue accent line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

      {/* Logo / Brand */}
      <div className="px-6 pt-8 pb-7">
        <div
          className="text-white font-serif italic font-black tracking-tighter leading-none"
          style={{ fontSize: '2.25rem', letterSpacing: '-0.04em' }}
        >
          PGF
        </div>
        <div className="mt-2 h-px" style={{ background: 'rgba(37,99,235,0.4)' }} />
        <div className="mt-2 text-[10px] font-semibold tracking-[2.5px] uppercase"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          Pedro Garrastazu Frey
        </div>
        <div className="text-[10px] tracking-wide mt-0.5"
          style={{ color: 'rgba(255,255,255,0.18)' }}>
          Nutricionista
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 pb-4 overflow-y-auto">
        {NAV.map(group => (
          <div key={group.label} className="mb-6">
            <p className="text-[9px] font-bold tracking-[2px] uppercase mb-2 px-2"
              style={{ color: 'rgba(255,255,255,0.2)' }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center px-3 py-2 text-[13px] rounded-r-md transition-all"
                    style={active ? {
                      borderLeft: '2px solid #2563EB',
                      paddingLeft: '10px',
                      background: 'rgba(37,99,235,0.1)',
                      color: '#FFFFFF',
                      fontWeight: 600,
                    } : {
                      borderLeft: '2px solid transparent',
                      paddingLeft: '10px',
                      color: 'rgba(255,255,255,0.42)',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = 'rgba(255,255,255,0.82)'
                        el.style.background = 'rgba(255,255,255,0.04)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        const el = e.currentTarget as HTMLElement
                        el.style.color = 'rgba(255,255,255,0.42)'
                        el.style.background = ''
                      }
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className="px-4 pb-5">
        <div className="h-px mb-4" style={{ background: 'rgba(37,99,235,0.18)' }} />
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
          >
            {profile.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-white">{profile.full_name}</div>
            <div className="text-[10px] tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>Nutricionista</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sair"
              className="text-sm transition-colors px-1"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              ⏻
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
