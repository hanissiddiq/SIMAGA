'use client';

import { useEffect, useState } from 'react';
import {
  useParams,
  useSearchParams
} from 'next/navigation';
import QRCode from 'react-qr-code';
import { supabase } from '@/lib/supabaseClient';

export default function Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [currentUrl, setCurrentUrl] = useState('');
  const userid = params.userid;
  const tahun = searchParams.get('tahun');
  const semester = searchParams.get('semester');
  const useKantor = process.env.NEXT_PUBLIC_KANTOR;
  const [rapor, setRapor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userid && tahun && semester) {
      loadData();
    }
  }, [userid, tahun, semester]);


  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('v_rapor')
        .select('*')
        .eq('user_id', userid)
        .eq('period_year', Number(tahun))
        .eq('period_semester', Number(semester))
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setRapor(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const cetak = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-10">
        Loading...
      </div>
    );
  }

  if (!rapor) {
    return (
      <div className="p-10 text-red-600">
        Data rapor tidak ditemukan
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      <div className="max-w-4xl mx-auto bg-white p-10 shadow">

        {/* KOP */}

        <div className="text-center border-b pb-4">

          <h2 className="font-bold text-lg">
            KEMENTERIAN KEUANGAN RI
          </h2>

          <h2 className="font-bold">
            DIREKTORAT JENDERAL PERBENDAHARAAN
          </h2>

          <h2 className="font-bold">
            {useKantor}
          </h2>

          <h1 className="text-2xl font-bold mt-6">
            RAPOR KINERJA PPNPN
          </h1>

        </div>

        {/* IDENTITAS */}

        <div className="mt-8">

          <table className="w-full">

            <tbody>

              <tr>
                <td className="py-1 w-40">
                  Nama
                </td>
                <td>
                  : {rapor.full_name}
                </td>
              </tr>

              <tr>
                <td className="py-1">
                  Tahun
                </td>
                <td>
                  : {rapor.period_year}
                </td>
              </tr>

              <tr>
                <td className="py-1">
                  Semester
                </td>
                <td>
                  : {rapor.period_semester}
                </td>
              </tr>

            </tbody>

          </table>

        </div>

        {/* NILAI */}

        <div className="mt-8">

          <table className="w-full border">

            <thead>

              <tr className="bg-gray-100">

                <th className="border p-3">
                  Komponen
                </th>

                <th className="border p-3">
                  Nilai
                </th>

              </tr>

            </thead>

            <tbody>

              <tr>
                <td className="border p-3">
                  Kehadiran (40%)
                </td>
                <td className="border p-3 text-center">
                  {rapor.discipline_score}
                </td>
              </tr>

              <tr>
                <td className="border p-3">
                  Nilai Perilaku (20%)
                </td>
                <td className="border p-3 text-center">
                  {rapor.behavior_score}
                </td>
              </tr>

              <tr>
                <td className="border p-3">
                  Survei Kepuasan Pegawai(30%)
                </td>
                <td className="border p-3 text-center">
                  {rapor.survey_score}
                </td>
              </tr>

              <tr>
                <td className="border p-3">
                  Kepatuhan Internal (10%)
                </td>
                <td className="border p-3 text-center">
                  {rapor.ki_score}
                </td>
              </tr>

              <tr className="font-bold bg-gray-50">
                <td className="border p-3">
                  NILAI AKHIR
                </td>
                <td className="border p-3 text-center">
                  {rapor.final_score}
                </td>
              </tr>

              <tr className="font-bold">
                <td className="border p-3">
                  PREDIKAT
                </td>
                <td className="border p-3 text-center">
                  {rapor.predikat}
                </td>
              </tr>

            </tbody>

          </table>

        </div>

        <div className="mt-16">

      {/* QR */}
      <div className="text-center mb-6">
        <p className="text-sm">Dicetak pada_ 
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* QR CODE */}
      <div className="flex justify-center mb-10">
        {currentUrl && (
          <QRCode value={currentUrl} size={110} />
        )}
        <p className="text-sm mb-2 text-left padding-left-2">__SMART PPNPN <br />__(Sistem Monitoring dan Rapor Kinerja PPNPN)</p>
      </div>
      </div>

        {/* BUTTON */}

        <div className="mt-10 text-center print:hidden">

          <button
            onClick={cetak}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Cetak PDF
          </button>

        </div>

      </div>

    </div>
  );
}