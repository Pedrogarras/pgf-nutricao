import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

function nameToEmail(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '') + '@pgf.app'
}

export async function POST(request: NextRequest) {
  const { full_name, date_of_birth } = await request.json()

  if (!full_name || !date_of_birth) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 })
  }

  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  // Admin client to look up patient
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  const { data: patient } = await adminSupabase
    .from('patients')
    .select('id, full_name, date_of_birth, auth_user_id')
    .ilike('full_name', full_name.trim())
    .eq('active', true)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Paciente não encontrado. Verifique o nome.' }, { status: 404 })
  }

  const [day, month, year] = date_of_birth.split('/')
  const dobFormatted = `${year}-${month}-${day}`
  if (patient.date_of_birth !== dobFormatted) {
    return NextResponse.json({ error: 'Data de nascimento incorreta.' }, { status: 401 })
  }

  const studentEmail = nameToEmail(patient.full_name)
  const studentPassword = date_of_birth.replace(/\//g, '')

  if (!patient.auth_user_id) {
    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email: studentEmail,
      password: studentPassword,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: patient.full_name },
    })
    if (createError) {
      return NextResponse.json({ error: 'Erro ao criar acesso. Contate o nutricionista.' }, { status: 500 })
    }
    await adminSupabase
      .from('patients')
      .update({ auth_user_id: newUser.user!.id })
      .eq('id', patient.id)
  }

  // Now sign in with a normal client and collect cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(c => cookiesToSet.push(c))
        },
      },
    }
  )

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: studentEmail,
    password: studentPassword,
  })

  if (signInError) {
    return NextResponse.json({ error: 'Erro ao entrar. Contate o nutricionista.' }, { status: 500 })
  }

  const response = NextResponse.json({ redirectTo: '/aluno' })
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })
  return response
}
