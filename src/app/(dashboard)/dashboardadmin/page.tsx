'use client'

import React, { useEffect, useState } from 'react'

import {
  User,
  LogOut,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BookOpenCheck,
  FilterX,
  CalendarDays
} from 'lucide-react'

import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabaseClient'

import { Toaster } from 'react-hot-toast'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'

export default function DashboardAdmin() {

  const router = useRouter()

  // ==============================
  // STATE
  // ==============================

  const today = new Date()

  const [selectedYear, setSelectedYear] =
    useState(
      today.getFullYear().toString()
    )

  const [selectedMonth, setSelectedMonth] =
    useState(
      today.getMonth().toString()
    )

  const [chartData, setChartData] =
    useState<any[]>([])

  const [totalPegawai, setTotalPegawai] =
    useState<number>(0)

  const [isLoading, setIsLoading] =
    useState(true)

  const [isLoggingOut, setIsLoggingOut] =
    useState(false)

  const [userData, setUserData] =
    useState({
      fullName: 'Loading...',
      email: 'loading@kppn.go.id'
    })

  // ==============================
  // MONTH NAME
  // ==============================

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
  ]

  // ==============================
  // FETCH DATA
  // ==============================

  useEffect(() => {

    const init = async () => {

      try {

        setIsLoading(true)

        // ==============================
        // AUTH
        // ==============================

        const {
          data: { user }
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        // ==============================
        // PROFILE
        // ==============================

        const {
          data: profile
        } = await supabase
          .from('profiles')
          .select(`
            full_name,
            email,
            role
          `)
          .eq('id', user.id)
          .single()

        if (!profile) {
          router.replace('/')
          return
        }

        const allowedRoles = [
          'admin',
          'kepala_kantor',
          'kasubbag'
        ]

        if (
          !allowedRoles.includes(profile.role)
        ) {
          router.replace('/')
          return
        }

        setUserData({
          fullName:
            profile.full_name || 'Admin',
          email:
            profile.email || user.email || '-'
        })

        // ==============================
        // TOTAL PEGAWAI
        // ==============================

        const {
          data: pegawaiData
        } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('role', 'pegawai')

        setTotalPegawai(
          pegawaiData?.length || 0
        )

        // ==============================
        // FETCH RAPOR
        // ==============================

        const {
          data: raporData,
          error: raporError
        } = await supabase
          .from('v_rapor_bulanan')
          .select(`
            bulan,
            total_hadir,
            terlambat,
            absen_luar_radius,
            logbook
          `)
          .order('bulan', {
            ascending: true
          })

        if (raporError) {
          console.error(
            'RAPOR ERROR:',
            raporError
          )
          return
        }

        // ==============================
        // AGGREGATION
        // ==============================

        const aggregation:
          Record<string, any> = {}

        raporData?.forEach((item: any) => {

          if (!item.bulan) return

          const dateObj =
            new Date(item.bulan)

          const year =
            dateObj.getFullYear()

          const monthIndex =
            dateObj.getMonth()

          // ==============================
          // FILTER TAHUN
          // ==============================

          if (
            selectedYear !== 'all' &&
            year !== Number(selectedYear)
          ) {
            return
          }

          // ==============================
          // FILTER BULAN
          // ==============================

          if (
            selectedMonth !== 'all' &&
            monthIndex !== Number(selectedMonth)
          ) {
            return
          }

          let key = ''

          // ==============================
          // SEMUA TAHUN
          // ==============================

          if (selectedYear === 'all') {

            key =
              `${monthNames[monthIndex].substring(0, 3)} ${year}`

            if (!aggregation[key]) {

              aggregation[key] = {
                name: key,
                TepatWaktu: 0,
                Terlambat: 0,
                LuarRadius: 0,
                TotalLogbook: 0,
                sortKey:
                  new Date(
                    year,
                    monthIndex,
                    1
                  ).getTime()
              }
            }
          }

          // ==============================
          // PER TAHUN
          // ==============================

          else if (
            selectedMonth === 'all'
          ) {

            key =
              monthNames[monthIndex]

            if (!aggregation[key]) {

              aggregation[key] = {
                name: key,
                TepatWaktu: 0,
                Terlambat: 0,
                LuarRadius: 0,
                TotalLogbook: 0,
                sortKey: monthIndex
              }
            }
          }

          // ==============================
          // PER BULAN
          // ==============================

          else {

            const tanggal =
              String(
                dateObj.getDate()
              ).padStart(2, '0')

            key =
              `${year}-${monthIndex}-${tanggal}`

            if (!aggregation[key]) {

              aggregation[key] = {
                name: tanggal,
                TepatWaktu: 0,
                Terlambat: 0,
                LuarRadius: 0,
                TotalLogbook: 0,
                sortKey:
                  dateObj.getTime()
              }
            }
          }

          // ==============================
          // HITUNG
          // ==============================

          const totalHadir =
            Number(item.total_hadir || 0)

          const terlambat =
            Number(item.terlambat || 0)

          const luarRadius =
            Number(
              item.absen_luar_radius || 0
            )

          const totalLogbook =
            Number(item.logbook || 0)

          aggregation[key].Terlambat +=
            terlambat

          aggregation[key].LuarRadius +=
            luarRadius

          aggregation[key].TotalLogbook +=
            totalLogbook

          aggregation[key].TepatWaktu +=
            Math.max(
              totalHadir - terlambat,
              0
            )

        })

        // ==============================
        // FINAL DATA
        // ==============================

        const finalData =
          Object.values(aggregation)
            .sort(
              (a: any, b: any) =>
                a.sortKey - b.sortKey
            )

        setChartData(finalData)

      } catch (err) {

        console.error(err)

      } finally {

        setIsLoading(false)
      }
    }

    init()

  }, [
    router,
    selectedYear,
    selectedMonth
  ])

  // ==============================
  // LOGOUT
  // ==============================

  const handleLogout = async () => {

    setIsLoggingOut(true)

    await supabase.auth.signOut()

    router.replace('/login')
  }

  // ==============================
  // TITLE
  // ==============================

  const getChartTitleSuffix = () => {

    if (selectedYear === 'all') {
      return '(Semua Waktu)'
    }

    if (selectedMonth === 'all') {
      return `(Tahun ${selectedYear})`
    }

    return `(${monthNames[Number(selectedMonth)]} ${selectedYear})`
  }

  // ==============================
  // TOOLTIP
  // ==============================

  const formatTooltipLabel = (
    label: any
  ) => {

    if (selectedYear === 'all') {
      return `Periode: ${label}`
    }

    if (selectedMonth === 'all') {
      return `Bulan: ${label} ${selectedYear}`
    }

    return `Tanggal ${label} ${monthNames[Number(selectedMonth)]} ${selectedYear}`
  }

  // ==============================
  // LOADING
  // ==============================

  if (isLoading || isLoggingOut) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-slate-50">

        <div className="flex flex-col items-center">

          <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />

          <p className="mt-4 text-slate-600 font-semibold">

            {isLoggingOut
              ? 'Menutup Sesi...'
              : 'Memuat Dashboard Admin...'}

          </p>

        </div>

      </div>
    )
  }

  // ==============================
  // UI
  // ==============================

  return (

    <div className="min-h-screen bg-slate-50 font-sans pb-10">

      <Toaster position="top-center" />

      {/* HEADER */}

      <header className="bg-blue-900 text-white p-6 pb-20 shadow-xl rounded-b-3xl">

        <div className="flex justify-between items-start">

          <div className="flex items-center space-x-3">

            <div className="p-2.5 rounded-xl bg-white/10">

              <User
                size={24}
                className="text-white"
              />

            </div>

            <div>

              <h1 className="text-xl font-extrabold">

                {userData.fullName}

              </h1>

              <p className="text-xs text-blue-200">

                {userData.email}

              </p>

            </div>

          </div>

          

        </div>

      </header>

      {/* CONTENT */}

      <main className="px-5 -mt-12 flex flex-col gap-6 max-w-5xl mx-auto">

        {/* TOP */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* CARD */}

          <div className="md:col-span-2 bg-white p-5 rounded-2xl shadow-md border border-slate-200 flex items-center justify-between">

            <div>

              <p className="text-sm font-medium text-slate-500 uppercase">

                Total Pegawai Aktif

              </p>

              <p className="text-3xl font-extrabold text-blue-900 mt-1">

                {totalPegawai}

                <span className="text-base font-normal text-slate-400">

                  {' '}Orang

                </span>

              </p>

            </div>

            <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">

              <User size={28} />

            </div>

          </div>

          {/* FILTER */}

          <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-200">

            <div className="flex items-center justify-between mb-3">

              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">

                <CalendarDays
                  size={16}
                  className="text-blue-600"
                />

                Periode Grafik

              </label>

              {(selectedYear !== 'all' ||
                selectedMonth !== 'all') && (

                <button
                  onClick={() => {
                    setSelectedYear('all')
                    setSelectedMonth('all')
                  }}
                  className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-100 flex items-center gap-1"
                >

                  <FilterX size={12} />

                  Reset

                </button>
              )}

            </div>

            <div className="flex gap-2">

              {/* TAHUN */}

              <select
                value={selectedYear}
                onChange={(e) => {

                  setSelectedYear(
                    e.target.value
                  )

                  if (
                    e.target.value === 'all'
                  ) {
                    setSelectedMonth('all')
                  }
                }}
                className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-blue-900"
              >

                <option value="all">
                  Semua Tahun
                </option>

                <option value="2024">
                  2024
                </option>

                <option value="2025">
                  2025
                </option>

                <option value="2026">
                  2026
                </option>

                <option value="2027">
                  2027
                </option>

              </select>

              {/* BULAN */}

              <select
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(
                    e.target.value
                  )
                }
                disabled={
                  selectedYear === 'all'
                }
                className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-blue-900"
              >

                <option value="all">
                  Semua Bulan
                </option>

                {monthNames.map(
                  (month, index) => (

                    <option
                      key={index}
                      value={index}
                    >

                      {month}

                    </option>
                  )
                )}

              </select>

            </div>

          </div>

        </div>

      {/* CHART 1 */}

<div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 overflow-hidden">

  <div className="flex items-center gap-2 mb-6">

    <TrendingUp
      className="text-blue-600"
      size={24}
    />

    <h2 className="text-lg font-bold text-slate-800">

      Tren Kedisiplinan {getChartTitleSuffix()}

    </h2>

  </div>

  <div className="w-full min-w-0 h-[320px]">

    <ResponsiveContainer
      width="100%"
      height={320}
    >

      <LineChart data={chartData}>

        <CartesianGrid
          strokeDasharray="3 3"
        />

        <XAxis dataKey="name" />

        <YAxis />

        <Tooltip
          labelFormatter={
            formatTooltipLabel
          }
        />

        <Legend />

        <Line
          type="monotone"
          dataKey="TepatWaktu"
          stroke="#3b82f6"
          strokeWidth={3}
          name="Tepat Waktu"
        />

        <Line
          type="monotone"
          dataKey="Terlambat"
          stroke="#f59e0b"
          strokeWidth={3}
          name="Terlambat"
        />

        <Line
          type="monotone"
          dataKey="LuarRadius"
          stroke="#ef4444"
          strokeWidth={3}
          name="Luar Radius"
        />

      </LineChart>

    </ResponsiveContainer>

  </div>

</div>

{/* CHART 2 */}

<div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 overflow-hidden">

  <div className="flex items-center gap-2 mb-6">

    <BookOpenCheck
      className="text-emerald-500"
      size={24}
    />

    <h2 className="text-lg font-bold text-slate-800">

      Kinerja Logbook {getChartTitleSuffix()}

    </h2>

  </div>

  <div className="w-full min-w-0 h-[320px]">

    <ResponsiveContainer
      width="100%"
      height={320}
    >

      <LineChart data={chartData}>

        <CartesianGrid
          strokeDasharray="3 3"
        />

        <XAxis dataKey="name" />

        <YAxis />

        <Tooltip
          labelFormatter={
            formatTooltipLabel
          }
        />

        <Legend />

        <Line
          type="monotone"
          dataKey="TotalLogbook"
          stroke="#10b981"
          strokeWidth={3}
          name="Total Logbook"
        />

      </LineChart>

    </ResponsiveContainer>

  </div>

</div>

        {/* FOOTER */}

        <div className="text-center pb-6 mt-4">

          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">

            <AlertTriangle size={12} />

            Aplikasi Smart PPNPN Lhokseumawe

          </p>

        </div>

      </main>

    </div>
  )
}