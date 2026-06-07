import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReceitasClient from './ReceitasClient'

export default async function AlunoReceitasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?tipo=aluno')

  const { data: patient } = await supabase
    .from('patients')
    .select('id, professional_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!patient) redirect('/aluno')

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, category, description, yield_portions, yield_g_per_portion, kcal_per_portion, protein_g_per_portion, carbs_g_per_portion, fat_g_per_portion, fiber_g_per_portion, instructions, ingredients')
    .eq('professional_id', patient.professional_id)
    .order('category')
    .order('name')

  return <ReceitasClient recipes={recipes ?? []} />
}
