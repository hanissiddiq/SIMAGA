"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { 
  Menu, 
  LayoutDashboard, 
  Users, 
  ClipboardCheck, 
  BadgeCheck, 
  FileSpreadsheet, 
  FileClock,
  UserSearch,
  BookOpenCheck,
  KeyRound,
  CalendarPlus,
  ChevronLeft 
} from "lucide-react"; 

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [role, setRole] = useState<string>('');
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
          setLoadingRole(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setRole(data?.role?.toLowerCase() || '');
      } catch (err) {
        console.error('Gagal mengambil role:', err);
      } finally {
        setLoadingRole(false);
      }
    };

    fetchRole();
  }, []);

  // Fungsi untuk Generate Kuota via Popup
  const handleGenerateQuota = async () => {
    const inputYear = window.prompt("Masukkan Tahun untuk Generate Kuota (Contoh: 2026):", String(new Date().getFullYear() + 1));
    
    if (!inputYear) return; 

    const targetYear = parseInt(inputYear);
    if (isNaN(targetYear) || targetYear < 2024) {
      toast.error("Tahun tidak valid!");
      return;
    }

    const confirm = window.confirm(
      `KONFIRMASI MANUAL:\nAnda akan membuat kuota cuti (12 hari) untuk SELURUH PEGAWAI di tahun ${targetYear}.\nLanjutkan?`
    );
    
    if (!confirm) return;

    try {
      toast.loading("Memproses data...", { id: 'quota-toast' });
      const { data, error } = await supabase.rpc('generate_annual_quota', { 
        target_year: targetYear 
      });

      if (error) throw error;
      toast.success(data || `Berhasil generate kuota tahun ${targetYear}`, { id: 'quota-toast' });
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal: ' + err.message, { id: 'quota-toast' });
    }
  };

  return (
    <aside 
      className={`${
        isOpen ? "w-64" : "w-20"
      } bg-[var(--djkn-gold)] text-black transition-all duration-300 ease-in-out flex flex-col relative z-20 h-screen`}
    >
      {/* Tombol Toggle Buka/Tutup */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-6 bg-white text-[var(--djkn-gold)] rounded-full p-1.5 shadow-md border border-slate-200 hover:bg-[var(--djkn-gold)]/20 z-50"
      >
        {isOpen ? <ChevronLeft size={18} strokeWidth={2.5} /> : <Menu size={18} strokeWidth={2.5} />}
      </button>

      {/* Logo / Header Sidebar */}
      <div className="h-20 flex items-center justify-center border-b border-[var(--djkn-gold)] shrink-0">
        <h1 className={`font-extrabold tracking-wide transition-all duration-300 ${isOpen ? "text-xl" : "text-sm"}`}>
          {isOpen ? "SIMAGA" : "SM"}
        </h1>
      </div>

      {/* Daftar Menu (Bisa di-scroll jika menu terlalu banyak) */}
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1.5 custom-scrollbar">
        
        {/* --- MENU OPERASIONAL --- */}
        <Link href="/dashboardadmin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group">
          <LayoutDashboard size={22} className="min-w-max text-blue-200 group-hover:text-white" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Dashboard</span>
        </Link>
        
        <Link href="/datapegawai" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group">
          <Users size={22} className="min-w-max text-blue-200 group-hover:text-white" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Data User</span>
        </Link>

        {!loadingRole && role !== 'admin' && (
            <Link
              href="/approvalcuti"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group"
            >
              <ClipboardCheck
                size={22}
                className="min-w-max text-blue-200 group-hover:text-white"
              />
              <span
                className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}
              >
                Approval Cuti
              </span>
            </Link>
          )}

        {!loadingRole && role !== 'admin' && (
          <Link
            href="/approvalizin"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group"
          >
            <BadgeCheck
              size={22}
              className="min-w-max text-blue-200 group-hover:text-white"
            />
            <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>
              Approval Izin
            </span>
          </Link>
        )}

        <Link href="/rekapabsensiadmin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group">
          <FileSpreadsheet size={22} className="min-w-max text-blue-200 group-hover:text-white" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Rekap Absensi Matrix</span>
        </Link>

        <Link href="/rekaplemburadmin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group">
          <FileClock size={22} className="min-w-max text-blue-200 group-hover:text-white" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Rekap Lembur Matrix</span>
        </Link>

        <Link href="/detailabsensipegawai" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group">
          <UserSearch size={22} className="min-w-max text-blue-200 group-hover:text-white" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Detail Absensi Individu</span>
        </Link>

        <Link href="/logbookpegawaiadmin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group">
          <BookOpenCheck size={22} className="min-w-max text-blue-200 group-hover:text-white" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Logbook Mahasiswa</span>
        </Link>

        {/* --- DATA PENILAIAN --- */}
        <div
          className={`mt-4 mb-2 border-t border-blue-700/50 pt-4 ${
            !isOpen ? "text-center" : "px-3"
          }`}
        >
          <span
            className={`text-xs font-bold text-blue-300 uppercase tracking-wider ${
              !isOpen && "hidden"
            }`}
          >
            Data Penilaian
          </span>

          {!isOpen && (
            <span className="text-blue-400 text-xs tracking-widest">
              •••
            </span>
          )}
        </div>

        {/* Perilaku */}
        
        {!loadingRole && role !== 'admin' && (
          <Link
          href="/nilaiperilaku"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group"
        >
          <BookOpenCheck
            size={22}
            className="min-w-max text-green-300 group-hover:text-white"
          />
          <span
            className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}
          >
            Perilaku
          </span>
        </Link>
        )}

        {/* Survei Kepuasan */}
        <Link
          href="/survei"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group"
        >
          <ClipboardCheck
            size={22}
            className="min-w-max text-green-300 group-hover:text-white"
          />
          <span
            className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}
          >
            Survei Kepuasan
          </span>
        </Link>

        {/* Temuan KI */}
        <Link
          href="/rekomendasi"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group"
        >
          <BadgeCheck
            size={22}
            className="min-w-max text-green-300 group-hover:text-white"
          />
          <span
            className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}
          >
            Rekomendasi KI
          </span>
        </Link>

         <Link
          href="/raporkinerja"
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group"
        >
          <BookOpenCheck
            size={22}
            className="min-w-max text-green-300 group-hover:text-white"
          />
          <span
            className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}
          >
            Rapor Kinerja
          </span>
        </Link>

        {/* --- DIVIDER PENGATURAN SISTEM --- */}
        <div className={`mt-4 mb-2 border-t border-blue-700/50 pt-4 ${!isOpen ? "text-center" : "px-3"}`}>
          <span className={`text-xs font-bold text-blue-300 uppercase tracking-wider ${!isOpen && "hidden"}`}>
            Pengaturan Sistem
          </span>
          {!isOpen && <span className="text-blue-400 text-xs tracking-widest">•••</span>}
        </div>

        {/* --- MENU PENGATURAN --- */}
        <Link href="/changepassword" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group">
          <KeyRound size={22} className="min-w-max text-yellow-400 group-hover:text-yellow-300" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Ganti Password</span>
        </Link>

        {/* Tombol Action (Bukan Link) */}
        <button 
          onClick={handleGenerateQuota}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800/80 transition-colors group w-full text-left"
        >
          <CalendarPlus size={22} className="min-w-max text-yellow-400 group-hover:text-yellow-300" />
          <span className={`${!isOpen && "hidden"} text-sm font-medium whitespace-nowrap`}>Generate Kuota Cuti</span>
        </button>

      </div>
    </aside>
  );
}