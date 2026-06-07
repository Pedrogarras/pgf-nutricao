import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patientId = request.nextUrl.searchParams.get('patient_id')
  if (!patientId) return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('lab_results')
    .select('*')
    .eq('patient_id', patientId)
    .eq('professional_id', user.id)
    .order('date', { ascending: false })
    .order('panel_name', { ascending: true })
    .order('exam_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ results: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { patient_id, date, panel_name, exam_name, value, unit, reference_min, reference_max, notes } = body

  if (!patient_id || !exam_name) {
    return NextResponse.json({ error: 'patient_id e exam_name obrigatórios' }, { status: 400 })
  }

  // Verify this patient belongs to the professional
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patient_id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  // Auto-compute status
  let status: string | null = null
  if (value != null && (reference_min != null || reference_max != null)) {
    const v = Number(value)
    const rMin = reference_min != null ? Number(reference_min) : null
    const rMax = reference_max != null ? Number(reference_max) : null
    if (rMin != null && v < rMin * 0.8) status = 'critico_baixo'
    else if (rMax != null && v > rMax * 1.2) status = 'critico_alto'
    else if (rMin != null && v < rMin) status = 'baixo'
    else if (rMax != null && v > rMax) status = 'alto'
    else status = 'normal'
  }

  const records = Array.isArray(body.records) ? body.records : [{
    patient_id,
    professional_id: user.id,
    date: date || new Date().toISOString().split('T')[0],
    panel_name: panel_name || null,
    exam_name,
    value: value != null ? Number(value) : null,
    unit: unit || null,
    reference_min: reference_min != null ? Number(reference_min) : null,
    reference_max: reference_max != null ? Number(reference_max) : null,
    status,
    notes: notes || null,
  }]

  // If bulk insert
  if (Array.isArray(body.records)) {
    const rows = body.records.map((r: Record<string, unknown>) => {
      const v2 = r.value != null ? Number(r.value) : null
      const rMin2 = r.reference_min != null ? Number(r.reference_min) : null
      const rMax2 = r.reference_max != null ? Number(r.reference_max) : null
      let s: string | null = null
      if (v2 != null && (rMin2 != null || rMax2 != null)) {
        if (rMin2 != null && v2 < rMin2 * 0.8) s = 'critico_baixo'
        else if (rMax2 != null && v2 > rMax2 * 1.2) s = 'critico_alto'
        else if (rMin2 != null && v2 < rMin2) s = 'baixo'
        else if (rMax2 != null && v2 > rMax2) s = 'alto'
        else s = 'normal'
      }
      return {
        patient_id,
        professional_id: user.id,
        date: body.date || new Date().toISOString().split('T')[0],
        panel_name: body.panel_name || null,
        exam_name: r.exam_name,
        value: v2,
        unit: r.unit || null,
        reference_min: rMin2,
        reference_max: rMax2,
        status: s,
        notes: r.notes || null,
      }
    })
    const { data, error } = await supabase.from('lab_results').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ results: data }, { status: 201 })
  }

  const { data, error } = await supabase.from('lab_results').insert(records).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ result: data }, { status: 201 })
}
