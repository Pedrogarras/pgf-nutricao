import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  // Verify ownership before deleting
  const { data: record } = await supabase
    .from('anthropometric_records')
    .select('professional_id')
    .eq('id', id)
    .single()

  if (!record || record.professional_id !== user.id) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  await supabase.from('anthropometric_records').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
