import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { plan_id } = await request.json()
  await supabase.from('workout_plans').update({ published_at: new Date().toISOString() }).eq('id', plan_id).eq('professional_id', user.id)
  return NextResponse.json({ ok: true })
}
