import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BroadcastClient from './BroadcastClient'

export default async function BroadcastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const nowISO       = new Date().toISOString()

  const [
    { data: patients },
    { data: recentDiary },
    { data: upcomingConsults },
    { data: templates },
  ] = await Promise.all([
    supabase.from('patients')
      .select('id, full_name, phone, date_of_birth')
      .eq('professional_id', user.id)
      .eq('active', true)
      .not('phone', 'is', null)
      .order('full_name'),

    // Who logged diary in last 7 days
    supabase.from('diary_entries')
      .select('patient_id')
      .gte('logged_at', sevenDaysAgo),

    // Upcoming consultations next 7 days
    supabase.from('consultations')
      .select('patient_id, scheduled_at')
      .eq('professional_id', user.id)
      .in('status', ['agendado', 'confirmado'])
      .gte('scheduled_at', nowISO)
      .lte('scheduled_at', new Date(Date.now() + 7 * 86400000).toISOString()),

    // Message templates
    supabase.from('message_templates')
      .select('id, name, content, category')
      .eq('professional_id', user.id)
      .order('category')
      .order('name'),
  ])

  const loggedIds = new Set((recentDiary ?? []).map(e => e.patient_id))
  const upcomingIds = new Set((upcomingConsults ?? []).map(c => c.patient_id))

  // Add birthday and diary info to patients
  const todayStr = new Date().toISOString().split('T')[0]
  const enriched = (patients ?? []).map(p => {
    let daysUntilBirthday: number | null = null
    if (p.date_of_birth) {
      const today = new Date()
      const bday = new Date(p.date_of_birth + 'T12:00')
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
      const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate())
      const diff = thisYear >= today ? thisYear.getTime() - today.getTime() : nextYear.getTime() - today.getTime()
      daysUntilBirthday = Math.ceil(diff / (1000 * 60 * 60 * 24))
    }
    return {
      id: p.id,
      full_name: p.full_name,
      phone: p.phone!,
      loggedThisWeek: loggedIds.has(p.id),
      hasUpcomingConsult: upcomingIds.has(p.id),
      birthdayInDays: daysUntilBirthday,
      hasBirthdaySoon: daysUntilBirthday !== null && daysUntilBirthday <= 7,
    }
  })

  return (
    <BroadcastClient
      patients={enriched}
      templates={(templates ?? []) as Array<{ id: string; name: string; content: string; category: string }>}
    />
  )
}
