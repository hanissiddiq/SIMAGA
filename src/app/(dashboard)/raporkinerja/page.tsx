'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Eye,
  Search,
  Trophy,
  FileText,
} from 'lucide-react';

type RaporKinerja = {
  user_id: string;
  full_name: string;
  period_year: number;
  period_semester: number;
  discipline_score: number;
  behavior_score: number;
  survey_score: number;
  ki_score: number;
  final_score: number;
  predikat: string;
};

export default function RaporKinerjaPage() {
  const [data, setData] = useState<RaporKinerja[]>([]);
  const [loading, setLoading] = useState(true);

  const [tahun, setTahun] = useState(
    new Date().getFullYear()
  );

  const [semester, setSemester] = useState(1);

  const [search, setSearch] = useState('');

  const [selected, setSelected] =
    useState<RaporKinerja | null>(null);

  const [page, setPage] = useState(1);

  const pageSize = 10;

  async function loadData() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('v_rapor')
        .select('*')
        .eq('period_year', tahun)
        .eq('period_semester', semester)
        .order('final_score', {
          ascending: false,
        });

      if (error) throw error;

      setData(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [tahun, semester]);

  const filtered = useMemo(() => {
    return data.filter((x) =>
      x.full_name
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [data, search]);

  const totalPages = Math.ceil(
    filtered.length / pageSize
  );

  const pagedData = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const avgScore = useMemo(() => {
    if (!filtered.length) return 0;

    const total = filtered.reduce(
      (a, b) => a + Number(b.final_score),
      0
    );

    return (total / filtered.length).toFixed(2);
  }, [filtered]);

  const sangatBaik = filtered.filter(
    (x) => x.predikat === 'Sangat Baik'
  ).length;

  const baik = filtered.filter(
    (x) => x.predikat === 'Baik'
  ).length;

  return (
    <div className="p-6 space-y-6">

      <div>
        <h1 className="text-2xl font-bold">
          Rapor Kinerja PPNPN
        </h1>
        <p className="text-sm text-gray-500">
          Rekapitulasi Nilai Semester
        </p>
      </div>

      {/* FILTER */}

      <div className="bg-white rounded-xl border p-4">
        <div className="grid md:grid-cols-4 gap-3">

          <div>
            <label className="text-sm">
              Tahun
            </label>

            <select
              value={tahun}
              onChange={(e) =>
                setTahun(Number(e.target.value))
              }
              className="w-full border rounded-lg p-2"
            >
              {[2025, 2026, 2027].map((x) => (
                <option key={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">
              Semester
            </label>

            <select
              value={semester}
              onChange={(e) =>
                setSemester(
                  Number(e.target.value)
                )
              }
              className="w-full border rounded-lg p-2"
            >
              <option value={1}>
                Semester 1
              </option>

              <option value={2}>
                Semester 2
              </option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm">
              Cari Pegawai
            </label>

            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Nama Pegawai"
                className="w-full border rounded-lg pl-10 p-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid md:grid-cols-4 gap-4">

        <div className="bg-white border rounded-xl p-4">
          <div className="text-gray-500 text-sm">
            Total Pegawai
          </div>

          <div className="text-3xl font-bold">
            {filtered.length}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-gray-500 text-sm">
            Rata-rata Nilai
          </div>

          <div className="text-3xl font-bold">
            {avgScore}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-gray-500 text-sm">
            Sangat Baik
          </div>

          <div className="text-3xl font-bold">
            {sangatBaik}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-gray-500 text-sm">
            Baik
          </div>

          <div className="text-3xl font-bold">
            {baik}
          </div>
        </div>
      </div>

      {/* TABLE */}

      <div className="bg-white border rounded-xl overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-gray-100">

            <tr>
              <th className="p-3 text-left">
                Rank
              </th>

              <th className="p-3 text-left">
                Nama
              </th>

              <th className="p-3">
                Kehadiran
              </th>

              <th className="p-3">
                Perilaku
              </th>

              <th className="p-3">
                Survei
              </th>

              <th className="p-3">
                KI
              </th>

              <th className="p-3">
                Nilai Akhir
              </th>

              <th className="p-3">
                Predikat
              </th>

              <th className="p-3">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody>

            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center p-8"
                >
                  Loading...
                </td>
              </tr>
            )}

            {!loading &&
              pagedData.map(
                (row, index) => (
                  <tr
                    key={row.user_id}
                    className="border-t"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">

                        <Trophy size={16} />

                        {(page - 1) *
                          pageSize +
                          index +
                          1}
                      </div>
                    </td>

                    <td className="p-3">
                      {row.full_name}
                    </td>

                    <td className="text-center">
                      {row.discipline_score}
                    </td>

                    <td className="text-center">
                      {row.behavior_score}
                    </td>

                    <td className="text-center">
                      {row.survey_score}
                    </td>

                    <td className="text-center">
                      {row.ki_score}
                    </td>

                    <td className="text-center font-bold">
                      {row.final_score}
                    </td>

                    <td className="text-center">
                      {row.predikat}
                    </td>

                    <td className="text-center">
                      <button
                        onClick={() =>
                          setSelected(row)
                        }
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                )
              )}
          </tbody>
        </table>

      </div>

      {/* PAGINATION */}

      <div className="flex justify-center gap-2">

        <button
          disabled={page === 1}
          onClick={() =>
            setPage(page - 1)
          }
          className="px-3 py-2 border rounded"
        >
          Prev
        </button>

        <span className="px-4 py-2">
          {page} / {totalPages || 1}
        </span>

        <button
          disabled={page === totalPages}
          onClick={() =>
            setPage(page + 1)
          }
          className="px-3 py-2 border rounded"
        >
          Next
        </button>
      </div>

      {/* MODAL */}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white rounded-xl w-full max-w-xl p-6">

            <div className="flex justify-between">

              <h2 className="font-bold text-xl">
                Detail Rapor
              </h2>

              <button
                onClick={() =>
                  setSelected(null)
                }
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">

              <p>
                <b>Nama:</b>{' '}
                {selected.full_name}
              </p>

              <p>
                <b>Kehadiran:</b>{' '}
                {selected.discipline_score}
              </p>

              <p>
                <b>Perilaku:</b>{' '}
                {selected.behavior_score}
              </p>

              <p>
                <b>Survei:</b>{' '}
                {selected.survey_score}
              </p>

              <p>
                <b>KI:</b>{' '}
                {selected.ki_score}
              </p>

              <p>
                <b>Nilai Akhir:</b>{' '}
                {selected.final_score}
              </p>

              <p>
                <b>Predikat:</b>{' '}
                {selected.predikat}
              </p>

            </div>

           <button onClick={() =>
                window.open(
                  `/rapor/${selected.user_id}?tahun=${selected.period_year}&semester=${selected.period_semester}`,
                  '_blank'
                )
              }
              className="mt-6 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
            <FileText size={18} />
              Cetak
            </button>

          </div>

        </div>
      )}
    </div>
  );
}