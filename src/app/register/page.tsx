'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'

const InputIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
    {children}
  </div>
)

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [position, setPosition] = useState('PPNPN')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [passwordStrength, setPasswordStrength] = useState<'Weak' | 'Medium' | 'Strong' | null>(null)
  
  // State tambahan untuk toggle mata
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const validatePassword = (pass: string) => {
    if (!/.{8,}/.test(pass)) return 'Password minimal 8 karakter.'
    if (!/[A-Z]/.test(pass)) return 'Password harus mengandung huruf besar.'
    if (!/[0-9]/.test(pass)) return 'Password harus mengandung angka.'
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return 'Password harus mengandung karakter spesial.'
    return null
  }

  const evaluateStrength = (pass: string) => {
    let score = 0
    if (/.{8,}/.test(pass)) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pass)) score++

    if (score <= 1) setPasswordStrength('Weak')
    else if (score <= 3) setPasswordStrength('Medium')
    else setPasswordStrength('Strong')
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (!fullName.trim() || !email.trim() || !password || !confirmPassword || !position) {
        throw new Error('Semua field harus diisi.')
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Format email tidak valid.')

      const passwordError = validatePassword(password)
      if (passwordError) throw new Error(passwordError)

      if (password !== confirmPassword) throw new Error('Konfirmasi password tidak sama.')

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'pegawai',
            position: position
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      })

      if (signUpError) throw signUpError

      setSuccess('✅ Registrasi berhasil! Cek email Anda untuk verifikasi dan login.')
      setFullName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setPosition('PPNPN')
      setPasswordStrength(null)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err: any) {
      console.error('Error register:', err)
      setError(
        err.message ||
          'Terjadi kesalahan saat registrasi. Pastikan email belum terdaftar dan password memenuhi kriteria keamanan.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <div className="w-full bg-[#003366] px-8 pt-12 pb-24 text-white">
        <h1 className="text-center text-3xl font-bold">Create Your Account</h1>
        <p className="mt-2 text-center text-sm text-blue-100">Isi data diri Anda untuk melanjutkan</p>
      </div>

      <div className="-mt-16 w-full max-w-md self-center">
        <div className="space-y-8 rounded-lg bg-white p-8 shadow-lg">
          <form className="space-y-6" onSubmit={handleRegister} suppressHydrationWarning={true}>
            {/* Nama Lengkap */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
              <div className="relative mt-1">
                <InputIcon>
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </InputIcon>
                <input
                  id="fullName"
                  type="text"
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 pl-10 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                  placeholder="Masukkan Nama Lengkap"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <div className="relative mt-1">
                <InputIcon>
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </InputIcon>
                <input
                  id="email"
                  type="email"
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 pl-10 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                  placeholder="Masukkan Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1">
                <InputIcon>
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                </InputIcon>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 pl-10 pr-10 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    evaluateStrength(e.target.value)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>

              {password && (
                <div className="mt-2 text-sm font-medium">
                  <span className={passwordStrength === 'Weak' ? 'text-red-600' : passwordStrength === 'Medium' ? 'text-yellow-500' : 'text-green-600'}>
                    💪 Kekuatan Password: {passwordStrength}
                  </span>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">• Minimal 8 karakter • Huruf besar • Angka • Simbol</p>
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Konfirmasi Password</label>
              <div className="relative mt-1">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 px-3 pr-10 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                  placeholder="Ulangi password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Jenis Pengguna */}
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700">Jenis Pengguna</label>
              <select
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="mt-1 block w-full rounded-lg border-gray-300 py-3 pl-3 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
              >
                <option value="PPNPN">PPNPN</option>
                <option value="Supir">Supir</option>
                <option value="Satpam">Satpam</option>
                <option value="CS">CS</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-full border border-transparent bg-[#003366] py-3 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? 'Memproses...' : 'Register'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-600">
            Sudah punya akun?{' '}
            <Link href="/login" className="font-medium text-[#4A90E2] hover:text-[#003366]">Login di sini</Link>
          </p>
        </div>
      </div>
    </div>
  )
}