import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')
  return <div className="min-h-screen bg-gray-50">{children}</div>
}
