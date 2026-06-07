import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patientId = request.nextUrl.searchParams.get('patient_id')

  // Could be professional or patient calling
  let query = supabase
    .from('supplement_prescriptions')
    .select('*')
    .order('timing')
    .order('name')

  if (patientId) {
    // Professional fetching for a specific patient
    query = query.eq('patient_id', patientId).eq('professional_id', user.id)
  } else {
    // Patient fetching their own (RLS handles it via patient auth_user_id)
    // We need to find the patient record for this user
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    if (!patient) return NextResponse.json({ supplements: [] })
    query = query.eq('patient_id', patient.id)
  }

  const { data } = await query
  return NextResponse.json({ supplements: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Verify patient ownership
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', body.patient_id)
    .eq('professional_id', user.id)
    .single()
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('supplement_prescriptions')
    .insert({
      patient_id: body.patient_id,
      professional_id: user.id,
      name: body.name,
      brand: body.brand ?? null,
      dosage: body.dosage,
      timing: body.timing ?? 'qualquer_hora',
      with_food: body.with_food ?? false,
      instructions: body.instructions ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ supplement: data })
}
