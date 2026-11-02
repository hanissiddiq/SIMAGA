# PPNPNBERJAYA

> **Platform Manajemen Kehadiran Modern**  
<p align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

</p>

PPNPNBERJAYA merupakan sistem manajemen kehadiran dan personalia modern yang dikembangkan sebagai bentuk re-engineering dari platform **SmartPPNPN**. Aplikasi ini dirancang untuk menghadirkan performa yang lebih cepat, antarmuka yang intuitif, serta pengelolaan data kehadiran secara **real-time**, aman, dan mudah digunakan.

---

## 🚀 Teknologi Utama

PPNPNBERJAYA dibangun menggunakan teknologi modern untuk memastikan performa, skalabilitas, dan kemudahan pengembangan.

### Front-end
- **Next.js (React Framework)**
  - Rendering cepat
  - Performa optimal
  - Responsive Design
  - SEO Friendly

### Back-end & Database
- **Supabase**
  - PostgreSQL Database
  - Real-time Database
  - Authentication
  - File Storage
  - Row Level Security (RLS)

---

# ✨ Fitur Unggulan

## 📋 Manajemen Kehadiran
- Absensi Masuk
- Absensi Pulang
- Pengajuan Izin
- Riwayat Kehadiran
- Rekapitulasi Absensi

## ⚡ Sinkronisasi Real-Time
- Data tersinkron secara instan menggunakan Supabase Realtime.
- Perubahan data langsung terlihat tanpa perlu memuat ulang halaman.

## 👨‍💼 Dashboard Admin
- Monitoring seluruh data pegawai
- Validasi absensi
- Rekapitulasi kehadiran
- Pengelolaan data pegawai

## 📱 Mobile Friendly
- Tampilan responsif
- Ringan diakses melalui smartphone
- Mendukung berbagai ukuran layar

## 🔐 Keamanan Data
- Autentikasi pengguna
- Enkripsi data
- Row Level Security (RLS)
- Penyimpanan file yang aman

---

# 🛠️ Persyaratan Sistem

Pastikan perangkat telah terpasang:

- Node.js (Versi LTS terbaru)
- npm / yarn / pnpm
- Akun Supabase

---

# 📦 Instalasi

## 1. Clone Repository

```bash
git clone https://github.com/username/PPNPNBERJAYA.git
cd PPNPNBERJAYA
```

---

## 2. Install Dependencies

Menggunakan npm

```bash
npm install
```

atau menggunakan Yarn

```bash
yarn install
```

atau menggunakan pnpm

```bash
pnpm install
```

---

## 3. Konfigurasi Environment

Buat file:

```text
.env.local
```

Isi dengan konfigurasi Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 4. Jalankan Development Server

Menggunakan npm

```bash
npm run dev
```

atau

```bash
yarn dev
```

atau

```bash
pnpm dev
```

Aplikasi akan berjalan pada:

```
http://localhost:3000
```

---

# 📂 Struktur Teknologi

| Teknologi | Kegunaan |
|-----------|----------|
| Next.js | Front-end Framework |
| React | User Interface |
| Supabase | Database & Backend |
| PostgreSQL | Database Engine |
| TypeScript | Type Safety |
| Tailwind CSS | Styling |
| Vercel | Deployment (Opsional) |

---

# 🖼️ Preview Aplikasi

## 👤 Halaman Pegawai

- Dashboard Pegawai
- Absensi Masuk
- Absensi Pulang
- Pengajuan Izin
- Riwayat Kehadiran

> Tambahkan screenshot pada folder `docs/images` lalu ubah bagian berikut:

```md
![Dashboard](docs/images/dashboard-user.png)

![Absensi](docs/images/absensi.png)

![Riwayat](docs/images/riwayat.png)
```
## 👨‍💼 Halaman User
<img width="1348" height="730" alt="image" src="https://github.com/user-attachments/assets/161f46d9-ea73-4519-b497-e48c3896d36b" />
<img width="213" height="465" alt="image" src="https://github.com/user-attachments/assets/35e4edf5-5a1e-4b32-8def-d4736905ac10" /><br>
<img width="219" height="466" alt="image" src="https://github.com/user-attachments/assets/a41cf3d1-a47e-4d64-95cc-ab6b7a9ee896" />
<br>
<img width="581" height="516" alt="image" src="https://github.com/user-attachments/assets/6d4b5840-f144-43ad-8454-66d64fa68b83" />
<br>
<img width="586" height="522" alt="image" src="https://github.com/user-attachments/assets/002f83e9-d3fe-47da-aa02-e5c509de7463" /><br>
<img width="579" height="509" alt="image" src="https://github.com/user-attachments/assets/ceb40e04-05ba-4395-bab3-6b599e60a3d0" /><br>


---

## 👨‍💼 Halaman Admin

- Dashboard Admin
- Manajemen Pegawai
- Verifikasi Kehadiran
- Rekapitulasi Absensi
- Laporan Kehadiran

```md
![Dashboard Admin](docs/images/dashboard-admin.png)

![Rekap](docs/images/rekap.png)

![Pegawai](docs/images/pegawai.png)

```
![Login] <img width="1032" height="694" alt="image" src="https://github.com/user-attachments/assets/791a0cdc-f726-4ee6-87bd-8f83cdee9b0f" /> <br>
![Dashboardadmin] <img width="1017" height="658" alt="image" src="https://github.com/user-attachments/assets/aabe9c7c-61a1-4c85-9598-6da5f4384275" />
 <br>
![approvalcuti] <img width="1349" height="689" alt="image" src="https://github.com/user-attachments/assets/fb1ce567-ec0b-4d2d-982d-52a76ed7950b" />
<br>
![rekapabsensiadmin]<img width="1359" height="693" alt="image" src="https://github.com/user-attachments/assets/448be864-848e-4513-8886-8e2d5f91f003" /><br>
![logbookpegawaiadmin]<img width="1366" height="683" alt="image" src="https://github.com/user-attachments/assets/f757c0ae-d43f-4459-8448-483138d48f6d" />
<br>

---

# 🔒 Keamanan

PPNPNBERJAYA memanfaatkan fitur keamanan dari Supabase, di antaranya:

- Authentication
- JWT Authentication
- Row Level Security (RLS)
- HTTPS Connection
- Enkripsi Data
- Secure File Storage

---

# 📈 Pengembangan Selanjutnya

Beberapa fitur yang direncanakan:

- Notifikasi Real-Time
- Export PDF
- Export Excel
- QR Code Attendance
- GPS Attendance
- Face Recognition
- Dashboard Statistik
- Dark Mode

---

# 🤝 Kontribusi

Kontribusi selalu terbuka.

1. Fork repository
2. Buat branch baru

```bash
git checkout -b feature/nama-fitur
```

3. Commit perubahan

```bash
git commit -m "Menambahkan fitur baru"
```

4. Push branch

```bash
git push origin feature/nama-fitur
```

5. Buat Pull Request

---

# 📄 Lisensi

Project ini menggunakan lisensi **MIT License**.

Silakan menggunakan, memodifikasi, dan mengembangkan proyek sesuai dengan ketentuan lisensi MIT.

---
============================================================================================
================================== Vercel server Gratis ====================================
---

# 🚀 Deploy ke Vercel (Gratis)

PPNPNBERJAYA dapat di-deploy secara gratis menggunakan **Vercel**, platform yang sangat direkomendasikan untuk aplikasi Next.js.

## 1. Push Project ke GitHub

Pastikan project sudah berada di repository GitHub.

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/PPNPNBERJAYA.git
git push -u origin main
```

---

## 2. Buat Akun Vercel

Masuk ke:

https://vercel.com

Login menggunakan akun GitHub.

---

## 3. Import Repository

- Klik **Add New Project**
- Pilih repository **PPNPNBERJAYA**
- Klik **Import**

Vercel akan otomatis mendeteksi bahwa project menggunakan **Next.js**.

---

## 4. Tambahkan Environment Variables

Pada halaman **Project Settings → Environment Variables**, tambahkan:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Pastikan nilainya sama seperti pada file `.env.local`.

---

## 5. Deploy

Klik **Deploy** dan tunggu hingga proses build selesai.

Setelah berhasil, aplikasi akan tersedia di alamat seperti:

```
https://ppnpnberjaya.vercel.app
```

Atau menggunakan domain kustom Anda sendiri.

---

# 🔄 Update Aplikasi

Setiap kali melakukan perubahan kode:

```bash
git add .
git commit -m "Update aplikasi"
git push
```

Vercel akan melakukan **Automatic Deployment** sehingga aplikasi langsung diperbarui tanpa perlu melakukan deploy manual.

---

# 🌍 Domain Kustom (Opsional)

Anda dapat menggunakan domain sendiri.

1. Buka **Project Settings**
2. Pilih **Domains**
3. Tambahkan domain yang dimiliki
4. Atur DNS sesuai petunjuk dari Vercel

Contoh:

```
https://ppnpnberjaya.vercel.app
```

---

# 💰 Paket Gratis

PPNPNBERJAYA dapat berjalan dengan layanan gratis berikut:

| Layanan | Paket |
|----------|--------|
| Vercel | Hobby (Gratis) |
| Supabase | Free Tier |
| GitHub | Free Repository |

Konfigurasi ini sudah cukup untuk kebutuhan pengembangan maupun penggunaan skala kecil hingga menengah.

#Setup Database Pada Supabase
- Dapatkan URL key & Anonkey di setting dan tempelkan pada file ```.env```
- Buka Menu ```SQL Editor``` dan copy semua perintah yang ada pada ```db_replikasi.txt``` kemudian dilanjutakn copy paste ```lanjut.txt```
- Kemudian pastekan juga isi perintah yang ada pada ```functiondll.txt``` kedalam SQL Editor 
# 🙏 Ucapan Terima Kasih

Terima kasih kepada seluruh kontributor dan pihak yang telah mendukung pengembangan **PPNPNBERJAYA**.

Semoga aplikasi ini dapat membantu proses pengelolaan kehadiran pegawai menjadi lebih **cepat**, **efisien**, **aman**, dan **modern**.
