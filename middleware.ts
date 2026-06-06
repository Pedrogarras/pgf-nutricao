import { NextResponse, type NextRequest } from 'next/server'

// Auth removed — app is open access
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
