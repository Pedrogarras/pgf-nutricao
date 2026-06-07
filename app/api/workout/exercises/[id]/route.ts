import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const { data: we } = await supabase
    .from('workout_exercises')
    .select('workout_days(workout_plans(professional_id))')
    .eq('id', id)
    .single()
  const ownerId = ((we?.workout_days as { workout_plans?: { professional_id?: string } } | null)?.workout_plans?.professional_id) ?? null
  if (!we || ownerId !== user.id) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (body.sets !== undefined) update.sets = body.sets ? Number(body.sets) : null
  if (body.reps !== undefined) update.reps = body.reps || null
  if (body.rest_seconds !== undefined) update.rest_seconds = body.rest_seconds ? Number(body.rest_seconds) : null
  if (body.notes !== undefined) update.notes = body.notes || null
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order)

  const { data, error } = await supabase.from('workout_exercises').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ exercise: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  // Ownership check via join
  const { data: we } = await supabase
    .from('workout_exercises')
    .select('workout_days(workout_plans(professional_id))')
    .eq('id', id)
    .single()
  const ownerId = ((we?.workout_days as { workout_plans?: { professional_id?: string } } | null)?.workout_plans?.professional_id) ?? null
  if (!we || ownerId !== user.id) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await supabase.from('workout_exercises').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
