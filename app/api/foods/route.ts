import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json({ foods: [] })

  const supabase = await createClient()

  const { data: foods, error } = await supabase
    .from('foods')
    .select('id,name,kcal,protein_g,carbs_g,fat_g,fiber_g,portion_g,portion_description,food_group,source,source_label')
    .eq('active', true)
    .ilike('name', `%${q}%`)
    .order('source') // TACO primeiro
    .order('name')
    .limit(15)

  if (error) return NextResponse.json({ foods: [] }, { status: 500 })
  return NextResponse.json({ foods })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase.from('foods').insert({
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
    source: 'custom',
    professional_id: user.id,
    active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ food: data })
}
