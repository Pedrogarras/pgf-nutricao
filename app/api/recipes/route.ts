import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('professional_id', user.id)
    .eq('active', true)
    .order('name')

  if (error) return NextResponse.json({ recipes: [] }, { status: 500 })
  return NextResponse.json({ recipes: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      professional_id: user.id,
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
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ recipe: data })
}
