import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.scheduled_at !== undefined) update.scheduled_at = body.scheduled_at
  if (body.duration_min !== undefined) update.duration_min = Number(body.duration_min)
  if (body.type !== undefined) update.type = body.type
  if (body.status !== undefined) update.status = body.status
  if (body.notes !== undefined) update.notes = body.notes || null
  if (body.patient_id !== undefined) update.patient_id = body.patient_id || null

  const { data, error } = await supabase
    .from('consultations')
    .update(update)
    .eq('id', id)
    .eq('professional_id', user.id)
    .select('*, patient:patients(id, full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ consultation: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  await supabase.from('consultations').delete().eq('id', id).eq('professional_id', user.id)
  return NextResponse.json({ ok: true })
}
