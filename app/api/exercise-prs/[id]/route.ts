import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/exercise-prs/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('exercise_personal_records')
    .delete()
    .eq('id', id)
    .eq('patient_id', patient.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/exercise-prs/[id]
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
  if (body.value        !== undefined) updates.value        = body.value
  if (body.notes        !== undefined) updates.notes        = body.notes
  if (body.achieved_at  !== undefined) updates.achieved_at  = body.achieved_at
  if (body.exercise_name !== undefined) updates.exercise_name = body.exercise_name

  const { data, error } = await supabase
    .from('exercise_personal_records')
    .update(updates)
    .eq('id', id)
    .eq('patient_id', patient.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ pr: data })
}
