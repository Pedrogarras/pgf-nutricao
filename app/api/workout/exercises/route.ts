import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
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
