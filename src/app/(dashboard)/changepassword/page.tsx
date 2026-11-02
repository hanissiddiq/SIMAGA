'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Toaster, toast } from 'react-hot-toast'
import { Lock, Save, Loader2, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Status Validasi Visual
  const [strengthMsg, setStrengthMsg] = useState('')
  const [matchMsg, setMatchMsg] = useState('')

  // --- 1. Cek Kekuatan Password ---
  const checkStrength = (pwd: string) => {
    if (!pwd) return ''
    if (pwd.length < 8) return "Kurang dari 8 karakter ❌"
    if (!/[A-Z]/.test(pwd)) return "Kurang huruf BESAR ❌"
    if (!/[a-z]/.test(pwd)) return "Kurang huruf kecil ❌"
    if (!/[0-9]/.test(pwd)) return "Kurang angka ❌"
    if (!/[!@#$%^&*]/.test(pwd)) return "Kurang simbol (!@#$%^&*) ❌"
    return "Password Kuat ✅"
  }

  // --- 2. Handler Input Password Baru ---
  const handlePassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setNewPassword(val)
    setStrengthMsg(checkStrength(val))
    
    // Cek ulang kecocokan jika field konfirmasi sudah terisi
    if (confirmPassword) {
      setMatchMsg(val === confirmPassword ? "Password Cocok ✅" : "Password tidak sama ❌")
    }
  }

  // --- 3. Handler Input Konfirmasi ---
  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setConfirmPassword(val)
    
    if (!val) {
        setMatchMsg('')
    } else {
        setMatchMsg(newPassword === val ? "Password Cocok ✅" : "Password tidak sama ❌")
    }
  }

  // --- 4. Submit ---
  const handleUpdatePassword = async () => {
    // Validasi Akhir (Double Check)
    if (strengthMsg !== "Password Kuat ✅" || matchMsg !== "Password Cocok ✅") return
    
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      
      toast.success('Password berhasil diperbarui! Anda akan diarahkan kembali...')
      
      // Delay sebentar lalu kembali ke dashboard
      setTimeout(() => {
        router.push('/dashboardadmin')
      }, 2000)
      
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = strengthMsg === "Password Kuat ✅" && matchMsg === "Password Cocok ✅"

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6 flex flex-col items-center justify-center">
      <Toaster position="top-center" />

      <div className="w-full max-w-lg mb-6">
</div>


      {/* Card Wrapper */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg border border-gray-100">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-4 bg-blue-100 text-blue-700 rounded-full mb-4 shadow-sm animate-pulse">
            <ShieldCheck size={48} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Ganti Password</h1>
          <p className="text-gray-500 text-sm mt-2 max-w-xs">
            Amankan akun Anda dengan kombinasi password yang kuat dan unik.
          </p>
        </div>

        <div className="space-y-6">
          
          {/* Input 1: Password Baru */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password Baru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={newPassword}
                onChange={handlePassChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                  strengthMsg === "Password Kuat ✅" 
                    ? 'border-green-500 focus:ring-green-100 bg-green-50/30' 
                    : strengthMsg 
                    ? 'border-red-300 focus:ring-red-100 bg-red-50/30'
                    : 'border-gray-300 focus:ring-blue-100'
                }`}
              />
            </div>
            {/* Indikator Kekuatan */}
            {strengthMsg && (
              <p className={`text-xs font-semibold mt-2 ml-1 flex items-center gap-1 ${strengthMsg === "Password Kuat ✅" ? 'text-green-600' : 'text-red-500'}`}>
                {strengthMsg}
              </p>
            )}
          </div>

          {/* Input 2: Konfirmasi Password */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Konfirmasi Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CheckCircle2 className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="password" 
                placeholder="Ulangi password..." 
                value={confirmPassword}
                onChange={handleConfirmChange}
                disabled={!newPassword} // Mati jika password baru belum diisi
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  matchMsg === "Password Cocok ✅" 
                    ? 'border-green-500 focus:ring-green-100 bg-green-50/30' 
                    : matchMsg 
                    ? 'border-red-300 focus:ring-red-100 bg-red-50/30'
                    : 'border-gray-300 focus:ring-blue-100'
                }`}
              />
            </div>
            {/* Indikator Cocok */}
            {matchMsg && (
              <p className={`text-xs font-semibold mt-2 ml-1 ${matchMsg === "Password Cocok ✅" ? 'text-green-600' : 'text-red-500'}`}>
                {matchMsg}
              </p>
            )}
          </div>

          {/* Requirements Box */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <p className="text-[11px] text-gray-500 font-bold uppercase mb-2">Syarat Keamanan:</p>
            <ul className="text-[11px] text-gray-500 space-y-1 grid grid-cols-2 gap-x-2">
              <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span> Min 8 Karakter</li>
              <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span> Huruf Besar (A-Z)</li>
              <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span> Huruf Kecil (a-z)</li>
              <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span> Angka (0-9)</li>
              <li className="flex items-center gap-1 col-span-2"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span> Simbol (!@#$%^&*)</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-3">
            <button 
                onClick={handleUpdatePassword} 
                disabled={loading || !isFormValid}
                className={`w-full py-4 rounded-xl text-white font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                loading || !isFormValid
                    ? 'bg-gray-300 cursor-not-allowed shadow-none text-gray-500' 
                    : 'bg-blue-900 hover:bg-blue-800 shadow-blue-500/30'
                }`}
            >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>

            <button 
                onClick={() => router.push('/dashboardadmin')} 
                className="w-full py-3 rounded-xl text-gray-600 font-semibold hover:bg-gray-100 transition"
            >
                Batal & Kembali
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}