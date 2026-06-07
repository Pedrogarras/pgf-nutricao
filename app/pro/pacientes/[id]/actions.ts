'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createDietPlan(patientId: string, title: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: plan, error } = await supabase
    .from('diet_plans')
    .insert({
      patient_id: patientId,
      professional_id: user.id,
      title: title.trim() || 'Novo Plano',
      active: false,
    })
    .select('id')
    .single()

  if (error || !plan) return { error: error?.message ?? 'Erro ao criar plano' }

  revalidatePath(`/pro/pacientes/${patientId}`)
  redirect(`/pro/pacientes/${patientId}/dieta?plan=${plan.id}`)
}

export async function deleteDietPlan(planId: string, patientId: string) {
  const supabase = await createClient()
  await supabase.from('diet_plans').delete().eq('id', planId)
  revalidatePath(`/pro/pacientes/${patientId}`)
}

export async function renameDietPlan(planId: string, title: string, patientId: string) {
  const supabase = await createClient()
  await supabase.from('diet_plans').update({ title: title.trim() }).eq('id', planId)
  revalidatePath(`/pro/pacientes/${patientId}`)
}

export async function togglePlanActive(planId: string, active: boolean, patientId: string) {
  const supabase = await createClient()
  await supabase.from('diet_plans').update({ active }).eq('id', planId)
  revalidatePath(`/pro/pacientes/${patientId}`)
}
