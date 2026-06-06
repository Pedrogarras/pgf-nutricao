import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Rotas do profissional
  if (request.nextUrl.pathname.startsWith('/pro')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Verifica se é profissional
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'professional') {
      return NextResponse.redirect(new URL('/aluno', request.url))
    }
  }

  // Rotas do aluno
  if (request.nextUrl.pathname.startsWith('/aluno')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login?tipo=aluno', request.url))
    }
  }

  // Se já logado e tentar acessar login, redireciona
  if (request.nextUrl.pathname === '/login' && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'professional') {
      return NextResponse.redirect(new URL('/pro/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/aluno', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/pro/:path*', '/aluno/:path*', '/login'],
}
