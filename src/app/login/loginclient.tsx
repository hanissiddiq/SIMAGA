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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f7f9fc_0%,#eef4ff_45%,#fff9eb_100%)] text-slate-800">
      <div className="absolute -left-16 top-8 h-52 w-52 rounded-full bg-[var(--djkn-gold)]/25 blur-3xl" />
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[var(--djkn-blue)]/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[var(--djkn-green)]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center p-4 sm:p-8">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-[0_30px_80px_rgba(0,95,172,0.14)] backdrop-blur-md lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative hidden overflow-hidden bg-[var(--djkn-blue)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,183,21,0.35),transparent_35%)]" />
            <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full border-8 border-white/10" />
            <div className="absolute bottom-10 right-10 h-36 w-36 rounded-full border-8 border-[var(--djkn-gold)]/70" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--djkn-gold)]">
                KPKNL Lhokseumawe
              </div>
              <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight">
                SIMAGA
              </h1>
              <p className="mt-4 max-w-md text-base text-blue-100">
                Sistem presensi Mahasiswa Magang dan pengelolaan kehadiran yang modern, cepat, dan aman untuk pegawai.
              </p>
            </div>

            <div className="relative z-10 space-y-4">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--djkn-gold)] text-sm font-black text-slate-900">
                    24/7
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Monitoring Real-time</p>
                    <p className="text-xs text-blue-100">Absensi, logbook, dan evaluasi pekerjaan</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--djkn-gold)] text-sm font-black text-slate-900">
                    ✓
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Akses Terpercaya</p>
                    <p className="text-xs text-blue-100">Keamanan data dan autentikasi user</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative flex items-center justify-center p-6 sm:p-8 lg:p-10">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center lg:text-left">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--djkn-gold)] shadow-[0_10px_30px_rgba(250,183,21,0.45)] lg:mx-0">
                  <span className="text-2xl font-black text-slate-900">S</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--djkn-gold)]">
                  Portal Login
                </p>
                <h2 className="mt-3 text-3xl font-black text-slate-900">Masuk ke akun Anda</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Silakan masukkan email dan password untuk melanjutkan.
                </p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
                <form className="space-y-5" onSubmit={handleLogin}>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-3 text-sm text-slate-800 shadow-sm transition focus:border-[var(--djkn-gold)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--djkn-gold)]/20"
                      placeholder="Masukkan Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-11 text-sm text-slate-800 shadow-sm transition focus:border-[var(--djkn-gold)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--djkn-gold)]/20"
                        placeholder="Masukkan Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-[var(--djkn-blue)] focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm font-semibold text-[var(--djkn-blue)] transition hover:text-[var(--djkn-gold)]"
                      >
                        Lupa password?
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}
                  {message && <p className="text-center text-sm font-medium text-green-600">{message}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-xl bg-[var(--djkn-gold)] px-4 py-3 text-sm font-bold text-slate-900 shadow-[0_12px_30px_rgba(250,183,21,0.45)] transition hover:bg-[#f4bb2d] focus:outline-none focus:ring-4 focus:ring-[var(--djkn-gold)]/30 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                  >
                    {loading ? 'Memproses...' : 'Login'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600">
                  Untuk pendaftaran akun silahkan hubungi admin
                  <br />
                  <Link
                    href="https://scribehow.com/embed-preview/Petunjuk_penggunaan_SMART_PPNPN_role_user__GWjMxAVpTKm7ftCX-dJJVw?as=slides&size=flexible"
                    className="mt-2 inline-block font-semibold text-[var(--djkn-blue)] transition hover:text-[var(--djkn-gold)]"
                    target="_blank"
                  >
                    Pelajari Petunjuk Penggunaan (User Manual)
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
