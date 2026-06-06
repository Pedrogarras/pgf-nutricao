import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: measures } = await supabase
    .from('food_measures')
    .select('id, description, grams, sort_order')
    .eq('food_id', id)
    .order('sort_order')

  return NextResponse.json({ measures: measures ?? [] })
}
