import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patientId = request.nextUrl.searchParams.get('patient_id')
  if (!patientId) return NextResponse.json({ notes: [] })

  const { data } = await supabase
    .from('patient_notes')
    .select('*')
    .eq('patient_id', patientId)
    .eq('professional_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  return NextResponse.json({ notes: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Verify patient ownership
  const { data: patient } = await supabase
    .from('patients').select('id').eq('id', body.patient_id).eq('professional_id', user.id).single()
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('patient_notes')
    .insert({
      patient_id: body.patient_id,
      professional_id: user.id,
      date: body.date ?? new Date().toISOString().split('T')[0],
      category: body.category ?? 'geral',
      title: body.title ?? null,
      content: body.content,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ note: data })
}
