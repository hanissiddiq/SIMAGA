'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'
import dayjs from 'dayjs'
import { 
  format, 
  startOfMonth, 
  endOfMonth 
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ArrowLeft, Calendar, Filter, Search, BookOpen, X } from 'lucide-react'

const StatusBadge = ({ status }: { status: string }) => {
  const styles =
    status === 'Tepat Waktu'
      ? 'bg-green-100 text-green-800'
      : status === 'Terlambat'
      ? 'bg-yellow-100 text-yellow-800'
      : status === 'Pulang Sebelum Waktu'
      ? 'bg-red-100 text-red-800'
      : 'bg-gray-100 text-gray-800'

  return (
    <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md ${styles}`}>
      {status}
    </div>
  )
}

export default function RekapAbsensiPage() {
  const router = useRouter()
  const [attendances, setAttendances] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [userPos, setUserPos] = useState<string>('')

  const [selectedLogbook, setSelectedLogbook] = useState<any[]>([])
  const [showLogbookModal, setShowLogbookModal] = useState(false)
  const [loadingLogbook, setLoadingLogbook] = useState(false)

  const [filterType, setFilterType] = useState<'monthly' | 'custom'>('monthly')
  const [month, setMonth] = useState<number>(new Date().getMonth()) 
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User tidak ditemukan')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('position')
        .eq('id', user.id)
        .single()

      const currentPos = (profile?.position || '').toUpperCase()
      setUserPos(currentPos)

      // Tentukan range tanggal
      let startStr = '', endStr = ''
      if (filterType === 'monthly') {
        const start = startOfMonth(new Date(year, month))
        const end = endOfMonth(new Date(year, month))
        startStr = format(start, 'yyyy-MM-dd')
        endStr = format(end, 'yyyy-MM-dd')
      } else {
        startStr = startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd')
        endStr = endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')
      }

      // Ambil data absen
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr)
        .order('attendance_date', { ascending: false })
        .order('shift', { ascending: true })

      if (error) {
        toast.error('Gagal mengambil data absensi')
        setLoading(false)
        return
      }

      // --- Hitung status masuk, pulang dini, flexi ---
      const processed = (data || []).map((att) => {
        if (!att.check_in) return { ...att, computedStatus: 'Tidak Hadir', isTerlambat: false, isFlexi: false, isPulangDini: false }

        const checkInTime = dayjs(att.check_in)
        const checkOutTime = att.check_out ? dayjs(att.check_out) : null

        let limitInHour, limitInMin, limitOutHour, limitOutMin

        if ((att.shift || '').toLowerCase().includes('pagi')) {
          if (currentPos.includes('SATPAM')) [limitInHour, limitInMin] = [7, 45]
          else if (currentPos.includes('CS')) [limitInHour, limitInMin] = [7, 30]
          else [limitInHour, limitInMin] = [7, 30] // Default untuk shift pagi PPNPN
          limitOutHour = 17; limitOutMin = 0
        } else {
          if (currentPos.includes('SATPAM')) [limitInHour, limitInMin] = [19, 45]
          else [limitInHour, limitInMin] = [19, 0]
          limitOutHour = 2; limitOutMin = 0
        }

        const totalMinutesIn = checkInTime.hour() * 60 + checkInTime.minute()
        let totalMinutesOut: number | null = checkOutTime ? checkOutTime.hour() * 60 + checkOutTime.minute() : null
        let limitOutMinutes = limitOutHour * 60 + limitOutMin

        // Pulang dini shift malam melewati tengah malam
        if (checkOutTime && (att.shift || '').toLowerCase().includes('malam')) {
          if (limitOutHour < limitInHour && totalMinutesOut !== null && totalMinutesOut < limitInHour*60) totalMinutesOut += 24*60
          if (limitOutHour < limitInHour) limitOutMinutes += 24*60
        }

        const isTerlambat = totalMinutesIn > (limitInHour*60 + limitInMin)
        const isFlexi = isTerlambat && totalMinutesIn - (limitInHour*60 + limitInMin) <= 15
        const isPulangDini = checkOutTime && totalMinutesOut !== null ? totalMinutesOut < limitOutMinutes : false

        let computedStatus = isTerlambat ? 'Terlambat' : 'Tepat Waktu'
        if (isPulangDini) computedStatus = 'Pulang Sebelum Waktu'

        return { ...att, computedStatus, isTerlambat, isFlexi, isPulangDini }
      })

      setAttendances(processed)
      setLoading(false)
    }

    fetchData()
  }, [filterType, month, year, startDate, endDate, userPos])

  // Statistik Kehadiran
  const stats = useMemo(() => {
    const uniqueDates = new Set(attendances.map(a => a.attendance_date))
    const counts = { TepatWaktu: 0, Terlambat: 0, PulangDini: 0, TidakHadir: 0 }

    attendances.forEach((a) => {
      if (a.computedStatus === 'Tepat Waktu') counts.TepatWaktu++
      else if (a.computedStatus === 'Terlambat') counts.Terlambat++
      else if (a.computedStatus === 'Pulang Sebelum Waktu') counts.PulangDini++
      else counts.TidakHadir++
    })

    return { ...counts, totalHari: uniqueDates.size }
  }, [attendances])

  const formatDateUI = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { weekday: 'short', day:'numeric', month:'short', year:'numeric' })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--'
    return new Date(timeStr).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', hour12:false })
  }

  const formatCoord = (lat: number | null, lon: number | null) =>
    lat !== null && lon !== null ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : '-'

  const formatDistance = (dist: number | null) => (dist !== null ? `${dist.toFixed(1)} m` : '-')

  const handleViewLogbook = async (
    attendanceId: string
  ) => {
    try {
      setLoadingLogbook(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User tidak ditemukan')
        return
      }

      const { data, error } = await supabase
        .from('vlogbook')
        .select('uraian_kerja, description')
        .eq('id', attendanceId)
        .order('attendance_date', { ascending: true })

      if (error) throw error

      setSelectedLogbook(data || [])
      setShowLogbookModal(true)

      if (!data || data.length === 0) {
        toast('Tidak ada logbook pada tanggal ini')
      }

    } catch (error) {
      console.error(error)
      toast.error('Gagal mengambil logbook')
    } finally {
      setLoadingLogbook(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-10">
      <Toaster position="top-center" />

      <header className="bg-blue-800 text-white p-4 shadow-md flex items-center sticky top-0 z-10">
        {mounted && <button onClick={() => router.back()} className="p-2 mr-2 rounded-full hover:bg-blue-700 transition">
          <ArrowLeft className="w-6 h-6" />
        </button>}
        <h1 className="text-xl font-bold">Rekap Absensi Saya</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* Statistik Kehadiran */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">RINGKASAN KEHADIRAN</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-xs text-blue-600 font-semibold block">Total Hari</span>
                <span className="text-2xl font-bold text-blue-900">{stats.totalHari}</span>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <span className="text-xs text-green-600 font-semibold block">Tepat Waktu</span>
                <span className="text-2xl font-bold text-green-900">{stats.TepatWaktu}</span>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <span className="text-xs text-yellow-600 font-semibold block">Terlambat</span>
                <span className="text-2xl font-bold text-yellow-900">{stats.Terlambat}</span>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <span className="text-xs text-red-600 font-semibold block">PSW</span>
                <span className="text-2xl font-bold text-red-900">{stats.PulangDini}</span>
            </div>
          </div>
        </section>

        {/* Riwayat Absensi */}
        <section>
          {loading ? <p>Memuat...</p> :
            attendances.map(att => (
              <div key={`${att.attendance_date}-${att.shift}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-3">
                <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                  <div>
                    <p className="font-bold text-gray-800">{formatDateUI(att.attendance_date)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded inline-block uppercase font-semibold">
                        Shift: {att.shift}
                      </span>

                      <button
                        onClick={() => handleViewLogbook(att.id)}
                        className="flex items-center gap-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition"
                      >
                        <BookOpen size={14} />
                        Logbook
                      </button>
                    </div>
                  </div>
                  <StatusBadge status={att.computedStatus} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Masuk */}
                  <div className="bg-blue-50/50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Absen Masuk</p>
                    <p className="font-mono font-bold text-gray-800 text-lg">{att.check_in ? formatTime(att.check_in) : '--:--'}</p>
                    <div className="mt-2 text-[10px] text-gray-500 space-y-0.5">
                      <p className="line-clamp-1">{att.check_in_location || '-'}</p>
                      <p className="font-mono text-gray-400">{formatCoord(att.check_in_latitude, att.check_in_longitude)}</p>
                      <p className="font-semibold text-blue-700">Jarak: {formatDistance(att.check_in_distance_m)}</p>
                    </div>
                  </div>

                  {/* Pulang */}
                  <div className="bg-orange-50/50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Absen Pulang</p>
                    <p className="font-mono font-bold text-gray-800 text-lg">{att.check_out ? formatTime(att.check_out) : '--:--'}</p>
                    <div className="mt-2 text-[10px] text-gray-500 space-y-0.5">
                      <p className="line-clamp-1">{att.check_out_location || '-'}</p>
                      <p className="font-mono text-gray-400">{formatCoord(att.check_out_latitude, att.check_out_longitude)}</p>
                      <p className="font-semibold text-orange-700">Jarak: {formatDistance(att.check_out_distance_m)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </section>
      </main>

      {showLogbookModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">

            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-lg text-gray-800">
                Detail Logbook
              </h2>

              <button
                onClick={() => setShowLogbookModal(false)}
                className="text-gray-500 hover:text-red-500"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[65vh]">

              {loadingLogbook ? (
                <p className="text-center text-gray-500">
                  Memuat logbook...
                </p>
              ) : selectedLogbook.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  Tidak ada logbook pada tanggal ini
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedLogbook.map((log, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-xl p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-800">
                          {log.judul_kegiatan || 'Kegiatan'}
                        </h3>

                        <span className="text-xs text-gray-400">
                          verifikasi: {log.activity_name === 'random' ? 'Random' : 'System'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 whitespace-pre-line">
                        {log.uraian_kerja || '-'} <br/>
                        {log.description || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}