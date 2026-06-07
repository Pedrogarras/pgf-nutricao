import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowed = ['meal_name', 'meal_time', 'foods', 'total_kcal', 'total_protein_g', 'total_carbs_g', 'total_fat_g', 'notes', 'adherence_score', 'logged_at']
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k]
  }

  // Allow update if professional or patient owner
  const { data, error } = await supabase
    .from('diary_entries')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  await supabase.from('diary_entries').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
