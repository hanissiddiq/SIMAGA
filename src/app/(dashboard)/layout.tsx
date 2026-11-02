"use client";

import Sidebar from "@/components/Sidebar";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

import { toast } from "react-hot-toast";

import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
 const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();
  const useKantor = process.env.NEXT_PUBLIC_KANTOR;

  useEffect(() => {
  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      setChecking(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setRole(data?.role ?? null);
    setChecking(false);
  };

  checkAuth();
}, [router]);

  // ==============================
  // LOGOUT
  // ==============================

  const handleLogout = async () => {

    try {

      toast.loading("Menutup sesi...", {
        id: "logout",
      });

      await supabase.auth.signOut();

      toast.success("Berhasil logout", {
        id: "logout",
      });

      router.replace("/login");

    } catch (err: any) {

      console.error(err);

      toast.error(
        err.message || "Gagal logout",
        {
          id: "logout",
        }
      );
    }
  };
  if (checking) {
     return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin mb-3 h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-600 font-medium">
              Memeriksa sesi login...
            </p>
          </div>
        </div>
      );

  }
  else {
    return (
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-800">
        {/* SIDEBAR */}
        <Sidebar />
        {/* CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          {/* HEADER */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
            {/* TITLE */}
            <div className="text-sm md:text-base font-bold text-slate-700 tracking-wide">
              {useKantor}
            </div>
            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white transition-all duration-200 px-4 py-2 rounded-lg border border-red-200 hover:border-red-500 shadow-sm"
            >
              <LogOut size={18} />
              <span className="text-sm font-semibold">
                Logout
              </span>
            </button>
          </header>
          {/* PAGE */}

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    );
  }
}