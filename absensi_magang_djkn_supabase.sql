-- ============================================================
-- ABSENSI MAHASISWA MAGANG DJKN - MIGRASI SUPABASE
-- Zona waktu aplikasi: Asia/Jakarta (WIB)
-- Jalankan di Supabase SQL Editor setelah backup database.
-- Script ini bersifat additive dan tidak menghapus tabel/data lama.
-- ============================================================

begin;

-- 1) Konfigurasi jadwal tunggal. Aplikasi dapat membaca tabel ini
--    untuk menampilkan jam kerja tanpa menyimpan pilihan shift.
create table if not exists public.attendance_settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'Asia/Jakarta',
  check_in_time time not null default time '07:30',
  check_out_time time not null default time '17:00',
  shift_name text not null default 'Reguler',
  updated_at timestamptz not null default now()
);

insert into public.attendance_settings
  (id, timezone, check_in_time, check_out_time, shift_name)
values
  (1, 'Asia/Jakarta', time '07:30', time '17:00', 'Reguler')
on conflict (id) do update set
  timezone = excluded.timezone,
  check_in_time = excluded.check_in_time,
  check_out_time = excluded.check_out_time,
  shift_name = excluded.shift_name,
  updated_at = now();

alter table public.attendance_settings enable row level security;
drop policy if exists "attendance_settings_read_authenticated" on public.attendance_settings;
create policy "attendance_settings_read_authenticated"
  on public.attendance_settings for select to authenticated using (true);

-- Hanya service_role yang boleh mengubah konfigurasi jadwal.
-- Jangan berikan INSERT/UPDATE/DELETE kepada authenticated.

-- 2) Fungsi helper untuk pengecekan role pengelola.
-- SECURITY DEFINER + search_path tetap mencegah manipulasi search_path.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(coalesce(p.role, ''))
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

create or replace function public.is_absensi_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_profile_role() in ('admin', 'kasubbag');
$$;

revoke all on function public.is_absensi_manager() from public;
grant execute on function public.is_absensi_manager() to authenticated;

-- 3) Index untuk mempercepat pencarian absensi dan logbook.
--    Index ini TIDAK memaksa satu baris absensi per hari karena
--    data lama mungkin masih memiliki dua shift.
do $$
begin
  if to_regclass('public.attendances') is not null then
    execute 'create index if not exists idx_attendances_user_date on public.attendances (user_id, attendance_date)';
  end if;
  if to_regclass('public.logbooks') is not null then
    execute 'create index if not exists idx_logbooks_user_date on public.logbooks (user_id, log_date)';
  end if;
end $$;

commit;

-- ============================================================
-- 4) PENYESUAIAN ROLE (JALANKAN MANUAL SETELAH DITINJAU)
-- ============================================================
-- Jangan otomatis mengubah seluruh role 'pegawai' menjadi 'mahasiswa'
-- jika tabel profiles masih berisi pegawai kantor.
-- Setelah memastikan akun yang dimaksud memang mahasiswa magang:
--
-- update public.profiles
-- set role = 'mahasiswa'
-- where id = 'UUID_MAHASISWA';
--
-- Role yang digunakan aplikasi hasil refactor:
--   admin, kasubbag, mahasiswa
-- Role kepala_kantor tidak dihapus dari database lama, tetapi
-- endpoint penghapusan akun melindungi role tersebut.

-- ============================================================
-- 5) PENYESUAIAN SHIFT DATA LAMA (OPSIONAL)
-- ============================================================
-- Kode kompatibilitas masih membaca kolom shift dan mengisi 'pagi'.
-- Untuk riwayat lama, sebaiknya JANGAN ubah data historis.
-- Jika Anda memang ingin menormalkan semua record lama:
--
-- update public.attendances set shift = 'pagi'
-- where lower(coalesce(shift, '')) in ('malam', 'night');
--
-- update public.logbooks set shift = 'pagi'
-- where lower(coalesce(shift, '')) in ('malam', 'night');
--
-- Pastikan kolom shift memang ada sebelum menjalankan query opsional.

-- ============================================================
-- 6) RELASI PROFILES -> AUTH.USERS UNTUK PENGHAPUSAN AKUN
-- ============================================================
-- API aplikasi menghapus akun melalui supabase.auth.admin.deleteUser().
-- Idealnya profiles.id memiliki FK ke auth.users(id) ON DELETE CASCADE.
-- Periksa dahulu constraint yang sudah ada agar tidak membuat FK ganda:
--
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.profiles'::regclass and contype = 'f';
--
-- Jika belum ada FK yang sesuai, dan profiles.id bertipe uuid serta
-- semua profile memiliki auth.users yang valid, jalankan:
-- alter table public.profiles
--   add constraint profiles_id_fkey
--   foreign key (id) references auth.users(id) on delete cascade;
--
-- Periksa juga foreign key tabel turunan (attendances, logbooks, tasks)
-- dan gunakan ON DELETE CASCADE hanya jika memang ingin data aktivitas
-- mahasiswa ikut terhapus saat akun dihapus. Pertimbangkan arsip/audit.

-- ============================================================
-- 7) PEMERIKSAAN STRUKTUR YANG DIPAKAI APLIKASI
-- ============================================================
-- Jalankan query berikut untuk memastikan tabel dan kolom tersedia:
--
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('profiles','attendances','logbooks','tasks')
-- order by table_name, ordinal_position;
--
-- Kebijakan RLS tabel lama tidak diubah otomatis oleh script ini.
-- Audit policy yang sudah ada sebelum menambah policy baru karena
-- policy permissive PostgreSQL digabung dengan OR.
