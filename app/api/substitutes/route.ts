import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, quantity_g, quantity_description, notes } = await req.json()
  if (!id || quantity_g == null) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  // Ownership check: verify the substitute belongs to a plan owned by this professional
  const { data: sub } = await supabase
    .from('meal_food_substitutes')
    .select(`
      id,
      meal_food:meal_foods(
        meal:meals(
          diet_plan:diet_plans(professional_id)
        )
      )
    `)
    .eq('id', id)
    .single()

  const professionalId = (sub?.meal_food as { meal?: { diet_plan?: { professional_id?: string } } } | null)
    ?.meal?.diet_plan?.professional_id
  if (!sub || professionalId !== user.id) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const update: Record<string, unknown> = { quantity_g, quantity_description }
  if (notes !== undefined) update.notes = notes ?? null

  const { error } = await supabase
    .from('meal_food_substitutes')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
