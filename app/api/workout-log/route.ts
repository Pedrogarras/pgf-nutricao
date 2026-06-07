import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/workout-log?from=YYYY-MM-DD&to=YYYY-MM-DD&patient_id=uuid
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const from = sp.get('from')
  const to = sp.get('to')
  const patientId = sp.get('patient_id')

  let query = supabase
    .from('workout_logs')
    .select('*')
    .order('logged_at', { ascending: false })

  // If professional is querying for a specific patient
  if (patientId) {
    // Verify professional owns this patient
    const { data: patient } = await supabase
      .from('patients').select('id').eq('id', patientId).eq('professional_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    query = query.eq('patient_id', patientId)
  } else {
    // Patient querying their own logs — find patient record
    const { data: patient } = await supabase
      .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ logs: [] })
    query = query.eq('patient_id', patient.id)
  }

  if (from) query = query.gte('logged_at', from)
  if (to)   query = query.lte('logged_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ logs: data ?? [] })
}

// POST /api/workout-log
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Find the patient record for the logged-in user
  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('workout_logs')
    .upsert(
      {
        patient_id:     patient.id,
        workout_day_id: body.workout_day_id ?? null,
        logged_at:      body.logged_at ?? new Date().toISOString().split('T')[0],
        duration_min:   body.duration_min ?? null,
        rpe:            body.rpe ?? null,
        notes:          body.notes ?? null,
      },
      { onConflict: 'patient_id,workout_day_id,logged_at' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ log: data })
}
