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
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      : status === 'Terlambat'
      ? 'bg-[var(--djkn-gold)]/15 text-amber-800 border border-[var(--djkn-gold)]/30'
      : status === 'Pulang Sebelum Waktu'
      ? 'bg-red-100 text-red-800 border border-red-200'
      : 'bg-slate-100 text-slate-700 border border-slate-200'

  return (
    <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${styles}`}>
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_28%),linear-gradient(180deg,#f5f8fc_0%,#edf4fb_100%)] pb-10 font-sans text-slate-800">
      <Toaster position="top-center" />

      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/20 bg-[var(--djkn-blue)] px-4 py-4 text-white shadow-[0_18px_35px_rgba(0,95,172,0.18)] sm:px-6">
        {mounted && (
          <button onClick={() => router.back()} className="rounded-full border border-white/20 bg-white/10 p-2 transition hover:bg-white/15">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Rekap</p>
          <h1 className="text-lg font-black sm:text-xl">Rekap Absensi Saya</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <section className="mb-6 overflow-hidden rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Ringkasan Kehadiran</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Performa Absensi</h2>
            </div>
            <div className="rounded-2xl border border-[var(--djkn-gold)]/30 bg-[var(--djkn-gold)]/10 px-3 py-2 text-sm font-semibold text-slate-700">
              {filterType === 'monthly' ? `${new Date(year, month).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}` : 'Filter Tanggal Kustom'}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[var(--djkn-blue)]/15 bg-[var(--djkn-blue)]/5 p-4">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--djkn-blue)]">Total Hari</span>
              <span className="mt-3 block text-3xl font-black text-[var(--djkn-blue)]">{stats.totalHari}</span>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Tepat Waktu</span>
              <span className="mt-3 block text-3xl font-black text-emerald-800">{stats.TepatWaktu}</span>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Terlambat</span>
              <span className="mt-3 block text-3xl font-black text-amber-800">{stats.Terlambat}</span>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">Pulang Dini</span>
              <span className="mt-3 block text-3xl font-black text-red-800">{stats.PulangDini}</span>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
              <button
                onClick={() => setFilterType('monthly')}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${filterType === 'monthly' ? 'bg-[var(--djkn-blue)] text-white shadow' : 'text-slate-600'}`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setFilterType('custom')}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${filterType === 'custom' ? 'bg-[var(--djkn-blue)] text-white shadow' : 'text-slate-600'}`}
              >
                Custom
              </button>
            </div>

            <div className="flex items-center gap-2 text-slate-500">
              <Calendar size={16} />
              <span className="text-sm font-semibold">Filter Data Absensi</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {filterType === 'monthly' ? (
              <>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none ring-0 transition focus:border-[var(--djkn-gold)] focus:bg-white">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{new Date(2024, i).toLocaleString('id-ID', { month: 'long' })}</option>
                  ))}
                </select>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white">
                  {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-[var(--djkn-gold)] focus:bg-white" />
              </>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-8 text-center text-slate-500 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              Memuat riwayat absensi...
            </div>
          ) : attendances.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-10 text-center text-slate-500 shadow-sm">
              Belum ada data absensi pada rentang tanggal yang dipilih.
            </div>
          ) : (
            attendances.map(att => (
              <div key={`${att.attendance_date}-${att.shift}`} className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-900">{formatDateUI(att.attendance_date)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                        Shift: {att.shift}
                      </span>
                      <button
                        onClick={() => handleViewLogbook(att.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--djkn-blue)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--djkn-blue)] transition hover:bg-[var(--djkn-blue)]/15"
                      >
                        <BookOpen size={12} /> Logbook
                      </button>
                    </div>
                  </div>
                  <StatusBadge status={att.computedStatus} />
                </div>

                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--djkn-blue)]/15 bg-[var(--djkn-blue)]/5 p-3.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--djkn-blue)]">Absen Masuk</p>
                    <p className="mt-2 font-mono text-2xl font-black text-slate-900">{att.check_in ? formatTime(att.check_in) : '--:--'}</p>
                    <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                      <p>{att.check_in_location || '-'}</p>
                      <p className="font-mono text-slate-500">{formatCoord(att.check_in_latitude, att.check_in_longitude)}</p>
                      <p className="font-bold text-[var(--djkn-blue)]">Jarak: {formatDistance(att.check_in_distance_m)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Absen Pulang</p>
                    <p className="mt-2 font-mono text-2xl font-black text-slate-900">{att.check_out ? formatTime(att.check_out) : '--:--'}</p>
                    <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                      <p>{att.check_out_location || '-'}</p>
                      <p className="font-mono text-slate-500">{formatCoord(att.check_out_latitude, att.check_out_longitude)}</p>
                      <p className="font-bold text-amber-700">Jarak: {formatDistance(att.check_out_distance_m)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {showLogbookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="text-lg font-black text-slate-900">Detail Logbook</h2>
              <button onClick={() => setShowLogbookModal(false)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-red-500">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4">
              {loadingLogbook ? (
                <p className="py-10 text-center text-slate-500">Memuat logbook...</p>
              ) : selectedLogbook.length === 0 ? (
                <div className="py-10 text-center text-slate-500">Tidak ada logbook pada tanggal ini</div>
              ) : (
                <div className="space-y-3">
                  {selectedLogbook.map((log, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="font-black text-slate-800">{log.judul_kegiatan || 'Kegiatan'}</h3>
                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          {log.activity_name === 'random' ? 'Random' : 'System'}
                        </span>
                      </div>

                      <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                        {log.uraian_kerja || '-'}
                        <br />
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