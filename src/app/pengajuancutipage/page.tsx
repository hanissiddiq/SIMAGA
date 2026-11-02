'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// Tipe data
type LeaveRequest = {
  id: number
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  address: string
  status: string
  created_at: string
  half_day: boolean
  half_day_shift: string | null
  annual_leave_cut: boolean
  durasi_hari_kerja?: number
}

export default function PengajuanCutiPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  // State Form
  const [leaveType, setLeaveType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [address, setAddress] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [halfDayShift, setHalfDayShift] = useState<'pagi' | 'siang' | ''>('')
  const [annualLeaveCut, setAnnualLeaveCut] = useState(true)
  
  // State Data & UI
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)
  const [suratSakitFile, setSuratSakitFile] = useState<File | null>(null)

  useEffect(() => setMounted(true), [])

  // =================== LOGIKA BARU: HITUNG DURASI ===================
  // Menghitung selisih hari untuk validasi
  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return 0
    const s = new Date(start)
    const e = new Date(end)
    const diffTime = e.getTime() - s.getTime()
    // Ditambah 1 agar tanggal yang sama dihitung 1 hari
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays > 0 ? diffDays : 0
  }

  const currentDuration = calculateDuration(startDate, endDate)
  // Flag jika durasi lebih dari 3 hari
  const isInvalidDuration = currentDuration > 3

  // =================== 1. AMBIL USER & KUOTA CUTI ===================
  useEffect(() => {
    if (!mounted) return
    const fetchUserAndQuota = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const currentYear = new Date().getFullYear()
      const { data: quotaData, error: quotaError } = await supabase
        .from('master_leave_quota')
        .select('annual_quota, used_leave')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .single()

      if (quotaError && quotaError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('master_leave_quota')
          .insert({ user_id: user.id, year: currentYear, annual_quota: 12, used_leave: 0 })
        if (insertError) toast.error('Gagal membuat kuota tahunan')
        else setLeaveBalance(12)
      } else if (quotaData) {
        setLeaveBalance(quotaData.annual_quota - quotaData.used_leave)
      }
    }
    fetchUserAndQuota()
  }, [mounted, router])

  // =================== 2. FETCH RIWAYAT PENGAJUAN ===================
  const fetchLeaveRequests = async () => {
    if (!userId) return

    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select(
        'id, leave_type, start_date, end_date, reason, address, status, created_at, half_day, half_day_shift, annual_leave_cut, durasi_hari_kerja'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching requests:', error.message)
      return
    }

    if (!requests || requests.length === 0) {
      setLeaveRequests([])
      return
    }

    const { data: approvals } = await supabase
      .from('leave_approvals')
      .select('leave_request_id, level, status')
      .in('leave_request_id', requests.map(r => r.id))

    const merged = requests.map((req: any) => {
      const level2 = approvals?.find(a => a.leave_request_id === req.id && a.level === 2)
      const level1 = approvals?.find(a => a.leave_request_id === req.id && a.level === 1)

      let finalStatus = req.status
      if (level2?.status === 'Disetujui') finalStatus = 'Disetujui'
      else if (level2?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Disetujui') finalStatus = 'Disetujui' 

      return { ...req, status: finalStatus }
    })

    setLeaveRequests(merged as LeaveRequest[])
  }

  useEffect(() => { fetchLeaveRequests() }, [userId])

  // =================== 3. SUBMIT PENGAJUAN ===================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // --- LOGIKA BARU: Proteksi Submit ---
    if (isInvalidDuration) {
      return toast.error('Maksimal pengajuan adalah 3 hari')
    }
    // ------------------------------------

    if (!leaveType || !startDate || !endDate || !reason || !address)
      return toast.error('Semua field wajib diisi')
    if (!userId) return toast.error('User belum terdeteksi')
    
    setLoading(true)

    // A. Upload File (Jika Cuti Sakit)
    let fileUrl: string | null = null;
    if (leaveType === 'Cuti Sakit' && suratSakitFile) {
      const loadingToast = toast.loading('Mengupload surat dokter...');
      const fileName = `${userId}/${Date.now()}-${suratSakitFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('surat_sakit')
        .upload(fileName, suratSakitFile);

      if (uploadError) {
        toast.dismiss(loadingToast);
        toast.error(`Gagal upload file: ${uploadError.message}`);
        setLoading(false);
        return;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('surat_sakit')
        .getPublicUrl(fileName);
        
      fileUrl = publicUrlData.publicUrl;
      toast.dismiss(loadingToast);
    }

    // B. Cek Overlap Tanggal
    const overlap = leaveRequests
      .filter(lr => lr.status === 'Menunggu Persetujuan Kepala' || lr.status === 'Menunggu')
      .some(lr => (new Date(startDate) <= new Date(lr.end_date)) && (new Date(endDate) >= new Date(lr.start_date)))

    if (overlap) {
      toast.error('❌ Anda masih punya pengajuan aktif di tanggal yang sama.')
      setLoading(false)
      return
    }

    // C. Submit ke Database (RPC)
    const { data, error } = await supabase.rpc('submit_leave_request', {
      p_user_id: userId,
      p_leave_type: leaveType,
      p_start_date: startDate,
      p_end_date: endDate,
      p_reason: reason,
      p_address: address,
      p_half_day: halfDay,
      p_half_day_shift: halfDayShift || null,
      p_annual_leave_cut: annualLeaveCut,
      p_surat_sakit_url: fileUrl,
    })

    if (error) {
      toast.error(`Gagal submit: ${error.message}`)
    } else {
      toast.success(data?.[0]?.error_message || 'Pengajuan berhasil dikirim')
      
      // Reset Form
      setLeaveType('')
      setStartDate('')
      setEndDate('')
      setReason('')
      setAddress('')
      setHalfDay(false)
      setHalfDayShift('')
      setSuratSakitFile(null)
      fetchLeaveRequests()
    }

    setLoading(false)
  }

  const filteredRequests = leaveRequests.filter((lr) =>
    (lr.leave_type && lr.leave_type.toLowerCase().includes(search.toLowerCase())) ||
    (lr.reason && lr.reason.toLowerCase().includes(search.toLowerCase())) ||
    (lr.status && lr.status.toLowerCase().includes(search.toLowerCase()))
  )

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),_transparent_25%),linear-gradient(180deg,#f5f8fc_0%,#edf4fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-center" />

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="djkn-header rounded-[28px] border border-white/10 p-5 shadow-[0_18px_45px_rgba(0,95,172,0.18)] sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Pengajuan Cuti
              </div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Formulir Pengajuan Cuti</h1>
              <p className="max-w-2xl text-sm text-blue-100">
                Ajukan cuti dengan proses yang jelas, cepat, dan sesuai dengan kebijakan internal DJKN.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">Jenis</p>
                <p className="mt-2 text-lg font-bold text-white">{leaveType || '—'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">Durasi</p>
                <p className="mt-2 text-lg font-bold text-white">{currentDuration || 0} Hari</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">Sisa Cuti</p>
                <p className="mt-2 text-lg font-bold text-white">{leaveBalance ?? 0}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <Card className="overflow-hidden border-0 bg-white/90 shadow-[0_20px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-[rgba(250,183,21,0.08)] to-[rgba(0,95,172,0.03)] px-5 pb-4 pt-5 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--djkn-gold)] text-sm font-bold text-[var(--djkn-blue)]">1</span>
                Formulir Pengajuan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Jenis Cuti</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-[var(--djkn-blue)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(0,95,172,0.12)]"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                  >
                    <option value="">-- Pilih Jenis Cuti --</option>
                    <option value="Cuti Tahunan">Cuti Tahunan</option>
                    <option value="Cuti Sakit">Cuti Sakit</option>
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    *Cuti Alasan Penting & Izin lainnya silakan gunakan menu <strong className="text-[var(--djkn-blue)]">Pengajuan Izin</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Tanggal Mulai</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-[var(--djkn-blue)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(0,95,172,0.12)]"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Tanggal Selesai</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-[var(--djkn-blue)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(0,95,172,0.12)]"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Alamat Selama Cuti</label>
                  <textarea
                    className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-[var(--djkn-blue)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(0,95,172,0.12)]"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Tuliskan alamat lengkap..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Alasan Cuti</label>
                  <textarea
                    className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-[var(--djkn-blue)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(0,95,172,0.12)]"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Jelaskan alasan cuti ..."
                  />
                </div>

                {leaveType === 'Cuti Sakit' && (
                  <div className="rounded-2xl border border-[rgba(0,95,172,0.18)] bg-[rgba(0,95,172,0.04)] p-4">
                    <label className="mb-1 block text-sm font-semibold text-[var(--djkn-blue)]">Surat Keterangan Dokter</label>
                    <p className="mb-3 text-xs text-slate-600">Wajib upload surat dokter untuk Cuti Sakit.</p>
                    <label
                      htmlFor="file-upload"
                      className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium transition ${
                        suratSakitFile
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-[var(--djkn-blue)]/30 bg-white text-[var(--djkn-blue)] hover:bg-blue-50'
                      }`}
                    >
                      <Upload size={16} />
                      <span>{suratSakitFile ? suratSakitFile.name : 'Pilih File (Gambar/PDF)'}</span>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => setSuratSakitFile(e.target.files ? e.target.files[0] : null)}
                    />
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      id="halfDay"
                      checked={halfDay}
                      onChange={(e) => setHalfDay(e.target.checked)}
                      className="h-4 w-4 accent-[var(--djkn-blue)]"
                    />
                    Cuti Setengah Hari
                  </label>

                  {halfDay && (
                    <div className="ml-7">
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[var(--djkn-blue)] focus:outline-none focus:ring-4 focus:ring-[rgba(0,95,172,0.12)]"
                        value={halfDayShift}
                        onChange={(e) => setHalfDayShift(e.target.value as 'pagi' | 'siang')}
                      >
                        <option value="">- Pilih Sesi -</option>
                        <option value="pagi">Pagi (Sampai jam 12)</option>
                        <option value="siang">Siang (Mulai jam 13)</option>
                      </select>
                    </div>
                  )}

                  {leaveType === 'Cuti Tahunan' && (
                    <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        id="cutAnnual"
                        checked={annualLeaveCut}
                        onChange={(e) => setAnnualLeaveCut(e.target.checked)}
                        className="h-4 w-4 accent-[var(--djkn-gold)]"
                      />
                      Potong Kuota Cuti Tahunan
                    </label>
                  )}
                </div>

                {leaveBalance !== null && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
                    Sisa Kuota Cuti Tahunan Anda: <strong>{leaveBalance}</strong> hari
                  </div>
                )}

                {isInvalidDuration && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
                    ⚠️ Pengajuan maksimal 3 hari. Durasi terpilih: {currentDuration} hari.
                  </p>
                )}

                <button
                  type="submit"
                  className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition ${
                    loading || isInvalidDuration
                      ? 'cursor-not-allowed bg-slate-300 text-slate-600 shadow-none'
                      : 'bg-[var(--djkn-gold)] text-[var(--djkn-blue)] hover:-translate-y-0.5 hover:bg-[#e0a600]'
                  }`}
                  disabled={loading || isInvalidDuration}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Kirim Pengajuan'}
                </button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-0 bg-white/90 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
              <CardHeader className="border-b border-slate-100 px-5 pb-4 pt-5">
                <CardTitle className="text-base font-semibold text-slate-800">Informasi Penting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="rounded-2xl bg-[rgba(0,95,172,0.06)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--djkn-blue)]">Aturan</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Maksimal pengajuan cuti adalah <span className="font-bold text-[var(--djkn-blue)]">3 hari</span> dalam satu form.
                  </p>
                </div>

                <div className="rounded-2xl bg-[rgba(250,183,21,0.1)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--djkn-blue)]">Status</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Pengajuan akan diproses sesuai dengan sistem persetujuan dan status yang berlaku di kantor.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-[linear-gradient(135deg,#005fac_0%,#0a6bb8_100%)] text-white shadow-[0_20px_45px_rgba(0,95,172,0.28)]">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">Catatan</p>
                <h2 className="mt-2 text-xl font-bold">Proses Pengajuan</h2>
                <ul className="mt-4 space-y-3 text-sm text-blue-50">
                  <li className="flex items-start gap-3"><span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--djkn-gold)] text-[10px] font-bold text-[var(--djkn-blue)]">1</span> Isi formulir dengan lengkap</li>
                  <li className="flex items-start gap-3"><span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--djkn-gold)] text-[10px] font-bold text-[var(--djkn-blue)]">2</span> Unggah dokumen pendukung bila diperlukan</li>
                  <li className="flex items-start gap-3"><span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--djkn-gold)] text-[10px] font-bold text-[var(--djkn-blue)]">3</span> Tunggu persetujuan resmi dari pihak berwenang</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="overflow-hidden border-0 bg-white/90 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <CardTitle className="text-lg font-semibold text-slate-800">Riwayat Pengajuan</CardTitle>
            <input
              type="text"
              placeholder="Cari data..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-[var(--djkn-blue)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(0,95,172,0.12)] sm:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Belum ada riwayat pengajuan cuti.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="border-b border-slate-200 p-3 font-semibold">Jenis</th>
                      <th className="border-b border-slate-200 p-3 font-semibold">Tanggal</th>
                      <th className="border-b border-slate-200 p-3 text-center font-semibold">Durasi</th>
                      <th className="border-b border-slate-200 p-3 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((lr) => (
                      <tr key={lr.id} className="transition hover:bg-slate-50">
                        <td className="border-b border-slate-200 p-3 font-medium text-slate-800">{lr.leave_type}</td>
                        <td className="border-b border-slate-200 p-3 text-slate-600">{lr.start_date} s.d. {lr.end_date}</td>
                        <td className="border-b border-slate-200 p-3 text-center text-slate-600">{lr.half_day ? '½ Hari' : `${lr.durasi_hari_kerja ?? '-'} Hari`}</td>
                        <td className="border-b border-slate-200 p-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              lr.status === 'Disetujui'
                                ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                                : lr.status === 'Ditolak'
                                  ? 'border border-red-200 bg-red-100 text-red-700'
                                  : 'border border-yellow-200 bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {lr.status}
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
  )
}