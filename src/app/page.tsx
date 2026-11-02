'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient' // Import Supabase Client
import { Loader2 } from 'lucide-react'

// Durasi minimum splash screen sebelum pengecekan sesi (dalam ms)
const SPLASH_DURATION = 1800; 

export default function SplashPage() {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(true);
    const useKantor = process.env.NEXT_PUBLIC_KANTOR;
    /**
     * Fungsi yang Bertanggung Jawab untuk Mengecek Sesi NYATA Supabase.
     */
    const checkSessionAndRedirect = useCallback(async () => {
        try {
            // Ambil session login
            const { data: { session } } = await supabase.auth.getSession();

            // Jika belum login
            if (!session) {
                router.replace('/login');
                return;
            }

            // Ambil role dari table profiles
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profileError) {
                console.error('Gagal mengambil role:', profileError);
                router.replace('/login');
                return;
            }

            // Normalisasi role
            const role = profile?.role?.toLowerCase();

            // Redirect berdasarkan role
            if (
                role === 'admin' ||
                role === 'kepala_kantor' ||
                role === 'kasubbag'
            ) {
                router.replace('/dashboardadmin');
            } else {
                router.replace('/dashboard');
            }

        } catch (error) {
            console.error("Gagal mengecek sesi Supabase:", error);
            router.replace('/login');
        } finally {
            setIsChecking(false);
        }
    }, [router]);

    useEffect(() => {
        // Tunda eksekusi pengecekan sesi selama SPLASH_DURATION
        const timer = setTimeout(() => {
            checkSessionAndRedirect();
        }, SPLASH_DURATION); 

        // Cleanup function: Hentikan timer jika komponen di-unmount
        return () => clearTimeout(timer);
    }, [checkSessionAndRedirect]);

    // Kita tetap menampilkan Splash UI selama SPLASH_DURATION
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#003366] text-white">
            
            {/* Logo Instansi */}
            <div className="animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            </div>
            
            <h1 className="mt-6 text-3xl font-bold tracking-wider">
                SMART PPNPN 
            </h1>
            <p className="mt-2 text-lg text-white-200" style={{ maxWidth: '400px', textAlign: 'center' }}>
                Sistem Manajemen Akuntabilitas dan Realisasi Kinerja Terintegrasi PPNPN
            </p>
            <p className="mt-2 text-lg text-blue-200">
                {useKantor}
            </p>

            {/* Loading Indicator */}
            <div className="absolute bottom-12 flex items-center space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-white"></div>
            </div>
        </div>
    )
}
