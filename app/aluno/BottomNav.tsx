'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/aluno',         label: 'Início',  icon: '🏠' },
  { href: '/aluno/diario',  label: 'Diário',  icon: '📔' },
  { href: '/aluno/checkin', label: 'Check-in',icon: '⚖️' },
  { href: '/aluno/evolucao',label: 'Evolução',icon: '📈' },
  { href: '/aluno/perfil',  label: 'Perfil',  icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center"
      style={{
        background: 'rgba(6,6,10,0.97)',
        borderTop: '1px solid rgba(37,99,235,0.18)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(60px + env(safe-area-inset-bottom))',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/aluno'
          ? pathname === '/aluno'
          : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-all"
            style={{ color: isActive ? '#93C5FD' : 'rgba(255,255,255,0.35)' }}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[9px] font-semibold tracking-wide">{item.label}</span>
            {isActive && (
              <div className="absolute bottom-[env(safe-area-inset-bottom,0)] w-6 h-0.5 rounded-full"
                style={{ background: '#2563EB' }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
