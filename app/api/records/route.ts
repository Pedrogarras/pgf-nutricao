import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Metric name → measurement field
const METRIC_TO_FIELD: Record<string, string> = {
  peso:     'weight_kg',
  gordura:  'body_fat_pct',
  massa:    'muscle_mass_kg',
  cintura:  'waist_cm',
  quadril:  'hip_cm',
  braco:    'arm_cm',
  coxa:     'thigh_cm',
}

/** After saving a record, update current_value on matching active patient goals. */
async function syncGoalsFromRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  record: Record<string, number | null | string>,
  heightCm?: number | null,
) {
  const { data: goals } = await supabase
    .from('patient_goals')
    .select('id, metric, direction, target_value')
    .eq('patient_id', patientId)
    .eq('achieved', false)

  if (!goals?.length) return

  for (const goal of goals) {
    const metric = (goal.metric ?? '').toLowerCase()
    let newValue: number | null = null

    if (METRIC_TO_FIELD[metric]) {
      const val = record[METRIC_TO_FIELD[metric]]
      newValue = typeof val === 'number' ? val : null
    } else if (metric === 'imc') {
      const w = record['weight_kg']
      const h = heightCm
      if (typeof w === 'number' && h) {
        newValue = Math.round((w / ((h / 100) ** 2)) * 10) / 10
      }
    }

    if (newValue !== null) {
      const target = goal.target_value
      const achieved =
        target != null && (
          goal.direction === 'decrease' ? newValue <= target : newValue >= target
        )

      await supabase
        .from('patient_goals')
        .update({
          current_value: newValue,
          ...(achieved ? { achieved: true, achieved_at: new Date().toISOString() } : {}),
        })
        .eq('id', goal.id)
    }
  }
}

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

  // Verify the patient belongs to this professional
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', body.patient_id)
    .eq('professional_id', user.id)
    .single()
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

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

  // Auto-sync active goals current_value
  const { data: patientInfo } = await supabase.from('patients').select('height_cm').eq('id', body.patient_id).single()
  await syncGoalsFromRecord(supabase, body.patient_id, data as Record<string, number | null | string>, patientInfo?.height_cm)

  return NextResponse.json({ record: data })
}
