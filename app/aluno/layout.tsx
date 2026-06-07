import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from './BottomNav'

function AromaticRingBg() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.045 }}>
        <defs>
          <pattern id="aluno-hex" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,2 56,17 56,47 30,62 4,47 4,17" fill="none" stroke="white" strokeWidth="1.5" />
            <polygon points="30,13 46,22 46,42 30,51 14,42 14,22" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="8 4" />
            <circle cx="30" cy="32" r="2" fill="white" />
          </pattern>
          <pattern id="aluno-hex2" x="30" y="26" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,2 56,17 56,47 30,62 4,47 4,17" fill="none" stroke="white" strokeWidth="1.5" />
            <polygon points="30,13 46,22 46,42 30,51 14,42 14,22" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="8 4" />
            <circle cx="30" cy="32" r="2" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#aluno-hex)" />
        <rect width="100%" height="100%" fill="url(#aluno-hex2)" />
      </svg>
    </div>
  )
}

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')
  return (
    <div className="dark-theme min-h-screen relative" style={{ backgroundColor: '#06060A' }}>
      <AromaticRingBg />
      <div className="relative z-10 pb-16">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
