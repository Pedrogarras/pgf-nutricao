import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const allowed = ['date', 'panel_name', 'exam_name', 'value', 'unit', 'reference_min', 'reference_max', 'notes']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in body) update[k] = body[k] ?? null

  // Recompute status if value or reference changed
  const { data: existing } = await supabase
    .from('lab_results')
    .select('value, reference_min, reference_max')
    .eq('id', params.id)
    .eq('professional_id', user.id)
    .single()

  if (existing) {
    const v = update.value != null ? Number(update.value) : (existing.value != null ? Number(existing.value) : null)
    const rMin = update.reference_min != null ? Number(update.reference_min) : (existing.reference_min != null ? Number(existing.reference_min) : null)
    const rMax = update.reference_max != null ? Number(update.reference_max) : (existing.reference_max != null ? Number(existing.reference_max) : null)
    if (v != null && (rMin != null || rMax != null)) {
      if (rMin != null && v < rMin * 0.8) update.status = 'critico_baixo'
      else if (rMax != null && v > rMax * 1.2) update.status = 'critico_alto'
      else if (rMin != null && v < rMin) update.status = 'baixo'
      else if (rMax != null && v > rMax) update.status = 'alto'
      else update.status = 'normal'
    }
  }

  const { data, error } = await supabase
    .from('lab_results')
    .update(update)
    .eq('id', params.id)
    .eq('professional_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ result: data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('lab_results')
    .delete()
    .eq('id', params.id)
    .eq('professional_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
