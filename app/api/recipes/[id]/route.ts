import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase.from('recipes').select('professional_id').eq('id', id).single()
  return data?.professional_id === userId ? data : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const owned = await verifyOwner(supabase, id, user.id)
  if (!owned) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('recipes')
    .update({
      name: body.name,
      category: body.category || null,
      description: body.description || null,
      yield_portions: body.yield_portions ? Number(body.yield_portions) : 1,
      yield_g_per_portion: body.yield_g_per_portion ? Number(body.yield_g_per_portion) : null,
      kcal_per_portion: body.kcal_per_portion ? Number(body.kcal_per_portion) : null,
      protein_g_per_portion: body.protein_g_per_portion ? Number(body.protein_g_per_portion) : null,
      carbs_g_per_portion: body.carbs_g_per_portion ? Number(body.carbs_g_per_portion) : null,
      fat_g_per_portion: body.fat_g_per_portion ? Number(body.fat_g_per_portion) : null,
      fiber_g_per_portion: body.fiber_g_per_portion ? Number(body.fiber_g_per_portion) : null,
      instructions: body.instructions || null,
      ingredients: body.ingredients ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ recipe: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const owned = await verifyOwner(supabase, id, user.id)
  if (!owned) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await supabase.from('recipes').update({ active: false }).eq('id', id)
  return NextResponse.json({ ok: true })
}
