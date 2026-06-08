'use server'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Generate a readable temporary password like "Ana@202447"
function generatePassword(name: string): string {
  const firstName = name.split(' ')[0] ?? 'Paciente'
  const year = new Date().getFullYear()
  const suffix = Math.floor(10 + Math.random() * 90) // 2-digit number
  return `${firstName}@${year}${suffix}`
}

export async function createPatient(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado.' }
  const PROF_ID = user.id

  const fullName = (formData.get('full_name') as string).trim()
  const dob = formData.get('date_of_birth') as string
  const emailRaw = ((formData.get('email') as string) || '').trim().toLowerCase()

  if (!fullName) return { error: 'Nome é obrigatório.' }
  if (!dob) return { error: 'Data de nascimento é obrigatória.' }

  const { data: newPatient, error } = await supabase.from('patients').insert({
    professional_id: PROF_ID,
    full_name: fullName,
    date_of_birth: dob,
    email: emailRaw || null,
    phone: (formData.get('phone') as string) || null,
    gender: (formData.get('gender') as string) || null,
    weight_kg: formData.get('weight_kg') ? Number(formData.get('weight_kg')) : null,
    height_cm: formData.get('height_cm') ? Number(formData.get('height_cm')) : null,
    goal: (formData.get('goal') as string) || null,
    activity_level: (formData.get('activity_level') as string) || 'levemente_ativo',
    notes: (formData.get('notes') as string) || null,
    active: true,
  }).select('id').single()

  if (error || !newPatient) return { error: 'Erro ao cadastrar: ' + (error?.message ?? 'desconhecido') }

  // If email provided, auto-create auth account so patient can log in immediately
  if (emailRaw) {
    const password = generatePassword(fullName)
    const adminClient = createAdminClient()
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: emailRaw,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'student' },
    })

    if (!authError && authData?.user) {
      await supabase
        .from('patients')
        .update({ auth_user_id: authData.user.id })
        .eq('id', newPatient.id)

      revalidatePath('/pro/pacientes')
      return { ok: true, credentials: { email: emailRaw, password, patientId: newPatient.id } }
    }
    // Auth creation failed silently — patient still registered, just no login yet
  }

  revalidatePath('/pro/pacientes')
  return { ok: true, patientId: newPatient.id }
}
