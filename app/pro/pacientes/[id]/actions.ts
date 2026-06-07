'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function updatePatient(
  patientId: string,
  data: {
    full_name?: string; weight_kg?: number | null; height_cm?: number | null
    goal?: string | null; activity_level?: string | null
    phone?: string | null; email?: string | null; notes?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { error } = await supabase
    .from('patients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', patientId)
    .eq('professional_id', user.id)
  if (error) return { error: error.message }
  revalidatePath(`/pro/pacientes/${patientId}`)
  return { ok: true }
}

export async function duplicateDietPlan(sourcePlanId: string, patientId: string, newTitle: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Load the source plan with all meals, foods, and substitutes
  const { data: source } = await supabase
    .from('diet_plans')
    .select(`
      kcal_goal, protein_goal_g, carbs_goal_g, fat_goal_g, notes, anamnesis,
      meals(id, name, time_start, emoji, sort_order, notes,
        meal_foods(id, food_id, quantity_g, quantity_description, sort_order,
          meal_food_substitutes(food_id, quantity_g, quantity_description, sort_order)
        )
      )
    `)
    .eq('id', sourcePlanId)
    .eq('professional_id', user.id)
    .single()

  if (!source) return { error: 'Plano não encontrado' }

  // Create the new plan
  const { data: newPlan, error: planErr } = await supabase
    .from('diet_plans')
    .insert({
      patient_id: patientId,
      professional_id: user.id,
      title: newTitle.trim() || `Cópia — ${newTitle}`,
      active: false,
      kcal_goal: source.kcal_goal,
      protein_goal_g: source.protein_goal_g,
      carbs_goal_g: source.carbs_goal_g,
      fat_goal_g: source.fat_goal_g,
      notes: source.notes,
      anamnesis: source.anamnesis,
    })
    .select('id')
    .single()

  if (planErr || !newPlan) return { error: planErr?.message ?? 'Erro ao duplicar' }

  // Duplicate meals
  const meals = (source.meals as { id: string; name: string; time_start: string | null; emoji: string; sort_order: number; notes: string | null; meal_foods: { id: string; food_id: string; quantity_g: number; quantity_description: string | null; sort_order: number; meal_food_substitutes: { food_id: string; quantity_g: number; quantity_description: string | null; sort_order: number }[] }[] }[]) ?? []
  for (const meal of meals) {
    const { data: newMeal } = await supabase
      .from('meals')
      .insert({ diet_plan_id: newPlan.id, name: meal.name, time_start: meal.time_start, emoji: meal.emoji, sort_order: meal.sort_order, notes: meal.notes })
      .select('id')
      .single()
    if (!newMeal) continue

    for (const mf of meal.meal_foods ?? []) {
      const { data: newMf } = await supabase
        .from('meal_foods')
        .insert({ meal_id: newMeal.id, food_id: mf.food_id, quantity_g: mf.quantity_g, quantity_description: mf.quantity_description, sort_order: mf.sort_order })
        .select('id')
        .single()
      if (!newMf) continue

      for (const sub of mf.meal_food_substitutes ?? []) {
        await supabase.from('meal_food_substitutes').insert({
          meal_food_id: newMf.id,
          food_id: sub.food_id,
          quantity_g: sub.quantity_g,
          quantity_description: sub.quantity_description,
          sort_order: sub.sort_order,
        })
      }
    }
  }

  revalidatePath(`/pro/pacientes/${patientId}`)
  redirect(`/pro/pacientes/${patientId}/dieta?plan=${newPlan.id}`)
}

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  // Verify professional owns this plan before deleting
  await supabase.from('diet_plans').delete().eq('id', planId).eq('professional_id', user.id)
  revalidatePath(`/pro/pacientes/${patientId}`)
}

export async function renameDietPlan(planId: string, title: string, patientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  await supabase.from('diet_plans').update({ title: title.trim() }).eq('id', planId).eq('professional_id', user.id)
  revalidatePath(`/pro/pacientes/${patientId}`)
}

export async function togglePlanActive(planId: string, active: boolean, patientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  await supabase.from('diet_plans').update({ active }).eq('id', planId).eq('professional_id', user.id)
  revalidatePath(`/pro/pacientes/${patientId}`)
}

// ─── PATIENT ACCOUNT MANAGEMENT ───────────────────────────────────────────────

export async function createPatientAccount(patientId: string, email: string, password: string) {
  // Only the professional who owns the patient can do this
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: patient } = await supabase
    .from('patients')
    .select('id, full_name, auth_user_id')
    .eq('id', patientId)
    .eq('professional_id', user.id)
    .single()

  if (!patient) return { error: 'Paciente não encontrado' }
  if (patient.auth_user_id) return { error: 'Este paciente já possui acesso' }

  // Create the auth user with admin privileges
  const adminClient = await createAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: patient.full_name, role: 'aluno' },
  })

  if (authError || !authData?.user) {
    return { error: authError?.message ?? 'Erro ao criar usuário' }
  }

  // Link the auth user to the patient record and set the email
  const { error: updateError } = await supabase
    .from('patients')
    .update({ auth_user_id: authData.user.id, email: email.trim().toLowerCase() })
    .eq('id', patientId)

  if (updateError) {
    // Rollback: delete the auth user we just created
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: updateError.message }
  }

  revalidatePath(`/pro/pacientes/${patientId}`)
  return { ok: true, email: email.trim().toLowerCase() }
}

export async function updatePatientPassword(patientId: string, newPassword: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: patient } = await supabase
    .from('patients')
    .select('auth_user_id')
    .eq('id', patientId)
    .eq('professional_id', user.id)
    .single()

  if (!patient?.auth_user_id) return { error: 'Paciente sem conta vinculada' }

  const adminClient = await createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(patient.auth_user_id, {
    password: newPassword,
  })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function revokePatientAccess(patientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: patient } = await supabase
    .from('patients')
    .select('auth_user_id')
    .eq('id', patientId)
    .eq('professional_id', user.id)
    .single()

  if (!patient?.auth_user_id) return { error: 'Paciente sem conta' }

  const adminClient = await createAdminClient()
  await adminClient.auth.admin.deleteUser(patient.auth_user_id)

  await supabase
    .from('patients')
    .update({ auth_user_id: null })
    .eq('id', patientId)

  revalidatePath(`/pro/pacientes/${patientId}`)
  return { ok: true }
}
