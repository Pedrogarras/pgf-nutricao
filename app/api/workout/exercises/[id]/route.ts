import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
