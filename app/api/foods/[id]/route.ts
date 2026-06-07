import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Only allow editing custom foods owned by this professional
  const { data: existing } = await supabase
    .from('foods')
    .select('id, professional_id, source')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Alimento não encontrado' }, { status: 404 })
  if (existing.source !== 'custom' || existing.professional_id !== user.id) {
    return NextResponse.json({ error: 'Sem permissão para editar este alimento' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('foods')
    .update({
      name: body.name,
      kcal: body.kcal,
      protein_g: body.protein_g ?? 0,
      carbs_g: body.carbs_g ?? 0,
      fat_g: body.fat_g ?? 0,
      fiber_g: body.fiber_g ?? 0,
      sodium_mg: body.sodium_mg ?? 0,
      portion_g: body.portion_g ?? 100,
      portion_description: body.portion_description ?? null,
      food_group: body.food_group ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ food: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Only allow deleting custom foods owned by this professional
  const { data: existing } = await supabase
    .from('foods')
    .select('id, professional_id, source')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Alimento não encontrado' }, { status: 404 })
  if (existing.source !== 'custom' || existing.professional_id !== user.id) {
    return NextResponse.json({ error: 'Sem permissão para excluir este alimento' }, { status: 403 })
  }

  // Soft delete (set active = false) to avoid breaking existing meal plans
  const { error } = await supabase
    .from('foods')
    .update({ active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
