'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Loader2, ArrowLeft, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ======================= TYPES (DI-UPDATE) =======================
type PermissionRequest = {
  id: number
  user_id: string
  jenis_izin: string
  tanggal_mulai?: string
  tanggal_selesai?: string
  alasan?: string
  lampiran_url?: string
  status?: 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Disetujui Level 1' // Tipe ini sudah OK
  created_at?: string
  profiles?: { full_name?: string; position?: string } | null
  durasi_hari_kerja?: number // <-- BARU
  potong_gaji?: boolean // <-- BARU
}

type PermissionApproval = {
  id: number
  permission_request_id: number
  approver_id: string
  level: 1 | 2
  status: 'Menunggu' | 'Disetujui' | 'Ditolak'
  tanggal_persetujuan: string | null
}

// ======================= COMPONENT =======================
export default function ApprovalIzinPage() {
  const router = useRouter()
  const [izinRequests, setIzinRequests] = useState<PermissionRequest[]>([])
  const [approvals, setApprovals] = useState<PermissionApproval[]>([])
  const [approverRole, setApproverRole] = useState<'kasubbag' | 'kepala_kantor' | null>(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [loadingPage, setLoadingPage] = useState<boolean>(true)
  const [globalFilter, setGlobalFilter] = useState('')
  
  const [potongGajiChecks, setPotongGajiChecks] = useState<{[key: number]: boolean}>({})

  // Helper
  const getApprovalRecord = (izinId: number, level: 1 | 2) =>
    approvals.find((a) => a.permission_request_id === izinId && a.level === level) || null

  // Helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // FETCH IZIN
  const fetchIzinRequests = async () => {
    try {
      setLoadingPage(true)
      const { data, error } = await supabase
        .from('permission_requests')
        .select(`id,user_id,jenis_izin,tanggal_mulai,tanggal_selesai,alasan,lampiran_url,status,created_at,
                 durasi_hari_kerja, potong_gaji,
                 profiles(full_name,position)`)
        .order('created_at', { ascending: false })
        
      if (error) throw error
      
      const safeData = Array.isArray(data)
        ? data.map((d: any) => ({
            ...d,
            profiles: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles,
          }))
        : []
        
      setIzinRequests(safeData as PermissionRequest[])

      const initialChecks: {[key: number]: boolean} = {};
      safeData.forEach(req => {
        const autoPotong = [
          'Lupa Absen Masuk', 
          'Lupa Absen Pulang', 
          'Meninggalkan Kantor', 
          'Keperluan Mendesak (Pribadi)',
          'Sakit (Tanpa Kuota Cuti)'
        ].includes(req.jenis_izin);
        
        initialChecks[req.id] = req.potong_gaji || autoPotong;
      });
      setPotongGajiChecks(initialChecks);

    } catch (err) {
      console.error('Error fetching izin:', err)
      setIzinRequests([])
    } finally {
      setLoadingPage(false)
    }
  }

  // Fetch approval
  const fetchApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('permission_approvals')
        .select('*')
        .order('tanggal_persetujuan', { ascending: false })
      if (error) throw error
      setApprovals(Array.isArray(data) ? data : [])
    } catch {
      setApprovals([])
    }
  }

  // Fetch role
  const fetchApproverRole = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const email = userData.user?.email
      if (!email) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('email', email).single()
      if (profile?.role === 'kasubbag') setApproverRole('kasubbag')
      else if (profile?.role === 'kepala_kantor') setApproverRole('kepala_kantor')
    } catch {}
  }

  // useEffect
  useEffect(() => {
    const init = async () => await Promise.all([fetchIzinRequests(), fetchApprovals(), fetchApproverRole()])
    init()

    const channel = supabase
      .channel('realtime-permission-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permission_approvals' }, async () => {
        await Promise.all([fetchIzinRequests(), fetchApprovals()])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permission_requests' }, async () => {
        await Promise.all([fetchIzinRequests(), fetchApprovals()])
      })
      .subscribe()

    return () => {
      // @ts-ignore
      supabase.removeChannel(channel)
    }
  }, [])

  // ACTION APPROVAL (Memanggil RPC yang sudah diperbaiki)
  const insertApproval = async (izin_id: number, status: 'Disetujui' | 'Ditolak') => {
    if (!approverRole) return alert('Role belum ditentukan.')
    setLoadingId(izin_id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const approver_id = userData.user?.id
      if (!approver_id) return alert('❌ Tidak ditemukan ID pengguna.')
      const level = approverRole === 'kasubbag' ? 1 : 2

      if (level === 1) {
        // Panggil RPC Level 1 (yang sudah tidak mengubah status 'Disetujui Level 1')
        const { error } = await supabase.rpc('handle_permission_level_1_approval', {
          p_permission_request_id: izin_id,
          p_approver_uuid: approver_id,
          p_status: status
        });
        if (error) throw error;

      } else if (level === 2) {
        // Panggil RPC Level 2
        const level1Approval = getApprovalRecord(izin_id, 1)
        if (status === 'Disetujui' && level1Approval?.status !== 'Disetujui') {
          return alert('❌ Admin hanya dapat menyetujui jika validator sudah menyetujui.')
        }
        
        const potong = potongGajiChecks[izin_id] || false;

        const { error } = await supabase.rpc('handle_permission_level_2_approval', {
          p_permission_request_id: izin_id,
          p_approver_uuid: approver_id,
          p_status: status,
          p_potong_gaji: status === 'Disetujui' ? potong : false
        })
        if (error) throw error
      }
      
      await fetchApprovals()
    } catch (err: any) {
      console.error('Error in insertApproval:', err)
      alert(`❌ Gagal menyimpan persetujuan: ${err.message || 'Error tidak diketahui'}`)
    } finally {
      setLoadingId(null)
    }
  }

  // =================== FILTER PENDING (LOGIKA DIPERBAIKI) ===================
  const pendingRequests = useMemo(() => {
    if (!approverRole) return []
    return izinRequests.filter((r) => {
      // Ambil status approval dari tabel approval
      const lvl1 = getApprovalRecord(r.id, 1)
      const lvl2 = getApprovalRecord(r.id, 2)
      
      // Kasubbag: Tampilkan jika Lvl 1 BELUM bertindak
      // DAN status utama BUKAN 'Ditolak' atau 'Disetujui' (sudah final)
      if (approverRole === 'kasubbag') {
        return r.status === 'Menunggu' && (!lvl1 || lvl1.status === 'Menunggu');
      }
      
      // Kepala Kantor: Tampilkan jika Lvl 1 SUDAH setuju
      // DAN Lvl 2 (dia sendiri) BELUM bertindak
      if (approverRole === 'kepala_kantor') {
        return lvl1?.status === 'Disetujui' && (!lvl2 || lvl2.status === 'Menunggu');
      }
      return false
    })
  }, [izinRequests, approvals, approverRole])
  // ======================================================================

  // Filter Riwayat
  const riwayatRequests = useMemo(
    () => izinRequests.filter((r) => r.status === 'Disetujui' || r.status === 'Ditolak'),
    [izinRequests]
  )

  if (loadingPage)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    )

  return (
    <div className="p-6 space-y-8 text-[17px]">
      <div className="flex items-center gap-2">
      </div>

      <h1 className="text-3xl font-bold mt-2 text-left text-gray-800">
        Persetujuan Izin Pegawai ({approverRole === 'kasubbag' ? 'Validator' : 'Approver'})
      </h1>

      {/* ================= PENDING ================= */}
      <Card className="border shadow-sm">
        <CardHeader className="text-left border-b pb-2">
          <CardTitle className="text-lg font-semibold text-gray-800 text-left">
            Daftar Pengajuan Menunggu Persetujuan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-left pt-4">Tidak ada pengajuan menunggu persetujuan.</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl shadow-sm bg-white pb-3 pt-3">
              <table className="min-w-[950px] sm:min-w-full table-auto border-collapse text-[16px] text-center mx-auto">
                <thead className="bg-gray-100 text-center">
                  <tr>
                    {['Nama','Jabatan','Jenis Izin','Periode','Durasi','Alasan','Lampiran'].map((head) => (
                      <th key={head} className="border px-3 py-2 text-center">{head}</th>
                    ))}
                    <th className="border px-3 py-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 text-center">
                      <td className="border px-3 py-2">{req.profiles?.full_name || '-'}</td>
                      <td className="border px-3 py-2">{req.profiles?.position || '-'}</td>
                      <td className="border px-3 py-2">{req.jenis_izin}</td>
                      <td className="border px-3 py-2">
                        {formatDate(req.tanggal_mulai)} - {formatDate(req.tanggal_selesai)}
                      </td>
                      <td className="border px-3 py-2 font-semibold">
                        {req.durasi_hari_kerja ?? '?'} Hari
                      </td>
                      <td className="border px-3 py-2">{req.alasan || '-'}</td>
                      <td className="border px-3 py-2">
                        {req.lampiran_url ? (
                          <a
                            href={req.lampiran_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline justify-center"
                          >
                            <FileText className="w-4 h-4" /> Lihat
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="border px-3 py-2">
                        <div className="flex flex-col gap-2 items-center">
                          {approverRole === 'kepala_kantor' && (
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={potongGajiChecks[req.id] || false}
                                onChange={(e) => {
                                  setPotongGajiChecks(prev => ({
                                    ...prev,
                                    [req.id]: e.target.checked
                                  }));
                                }}
                              />
                              Potong Gaji
                            </label>
                          )}
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              disabled={loadingId === req.id}
                              onClick={() => insertApproval(req.id, 'Disetujui')}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {loadingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Setujui'}
                            </Button>
                            <Button
                              size="sm"
                              disabled={loadingId === req.id}
                              onClick={() => insertApproval(req.id, 'Ditolak')}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {loadingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tolak'}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= RIWAYAT ================= */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg font-semibold text-center sm:text-left text-gray-800">
              Riwayat Persetujuan Izin
            </CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama / jabatan / alasan"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {riwayatRequests.length === 0 ? (
            <p className="text-gray-500 text-center pt-4">Belum ada riwayat persetujuan.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm pt-3">
              <table className="min-w-[950px] sm:min-w-full table-auto border-collapse text-[15px] text-center mx-auto">
                <thead className="bg-gray-100">
                  <tr>
                    {['Nama','Jabatan','Jenis Izin','Periode','Durasi','Alasan','Lampiran','Status', 'Potong Gaji'].map((head) => (
                      <th key={head} className="border px-3 py-2 text-center">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riwayatRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 text-center">
                      <td className="border px-3 py-2">{r.profiles?.full_name || '-'}</td>
                      <td className="border px-3 py-2">{r.profiles?.position || '-'}</td>
                      <td className="border px-3 py-2">{r.jenis_izin}</td>
                      <td className="border px-3 py-2">
                        {formatDate(r.tanggal_mulai)} - {formatDate(r.tanggal_selesai)}
                      </td>
                      <td className="border px-3 py-2 font-semibold">
                        {r.durasi_hari_kerja ?? '?'} Hari
                      </td>
                      <td className="border px-3 py-2">{r.alasan || '-'}</td>
                      <td className="border px-3 py-2">
                        {r.lampiran_url ? (
                          <a
                            href={r.lampiran_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 justify-center"
                          >
                            <FileText className="w-4 h-4" /> Lihat
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td
                        className={`border px-3 py-2 font-semibold ${
                          r.status === 'Disetujui'
                            ? 'text-green-600'
                            : r.status === 'Ditolak'
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {r.status}
                      </td>
                      <td className="border px-3 py-2 font-semibold">
                        {r.potong_gaji ? <span className="text-red-600">Ya</span> : 'Tidak'}
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