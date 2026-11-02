'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeCanvas } from 'qrcode.react'
// UBAH IMPORT INI AGAR FITUR STYLE (WARNA/BORDER) BERFUNGSI
import XLSX from 'xlsx-js-style' 
import { Loader2, ArrowLeft, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

// ======================= TYPES =======================
type LeaveRequest = {
  id: number
  user_id: string
  leave_type: string
  start_date?: string
  end_date?: string
  status?: 'Menunggu' | 'Disetujui' | 'Ditolak'
  address?: string
  reason?: string
  approved_by?: string
  created_at?: string
  half_day?: boolean
  profiles?: { full_name?: string; position?: string } | null
  sisa_cuti_saat_pengajuan?: number // Untuk Riwayat (Snapshot)
  durasi_hari_kerja?: number
  leave_days?: number
  sisa_cuti_realtime?: number // Untuk Pending (Real-time)
  surat_sakit_url?: string | null
}

type LeaveApproval = {
  id: number
  leave_request_id: number
  approver_id: string
  level: 1 | 2
  status: 'Menunggu' | 'Disetujui' | 'Ditolak'
  approved_at: string | null
  qr_code_url: string | null
}

// ======================= COMPONENT =======================
export default function ApprovalCutiPage() {
  const router = useRouter()
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [approvals, setApprovals] = useState<LeaveApproval[]>([])
  const [approverRole, setApproverRole] = useState<'kasubbag' | 'kepala_kantor' | null>(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [loadingPage, setLoadingPage] = useState<boolean>(true)
  const [globalFilter, setGlobalFilter] = useState('')

  // State untuk Filter Excel
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // ======================= HELPERS =======================
  const getApprovalRecord = (leaveId: number, level: 1 | 2) =>
    approvals.find((a) => a.leave_request_id === leaveId && a.level === level) || null

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  // =================== FETCH (DIMODIFIKASI) ===================
  const fetchLeaveRequests = async () => {
    try {
      setLoadingPage(true)
      // 1. Ambil data dasar
      const { data, error } = await supabase
        .from('leave_requests')
        .select(
          `id,user_id,leave_type,start_date,end_date,status,address,reason,approved_by,created_at,half_day,
           sisa_cuti_saat_pengajuan, leave_days, durasi_hari_kerja, 
           surat_sakit_url, 
           profiles(full_name,position)`
        )
        .order('created_at', { ascending: false })
      if (error) throw error

      const safeData = Array.isArray(data)
        ? data.map((d: any) => ({ ...d, profiles: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles }))
        : []
      
      // 2. Ambil data Sisa Cuti REAL-TIME
      const currentYear = new Date().getFullYear();
      const requestsWithRealtimeQuota = await Promise.all(
        safeData.map(async (lr: LeaveRequest) => {
          
          // =================== INI PERBAIKANNYA ===================
          // Kita perlu sisa cuti realtime jika jenisnya 'Cuti Tahunan' ATAU 'Cuti Sakit'
          if (lr.leave_type !== 'Cuti Tahunan' && lr.leave_type !== 'Cuti Sakit') {
          // ========================================================
            return { ...lr, sisa_cuti_realtime: null }; // 
          }
          
          // Jika Cuti Tahunan atau Cuti Sakit, LANJUT ambil kuota
          const { data: quotaData } = await supabase
            .from('master_leave_quota')
            .select('annual_quota, used_leave')
            .eq('user_id', lr.user_id)
            .eq('year', currentYear)
            .single();
            
          let realtimeBalance = 0;
          if (quotaData) {
            realtimeBalance = quotaData.annual_quota - quotaData.used_leave;
          }
          
          return { ...lr, sisa_cuti_realtime: realtimeBalance };
        })
      );
      
      setLeaveRequests(requestsWithRealtimeQuota as LeaveRequest[])

    } catch (err) {
      console.error(err)
      setLeaveRequests([])
    } finally {
      setLoadingPage(false)
    }
  }

  const fetchApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_approvals')
        .select('*')
        .order('approved_at', { ascending: false })
      if (error) throw error
      setApprovals(Array.isArray(data) ? data : [])
    } catch {
      setApprovals([])
    }
  }

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

  // ======================= EFFECT =======================
  useEffect(() => {
    const init = async () => await Promise.all([fetchLeaveRequests(), fetchApprovals(), fetchApproverRole()])
    init()

    const channel = supabase
      .channel('realtime-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_approvals' }, async () => {
        await Promise.all([fetchLeaveRequests(), fetchApprovals()])
      })
      .subscribe()

    return () => {
      // @ts-ignore
      supabase.removeChannel(channel)
    }
  }, [])

  // ======================= APPROVAL ACTION =======================
  const insertApproval = async (leave_request_id: number, status: 'Disetujui' | 'Ditolak') => {
    if (!approverRole) return alert('Role belum ditentukan.')
    setLoadingId(leave_request_id)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const approver_id = userData.user?.id
      if (!approver_id) return alert('❌ Tidak ditemukan ID pengguna.')

      const level = approverRole === 'kasubbag' ? 1 : 2

      if (level === 1) {
        const existingApproval = getApprovalRecord(leave_request_id, 1)
        if (existingApproval) {
          await supabase
            .from('leave_approvals')
            .update({ status, approver_id, approved_at: new Date().toISOString() })
            .eq('leave_request_id', leave_request_id)
            .eq('level', 1)
        } else {
          await supabase.from('leave_approvals').insert([
            { leave_request_id, approver_id, level: 1, status, approved_at: new Date().toISOString() },
          ])
        }
      } else if (level === 2) {
        const level1Approval = getApprovalRecord(leave_request_id, 1)
        if (status === 'Disetujui' && level1Approval?.status !== 'Disetujui') {
          return alert('❌ Kepala Kantor hanya dapat menyetujui jika Kasubbag sudah menyetujui.')
        }

        const { data, error } = await supabase.rpc('handle_level_2_approval', {
          p_leave_request_id: leave_request_id,
          p_approver_uuid: approver_id,
          p_status: status,
        })

        if (error) throw new Error(error.message)
        if (data && data.status === 'error') throw new Error(data.message)
      }

      await Promise.all([fetchApprovals(), fetchLeaveRequests()])
    } catch (err: any) {
      console.error('Full error caught in insertApproval:', err)
      alert(`❌ Gagal menyimpan persetujuan: ${err.message || 'Error tidak diketahui'}`)
    } finally {
      setLoadingId(null)
    }
  }

  // =================== EXPORT EXCEL ===================
  const exportToExcel = () => {
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('id-ID', { month: 'long' }).toUpperCase();
    const yearName = selectedYear;

    const filteredData = leaveRequests
      .filter((lr) => lr.status === 'Disetujui' || lr.status === 'Ditolak')
      .filter((lr) => {
        if (!lr.start_date) return false;
        const leaveStartDate = new Date(lr.start_date);
        return leaveStartDate.getMonth() + 1 === selectedMonth && 
               leaveStartDate.getFullYear() === selectedYear;
      });

    if (filteredData.length === 0) {
      return alert(`Tidak ada data persetujuan untuk cuti yang dimulai di bulan ${monthName} ${yearName}.`);
    }

    const dataToExport = filteredData.map((lr) => {
        const approval = approvals.find((a) => a.leave_request_id === lr.id && a.level === 2 && a.status === 'Disetujui')
        const lastApproval =
          approval ||
          [...approvals]
            .filter((a) => a.leave_request_id === lr.id)
            .sort((a, b) => new Date(b.approved_at || 0).getTime() - new Date(a.approved_at || 0).getTime())[0]

        return {
          'ID': lr.id,
          'Nama': lr.profiles?.full_name || '-',
          'Sisa Cuti': (lr.sisa_cuti_saat_pengajuan??0)-(lr.leave_days ?? 0),
          'Jabatan': lr.profiles?.position || '-',
          'Jenis Cuti': lr.leave_type || '-',
          'Periode': `${lr.start_date ? new Date(lr.start_date).toLocaleDateString('id-ID') : '-'} - ${lr.end_date ? new Date(lr.end_date).toLocaleDateString('id-ID') : '-'}`,
          'Durasi (Hari Kerja)': lr.leave_days || '-',
          'Status': lr.status || '-',
          'Tanggal Persetujui': lastApproval?.approved_at
            ? new Date(lastApproval.approved_at).toLocaleDateString('id-ID')
            : '-',
          'Alamat': lr.address || '-',
          'Alasan Cuti': lr.reason || '-',
          'QR Code URL': approval?.qr_code_url || '-',
        }
      })
    
    const title = [`REKAPITULASI PERSETUJUAN CUTI PEGAWAI`];
    const subTitle = [`BULAN: ${monthName} ${yearName}`];
    const emptyRow: (string | number)[] = [];
    
    // Ganti utils.aoa_to_sheet biasa dengan inisialisasi sheet
    const worksheet = XLSX.utils.aoa_to_sheet([title, subTitle, emptyRow]);
    
    // Tambahkan JSON data mulai baris ke-4
    XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: 'A4' });

    const allBorders = {
      top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
    };
    const titleStyle = { 
      font: { bold: true, sz: 16 }, 
      alignment: { vertical: 'center', horizontal: 'center' } 
    };
    const subTitleStyle = { 
      font: { bold: true, sz: 12 }, 
      alignment: { vertical: 'center', horizontal: 'center' } 
    };
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: '4F81BD' } },
      border: allBorders,
      alignment: { vertical: 'center', horizontal: 'center' },
    };
    const cellStyle = {
      border: allBorders,
      alignment: { vertical: 'top', horizontal: 'left', wrapText: true }
    };

    const headers = Object.keys(dataToExport[0]);
    const numCols = headers.length;
    const colWidths = headers.map((header) => {
      let maxLen = header.length + 5;
      dataToExport.forEach((row) => {
        // @ts-ignore
        const value = row[header];
        if (value != null) {
          const len = value.toString().length;
          if (len > maxLen) { maxLen = len; }
        }
      });
      let width = Math.max(15, maxLen)
      if (width > 50) width = 50;
      return { wch: width };
    });
    worksheet['!cols'] = colWidths;

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }
    ];

    // APPLY STYLES MANUAL
    if (!worksheet['A1']) worksheet['A1'] = { v: title[0] };
    worksheet['A1'].s = titleStyle;
    
    if (!worksheet['A2']) worksheet['A2'] = { v: subTitle[0] };
    worksheet['A2'].s = subTitleStyle;

    // Header Style (Baris 3, index 3 -> A4 di Excel)
    for (let C = 0; C < numCols; ++C) {
      const headerCellAddress = XLSX.utils.encode_cell({ r: 3, c: C });
      if (worksheet[headerCellAddress]) {
        worksheet[headerCellAddress].s = headerStyle;
      }
    }
    
    // Body Style
    for (let R = 4; R <= range.e.r; ++R) {
      for (let C = 0; C < numCols; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (worksheet[cellAddress]) {
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = cellStyle;
          else worksheet[cellAddress].s = { ...cellStyle, ...worksheet[cellAddress].s };
        } else {
          // Isi cell kosong dengan style border
          XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: cellAddress });
          worksheet[cellAddress].s = cellStyle;
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Cuti Bulanan');
    XLSX.writeFile(workbook, `rekap_cuti_${monthName.toLowerCase()}_${yearName}.xlsx`);
  }
  // =================== AKHIR FUNGSI EXPORT ===================


  // ======================= FILTER DATA =======================
  const pendingRequests = useMemo(() => {
    if (!approverRole) return []
    return leaveRequests.filter((lr) => {
      const level1Approval = getApprovalRecord(lr.id, 1)
      const level2Approval = getApprovalRecord(lr.id, 2)
      if (approverRole === 'kasubbag') return !level1Approval || level1Approval.status === 'Menunggu'
      if (approverRole === 'kepala_kantor')
        return level1Approval?.status === 'Disetujui' && (!level2Approval || level2Approval.status === 'Menunggu')
      return false
    })
  }, [leaveRequests, approvals, approverRole])

  const riwayatRequests = useMemo(
    () => leaveRequests.filter((lr) => lr.status === 'Disetujui' || lr.status === 'Ditolak'),
    [leaveRequests]
  )

  // RIWAYAT: Menggunakan sisa_cuti_saat_pengajuan (Snapshot)
  const riwayatData = useMemo(
    () =>
      riwayatRequests.map((lr) => {
        const approvalLevel2 = approvals.find((a) => a.leave_request_id === lr.id && a.level === 2)
        return {
          nama: lr.profiles?.full_name || '-',
          sisa_cuti: (lr.sisa_cuti_saat_pengajuan ?? 0)-(lr.leave_days??0), // <-- Menggunakan SNAPSHOT
          jabatan: lr.profiles?.position || '-',
          jenis: lr.leave_type || '-',
          periode: `${formatDate(lr.start_date)} - ${formatDate(lr.end_date)}`,
          durasi: `${lr.leave_days || '?'} hari`,
          alamat: lr.address || '-',
          alasan: lr.reason || '-',
          status: lr.status || 'Menunggu',
          qr: approvalLevel2?.qr_code_url || null,
        }
      }),
    [riwayatRequests, approvals]
  )

  // KOLOM RIWAYAT
  const columns = useMemo<ColumnDef<typeof riwayatData[0]>[]>(() => [
    { accessorKey: 'nama', header: 'Nama' },
    {
      accessorKey: 'sisa_cuti',
      header: 'Sisa Cuti',
      cell: (info) => <span>{String(info.getValue())}</span>,
    },
    { accessorKey: 'jabatan', header: 'Jabatan' },
    { accessorKey: 'jenis', header: 'Jenis Cuti' },
    { accessorKey: 'periode', header: 'Periode' },
    { accessorKey: 'durasi', header: 'Durasi' },
    { accessorKey: 'alamat', header: 'Alamat' },
    { accessorKey: 'alasan', header: 'Alasan Cuti' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => (
        <span
          className={`font-semibold ${
            String(info.getValue()) === 'Disetujui'
              ? 'text-green-600'
              : String(info.getValue()) === 'Ditolak'
              ? 'text-red-600'
              : 'text-gray-500'
          }`}
        >
          {String(info.getValue())}
        </span>
      ),
    },
    {
      accessorKey: 'qr',
      header: 'QR Code',
      cell: (info) =>
        info.getValue() ? (
          <QRCodeCanvas value={String(info.getValue())} size={70} className="border rounded-lg shadow-sm mx-auto" />
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
  ], [])

  const table = useReactTable({
    data: riwayatData,
    columns,
    state: { globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  if (loadingPage)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    )

  return (
    <div className="p-6 space-y-8 text-[17px]">
      <div className="flex flex-col sm:flex-row items-center gap-2">

        <div className="ml-auto flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="flex-grow sm:flex-grow-0">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full sm:w-auto border rounded-md px-2 py-2 text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-grow sm:flex-grow-0">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full sm:w-auto border rounded-md px-2 py-2 text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
              <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
            </select>
          </div>
          <Button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-700 text-white">
            Export Rekap Bulanan
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold mt-2">
        Persetujuan Cuti Pegawai ({approverRole === 'kasubbag' ? 'Validator' : 'Approver'})
      </h1>

      {/* ================= TABEL PENDING (Rata Tengah + Sisa Cuti Realtime + Cuti Sakit) ================= */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Daftar Pengajuan Menunggu Persetujuan</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500">Tidak ada pengajuan menunggu persetujuan.</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl shadow-sm bg-white pb-3">
              <table className="min-w-[900px] sm:min-w-full table-auto border-collapse text-[16px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-center">Nama</th>
                    <th className="border px-3 py-2 text-center">Sisa Cuti</th>
                    <th className="border px-3 py-2 text-center">Jabatan</th>
                    <th className="border px-3 py-2 text-center">Jenis Cuti</th>
                    <th className="border px-3 py-2 text-center">Periode</th>
                    <th className="border px-3 py-2 text-center">Durasi</th>
                    <th className="border px-3 py-2 text-center">Alamat</th>
                    <th className="border px-3 py-2 text-center">Alasan Cuti</th>
                    <th className="border px-3 py-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="border px-3 py-2 text-center">{req.profiles?.full_name || '-'}</td>
                      
                      {/* =================== PERBAIKAN TAMPILAN SISA CUTI =================== */}
                      {/* Ini adalah logika yang sudah kita sepakati */}
                      <td className="border px-3 py-2 text-center">
                        { req.leave_type === 'Cuti Tahunan' || (req.leave_type === 'Cuti Sakit' && !req.surat_sakit_url) 
                          ? (req.sisa_cuti_realtime ?? 0) // Tampilkan sisa cuti realtime
                          : '-' // Tampilkan '-' jika Cuti Sakit+Surat atau Cuti Lainnya
                        }
                      </td>
                      {/* =================================================================== */}
                      
                      <td className="border px-3 py-2 text-center">{req.profiles?.position || '-'}</td>
                      <td className="border px-3 py-2 text-center">{req.leave_type}</td>
                      <td className="border px-3 py-2 text-center">
                        {formatDate(req.start_date)} - {formatDate(req.end_date)}
                      </td>
                      <td className="border px-3 py-2 text-center">{req.leave_days || '-'} hari</td>
                      <td className="border px-3 py-2 text-center">{req.address || '-'}</td>

                      {/* Alasan Cuti DENGAN Status Surat Dokter */}
                      <td className="border px-3 py-2 text-center">
                        {req.reason || '-'}
                        {req.leave_type === 'Cuti Sakit' && (
                          req.surat_sakit_url ? (
                            <a 
                              href={req.surat_sakit_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline block mt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              (Lihat Surat Dokter)
                            </a>
                          ) : (
                            <span className="text-xs text-red-600 block mt-1">
                              (Tanpa Surat Dokter)
                            </span>
                          )
                        )}
                      </td>
                      
                      <td className="border px-3 py-2 text-center">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= TABEL RIWAYAT (Rata Tengah + Sisa Cuti Snapshot) ================= */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="mb-3 text-lg font-semibold">Riwayat Persetujuan Cuti</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama / jabatan / jenis / alasan"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto rounded-xl shadow-sm bg-white pb-3">
            <table className="min-w-[900px] sm:min-w-full table-auto border-collapse text-[15px]">
              <thead className="bg-gray-100">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="border px-3 py-2 text-center">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border px-3 py-2 text-center ">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}