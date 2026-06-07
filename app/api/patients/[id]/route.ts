import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, email, phone, weight_kg, height_cm, goal, date_of_birth, gender')
    .eq('id', params.id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json({ patient })
}
