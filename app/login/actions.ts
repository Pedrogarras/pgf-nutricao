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
  const dob = (formData.get('date_of_birth') as string).trim() // DD/MM/AAAA

  if (!fullName || !dob) return { error: 'Preencha todos os campos.' }

  // Busca o paciente pelo nome (case-insensitive)
  const adminSupabase = await createAdminClient()
  const { data: patient } = await adminSupabase
    .from('patients')
    .select('id, full_name, date_of_birth, auth_user_id')
    .ilike('full_name', fullName)
    .eq('active', true)
    .single()

  if (!patient) return { error: 'Paciente não encontrado. Verifique o nome.' }

  // Valida a data de nascimento
  const [day, month, year] = dob.split('/')
  const dobFormatted = `${year}-${month}-${day}` // converte para YYYY-MM-DD
  if (patient.date_of_birth !== dobFormatted) {
    return { error: 'Data de nascimento incorreta.' }
  }

  // Se o aluno ainda não tem conta, cria automaticamente
  const studentEmail = nameToEmail(patient.full_name)
  const studentPassword = dob.replace(/\//g, '') // DDMMAAAA

  if (!patient.auth_user_id) {
    // Cria usuário no Supabase Auth
    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email: studentEmail,
      password: studentPassword,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: patient.full_name },
    })

    if (createError) return { error: 'Erro ao criar acesso. Contate o nutricionista.' }

    // Vincula o auth_user_id ao paciente
    await adminSupabase
      .from('patients')
      .update({ auth_user_id: newUser.user!.id })
      .eq('id', patient.id)
  }

  // Faz login como aluno
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

// Converte nome para email interno: "Ana Martins" → "ana.martins@pgf.app"
function nameToEmail(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '') + '@pgf.app'
}
