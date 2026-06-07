import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth: must be a logged-in patient (aluno)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Find the patient record linked to this user
  const { data: patient } = await supabase
    .from('patients')
    .select('id, professional_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const body = await request.json()

  const { data, error } = await supabase.from('anthropometric_records').insert({
    patient_id: patient.id,
    professional_id: patient.professional_id,
    measured_at: body.measured_at ?? new Date().toISOString().split('T')[0],
    weight_kg: body.weight_kg ? Number(body.weight_kg) : null,
    body_fat_pct: body.body_fat_pct ? Number(body.body_fat_pct) : null,
    waist_cm: body.waist_cm ? Number(body.waist_cm) : null,
    hip_cm: body.hip_cm ? Number(body.hip_cm) : null,
    arm_cm: body.arm_cm ? Number(body.arm_cm) : null,
    adherence_pct: body.adherence_pct != null ? Number(body.adherence_pct) : null,
    notes: body.notes?.trim() || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ record: data })
}
