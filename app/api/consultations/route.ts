import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const month = request.nextUrl.searchParams.get('month') // YYYY-MM
  let query = supabase
    .from('consultations')
    .select('*, patient:patients(id, full_name)')
    .eq('professional_id', user.id)
    .order('scheduled_at')

  if (month) {
    const start = `${month}-01T00:00:00`
    const [year, m] = month.split('-').map(Number)
    const nextMonth = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`
    const end = `${nextMonth}-01T00:00:00`
    query = query.gte('scheduled_at', start).lt('scheduled_at', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ consultations: [] }, { status: 500 })
  return NextResponse.json({ consultations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  // Verify patient ownership if patient_id provided
  if (body.patient_id) {
    const { data: patient } = await supabase.from('patients').select('id').eq('id', body.patient_id).eq('professional_id', user.id).single()
    if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('consultations')
    .insert({
      professional_id: user.id,
      patient_id: body.patient_id || null,
      scheduled_at: body.scheduled_at,
      duration_min: body.duration_min ? Number(body.duration_min) : 60,
      type: body.type || 'presencial',
      status: body.status || 'agendado',
      notes: body.notes || null,
    })
    .select('*, patient:patients(id, full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ consultation: data })
}
