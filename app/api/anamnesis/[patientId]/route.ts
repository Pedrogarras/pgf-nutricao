import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function verifyPatient(supabase: Awaited<ReturnType<typeof createClient>>, patientId: string, userId: string) {
  const { data } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('professional_id', userId)
    .single()
  return !!data
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { patientId } = await params
  const ok = await verifyPatient(supabase, patientId, user.id)
  if (!ok) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { data } = await supabase
    .from('patient_anamnesis')
    .select('*')
    .eq('patient_id', patientId)
    .eq('professional_id', user.id)
    .maybeSingle()

  return NextResponse.json({ anamnesis: data })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { patientId } = await params
  const ok = await verifyPatient(supabase, patientId, user.id)
  if (!ok) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('patient_anamnesis')
    .insert({ ...body, patient_id: patientId, professional_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ anamnesis: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { patientId } = await params
  const ok = await verifyPatient(supabase, patientId, user.id)
  if (!ok) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('patient_anamnesis')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('patient_id', patientId)
    .eq('professional_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ anamnesis: data })
}
