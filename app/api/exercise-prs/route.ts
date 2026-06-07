import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/exercise-prs
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const patientIdParam = searchParams.get('patient_id')

  let patientId: string | null = null

  if (patientIdParam) {
    // Professional requesting a specific patient's PRs
    const { data: patient } = await supabase
      .from('patients').select('id').eq('id', patientIdParam).eq('professional_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    patientId = patientIdParam
  } else {
    // Patient requesting own PRs
    const { data: patient } = await supabase
      .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ prs: [] })
    patientId = patient.id
  }

  const { data, error } = await supabase
    .from('exercise_personal_records')
    .select('*')
    .eq('patient_id', patientId)
    .order('achieved_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ prs: data ?? [] })
}

// POST /api/exercise-prs
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('exercise_personal_records')
    .insert({
      patient_id: patient.id,
      exercise_name: body.exercise_name,
      exercise_id: body.exercise_id ?? null,
      metric: body.metric,
      value: body.value,
      unit_label: body.unit_label ?? null,
      notes: body.notes ?? null,
      achieved_at: body.achieved_at ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ pr: data })
}
