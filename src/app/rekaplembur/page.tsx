'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'
import dayjs from 'dayjs'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ArrowLeft, Search, Filter } from 'lucide-react'

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function RekapLemburPage() {
  const router = useRouter()

  const [overtimes, setOvertimes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // filter
  const [filterType, setFilterType] = useState<'monthly' | 'custom'>('monthly')
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // format UI helper
  const formatDateUI = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    return dayjs(timeStr).format('HH:mm')
  }

  const hitungDurasi = (mulai: string | null, selesai: string | null) => {
    if (!mulai || !selesai) return '-'
    const d1 = dayjs(mulai)
    const d2 = dayjs(selesai)
    const diff = d2.diff(d1, 'minute')
    const jam = Math.floor(diff / 60)
    const menit = diff % 60
    return `${jam}j ${menit}m`
  }

  // === FETCH DATA LEMBUR ===
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User tidak ditemukan')
        setLoading(false)
        return
      }

      let startStr = ''
      let endStr = ''

      if (filterType === 'monthly') {
        const start = startOfMonth(new Date(year, month))
        const end = endOfMonth(new Date(year, month))
        startStr = format(start, 'yyyy-MM-dd')
        endStr = format(end, 'yyyy-MM-dd')
      } else {
        startStr = startDate
        endStr = endDate
      }

      const { data, error } = await supabase
        .from('lembur')
         .select("*")
        .eq('user_id', user.id)
        .gte("attendance_date", startStr)
        .lte("attendance_date", endStr)
        .order('attendance_date', { ascending: false })

      if (error) {
        toast.error('Gagal mengambil data lembur')
        setLoading(false)
        return
      }

      setOvertimes(data || [])
      setLoading(false)
    }

    fetchData()
  }, [filterType, month, year, startDate, endDate])

  // === EXPORT EXCEL ===
  const exportExcel = () => {
    const sheetData = overtimes.map((ot, i) => ({
      No: i + 1,
      Tanggal: formatDateUI(ot.attendance_date),
      Mulai: formatTime(ot.check_in),
      Selesai: formatTime(ot.check_out),
      Durasi: hitungDurasi(ot.check_in, ot.check_out),
      Kegiatan: ot.status || '-'
    }))

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lembur')

    const filename = `rekap_lembur_${year}_${month + 1}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  // === EXPORT PDF ===
  const exportPDF = () => {
    const doc = new jsPDF()

    doc.text('Rekap Lembur Pegawai', 14, 12)
    doc.text(
      `Periode: ${format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })}`,
      14,
      20
    )

    const rows = overtimes.map((ot, i) => [
      i + 1,
      formatDateUI(ot.attendance_date),
      formatTime(ot.check_in),
      formatTime(ot.check_out),
      hitungDurasi(ot.check_in, ot.check_out),
      ot.status || '-'
    ])

    ;(doc as any).autoTable({
      head: [['No', 'Tanggal', 'Mulai', 'Selesai', 'Durasi', 'Kegiatan']],
      body: rows,
      startY: 28
    })

    const filename = `rekap_lembur_${year}_${month + 1}.pdf`
    doc.save(filename)
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <Toaster position="top-center" />

      <header className="bg-purple-700 text-white p-4 flex items-center">
        {mounted && (
          <button onClick={() => router.back()} className="p-2 mr-2">
            <ArrowLeft />
          </button>
        )}
        <h1 className="font-bold">Rekap Lembur Saya</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">

        {/* FILTER */}
        <section className="bg-white rounded-xl p-4 shadow mb-4">
          <h2 className="text-sm font-bold flex gap-2 mb-2">
            <Filter /> Filter Periode
          </h2>

          <div className="flex bg-gray-100 p-1 rounded mb-3">
            <button
              onClick={() => setFilterType('monthly')}
              className={`flex-1 py-1 text-xs rounded ${filterType==='monthly'?'bg-white shadow':''}`}
            >
              Per Bulan
            </button>
            <button
              onClick={() => setFilterType('custom')}
              className={`flex-1 py-1 text-xs rounded ${filterType==='custom'?'bg-white shadow':''}`}
            >
              Custom
            </button>
          </div>

          {filterType === 'monthly' ? (
            <div className="flex gap-2">
              <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} className="flex-1 p-2 border rounded">
                {Array.from({length:12},(_,i)=>(
                  <option key={i} value={i}>
                    {format(new Date(2024,i), 'MMMM', {locale:idLocale})}
                  </option>
                ))}
              </select>

              <select value={year} onChange={e=>setYear(parseInt(e.target.value))} className="w-24 p-2 border rounded">
                {[2023,2024,2025,2026].map(y=>(
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 border rounded"/>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 border rounded"/>
            </div>
          )}
        </section>

        {/* EXPORT BUTTON */}
        <div className="flex gap-2 mb-4">
          <button onClick={exportExcel} className="flex-1 bg-green-600 text-white py-2 rounded">
            Cetak Excel
          </button>
          <button onClick={exportPDF} className="flex-1 bg-red-600 text-white py-2 rounded">
            Cetak PDF
          </button>
        </div>

        {/* LIST DATA */}
        {loading ? (
          <p className="text-center py-10">Memuat...</p>
        ) : overtimes.length === 0 ? (
          <div className="text-center py-10 bg-white rounded shadow">
            <Search className="mx-auto mb-2" />
            Tidak ada data lembur
          </div>
        ) : (
          <div className="space-y-3">
            {overtimes.map((ot)=>(
              <div key={ot.id} className="bg-white rounded-xl shadow p-3">
                <p className="font-bold">{formatDateUI(ot.attendance_date)}</p>

                <p className="text-sm">
                  ⏰ {formatTime(ot.check_in)} − {formatTime(ot.check_out)}
                  <br/>
                  🕒 Durasi: <b>{hitungDurasi(ot.check_in, ot.check_out)}</b>
                </p>
                <p className="text-sm">
                  📋 Kegiatan: {ot.status || '-'}
                </p>
                <p className="text-xs mt-1 text-gray-600">
                  📌 {ot.check_out_location || '-'}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
