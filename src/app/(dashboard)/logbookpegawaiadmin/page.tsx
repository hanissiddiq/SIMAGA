'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CheckSquare
} from 'lucide-react'
import XLSX from 'xlsx-js-style'
import { format, startOfMonth, endOfMonth } from 'date-fns'

interface Attendance {
  id: number
  attendance_date: string
  shift?: string
  status?: string
  full_name: string
  position: string
  uraian_kerja: string
  description: string
  activity_name?: string
}

export default function LogbookPegawaiAdminPage() {
  const router = useRouter()

  /* ================= STATE ================= */
  const [rawData, setRawData] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  // FILTER
  const [filterMode, setFilterMode] = useState<'daily' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [search, setSearch] = useState('')

  // FILTER RANDOM
  const [showRandomOnly, setShowRandomOnly] = useState(false)

  // APPROVAL MULTIPLE
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  /* ================= INIT DATE ================= */
  useEffect(() => {
    const now = new Date()
    setSelectedDate(format(now, 'yyyy-MM-dd'))
    setSelectedMonth(format(now, 'yyyy-MM'))
  }, [])

  /* ================= DATE RANGE (SAFE) ================= */
  const getDateRange = () => {
    if (filterMode === 'daily') {
      const d = selectedDate || format(new Date(), 'yyyy-MM-dd')
      return { start: d, end: d }
    }

    if (!selectedMonth) {
      const now = new Date()
      return {
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: format(endOfMonth(now), 'yyyy-MM-dd')
      }
    }

    const [y, m] = selectedMonth.split('-')

    const start = startOfMonth(
      new Date(Number(y), Number(m) - 1)
    )

    const end = endOfMonth(start)

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    }
  }

  /* ================= FETCH BACKEND ================= */
  const fetchData = async () => {
    setLoading(true)

    try {
      const { start, end } = getDateRange()

      let query = supabase
        .from('vlogbook')
        .select('*')
        .gte('attendance_date', start)
        .lte('attendance_date', end)
        .order('attendance_date', {
          ascending: false
        })

      if (showRandomOnly) {
        query = query.in('activity_name', [
          'random',
          'atensi'
        ])
      }

      const { data, error } = await query

      if (error) throw error

      setRawData(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [
    filterMode,
    selectedDate,
    selectedMonth,
    showRandomOnly
  ])

  /* ================= FILTER FRONTEND ================= */
  const filteredData = useMemo(() => {
    if (!search) return rawData

    const q = search.toLowerCase()

    return rawData.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.position?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
    )
  }, [rawData, search])

  const stats = useMemo(() => {
    const total = filteredData.length
    const random = filteredData.filter(
      (item) => item.activity_name === 'random' || item.activity_name === 'atensi'
    ).length
    const approved = filteredData.filter(
      (item) => item.activity_name === 'pimpinan'
    ).length

    return { total, random, approved }
  }, [filteredData])

  /* RESET PAGE */
  useEffect(() => {
    setCurrentPage(1)
  }, [
    search,
    filterMode,
    selectedDate,
    selectedMonth,
    showRandomOnly
  ])

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(
    filteredData.length / itemsPerPage
  )

  const startIdx = (currentPage - 1) * itemsPerPage

  const pageData = filteredData.slice(
    startIdx,
    startIdx + itemsPerPage
  )

  const getPages = () => {
    if (totalPages <= 7)
      return Array.from(
        { length: totalPages },
        (_, i) => i + 1
      )

    if (currentPage <= 4)
      return [
        1,
        2,
        3,
        4,
        '...',
        totalPages - 2,
        totalPages - 1,
        totalPages
      ]

    if (currentPage >= totalPages - 3)
      return [
        1,
        2,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      ]

    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages
    ]
  }

  /* ================= CHECKBOX ================= */
  const handleSelect = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id)
      }

      return [...prev, id]
    })
  }

  const handleSelectAll = () => {
    const allIds = pageData.map((item) => item.id)

    const isAllSelected = allIds.every((id) =>
      selectedIds.includes(id)
    )

    if (isAllSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(allIds)
    }
  }

  /* ================= APPROVAL ================= */
  const handleApprove = async () => {
    try {
      if (selectedIds.length === 0) {
        alert('Pilih data terlebih dahulu')
        return
      }

      const { error } = await supabase
        .from('logbooks')
        .update({
          activity_name: 'pimpinan'
        })
        .in('attendance_id', selectedIds)

      if (error) throw error

      alert('Approval berhasil')

      setSelectedIds([])

      fetchData()
    } catch (err) {
      console.error(err)
      alert('Gagal approval')
    }
  }

  const handleAtensi = async () => {
    try {
      if (selectedIds.length === 0) {
        alert('Pilih data terlebih dahulu')
        return
      }

      const { error } = await supabase
        .from('logbooks')
        .update({
          activity_name: 'atensi'
        })
        .in('attendance_id', selectedIds)

      if (error) throw error

      alert('Approval berhasil')

      setSelectedIds([])

      fetchData()
    } catch (err) {
      console.error(err)
      alert('Gagal approval')
    }
  }

  /* ================= EXPORT EXCEL ================= */
  const exportExcel = () => {
    if (!filteredData.length)
      return alert('Data kosong')

    const rows = filteredData.map((r, i) => ({
      No: i + 1,
      Nama: r.full_name,
      Jabatan: r.position,
      Tanggal: format(
        new Date(r.attendance_date),
        'dd/MM/yyyy'
      ),
      Shift: r.shift || '-',
      Status: r.status || '-',
      Uraian: r.uraian_kerja || '-',
      Review: r.activity_name || 'System'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Logbook'
    )

    XLSX.writeFile(
      wb,
      filterMode === 'daily'
        ? `Logbook_${selectedDate}.xlsx`
        : `Logbook_${selectedMonth}.xlsx`
    )
  }

  /* ================= RENDER ================= */
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#eaf4ff_0%,#f5f8fc_45%,#eef3f7_100%)] text-slate-700">
        <div className="rounded-2xl border border-sky-200 bg-white px-8 py-5 shadow-lg shadow-sky-100">
          Loading...
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf4ff_0%,#f5f8fc_38%,#edf3f7_100%)] p-4 md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="djkn-header mb-6 overflow-hidden rounded-[22px] border border-[#005fac]/20 shadow-[0_18px_45px_rgba(0,95,172,0.12)]">
          <div className="flex flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
            <div>
              <p className="mb-2 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                DJKN Dashboard
              </p>
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                Logbook Pegawai
              </h1>
              <p className="mt-1 text-sm text-sky-100">
                Kelola review logbook, approval, dan filter data pegawai dengan cepat.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
              >
                <ArrowLeft size={16} />
                Kembali
              </button>

              <button
                onClick={exportExcel}
                className="flex items-center gap-2 rounded-xl bg-[#02a54f] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
              >
                <FileSpreadsheet size={16} />
                Export Excel
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 bg-white/5 p-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-100">Total Data</p>
              <p className="mt-2 text-3xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-[#fab715]/30 bg-[#fab715]/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-yellow-100">Butuh Review</p>
              <p className="mt-2 text-3xl font-bold text-white">{stats.random}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Disetujui</p>
              <p className="mt-2 text-3xl font-bold text-white">{stats.approved}</p>
            </div>
          </div>
        </header>

        <div className="mb-6 rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap gap-3">
              <input
                placeholder="Cari nama / jabatan / status"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#005fac] focus:bg-white focus:ring-4 focus:ring-sky-100"
              />

              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#005fac] focus:bg-white focus:ring-4 focus:ring-sky-100"
              >
                <option value="daily">Harian</option>
                <option value="monthly">Bulanan</option>
              </select>

              {filterMode === 'daily' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#005fac] focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
              ) : (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#005fac] focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowRandomOnly(!showRandomOnly)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition ${
                  showRandomOnly
                    ? 'bg-[#fab715] text-slate-900 hover:bg-[#efb20a]'
                    : 'bg-[#005fac] hover:bg-[#004c8a]'
                }`}
              >
                {showRandomOnly ? 'Tampilkan Semua' : 'Filter Random'}
              </button>

              <button
                onClick={handleApprove}
                className="flex items-center gap-2 rounded-xl bg-[#02a54f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:brightness-110"
              >
                <CheckSquare size={16} />
                Setujui Logbook
              </button>

              <button
                onClick={handleAtensi}
                className="flex items-center gap-2 rounded-xl bg-[#f59e0b] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-500/20 transition hover:brightness-110"
              >
                <CheckSquare size={16} />
                Atensi Logbook
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="bg-[#005fac] text-white">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        pageData.length > 0 &&
                        pageData.every((item) => selectedIds.includes(item.id))
                      }
                      className="h-4 w-4 accent-[#fab715]"
                    />
                  </th>
                  <th className="p-3 text-left text-sm font-semibold">No</th>
                  <th className="p-3 text-left text-sm font-semibold">Nama</th>
                  <th className="p-3 text-left text-sm font-semibold">Tanggal</th>
                  <th className="p-3 text-left text-sm font-semibold">Shift</th>
                  <th className="p-3 text-left text-sm font-semibold">Status</th>
                  <th className="p-3 text-left text-sm font-semibold">Review</th>
                  <th className="p-3 text-left text-sm font-semibold">Uraian</th>
                </tr>
              </thead>

              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                      Tidak ada data yang sesuai dengan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  pageData.map((r, i) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-200 transition hover:bg-sky-50/60"
                    >
                      <td className="p-3 text-center align-top">
                        <input
                          type="checkbox"
                          disabled={r.activity_name === 'pimpinan'}
                          checked={
                            r.activity_name === 'pimpinan'
                              ? false
                              : selectedIds.includes(r.id)
                          }
                          onChange={() => handleSelect(r.id)}
                          className={`h-4 w-4 ${
                            r.activity_name === 'pimpinan'
                              ? 'cursor-not-allowed opacity-40 accent-slate-300'
                              : 'cursor-pointer accent-[#005fac]'
                          }`}
                        />
                      </td>

                      <td className="p-3 text-center align-top text-sm font-medium text-slate-600">
                        {startIdx + i + 1}
                      </td>

                      <td className="p-3 align-top">
                        <div className="font-semibold text-slate-800">{r.full_name}</div>
                        <div className="mt-1 text-xs text-slate-500">{r.position}</div>
                      </td>

                      <td className="p-3 align-top text-sm text-slate-700">
                        {format(new Date(r.attendance_date), 'dd/MM/yyyy')}
                      </td>

                      <td className="p-3 align-top text-sm text-slate-700">{r.shift}</td>

                      <td className="p-3 align-top text-sm text-slate-700">{r.status}</td>

                      <td className="p-3 align-top">
                        {r.activity_name === 'random' || r.activity_name === 'atensi' ? (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-yellow-700">
                            {r.activity_name?.toUpperCase()}
                          </span>
                        ) : r.activity_name === 'pimpinan' ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                            PIMPINAN
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                            {r.activity_name || 'System'}
                          </span>
                        )}
                      </td>

                      <td className="p-3 align-top text-sm leading-6 text-slate-700">
                        <div className="font-medium text-slate-800">{r.uraian_kerja}</div>
                        <div className="mt-1 text-slate-500">{r.description}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredData.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              disabled={currentPage === 1 || totalPages === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#005fac] hover:text-[#005fac] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>

            {getPages().map((p, i) =>
              p === '...' ? (
                <span key={i} className="px-2 text-sm text-slate-500">
                  ...
                </span>
              ) : (
                <button
                  key={i}
                  onClick={() => setCurrentPage(p as number)}
                  className={`flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition ${
                    p === currentPage
                      ? 'bg-[#005fac] text-white shadow-md shadow-sky-200'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-[#005fac] hover:text-[#005fac]'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#005fac] hover:text-[#005fac] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}