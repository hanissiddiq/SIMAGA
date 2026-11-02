'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr' // <-- GANTI INI: Pakai library SSR biar Cookie terbaca Server
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react' // Import ikon mata

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  
  // State untuk toggle password visibility
  const [showPassword, setShowPassword] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  // --- INISIALISASI SUPABASE KHUSUS BROWSER (COOKIE SUPPORT) ---
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Ambil query redirect jika ada
  useEffect(() => {
    const redirected = searchParams.get('redirectedFrom')
    if (redirected) {
      console.log('[DEBUG] Redirected from query:', redirected)
      setRedirectTo(redirected)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (!email.trim() || !password)
        throw new Error('Email dan password wajib diisi.')

      console.log('[DEBUG] Attempting login with email:', email)

      // 1. Login ke Supabase (Sekarang ini otomatis set COOKIE, bukan cuma LocalStorage)
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) throw signInError
      if (!data?.session) throw new Error('Pastikan email sudah terverifikasi.')

      console.log('[DEBUG] Login successful. Session created via Cookie.')

      // 2. REFRESH ROUTER (WAJIB UTAMA!)
      // Ini memberitahu Server Vercel: "Hei, Cookie user ini baru diupdate, tolong baca ulang!"
      router.refresh()
      
      // 3. Jeda waktu agar Cookie "matang" dan tersimpan di browser
      await new Promise(resolve => setTimeout(resolve, 1000))

      const userId = data.user.id
      console.log('[DEBUG] User ID:', userId)

      // 4. Ambil profile dari tabel profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role, position, is_admin')
        .eq('id', userId)
        .single()

      if (profileError) {
        // Fallback jika profile belum ada (misal baru register)
        console.warn('Profile not found, proceeding as standard user')
      }

      console.log('[DEBUG] Profile from DB:', profile)

      // --- LOGIKA ADMIN ---
      const isAdmin =
        profile?.is_admin === true || 
        profile?.is_admin === 'true' || 
        profile?.role === 'kasubbag' || 
        profile?.role === 'kepala_kantor' ||
        profile?.role === 'admin'

      // 5. Redirect dengan REPLACE (Agar user tidak bisa Back ke login)
      if (isAdmin) {
        console.log('[DEBUG] Redirecting to /dashboardadmin (admin)')
        router.replace('/dashboardadmin')
      } else {
        if (redirectTo) {
          console.log('[DEBUG] Redirecting to query redirect:', redirectTo)
          router.replace(redirectTo)
        } else {
          console.log('[DEBUG] Redirecting to /dashboard (pegawai biasa)')
          router.replace('/dashboard')
        }
      }
    } catch (err: any) {
      console.error('[DEBUG] Login error:', err)
      setError(err.message === 'Invalid login credentials' 
        ? 'Email atau password salah.' 
        : err.message || 'Terjadi kesalahan saat login.')
      setLoading(false) // Stop loading hanya jika error
    } 
    // Jika sukses, biarkan loading tetap true (berputar) sampai halaman benar-benar pindah
  }

  const handleForgotPassword = async () => {
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('Masukkan email terlebih dahulu untuk reset password.')
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Menggunakan window.location.origin agar dinamis (localhost/vercel)
        redirectTo: `${window.location.origin}/reset-password`, 
      })
      if (error) throw error
      setMessage('Link reset password telah dikirim ke email kamu.')
      console.log('[DEBUG] Reset password link sent to:', email)
    } catch (err: any) {
      console.error('[DEBUG] Reset password error:', err)
      setError(err.message || 'Gagal mengirim link reset password.')
    }
  }

  // --- TAMPILAN TIDAK BERUBAH SAMA SEKALI ---
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Header */}
      <div className="w-full bg-[#003366] px-8 pt-12 pb-24 text-white">
        <h1 className="text-center text-3xl font-bold">Sign In to Your Account</h1>
        <p className="mt-2 text-center text-sm text-blue-100">
          Enter your email and password to log in
        </p>
      </div>

      {/* Form */}
      <div className="-mt-16 w-full max-w-md self-center">
        <div className="space-y-8 rounded-lg bg-white p-8 shadow-lg">
          <form className="space-y-6" onSubmit={handleLogin}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="block w-full rounded-lg border-gray-300 py-3 pl-3 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                placeholder="Masukkan Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password - UPDATE: Tambah tombol mata */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"} // Logic toggle type
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 pl-3 pr-10 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm" // Tambah pr-10 agar teks tidak tertutup icon
                  placeholder="Masukkan Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-[#4A90E2] hover:text-[#003366]"
                >
                  Lupa password?
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            {message && <p className="text-sm text-green-600 text-center">{message}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-full border border-transparent bg-[#003366] py-3 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? 'Memproses...' : 'Login'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-600">
            Untuk pendaftaran akun silahkan hubungi admin
          <br />
            <Link href="https://scribehow.com/embed-preview/Petunjuk_penggunaan_SMART_PPNPN_role_user__GWjMxAVpTKm7ftCX-dJJVw?as=slides&size=flexible" className="text-[#4A90E2] hover:text-[#003366]"  target="_blank">Pelajari Petunjuk Penggunaan (User Manual)</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
