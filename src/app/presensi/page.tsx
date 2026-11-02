'use client';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ArrowLeft,
  Camera,
  Clock,
} from 'lucide-react';

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

const getTodayWIB = () => {
  return new Date(Date.now() + WIB_OFFSET)
    .toISOString()
    .split('T')[0];
};

export default function CheckInPage() {
  const router = useRouter();

  // =========================
  // HYDRATION FIX
  // =========================

  const [mounted, setMounted] =
    useState(false);

  // =========================
  // STATE
  // =========================

  const [currentTime, setCurrentTime] =
    useState(new Date());

  const [todayDate, setTodayDate] =
    useState('');

  const [todayDateWib, setTodayDateWib] =
    useState('');

  const [location, setLocation] =
    useState<{
      lat: number;
      lon: number;
    } | null>(null);

  const [distance, setDistance] =
    useState<number | null>(null);

  const [address, setAddress] =
    useState('Mencari alamat...');

  const [locationStatus, setLocationStatus] =
    useState('Mencari lokasi...');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const shift = 'pagi' as const;

  const [userId, setUserId] = useState<
    string | null
  >(null);

  const [canCheckIn, setCanCheckIn] =
    useState(true);

  // =========================
  // FOTO / KAMERA
  // =========================

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const [photo, setPhoto] = useState<
    string | null
  >(null);

  const [cameraOpen, setCameraOpen] =
    useState(false);

  // =========================
  // MOUNTED FIX
  // =========================

  useEffect(() => {
    setMounted(true);

    setTodayDate(
      new Date().toISOString().split('T')[0]
    );

    setTodayDateWib(getTodayWIB());
  }, []);

  // =========================
  // CLEANUP CAMERA
  // =========================

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream =
          videoRef.current
            .srcObject as MediaStream;

        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);

  // =========================
  // REALTIME CLOCK
  // =========================

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // =========================
  // RESET HARIAN
  // =========================

  useEffect(() => {
    if (!todayDate) return;

    const timer = setInterval(() => {
      const now = new Date();

      const todayStr = now
        .toISOString()
        .split('T')[0];

      if (todayStr !== todayDate) {
        setTodayDate(todayStr);

        setLocation(null);

        setDistance(null);

        setAddress(
          'Mencari alamat...'
        );

        setLocationStatus(
          'Mencari lokasi...'
        );

        setIsSubmitting(false);

        setPhoto(null);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [todayDate]);

  // =========================
  // GPS
  // =========================

  const fetchLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus(
        'Geolocation tidak didukung browser ini.'
      );

      return;
    }

    setLocationStatus(
      'Mengambil lokasi...'
    );

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;

        const lon = pos.coords.longitude;

        setLocation({ lat, lon });

        const R = 6371e3;

        const φ1 =
          (OFFICE_LOCATION.latitude *
            Math.PI) /
          180;

        const φ2 = (lat * Math.PI) / 180;

        const Δφ =
          ((lat -
            OFFICE_LOCATION.latitude) *
            Math.PI) /
          180;

        const Δλ =
          ((lon -
            OFFICE_LOCATION.longitude) *
            Math.PI) /
          180;

        const a =
          Math.sin(Δφ / 2) ** 2 +
          Math.cos(φ1) *
            Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;

        const c =
          2 *
          Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
          );

        const dist = R * c;

        setDistance(dist);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          );

          const data = await res.json();

          setAddress(
            data.display_name ||
              'Alamat tidak ditemukan'
          );
        } catch {
          setAddress(
            'Gagal mendapatkan alamat'
          );
        }

        if (
          dist <= OFFICE_LOCATION.radius_m
        ) {
          setLocationStatus(
            'Lokasi valid (dalam radius kantor)'
          );
        } else {
          setLocationStatus(
            'Di luar radius kantor'
          );
        }
      },
      () => {
        setLocationStatus(
          'Gagal mendapatkan lokasi.'
        );
      }
    );
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // =========================
  // USER LOGIN
  // =========================

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
      }
    };

    fetchUser();
  }, []);

  // =========================
  // CEK ABSEN
  // =========================

  useEffect(() => {
    const checkAttendance = async () => {
      if (!userId || !todayDateWib)
        return;

      const { data } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', userId)
        .eq(
          'attendance_date',
          todayDateWib
        )
        .eq('shift', shift)
        .maybeSingle();

      setCanCheckIn(!data);
    };

    checkAttendance();
  }, [todayDateWib, shift, userId]);

  // =========================
  // BUKA KAMERA
  // =========================

  const openCamera = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: 'user',
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            },
            audio: false,
          }
        );

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      setCameraOpen(true);
    } catch (err) {
      console.error(err);

      toast.error(
        'Kamera tidak dapat diakses. Pastikan izin kamera diaktifkan.'
      );
    }
  };

  // =========================
  // AMBIL FOTO
  // =========================

  const capturePhoto = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;

  if (!video || !canvas) return;

  // 1. TINGKATKAN RESOLUSI
  const TARGET_WIDTH = 540;
  const TARGET_HEIGHT = 720;

  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 2. DEFINISI VARIABEL (Agar tidak ReferenceError)
  const now = new Date();
  const dateText = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const latText = location?.lat ? location.lat.toFixed(5) : '-';
  const lonText = location?.lon ? location.lon.toFixed(5) : '-';
  const distanceText = distance !== null ? `${distance.toFixed(1)} meter` : '-';
  const shortAddress = address ? address.substring(0, 38) : 'Lokasi tidak tersedia';

  // 3. Gambar video ke canvas
  ctx.drawImage(video, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  // 4. Overlay Watermark
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, TARGET_HEIGHT - 200, TARGET_WIDTH, 200);

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4;

  // Render Teks
  ctx.font = 'bold 30px Arial';
  ctx.fillText('SIMAGA - Absen Masuk', 20, TARGET_HEIGHT - 160);

  ctx.font = '24px Arial';
  ctx.fillText(`${dateText} ${timeText} WIB`, 20, TARGET_HEIGHT - 120);
  ctx.fillText(`${latText}, ${lonText}`, 20, TARGET_HEIGHT - 90);
  ctx.fillText(`Jarak: ${distanceText}`, 20, TARGET_HEIGHT - 60);
  ctx.fillText(shortAddress, 20, TARGET_HEIGHT - 30);

  // 5. EKSPOR GAMBAR (Kualitas 0.8 sudah sangat jernih dan tidak pecah)
  const compressedImage = canvas.toDataURL('image/jpeg', 0.7);

  setPhoto(compressedImage);
  setCameraOpen(false);

  // Stop kamera
  const stream = video.srcObject as MediaStream;
  stream?.getTracks().forEach((track) => track.stop());
};

  // =========================
  // HANDLE CHECK IN
  // =========================

  const handleCheckIn = async () => {
    if (!location) {
      return toast.error(
        'Lokasi belum terdeteksi.'
      );
    }

    if (!photo) {
      return toast.error(
        'Silakan ambil foto terlebih dahulu.'
      );
    }

    const isValidLocation =
      distance &&
      distance <=
        OFFICE_LOCATION.radius_m &&
      address
        .toLowerCase()
        .includes('lhokseumawe');

    if (!isValidLocation) {
      return toast.error(
        'Lokasi di luar area kantor.'
      );
    }

    setIsSubmitting(true);

    try {
      if (!userId) {
        throw new Error(
          'Anda belum login.'
        );
      }

      // =========================
      // UPLOAD FOTO
      // =========================

      const response =
        await fetch(photo);

      const blob =
        await response.blob();

      const fileName = `${userId}_in_${Date.now()}.jpg`;

      const { error: uploadError } =
        await supabase.storage
          .from(
            'attendance-photos'
          )
          .upload(fileName, blob, {
            contentType:
              'image/jpeg',
          });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from(
          'attendance-photos'
        )
        .getPublicUrl(fileName);

      const photoUrl =
        publicUrlData.publicUrl;

      // =========================
      // CEK PROFIL
      // =========================

      const {
        data: profileCheck,
      } = await supabase
        .from('profiles')
        .select('position')
        .eq('id', userId)
        .single();

      const userPos =
        profileCheck?.position?.toUpperCase() ||
        '';

      const now = new Date();

      // ========= start cek format waktu =======
      console.log('=== DEBUG TIMEZONE ===');
      console.log('Local Date:', now.toString());
      console.log('ISO/UTC:', now.toISOString());
      console.log(
        'Timezone:',
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      console.log(
        'Local Time:',
        now.toLocaleString('id-ID')
      );
      console.log(
        'WIB Time:',
        now.toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          dateStyle: 'full',
          timeStyle: 'long',
        })
      );
      // ========= end cek format waktu =======

      let lockTime = '08:00:00';

      if (shift === 'pagi') {
        if (
          userPos.includes('SATPAM') || userPos.includes('Satpam')
        ) {
          lockTime =
            '07:45:00';
        } else if (
          userPos.includes('CS')
        ) {
          lockTime =
            '07:30:00';
        } else {
          lockTime =
            '07:30:00'; //PPNPN lebih fleksibel, jadi bisa masuk 07:30:02 - 07:59:59, tapi tetap dianggap terlambat jika lewat dari 08:00:00
        }
      } else {
        if (
          userPos.includes('SATPAM') || userPos.includes('Satpam')
        ) {
          lockTime =
            '19:45:00';
        } else {
          lockTime =
            '20:00:00'; //Shift malam untuk semua selain satpam, dianggap terlambat jika lewat dari 20:00:00
        }
      }

      const shiftStart =
        new Date(
          todayDateWib +
            'T' +
            lockTime
        );

      const statusAbsen =
        now > shiftStart
          ? 'Terlambat'
          : 'Hadir';

      const lateMinutes =
        Math.max(
          0,
          Math.floor(
            (now.getTime() -
              shiftStart.getTime()) /
              60000
          )
        );

      if (
        statusAbsen ===
        'Terlambat'
      ) {
        const confirmLate =
          window.confirm(
            `Anda terlambat ${lateMinutes} menit. Tetap lanjutkan?`
          );

        if (!confirmLate) {
          setIsSubmitting(false);
          return;
        }
      }

      // =========================
      // INSERT ATTENDANCE
      // =========================

      const {
        data: attendanceData,
        error: attendanceError,
      } = await supabase
        .from('attendances')
        .insert([
          {
            user_id: userId,

            attendance_date:
              todayDateWib,

            shift,

            shift_start:
              shiftStart.toISOString(),

            shift_end:
              shift === 'pagi'
                ? new Date(
                    todayDateWib +
                      'T17:30:00'
                  ).toISOString()
                : new Date(
                    new Date(
                      todayDateWib
                    ).getTime() +
                      86400000 +
                      7 *
                        3600000
                  ).toISOString(),

            check_in:
              now.toISOString(),

            status:
              statusAbsen,

            check_in_location:
              address,

            check_in_latitude:
              location.lat,

            check_in_longitude:
              location.lon,

            check_in_distance_m:
              distance,

            check_in_photo:
              photoUrl,
          },
        ])
        .select('id')
        .single();

      if (attendanceError) {
        throw attendanceError;
      }

      // =========================
      // INSERT LOGBOOK
      // =========================

      await supabase
        .from('logbooks')
        .insert([
          {
            user_id: userId,

            attendance_id:
              attendanceData.id,

            shift,

            log_date:
              todayDateWib,

            description: '',

            status:
              'IN_PROGRESS',
          },
        ]);

      toast.success(
        `Absen ${shift} berhasil (${statusAbsen})`
      );

      setCanCheckIn(false);

      router.replace(
        '/dashboard'
      );
    } catch (err: any) {
      toast.error(
        err?.message ||
          'Gagal menyimpan absen.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // FORMAT WAKTU
  // =========================

  const formattedTime = mounted
    ? currentTime.toLocaleTimeString(
        'id-ID',
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }
      )
    : '--:--:--';

  const formattedDate = mounted
    ? currentTime.toLocaleDateString(
        'id-ID',
        {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }
      )
    : 'Memuat tanggal...';

  // =========================
  // SSR FIX
  // =========================

  if (!mounted) {
    return null;
  }

  // =========================
  // UI
  // =========================

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_25%),linear-gradient(180deg,#f5f8fc_0%,#edf4fb_100%)] font-sans text-slate-800">
      <header className="relative overflow-hidden bg-[var(--djkn-blue)] px-5 pb-20 pt-4 text-white shadow-[0_20px_45px_rgba(0,95,172,0.22)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,183,21,0.35),transparent_30%)]" />
        <div className="relative flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/20 bg-white/10 p-2 transition hover:bg-white/20"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100">Presensi</p>
            <h1 className="text-xl font-black">Absen Masuk</h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 -mt-12 space-y-5 px-4 pb-8">
        <div className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_22px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Waktu saat ini</p>
            <span className="rounded-full bg-[var(--djkn-gold)]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--djkn-blue)]">Shift Pagi</span>
          </div>

          <div className="flex items-center justify-center rounded-2xl bg-[var(--djkn-gold)]/10 p-5 text-center">
            <div>
              <Clock size={40} className="mx-auto mb-3 text-[var(--djkn-blue)]" />
              <h2 className="text-4xl font-black tracking-tight text-slate-900">{formattedTime}</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">{formattedDate}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Shift Aktif</p>
              <p className="mt-2 text-lg font-black text-[var(--djkn-blue)]">Pagi</p>
            </div>
            <div className="rounded-full border border-[var(--djkn-gold)]/30 bg-[var(--djkn-gold)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--djkn-blue)]">
              Default
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Status Lokasi</p>
          <p className={`text-sm font-semibold ${distance && distance <= OFFICE_LOCATION.radius_m ? 'text-emerald-600' : 'text-red-600'}`}>
            {locationStatus}
          </p>

          {distance !== null && (
            <p className="mt-2 text-sm text-slate-600">
              Jarak dari kantor: <span className="font-bold text-slate-800">{distance.toFixed(1)} meter</span>
            </p>
          )}

          <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            <span className="font-bold text-slate-800">Alamat:</span>
            <br />
            {address}
          </p>

          <button
            onClick={fetchLocation}
            className="mt-4 w-full rounded-xl bg-[var(--djkn-blue)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(0,95,172,0.18)] transition hover:bg-[#004d8a]"
          >
            Ambil Ulang Lokasi
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--djkn-gold)]/15 text-[var(--djkn-blue)]">
              <Camera size={18} />
            </div>
            <p className="text-base font-black text-slate-800">Foto Presensi</p>
          </div>

          {!photo && !cameraOpen && (
            <button
              onClick={() => {
                setCameraOpen(true);
                setTimeout(() => openCamera(), 300);
              }}
              className="w-full rounded-xl bg-[var(--djkn-green)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_25px_rgba(2,165,79,0.18)] transition hover:bg-[#029249]"
            >
              Buka Kamera
            </button>
          )}

          {cameraOpen && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-2xl border border-slate-200 bg-black"
              />
              <button
                onClick={capturePhoto}
                className="w-full rounded-xl bg-[var(--djkn-blue)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_25px_rgba(0,95,172,0.2)] transition hover:bg-[#004d8a]"
              >
                Ambil Foto
              </button>
            </div>
          )}

          {photo && (
            <div className="space-y-3">
              <img src={photo} alt="Preview" className="w-full rounded-2xl border border-slate-200" />
              <button
                onClick={() => {
                  setPhoto(null);
                  setCameraOpen(true);
                  setTimeout(() => openCamera(), 300);
                }}
                className="w-full rounded-xl bg-[var(--djkn-gold)] px-4 py-3 text-sm font-bold text-slate-900 shadow-[0_12px_25px_rgba(250,183,21,0.2)] transition hover:bg-[#f4bb2d]"
              >
                Ambil Ulang
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <button
          onClick={handleCheckIn}
          disabled={isSubmitting || !canCheckIn}
          className={`w-full rounded-[22px] py-4 text-base font-black transition duration-300 ${
            isSubmitting || !canCheckIn
              ? 'cursor-not-allowed bg-slate-300 text-slate-500'
              : 'bg-[var(--djkn-gold)] text-slate-900 shadow-[0_18px_35px_rgba(250,183,21,0.28)] hover:bg-[#f4bb2d]'
          }`}
        >
          {isSubmitting
            ? 'Memproses...'
            : !canCheckIn
            ? `Sudah absen shift ${shift}`
            : 'SUBMIT ABSEN MASUK'}
        </button>
      </main>
    </div>
  );
}
