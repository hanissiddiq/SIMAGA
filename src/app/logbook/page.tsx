'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  FileText, User, Calendar, Plus, Trash2, Send, ChevronLeft,
  RefreshCw, AlertTriangle, Briefcase, ExternalLink, ClipboardCheck // 1. Tambahkan icon baru
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface UserData {
  fullName: string
  position: string
}

export default function LogbookPage() {
  const router = useRouter()
  
  const [userId, setUserId] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserData>({ fullName: '', position: '' })
  
  // Data Absensi yang sedang aktif
  const [attendanceId, setAttendanceId] = useState<number | null>(null)
  const [shiftName, setShiftName] = useState<string>('')
  const [attendanceDate, setAttendanceDate] = useState<string>('')

  // Data Logbook
  const [logbookId, setLogbookId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<string[]>([])
  const [selectedTask, setSelectedTask] = useState('')
  const [otherTask, setOtherTask] = useState('')
  const [standardTasks, setStandardTasks] = useState<string[]>([])
  const [formData, setFormData] = useState({ description: '' })
  
  // State UI
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusLogbook, setStatusLogbook] = useState('')

  // URL UNTUK CHECKLIST RUANGAN
  const checklistUrl = `https://kpknl-checker.vercel.app/checklist/form?worker=${encodeURIComponent(userData.fullName)}`;

  // --- Daftar Tugas Sesuai Jabatan ---
  const tugasPPNPN = [
    "Membersihkan ruangan kantor dan area kerja",
    "Pengarsipan, pemindaian, scan dokumen dan surat",
    "Membantu belanja kebutuhan kantor",
    "Input data ke aplikasi atau excel",
    "Membantu administrasi, rekapitulasi dan absensi kepegawaian",
    "Verifikasi kelengkapan dokumen",
    "Membantu penyusunan laporan",
    "Validasi surat masuk dan keluar",
    "Pelayanan konsultasi tamu dan satker",
    "Membantu kegiatan rapat dan dokumentasi",
    "Membantu pegawai dalam tugas kantor",
    "Mengemudikan kendaraan dinas kepala kantor",
    "Lainnya"
  ]
  const tugasSatpam = [
    "Patroli area luar dan dalam kantor 3x",
    "Membantu membuka pintu gerbang atau menyeberangkan kendaraan pegawai dan tamu",
    "Mencatat, mengatur area parkir dan akses kendaraan masuk keluar",
    "Menyapu dan membersihkan lapangan",
    "Menghidupkan lampu tanaman, menyiram air taman, membersihkan pos jaga",
    "Mematikan lampu, AC, keran air, mesin pompa air, memeriksa seluruh ruangan dari lantai 1-3",
    "Mengibarkan dan menurunkan bendera merah putih",
    "Lainnya"
  ]
  const tugasSupir = [
    "Mencuci Mobil Kepala Kantor",
    "Mencuci Mobil Operasional Rush",
    "Mencuci Mobil Operasional Wuling",
    "Mencuci Motor Operasional",
    "Mengantar Ka.Kantor atau pegawai sesuai jadwal",
    "Memastikan kendaraan siap digunakan Accu, air wipper, tekanan angin",
    "Mengemudikan kendaraan dinas kepala kantor",
    "Lainnya"
  ]
  const tugasCS = [
    "Menyapu, mengepel, membersihkan meja ruangan pagi siang sore",
    "Membersihkan halaman, memotong rumput dan merawat tanaman",
    "Membersihkan kamar mandi pagi siang sore",
    "Membantu Resepsionis dan mengarahkan tamu",
    "Lainnya"
  ]

  // --- FETCH DATA UTAMA ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr || !user) throw new Error('Sesi login tidak ditemukan.')
        setUserId(user.id)

        // 1. AMBIL PROFILE & SET TUGAS
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, position')
          .eq('id', user.id)
          .maybeSingle()

        const position = profile?.position || ''
        setUserData({ fullName: profile?.full_name || user.email!, position })

        if (position.toLowerCase().includes('satpam')) setStandardTasks(tugasSatpam)
        else if (position.toLowerCase().includes('supir')) setStandardTasks(tugasSupir)
        else if (position.toLowerCase().includes('cs')) setStandardTasks(tugasCS)
        else if (position) setStandardTasks(tugasPPNPN)
        else setStandardTasks([])

        // 2. CARI ATTENDANCE YANG BELUM CHECKOUT (Logic Diperbaiki)
        // Kita cari data absen user ini yang kolom 'check_out' nya masih NULL
        const { data: activeSession, error: attError } = await supabase
          .from('attendances')
          .select('id, shift, attendance_date')
          .eq('user_id', user.id)
          .is('check_out', null) // FILTER PENTING: Hanya yang belum pulang
          .order('check_in', { ascending: false }) // Ambil yang paling baru
          .limit(1)
          .maybeSingle()

        if (attError) throw attError

        // Jika tidak ada sesi aktif, user harus absen masuk dulu
        if (!activeSession) {
          setError('Anda belum melakukan Absen Masuk (atau sudah Checkout). Silakan absen masuk dulu.')
          setIsLoading(false)
          return
        }

        // Set data absen aktif
        setAttendanceId(activeSession.id)
        setShiftName(activeSession.shift)
        
        // Format tanggal agar enak dibaca (ambil dari tanggal absen aslinya)
        const formattedDate = new Date(activeSession.attendance_date).toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
        setAttendanceDate(formattedDate)

        // 3. AMBIL ATAU BUAT LOGBOOK BERDASARKAN ATTENDANCE ID
        const { data: logbook } = await supabase
          .from('logbooks')
          .select('id, status, description')
          .eq('attendance_id', activeSession.id) // Link ke absen yg benar
          .maybeSingle()

        if (logbook) {
          // Jika sudah ada logbook (lanjutkan pengisian)
          setLogbookId(logbook.id)
          setStatusLogbook(logbook.status)
          setFormData({ description: logbook.description || '' })
          
          // Ambil tasks yang sudah tersimpan
          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('task_name')
            .eq('logbook_id', logbook.id)
          
          if (existingTasks) {
            setTasks(existingTasks.map(t => t.task_name))
          }
        } else {
          // Jika belum ada, buat logbook baru (Auto-create)

          // ================= RANDOM VERIFIKASI MINGGUAN =================
          const now = new Date()
          const startYear = new Date(now.getFullYear(), 0, 1)
          const days = Math.floor(  (now.getTime() - startYear.getTime()) / 86400000 )
          const weekNumber = Math.ceil(  (days + startYear.getDay() + 1) / 7)
          // 5% sampling verifikasi mingguan
          const randomVerify =  ((activeSession.id + weekNumber) % 100) < 5
          const { data: newLogbook, error: insertErr } = await supabase
            .from('logbooks')
            .insert({
              user_id: user.id,
              attendance_id: activeSession.id,
              shift: activeSession.shift,
              log_date: activeSession.attendance_date, // Pakai tanggal absen
              activity_name: randomVerify ? 'random' : 'system',
              status: 'IN_PROGRESS'
            })
            .select('id')
            .single()
          
          if (insertErr) throw insertErr
          setLogbookId(newLogbook.id)
          setStatusLogbook('IN_PROGRESS')
        }

      } catch (err: any) {
        console.error("Error Fetching:", err)
        setError(err.message || 'Terjadi kesalahan memuat data.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, []) // Run sekali saat mount

  // --- Logic Tambah Tugas ---
  const addTask = () => {
    let newTask = selectedTask
    if (selectedTask === 'Lainnya' && otherTask.trim() !== '') newTask = otherTask.trim()
    if (!newTask || tasks.includes(newTask)) return // Cegah duplikat/kosong
    setTasks(prev => [...prev, newTask])
    setSelectedTask('')
    setOtherTask('')
  }

  const removeTask = (index: number) => setTasks(prev => prev.filter((_, i) => i !== index))

  // --- Logic Submit Logbook ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logbookId || tasks.length === 0) {
      setError('Isi minimal satu tugas sebelum submit.')
      return
    }
    
    setIsSubmitting(true)
    setError('') 

    try {
      // 1. Update Header Logbook
      
      const { error: updateErr } = await supabase
        .from('logbooks')
        .update({
          description: formData.description,
          status: 'COMPLETED' // PENTING: Status ini memicu tombol Checkout aktif
        })
        .eq('id', logbookId)

      if (updateErr) throw updateErr

      // 2. Update Tasks (Hapus lama, insert baru agar sinkron)
      await supabase.from('tasks').delete().eq('logbook_id', logbookId)
      
      const taskRows = tasks.map(t => ({ logbook_id: logbookId, task_name: t }))
      const { error: insertErr } = await supabase.from('tasks').insert(taskRows)
      
      if (insertErr) throw insertErr

      setStatusLogbook('COMPLETED')
      // Redirect ke dashboard agar user bisa langsung checkout
      router.replace('/dashboard')
    } catch (err: any) {
      console.error('Supabase Error:', err)
      setError('Gagal menyimpan logbook.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <RefreshCw className="animate-spin text-blue-600 w-8 h-8 mx-auto mb-2" />
        <span className="text-gray-600 font-medium">Memuat Logbook Shift Aktif...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="flex items-center text-blue-700 font-medium hover:underline">
          <ChevronLeft size={20} className="mr-1" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FileText className="mr-2 text-blue-600" /> Logbook
        </h1>
      </header>

      {/* INFO ABSEN AKTIF + TOMBOL CEKLIST RUANGAN */}
      {!error && (
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Logbook Untuk Sesi:</p>
            <p className="text-lg font-bold text-gray-800 mt-1">
              SHIFT {shiftName ? shiftName.toUpperCase() : '-'}
            </p>
            <p className="text-sm text-gray-600">
              {attendanceDate}
            </p>
            <div className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-bold ${statusLogbook === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {statusLogbook === 'COMPLETED' ? 'STATUS: SELESAI' : 'STATUS: BELUM SELESAI'}
            </div>
          </div>

          {/* TOMBOL KE LINK CEKLIST RUANGAN */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Input Khusus Ruangan:</label>
            <a 
              href={checklistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md shadow-orange-200 transition-all active:scale-95"
            >
              <ClipboardCheck size={18} />
              Buka Form Checklist Ruangan
              <ExternalLink size={14} className="opacity-70" />
            </a>
          </div>
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div className="mb-6 flex flex-col items-center justify-center bg-red-50 text-red-800 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle size={32} className="mb-2 text-red-600" />
          <p className="font-bold text-lg mb-1">Akses Ditolak</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => router.push('/checkinpage')} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700">
            Pergi ke Absen Masuk
          </button>
        </div>
      )}

      {/* FORM LOGBOOK */}
      {!error && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          
          {/* Header Info (ReadOnly) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-gray-100">
            <Input label="Nama Pegawai" value={userData.fullName} icon={User} readOnly />
            <Input label="Jabatan" value={userData.position} icon={Briefcase} readOnly />
          </div>

          {/* Task Input Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700">Daftar Tugas / Pekerjaan</label>
            
            <div className="flex gap-2">
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="flex-1 min-w-0 border border-gray-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-100 outline-none transition"
              >
                <option value="">-- Pilih tugas rutin --</option>
                {standardTasks.map((t, i) => <option key={i}>{t}</option>)}
              </select>
              <button type="button" onClick={addTask} className="flex-shrink-0 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition shadow-md flex items-center justify-center min-w-[50px]">
                <Plus size={20} />
              </button>
            </div>

            {selectedTask === 'Lainnya' && (
              <input
                value={otherTask}
                onChange={(e) => setOtherTask(e.target.value)}
                placeholder="Tulis tugas lainnya secara manual..."
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none animate-in fade-in"
              />
            )}

            {/* Task List Visualization */}
            {tasks.length > 0 ? (
              <div className="mt-4 space-y-2">
                {tasks.map((task, i) => (
                  <div key={i} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div> {task}
                    </span>
                    <button type="button" onClick={() => removeTask(i)} className="text-red-400 hover:text-red-600 transition p-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm bg-gray-50">
                Belum ada tugas yang ditambahkan.<br/>Silakan pilih tugas di atas.
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">Keterangan Tambahan / Kendala</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ description: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="Tulis detail pekerjaan atau kendala yang dihadapi (Opsional)..."
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex justify-center items-center gap-2 text-white py-4 rounded-xl font-bold shadow-lg transition transform active:scale-95 ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800 shadow-blue-500/30'
              }`}
            >
              {isSubmitting ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
              {isSubmitting ? 'Menyimpan...' : statusLogbook === 'COMPLETED' ? 'Update & Simpan' : 'Submit Logbook (Selesai)'}
            </button>
            <p className="text-center text-xs text-gray-500 mt-3">
              *Setelah logbook selesai (COMPLETED), tombol Absen Pulang di dashboard akan aktif.
            </p>
          </div>
        </form>
      )}
    </div>
  )
}

// --- Reusable Input Component ---
const Input = ({ label, value, icon: Icon, readOnly = false }: any) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
    <div className={`flex items-center border rounded-lg overflow-hidden ${readOnly ? 'bg-gray-50 border-gray-200' : 'border-gray-300 bg-white'}`}>
      {Icon && <div className="pl-3 text-gray-400"><Icon size={18} /></div>}
      <input 
        value={value} 
        readOnly={readOnly} 
        className={`w-full p-3 text-sm outline-none ${readOnly ? 'text-gray-600 bg-gray-50' : 'text-gray-900'}`} 
      />
    </div>
  </div>
)
