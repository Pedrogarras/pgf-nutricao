import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  // Determine patient_id
  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).single()
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { data } = await supabase
    .from('water_intake')
    .select('*')
    .eq('patient_id', patient.id)
    .eq('date', date)
    .single()

  return NextResponse.json({ water: data ?? { patient_id: patient.id, date, amount_ml: 0, goal_ml: 2000 } })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const date = body.date ?? new Date().toISOString().split('T')[0]

  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).single()
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  // Upsert (insert or update)
  const { data, error } = await supabase
    .from('water_intake')
    .upsert({
      patient_id: patient.id,
      date,
      amount_ml: body.amount_ml,
      goal_ml: body.goal_ml ?? 2000,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'patient_id,date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ water: data })
}
