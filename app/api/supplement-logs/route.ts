import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/supplement-logs?date=YYYY-MM-DD&patient_id=...
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const patientIdParam = searchParams.get('patient_id')
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  let patientId: string | null = null

  if (patientIdParam) {
    const { data: patient } = await supabase
      .from('patients').select('id').eq('id', patientIdParam).eq('professional_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    patientId = patientIdParam
  } else {
    const { data: patient } = await supabase
      .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ logs: [] })
    patientId = patient.id
  }

  let query = supabase
    .from('supplement_logs')
    .select('id, supplement_id, logged_date, taken, notes')
    .eq('patient_id', patientId)

  if (fromParam && toParam) {
    query = query.gte('logged_date', fromParam).lte('logged_date', toParam)
  } else {
    query = query.eq('logged_date', dateParam)
  }

  const { data, error } = await query.order('logged_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ logs: data ?? [] })
}

// POST /api/supplement-logs — upsert a single log entry
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('supplement_logs')
    .upsert({
      patient_id: patient.id,
      supplement_id: body.supplement_id,
      logged_date: body.logged_date ?? new Date().toISOString().split('T')[0],
      taken: body.taken ?? true,
      notes: body.notes ?? null,
    }, { onConflict: 'patient_id,supplement_id,logged_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ log: data })
}

// DELETE /api/supplement-logs — remove a check for today
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: patient } = await supabase
    .from('patients').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { error } = await supabase
    .from('supplement_logs')
    .delete()
    .eq('patient_id', patient.id)
    .eq('supplement_id', body.supplement_id)
    .eq('logged_date', body.logged_date ?? new Date().toISOString().split('T')[0])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
