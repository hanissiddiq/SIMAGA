'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

export default function PenilaianPimpinanPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const semester = today.getMonth() + 1 < 7 ? 1 : 2;
  const year = today.getFullYear();

  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedSemester, setSelectedSemester] = useState('');
  const [form, setForm] = useState({
    integritas: 3,
    profesionalisme: 3,
    sinergi: 3,
    pelayanan: 3,
    komitmen_kerja: 3,
    catatan: ''
  });

  useEffect(() => {
    loadEmployees();
    loadSummary();
  }, []);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, position, role')
      .eq('role', 'pegawai')
      .order('full_name');

    if (error) return toast.error(error.message);
    setEmployees(data || []);
  }

  async function loadSummary() {
    const { data, error } = await supabase
      .from('v_assessment_summary')
      .select('*')
      .order('period_year', { ascending: false });

    if (error) return toast.error(error.message);
    setSummaryData(data || []);
  }

  function updateField(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session tidak ditemukan');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (
        profile?.role !== 'kasubbag' &&
        profile?.role !== 'kepala_kantor'
      ) {
        throw new Error('Anda tidak memiliki hak akses');
      }

      const { data: existing } = await supabase
        .from('supervisor_assessments')
        .select('id')
        .eq('assessor_id', user.id)
        .eq('assessed_id', selectedEmployee)
        .eq('period_semester', semester)
        .eq('period_year', year)
        .maybeSingle();

      if (existing) {
        throw new Error('Pegawai ini sudah dinilai pada periode aktif.');
      }

      const { error } = await supabase
        .from('supervisor_assessments')
        .insert({
          assessor_id: user.id,
          assessed_id: selectedEmployee,
          assessor_role: profile.role,
          period_semester: semester,
          period_year: year,
          integritas: form.integritas,
          profesionalisme: form.profesionalisme,
          sinergi: form.sinergi,
          pelayanan: form.pelayanan,
          komitmen_kerja: form.komitmen_kerja,
          catatan: form.catatan
        });

      if (error) throw error;

      toast.success('Penilaian berhasil disimpan');

      setSelectedEmployee('');
      setForm({
        integritas: 3,
        profesionalisme: 3,
        sinergi: 3,
        pelayanan: 3,
        komitmen_kerja: 3,
        catatan: ''
      });

      setShowModal(false);
      loadSummary();

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  // const filteredData = summaryData.filter((item) =>
  //   item.full_name?.toLowerCase().includes(search.toLowerCase())
  // );

      const years = [
      ...new Set(
        summaryData.map((x) => x.period_year)
      )
    ].sort((a, b) => b - a);

    const filteredData = summaryData.filter((item) => {
      const matchName =
        item.full_name
          ?.toLowerCase()
          .includes(search.toLowerCase());

      const matchYear =
        !selectedYear ||
        String(item.period_year) === selectedYear;

      const matchSemester =
        !selectedSemester ||
        String(item.period_semester) === selectedSemester;

      return (
        matchName &&
        matchYear &&
        matchSemester
      );
    });

  const questions = [
    { key: 'integritas', title: 'Integritas', desc: 'Jujur, bertanggung jawab, dan dapat dipercaya' },
    { key: 'profesionalisme', title: 'Profesionalisme', desc: 'Bekerja sesuai tugas dan aturan' },
    { key: 'sinergi', title: 'Sinergi', desc: 'Mudah bekerja sama dengan tim' },
    { key: 'pelayanan', title: 'Pelayanan', desc: 'Ramah dan membantu pengguna layanan' },
    { key: 'komitmen_kerja', title: 'Komitmen Kerja', desc: 'Peduli terhadap kualitas pekerjaan' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Penilaian Pimpinan</h1>
          <p className="text-gray-500">Periode Aktif : Semester {semester} {year}</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          + Tambah Penilaian
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-4">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Cari pegawai..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          className="border rounded-lg p-2"
        />

        <select
          value={selectedYear}
          onChange={(e) =>
            setSelectedYear(e.target.value)
          }
          className="border rounded-lg p-2"
        >
          <option value="">
            Semua Tahun
          </option>

          {years.map((year) => (
            <option
              key={year}
              value={year}
            >
              {year}
            </option>
          ))}
        </select>

        <select
          value={selectedSemester}
          onChange={(e) =>
            setSelectedSemester(
              e.target.value
            )
          }
          className="border rounded-lg p-2"
        >
          <option value="">
            Semua Semester
          </option>

          <option value="1">
            Semester 1
          </option>

          <option value="2">
            Semester 2
          </option>
        </select>

      </div>

    </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 text-left">Pegawai</th>
                <th className="p-3 text-center">Tahun</th>
                <th className="p-3 text-center">Semester</th>
                <th className="p-3 text-center">Nilai Peer</th>
                <th className="p-3 text-center">Nilai Pimpinan</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-3">{row.full_name}</td>
                  <td className="p-3 text-center">{row.period_year}</td>
                  <td className="p-3 text-center">{row.period_semester}</td>
                  <td className="p-3 text-center">{row.peer_score}</td>
                  <td className="p-3 text-center">{row.supervisor_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                Input Penilaian Semester {semester} {year}
              </h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="mb-6">
              <label className="block mb-2 font-medium">Pegawai PPNPN</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="border rounded p-2 w-full"
              >
                <option value="">Pilih Pegawai</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} - {emp.position}
                  </option>
                ))}
              </select>
            </div>

            {questions.map((item) => (
              <div key={item.key} className="mb-5">
                <label className="font-semibold block">{item.title}</label>
                <p className="text-sm text-gray-500 mb-2">{item.desc}</p>

                <select
                  className="border rounded p-2 w-full"
                  value={(form as any)[item.key]}
                  onChange={(e) => updateField(item.key, Number(e.target.value))}
                >
                  <option value={1}>1 - Kurang</option>
                  <option value={2}>2 - Cukup</option>
                  <option value={3}>3 - Baik</option>
                  <option value={4}>4 - Sangat Baik</option>
                </select>
              </div>
            ))}

            <div className="mb-4">
              <label className="block mb-2 font-medium">Catatan</label>
              <textarea
                rows={4}
                value={form.catatan}
                onChange={(e) => updateField('catatan', e.target.value)}
                className="border rounded p-2 w-full"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !selectedEmployee}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              {loading ? 'Menyimpan...' : 'Simpan Penilaian'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
