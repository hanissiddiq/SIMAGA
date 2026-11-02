import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // Cek tipe link (signup, recovery, magiclink, dll)
  const type = searchParams.get('type')
  
  // Default tujuan (jika tidak ada instruksi khusus)
  let next = searchParams.get('next') ?? '/dashboard'

  // FIX PATEN: Jika tipe-nya 'recovery' (Lupa Password), PAKSA ke halaman reset
  if (type === 'recovery') {
    next = '/reset-password'
  }

  if (code) {
    // PENTING: Gunakan await cookies() untuk Next.js 15+
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    
    // Tukar kode verifikasi dengan session login yang valid
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Redirect ke tujuan yang sudah ditentukan di atas (Reset Password atau Dashboard)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Jika kode salah atau error, kembalikan ke halaman login dengan pesan error
  return NextResponse.redirect(`${origin}/login?error=AuthCallbackError`)
}