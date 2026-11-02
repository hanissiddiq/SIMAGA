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

  const tugasMahasiswa = [
    "Membantu dokumentasi kegiatan kantor dan kegiatan magang",
    "Mengolah data arsip dan menata berkas administrasi",
    "Membantu desain materi promosi atau presentasi sederhana",
    "Membantu input data ke aplikasi atau spreadsheet",
    "Membantu pengelolaan dokumen dan file digital kantor",
    "Menyusun laporan harian atau mingguan kegiatan magang",
    "Membantu pegawai dalam tugas administrasi dan pelayanan",
    "Melakukan pengecekan kehadiran dan pendataan data pegawai",
    "Mencatat serta merapikan dokumen penting dan surat masuk/keluar",
    "Membantu riset singkat, survei, atau pengumpulan data pendukung",
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
        else if (
          position.toLowerCase().includes('mahasiswa') ||
          position.toLowerCase().includes('magang') ||
          position.toLowerCase().includes('intern') ||
          position.toLowerCase().includes('praktikan')
        ) setStandardTasks(tugasMahasiswa)
        else if (position) setStandardTasks(tugasPPNPN)
        else setStandardTasks(tugasMahasiswa)

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
    <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.16),transparent_25%),linear-gradient(180deg,#f4f7fb_0%,#edf4fc_100%)]">
      <div className="rounded-[28px] border border-white/80 bg-white/80 px-8 py-6 text-center shadow-[0_20px_50px_rgba(0,95,172,0.12)] backdrop-blur-sm">
        <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-[var(--djkn-blue)]" />
        <span className="text-base font-semibold text-slate-700">Memuat Logbook Shift Aktif...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_28%),linear-gradient(180deg,#f5f8fc_0%,#edf4fb_100%)] p-4 font-sans text-slate-800 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <button onClick={() => router.back()} className="flex items-center gap-1 rounded-full border border-[var(--djkn-blue)]/20 bg-white/80 px-3 py-2 text-sm font-semibold text-[var(--djkn-blue)] shadow-sm transition hover:bg-white">
          <ChevronLeft size={18} /> Kembali
        </button>
        <div className="flex items-center gap-2 rounded-full border border-[var(--djkn-gold)]/30 bg-[var(--djkn-gold)]/10 px-3 py-2 text-[var(--djkn-blue)] shadow-sm">
          <FileText size={18} className="font-bold" />
          <h1 className="text-base font-black sm:text-lg">Logbook</h1>
        </div>
      </header>

      {!error && (
        <div className="mb-6 overflow-hidden rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm md:flex md:items-center md:justify-between md:gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Logbook Untuk Sesi</p>
            <p className="mt-2 text-2xl font-black text-slate-800">
              SHIFT {shiftName ? shiftName.toUpperCase() : '-'}
            </p>
            <p className="mt-1 text-sm text-slate-600">{attendanceDate}</p>
            <div className={`mt-3 inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusLogbook === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--djkn-gold)]/20 text-amber-800'}`}>
              {statusLogbook === 'COMPLETED' ? 'Status: Selesai' : 'Status: Belum Selesai'}
            </div>
          </div>

          {/* <div className="mt-4 md:mt-0">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Input Khusus Ruangan</label>
            <a 
              href={checklistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--djkn-gold)] px-5 py-3 text-sm font-black text-slate-900 shadow-[0_16px_30px_rgba(250,183,21,0.25)] transition hover:bg-[#f4bb2d]"
            >
              <ClipboardCheck size={18} />
              Buka Form Checklist Ruangan
              <ExternalLink size={14} className="opacity-70" />
            </a>
          </div> */}
        </div>
      )}

      {error && (
        <div className="mb-6 flex flex-col items-center justify-center rounded-[28px] border border-red-200 bg-red-50 p-8 text-center text-red-800 shadow-sm">
          <AlertTriangle size={34} className="mb-3 text-red-600" />
          <p className="mb-1 text-xl font-black">Akses Ditolak</p>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => router.push('/checkinpage')} className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">
            Pergi ke Absen Masuk
          </button>
        </div>
      )}

      {!error && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6">
          <div className="grid grid-cols-1 gap-5 border-b border-slate-200 pb-5 md:grid-cols-2">
            <Input label="Nama Pegawai" value={userData.fullName} icon={User} readOnly />
            <Input label="Jabatan" value={userData.position} icon={Briefcase} readOnly />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black uppercase tracking-[0.15em] text-slate-600">Daftar Tugas / Pekerjaan</label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
              >
                <option value="">-- Pilih tugas rutin --</option>
                {standardTasks.map((t, i) => <option key={i}>{t}</option>)}
              </select>
              <button type="button" onClick={addTask} className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--djkn-blue)] px-4 text-white shadow-[0_14px_28px_rgba(0,95,172,0.18)] transition hover:bg-[#004d8a] sm:w-14">
                <Plus size={20} />
              </button>
            </div>

            {selectedTask === 'Lainnya' && (
              <input
                value={otherTask}
                onChange={(e) => setOtherTask(e.target.value)}
                placeholder="Tulis tugas lainnya secara manual..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
              />
            )}

            {tasks.length > 0 ? (
              <div className="mt-4 space-y-2">
                {tasks.map((task, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--djkn-blue)]/10 bg-[var(--djkn-blue)]/5 p-3.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--djkn-gold)]" />
                      {task}
                    </span>
                    <button type="button" onClick={() => removeTask(i)} className="rounded-full p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                Belum ada tugas yang ditambahkan.<br />Silakan pilih tugas di atas.
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-black uppercase tracking-[0.15em] text-slate-600">Keterangan Tambahan / Kendala</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ description: e.target.value })}
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
              placeholder="Tulis detail pekerjaan atau kendala yang dihadapi (Opsional)..."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex w-full items-center justify-center gap-2 rounded-[22px] py-4 text-base font-black text-white shadow-[0_18px_35px_rgba(0,95,172,0.18)] transition ${
                isSubmitting ? 'cursor-not-allowed bg-slate-300 text-slate-500 shadow-none' : 'bg-[var(--djkn-gold)] text-slate-900 hover:bg-[#f4bb2d]'
              }`}
            >
              {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              {isSubmitting ? 'Menyimpan...' : statusLogbook === 'COMPLETED' ? 'Update & Simpan' : 'Submit Logbook (Selesai)'}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
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
