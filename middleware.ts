import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Response awal (JANGAN di-recreate di tengah jalan)
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Supabase client SSR
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          })
        },
      },
    }
  )

  // 🔥 FIX UTAMA: pakai session, bukan getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user ?? null

  const url = request.nextUrl.clone()

  // 📌 Protected routes
  const protectedPaths = [
    '/dashboard',
    '/dashboardadmin',
    '/logbook',
    '/rekapabsensi',
    '/pengajuancuti',
    '/datapegawai',
    '/survei',
    '/nilaiperilaku',
    '/raporkinerja',
    '/rekaplemburadmin',
    '/approvallembur',
    '/approvalcuti',
  ]

 const isProtected = protectedPaths.some((path) =>
  url.pathname === path || url.pathname.startsWith(path + '/')
)

  // 🚫 BELUM LOGIN → REDIRECT
  if (isProtected && !user) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ==============================
  // 🔥 ROLE CHECK (TIDAK DIUBAH LOGICNYA)
  // ==============================
  let role: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    role = profile?.role ?? null
  }

  const adminRoles = ['admin', 'kepala_kantor', 'kasubbag']
  const userRoles = ['pegawai', 'mahasiswa']

  const isAdmin = adminRoles.includes(role || '')
  const isUser = userRoles.includes(role || '')

  // ==============================
  // 🔁 REDIRECT SETELAH LOGIN
  // ==============================
  if (url.pathname === '/login' && user) {
    if (isAdmin) {
      url.pathname = '/dashboardadmin'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}