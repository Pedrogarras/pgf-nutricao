import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patientId = new URL(request.url).searchParams.get('patient_id')
  if (!patientId) return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })

  const { data: pat } = await supabase.from('patients').select('id').eq('id', patientId).eq('professional_id', user.id).single()
  if (!pat) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { data } = await supabase
    .from('patient_goals')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at')

  return NextResponse.json({ goals: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { data: pat } = await supabase.from('patients').select('id').eq('id', body.patient_id).eq('professional_id', user.id).single()
  if (!pat) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('patient_goals')
    .insert({ ...body, professional_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ goal: data })
}
