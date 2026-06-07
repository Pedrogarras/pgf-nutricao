import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patientId = request.nextUrl.searchParams.get('patient_id')
  if (!patientId) return NextResponse.json({ records: [] })

  const { data, error } = await supabase
    .from('anthropometric_records')
    .select('*')
    .eq('patient_id', patientId)
    .eq('professional_id', user.id)
    .order('measured_at', { ascending: false })

  if (error) return NextResponse.json({ records: [] }, { status: 500 })
  return NextResponse.json({ records: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase.from('anthropometric_records').insert({
    patient_id: body.patient_id,
    professional_id: user.id,
    measured_at: body.measured_at,
    weight_kg: body.weight_kg ?? null,
    body_fat_pct: body.body_fat_pct ?? null,
    muscle_mass_kg: body.muscle_mass_kg ?? null,
    waist_cm: body.waist_cm ?? null,
    hip_cm: body.hip_cm ?? null,
    arm_cm: body.arm_cm ?? null,
    thigh_cm: body.thigh_cm ?? null,
    calf_cm: body.calf_cm ?? null,
    adherence_pct: body.adherence_pct ?? null,
    notes: body.notes ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ record: data })
}
