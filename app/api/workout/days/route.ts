import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Verify plan belongs to this professional
  const { data: plan } = await supabase
    .from('workout_plans').select('id').eq('id', body.workout_plan_id).eq('professional_id', user.id).single()
  if (!plan) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })

  const { data, error } = await supabase.from('workout_days').insert({
    workout_plan_id: body.workout_plan_id,
    name: body.name,
    sort_order: body.sort_order ?? 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ day: data })
}
