'use client';

import { Clock, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { redirect, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast, Toaster } from 'react-hot-toast';

// const OFFICE_LOCATION = {
//   latitude: 5.179003,
//   longitude: 97.149272,
//   RADIUS_M: 200,
// };

// ========== Koordinat Kantor KPKNL Lhokseumawe ==========
const OFFICE_LOCATION = {
  latitude: 5.178367,
  longitude: 97.140541,
  RADIUS_M: 200,
};

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const getTodayWIB = () =>
  new Date(Date.now() + WIB_OFFSET).toISOString().split('T')[0];

export default function CheckInPage() {
  const router = useRouter();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('Mencari alamat...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('Mencari lokasi...');
  // const [shift, setShift] = useState<'pagi' | 'malam'>('pagi');

  const [todayDateWib, setTodayDateWib] = useState(getTodayWIB());
  const [userId, setUserId] = useState<string | null>(null);

  // === record lembur hari ini ===
  const [attendanceToday, setAttendanceToday] = useState<any>(null);
  const [uraianLembur, setUraianLembur] = useState('');

  // realtime jam
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ambil user login
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  // ambil lokasi
  const fetchLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation tidak didukung browser ini.');
      return;
    }

    setLocationStatus('Mengambil lokasi...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setLocation({ lat, lon });

        // hitung jarak
        const R = 6371e3;
        const φ1 = OFFICE_LOCATION.latitude * Math.PI / 180;
        const φ2 = lat * Math.PI / 180;
        const Δφ = (lat - OFFICE_LOCATION.latitude) * Math.PI / 180;
        const Δλ = (lon - OFFICE_LOCATION.longitude) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;

        setDistance(dist);

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          setAddress(data.display_name || 'Alamat tidak ditemukan');
        } catch {
          setAddress('Gagal mendapatkan alamat');
        }

        if (dist <= OFFICE_LOCATION.RADIUS_M)
          setLocationStatus('Dalam radius kantor');
        else
          setLocationStatus('Luar radius kantor');
      },
      () => {
        setLocationStatus('Gagal mendapatkan lokasi.');
      }
    );
  };

  useEffect(() => { fetchLocation(); }, []);

  // === cek apakah sudah clock-in / clock-out hari ini ===
  useEffect(() => {
    const checkAttendance = async () => {
      if (!userId) return;

      const { data } = await supabase
        .from('lembur')
        .select('*')
        .eq('user_id', userId)
        .eq('attendance_date', todayDateWib)
        // .eq('shift', shift)
        .order('created_at', { ascending: false })
        .limit(1);

      setAttendanceToday(data?.[0] || null);
    };

    checkAttendance();
  }, [userId, todayDateWib]);

  // =========================
  // CLOCK IN
  // =========================
  const handleClockIn = async () => {
    if (!location) return toast.error('Lokasi tidak terdeteksi.');

    setIsSubmitting(true);

    try {
      const now = new Date();

      const { data, error } = await supabase
        .from('lembur')
        .insert([{
          user_id: userId,
          attendance_date: todayDateWib,
          // shift,
          check_in: now.toISOString(),
          check_in_location: address,
          check_in_latitude: location.lat,
          check_in_longitude: location.lon,
          check_in_distance_m: distance,
          status: 'Clock-In'
        }])
        .select('*')
        .single();

      if (error) throw error;

      toast.success('Clock-In lembur berhasil');
      setAttendanceToday(data);
      
    } catch (err: any) {
      toast.error(err?.message || 'Gagal clock-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // CLOCK OUT
  // =========================
  const handleClockOut = async () => {
    if (!attendanceToday) return;
    if (!location)
      return toast.error(
        'Lokasi tidak terdeteksi.'
      );

    // =========================
    // VALIDASI URAIAN
    // =========================

    if (!uraianLembur.trim()) {
      return toast.error(
        'Uraian lembur wajib diisi sebelum clock-out.'
      );
    }

    setIsSubmitting(true);

    try {
      const now = new Date();

      // STATUS FINAL
      const finalStatus =
        `Selesai - ${uraianLembur}`;

      const { error } = await supabase
        .from('lembur')
        .update({
          check_out: now.toISOString(),
          check_out_location: address,
          check_out_latitude: location.lat,
          check_out_longitude: location.lon,
          check_out_distance_m: distance,
          status: finalStatus
        })
        .eq('id', attendanceToday.id);

      if (error)
        throw error;

      toast.success(
        'Clock-Out lembur berhasil'
      );

      setAttendanceToday({
        ...attendanceToday,
        check_out: now.toISOString(),
        status: finalStatus
      });

      // RESET TEXTAREA
      setUraianLembur('');

    } catch (err: any) {

      toast.error(
        err?.message || 'Gagal clock-out.'
      );

    } finally {

      setIsSubmitting(false);
    }
  };

  // =========================
  // TOMBOL OTOMATIS
  // =========================
  const handleSubmit = () => {
    // belum ada record → clock in
    if (!attendanceToday) return handleClockIn();

    // sudah clock in tapi belum clock out → clock out
    if (attendanceToday && !attendanceToday.check_out)
      return handleClockOut();

    // sudah lengkap
    return toast.error('Lembur hari ini sudah selesai.');
  };

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

    const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLemburDurationMinutes = () => {
    if (!attendanceToday?.check_in) return 0;
    const checkInTime = new Date(attendanceToday.check_in).getTime();
    const now = new Date().getTime();
    return (now - checkInTime) / 1000 / 60; // menit
  };
  
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-4 shadow-lg flex items-center">
       <Toaster position="top-right" reverseOrder={false} /> 
       <button onClick={() => router.push('/')} className="p-1 mr-4">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Absensi Lembur</h1>
      </header>

      <main className="p-6">

        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini</p>
          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
          <p className="text-md text-gray-500">{formattedDate}</p>
        </div>

        {/* <div className="bg-white p-4 rounded-xl shadow-md border mb-4">
          <label className="font-semibold text-gray-700">Pilih Shift:</label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as 'pagi' | 'malam')}
            className="mt-2 w-full border p-2 rounded-lg"
          >
            <option value="pagi">Shift Pagi</option>
            <option value="malam">Shift Malam</option>
          </select>
        </div> */}

        {attendanceToday && (
          <div className="bg-white p-4 rounded-xl shadow-md border mb-5">

            <p className="font-semibold text-gray-700 mb-2">
              Status Lembur Hari Ini :
            </p>

            <p className="text-sm text-gray-700">
              ✔ Clock-In:&nbsp;
              <b>{attendanceToday.check_in ? formatTime(attendanceToday.check_in) : '-'}</b>
            </p>

            {attendanceToday.check_out && (
              <p className="text-sm text-gray-700 mt-1">
                ✔ Clock-Out:&nbsp;
                <b>{formatTime(attendanceToday.check_out)}</b>
              </p>
            )}

            {!attendanceToday.check_out && (
              <p className="text-xs text-orange-600 mt-1">
                Belum melakukan clock-out
              </p>
            )}
          </div>
        )}

        {/* =========================
            URAIAN LEMBUR
        ========================= */}

        {attendanceToday &&
        !attendanceToday.check_out && (

          <div className="bg-white p-4 rounded-xl shadow-md border mb-5">

            <label className="block font-semibold text-gray-700 mb-2">

              Uraian Lembur
              <span className="text-red-600"> *</span>

            </label>

            <textarea
              value={uraianLembur}
              onChange={(e) =>
                setUraianLembur(e.target.value)
              }
              rows={4}
              placeholder="Contoh: Penyelesaian SP2D, monitoring OMSPAN, rekap LPJ, penyusunan laporan, dll..."
              className="
                w-full
                border
                rounded-lg
                p-3
                text-sm
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500
              "
            />

            <p className="text-xs text-gray-500 mt-2">

              Uraian lembur wajib diisi
              sebelum melakukan clock-out.

            </p>

          </div>
        )}

        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">
            Status Lokasi (radius 200m dari kantor):
          </p>

          <p className={`text-sm ${distance && distance <= OFFICE_LOCATION.RADIUS_M ? 'text-green-600' : 'text-red-600'}`}>
            {locationStatus}
          </p>

          {distance !== null && (
            <p className="mt-1 text-sm text-gray-600">
              Jarak dari kantor: <b>{distance.toFixed(1)} meter</b>
            </p>
          )}

          <p className="mt-2 text-sm text-gray-600">
            <b>Alamat:</b><br />{address}
          </p>

          <button onClick={fetchLocation} className="mt-3 bg-blue-900 text-white text-sm py-2 px-3 rounded-lg">
            Ambil Ulang Lokasi
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            (attendanceToday?.check_in &&
              !attendanceToday?.check_out &&
              getLemburDurationMinutes() < 60) // minimal 1 jam
          }
          className={`w-full py-4 text-white font-extrabold rounded-xl shadow-xl ${
            isSubmitting ||
            (attendanceToday?.check_in &&
              !attendanceToday?.check_out &&
              getLemburDurationMinutes() < 60)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-900 hover:bg-blue-800'
          }`}
        >
          {isSubmitting
            ? 'Memproses...'
            : !attendanceToday
            ? 'CLOCK-IN LEMBUR'
            : !attendanceToday.check_out
            ? getLemburDurationMinutes() < 60
              ? `CLOCK-OUT (minimal 1 jam)`
              : 'CLOCK-OUT LEMBUR'
            : 'LEMBUR SELESAI'}
        </button>
      </main>
    </div>
  );
}
