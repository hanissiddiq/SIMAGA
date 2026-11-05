'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Save, UserRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [avatarColumnReady, setAvatarColumnReady] = useState(false);

  const initials = useMemo(() => {
    const name = fullName?.trim() || 'User';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'U';
  }, [fullName]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (data) {
          setFullName(data.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '');
        }

        let supportsAvatar = false;
        let avatarFromDb = '';

        try {
          const { data: avatarData, error: avatarError } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .maybeSingle();

          supportsAvatar = !avatarError;
          avatarFromDb = avatarData?.avatar_url || '';
        } catch {
          supportsAvatar = false;
        }

        setAvatarColumnReady(supportsAvatar);

        const localAvatar = localStorage.getItem('profile_avatar_url') || '';
        const nextAvatar = avatarFromDb || localAvatar;

        if (nextAvatar) {
          setAvatarUrl(nextAvatar);
        }

        if (error && !supportsAvatar) {
          console.warn('Profile data loaded without avatar column support', error);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatar-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatar-photos')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      setAvatarUrl(publicUrl);
      localStorage.setItem('profile_avatar_url', publicUrl);
      setMessage('Foto avatar berhasil diunggah.');
    } catch (error) {
      console.error('Upload avatar gagal:', error);
      setMessage('Upload foto avatar gagal. Pastikan bucket avatar-photos sudah tersedia di Supabase.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const payload: { full_name: string; avatar_url?: string | null } = {
        full_name: fullName.trim() || 'Pengguna'
      };

      const updatedAvatar = avatarUrl.trim();
      if (avatarColumnReady) {
        payload.avatar_url = updatedAvatar || null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (error) {
        console.error('Update profile gagal:', error);
        if (updatedAvatar) {
          localStorage.setItem('profile_avatar_url', updatedAvatar);
        } else {
          localStorage.removeItem('profile_avatar_url');
        }
        localStorage.setItem('profile_full_name', fullName.trim() || 'Pengguna');
        setMessage('Data berhasil disimpan lokal, tetapi kolom avatar belum tersedia di database.');
      } else {
        if (updatedAvatar) {
          localStorage.setItem('profile_avatar_url', updatedAvatar);
        } else {
          localStorage.removeItem('profile_avatar_url');
        }
        localStorage.setItem('profile_full_name', fullName.trim() || 'Pengguna');
        setMessage('Profil berhasil diperbarui!');
      }

      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } catch (error) {
      console.error(error);
      setMessage('Terjadi kesalahan saat menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_28%),linear-gradient(180deg,#f4f7fb_0%,#edf4fc_100%)]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 px-7 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-700">Memuat profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,183,21,0.18),transparent_28%),linear-gradient(180deg,#f4f7fb_0%,#edf4fc_100%)] p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>
          <div className="rounded-full border border-[var(--djkn-gold)]/30 bg-[var(--djkn-gold)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--djkn-blue)]">
            Profil User
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="bg-[var(--djkn-blue)] px-6 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Pengaturan profil</p>
            <h1 className="mt-2 text-2xl font-extrabold">Edit Data Pribadi</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6 md:p-8">
            <div className="flex flex-col items-center gap-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:flex-row md:items-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar profil" className="h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-lg" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--djkn-blue)] text-2xl font-black text-white shadow-lg">
                  {initials}
                </div>
              )}

              <div className="flex-1">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Foto Avatar</label>
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 shadow-sm transition focus-within:border-[var(--djkn-gold)] focus-within:ring-4 focus-within:ring-[var(--djkn-gold)]/15">
                  <Camera size={18} className="text-slate-400" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="w-full cursor-pointer text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--djkn-gold)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-900"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {uploadingAvatar ? 'Mengunggah foto avatar...' : 'Format JPG, PNG, atau WebP. Ukuran ideal 1:1.'}
                </p>
              </div>
            </div>

            {/* <div>
              <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-slate-700">
                Nama Lengkap
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm transition focus-within:border-[var(--djkn-gold)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[var(--djkn-gold)]/15">
                <UserRound size={18} className="text-slate-400" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div> */}

            {message && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={18} />
                {message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--djkn-gold)] px-5 py-3 text-sm font-bold text-slate-900 shadow-[0_10px_25px_rgba(250,183,21,0.32)] transition hover:bg-[#f5bb2b] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save size={16} />
                {saving ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
