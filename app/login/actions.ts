'use server'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function loginProfessional(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'E-mail ou senha incorretos.' }

  redirect('/pro/dashboard')
}

export async function loginStudent(formData: FormData) {
  const fullName = (formData.get('full_name') as string).trim()
  const dob = (formData.get('date_of_birth') as string).trim()

  if (!fullName || !dob) return { error: 'Preencha todos os campos.' }

  const adminSupabase = await createAdminClient()
  const { data: patient } = await adminSupabase
    .from('patients')
    .select('id, full_name, date_of_birth, auth_user_id')
    .ilike('full_name', fullName)
    .eq('active', true)
    .single()

  if (!patient) return { error: 'Paciente não encontrado. Verifique o nome.' }

  const [day, month, year] = dob.split('/')
  const dobFormatted = `${year}-${month}-${day}`
  if (patient.date_of_birth !== dobFormatted) {
    return { error: 'Data de nascimento incorreta.' }
  }

  const studentEmail = nameToEmail(patient.full_name)
  const studentPassword = dob.replace(/\//g, '')

  if (!patient.auth_user_id) {
    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email: studentEmail,
      password: studentPassword,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: patient.full_name },
    })
    if (createError) return { error: 'Erro ao criar acesso. Contate o nutricionista.' }
    await adminSupabase
      .from('patients')
      .update({ auth_user_id: newUser.user!.id })
      .eq('id', patient.id)
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: studentEmail,
    password: studentPassword,
  })
  if (signInError) return { error: 'Erro ao entrar. Contate o nutricionista.' }

  redirect('/aluno')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

function nameToEmail(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '') + '@pgf.app'
}
