"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from '@/components/ui/button'
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export default function RekapLembur() {

const now = new Date()
const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
const [selectedYear, setSelectedYear] = useState(now.getFullYear())
const month = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}`

const monthOptions = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
]

const yearOptions = Array.from(
  { length: 5 },
  (_, i) => now.getFullYear() - 2 + i
)

  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>("ALL")

  const [lembur, setLembur] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [holidays, setHolidays] = useState<string[]>([])

  const daysInMonth = useMemo(() => {
    const [year, monthNum] = month.split("-").map(Number)
    return new Date(year, monthNum, 0).getDate()
  }, [month])

  const [yearNum, monthNum] = month.split("-").map(Number)

  // --------------------------------
  // LOAD PEGAWAI
  // --------------------------------
  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, position")
        .neq("role","admin")
        .neq("is_admin", true)
        .order("position")

      setUsers(data || [])
    }

    loadUsers()
  }, [])

  // --------------------------------
  // LOAD HARI LIBUR NASIONAL
  // --------------------------------
  useEffect(() => {

    const loadHolidays = async () => {

      const firstDay = `${month}-01`
      const lastDay = `${month}-${daysInMonth}`

      const { data } = await supabase
        .from("public_holidays")
        .select("date")
        .gte("date", firstDay)
        .lte("date", lastDay)

      setHolidays((data || []).map((d:any)=>d.date))
    }

    loadHolidays()

  }, [month, daysInMonth])

  const toLocalDateString = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const isHolidayOrWeekend = (y:number,m:number,d:number) => {
  const date = new Date(y, m - 1, d)
  const weekend = date.getDay() === 0 || date.getDay() === 6
  const localDate = toLocalDateString(date)
  const holiday = holidays.includes(localDate)
  return weekend || holiday
}


  // --------------------------------
  // LOAD LEMBUR
  // --------------------------------
  useEffect(() => {
    const loadLembur = async () => {

      setLoading(true)

      const firstDay = `${month}-01`
      const lastDay = `${month}-${daysInMonth}`

      let query = supabase
        .from("lembur")
        .select("user_id, attendance_date, check_in, check_out, status")
        .gte("attendance_date", firstDay)
        .lte("attendance_date", lastDay)

      if (selectedUser !== "ALL") query = query.eq("user_id", selectedUser)

      const { data } = await query

      setLembur(data || [])
      setLoading(false)
    }

    loadLembur()
  }, [month, selectedUser, daysInMonth])

  // --------------------------------
  // HITUNG DURASI (jam:menit)
  // --------------------------------
  const calcDuration = (cin: string, cout: string) => {
    if (!cin || !cout) return ""
    const a = new Date(cin)
    const b = new Date(cout)
    const diffMs = b.getTime() - a.getTime()
    const m = Math.floor(diffMs / 60000)
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${String(h)}`
  }

  const capDuration = (
    duration: any,
    year: number,
    month: number,
    day: number
  ) => {
    if (!duration) return ""

    const isRed = isHolidayOrWeekend(year, month, day)
    const maxHour = isRed ? 4 : 2

    return Math.min(Number(duration), maxHour)
  }
  const fmtTime = (t: string) => {
    const d = new Date(t)
    return d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
  }

  const fmtDate = (t: string) => {
    const d = new Date(t)
    return d.toLocaleDateString("id-ID")
  }

  // --------------------------------
  // GROUP PER PEGAWAI
  // --------------------------------
  const grouped = useMemo(() => {

    const map: any = {}

    lembur.forEach(r => {

      if (!map[r.user_id]) {
        const u = users.find(u=>u.id===r.user_id)

        map[r.user_id] = {
          user_id: r.user_id,
          nama: u?.full_name ?? "-",
          jabatan: u?.position ?? "-",
          hari: {},
          total: 0
        }
      }

      const day = new Date(r.attendance_date).getDate()

      map[r.user_id].hari[day] = {
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.status,
        duration: calcDuration(r.check_in, r.check_out)
      }

      if (r.check_in && r.check_out) map[r.user_id].total++
    })

    return Object.values(map)
  }, [lembur, users])

  // --------------------------------
  // EXPORT EXCEL & PDF 
  // --------------------------------
 const exportExcel = () => {
  const data: any[] = []

  grouped.forEach((row: any) => {
    const obj: any = {
      Nama: row.nama,
      Jabatan: row.jabatan,
      Total: row.total
    }

    for (let i = 1; i <= daysInMonth; i++) {
      obj[`${i}`] = capDuration(
        row.hari[i]?.duration,
        yearNum,
        monthNum,
        i
      )
    }

    data.push(obj)
  })

  // 👉 paksa urutan kolom
  const headers = [
    "Nama",
    "Jabatan",
    "Total",
    ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))
  ]

  const ws = XLSX.utils.json_to_sheet(data, {
    header: headers,
    skipHeader: false
  })

  /* ===============================
     WARNA LIBUR / WEEKEND
     =============================== */
  const range = XLSX.utils.decode_range(ws["!ref"] as string)

  for (let C = 0; C <= range.e.c; C++) {
    const headerCell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
    if (!headerCell) continue

    const day = Number(headerCell.v)
    if (isNaN(day)) continue

    if (!isHolidayOrWeekend(yearNum, monthNum, day)) continue

    for (let R = 0; R <= range.e.r; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[addr]) continue

      ws[addr].s = {
        fill: { fgColor: { rgb: "FEE2E2" } },
        font: {
          color: { rgb: "991B1B" },
          bold: R === 0
        },
        alignment: {
          horizontal: "center",
          vertical: "center"
        }
      }
    }
  }

  ws["!cols"] = [
    { wch: 25 },
    { wch: 20 },
    { wch: 10 },
    ...Array.from({ length: daysInMonth }, () => ({ wch: 5 }))
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Lembur")
  XLSX.writeFile(wb, `rekap_lembur_${month}.xlsx`)
}



const exportPDF = () => {
  const doc = new jsPDF("l", "pt", "a4")

  doc.text(`Rekap Lembur Bulan ${month}`, 40, 40)

  const head = [
    ["No", "Nama", "Jabatan", "Total",
      ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))
    ]
  ]

  const body: any[] = []

  grouped.forEach((row: any, idx: number) => {
    const r: any[] = [idx + 1, row.nama, row.jabatan, row.total]

    for (let i = 1; i <= daysInMonth; i++) {
      r.push(
        capDuration(
          row.hari[i]?.duration,
          yearNum,
          monthNum,
          i
        )
      )
    }

    body.push(r)
  })

  autoTable(doc, {
    head,
    body,
    startY: 60,
    styles: { fontSize: 8 }
  })

  doc.save(`rekap_lembur_${month}.pdf`)
}


  return (
    <div className="p-6">

      <div className="flex justify-between mb-4">

        <div className="space-x-2">
          <button onClick={exportExcel} className="px-4 py-2 rounded bg-green-500 text-white">
            Export Excel
          </button>

          <button onClick={exportPDF} className="px-4 py-2 rounded bg-red-500 text-white">
            Export PDF
          </button>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Rekap Lembur Bulan Berjalan</h2>

      {/* FILTER */}
      <div className="flex gap-4 mb-4 items-end">

        <div className="flex gap-2 items-center">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="border rounded p-2"
          >
            {monthOptions.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="border rounded p-2"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>


        <div>
          <label className="text-sm">Pegawai</label>
          <select
            value={selectedUser}
            onChange={e=>setSelectedUser(e.target.value)}
            className="border rounded p-2 ml-2"
          >
            <option value="ALL">Semua Pegawai</option>
            {users.map(u=>(
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-auto border rounded">

        <table className="w-full text-sm border-collapse">

          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">No</th>
              <th className="border p-2">Nama</th>
              <th className="border p-2">Jabatan</th>
              <th className="border p-2">Total</th>

              {Array.from({length:daysInMonth},(_,i)=>(
                <th
                  key={i}
                  className={`border p-1 text-center w-8
                    ${isHolidayOrWeekend(yearNum,monthNum,i+1) ? "bg-red-200 text-red-700" : ""}`}
                >
                  {i+1}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>

            {loading && (
              <tr>
                <td colSpan={5+daysInMonth} className="text-center p-4">
                  Memuat data...
                </td>
              </tr>
            )}

            {!loading && grouped.map((row:any, idx:number)=>(
              <tr key={row.user_id}>
                <td className="border p-2 text-center">{idx+1}</td>
                <td className="border p-2">{row.nama}</td>
                <td className="border p-2">{row.jabatan}</td>
                <td className="border p-2 text-center font-bold">{row.total}</td>
                

                {Array.from({length:daysInMonth},(_,i)=>{

                  const data = row.hari[i+1]
                  const isRed = isHolidayOrWeekend(yearNum,monthNum,i+1)
//logic hari libur=> lembur maksimal 4 jam, hari biasa maksimal 2 jam
                  const maxHour = isRed ? 4 : 2
                  return (
                    <td
                      key={i}
                      className={`border text-center cursor-pointer
                        ${isRed ? "bg-red-100 text-red-700 font-semibold" : ""}`}
                      title={
                        data
                          ? `Tanggal: ${fmtDate(data.check_in)}\n` +
                            `In: ${fmtTime(data.check_in)}\n` +
                            `Out: ${fmtTime(data.check_out)}\n` +                            
                            `Kegiatan: ${data.status}\n` +
                            `Jumlah Jam Lembur: ${data.duration}`
                            
                          : ""
                      }
                    >
                      {(data?.duration ? Math.min(Number(data.duration), maxHour) : "") || ""}
                    </td>
                  )
                })}
              </tr>
            ))}

          </tbody>

        </table>
      </div>
    </div>
  )
}
