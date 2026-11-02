'use client';

import { Clock, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

const OFFICE_LOCATION: {
  latitude: number;
  longitude: number;
  radius_m: number;
  city: string;
} = JSON.parse(
  process.env.NEXT_PUBLIC_LOCATION || `{
    "latitude":5.179003,
    "longitude":97.149272,
    "radius_m":200,
    "city":"lhokseumawe"
  }`
);

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
  const shift = 'pagi' as const;
  const [todayDate, setTodayDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayDateWib, setTodayDateWib] = useState(getTodayWIB());
  
  const [userId, setUserId] = useState<string | null>(null);
  const [canCheckIn, setCanCheckIn] = useState(true);

  // --- Realtime clock ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Reset otomatis setiap hari ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      if (todayStr !== todayDate) {
        setTodayDate(todayStr);
        setLocation(null);
        setDistance(null);
        setAddress('Mencari alamat...');
        setLocationStatus('Mencari lokasi...');
        setIsSubmitting(false);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [todayDate]);

  // --- Ambil lokasi GPS ---
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

        const R = 6371e3;
        const φ1 = OFFICE_LOCATION.latitude * Math.PI / 180;
        const φ2 = lat * Math.PI / 180;
        const Δφ = (lat - OFFICE_LOCATION.latitude) * Math.PI / 180;
        const Δλ = (lon - OFFICE_LOCATION.longitude) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
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

        if (dist <= OFFICE_LOCATION.radius_m)
          setLocationStatus('Lokasi valid (dalam radius kantor)');
        else setLocationStatus('Di luar radius kantor');
      },
      (error) => {
        setLocationStatus('Gagal mendapatkan lokasi.');
      }
    );
  };

  useEffect(() => { fetchLocation(); }, []);

  // Menambahkan detik agar user bisa memantau waktu dengan tepat
  const formattedTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // --- Ambil user ID saat login ---
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  // --- Cek apakah user sudah absen hari ini ---
  useEffect(() => {
    const checkAttendance = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', userId)
        .eq('attendance_date', todayDateWib)
        .eq('shift', shift)
        .maybeSingle();
      setCanCheckIn(!data);
    };
    checkAttendance();
  }, [todayDate, shift, userId]);

  // --- HANDLE CHECK-IN REVISI ---
  const handleCheckIn = async () => {
    if (!location) return toast.error('Lokasi belum terdeteksi.');

    const isValidLocation =
      (distance && distance <= OFFICE_LOCATION.radius_m) &&
      (address && address.toLowerCase().includes('lhokseumawe'));

    if (!isValidLocation) return toast.error('Lokasi di luar area kantor.');

    setIsSubmitting(true);
    try {
      if (!userId) throw new Error('Anda belum login.');

      const now = new Date();
      const shiftStart = new Date(`${todayDateWib}T07:30:00+07:00`);
      const statusAbsen = now > shiftStart ? 'Terlambat' : 'Hadir';

      // Tambah notifikasi jika terlambat
      const lateMinutes = Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / 60000));
        if (statusAbsen === 'Terlambat') {
          const confirmLate = window.confirm(
            `Anda terlambat ${lateMinutes} menit. Tetap lanjutkan?`
          );

          if (!confirmLate) {
            setIsSubmitting(false);
            return;
          }
        }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .insert([{
          user_id: userId,
          attendance_date: todayDateWib,
          shift,
          shift_start: shiftStart.toISOString(),
          shift_end: new Date(`${todayDateWib}T17:00:00+07:00`).toISOString(),
          check_in: now.toISOString(),
          status: statusAbsen,
          check_in_location: address,
          check_in_latitude: location.lat,
          check_in_longitude: location.lon,
          check_in_distance_m: distance,
        }])
        .select('id')
        .single();

      if (attendanceError) throw attendanceError;
// ================= RANDOM VERIFIKASI 5% PER MINGGU =================
      const startYear = new Date(now.getFullYear(), 0, 1)
      const days = Math.floor((now.getTime() - startYear.getTime()) / 86400000)
      const weekNumber = Math.ceil((days + startYear.getDay() + 1) / 7)
      // 5% sampling mingguan
      const randomVerify = ((attendanceData.id + weekNumber) % 100) < 5
      await supabase.from('logbooks').insert([{
        user_id: userId,
        attendance_id: attendanceData.id,
        shift,
        log_date: todayDateWib,
        description: '',
        activity_name: randomVerify ? 'random' : 'system',
        status: 'IN_PROGRESS',
      }]);

      toast.success(`Absen ${shift} berhasil (${statusAbsen})`);
      setCanCheckIn(false);
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan absen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-4 shadow-lg flex items-center">
        <button onClick={() => router.back()} className="p-1 mr-4 text-white hover:text-gray-300 transition">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Absen Masuk</h1>
      </header>

      <main className="p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini</p>
          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
          <p className="text-md text-gray-500">{formattedDate}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border mb-4">
<p className="font-semibold text-[#005FAC]">Jadwal Magang: 07.30–17.00 WIB</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">Status Lokasi (max {OFFICE_LOCATION.radius_m}m dari kantor ):</p>
          <p className={`text-sm ${distance && distance <= OFFICE_LOCATION.radius_m ? 'text-green-600' : 'text-red-600'}`}>
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
          onClick={handleCheckIn}
          disabled={isSubmitting || !canCheckIn}
          className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${
            isSubmitting || !canCheckIn ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'
          }`}
        >
          {isSubmitting ? 'Memproses...' : !canCheckIn ? `Sudah absen hari ini` : 'SUBMIT ABSEN MASUK'}
        </button>
      </main>
    </div>
  );
}