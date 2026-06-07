'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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
