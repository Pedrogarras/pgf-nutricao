import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patient_id')
  const date = searchParams.get('date')       // YYYY-MM-DD
  const month = searchParams.get('month')     // YYYY-MM

  let query = supabase
    .from('diary_entries')
    .select('*')
    .order('logged_at', { ascending: false })
    .order('meal_time', { ascending: true })

  // Professional querying for a patient
  if (patientId) {
    // Verify ownership
    const { data: pat } = await supabase.from('patients').select('id').eq('id', patientId).eq('professional_id', user.id).single()
    if (!pat) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    query = query.eq('patient_id', patientId)
  } else {
    // Patient querying own diary
    const { data: pat } = await supabase.from('patients').select('id, professional_id').eq('auth_user_id', user.id).single()
    if (!pat) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    query = query.eq('patient_id', pat.id)
  }

  if (date) {
    query = query.eq('logged_at', date)
  } else if (month) {
    const start = `${month}-01`
    const [y, m] = month.split('-').map(Number)
    const endDate = new Date(y, m, 1)  // first day of next month
    const end = endDate.toISOString().split('T')[0]
    query = query.gte('logged_at', start).lt('logged_at', end)
  } else {
    query = query.limit(30)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Determine patient_id and professional_id
  let patientId = body.patient_id
  let professionalId: string

  if (patientId) {
    // Professional posting on behalf of patient
    const { data: pat } = await supabase.from('patients').select('id, professional_id').eq('id', patientId).eq('professional_id', user.id).single()
    if (!pat) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    professionalId = user.id
  } else {
    // Patient posting their own diary
    const { data: pat } = await supabase.from('patients').select('id, professional_id').eq('auth_user_id', user.id).single()
    if (!pat) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    patientId = pat.id
    professionalId = pat.professional_id
  }

  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      patient_id: patientId,
      professional_id: professionalId,
      logged_at: body.logged_at ?? new Date().toISOString().split('T')[0],
      meal_name: body.meal_name ?? 'Refeição',
      meal_time: body.meal_time ?? null,
      foods: body.foods ?? [],
      total_kcal: body.total_kcal ?? null,
      total_protein_g: body.total_protein_g ?? null,
      total_carbs_g: body.total_carbs_g ?? null,
      total_fat_g: body.total_fat_g ?? null,
      notes: body.notes ?? null,
      adherence_score: body.adherence_score ?? null,
      source: patientId ? (body.source ?? 'patient') : 'professional',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ entry: data })
}
