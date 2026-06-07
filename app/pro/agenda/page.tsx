import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgendaClient from './AgendaClient'

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patients } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('professional_id', user.id)
    .eq('active', true)
    .order('full_name')

  const currentMonth = new Date().toISOString().slice(0, 7)

  return <AgendaClient patients={patients ?? []} initialMonth={currentMonth} />
}
