'use client';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '@/lib/supabaseClient';

import toast, { Toaster } from 'react-hot-toast';

import {
  Plus,
  Save,
  X,
  Pencil,
} from 'lucide-react';

// =========================
// TYPE
// =========================

type UserItem = {
  id: string;
  full_name: string;
};

type SurveyItem = {
  id: number;
  iduser: string;
  periode_bulan: string;
  nilai_akhir: number;
  profile?: {
    full_name: string;
  };
};

export default function SurveiPage() {
  const currentYear = new Date().getFullYear();

  // =========================
  // STATE
  // =========================
  const [filterNama, setFilterNama] =
    useState('');

  const [filterTahun, setFilterTahun] =
    useState(String(currentYear));
  const [users, setUsers] = useState<UserItem[]>([]);
  const [dataSurvei, setDataSurvei] = useState<
    SurveyItem[]
  >([]);

  const [loading, setLoading] =
    useState(false);

  const [showModal, setShowModal] =
    useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [filterPeriode, setFilterPeriode] =
    useState('');

  const [formData, setFormData] = useState({
    iduser: '',
    periode_bulan: '',
    nilai_akhir: '',
  });

  // =========================
  // PERIODE
  // =========================

  const periodeOptions = [
    `Juni ${currentYear - 1}`,
    `Desember ${currentYear - 1}`,
    `Juni ${currentYear}`,
    `Desember ${currentYear}`,
  ];

  // =========================
  // INIT
  // =========================

  useEffect(() => {
    getUsers();
    getSurvei();
  }, []);

  // =========================
  // GET USERS
  // =========================

  const getUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'pegawai')
        .order('full_name');

      if (error) throw error;

      setUsers(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // =========================
  // GET SURVEI
  // =========================

  const getSurvei = async () => {
    try {
      const { data, error } = await supabase
        .from('nilaisurvei')
        .select(`
          id,
          iduser,
          periode_bulan,
          nilai_akhir
        `)
        .order('periode_bulan', {
          ascending: false,
        });

      if (error) throw error;

      setDataSurvei(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // =========================
  // SUBMIT
  // =========================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !formData.iduser ||
      !formData.periode_bulan ||
      !formData.nilai_akhir
    ) {
      return toast.error(
        'Lengkapi form'
      );
    }

    try {
      setLoading(true);

      // VALIDASI DUPLIKAT
      if (!editingId) {
        const { data: existing } =
          await supabase
            .from('nilaisurvei')
            .select('iduser')
            .eq(
              'iduser',
              formData.iduser
            )
            .eq(
              'periode_bulan',
              formData.periode_bulan
            )
            .maybeSingle();

        if (existing) {
          toast.error(
            'Data survei sudah ada'
          );

          setLoading(false);
          return;
        }
      }

      // =====================
      // UPDATE
      // =====================

      if (editingId) {
        const { error } = await supabase
          .from('nilaisurvei')
          .update({
            iduser: formData.iduser,
            periode_bulan:
              formData.periode_bulan,
            nilai_akhir: Number(
              formData.nilai_akhir
            ),
          })
          .eq('id', editingId);

        if (error) throw error;

        toast.success(
          'Data berhasil diupdate'
        );
      }

      // =====================
      // INSERT
      // =====================

      else {
        const { error } = await supabase
          .from('nilaisurvei')
          .insert([
            {
              iduser: formData.iduser,
              periode_bulan:
                formData.periode_bulan,
              nilai_akhir: Number(
                formData.nilai_akhir
              ),
            },
          ]);

        if (error) throw error;

        toast.success(
          'Data berhasil disimpan'
        );
      }

      // RESET

      setFormData({
        iduser: '',
        periode_bulan: '',
        nilai_akhir: '',
      });

      setEditingId(null);
      setShowModal(false);

      getSurvei();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // EDIT
  // =========================

  const handleEdit = (
    item: SurveyItem
  ) => {
    setEditingId(item.id);

    setFormData({
      iduser: item.iduser,
      periode_bulan:
        item.periode_bulan,
      nilai_akhir:
        item.nilai_akhir.toString(),
    });

    setShowModal(true);
  };

  // =========================
  // FILTER
  // =========================

  const filteredData = useMemo(() => {

    return dataSurvei.filter(
      (item) => {

        const namaPegawai =
          users.find(
            (u) =>
              u.id === item.iduser
          )?.full_name || '';

        const matchNama =
          namaPegawai
            .toLowerCase()
            .includes(
              filterNama.toLowerCase()
            );

        const matchPeriode =
          !filterPeriode ||
          item.periode_bulan ===
          filterPeriode;

        const matchTahun =
          !filterTahun ||
          item.periode_bulan.includes(
            filterTahun
          );

        return (
          matchNama &&
          matchPeriode &&
          matchTahun
        );
      }
    );

  }, [
    dataSurvei,
    users,
    filterNama,
    filterPeriode,
    filterTahun,
  ]);
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Toaster position="top-right" />

      <div className="max-w-5xl mx-auto">

        {/* ===================== */}
        {/* HEADER */}
        {/* ===================== */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">

          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Survei Kepuasan PPNPN
            </h1>
          </div>

          <button
            onClick={() => {
              setEditingId(null);

              setFormData({
                iduser: '',
                periode_bulan: '',
                nilai_akhir: '',
              });

              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <Plus size={18} />
            Tambah Survei
          </button>
        </div>

        {/* ===================== */}
        {/* FILTER */}
        {/* ===================== */}

        <div className="bg-white rounded-2xl shadow p-4 mb-5">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {/* Nama */}

            <input
              type="text"
              placeholder="Cari nama pegawai..."
              value={filterNama}
              onChange={(e) =>
                setFilterNama(
                  e.target.value
                )
              }
              className="border rounded-xl p-3"
            />

            {/* Tahun */}

            <select
              value={filterTahun}
              onChange={(e) =>
                setFilterTahun(
                  e.target.value
                )
              }
              className="border rounded-xl p-3"
            >
              <option value="">
                Semua Tahun
              </option>

              <option
                value={String(
                  currentYear - 1
                )}
              >
                {currentYear - 1}
              </option>

              <option
                value={String(
                  currentYear
                )}
              >
                {currentYear}
              </option>

              <option
                value={String(
                  currentYear + 1
                )}
              >
                {currentYear + 1}
              </option>
            </select>

            {/* Periode */}

            <select
              value={filterPeriode}
              onChange={(e) =>
                setFilterPeriode(
                  e.target.value
                )
              }
              className="border rounded-xl p-3"
            >
              <option value="">
                Semua Periode
              </option>

              {periodeOptions.map(
                (periode) => (
                  <option
                    key={periode}
                    value={periode}
                  >
                    {periode}
                  </option>
                )
              )}
            </select>

          </div>

        </div>

        {/* ===================== */}
        {/* TABLE */}
        {/* ===================== */}

        <div className="bg-white rounded-2xl shadow overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">
                    Nama
                  </th>

                  <th className="px-4 py-3 text-left text-sm">
                    Periode
                  </th>

                  <th className="px-4 py-3 text-left text-sm">
                    Nilai
                  </th>

                  <th className="px-4 py-3 text-left text-sm w-[80px]">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>

                {filteredData.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-5 text-center text-gray-500"
                    >
                      Tidak ada data
                    </td>
                  </tr>
                ) : (
                  filteredData.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm">
                          {
                            users.find(
                              (user) => user.id === item.iduser
                            )?.full_name || '-'
                          }
                        </td>

                        <td className="px-4 py-3 text-sm">
                          {
                            item.periode_bulan
                          }
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold">
                          {
                            item.nilai_akhir
                          }
                        </td>

                        <td className="px-4 py-3">

                          <button
                            onClick={() =>
                              handleEdit(
                                item
                              )
                            }
                            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 p-2 rounded-lg"
                          >
                            <Pencil
                              size={16}
                            />
                          </button>

                        </td>
                      </tr>
                    )
                  )
                )}

              </tbody>
            </table>
          </div>
        </div>

        {/* ===================== */}
        {/* MODAL */}
        {/* ===================== */}

        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

              {/* HEADER */}

              <div className="flex items-center justify-between mb-5">

                <h2 className="text-lg font-bold">
                  {editingId
                    ? 'Edit Survei'
                    : 'Tambah Survei'}
                </h2>

                <button
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* FORM */}

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >

                {/* PEGAWAI */}

                <div>
                  <label className="block mb-2 text-sm font-semibold">
                    Pegawai
                  </label>

                  <select
                    value={formData.iduser}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        iduser:
                          e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3"
                  >
                    <option value="">
                      Pilih Pegawai
                    </option>

                    {users.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* PERIODE */}

                <div>
                  <label className="block mb-2 text-sm font-semibold">
                    Periode
                  </label>

                  <select
                    value={
                      formData.periode_bulan
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        periode_bulan:
                          e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3"
                  >
                    <option value="">
                      Pilih Periode
                    </option>

                    {periodeOptions.map(
                      (periode) => (
                        <option
                          key={periode}
                          value={periode}
                        >
                          {periode}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* NILAI */}

                <div>
                  <label className="block mb-2 text-sm font-semibold">
                    Nilai
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    placeholder="Contoh 9.5"
                    value={
                      formData.nilai_akhir
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nilai_akhir:
                          e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3"
                  />
                </div>

                {/* BUTTON */}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
                >
                  <Save size={18} />

                  {loading
                    ? 'Menyimpan...'
                    : editingId
                      ? 'Update Data'
                      : 'Simpan Data'}
                </button>

              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}