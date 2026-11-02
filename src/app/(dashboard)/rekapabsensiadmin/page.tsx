'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, FileSpreadsheet, FileText, Search, Filter, Info, Briefcase, CalendarDays, Plus, Trash2 } from 'lucide-react' 
import toast, { Toaster } from 'react-hot-toast'
import XLSX from 'xlsx-js-style' 
// Import Library PDF
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { 
  format, 
  getDaysInMonth, 
  isSunday, 
  isSaturday, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  parseISO,
  isAfter,
  startOfDay
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// --- TIPE DATA ---
type Profile = {
  id: string
  full_name: string
  position: string
}

type LeaveInfo = {
  type: string
  half_day: boolean
}

type PermissionInfo = {
  potongGaji: boolean
  halfDay: boolean
  jenisIzin: string 
}

type AttendanceInfo = {
  shift: string
  checkIn: string
  checkOut:string
}

type LeaveQuota = {
  user_id: string
  annual_quota: number
  used_leave: number
}

type MatrixRow = {
  no: number
  profile: Profile
  remainingLeave: number | null
  days: {
    date: string
    code: 
  | 'H' | '2x' | 'T' | '2T¹' | '2T²'
  | 'I' | 'IP' | 'IP½' | 'ST'
  | 'C' | 'S' | 'A' | '½' | 'L' | '-'
  | 'LAM' | 'LAM(P)' | 'LAP' | 'LAP(P)' | 'P' | 'F'
 
    color: string
    isHoliday: boolean
    tooltip: string
  }[]
  stats: {
    H: number       
    Sft: number     
    T: number       
    I: number
    ST: number
    IP: number 
    C: number
    S: number
    A: number
    Half: number
  }
}

export default function RekapAbsensiMatrix() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // State Filter
  const [month, setMonth] = useState<number>(new Date().getMonth()) 
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [searchName, setSearchName] = useState<string>('')

  // Data Mentah
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceInfo[]>>(new Map())
  const [leaveMap, setLeaveMap] = useState<Map<string, LeaveInfo>>(new Map())
  const [permissionMap, setPermissionMap] = useState<Map<string, PermissionInfo>>(new Map())
  const [quotaMap, setQuotaMap] = useState<Map<string, number>>(new Map())
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({})
  const [holidayDate, setHolidayDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [holidayDescription, setHolidayDescription] = useState<string>('')
  const [holidaySaving, setHolidaySaving] = useState(false)
  const [holidayDeleting, setHolidayDeleting] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // CEK AKSES ADMIN
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .single()

      setIsAdmin(data?.is_admin === true || data?.role === 'admin')
    }
    checkAdmin()
  }, [])

  // 2. FETCH DATA
  const fetchData = async () => {
    setLoading(true)
    try {
      const startDateStr = format(startOfMonth(new Date(year, month)), 'yyyy-MM-dd')
      const endDateStr = format(endOfMonth(new Date(year, month)), 'yyyy-MM-dd')

      console.log(`Fetching Data Periode: ${startDateStr} s/d ${endDateStr} (Tahun Kuota: ${year})`)

      // 1. Fetch Profiles
      const { data: dataProfiles, error: errProf } = await supabase
        .from('profiles')
        .select('id, full_name, position')
        .neq('role', 'admin')      
        .neq('is_admin', true)     
        .order('position',{ascending: true})
        .order('full_name',{ascending: true})
      
      if (errProf) throw errProf

      // 2. Fetch Attendance
      const { data: dataAtt } = await supabase
        .from('attendances')
        .select('user_id, attendance_date, shift, check_in, check_out') 
        .gte('attendance_date', startDateStr)
        .lte('attendance_date', endDateStr)

      // 3. Fetch Leave Requests (Disetujui)
      const { data: dataLeaves } = await supabase
        .from('leave_requests')
        .select('user_id, start_date, end_date, leave_type, status, half_day')
        .eq('status', 'Disetujui')
        .or(`start_date.lte.${endDateStr},end_date.gte.${startDateStr}`)

      // 4. Fetch Permissions (Disetujui)
      const { data: dataPermits } = await supabase
        .from('permission_requests')
        .select('user_id, tanggal_mulai, tanggal_selesai, status, potong_gaji, half_day, jenis_izin')
        .in('status', ['Disetujui', 'Disetujui Level 1', 'Disetujui Level 2'])
        .or(`tanggal_mulai.lte.${endDateStr},tanggal_selesai.gte.${startDateStr}`)

      // 5. Fetch Quota (SISA CUTI)
      const { data: dataQuota, error: errQuota } = await supabase
        .from('master_leave_quota')
        .select('user_id, annual_quota, used_leave')
        .eq('year', year)
      
      if (errQuota) console.error("Error mengambil kuota cuti:", errQuota)
      else console.log(`Ditemukan ${dataQuota?.length} data kuota cuti.`)

      // 6. Fetch Holidays
      const dbHolidaysObj: Record<string, string> = {}
      try {
        const { data: dbHolidays } = await supabase
          .from('public_holidays')
          .select('date, description')
          .gte('date', startDateStr)
          .lte('date', endDateStr)
        
        if (dbHolidays) {
          dbHolidays.forEach((h: any) => {
            dbHolidaysObj[h.date] = h.description
          })
        }
      } catch (err) {}
      setHolidayMap(dbHolidaysObj)

      // --- Processing Data ---
      const tempAttMap = new Map<string, AttendanceInfo[]>()
      dataAtt?.forEach(a => {
        const key = `${a.user_id}_${a.attendance_date}`
        const currentList = tempAttMap.get(key) || []
        const exists = currentList.find(item => item.shift === a.shift)
        if (!exists && a.check_in) {
            currentList.push({ shift: a.shift, checkIn: a.check_in, checkOut: a.check_out } )
        }
        tempAttMap.set(key, currentList)
      })
      setAttendanceMap(tempAttMap)

      const tempLeaveMap = new Map<string, LeaveInfo>()
      dataLeaves?.forEach(l => {
        try {
          const range = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) })
          range.forEach(date => {
            const key = `${l.user_id}_${format(date, 'yyyy-MM-dd')}`
            tempLeaveMap.set(key, { type: l.leave_type, half_day: l.half_day || false })
          })
        } catch (e) {}
      })
      setLeaveMap(tempLeaveMap)

      const tempPermitMap = new Map<string, PermissionInfo>()
      dataPermits?.forEach(p => {
        try {
          const range = eachDayOfInterval({ start: parseISO(p.tanggal_mulai), end: parseISO(p.tanggal_selesai) })
          range.forEach(date => {
             const key = `${p.user_id}_${format(date, 'yyyy-MM-dd')}`
             tempPermitMap.set(key, { 
          potongGaji: p.potong_gaji || false,
          halfDay: p.half_day || false,
          jenisIzin: p.jenis_izin || ''
          })

          })
        } catch (e) {}
      })
      setPermissionMap(tempPermitMap)

      const tempQuotaMap = new Map<string, number>()
      if (dataQuota) {
          dataQuota.forEach((q: any) => {
              const total = Number(q.annual_quota)
              const used = Number(q.used_leave)
              const sisa = total - used
              tempQuotaMap.set(q.user_id, sisa)
          })
      }
      setQuotaMap(tempQuotaMap)

      if (dataProfiles) setProfiles(dataProfiles)

    } catch (error: any) {
      console.error("Error Fetch Data:", error)
      toast.error("Gagal mengambil data: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const addNationalHoliday = async () => {
    if (!isAdmin) {
      toast.error('Hanya admin yang dapat mengatur libur nasional.')
      return
    }
    if (!holidayDate || !holidayDescription.trim()) {
      toast.error('Tanggal dan keterangan libur wajib diisi.')
      return
    }

    setHolidaySaving(true)
    try {
      const { error } = await supabase
        .from('public_holidays')
        .insert({
          date: holidayDate,
          description: holidayDescription.trim(),
        })

      if (error) {
        if (error.code === '23505') {
          throw new Error('Tanggal tersebut sudah terdaftar sebagai libur nasional.')
        }
        throw error
      }

      toast.success('Libur nasional berhasil ditambahkan.')
      setHolidayDescription('')
      await fetchData()
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menambahkan libur nasional.')
    } finally {
      setHolidaySaving(false)
    }
  }

  const deleteNationalHoliday = async (date: string) => {
    if (!isAdmin) return
    const description = holidayMap[date] || 'libur nasional'
    if (!window.confirm(`Hapus ${description} (${date})?`)) return

    setHolidayDeleting(date)
    try {
      const { error } = await supabase
        .from('public_holidays')
        .delete()
        .eq('date', date)

      if (error) throw error
      toast.success('Libur nasional dihapus.')
      await fetchData()
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menghapus libur nasional.')
    } finally {
      setHolidayDeleting(null)
    }
  }

  useEffect(() => {
    fetchData()
  }, [month, year])

  const formatTime = (value?: string) => {
    if (!value) return '-'
    const d = new Date(value)
    return format(d, 'HH:mm')
  }

  const formatDTime = (value?: string) => {
    if (!value) return '-'
    const d = new Date(value)
    return format(d, 'dd-MM-yyyy HH:mm')
  }
  // 3. CORE LOGIC
 const matrixData = useMemo(() => {
  let filteredProfiles = profiles
  if (searchName.trim()) {
    filteredProfiles = profiles.filter(p =>
      p.full_name?.toLowerCase().includes(searchName.toLowerCase())
    )
  }
  if (!filteredProfiles.length) return []

  const daysCount = getDaysInMonth(new Date(year, month))
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1)
  const today = startOfDay(new Date())

  return filteredProfiles.map((profile, index) => {
    const rowData: MatrixRow['days'] = []
    let stats = { H: 0, Sft: 0, T: 0, I: 0, ST:0, IP: 0, C: 0, S: 0, A: 0, Half: 0 }
    const remainingLeave = quotaMap.has(profile.id) ? quotaMap.get(profile.id)! : null

    daysArray.forEach(day => {
      const dateObj = new Date(year, month, day)
      const dateStr = format(dateObj, 'yyyy-MM-dd')
      const key = `${profile.id}_${dateStr}`

      const holidayName = holidayMap[dateStr]
      const isWeekend = isSunday(dateObj) || isSaturday(dateObj)
      const isOffDay = isWeekend || !!holidayName

      let code: MatrixRow['days'][0]['code'] = '-'
      let color = 'bg-white'
      let tooltip = ''

      // ===== PERMISSION & LAM / LAP / ST / SAKIT =====
      if (permissionMap.has(key)) {
        const perm = permissionMap.get(key)!
        const izinType = perm.jenisIzin.toUpperCase()

        if (izinType.includes('LUPA ABSEN MASUK')) {
          if (perm.potongGaji) {
            code = 'LAM(P)'
            color = 'bg-emerald-300 text-white-900 font-bold'
            tooltip = 'Lupa Absen Masuk (Potong Gaji)'
            stats.IP++
          } else {
            code = 'LAM'
            color = 'bg-pink-200 text-emerald-800 font-bold'
            tooltip = 'Lupa Absen Masuk (Tidak Potong Gaji)'
            stats.I++
          }
        } else if (izinType.includes('LUPA ABSEN PULANG')) {
          if (perm.potongGaji) {
            code = 'LAP(P)'
            color = 'bg-maroon-300 text-emerald-900 font-bold'
            tooltip = 'Lupa Absen Pulang (Potong Gaji)'
            stats.IP++
          } else {
            code = 'LAP'
            color = 'bg-sky-200 text-sky-800 font-bold'
            tooltip = 'Lupa Absen Pulang (Tidak Potong Gaji)'
            stats.I++
          }
          // Penambahan ST dan SAKIT
          } else if (izinType.includes('PERJALANAN DINAS') || izinType.includes('ST')) {
          code = 'ST'
          color = 'bg-teal-200 text-teal-800 font-bold'
          tooltip = 'Perjalanan Dinas / Surat Tugas (ST)'
          stats.ST++
          } else if (izinType.includes('SAKIT')) {
          code = 'S'
          color = 'bg-orange-200 text-orange-800 font-bold'
          tooltip = `Izin Sakit: ${perm.jenisIzin}`
          stats.S++
        } else {
          if (perm.potongGaji) {
            if (perm.halfDay) {
              code = 'IP½'
              color = 'bg-rose-200 text-rose-800 border-rose-300'
              tooltip = 'Izin Potong Gaji (Setengah Hari)'
              stats.IP++
            } else {
              code = 'IP'
              color = 'bg-rose-300 text-rose-900 border-rose-400'
              tooltip = 'Izin Potong Gaji (Full)'
              stats.IP++
            }
          } else {
            code = 'I'
            color = 'bg-yellow-200 text-yellow-800'
            tooltip = 'Izin (Tidak Potong Gaji)'
            stats.I++
          }
        }
      }
      // ===== LEAVE =====
      else if (leaveMap.has(key)) {
        const info = leaveMap.get(key)!
        if (info.half_day) { code = '½'; color = 'bg-purple-200 text-purple-800'; tooltip = 'Cuti Setengah Hari'; stats.Half++ }
        else if (info.type.toLowerCase().includes('sakit')) { code = 'S'; color = 'bg-orange-200 text-orange-800'; tooltip = `Sakit: ${info.type}`; stats.S++ }
        else { code = 'C'; color = 'bg-blue-200 text-blue-800'; tooltip = `Cuti: ${info.type}`; stats.C++ }
      }
      // ===== ATTENDANCE =====
      else if (attendanceMap.has(key)) {
        const shifts = attendanceMap.get(key) || []
        let dayLateCount = 0
        let earlyLeave = false
        let tooltipLines: string[] = []
        const userPos = profile.position?.toUpperCase() || ''

        shifts.forEach((s, idx) => {
          const checkInDate = new Date(s.checkIn)
          const checkOutDate = s.checkOut ? new Date(s.checkOut) : null

          const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes()

          let lockHour, lockMin
          if ((s.shift || '').toLowerCase().includes('pagi')) {
            if (userPos.includes('SATPAM')) [lockHour, lockMin] = [7, 45]
            else if (userPos.includes('CS')) [lockHour, lockMin] = [7, 30]
            else [lockHour, lockMin] = [7, 30] // Default untuk shift pagi PPNPN
          } else {
            if (userPos.includes('SATPAM')) [lockHour, lockMin] = [19, 45]
            else [lockHour, lockMin] = [20, 0]
          }

          if (checkInMinutes > lockHour * 60 + lockMin) dayLateCount++

          // ===== LOGIKA FLEXI / PULANG CEPAT =====
          // =========================
          // KONFIGURASI KHUSUS
          // =========================

          // ID CS SETENGAH HARI
          // FORMAT:
          // 'ID_USER': JAM_PULANG_MINIMAL

          const HALF_DAY_CS: Record<string, string> = {
            // contoh:
            'a23e6ebe-9ab3-4a1c-bfaa-5ec9197fde9f': '12:00'
            // 'uuid-user-cs-2': '13:00',
          }

          // =========================
          // VALIDASI PULANG CEPAT
          // =========================

          if (checkOutDate) {

            // Total menit checkout
            const checkOutMinutes =
              checkOutDate.getHours() * 60 +
              checkOutDate.getMinutes()

            // Default jam pulang minimal
            let minimumCheckoutMinutes = 17 * 60 // 17:00

            const shiftName = (s.shift || '').toLowerCase()

            // =========================
            // SATPAM SHIFT MALAM
            // =========================
            // Satpam malam pulang hari berikutnya
            // Jangan dianggap pulang cepat
            // jika checkout lewat tengah malam

            const isSatpam = userPos.includes('SATPAM')
            const isNightShift =
              shiftName.includes('malam') 

            if (isSatpam && isNightShift) {

              // Jika checkout tanggal berikutnya
              const checkInDay = checkInDate.getDate()
              const checkOutDay = checkOutDate.getDate()

              // Checkout beda hari = valid
              if (checkOutDay !== checkInDay) {
                minimumCheckoutMinutes = 1
              } else {
                // Kalau masih hari sama,
                // minimal checkout jam 23:00
                minimumCheckoutMinutes = 23 * 60
              }
            }

            // =========================
            // CS SETENGAH HARI
            // =========================

            const customHalfDayTime = HALF_DAY_CS[profile.id]

            if (customHalfDayTime) {

              const [hour, minute] =
                customHalfDayTime.split(':').map(Number)

              minimumCheckoutMinutes =
                (hour * 60) + minute
            }

            // =========================
            // FINAL VALIDATION
            // =========================

            if (checkOutMinutes < minimumCheckoutMinutes) {
              earlyLeave = true
            }
          }

          tooltipLines.push(
            `Shift ${idx + 1} (${s.shift})\n` +
            `• Check-in  : ${formatTime(s.checkIn)}\n` +
            `• Check-out : ${formatDTime(s.checkOut)}`
          )
        })

        // === KODE UTAMA ===
        if (earlyLeave) {
          code = 'P'
          color = 'bg-orange-500 text-white font-bold'
          tooltip = `Pulang sebelum jam 17:00\n${tooltipLines.join('\n')}`
        } else if (shifts.length > 1) {
          if (dayLateCount === 1) { code = '2T¹'; color = 'bg-yellow-600 text-white font-bold' }
          else if (dayLateCount >= 2) { code = '2T²'; color = 'bg-orange-700 text-white font-bold' }
          else { code = '2x'; color = 'bg-green-600 text-white font-bold' }
        } else {
          if (dayLateCount > 0) { code = 'T'; color = 'bg-yellow-500 text-white font-bold' }
          else { code = 'H'; color = 'bg-green-200 text-green-800 border-green-300' }
        }

        if (!earlyLeave) tooltip = `${code === 'H' ? 'Hadir Tepat Waktu' : 'Hadir'}\n${tooltipLines.join('\n')}`

        stats.H++
        stats.Sft += shifts.length
        stats.T += dayLateCount
      }
      // ===== LIBUR & WEEKEND =====
      else if (holidayName) { code = 'L'; color = 'bg-red-600 text-white font-bold'; tooltip = `LIBUR NASIONAL: ${holidayName}` }
      else if (isWeekend) { code = '-'; color = 'bg-red-500 text-white'; tooltip = 'Akhir Pekan (Sabtu/Minggu)' }
      else if (isAfter(today, dateObj)) { code = 'A'; color = 'bg-red-50 text-red-600 font-bold'; tooltip = 'Alpha / Tanpa Keterangan'; stats.A++ }
      else { code = '-'; color = 'bg-white'; tooltip = 'Belum ada data' }

      rowData.push({ date: dateStr, code, color, isHoliday: isOffDay, tooltip })
    })

    return { no: index + 1, profile, days: rowData, stats, remainingLeave }
  })
}, [profiles, attendanceMap, leaveMap, permissionMap, quotaMap, month, year, searchName, holidayMap]);
  // 4. EXPORT TO EXCEL
  const exportToExcel = () => {
    if (matrixData.length === 0) {
      toast.error("Data kosong.")
      return
    }

    const daysCount = getDaysInMonth(new Date(year, month))
    const daysHeader = Array.from({ length: daysCount }, (_, i) => (i + 1).toString())
    const monthName = format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })

    // Styles Excel
    const borderStyle = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }

    const headerStyle = {
      fill: { fgColor: { rgb: "4B5563" } },
      font: { color: { rgb: "FFFFFF" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderStyle
    }

    const styles: Record<string, any> = {
  // --- GRUP UTAMA (SUDAH ADA) ---
  'H': { fill: { fgColor: { rgb: "C6EFCE" } }, font: { color: { rgb: "006100" }, bold: true } },
  '2x': { fill: { fgColor: { rgb: "16A34A" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  'T': { fill: { fgColor: { rgb: "EAB308" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  '2T¹': { fill: { fgColor: { rgb: "CA8A04" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  '2T²': { fill: { fgColor: { rgb: "A16207" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  'C': { fill: { fgColor: { rgb: "BFDBFE" } }, font: { color: { rgb: "1E3A8A" }, bold: true } },
  'S': { fill: { fgColor: { rgb: "FED7AA" } }, font: { color: { rgb: "9A3412" }, bold: true } },
  'I': { fill: { fgColor: { rgb: "FEF08A" } }, font: { color: { rgb: "854D0E" }, bold: true } },
  'IP': { fill: { fgColor: { rgb: "FDA4AF" } }, font: { color: { rgb: "881337" }, bold: true } }, 
  'IP½': { fill: { fgColor: { rgb: "FECDD3" } }, font: { color: { rgb: "9F1239" }, bold: true } },
  // 'ST' menggunakan Teal/Tosca
  'ST': { fill: { fgColor: { rgb: "99F6E4" } }, font: { color: { rgb: "115E59" }, bold: true } }, 
  '½': { fill: { fgColor: { rgb: "E9D5FF" } }, font: { color: { rgb: "6B21A8" }, bold: true } },
  'A': { fill: { fgColor: { rgb: "EF4444" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },

  // --- PENYELARASAN 4 STYLE BARU ---
  // LAM diselaraskan dengan warna Pink (Grup IP) agar tidak terlalu kontras dengan teks putih yang sulit dibaca di background terang
  'LAM': { 
    fill: { fgColor: { rgb: "FBCFE8" } }, 
    font: { color: { rgb: "9D174D" }, bold: true } // Diubah dari putih ke Pink Gelap agar terbaca
  },

  // LAM(P) menggunakan Emerald/Hijau Teal (Grup H)
  'LAM(P)': {
    fill: { fgColor: { rgb: "D1FAE5" } }, 
    font: { color: { rgb: "065F46" }, bold: true } 
  },

  // LAP menggunakan Sky Blue (Grup C)
  'LAP': {
    fill: { fgColor: { rgb: "E0F2FE" } }, 
    font: { color: { rgb: "075985" }, bold: true } 
  },

  // LAP(P) menggunakan Rose/Maroon Soft (Grup IP)
  'LAP(P)': {
    fill: { fgColor: { rgb: "FCE7F3" } }, 
    font: { color: { rgb: "9F1239" }, bold: true } // Diselaraskan dengan tone IP½
  },

  // --- AKHIR (SUDAH ADA) ---
  'L': { fill: { fgColor: { rgb: "B91C1C" } }, font: { color: { rgb: "FFFFFF" }, bold: true } }, 
  'WEEKEND': { fill: { fgColor: { rgb: "EF4444" } } },
}

    const tableHeaderLabel = [
      "No", "Nama Pegawai", "Jabatan", ...daysHeader, 
      "Hadir", "Shift", "Telat", "Izin", "Iz.Pot","ST", "Cuti", "Sakit", "½", "Alpha", "Sisa"
    ]
    const tableHeaderRow = tableHeaderLabel.map(h => ({ v: h, s: headerStyle }))

    const tableBodyRows: any[][] = []
    matrixData.forEach(row => {
      const rowCells: any[] = []
      const baseStyle = { border: borderStyle, alignment: { vertical: "center" } }
      
      rowCells.push({ v: row.no, s: { ...baseStyle, alignment: { horizontal: "center" } } })
      rowCells.push({ v: row.profile.full_name, s: baseStyle })
      rowCells.push({ v: row.profile.position, s: baseStyle })

      row.days.forEach(day => {
        let cellStyle = { ...baseStyle, alignment: { horizontal: "center" } }
        let val = day.code === '-' ? '' : day.code

        if (styles[val]) {
             cellStyle = { ...cellStyle, ...styles[val] }
        } else if (day.isHoliday) { 
             cellStyle = { ...cellStyle, ...styles['WEEKEND'] }
             if (val === '') val = ''
        } 
        rowCells.push({ v: val, s: cellStyle })
      })

      // Stats
      const statStyle = { border: borderStyle, alignment: { horizontal: "center" }, font: { bold: true } }
      rowCells.push({ v: row.stats.H, s: statStyle })
      rowCells.push({ v: row.stats.Sft, s: statStyle })
      rowCells.push({ v: row.stats.T, s: statStyle })
      rowCells.push({ v: row.stats.I, s: statStyle })
      rowCells.push({ v: row.stats.IP, s: { ...statStyle, fill: { fgColor: { rgb: "FECDD3" } } } })
      rowCells.push({ v: row.stats.ST, s: statStyle })
      rowCells.push({ v: row.stats.C, s: statStyle })
      rowCells.push({ v: row.stats.S, s: statStyle })
      rowCells.push({ v: row.stats.Half, s: statStyle })
      rowCells.push({ v: row.stats.A, s: { ...statStyle, font: { color: { rgb: "DC2626" }, bold: true } } })
      rowCells.push({ v: row.remainingLeave !== null ? row.remainingLeave : "-", s: { ...statStyle, fill: { fgColor: { rgb: "DBEAFE" } } } })

      tableBodyRows.push(rowCells)
    })

    const titleRow = [{ v: "REKAP ABSENSI PPNPN DAN CS", s: { font: { sz: 14, bold: true }, alignment: { horizontal: "center" } } }]
    const periodRow = [{ v: `PERIODE: ${monthName.toUpperCase()}`, s: { font: { sz: 11, bold: true }, alignment: { horizontal: "center" } } }]

    // ================== BAGIAN KETERANGAN (LEGEND) UNTUK EXCEL ==================
    const legendData = [
      { code: 'H', desc: '1 Shift (H)', styleKey: 'H' },
      { code: '2x', desc: '2 Shift (2x)', styleKey: '2x' },
      { code: '2T¹', desc: '2 Shift (1 Telat) (2T¹)', styleKey: '2T¹' },
      { code: '2T²', desc: '2 Shift (2 Telat) (2T²)', styleKey: '2T²' },
      { code: 'T', desc: '1 Shift Telat (T)', styleKey: 'T' },
      { code: 'C', desc: 'Cuti (C)', styleKey: 'C' },
      { code: 'S', desc: 'Sakit (S)', styleKey: 'S' },
      { code: 'I', desc: 'Izin (I)', styleKey: 'I' },
      { code: 'IP', desc: 'Izin Potong (IP)', styleKey: 'IP' },
      { code: 'IP½', desc: 'Izin Potong ½ (IP½)', styleKey: 'IP½' },
      { code: 'ST', desc: 'Perjalanan Dinas (ST)', styleKey: 'ST' },
      { code: '½', desc: '½ Hari', styleKey: '½' },
      { code: 'L', desc: 'Libur Nasional', styleKey: 'L' },
      { code: '', desc: 'Akhir Pekan', styleKey: 'WEEKEND' },
      { code: 'A', desc: 'Alpha', styleKey: 'A' },
      { code: 'LAM', desc: 'Lupa Absen Masuk', styleKey: 'LAM' },
{ code: 'LAM(P)', desc: 'Lupa Absen Masuk (Potong Gaji)', styleKey: 'LAM(P)' },
{ code: 'LAP', desc: 'Lupa Absen Pulang', styleKey: 'LAP' },
{ code: 'LAP(P)', desc: 'Lupa Absen Pulang (Potong Gaji)', styleKey: 'LAP(P)' },
    ];

    const legendRows: any[][] = [];
    legendRows.push([{ v: "", s: {} }]); // Spacer row
    legendRows.push([{ v: "KETERANGAN:", s: { font: { bold: true, underline: true } } }]);

    legendData.forEach(item => {
        legendRows.push([
            { v: "", s: {} }, // Kolom kosong untuk indentasi
            { 
              v: item.code, 
              s: { 
                ...styles[item.styleKey], 
                border: borderStyle, 
                alignment: { horizontal: "center", vertical: "center" } 
              } 
            },
            { v: item.desc, s: { alignment: { vertical: "center" } } }
        ]);
    });
    // =========================================================================

 

    const ws_data = [
        titleRow, periodRow, [{ v: "", s: {} }], tableHeaderRow, ...tableBodyRows,  ...legendRows
    ]

    const ws = XLSX.utils.aoa_to_sheet([])
    XLSX.utils.sheet_add_aoa(ws, ws_data, { origin: "A1" })

    if(!ws['!merges']) ws['!merges'] = []
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: tableHeaderLabel.length - 1 } })
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: tableHeaderLabel.length - 1 } })

    const wscols = [{ wch: 5 }, { wch: 30 }, { wch: 20 }]
    for(let i=0; i<daysCount; i++) wscols.push({ wch: 4 })
    for(let i=0; i<10; i++) wscols.push({ wch: 6 })
    ws['!cols'] = wscols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi")
    XLSX.writeFile(wb, `Rekap_Absensi_${format(new Date(year, month), 'MMMM_yyyy', {locale: idLocale})}.xlsx`)
    toast.success("Excel berhasil didownload!")
  }

  // 5. EXPORT TO PDF
  const exportToPDF = () => {
    if (matrixData.length === 0) {
      toast.error("Data kosong.")
      return
    }

    const doc = new jsPDF('landscape', 'mm', 'a4')
    const monthName = format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })
    const daysCount = getDaysInMonth(new Date(year, month))
    
    // Header
    doc.setFontSize(14)
    doc.text("REKAP ABSENSI PPNPN DAN CS ", 14, 15)
    doc.setFontSize(10)
    doc.text(`PERIODE: ${monthName.toUpperCase()}`, 14, 22)

    // Columns
    const daysHeader = Array.from({ length: daysCount }, (_, i) => (i + 1).toString())
    // Header Tabel PDF dengan kolom IP
    const tableHead = [
      ["No", "Nama", "Jabatan", ...daysHeader, "H", "Sft", "T", "I","ST", "IP", "C", "S", "½", "A", "Sisa"]
    ]

    // Rows
    const tableBody = matrixData.map(row => {
      const dayCells = row.days.map(d => d.code === '-' ? '' : d.code)
      return [
        row.no,
        row.profile.full_name,
        row.profile.position,
        ...dayCells,
        row.stats.H,
        row.stats.Sft,
        row.stats.T,
        row.stats.I,
        row.stats.ST,
        row.stats.IP, // Data IP
        row.stats.C,
        row.stats.S,
        row.stats.Half,
        row.stats.A,
        row.remainingLeave !== null ? row.remainingLeave : '-'
      ]
    })

   // Warna untuk PDF (format [R, G, B])
const getCellColor = (code: string, isWeekendOrHoliday: boolean) => {
  if (code === 'H') return [198, 239, 206]      // Green light (C6EFCE)
  if (code === '2x') return [22, 163, 74]      // Green strong (16A34A)
  if (code === 'T') return [234, 179, 8]       // Yellow (EAB308)
  if (code.includes('2T')) return [202, 138, 4] // Amber/Dark Yellow (CA8A04)
  if (code === 'A') return [239, 68, 68]       // Red (EF4444)
  if (code === 'L') return [185, 28, 28]       // Dark Red (B91C1C)
  if (code === 'C') return [191, 219, 254]     // Blue (BFDBFE)
  if (code === 'S') return [254, 213, 170]     // Orange (FED7AA)
  if (code === 'I') return [254, 240, 138]     // Light Yellow (FEF08A)
  if (code.startsWith('IP')) return [253, 164, 175] // Rose (FDA4AF)
  if (code === '½') return [233, 213, 255]     // Purple (E9D5FF)
  if (code === 'ST') return [153, 246, 228] // Teal soft (99F6E4)

  // --- PENYELARASAN 4 KODE BARU (Mengikuti Fill Color sebelumnya) ---
  if (code === 'LAM') return [251, 207, 232]    // Pink Soft (FBCFE8)
  if (code === 'LAM(P)') return [209, 250, 229] // Emerald Soft (D1FAE5)
  if (code === 'LAP') return [224, 242, 254]    // Sky Soft (E0F2FE)
  if (code === 'LAP(P)') return [252, 231, 243] // Rose Soft (FCE7F3)
  
  if (isWeekendOrHoliday) return [239, 68, 68] // Red for weekend
  
  return null
}

    autoTable(doc, {
      startY: 28,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 6,
        cellPadding: 1,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [75, 85, 99], // Gray-600
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 8 }, // No
        1: { cellWidth: 25, halign: 'left' }, // Nama
        2: { cellWidth: 15, halign: 'left' }, // Jabatan
      },
      didParseCell: function(data: any) {
        if (data.section === 'body' && data.column.index >= 3 && data.column.index < 3 + daysCount) {
          const rawRow = matrixData[data.row.index]
          const dayIndex = data.column.index - 3
          
          if (rawRow && rawRow.days && rawRow.days[dayIndex]) {
            const dayData = rawRow.days[dayIndex]
            
            const color = getCellColor(dayData.code, dayData.isHoliday)
            if (color) {
              data.cell.styles.fillColor = color as [number, number, number]
              if (['2x', 'T', 'L', 'A'].includes(dayData.code) || dayData.isHoliday) {
                 data.cell.styles.textColor = 255
              }
            }
          }
        }
      }
    })

    // ================== BAGIAN KETERANGAN (LEGEND) UNTUK PDF ==================
    const finalY = (doc as any).lastAutoTable.finalY + 5
    doc.setFontSize(8)
    
    // Teks Keterangan yang diminta
    const keteranganLines = [
  "Keterangan:",
  "1 Shift (H) | 2 Shift (2x) | 2 Shift (1 Telat) (2T¹) | 1 Shift Telat (T)",
  "Cuti (C) | Sakit (S) | Izin (I) |Perjalanan Dinas (ST) | Izin Potong (IP) | ½ Hari",
  "L (Libur Nasional) | Akhir Pekan (Warna Merah) | A (Alpha)",
  "LAM = Lupa Absen Masuk | LAM(P) = Lupa Absen Masuk (Potong Gaji)",
  "LAP = Lupa Absen Pulang | LAP(P) = Lupa Absen Pulang (Potong Gaji)",
]

    
    // Cetak per baris
    let currentY = finalY;
    keteranganLines.forEach(line => {
        doc.text(line, 14, currentY);
        currentY += 4;
    });
    // =========================================================================

    doc.save(`Rekap_Absensi_${format(new Date(year, month), 'MMMM_yyyy', {locale: idLocale})}.pdf`)
    toast.success("PDF berhasil didownload!")
  }

  // 6. RENDER UI
  const daysInCurrentMonth = getDaysInMonth(new Date(year, month))
  const dateHeaders = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1)
  const monthNameStr = format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-xs sm:text-sm">
      <Toaster position="top-center" />
      
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div>
              <h1 className="text-lg font-bold uppercase text-gray-800">Rekap Absensi Matrix</h1>
              <p className="text-gray-500 text-xs">Periode: {monthNameStr}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={exportToPDF} className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto gap-2 shadow-sm">
                <FileText className="w-4 h-4"/> PDF
            </Button>
            <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white w-full md:w-auto gap-2 shadow-sm">
                <FileSpreadsheet className="w-4 h-4"/> Excel
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-3 rounded-md border border-gray-100">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="text" placeholder="Cari Pegawai..." value={searchName} onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9 pr-3 py-2 border rounded-md text-sm w-full md:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
            </div>
            <div className="flex gap-2">
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="border p-2 rounded-md text-sm bg-white cursor-pointer">
                    {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{format(new Date(year, i), 'MMMM', { locale: idLocale })}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="border p-2 rounded-md text-sm bg-white cursor-pointer">
                    {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <Button size="sm" onClick={fetchData} variant="secondary" className="border gap-2">
                <Filter className="w-3 h-3"/> Refresh
            </Button>
            
            <div className="ml-auto text-xs text-gray-500 italic hidden md:flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>Geser ke kanan untuk lihat sisa cuti</span>
            </div>
        </div>
      </div>

      {/* ================= LIBUR NASIONAL ================= */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-5 h-5 text-red-600" />
          <div>
            <h2 className="font-bold text-gray-800">Libur Nasional</h2>
            <p className="text-xs text-gray-500">Admin dapat menambah atau menghapus tanggal libur nasional. Pegawai tetap dapat melakukan presensi pada tanggal libur.</p>
          </div>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2 items-end mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal</label>
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="w-full border rounded-md p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Keterangan</label>
              <input
                type="text"
                value={holidayDescription}
                onChange={(e) => setHolidayDescription(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addNationalHoliday() }}
                placeholder="Contoh: Hari Kemerdekaan RI"
                className="w-full border rounded-md p-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button onClick={addNationalHoliday} disabled={holidaySaving} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              {holidaySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {holidaySaving ? 'Menyimpan...' : 'Tambah Libur'}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {Object.keys(holidayMap).sort().length === 0 ? (
            <span className="text-xs text-gray-400 italic">Belum ada libur nasional pada {monthNameStr}.</span>
          ) : (
            Object.entries(holidayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, description]) => (
              <div key={date} className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <span className="font-bold text-red-700">{format(parseISO(date), 'dd MMM yyyy', { locale: idLocale })}</span>
                <span className="text-red-800">{description}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => deleteNationalHoliday(date)}
                    disabled={holidayDeleting === date}
                    className="ml-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                    title="Hapus libur"
                  >
                    {holidayDeleting === date ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm h-64">
            <Loader2 className="animate-spin text-blue-600 w-8 h-8 mb-2"/>
            <p className="text-gray-500">Memuat data absensi...</p>
        </div>
      ) : matrixData.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm text-gray-500">Tidak ada data pegawai.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto pb-2">
            <table className="w-full border-collapse text-center text-[11px] md:text-xs min-w-[1200px]">
                <thead>
                    <tr className="bg-gray-800 text-white font-semibold">
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[40px]">No</th>
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[200px] sticky left-0 bg-gray-800 z-20 text-left">Nama</th>
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[100px]">Jabatan</th>
                        <th colSpan={daysInCurrentMonth} className="border border-gray-600 p-1 bg-gray-700">Tanggal</th>
                        <th colSpan={10} className="border border-gray-600 p-1 bg-blue-900">Total</th>
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[80px] bg-blue-800">
                            <div className="flex flex-col items-center gap-1">
                                <Briefcase className="w-4 h-4"/>
                                <span>Sisa Cuti</span>
                            </div>
                        </th>
                    </tr>
                    <tr className="bg-gray-100 text-gray-800 font-bold">
                        {dateHeaders.map(d => {
                             const dateCheck = new Date(year, month, d)
                             const dateStr = format(dateCheck, 'yyyy-MM-dd')
                             const holidayName = holidayMap[dateStr]
                             const isWeekend = isSunday(dateCheck) || isSaturday(dateCheck)
                             const isLibur = !!holidayName
                             
                             const bgClass = (isLibur || isWeekend) ? 'bg-red-500 text-white' : ''
                             return <th key={d} className={`border border-gray-300 w-8 h-8 ${bgClass}`} title={holidayName}>{d}</th>
                        })}
                        <th className="border border-gray-300 w-10 bg-green-100 text-green-700">H</th>
                        <th className="border border-gray-300 w-10 bg-green-200 text-green-800">Sft</th>
                        <th className="border border-gray-300 w-9 bg-yellow-500 text-white">T</th>
                        <th className="border border-gray-300 w-9 bg-yellow-100 text-yellow-700">I</th>
                        <th className="border border-gray-300 w-9 bg-blue-100 text-blue-700">ST</th>
                        <th className="border border-gray-300 w-9 bg-rose-200 text-rose-800">IP</th>
                        <th className="border border-gray-300 w-9 bg-blue-100 text-blue-700">C</th>
                        <th className="border border-gray-300 w-9 bg-orange-100 text-orange-700">S</th>
                        <th className="border border-gray-300 w-9 bg-purple-100 text-purple-700">½</th>
                        <th className="border border-gray-300 w-9 bg-red-100 text-red-700">A</th>
                    </tr>
                </thead>
                <tbody>
                    {matrixData.map((row) => (
                        <tr key={row.profile.id} className="hover:bg-gray-50 group transition-colors">
                            <td className="border border-gray-300 p-1">{row.no}</td>
                            <td className="border border-gray-300 px-3 py-2 text-left font-medium sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.profile.full_name}</td>
                            <td className="border border-gray-300 p-1 text-gray-500">{row.profile.position}</td>
                            
                            {row.days.map((day, dIdx) => (
                                <td key={dIdx} 
                                    className={`border border-gray-300 h-8 font-bold text-[10px] cursor-help ${day.color}`}
                                    title={day.tooltip} 
                                >
                                    {day.code !== '-' ? day.code : ''}
                                </td>
                            ))}

                            <td className="border border-gray-300 font-bold bg-green-50">{row.stats.H}</td>
                            <td className="border border-gray-300 font-bold bg-green-100">{row.stats.Sft}</td>
                            <td className="border border-gray-300 font-bold bg-yellow-100 text-yellow-700">{row.stats.T}</td>
                            <td className="border border-gray-300 font-bold bg-yellow-50">{row.stats.I}</td>
                            <td className="border border-gray-300 font-bold bg-blue-200">{row.stats.ST}</td>
                            <td className="border border-gray-300 font-bold bg-rose-50 text-rose-700">{row.stats.IP}</td>
                            <td className="border border-gray-300 font-bold bg-blue-50">{row.stats.C}</td>
                            <td className="border border-gray-300 font-bold bg-orange-50">{row.stats.S}</td>
                            <td className="border border-gray-300 font-bold bg-purple-50">{row.stats.Half}</td>
                            <td className="border border-gray-300 font-bold bg-red-50 text-red-600">{row.stats.A}</td>
                            <td className="border border-gray-300 font-bold bg-blue-50 text-blue-800">{row.remainingLeave !== null ? row.remainingLeave : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}

     {/* FOOTER LEGEND */}
<div className="mt-4 flex flex-wrap gap-4 text-xs bg-white p-3 rounded border border-gray-200 shadow-sm">
  <span className="font-bold text-gray-700">Keterangan:</span>
  
  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-green-200 border border-green-300 inline-block"></span> 1 Shift (H)
  </div>
  
  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-green-600 border border-green-700 inline-block"></span> 2 Shift (2x)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-yellow-600 border border-yellow-700 inline-block"></span> 2 Shift (1 Telat) (2T¹)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-yellow-500 border border-yellow-600 inline-block"></span> 1 Shift Telat (T)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-blue-200 border border-blue-300 inline-block"></span> Cuti (C)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-orange-200 border border-orange-300 inline-block"></span> Sakit (S)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200 inline-block"></span> Izin (I)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-rose-200 border border-rose-300 inline-block"></span> Izin Potong (IP)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-teal-200 border border-teal-300 inline-block"></span> Perjalanan Dinas (ST)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-purple-200 border border-purple-300 inline-block"></span> ½ Hari
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-red-700 border border-red-800 inline-block text-white text-[10px] text-center leading-4 font-bold">L</span> Libur Nasional
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-red-500 border border-red-600 inline-block"></span> Akhir Pekan
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-red-600 border border-red-700 inline-block text-white text-[10px] text-center leading-4 font-bold">A</span> Alpha
  </div>

  {/* PENYELARASAN 4 STYLE BARU */}
  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-pink-200 border border-pink-300 inline-block"></span> Lupa absen masuk (LAM)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-emerald-200 border border-emerald-300 inline-block"></span> Lupa absen masuk LAM(P)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-sky-200 border border-sky-300 inline-block"></span> Lupa absen pulang (LAP)
  </div>

  <div className="flex items-center gap-1.5">
    <span className="w-4 h-4 rounded bg-rose-100 border border-rose-200 inline-block"></span> Lupa absen pulang LAP(P)
  </div>
</div>
</div>
  )
}
