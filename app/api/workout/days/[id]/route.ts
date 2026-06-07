import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getOwnerId(supabase: Awaited<ReturnType<typeof createClient>>, dayId: string) {
  const { data } = await supabase
    .from('workout_days')
    .select('workout_plans(professional_id)')
    .eq('id', dayId)
    .single()
  return (data?.workout_plans as { professional_id?: string } | null)?.professional_id ?? null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const ownerId = await getOwnerId(supabase, id)
  if (ownerId !== user.id) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name

  const { data, error } = await supabase.from('workout_days').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ day: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const ownerId = await getOwnerId(supabase, id)
  if (ownerId !== user.id) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Cascade delete — workout_exercises FK should cascade, but let's be explicit
  await supabase.from('workout_exercises').delete().eq('workout_day_id', id)
  await supabase.from('workout_days').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
