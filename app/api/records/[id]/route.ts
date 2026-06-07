import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const METRIC_TO_FIELD: Record<string, string> = {
  peso: 'weight_kg', gordura: 'body_fat_pct', massa: 'muscle_mass_kg',
  cintura: 'waist_cm', quadril: 'hip_cm', braco: 'arm_cm', coxa: 'thigh_cm',
}

async function syncGoalsFromRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  record: Record<string, number | null | string>,
  heightCm?: number | null,
) {
  const { data: goals } = await supabase
    .from('patient_goals').select('id, metric').eq('patient_id', patientId).eq('achieved', false)
  if (!goals?.length) return
  for (const goal of goals) {
    const metric = (goal.metric ?? '').toLowerCase()
    let newValue: number | null = null
    if (METRIC_TO_FIELD[metric]) {
      const val = record[METRIC_TO_FIELD[metric]]
      newValue = typeof val === 'number' ? val : null
    } else if (metric === 'imc') {
      const w = record['weight_kg'], h = heightCm
      if (typeof w === 'number' && h) newValue = Math.round((w / ((h / 100) ** 2)) * 10) / 10
    }
    if (newValue !== null) await supabase.from('patient_goals').update({ current_value: newValue }).eq('id', goal.id)
  }
}

async function verifyOwnership(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data: record } = await supabase
    .from('anthropometric_records')
    .select('professional_id, patient_id')
    .eq('id', id)
    .single()
  return record?.professional_id === userId ? record : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const record = await verifyOwnership(supabase, id, user.id)
  if (!record) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  const fields = ['measured_at', 'weight_kg', 'body_fat_pct', 'muscle_mass_kg', 'waist_cm', 'hip_cm', 'arm_cm', 'thigh_cm', 'calf_cm', 'adherence_pct', 'notes']
  for (const f of fields) {
    if (f in body) update[f] = body[f] ?? null
  }

  const { data, error } = await supabase
    .from('anthropometric_records')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-sync active goals current_value
  const { data: patientInfo } = await supabase
    .from('patients').select('height_cm').eq('id', record.patient_id).single()
  await syncGoalsFromRecord(supabase, record.patient_id as string, data as Record<string, number | null | string>, patientInfo?.height_cm)

  return NextResponse.json({ record: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const record = await verifyOwnership(supabase, id, user.id)
  if (!record) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await supabase.from('anthropometric_records').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
