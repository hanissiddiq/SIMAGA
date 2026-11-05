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
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
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
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      const nextAvatar = profileRes.data?.avatar_url || localStorage.getItem('profile_avatar_url') || null;

      setUserData({ 
        fullName: profileRes.data?.full_name || user.email?.split('@')[0] || 'Pengguna KPPN', 
        email: user.email || 'N/A' 
      });
      setUserAvatar(nextAvatar);

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
    let bgColor = 'bg-red-100 text-red-700 border-red-200', text = 'Belum Absen';
    if (status === 'Masuk') { bgColor = 'bg-emerald-100 text-emerald-700 border-emerald-200'; text = 'Sudah Absen Masuk'; }
    else if (status === 'Pulang') { bgColor = 'bg-[var(--djkn-blue)]/10 text-[var(--djkn-blue)] border-[var(--djkn-blue)]/20'; text = 'Selesai Hari Ini'; }
    else if (status === 'Terlambat') { bgColor = 'bg-[var(--djkn-gold)]/20 text-amber-800 border-[var(--djkn-gold)]/40'; text = 'Absen Terlambat'; }

    return <div className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-bold shadow-sm ${bgColor}`}>{text}</div>;
  };

  // LOGIC TOMBOL
  // Tombol Pulang aktif jika status Masuk/Terlambat DAN Logbook sudah COMPLETED
  const isPulangDisabled = (absensiStatus !== 'Masuk' && absensiStatus !== 'Terlambat') || !hasCompletedLogbook;
  
  // Tombol Masuk aktif HANYA JIKA status 'Belum Absen' ATAU 'Pulang' (untuk memungkinkan double shift)
  const isMasukDisabled = absensiStatus === 'Masuk' || absensiStatus === 'Terlambat';

  type FeatureCardProps = { icon: React.ComponentType<{ size?: number }>, title: string, description: string, href?: string, onClick?: () => void };
  const FeatureCard = ({ icon: Icon, title, description, href, onClick }: FeatureCardProps) => {
    const common = "group flex items-center rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--djkn-gold)] hover:shadow-[0_18px_35px_rgba(250,183,21,0.18)]";
    if (onClick) {
      return (
        <button onClick={onClick} className={`${common} w-full text-left`}>
          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--djkn-gold)]/15 text-[var(--djkn-blue)] shadow-inner"><Icon size={22} /></div>
          <div><h3 className="text-base font-bold text-slate-800">{title}</h3><p className="text-sm text-slate-500">{description}</p></div>
        </button>
      );
    }
    return (
      <a href={href || '#'} className={common}>
        <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--djkn-gold)]/15 text-[var(--djkn-blue)] shadow-inner"><Icon size={22} /></div>
        <div><h3 className="text-base font-bold text-slate-800">{title}</h3><p className="text-sm text-slate-500">{description}</p></div>
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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_30%),linear-gradient(180deg,#f4f7fb_0%,#edf4fc_100%)]">
      <div className="flex flex-col items-center rounded-3xl border border-white/80 bg-white/80 px-8 py-6 shadow-[0_20px_50px_rgba(0,95,172,0.12)] backdrop-blur-sm">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--djkn-blue)]" />
        <p className="mt-4 text-base font-bold text-slate-700">{isLoggingOut ? "Sampai Jumpa..." : "Memuat Dashboard..."}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_28%),linear-gradient(180deg,#f4f7fb_0%,#edf4fc_100%)] font-sans text-slate-800">
      <header className="relative overflow-hidden rounded-b-[32px] bg-[var(--djkn-blue)] p-6 pb-20 text-white shadow-[0_18px_45px_rgba(0,95,172,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,183,21,0.35),transparent_28%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <button
            onClick={() => router.push('/profile')}
            className="flex flex-1 items-center justify-start space-x-3 rounded-2xl border border-white/10 bg-white/5 p-2 pr-3 text-left transition hover:bg-white/10"
            aria-label="Buka profil pengguna"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userData.fullName}
                className="h-12 w-12 rounded-2xl object-cover shadow-lg ring-2 ring-white/30"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--djkn-gold)] text-[var(--djkn-blue)] shadow-lg">
                <User size={24} />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Selamat datang</p>
              <h1 className="mt-1 text-xl font-extrabold">{userData.fullName}</h1>
              <p className="text-sm text-blue-100">{userData.email}</p>
            </div>
          </button>
          <button onClick={handleLogout} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition duration-200 hover:bg-white/20" aria-label="Logout"><LogOut size={22} /></button>
        </div>
      </header>

      <main className="relative z-10 -mt-10 px-5 pb-10">
        <div className="mb-6 rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Status Aktivitas {currentShift ? `(Shift ${currentShift.toUpperCase()})` : ''}
            </h2>
            <span className="rounded-full bg-[var(--djkn-gold)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--djkn-blue)]">
              Real-time
            </span>
          </div>
          <div className="flex items-center justify-between"><StatusBadge status={absensiStatus} /></div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4">
          <button 
            onClick={handleAbsenMasuk} 
            className={`flex items-center justify-center space-x-2 rounded-2xl py-3.5 font-bold shadow-[0_12px_24px_rgba(0,95,172,0.16)] transition duration-300 ${isMasukDisabled ? 'cursor-not-allowed bg-slate-300 text-slate-500 shadow-none' : 'bg-[var(--djkn-blue)] text-white hover:bg-[#004d8a]'}`}
            disabled={isMasukDisabled}
          >
            <ArrowRight size={20} /><span>Absen Masuk</span>
          </button>

          <button 
            onClick={handleAbsenPulang} 
            className={`flex items-center justify-center space-x-2 rounded-2xl py-3.5 font-bold shadow-[0_12px_24px_rgba(2,165,79,0.16)] transition duration-300 ${isPulangDisabled ? 'cursor-not-allowed bg-slate-300 text-slate-500 shadow-none' : 'bg-[var(--djkn-green)] text-white hover:bg-[#029249]'}`}
            disabled={isPulangDisabled}
          >
            <ArrowLeft size={20} /><span>Absen Pulang</span>
          </button>
        </div>

        {(absensiStatus === 'Masuk' || absensiStatus === 'Terlambat') && (
          <div className={`mb-8 rounded-2xl border p-4 shadow-sm ${hasCompletedLogbook ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[var(--djkn-gold)]/40 bg-[var(--djkn-gold)]/10 text-amber-800'}`}>
            <p className="flex items-center justify-center text-center text-sm font-semibold">
              <AlertTriangle size={18} className={`mr-2 ${hasCompletedLogbook ? 'text-emerald-600' : 'text-amber-700'}`} />
              {hasCompletedLogbook 
                ? 'Logbook sudah diisi. Silakan Absen Pulang.' 
                : 'Isi Logbook dulu agar tombol Pulang aktif.'}
            </p>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">Menu Aplikasi</h2>
          <span className="rounded-full border border-[var(--djkn-gold)]/30 bg-[var(--djkn-gold)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--djkn-blue)]">
            Fast Access
          </span>
        </div>

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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm rounded-[26px] bg-white p-6 shadow-[0_25px_60px_rgba(15,23,42,0.18)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800">Pilih Periode</h2>
                <div className="h-3 w-3 rounded-full bg-[var(--djkn-gold)]" />
              </div>

              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="mb-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[var(--djkn-gold)] focus:ring-4 focus:ring-[var(--djkn-gold)]/15"
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
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Batal
                </button>

                <button
                  onClick={handleSubmit}
                  className="rounded-xl bg-[var(--djkn-gold)] px-4 py-2 text-sm font-bold text-slate-900 shadow-[0_10px_25px_rgba(250,183,21,0.35)] transition hover:bg-[#f4bb2d]"
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