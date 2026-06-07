import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.emoji !== undefined) update.emoji = body.emoji
  if (body.time_start !== undefined) update.time_start = body.time_start

  const { data, error } = await supabase
    .from('meal_templates')
    .update(update)
    .eq('id', id)
    .eq('professional_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  await supabase.from('meal_templates').delete().eq('id', id).eq('professional_id', user.id)
  return NextResponse.json({ ok: true })
}
