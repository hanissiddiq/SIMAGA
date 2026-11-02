'use client';

import { 
  ArrowLeft, ArrowRight, FileText, User, 
  BarChart2, Briefcase, LogOut, AlertTriangle, RefreshCw, 
  BarChart3
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; 

export default function DashboardPage() {
  const router = useRouter();

  const [absensiStatus, setAbsensiStatus] = useState<'Belum Absen' | 'Masuk' | 'Pulang' | 'Terlambat'>('Belum Absen');
  const [currentShift, setCurrentShift] = useState<'pagi' | 'malam' | null>(null);
  const [hasCompletedLogbook, setHasCompletedLogbook] = useState(false);
  const [userData, setUserData] = useState({ fullName: "Loading...", email: "loading@kppn.go.id" });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
//untuk rapor kinerja
  const [showRaporModal, setShowRaporModal] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultSemester = currentMonth <= 6 ? 1 : 2;
  const [tahun, setTahun] = useState(currentYear);
  const [semester, setSemester] = useState(defaultSemester);
  
  // Tanggal hari ini hanya untuk referensi visual/history, bukan filter utama
  const [todayDate, setTodayDate] = useState(new Date().toISOString().split('T')[0]);
  const usePhotoAttendance = process.env.NEXT_PUBLIC_FOTO;
  // --- Fetch status hari ini ---
  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      // 1. Profil user
      const profileRes = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      setUserData({ 
        fullName: profileRes.data?.full_name || user.email?.split('@')[0] || 'Pengguna KPPN', 
        email: user.email || 'N/A' 
      });

      // ------------------------------------------------------------------
      // LOGIC BARU: PRIORITASKAN CARI YANG "BELUM PULANG"
      // ------------------------------------------------------------------
      
      // A. Cari absen aktif (belum checkout) kapanpun tanggalnya
      const { data: activeSession } = await supabase
        .from('attendances')
        .select('id, check_in, check_out, status, shift')
        .eq('user_id', user.id)
        .is('check_out', null) // Cari yang belum checkout
        .order('check_in', { ascending: false }) // Ambil yang paling baru
        .limit(1)
        .maybeSingle();

      if (activeSession) {
        // --- JIKA ADA YANG BELUM PULANG (CONTOH: SHIFT MALAM KEMARIN) ---
        setCurrentShift(activeSession.shift as 'pagi' | 'malam');
        setAbsensiStatus(activeSession.status === 'Terlambat' ? 'Terlambat' : 'Masuk');
        
        // Cek logbook untuk sesi aktif ini
        const { data: log } = await supabase
            .from('logbooks')
            .select('status')
            .eq('attendance_id', activeSession.id)
            .maybeSingle();
            
        setHasCompletedLogbook(log?.status === 'COMPLETED');
      
      } else {
        // --- JIKA TIDAK ADA YANG AKTIF, BARU CEK HISTORY HARI INI ---
        const { data: todaysHistory } = await supabase
            .from('attendances')
            .select('id, shift, check_out')
            .eq('user_id', user.id)
            .eq('attendance_date', todayDate); // Cek tanggal hari ini

        // Cek apakah hari ini sudah ada yang selesai?
        if (todaysHistory && todaysHistory.length > 0) {
            // Misal pagi sudah selesai, sekarang malam?
            // Logic sederhana: Jika ada record hari ini dan tidak aktif, berarti 'Pulang' / Selesai
            setAbsensiStatus('Pulang');
            setCurrentShift(null);
            setHasCompletedLogbook(false);
        } else {
            // Benar-benar kosong hari ini
            setAbsensiStatus('Belum Absen');
            setCurrentShift(null);
            setHasCompletedLogbook(false);
        }
      }

    } catch (err) {
      console.error(err);
      setCurrentShift(null);
      setAbsensiStatus('Belum Absen');
      setHasCompletedLogbook(false);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Reset otomatis tiap tanggal baru ---
  useEffect(() => {
    const interval = setInterval(() => {
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr !== todayDate) setTodayDate(todayStr);
    }, 60_000);
    return () => clearInterval(interval);
  }, [todayDate]);

  useEffect(() => {
    fetchStatus();
    const handleFocus = () => fetchStatus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [todayDate]);

  // --- Tombol handler ---
  const handleAbsenMasuk = () => {
    // console.log('Absen Masuk clicked, usePhotoAttendance:', usePhotoAttendance);
    router.push(
    usePhotoAttendance==='true' ? '/presensi' : '/checkinpage'
  );
};
  const handleAbsenPulang = () => { 
    // Izinkan ke halaman checkout jika status Masuk/Terlambat
    // Validasi logbook juga dilakukan di halaman checkout sebagai pengaman ganda
    if (currentShift) router.push(
        usePhotoAttendance==='true' ? '/presensiout' : '/checkoutform'
    ); 

  };
  const handleLogout = async () => { 
    setIsLoggingOut(true); 
    await supabase.auth.signOut(); 
    router.replace('/login'); 
  };

  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = 'bg-red-600', text = 'Belum Absen', ringColor = 'ring-red-400';
    if (status === 'Masuk') { bgColor = 'bg-green-600'; text = 'Sudah Absen Masuk'; ringColor = 'ring-green-400'; }
    else if (status === 'Pulang') { bgColor = 'bg-blue-600'; text = 'Selesai Hari Ini'; ringColor = 'ring-blue-400'; }
    else if (status === 'Terlambat') { bgColor = 'bg-yellow-600'; text = 'Absen Terlambat'; ringColor = 'ring-yellow-400'; }

    return <div className={`px-4 py-2 text-white rounded-full font-semibold text-sm shadow-md transition duration-300 ${bgColor} ring-2 ${ringColor} ring-opacity-50`}>{text}</div>;
  };

  // LOGIC TOMBOL
  // Tombol Pulang aktif jika status Masuk/Terlambat DAN Logbook sudah COMPLETED
  const isPulangDisabled = (absensiStatus !== 'Masuk' && absensiStatus !== 'Terlambat') || !hasCompletedLogbook;
  
  // Tombol Masuk aktif HANYA JIKA status 'Belum Absen' ATAU 'Pulang' (untuk memungkinkan double shift)
  const isMasukDisabled = absensiStatus === 'Masuk' || absensiStatus === 'Terlambat';

  type FeatureCardProps = { icon: React.ComponentType<{ size?: number }>, title: string, description: string, href?: string, onClick?: () => void };
  const FeatureCard = ({ icon: Icon, title, description, href, onClick }: FeatureCardProps) => {
    const common = "flex items-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 border border-gray-100 transform hover:scale-[1.01]";
    if (onClick) {
      return (
        <button onClick={onClick} className={common}>
          <div className="p-3 bg-blue-100 text-blue-800 rounded-lg mr-4 shadow-inner"><Icon size={24} /></div>
          <div><h3 className="font-bold text-lg text-gray-800">{title}</h3><p className="text-sm text-gray-500">{description}</p></div>
        </button>
      );
    }
    return (
      <a href={href || '#'} className={common}>
        <div className="p-3 bg-blue-100 text-blue-800 rounded-lg mr-4 shadow-inner"><Icon size={24} /></div>
        <div><h3 className="font-bold text-lg text-gray-800">{title}</h3><p className="text-sm text-gray-500">{description}</p></div>
      </a>
    );
  };


  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // const router = useRouter();

const handleOpenModal = () => {
  setOpen(true);
};

const handleSubmit = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  router.push(
    `/rapor/${user?.id}?tahun=${tahun}&semester=${semester}`
  );
};

  if (isLoading || isLoggingOut) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
        <p className="mt-4 text-gray-600 font-semibold">{isLoggingOut ? "Sampai Jumpa..." : "Memuat Dashboard..."}</p>
      </div>
    </div>
  );

 

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-6 pb-20 shadow-xl rounded-b-2xl">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-white"><User size={24} className="text-blue-900" /></div>
            <div><h1 className="text-xl font-extrabold">{userData.fullName}</h1><p className="text-sm opacity-80">{userData.email}</p></div>
          </div>
          <button onClick={handleLogout} className="text-white hover:text-red-300 transition duration-200 p-2 rounded-full" aria-label="Logout"><LogOut size={24} /></button>
        </div>
      </header>

      <main className="px-5 -mt-10 pb-10">
        {/* Status Absensi */}
        <div className="bg-white p-5 rounded-xl shadow-2xl mb-6 border-b-4 border-blue-500">
          <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">
            Status Aktivitas {currentShift ? `(Shift ${currentShift.toUpperCase()})` : ''}
          </h2>
          <div className="flex items-center justify-between"><StatusBadge status={absensiStatus} /></div>
        </div>

        {/* Tombol Absen */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button 
            onClick={handleAbsenMasuk} 
            className={`flex items-center justify-center space-x-2 py-3 rounded-xl shadow-lg transition duration-300 ${isMasukDisabled ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-blue-800 text-white hover:bg-blue-700'}`}
            disabled={isMasukDisabled}
          >
            <ArrowRight size={20} /><span className="font-bold">Absen Masuk</span>
          </button>

          <button 
            onClick={handleAbsenPulang} 
            className={`flex items-center justify-center space-x-2 py-3 rounded-xl shadow-lg transition duration-300 ${isPulangDisabled ? 'bg-gray-400 text-gray-200 shadow-none cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            disabled={isPulangDisabled}
          >
            <ArrowLeft size={20} /><span className="font-bold">Absen Pulang</span>
          </button>
        </div>

        {/* Alert Logbook */}
        {(absensiStatus === 'Masuk' || absensiStatus === 'Terlambat') && (
          <div className={`p-4 mb-8 rounded-xl shadow-sm border ${hasCompletedLogbook ? 'bg-green-50 border-green-300 text-green-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
            <p className="font-semibold text-center flex items-center justify-center text-sm">
              <AlertTriangle size={20} className={`mr-2 ${hasCompletedLogbook ? 'text-green-600' : ''}`} />
              {hasCompletedLogbook 
                ? 'Logbook sudah diisi. Silakan Absen Pulang.' 
                : 'Isi Logbook dulu agar tombol Pulang aktif.'}
            </p>
          </div>
        )}

        {/* Menu */}
        <h2 className="text-lg font-bold text-gray-800 mb-4">Menu Aplikasi</h2>
        <div className="space-y-4">
          <FeatureCard icon={FileText} title="Logbook" description="Catat detail aktivitas harian Anda." href="/logbook" />
          <FeatureCard icon={FileText} title="Absen Lembur" description="Catat detail aktivitas harian Anda." href="/lembur" />
          <FeatureCard icon={Briefcase} title="Pengajuan Cuti" description="Ajukan permohonan cuti." href="/pengajuancutipage" />
          <FeatureCard icon={AlertTriangle} title="Pengajuan Izin" description="Ajukan izin tidak hadir atau keperluan mendadak." href="/pengajuanizin" />
          <FeatureCard icon={BarChart2} title="Rekap Absensi" description="Lihat riwayat kehadiran bulanan." href="/rekapabsensi" />
          <FeatureCard icon={BarChart2} title="Rekap Lembur" description="Lihat riwayat lembur." href="/rekaplembur" />
          <FeatureCard icon={BarChart2} title="Perilaku Kerja" description="Masih tahap pengembangan" href="/penilaianperilaku" />
          <FeatureCard icon={BarChart3}
                  title="Rapor Kinerja"
                  description="Masih tahap pengembangan" 
                  href="#"
                  onClick={handleOpenModal}
                />
        </div>
        {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-80">
            
            <h2 className="text-lg font-bold mb-4">
              Pilih Periode
            </h2>

            {/* Tahun */}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border p-2 mb-3"
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Bulan */}
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full border p-2 mb-4"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1 border"
              >
                Batal
              </button>

              <button
                onClick={handleSubmit}
                className="px-3 py-1 bg-blue-600 text-white"
              >
                Lihat
              </button>
            </div>

          </div>
        </div>
      )}
      </main>
       
    </div>
  );
}