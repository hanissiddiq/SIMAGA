# Refactor Absensi Mahasiswa Magang DJKN

- Jadwal tunggal 07.30–17.00 WIB; kolom `shift` lama tetap diisi `pagi` untuk kompatibilitas skema database.
- Admin dan Kasubbag dapat menghapus akun non-pengelola melalui endpoint terproteksi. Akun admin/kasubbag/kepala_kantor dilindungi.
- Tambahkan `SUPABASE_SERVICE_ROLE_KEY` ke `.env.local` **hanya pada server**; jangan gunakan awalan NEXT_PUBLIC.
- Supabase harus memiliki foreign key `profiles.id` ke `auth.users.id` dengan ON DELETE CASCADE atau mekanisme cleanup yang sesuai. Uji penghapusan pada database staging terlebih dahulu.
- Role `mahasiswa` diterima middleware; periksa RLS Supabase agar mahasiswa memiliki izin yang sama dengan role pegawai untuk fitur absensi/logbook.
- Modul lama terkait lembur, cuti, dan penilaian masih berada di proyek untuk kompatibilitas; belum dimigrasikan seluruhnya.
- Beberapa halaman laporan masih memiliki istilah dan logika shift lama. Perlu audit lanjutan sebelum produksi.
- Penentuan keterlambatan menggunakan 07.30 WIB, checkout tetap mensyaratkan logbook dan minimum empat jam sesuai aturan lama.
