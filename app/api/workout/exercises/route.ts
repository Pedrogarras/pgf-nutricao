import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Verify workout_day belongs to a plan owned by this professional
  const { data: day } = await supabase
    .from('workout_days')
    .select('workout_plans(professional_id)')
    .eq('id', body.workout_day_id)
    .single()
  const ownerId = (day?.workout_plans as { professional_id?: string } | null)?.professional_id
  if (!day || ownerId !== user.id) return NextResponse.json({ error: 'Dia não encontrado' }, { status: 404 })

  const { data, error } = await supabase.from('workout_exercises').insert({
    workout_day_id: body.workout_day_id,
    exercise_id: body.exercise_id,
    sets: body.sets || null,
    reps: body.reps || null,
    rest_seconds: body.rest_seconds || null,
    notes: body.notes || null,
    sort_order: body.sort_order ?? 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ exercise: data })
}
