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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <Toaster position="top-center" />

      {/* --- FORMULIR PENGAJUAN --- */}
      <Card className="mb-8 shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl font-semibold text-gray-800">
            Formulir Pengajuan Cuti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. Jenis Cuti */}
            <div>
              <label className="font-medium">Jenis Cuti</label>
              <select
                className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                <option value="">-- Pilih Jenis Cuti --</option>
                <option value="Cuti Tahunan">Cuti Tahunan</option>
                <option value="Cuti Sakit">Cuti Sakit</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                *Cuti Alasan Penting & Izin lainnya silakan gunakan menu <strong>Pengajuan Izin</strong>.
              </p>
            </div>

            {/* 2. Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-medium">Tanggal Mulai</label>
                <input type="date" className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                       value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="font-medium">Tanggal Selesai</label>
                <input type="date" className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                       value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* 3. Alamat */}
            <div>
              <label className="font-medium">Alamat Selama Cuti</label>
              <textarea className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                        value={address} onChange={(e) => setAddress(e.target.value)}
                        placeholder="Tuliskan alamat lengkap..." />
            </div>

            {/* 4. Alasan */}
            <div>
              <label className="font-medium">Alasan Cuti</label>
              <textarea className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                        value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="Jelaskan alasan cuti..." />
            </div>

            {/* 5. Upload Surat (Khusus Sakit) */}
            {leaveType === 'Cuti Sakit' && (
              <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-md">
                <label className="font-medium text-blue-700">Surat Keterangan Dokter</label>
                <p className="text-xs text-gray-600 mb-2">
                  Wajib upload surat dokter untuk Cuti Sakit.
                </p>
                <label htmlFor="file-upload" className={`
                  w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-md cursor-pointer 
                  ${suratSakitFile ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200'}
                `}>
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

            {/* 6. Opsi Tambahan */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="halfDay" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
                <label htmlFor="halfDay" className="text-sm">Cuti Setengah Hari</label>
              </div>

              {halfDay && (
                <div className="ml-6">
                  <select className="border p-1 rounded text-sm"
                          value={halfDayShift} onChange={(e) => setHalfDayShift(e.target.value as 'pagi' | 'siang')}>
                    <option value="">- Pilih Sesi -</option>
                    <option value="pagi">Pagi (Sampai jam 12)</option>
                    <option value="siang">Siang (Mulai jam 13)</option>
                  </select>
                </div>
              )}

              {leaveType === 'Cuti Tahunan' && (
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="cutAnnual" checked={annualLeaveCut} onChange={(e) => setAnnualLeaveCut(e.target.checked)} />
                  <label htmlFor="cutAnnual" className="text-sm">Potong Kuota Cuti Tahunan</label>
                </div>
              )}
            </div>

            {/* Info Sisa Cuti */}
            {leaveBalance !== null && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm text-center">
                Sisa Kuota Cuti Tahunan Anda: <strong>{leaveBalance}</strong> hari
              </div>
            )}

            {/* --- LOGIKA BARU: Pesan Peringatan Merah --- */}
            {isInvalidDuration && (
              <p className="text-red-500 text-xs font-medium text-center bg-red-50 p-2 rounded border border-red-100">
                ⚠️ Pengajuan maksimal 3 hari. Durasi terpilih: {currentDuration} hari.
              </p>
            )}

            {/* --- LOGIKA BARU: Update Tombol Submit (Disabled state) --- */}
            <button type="submit"
                    className={`w-full py-2.5 rounded-md transition flex items-center justify-center font-medium shadow-sm 
                      ${(loading || isInvalidDuration) ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-blue-700 text-white hover:bg-blue-800'}`}
                    disabled={loading || isInvalidDuration}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Kirim Pengajuan'}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* --- RIWAYAT PENGAJUAN (Tidak Berubah) --- */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-2 pb-2">
          <CardTitle className="text-lg font-semibold text-gray-800">Riwayat Pengajuan</CardTitle>
          <input
            type="text"
            placeholder="Cari data..."
            className="border p-2 rounded-md focus:ring-2 focus:ring-blue-500 w-full sm:w-64 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Belum ada riwayat pengajuan cuti.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-xs sm:text-sm text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3 border font-semibold">Jenis</th>
                    <th className="p-3 border font-semibold">Tanggal</th>
                    <th className="p-3 border font-semibold text-center">Durasi</th>
                    <th className="p-3 border font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((lr) => (
                    <tr key={lr.id} className="hover:bg-gray-50 transition border-b">
                      <td className="p-3 border font-medium text-gray-800">{lr.leave_type}</td>
                      <td className="p-3 border text-gray-600">
                        {lr.start_date} s.d. {lr.end_date}
                      </td>
                      <td className="p-3 border text-center text-gray-600">
                        {lr.half_day ? '½ Hari' : `${lr.durasi_hari_kerja ?? '-'} Hari`}
                      </td>
                      <td className="p-3 border text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          lr.status === 'Disetujui' ? 'bg-green-100 text-green-700 border border-green-200' :
                          lr.status === 'Ditolak' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
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
  )
}