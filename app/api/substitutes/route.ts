import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { id, quantity_g, quantity_description } = await req.json()

  const { error } = await supabase
    .from('meal_food_substitutes')
    .update({ quantity_g, quantity_description })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
