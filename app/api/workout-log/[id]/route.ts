import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/workout-log/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  // Only allow patients to delete their own logs
  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('id', id)
    .eq('patient_id', patient.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/workout-log/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const updates: Record<string, unknown> = {}
  if (body.duration_min !== undefined) updates.duration_min = body.duration_min
  if (body.rpe          !== undefined) updates.rpe          = body.rpe
  if (body.notes        !== undefined) updates.notes        = body.notes

  const { data, error } = await supabase
    .from('workout_logs')
    .update(updates)
    .eq('id', id)
    .eq('patient_id', patient.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ log: data })
}
