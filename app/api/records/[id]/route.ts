import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function verifyOwnership(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data: record } = await supabase
    .from('anthropometric_records')
    .select('professional_id')
    .eq('id', id)
    .single()
  return record?.professional_id === userId ? record : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const record = await verifyOwnership(supabase, id, user.id)
  if (!record) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  const fields = ['measured_at', 'weight_kg', 'body_fat_pct', 'muscle_mass_kg', 'waist_cm', 'hip_cm', 'arm_cm', 'thigh_cm', 'calf_cm', 'adherence_pct', 'notes']
  for (const f of fields) {
    if (f in body) update[f] = body[f] ?? null
  }

  const { data, error } = await supabase
    .from('anthropometric_records')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ record: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const record = await verifyOwnership(supabase, id, user.id)
  if (!record) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await supabase.from('anthropometric_records').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
