import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DietEditor from './DietEditor'

export default async function DietaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ plan?: string }>
}) {
  const { id } = await params
  const { plan: planId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('professional_id', user.id)
    .single()

  if (!patient) notFound()

  // Busca plano específico se ?plan=ID passado; caso contrário pega o ativo mais recente
  let plan = null

  if (planId) {
    const { data } = await supabase
      .from('diet_plans')
      .select(`*, meals(*, meal_foods(*, food:foods(*), substitutes:meal_food_substitutes(*, food:foods(*))))`)
      .eq('id', planId)
      .eq('patient_id', id) // garantia: plano pertence a este paciente
      .single()
    plan = data
  }

  if (!plan) {
    const { data } = await supabase
      .from('diet_plans')
      .select(`*, meals(*, meal_foods(*, food:foods(*), substitutes:meal_food_substitutes(*, food:foods(*))))`)
      .eq('patient_id', id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    plan = data
  }

  // Se não há nenhum plano, redireciona para o hub do paciente para criar um com nome
  if (!plan) {
    redirect(`/pro/pacientes/${id}`)
  }

  // Ordena refeições e alimentos
  if (plan?.meals) {
    plan.meals.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    plan.meals.forEach((m: { meal_foods: { sort_order: number; substitutes?: { sort_order: number }[] }[] }) => {
      m.meal_foods?.sort((a, b) => a.sort_order - b.sort_order)
      m.meal_foods?.forEach(mf => mf.substitutes?.sort((a, b) => a.sort_order - b.sort_order))
    })
  }

  return <DietEditor patient={patient} plan={plan} professionalId={user.id} />
}
