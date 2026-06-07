import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const allowed = ['name', 'brand', 'dosage', 'timing', 'with_food', 'instructions', 'active', 'start_date', 'end_date']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k] ?? null

  const { data, error } = await supabase
    .from('supplement_prescriptions')
    .update(update)
    .eq('id', params.id)
    .eq('professional_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ supplement: data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('supplement_prescriptions')
    .update({ active: false })
    .eq('id', params.id)
    .eq('professional_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
