import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ exercises: [] })

  const { data } = await supabase.from('exercises').select('*').eq('professional_id', user.id).eq('active', true).order('created_at', { ascending: false })
  return NextResponse.json({ exercises: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase.from('exercises').insert({
    professional_id: user.id,
    name: body.name,
    muscle_group: body.muscle_group || null,
    description: body.description || null,
    video_url: body.video_url || null,
    active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ exercise: data })
}
