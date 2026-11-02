'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// Tipe data
type PermissionRequest = {
  id: number
  jenis_izin: string
  tanggal_mulai: string
  tanggal_selesai: string
  alasan: string
  lampiran_url: string | null
  status: string
  created_at: string
  durasi_hari_kerja?: number
  potong_gaji?: boolean
  half_day?: boolean          // Tambahan field untuk display
  half_day_shift?: string     // Tambahan field untuk display
}

export default function PengajuanIzinPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  // State Form
  const [jenisIzin, setJenisIzin] = useState('')
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalSelesai, setTanggalSelesai] = useState('')
  const [alasan, setAlasan] = useState('')
  const [lampiran, setLampiran] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  
  // State Baru: Izin Setengah Hari (Update tipe shift ke 'pagi' | 'malam')
  const [halfDay, setHalfDay] = useState(false)
  const [halfDayShift, setHalfDayShift] = useState<'pagi' | 'malam' | ''>('')

  // State Data
  const [izinRequests, setIzinRequests] = useState<PermissionRequest[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => setMounted(true), [])

  // AMBIL USER
  useEffect(() => {
    if (!mounted) return
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
    }
    fetchUser()
  }, [mounted, router])

  // FETCH RIWAYAT
  const fetchIzinRequests = async () => {
    if (!userId) return

    const { data: requests, error } = await supabase
      .from('permission_requests')
      .select('id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan, lampiran_url, status, created_at, durasi_hari_kerja, potong_gaji, half_day, half_day_shift') // Ambil field half_day
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching izin:', error.message)
      return
    }

    if (!requests || requests.length === 0) {
      setIzinRequests([])
      return
    }

    const { data: approvals } = await supabase
      .from('permission_approvals')
      .select('permission_request_id, level, status')
      .in('permission_request_id', requests.map(r => r.id))

    const merged = requests.map((req: any) => {
      const level2 = approvals?.find(a => a.permission_request_id === req.id && a.level === 2)
      const level1 = approvals?.find(a => a.permission_request_id === req.id && a.level === 1)

      let finalStatus = req.status
      if (level2?.status === 'Disetujui') finalStatus = 'Disetujui'
      else if (level2?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Disetujui') finalStatus = 'Menunggu Persetujuan Kepala'

      return { ...req, status: finalStatus }
    })

    setIzinRequests(merged)
  }

  useEffect(() => { fetchIzinRequests() }, [userId])


 // =================== SUBMIT PENGAJUAN ===================
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!jenisIzin || !tanggalMulai || !tanggalSelesai || !alasan)
    return toast.error('Semua field wajib diisi')
  if (halfDay && !halfDayShift)
    return toast.error('Silakan pilih Shift (Pagi/Malam) untuk izin setengah hari')
  if (!userId) return toast.error('User belum terdeteksi')

  // --- VALIDASI UKURAN FILE (2MB) ---
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB dalam bytes
  if (lampiran && lampiran.size > MAX_FILE_SIZE) {
    return toast.error('Ukuran lampiran terlalu besar! Maksimal 2MB.');
  }

  setLoading(true)

  try {
    // 1. Upload lampiran jika ada
    let lampiranUrl: string | null = null
    if (lampiran) {
      const loadingToast = toast.loading('Mengupload lampiran...');
      
      // Bersihkan nama file dari karakter aneh agar tidak error di storage
      const fileExt = lampiran.name.split('.').pop()
      const cleanFileName = `${Date.now()}_${userId}.${fileExt}`
      const filePath = `izin_lampiran/${cleanFileName}`

      const { error: uploadError } = await supabase.storage
        .from('lampiran_izin')
        .upload(filePath, lampiran, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError

      const { data: publicUrl } = supabase.storage
        .from('lampiran_izin')
        .getPublicUrl(filePath)

      lampiranUrl = publicUrl.publicUrl
      toast.dismiss(loadingToast);
    }

    // 2. Panggil RPC (Sama seperti sebelumnya)
    const { data, error: rpcError } = await supabase.rpc('submit_permission_request', {
      p_user_id: userId,
      p_jenis_izin: jenisIzin,
      p_tanggal_mulai: tanggalMulai,
      p_tanggal_selesai: tanggalSelesai,
      p_alasan: alasan,
      p_lampiran_url: lampiranUrl,
      p_half_day: halfDay,
      p_half_day_shift: halfDayShift || null
    })

    if (rpcError) throw rpcError; 
    
    // ... sisa kode reset form dan toast success
      
      const rpcData = data?.[0];

      if (!rpcData || rpcData.request_id === null) {
        throw new Error(rpcData?.error_message || 'Gagal mengajukan izin');
      }

      toast.success(rpcData.error_message || 'Pengajuan izin berhasil dikirim')
      
      // Reset Form
      setJenisIzin('')
      setTanggalMulai('')
      setTanggalSelesai('')
      setAlasan('')
      setLampiran(null)
      setHalfDay(false)
      setHalfDayShift('')
      
      fetchIzinRequests()

    } catch (error: any) {
      console.error('Error submitting izin:', error.message)
      toast.error(error.message || 'Gagal mengirim pengajuan')
    } finally {
      setLoading(false)
    }
  }

  const filteredRequests = izinRequests.filter((r) =>
    (r.jenis_izin && r.jenis_izin.toLowerCase().includes(search.toLowerCase())) ||
    (r.alasan && r.alasan.toLowerCase().includes(search.toLowerCase())) ||
    (r.status && r.status.toLowerCase().includes(search.toLowerCase()))
  )

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_28%),linear-gradient(180deg,#f5f8fc_0%,#edf4fb_100%)] p-4 font-sans text-slate-800 sm:p-6">
      <Toaster position="top-center" />

      <div className="mx-auto max-w-6xl">
        <div
          className="mb-6 flex cursor-pointer items-center gap-3 rounded-[26px] border border-white/60 bg-[var(--djkn-blue)] px-4 py-4 text-white shadow-[0_20px_45px_rgba(0,95,172,0.18)] transition hover:bg-[#004d8a]"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft size={22} />
          <h1 className="text-lg font-black sm:text-2xl">Pengajuan Izin</h1>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
          <Card className="border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <CardHeader className="border-b border-slate-200 pb-4">
              <CardTitle className="text-lg font-black text-slate-900 sm:text-xl">
                Formulir Pengajuan Izin
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-slate-600">Jenis Izin</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
                    value={jenisIzin}
                    onChange={(e) => setJenisIzin(e.target.value)}
                  >
                    <option value="">Pilih Jenis Izin...</option>
                    <option value="Lupa Absen Masuk">Lupa Absen Masuk</option>
                    <option value="Lupa Absen Pulang">Lupa Absen Pulang</option>
                    <option value="Meninggalkan Kantor">Meninggalkan Kantor (Keperluan Pribadi)</option>
                    <option value="Keperluan Mendesak (Pribadi)">Keperluan Mendesak (Pribadi)</option>
                    <option value="Sakit (Tanpa Kuota Cuti)">Sakit (Tanpa Kuota Cuti Tahunan)</option>
                    <option value="Perjalanan Dinas (ST)">Perjalanan Dinas (ST)</option>
                    <option value="Izin Terlambat">Izin Terlambat</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-slate-600">Tanggal Mulai</label>
                    <input
                      type="date"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
                      value={tanggalMulai}
                      onChange={(e) => setTanggalMulai(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-slate-600">Tanggal Selesai</label>
                    <input
                      type="date"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
                      value={tanggalSelesai}
                      onChange={(e) => setTanggalSelesai(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="halfDay"
                      checked={halfDay}
                      onChange={(e) => setHalfDay(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--djkn-blue)] focus:ring-[var(--djkn-gold)]"
                    />
                    <label htmlFor="halfDay" className="text-sm font-semibold text-slate-700">Izin Setengah Hari</label>
                  </div>

                  {halfDay && (
                    <div className="mt-3">
                      <select
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:ring-4 focus:ring-[var(--djkn-gold)]/15 sm:w-auto"
                        value={halfDayShift}
                        onChange={(e) => setHalfDayShift(e.target.value as 'pagi' | 'malam')}
                      >
                        <option value="">-- Pilih Shift --</option>
                        <option value="pagi">Shift Pagi</option>
                        <option value="malam">Shift Malam</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-slate-600">Alasan / Keterangan</label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="Tuliskan alasan/keterangan izin..."
                    rows={4}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold uppercase tracking-[0.15em] text-slate-600">Lampiran (Opsional)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      if (file && file.size > 2 * 1024 * 1024) {
                        toast.error('File terlalu besar (Maks 2MB)')
                        e.target.value = ''
                        setLampiran(null)
                      } else {
                        setLampiran(file)
                      }
                    }}
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--djkn-blue)]/10 file:px-4 file:py-2 file:text-sm file:font-bold file:text-[var(--djkn-blue)] hover:file:bg-[var(--djkn-blue)]/15"
                  />
                  <p className="mt-2 text-xs text-slate-500">Format: PDF, JPG, PNG (Maksimal 2MB).</p>
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--djkn-gold)] px-4 py-3.5 text-base font-black text-slate-900 shadow-[0_16px_30px_rgba(250,183,21,0.25)] transition hover:bg-[#f4bb2d] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {loading ? 'Mengirim...' : 'Ajukan Izin'}
                </button>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg font-black text-slate-900">Riwayat Pengajuan Izin</CardTitle>
              <input
                type="text"
                placeholder="Cari data..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white focus:ring-4 focus:ring-[var(--djkn-gold)]/15 sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </CardHeader>
            <CardContent className="pt-5">
              {filteredRequests.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Belum ada pengajuan izin
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-200 p-2.5 font-bold">Jenis Izin</th>
                        <th className="border border-slate-200 p-2.5 font-bold">Tanggal</th>
                        <th className="border border-slate-200 p-2.5 font-bold">Durasi</th>
                        <th className="border border-slate-200 p-2.5 font-bold">Potong Gaji</th>
                        <th className="border border-slate-200 p-2.5 font-bold">Lampiran</th>
                        <th className="border border-slate-200 p-2.5 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((r) => (
                        <tr key={r.id} className="transition hover:bg-slate-50">
                          <td className="border border-slate-200 p-2.5 text-slate-700">{r.jenis_izin}</td>
                          <td className="border border-slate-200 p-2.5 text-slate-700">
                            {r.tanggal_mulai} – {r.tanggal_selesai}
                          </td>
                          <td className="border border-slate-200 p-2.5 text-slate-700">
                            {r.half_day
                              ? `½ Hari (${r.half_day_shift === 'pagi' ? 'Shift Pagi' : 'Shift Malam'})`
                              : `${r.durasi_hari_kerja ?? '?'} Hari`}
                          </td>
                          <td className="border border-slate-200 p-2.5 text-slate-700">{r.potong_gaji ? 'Ya' : 'Tidak'}</td>
                          <td className="border border-slate-200 p-2.5">
                            {r.lampiran_url ? (
                              <a href={r.lampiran_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--djkn-blue)] hover:underline">
                                Lihat
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="border border-slate-200 p-2.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                                r.status === 'Disetujui'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'Ditolak'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-[var(--djkn-gold)]/15 text-amber-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
