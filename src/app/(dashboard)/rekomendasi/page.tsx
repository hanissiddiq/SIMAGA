'use client';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '@/lib/supabaseClient';

import toast, {
  Toaster,
} from 'react-hot-toast';

import {
  Plus,
  Pencil,
  Save,
  X,
  Search,
} from 'lucide-react';

type UserItem = {
  id: string;
  full_name: string;
};

type TemuanItem = {
  id: number;
  iduser: string;
  full_name: string;
  periode_bulan: string;
  tanggal_sidak: string;
  jenis_temuan: string;
  tingkat_temuan: string;
  catatan: string;
  created_at: string;
};

export default function RekomendasiPage() {
  const currentYear =
    new Date().getFullYear();

  const currentMonth =
    new Date().getMonth() + 1;

  const defaultPeriode =
    currentMonth <= 6
      ? `Juni ${currentYear}`
      : `Desember ${currentYear}`;

  const [users, setUsers] =
    useState<UserItem[]>([]);

  const [dataTemuan, setDataTemuan] =
    useState<TemuanItem[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [showModal, setShowModal] =
    useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [filterNama, setFilterNama] =
    useState('');

  const [
    filterPeriode,
    setFilterPeriode,
  ] = useState('');

  const [
    filterTahun,
    setFilterTahun,
  ] = useState(
    String(currentYear)
  );

  const [currentPage, setCurrentPage] =
    useState(1);

  const itemsPerPage = 10;

  const [formData, setFormData] =
    useState({
      iduser: '',
      periode_bulan:
        defaultPeriode,
      tanggal_sidak:
        new Date()
          .toISOString()
          .split('T')[0],
      jenis_temuan: '',
      tingkat_temuan: '',
      catatan: '',
    });

  const periodeOptions = [
    `Juni ${currentYear - 1}`,
    `Desember ${currentYear - 1}`,
    `Juni ${currentYear}`,
    `Desember ${currentYear}`,
  ];

  const jenisTemuanOptions = [
    'Tidak Ada Temuan',

    'Alpha pada Jam Kerja',

    'Terlambat Masuk Kerja',

    'Pulang Sebelum Waktunya',

    'Tidak Mengisi Presensi',

    'Tidak Menggunakan Seragam Dinas',

    'Tidak Menggunakan ID Card',

    'Kebersihan Ruangan Kurang Baik',

    'Meja Kerja Tidak Rapi',

    'Dokumen Tidak Tertata',

    'Tidak Mengikuti Apel/Pengarahan',

    'Pelanggaran Lainnya',
  ];

  const tingkatTemuanOptions =
    [
      'Tidak Ada Temuan',
      'Ringan',
      'Sedang',
      'Berat',
    ];

  useEffect(() => {
    getUsers();
    getTemuan();
  }, []);

  async function getUsers() {
    try {
      const { data, error } =
        await supabase
          .from('profiles')
          .select(
            'id, full_name'
          )
          .eq(
            'role',
            'pegawai'
          )
          .order(
            'full_name'
          );

      if (error)
        throw error;

      setUsers(data || []);
    } catch (error: any) {
      toast.error(
        error.message
      );
    }
  }

  async function getTemuan() {
    try {
      const { data, error } =
        await supabase
          .from(
            'v_temuan_ki'
          )
          .select('*')
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );

      if (error)
        throw error;

      setDataTemuan(
        data || []
      );
    } catch (error: any) {
      toast.error(
        error.message
      );
    }
  }

  const resetForm = () => {
    setFormData({
      iduser: '',
      periode_bulan:
        defaultPeriode,
      tanggal_sidak:
        new Date()
          .toISOString()
          .split('T')[0],
      jenis_temuan: '',
      tingkat_temuan: '',
      catatan: '',
    });

    setEditingId(
      null
    );
  };

    const handleEdit = (
    item: TemuanItem
  ) => {
    setEditingId(item.id);

    setFormData({
      iduser: item.iduser,
      periode_bulan:
        item.periode_bulan,
      tanggal_sidak:
        item.tanggal_sidak,
      jenis_temuan:
        item.jenis_temuan,
      tingkat_temuan:
        item.tingkat_temuan,
      catatan:
        item.catatan || '',
    });

    setShowModal(true);
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !formData.iduser ||
      !formData.periode_bulan ||
      !formData.jenis_temuan ||
      !formData.tingkat_temuan
    ) {
      toast.error(
        'Lengkapi data terlebih dahulu'
      );
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        const { error } =
          await supabase
            .from(
              'hasil_sidak_ki'
            )
            .update({
              iduser:
                formData.iduser,
              periode_bulan:
                formData.periode_bulan,
              tanggal_sidak:
                formData.tanggal_sidak,
              jenis_temuan:
                formData.jenis_temuan,
              tingkat_temuan:
                formData.tingkat_temuan,
              catatan:
                formData.catatan,
            })
            .eq(
              'id',
              editingId
            );

        if (error)
          throw error;

        toast.success(
          'Data berhasil diupdate'
        );
      } else {
        const { error } =
          await supabase
            .from(
              'hasil_sidak_ki'
            )
            .insert([
              {
                iduser:
                  formData.iduser,
                periode_bulan:
                  formData.periode_bulan,
                tanggal_sidak:
                  formData.tanggal_sidak,
                jenis_temuan:
                  formData.jenis_temuan,
                tingkat_temuan:
                  formData.tingkat_temuan,
                catatan:
                  formData.catatan,
              },
            ]);

        if (error)
          throw error;

        toast.success(
          'Data berhasil disimpan'
        );
      }

      setShowModal(false);

      resetForm();

      await getTemuan();
    } catch (error: any) {
      toast.error(
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredData =
    useMemo(() => {
      return dataTemuan.filter(
        (item) => {
          const matchNama =
            item.full_name
              ?.toLowerCase()
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
      dataTemuan,
      filterNama,
      filterPeriode,
      filterTahun,
    ]);

  const totalPages =
    Math.ceil(
      filteredData.length /
        itemsPerPage
    ) || 1;

  const paginatedData =
    filteredData.slice(
      (currentPage - 1) *
        itemsPerPage,
      currentPage *
        itemsPerPage
    );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filterNama,
    filterPeriode,
    filterTahun,
  ]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">

          <div>
            <h1 className="text-2xl font-bold">
              Temuan Kepatuhan Internal
            </h1>

            <p className="text-gray-500">
              Monitoring hasil sidak
              kepatuhan internal
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
          >
            <Plus size={18} />
            Tambah Temuan
          </button>

        </div>

        <div className="bg-white rounded-2xl shadow p-4 mb-5">

          <div className="grid md:grid-cols-3 gap-3">

            <div className="relative">

              <Search
                size={18}
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                type="text"
                placeholder="Cari nama pegawai..."
                value={filterNama}
                onChange={(e) =>
                  setFilterNama(
                    e.target.value
                  )
                }
                className="w-full border rounded-xl p-2 pl-10"
              />

            </div>

            <select
              value={filterTahun}
              onChange={(e) =>
                setFilterTahun(
                  e.target.value
                )
              }
              className="border rounded-xl p-2"
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

            </select>

            <select
              value={
                filterPeriode
              }
              onChange={(e) =>
                setFilterPeriode(
                  e.target.value
                )
              }
              className="border rounded-xl p-2"
            >
              <option value="">
                Semua Periode
              </option>

              {periodeOptions.map(
                (
                  periode
                ) => (
                  <option
                    key={
                      periode
                    }
                    value={
                      periode
                    }
                  >
                    {
                      periode
                    }
                  </option>
                )
              )}
            </select>

          </div>
        </div>

                <div className="bg-white rounded-2xl shadow overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-gray-100">

                <tr>

                  <th className="px-4 py-3 text-left text-sm">
                    Nama Pegawai
                  </th>

                  <th className="px-4 py-3 text-left text-sm">
                    Periode
                  </th>

                  <th className="px-4 py-3 text-left text-sm">
                    Tanggal Sidak
                  </th>

                  <th className="px-4 py-3 text-left text-sm">
                    Jenis Temuan
                  </th>

                  <th className="px-4 py-3 text-left text-sm">
                    Tingkat
                  </th>

                  <th className="px-4 py-3 text-center text-sm w-[90px]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {paginatedData.length === 0 ? (

                  <tr>

                    <td
                      colSpan={6}
                      className="p-6 text-center text-gray-500"
                    >
                      Tidak ada data
                    </td>

                  </tr>

                ) : (

                  paginatedData.map(
                    (item) => (

                      <tr
                        key={item.id}
                        className="border-t hover:bg-gray-50"
                      >

                        <td className="px-4 py-3">
                          {item.full_name}
                        </td>

                        <td className="px-4 py-3">
                          {item.periode_bulan}
                        </td>

                        <td className="px-4 py-3">
                          {item.tanggal_sidak}
                        </td>

                        <td className="px-4 py-3">
                          {item.jenis_temuan}
                        </td>

                        <td className="px-4 py-3">

                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              item.tingkat_temuan ===
                              'Berat'
                                ? 'bg-red-100 text-red-700'
                                : item.tingkat_temuan ===
                                  'Sedang'
                                ? 'bg-orange-100 text-orange-700'
                                : item.tingkat_temuan ===
                                  'Ringan'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {
                              item.tingkat_temuan
                            }
                          </span>

                        </td>

                        <td className="px-4 py-3 text-center">

                          <button
                            onClick={() =>
                              handleEdit(item)
                            }
                            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 p-2 rounded-lg"
                          >
                            <Pencil size={16} />
                          </button>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

          <div className="flex justify-between items-center p-4 border-t">

            <button
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage(
                  currentPage - 1
                )
              }
              className="border px-3 py-2 rounded-lg disabled:opacity-50"
            >
              Prev
            </button>

            <span className="text-sm">
              Halaman {currentPage} / {totalPages}
            </span>

            <button
              disabled={
                currentPage >= totalPages
              }
              onClick={() =>
                setCurrentPage(
                  currentPage + 1
                )
              }
              className="border px-3 py-2 rounded-lg disabled:opacity-50"
            >
              Next
            </button>

          </div>

        </div>

        {showModal && (

          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">

              <div className="flex items-center justify-between mb-5">

                <h2 className="text-lg font-bold">

                  {editingId
                    ? 'Edit Temuan'
                    : 'Tambah Temuan'}

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

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-4"
              >

                <div>

                  <label className="block mb-2 text-sm font-semibold">
                    Pegawai
                  </label>

                  <select
                    value={
                      formData.iduser
                    }
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

                    {users.map(
                      (item) => (

                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.full_name}
                        </option>

                      )
                    )}

                  </select>

                </div>

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

                    {periodeOptions.map(
                      (item) => (

                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>

                      )
                    )}

                  </select>

                </div>

                <div>

                  <label className="block mb-2 text-sm font-semibold">
                    Tanggal Sidak
                  </label>

                  <input
                    type="date"
                    value={
                      formData.tanggal_sidak
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tanggal_sidak:
                          e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3"
                  />

                </div>

                <div>

                  <label className="block mb-2 text-sm font-semibold">
                    Jenis Temuan
                  </label>

                  <select
                    value={
                      formData.jenis_temuan
                    }
                    onChange={(e) => {

                      const value =
                        e.target.value;

                      setFormData({
                        ...formData,
                        jenis_temuan:
                          value,
                        tingkat_temuan:
                          value ===
                          'Tidak Ada Temuan'
                            ? 'Tidak Ada Temuan'
                            : formData.tingkat_temuan,
                      });

                    }}
                    className="w-full border rounded-xl p-3"
                  >

                    <option value="">
                      Pilih Temuan
                    </option>

                    {jenisTemuanOptions.map(
                      (item) => (

                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>

                      )
                    )}

                  </select>

                </div>

                <div>

                  <label className="block mb-2 text-sm font-semibold">
                    Tingkat Temuan
                  </label>

                  <select
                    value={
                      formData.tingkat_temuan
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tingkat_temuan:
                          e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3"
                  >

                    <option value="">
                      Pilih Tingkat
                    </option>

                    {tingkatTemuanOptions.map(
                      (item) => (

                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>

                      )
                    )}

                  </select>

                </div>

                <div>

                  <label className="block mb-2 text-sm font-semibold">
                    catatan
                  </label>

                  <textarea
                    rows={4}
                    value={
                      formData.catatan
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        catatan:
                          e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3"
                    placeholder="catatan temuan..."
                  />

                </div>

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