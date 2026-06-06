import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'professional') redirect('/pro/dashboard')
    else redirect('/aluno')
  }

  return <>{children}</>
}
