'use client';

import { Clock, ArrowLeft, Camera } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast, Toaster } from 'react-hot-toast';

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

const VALID_LOGBOOK_STATUS = ['COMPLETED'];

export default function PresensiOutForm() {
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [address, setAddress] = useState('Mencari alamat...');
    const [locationStatus, setLocationStatus] = useState('Mencari lokasi...');

    // State Data Absen
    const [attendanceId, setAttendanceId] = useState<number | null>(null);
    const [logbookStatus, setLogbookStatus] = useState<string | null>(null);
    const [currentShift, setCurrentShift] = useState<'pagi' | 'malam' | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);

    // State UI
    const [canCheckOut, setCanCheckOut] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    // State Kamera
    const [photo, setPhoto] = useState<string | null>(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    // --- Realtime clock ---
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- Haversine distance ---
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // --- Fetch location ---
    const fetchLocation = () => {
        if (!navigator.geolocation) return setLocationStatus('Geolocation tidak didukung browser ini.');
        setLocationStatus('Mengambil lokasi...');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                setLocation({ lat, lon });
                const dist = calculateDistance(lat, lon, OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude);
                setDistance(dist);

                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
                    const data = await res.json();
                    setAddress(data.display_name || 'Alamat tidak ditemukan');
                } catch {
                    setAddress('Gagal mendapatkan alamat');
                }

                setLocationStatus(dist <= OFFICE_LOCATION.radius_m ? '✅ Lokasi valid (dalam radius kantor)' : '🚫 Di luar radius kantor');
            },
            (error) => {
                console.error(error);
                setLocationStatus(error.code === error.PERMISSION_DENIED ? 'Akses lokasi ditolak.' : 'Gagal mendapatkan lokasi.');
            }
        );
    };

    useEffect(() => { fetchLocation(); }, []);

    // --- Ambil user ID ---
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (
            cameraOpen &&
            cameraStream &&
            videoRef.current
        ) {
            videoRef.current.srcObject = cameraStream;

            videoRef.current
                .play()
                .catch(err => console.error('Video play error:', err));
        }
    }, [cameraOpen, cameraStream]);

    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream
                    .getTracks()
                    .forEach(track => track.stop());
            }
        };
    }, [cameraStream]);

    // --- LOGIC UTAMA: FETCH SHIFT AKTIF (DIPERBAIKI) ---
    const fetchActiveShift = async () => {
        if (!userId) return;
        setLoadingData(true);
        try {
            // Kita hapus filter tanggal yang ketat.
            // Kita cari saja data attendance milik user yang check_out nya masih NULL.
            // Kita urutkan dari yang paling baru check_in nya.
            const { data: activeSessions, error } = await supabase
                .from('attendances')
                .select('id, shift, check_in, attendance_date')
                .eq('user_id', userId)
                .is('check_out', null) // KUNCINYA DISINI: Cari yg belum checkout
                .order('check_in', { ascending: false }) // Ambil yang paling terakhir masuk
                .limit(1);

            if (error) throw error;

            if (!activeSessions || activeSessions.length === 0) {
                // Benar-benar tidak ada data absen aktif
                setAttendanceId(null);
                setCurrentShift(null);
                setLogbookStatus(null);
                setCanCheckOut(false);
                return;
            }

            // DATA DITEMUKAN (Entah itu shift pagi atau malam, hari ini atau kemarin)
            const activeShift = activeSessions[0];
            setAttendanceId(activeShift.id);
            setCurrentShift(activeShift.shift as 'pagi' | 'malam');
            setCheckInTime(activeShift.check_in);
            // Cek Logbook berdasarkan ID absen tersebut
            const { data: logbook } = await supabase
                .from('logbooks')
                .select('status')
                .eq('attendance_id', activeShift.id)
                .maybeSingle();

            const status = logbook?.status || 'IN_PROGRESS';
            setLogbookStatus(status);

            // Validasi checkout
            setCanCheckOut(VALID_LOGBOOK_STATUS.includes(status.toUpperCase()));

        } catch (err) {
            console.error('DEBUG fetchActiveShift error:', err);
            setCanCheckOut(false);
        } finally {
            setLoadingData(false);
        }
    };

    // Re-fetch setiap kali user id berubah
    useEffect(() => { fetchActiveShift(); }, [userId]);

    const openCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            setCameraStream(stream);
            setCameraOpen(true);

        } catch (err) {
            console.error(err);
            toast.error('Tidak dapat mengakses kamera');
        }
    };

    const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
        toast.error('Kamera belum siap');
        return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // ==========================
    // KOMPRES RESOLUSI
    // ==========================
    const TARGET_WIDTH = 540;
    const TARGET_HEIGHT = 720;

    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        toast.error('Canvas error');
        return;
    }

    // ==========================
    // GAMBAR VIDEO
    // ==========================
    ctx.drawImage(
        video,
        0,
        0,
        TARGET_WIDTH,
        TARGET_HEIGHT
    );

    // ==========================
    // DATA WATERMARK
    // ==========================

    const now = new Date();

    const dateText = now.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const timeText = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const latText =
        location?.lat?.toFixed(5) || '-';

    const lonText =
        location?.lon?.toFixed(5) || '-';

    const distanceText =
        distance !== null
            ? `${distance.toFixed(1)} meter`
            : '-';

    const shortAddress =
        address && address.length > 38
            ? address.substring(0, 38) + '...'
            : address;

    // ==========================
    // WATERMARK BOX
    // ==========================

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(
        0,
        TARGET_HEIGHT - 200,
        TARGET_WIDTH,
        200
    );

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;

    ctx.font = 'bold 30px Arial';
    ctx.fillText(
        'SMART PPNPN',
        20,
        TARGET_HEIGHT - 160
    );

    ctx.font = '24px Arial';

    ctx.fillText(
        `${dateText} ${timeText} WIB`,
        20,
        TARGET_HEIGHT - 120
    );

    ctx.fillText(
        `${latText}, ${lonText}`,
        20,
        TARGET_HEIGHT - 90
    );

    ctx.fillText(
        `Jarak: ${distanceText}`,
        20,
        TARGET_HEIGHT - 60
    );

    ctx.fillText(
        shortAddress || '-',
        20,
        TARGET_HEIGHT - 30
    );

    // ==========================
    // KOMPRES JPEG
    // ==========================

    const compressedImage =
        canvas.toDataURL(
            'image/jpeg',
            0.7
        );

    setPhoto(compressedImage);

    // stop kamera
    if (cameraStream) {
        cameraStream
            .getTracks()
            .forEach(track => track.stop());
    }

    setCameraStream(null);
    setCameraOpen(false);
};


    const uploadPhoto = async () => {
        if (!photo || !userId) return null;
        const response = await fetch(photo);
        const blob = await response.blob();
        const fileName = `${userId}_ot_${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from('attendance-photos')
            .upload(fileName, blob, {
                contentType: 'image/jpeg'
            });

        if (error) throw error;

        const { data } = supabase.storage
            .from('attendance-photos')
            .getPublicUrl(fileName);
        return data.publicUrl;
    };

    // --- Handle CheckOut ---
    const handleCheckOut = async () => {
        if (!currentShift) return toast.error('Shift error.');
        if (!attendanceId) return toast.error('Tidak ada sesi absen yang aktif.');
        if (!location) return toast.error('Lokasi belum terdeteksi.');

        // Pengecekan 4 jam
        const now = new Date();
        const checkInDate = new Date(checkInTime!);
        const workedHours = (now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);

        if (workedHours < 4) {
            const remainingMinutes = Math.ceil((4 - workedHours) * 60);
            toast.error(`Belum bisa absen pulang! Anda baru bekerja ${workedHours.toFixed(1)} jam. Tunggu ${remainingMinutes} menit lagi.`);
            return; // Berhenti di sini
        }

        // Pengecekan Logbook
        if (!logbookStatus || !VALID_LOGBOOK_STATUS.includes(logbookStatus.toUpperCase())) {
            toast.error('Anda harus mengisi dan Submit Logbook terlebih dahulu!');
            return;
        }

        // Pengecekan Lokasi
        if (distance !== null && distance > OFFICE_LOCATION.radius_m) {
            toast.error('Anda berada di luar radius kantor.');
            return;
        }

        if (!photo) {
            toast.error('Silakan ambil foto selfie terlebih dahulu');
            return;
        }
        // Jika semua lolos, lanjutkan ke proses update
        setIsSubmitting(true);
        try {
            const noww = new Date();
            const photoUrl = await uploadPhoto();
            const { error } = await supabase
                .from('attendances')
                .update({
                    check_out: noww.toISOString(),
                    check_out_location: address,
                    check_out_latitude: location.lat,
                    check_out_longitude: location.lon,
                    check_out_distance_m: distance,
                    check_out_photo: photoUrl,
                    status: 'Hadir' // Final status
                })
                .eq('id', attendanceId);

            if (error) throw error;

            toast.success(`✅ Absen Pulang Shift ${currentShift.toUpperCase()} berhasil!`);
            router.replace('/dashboard');
        } catch (err: any) {
            console.error('DEBUG handleCheckOut error:', err);
            toast.error(err?.message || 'Gagal absen pulang');
        } finally { setIsSubmitting(false); }
    };

    const formattedTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const isOutOfRadius = distance !== null && distance > OFFICE_LOCATION.radius_m;

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Toaster position="top-center" reverseOrder={false} />
            <header className="bg-blue-900 text-white p-4 shadow-lg flex items-center">
                <button onClick={() => router.back()} className="p-1 mr-4 text-white hover:text-gray-300 transition">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">Absen Pulang {currentShift ? `Shift ${currentShift.toUpperCase()}` : ''}</h1>
            </header>

            <main className="p-6">
                <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
                    <Clock size={48} className="text-gray-700 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini</p>
                    <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
                    <p className="text-md text-gray-500">{formattedDate}</p>
                </div>

                {/* STATUS CARD */}
                <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
                    {loadingData ? (
                        <p className="text-center text-gray-500">Mengecek data absen...</p>
                    ) : !attendanceId ? (
                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-center font-medium">
                            ⚠️ Tidak ditemukan data absen yang belum pulang.
                            <br /><span className="text-xs font-normal">(Pastikan Anda sudah Absen Masuk sebelumnya)</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* INFO SHIFT AKTIF */}
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                                <p className="text-blue-800 font-semibold">Sesi Aktif: SHIFT {currentShift?.toUpperCase()}</p>
                            </div>

                            <div className={`p-3 rounded-lg flex justify-between items-center ${canCheckOut ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                                <span>Status Logbook:</span>
                                <span className="font-bold">{logbookStatus === 'COMPLETED' ? 'SUDAH DIISI ✅' : 'BELUM DIISI ❌'}</span>
                            </div>

                            <div>
                                <p className="font-semibold text-gray-700 mb-1">Status Lokasi:</p>
                                <p className={`text-sm ${isOutOfRadius ? 'text-red-600' : 'text-green-600'}`}>{locationStatus}</p>
                                {distance !== null && <p className="mt-1 text-sm text-gray-600">Jarak: <b>{distance.toFixed(1)} meter</b></p>}
                                {address && address !== 'Mencari alamat...' && (
                                    <p className="mt-1 text-sm text-gray-600">
                                        Alamat: <b>{address}</b>
                                    </p>
                                )}
                            </div>

                            <button onClick={fetchLocation} className="mt-2 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold py-2 px-3 rounded-lg">
                                Ambil Ulang Lokasi
                            </button>
                        </div>
                    )}
                </div>

                {/* KAMERA */}
                <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Camera size={18} />
                        Foto Selfie Absen Pulang
                    </h3>

                    {!cameraOpen && !photo && (
                        <button
                            onClick={openCamera}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold"
                        >
                            Ambil Foto Selfie
                        </button>
                    )}

                    {cameraOpen && (
                        <div className="space-y-3">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full rounded-lg border bg-black min-h-[300px]"
                            />

                            <button
                                onClick={capturePhoto}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
                            >
                                Ambil Foto
                            </button>
                        </div>
                    )}

                    {photo && (
                        <div className="space-y-3">
                            <img
                                src={photo}
                                alt="Preview Selfie"
                                className="w-full rounded-lg border"
                            />

                            <button
                                onClick={async () => {
                                    setPhoto(null);
                                    await openCamera();
                                }}
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-lg font-semibold"
                            >
                                Ulangi Foto
                            </button>
                        </div>
                    )}

                    <canvas
                        ref={canvasRef}
                        style={{ display: 'none' }}
                    />
                </div>

                <button
                    onClick={handleCheckOut}
                    // Tombol tidak lagi disabled secara teknis agar onClick tetap berjalan
                    className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${isSubmitting ? 'bg-gray-400' : 'bg-blue-900 hover:bg-blue-800'
                        }`}
                >
                    {isSubmitting ? 'Memproses...' : 'SUBMIT ABSEN PULANG'}
                </button>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 text-center">
                    <p>Syarat Absen Pulang:</p>
                    <ul className="list-disc list-inside text-left ml-4 mt-1">
                        <li>Sudah Absen Masuk (Sistem akan mendeteksi shift terakhir yang belum di-checkout).</li>
                        <li>Logbook sudah disubmit (Status: COMPLETED).</li>
                        <li>Berada dalam radius kantor.</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}