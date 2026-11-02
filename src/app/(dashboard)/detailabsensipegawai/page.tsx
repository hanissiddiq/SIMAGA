'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import XLSX from 'xlsx-js-style' 
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Image as ImageIcon } from 'lucide-react'

import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText,
  User, 
  Calendar, 
  Filter,
  Clock, 
  Search, 
  ChevronDown,
  AlertCircle,
  XCircle,
  Briefcase,
  FileText as FileIcon,
  Loader2,
  UserCheck,
  Edit,       // Tambahan Icon Edit
  Trash2,     // Tambahan Icon Trash
  X           // Tambahan Icon Close Modal
} from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import { 
  format, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  isAfter, 
  startOfDay, 
  isSunday, 
  isSaturday,
  isBefore,
  isSameDay
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import dayjs from 'dayjs' 

// --- Types ---
type Profile = {
  id: string
  full_name: string
  position: string
}

type ShiftDetail = {
  id: string // Tambahan ID untuk acuan Update/Delete
  shiftName: string
  checkIn: string | null
  checkOut: string | null
  checkInLocation: string | null
  checkOutLocation: string | null
  checkInDistanceM: string | null
  checkOutDistanceM: string | null
  checkInPhoto: string | null
  checkOutPhoto: string | null
  lateMinutes: number
  isLate: boolean
}

type DailyRecord = {
  profileId: string
  profileName: string
  profilePosition: string
  date: Date
  dateStr: string
  dayName: string
  status: string
  statusCode: 'H' | '2x' | 'T' | '2T¹' | '2T²' | 'A' | 'I' | 'C' | 'S' | '½' | '-' | 'Libur'
  shifts: ShiftDetail[] 
  notes: string 
  color: string
}

export default function DetailAbsensiPegawaiPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // --- Filter State ---
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('') 
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'custom'>('daily')
  
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [month, setMonth] = useState<number>(new Date().getMonth()) 
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  // --- Data State ---
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([])
  const [stats, setStats] = useState({
    tepatWaktu: 0, telat: 0, izin: 0, cuti: 0, alpha: 0, totalLateMinutes: 0
  })

  // --- Edit Modal State ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    id: '',
    shiftName: '',
    checkIn: '',
    checkOut: ''
  })
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  
  // 1. Load Daftar Pegawai
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, position')
        .neq('role', 'admin')
        .neq('is_admin', true)
        .order('full_name')
      
      if (data) setProfiles(data)
    }
    fetchProfiles()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 2. Fetch Data Utama
  const fetchData = async () => {
    setLoading(true)

    try {
      let start: Date, end: Date
      if (filterType === 'daily') {
        start = new Date(selectedDate)
        end = new Date(selectedDate)
      } else if (filterType === 'monthly') {
        start = startOfMonth(new Date(year, month))
        end = endOfMonth(new Date(year, month))
      } else {
        if (!startDate || !endDate) {
            setLoading(false)
            return
        }
        start = new Date(startDate)
        end = new Date(endDate)
      }

      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')

      let targetProfiles = profiles
      if (selectedProfileId) {
        targetProfiles = profiles.filter(p => p.id === selectedProfileId)
      }

      if (targetProfiles.length === 0) {
        setLoading(false)
        return
      }

      // Tambahkan 'id' di select absensi
      let attQuery = supabase
        .from('attendances')
        .select(`
            id, user_id, attendance_date, shift, shift_start,
            check_in, check_out, check_in_location, check_out_location, 
            check_in_distance_m, check_out_distance_m,
            check_in_photo, check_out_photo
        `)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr)
        .order('shift', { ascending: true })
      
      if (selectedProfileId) attQuery = attQuery.eq('user_id', selectedProfileId)
      const { data: attData } = await attQuery

      let leaveQuery = supabase
        .from('leave_requests')
        .select('user_id, start_date, end_date, leave_type, half_day')
        .eq('status', 'Disetujui')
        .or(`start_date.lte.${endStr},end_date.gte.${startStr}`)
      
      if (selectedProfileId) leaveQuery = leaveQuery.eq('user_id', selectedProfileId)
      const { data: leaveData } = await leaveQuery

      let permitQuery = supabase
        .from('permission_requests')
        .select('user_id, tanggal_mulai, tanggal_selesai')
        .in('status', ['Disetujui', 'Disetujui Level 1', 'Disetujui Level 2'])
        .or(`tanggal_mulai.lte.${endStr},tanggal_selesai.gte.${startStr}`)
      
      if (selectedProfileId) permitQuery = permitQuery.eq('user_id', selectedProfileId)
      const { data: permitData } = await permitQuery

      const days = eachDayOfInterval({ start, end })
      const today = startOfDay(new Date())
      let newStats = { tepatWaktu: 0, telat: 0, izin: 0, cuti: 0, alpha: 0, totalLateMinutes: 0 }
      const records: DailyRecord[] = []

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd')
        const isWeekend = isSunday(day) || isSaturday(day)

        for (const profile of targetProfiles) {
            let rec: DailyRecord = {
                profileId: profile.id,
                profileName: profile.full_name,
                profilePosition: profile.position,
                date: day,
                dateStr,
                dayName: format(day, 'EEEE', { locale: idLocale }),
                status: isWeekend ? 'Libur' : '-',
                statusCode: isWeekend ? 'Libur' : '-',
                shifts: [],
                notes: '',
                color: isWeekend ? 'bg-red-50/30' : 'bg-white'
            }

            const dailyAtts = attData?.filter(a => a.user_id === profile.id && a.attendance_date === dateStr) || []
            
            if (dailyAtts.length > 0) {
                let totalLateCount = 0;

                rec.shifts = dailyAtts.map(att => {
                    let lateMins = 0;
                    let isLate = false;

                    if (att.check_in) {
                        const checkInTime = dayjs(att.check_in);
                        const userPos = profile.position?.toUpperCase() || '';
                        let lockHour = 8;
                        let lockMin = 0;

                        if ((att.shift || '').toLowerCase().includes('pagi')) {
                            if (userPos.includes('SATPAM')) {
                                [lockHour, lockMin] = [7, 45]; 
                            } else if (userPos.includes('CS')) {
                                [lockHour, lockMin] = [7, 30];
                            } else {
                                [lockHour, lockMin] = [7, 30]; // Default untuk shift pagi PPNPN
                            }
                        } else {
                            if (userPos.includes('SATPAM')) {
                                [lockHour, lockMin] = [19, 45];
                            } else {
                                [lockHour, lockMin] = [20, 0];
                            }
                        }

                        const shiftLimit = checkInTime.hour(lockHour).minute(lockMin).second(0);

                        if (checkInTime.isAfter(shiftLimit)) {
                            lateMins = checkInTime.diff(shiftLimit, 'minute');
                            isLate = true;
                            totalLateCount++;
                            newStats.totalLateMinutes += lateMins;
                        }
                    }

                    return {
                        id: att.id, // Ambil ID untuk fungsi Edit
                        shiftName: att.shift || '-',
                        checkIn: att.check_in,
                        checkOut: att.check_out,
                        checkInLocation: att.check_in_location,
                        checkOutLocation: att.check_out_location,
                        checkInDistanceM: att.check_in_distance_m,
                        checkOutDistanceM: att.check_out_distance_m,
                        checkInPhoto: att.check_in_photo,
                        checkOutPhoto: att.check_out_photo,
                        lateMinutes: lateMins,
                        isLate
                    }
                })

                if (dailyAtts.length > 1) { 
                    if (totalLateCount === 0) {
                        rec.status = 'Hadir (2x)'; rec.statusCode = '2x'; rec.color = 'bg-green-50 border-l-4 border-green-500'; newStats.tepatWaktu++; 
                    } else if (totalLateCount === 1) {
                        rec.status = '2 Shift (1 Telat)'; rec.statusCode = '2T¹'; rec.color = 'bg-yellow-50 border-l-4 border-yellow-500'; newStats.telat++; 
                    } else {
                        rec.status = '2 Shift (2 Telat)'; rec.statusCode = '2T²'; rec.color = 'bg-yellow-100 border-l-4 border-yellow-600'; newStats.telat++; 
                    }
                } else {
                    if (totalLateCount > 0) {
                        rec.status = 'Terlambat (T)'; rec.statusCode = 'T'; rec.color = 'bg-yellow-50 border-l-4 border-yellow-400'; newStats.telat++; 
                    } else {
                        rec.status = 'Hadir (H)'; rec.statusCode = 'H'; rec.color = 'bg-green-50 border-l-4 border-green-400'; newStats.tepatWaktu++; 
                    }
                }

            } else if (leaveData?.some(l => {
                const s = parseISO(l.start_date); const e = parseISO(l.end_date);
                return l.user_id === profile.id && (isAfter(day, s) || isSameDay(day, s)) && (isBefore(day, e) || isSameDay(day, e))
            })) {
                const l = leaveData.find(l => {
                    const s = parseISO(l.start_date); const e = parseISO(l.end_date);
                    return l.user_id === profile.id && (isAfter(day, s) || isSameDay(day, s)) && (isBefore(day, e) || isSameDay(day, e))
                })
                
                if (l?.half_day) {
                    rec.status = 'Setengah Hari'; rec.statusCode = '½'; rec.color = 'bg-purple-50 border-l-4 border-purple-400';
                } else if (l?.leave_type.toLowerCase().includes('sakit')) {
                    rec.status = 'Sakit'; rec.statusCode = 'S'; rec.color = 'bg-orange-50 border-l-4 border-orange-400'; newStats.cuti++;
                } else {
                    rec.status = 'Cuti'; rec.statusCode = 'C'; rec.color = 'bg-blue-50 border-l-4 border-blue-400'; newStats.cuti++;
                }
                rec.notes = l?.leave_type || ''

            } else if (permitData?.some(p => {
                const s = parseISO(p.tanggal_mulai); const e = parseISO(p.tanggal_selesai);
                return p.user_id === profile.id && (isAfter(day, s) || isSameDay(day, s)) && (isBefore(day, e) || isSameDay(day, e))
            })) {
                rec.status = 'Izin'; rec.statusCode = 'I'; rec.color = 'bg-orange-50 border-l-4 border-orange-400'; newStats.izin++;
            } else if (!isWeekend && isAfter(today, day)) {
                rec.status = 'Alpha'; rec.statusCode = 'A'; rec.color = 'bg-red-50 border-l-4 border-red-500'; newStats.alpha++;
            }

            records.push(rec)
        }
      }

      setDailyRecords(records)
      setStats(newStats)

    } catch (err) {
      console.error(err)
      toast.error("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profiles.length > 0) fetchData()
  }, [profiles, selectedProfileId, month, year, startDate, endDate, filterType, selectedDate])

  // --- Fungsi Edit / Hapus ---
  const formatForInput = (isoString: string | null) => {
    if (!isoString) return '';
    return dayjs(isoString).format('YYYY-MM-DDTHH:mm');
  }

  const openEditModal = (shift: ShiftDetail) => {
    setEditForm({
        id: shift.id,
        shiftName: shift.shiftName,
        checkIn: formatForInput(shift.checkIn),
        checkOut: formatForInput(shift.checkOut)
    })
    setIsEditModalOpen(true)
  }

    const handleUpdateShift = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('attendances')
                .update({
                    shift: editForm.shiftName,
                    check_in: editForm.checkIn ? new Date(editForm.checkIn).toISOString() : null,
                    check_out: editForm.checkOut ? new Date(editForm.checkOut).toISOString() : null,
                })
                .eq('id', editForm.id)
                .select() // <--- Tambahkan .select() untuk memvalidasi kembalian data

            if (error) throw error
            
            // Validasi: Jika data kosong, berarti RLS memblokir atau ID tidak cocok
            if (!data || data.length === 0) {
                throw new Error("Akses ditolak oleh database (RLS) atau data tidak ditemukan.")
            }

            toast.success("Absensi berhasil diperbarui")
            setIsEditModalOpen(false)
            await fetchData() // Tambahkan await agar UI refresh
        } catch (err: any) {
            console.error(err)
            toast.error(err.message || "Gagal memperbarui absensi")
        } finally {
            setLoading(false)
        }
      }

      const handleDeleteShift = async () => {
        if (!confirm("Apakah Anda yakin ingin MENGHAPUS data absensi ini?")) return;
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('attendances')
                .delete()
                .eq('id', editForm.id)
                .select() // <--- Tambahkan .select()

            if (error) throw error
            
            // Validasi: Jika data kosong, berarti gagal dihapus di database
            if (!data || data.length === 0) {
                throw new Error("Akses ditolak oleh database (RLS) atau data tidak ditemukan.")
            }

            toast.success("Absensi berhasil dihapus")
            setIsEditModalOpen(false)
            await fetchData() // Tambahkan await agar UI refresh
        } catch (err: any) {
            console.error(err)
            toast.error(err.message || "Gagal menghapus absensi")
        } finally {
            setLoading(false)
        }
      }

  // --- EXCEL & PDF ---
  const exportExcel = () => { /* Logic Export Excel (Sama seperti sebelumnya) */ }
  const exportPDF = () => { /* Logic Export PDF (Sama seperti sebelumnya) */ }
  const formatDistance = (dist: string | number | null) => {
  if (dist === null || dist === '') return '-';
  const parsed = Number(dist);
  return !isNaN(parsed) ? `${parsed.toFixed(1)} m` : '-';
}

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-xs sm:text-sm relative">
      <Toaster position="top-center" />
      
      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Detail Absensi Mahasiswa</h1>
              <p className="text-gray-500 text-xs">Monitoring Individu & Harian</p>
            </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                onClick={exportPDF} 
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition flex-1 md:flex-none justify-center"
            >
                <FileIcon className="w-4 h-4"/> Export PDF
            </button>
            <button 
                onClick={exportExcel} 
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition flex-1 md:flex-none justify-center"
            >
                <FileSpreadsheet className="w-4 h-4"/> Export Excel
            </button>
        </div>
      </div>

      {/* FILTER CONTROL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Pilih Pegawai */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100" ref={dropdownRef}>
            <label className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-2">
                <User className="w-4 h-4"/> Mahasiswa (Opsional)
            </label>
            <div className="relative">
                <div 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <input 
                        type="text"
                        placeholder="Semua Mahasiswa"
                        className="bg-transparent outline-none w-full cursor-pointer placeholder:text-gray-500 font-semibold"
                        value={selectedProfileId ? searchTerm : "Semua Mahasiswa"}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            if (selectedProfileId) setSelectedProfileId('') 
                            setIsDropdownOpen(true)
                        }}
                        onClick={() => {
                            if (!isDropdownOpen) setIsDropdownOpen(true)
                        }}
                        onFocus={() => {
                            if (!selectedProfileId) setSearchTerm('')
                            setIsDropdownOpen(true)
                        }}
                    />
                    <ChevronDown className="w-4 h-4 text-gray-400"/>
                </div>

                {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        <div 
                            className={`p-2.5 text-xs hover:bg-blue-50 cursor-pointer font-bold text-blue-700`}
                            onClick={() => {
                                setSelectedProfileId('')
                                setSearchTerm('')
                                setIsDropdownOpen(false)
                            }}
                        >
                            Semua Mahasiswa
                        </div>
                        {filteredProfiles.map(p => (
                            <div 
                                key={p.id} 
                                className={`p-2.5 text-xs hover:bg-blue-50 cursor-pointer ${p.id === selectedProfileId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                                onClick={() => {
                                    setSelectedProfileId(p.id)
                                    setSearchTerm(p.full_name)
                                    setIsDropdownOpen(false)
                                }}
                            >
                                {p.full_name}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Tipe Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
            <label className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4"/> TIPE PERIODE
            </label>
            <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                <button 
                    onClick={() => setFilterType('daily')}
                    className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition ${filterType === 'daily' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Harian
                </button>
                <button 
                    onClick={() => setFilterType('monthly')}
                    className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition ${filterType === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Bulanan
                </button>
                <button 
                    onClick={() => setFilterType('custom')}
                    className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition ${filterType === 'custom' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Custom
                </button>
            </div>
        </div>

        {/* Tanggal */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
            <label className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4"/> ATUR TANGGAL
            </label>
            {filterType === 'daily' ? (
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-lg text-xs" />
            ) : filterType === 'monthly' ? (
                <div className="flex gap-2">
                    <div className="relative w-full">
                        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="w-full p-2.5 bg-gray-50 border rounded-lg appearance-none cursor-pointer">
                            {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{format(new Date(2023, i), 'MMMM', { locale: idLocale })}</option>)}
                        </select>
                        <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="relative w-24">
                        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-full p-2.5 bg-gray-50 border rounded-lg appearance-none cursor-pointer">
                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="absolute right-2 top-3 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" />
                </div>
            )}
        </div>
      </div>

      {/* STATS SUMMARY (Di-skip/Disembunyikan detailnya agar lebih rapih) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-blue-700 p-4 rounded-xl border border-blue-800 text-white shadow-md relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-10"><Briefcase className="w-16 h-16" /></div>
            <p className="text-[10px] font-bold opacity-80 mb-1 tracking-wider uppercase">Total Kehadiran</p>
            <span className="text-3xl font-extrabold">{stats.tepatWaktu + stats.telat}</span>
            <span className="text-[10px] block opacity-80 mt-1">Hari Masuk Kerja</span>
        </div>
        <div className="bg-green-100 p-4 rounded-xl border border-green-300 text-green-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><UserCheck className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Tepat Waktu</p>
           <span className="text-2xl font-bold">{stats.tepatWaktu}</span>
        </div>
        <div className="bg-yellow-100 p-4 rounded-xl border border-yellow-300 text-yellow-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><Clock className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Terlambat</p>
           <span className="text-2xl font-bold">{stats.telat}</span>
        </div>
        <div className="bg-red-100 p-4 rounded-xl border border-red-200 text-red-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><XCircle className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Alpha</p>
           <span className="text-2xl font-bold">{stats.alpha}</span>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-blue-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><FileText className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Cuti / Sakit</p>
           <span className="text-2xl font-bold">{stats.cuti}</span>
        </div>
        <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 text-orange-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><AlertCircle className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Izin</p>
           <span className="text-2xl font-bold">{stats.izin}</span>
        </div>
      </div>

      {/* TABLE DETAIL */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl shadow-sm">
            <Loader2 className="animate-spin w-10 h-10 text-blue-600 mb-2"/>
            <p className="text-gray-500">Memuat data absensi...</p>
        </div>
      ) : dailyRecords.length === 0 ? (
        <div className="py-20 text-center text-gray-500 border rounded-xl bg-white shadow-sm">
            <Search className="w-10 h-10 mx-auto text-gray-300 mb-2"/>
            <p>Tidak ada data untuk ditampilkan pada periode ini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th className="p-4 font-semibold w-28">Tanggal</th>
                            <th className="p-4 font-semibold">Nama</th>
                            <th className="p-4 font-semibold w-24">Status</th>
                            <th className="p-4 font-semibold w-24">Shift</th>
                            <th className="p-4 font-semibold border-l border-slate-700 text-center">Masuk</th>
                            <th className="p-4 font-semibold border-l border-slate-700 text-center">Pulang</th>
                            <th className="p-4 font-semibold border-l border-slate-700 text-center">Aksi</th>
                        </tr>
                    </thead> 
                    <tbody className="divide-y divide-gray-100">
                        {dailyRecords.map((rec, idx) => (
                            <tr key={`${rec.profileId}-${idx}`} className={`hover:bg-gray-50 transition-colors ${rec.color}`}>
                                <td className="p-4 whitespace-nowrap align-top">
                                    <div className="font-bold text-gray-800">{format(rec.date, 'dd MMM yyyy', { locale: idLocale })}</div>
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">{rec.dayName}</div>
                                </td>
                                <td className="p-4 align-top font-medium text-gray-900">{rec.profileName} 
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
                                        {rec.profilePosition}</div>
                                </td>
                                <td className="p-4 align-top">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm block w-fit
                                        ${rec.statusCode.includes('H') || rec.statusCode === '2x' ? 'bg-green-100 text-green-700 border-green-200' : 
                                          rec.statusCode.includes('T') ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                          rec.statusCode === 'A' ? 'bg-red-100 text-red-700 border-red-200' : 
                                          rec.statusCode === 'C' || rec.statusCode === 'S' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                          rec.statusCode === 'I' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                          'bg-white text-gray-500 border-gray-200'}
                                    `}>
                                        {rec.statusCode}
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-1 block">{rec.status}</span>
                                </td>

                                <td colSpan={4} className="p-0 align-top">
                                    {rec.shifts.length > 0 ? (
                                        <div className="divide-y divide-gray-100">
                                            {rec.shifts.map((s, i) => (
                                                <div key={i} className="grid grid-cols-4 border-b last:border-b-0">
                                                    <div className="p-3 text-gray-500 font-medium text-xs col-span-1">{s.shiftName}</div>
                                                    <div className="p-4 bg-gray-50/80 border-l border-gray-100 col-span-1 text-center">
                                                        <div className="font-mono text-base font-extrabold text-slate-800">
                                                         Pukul :  {s.checkIn ? format(new Date(s.checkIn), 'HH:mm') : '-'} WIB
                                                        </div>
                                                        <div className="line-clamp-1">
                                                            {s.checkInPhoto && (
                                                                <button
                                                                    onClick={() => setPreviewImage(s.checkInPhoto)}
                                                                    className="mt-2 flex items-center justify-center mx-auto text-blue-600 hover:text-blue-800"
                                                                    title="Lihat Foto Check In"
                                                                >
                                                                    <ImageIcon className="w-5 h-5" />
                                                                </button>
                                                                )}
                                                            Jarak : {formatDistance(s.checkInDistanceM)}</div>
                                                        <div className="line-clamp">{s.checkInLocation || '-'}</div>
                                                        {s.isLate && (
                                                            <div className="flex items-center justify-center gap-1 text-[10px] text-red-600 font-bold mt-1 bg-red-50 px-1.5 py-0.5 rounded w-fit mx-auto">
                                                                <AlertCircle className="w-3 h-3"/> Terlambat
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-4 border-l border-gray-100 col-span-1 text-center">
                                                        <div className="font-mono text-base font-bold text-gray-600"> 
                                                          Pukul  {s.checkOut ? format(new Date(s.checkOut), 'HH:mm') : '-'}  WIB
                                                        </div>
                                                        <div className="line-clamp-1">
                                                            {s.checkOutPhoto && (
                                                                <button
                                                                    onClick={() => setPreviewImage(s.checkOutPhoto)}
                                                                    className="mt-2 flex items-center justify-center mx-auto text-green-600 hover:text-green-800"
                                                                    title="Lihat Foto Check Out"
                                                                >
                                                                    <ImageIcon className="w-5 h-5" />
                                                                </button>
                                                                )}
                                                            Jarak : {formatDistance(s.checkOutDistanceM)}</div>
                                                        <div className="line-clamp">{s.checkOutLocation || '-'}</div>
                                                    </div>
                                                    {/* KOLOM KETERANGAN DENGAN TOMBOL EDIT */}
                                                    <div className="p-4 border-l border-gray-100 col-span-1 text-xs text-gray-500 italic flex justify-between items-center group">
                                                        {/* <span>{s.isLate ? 'Terlambat' : (s.checkIn ? 'Tepat Waktu' : '-')}</span> */}
                                                        
                                                        {/* TOMBOL EDIT HANYA MUNCUL JIKA FILTER PEGAWAI & HARIAN DIPILIH */}
                                                        {selectedProfileId !== '' && filterType === 'daily' && s.id && (
                                                          <button 
                                                            onClick={() => openEditModal(s)}
                                                            title="Edit/Hapus Absensi ini"
                                                            className="text-gray-400 hover:text-blue-600 transition p-1 bg-white rounded border border-transparent hover:border-blue-200 shadow-sm"
                                                          >
                                                            <Edit className="w-4 h-4" />
                                                          </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-gray-400 italic text-xs">
                                            {rec.notes || '-'}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* --- MODAL EDIT ABSENSI --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-slate-800 p-4 flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <Edit className="w-5 h-5"/> Kelola Data Absensi
                    </h2>
                    <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleUpdateShift}>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Shift</label>
                                <input 
                                    type="text" 
                                    value={editForm.shiftName} 
                                    onChange={(e) => setEditForm({...editForm, shiftName: e.target.value})}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                    placeholder="Contoh: Pagi / Malam"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Waktu Masuk</label>
                                    <input 
                                        type="datetime-local" 
                                        value={editForm.checkIn} 
                                        onChange={(e) => setEditForm({...editForm, checkIn: e.target.value})}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Waktu Pulang</label>
                                    <input 
                                        type="datetime-local" 
                                        value={editForm.checkOut} 
                                        onChange={(e) => setEditForm({...editForm, checkOut: e.target.value})}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 justify-between items-center border-t border-gray-100 pt-4">
                            <button 
                                type="button" 
                                onClick={handleDeleteShift}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-sm font-bold transition"
                            >
                                <Trash2 className="w-4 h-4"/> Hapus Absen
                            </button>
                            
                            <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-bold transition"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold transition flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Simpan Edit'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}

      {previewImage && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                <div className="relative">
                <button
                    onClick={() => setPreviewImage(null)}
                    className="absolute -top-3 -right-3 bg-white rounded-full p-1"
                >
                    <X className="w-5 h-5" />
                </button>

                <img
                    src={previewImage}
                    className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-xl"
                />
                </div>
            </div>
            )}
    </div>
  )
}