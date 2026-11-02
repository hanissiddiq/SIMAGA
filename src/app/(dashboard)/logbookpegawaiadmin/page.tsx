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
    return <div className="p-10">Loading...</div>

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* HEADER */}
      <div className="flex flex-wrap gap-3 justify-between mb-4">

        <div className="flex gap-2">

          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 bg-gray-200 px-4 py-2 rounded"
          >
            <ArrowLeft size={18} />
            Kembali
          </button>

          <button
            onClick={exportExcel}
            className="flex gap-2 bg-green-600 text-white px-4 py-2 rounded"
          >
            <FileSpreadsheet />
            Export Excel
          </button>
        </div>

        <div className="flex gap-2">

          <button
            onClick={() =>
              setShowRandomOnly(!showRandomOnly)
            }
            className={`px-4 py-2 rounded text-white ${
              showRandomOnly
                ? 'bg-orange-600'
                : 'bg-blue-600'
            }`}
          >
            {showRandomOnly
              ? 'Tampilkan Semua'
              : 'Filter Random'}
          </button>

          <button
            onClick={handleApprove}
            className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded"
          >
            <CheckSquare size={18} />
            Setujui Logbook
          </button>
          <button
            onClick={handleAtensi}
            className="flex items-center gap-2 bg-orange-700 text-white px-4 py-2 rounded"
          >
            <CheckSquare size={18} />
            Atensi Logbook
          </button>
        </div>
      </div>

      {/* FILTER */}
      <div className="bg-white p-4 rounded mb-4 flex flex-wrap gap-4">

        <input
          placeholder="Cari nama / jabatan / status"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          className="border px-3 py-2 w-64"
        />

        <select
          value={filterMode}
          onChange={(e) =>
            setFilterMode(e.target.value as any)
          }
          className="border px-3 py-2"
        >
          <option value="daily">Harian</option>
          <option value="monthly">Bulanan</option>
        </select>

        {filterMode === 'daily' ? (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) =>
              setSelectedDate(e.target.value)
            }
            className="border px-3 py-2"
          />
        ) : (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) =>
              setSelectedMonth(e.target.value)
            }
            className="border px-3 py-2"
          />
        )}
      </div>

      {/* TABLE */}
      <div className="overflow-auto">
        <table className="w-full bg-white">

          <thead className="bg-blue-900 text-white">
            <tr>

              <th className="p-2">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={
                    pageData.length > 0 &&
                    pageData.every((item) =>
                      selectedIds.includes(item.id)
                    )
                  }
                />
              </th>

              <th className="p-2">No</th>
              <th className="p-2">Nama</th>
              <th className="p-2">Tanggal</th>
              <th className="p-2">Shift</th>
              <th className="p-2">Status</th>
              <th className="p-2">Review</th>
              <th className="p-2">Uraian</th>
            </tr>
          </thead>

          <tbody>
            {pageData.map((r, i) => (
              <tr
                key={r.id}
                className="border-t hover:bg-gray-50"
              >

                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    disabled={r.activity_name === 'pimpinan'}
                    checked={
                      r.activity_name === 'pimpinan'
                        ? false
                        : selectedIds.includes(r.id)
                    }
                    onChange={() => handleSelect(r.id)}
                    className={`w-4 h-4 ${
                      r.activity_name === 'pimpinan'
                        ? 'cursor-not-allowed opacity-40'
                        : 'cursor-pointer'
                    }`}
                  />
                </td>

                <td className="p-2 text-center">
                  {startIdx + i + 1}
                </td>

                <td className="p-2">
                  <div className="font-semibold">
                    {r.full_name}
                  </div>

                  <div className="text-xs text-gray-500">
                    {r.position}
                  </div>
                </td>

                <td className="p-2">
                  {format(
                    new Date(r.attendance_date),
                    'dd/MM/yyyy'
                  )}
                </td>

                <td className="p-2">
                  {r.shift}
                </td>

                <td className="p-2">
                  {r.status}
                </td>

                <td className="p-2">
                  {r.activity_name === 'random' || r.activity_name === 'atensi' ? (
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold">
                      {r.activity_name?.toUpperCase()}
                    </span>
                  ) : r.activity_name ===
                    'pimpinan' ? (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                      PIMPINAN
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-bold">
                      {r.activity_name || 'System'}
                    </span>
                  )}
                </td>

                <td className="p-2 text-sm">
                  {r.uraian_kerja}
                  <br />
                  {r.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-center gap-1 mt-4">

        <button
          disabled={currentPage === 1}
          onClick={() =>
            setCurrentPage((p) => p - 1)
          }
        >
          <ChevronLeft />
        </button>

        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={i} className="px-2">
              ...
            </span>
          ) : (
            <button
              key={i}
              onClick={() =>
                setCurrentPage(p as number)
              }
              className={`px-3 ${
                p === currentPage &&
                'bg-blue-600 text-white'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          disabled={currentPage === totalPages}
          onClick={() =>
            setCurrentPage((p) => p + 1)
          }
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}