# Product Requirements Document (PRD)
# Website Point Project — HMIF Institut Teknologi Sumatera

**Versi Dokumen:** 1.0
**Tanggal:** 10 Juli 2026
**Disusun untuk:** Divisi Acara, Divisi Operator, dan Divisi Publikasi & Dokumentasi Point Project

---

## 1. Latar Belakang

Point Project adalah kompetisi UI/UX Design tahunan yang diselenggarakan oleh Himpunan Mahasiswa Informatika (HMIF) Institut Teknologi Sumatera, terbuka untuk dua kategori peserta: siswa/i SMA/SMK dan mahasiswa/i tingkat nasional. Pada penyelenggaraan Point Project 4.0, tema yang diusung adalah *"Merancang Ekosistem Masa Depan yang Cerdas, Inklusif, dan Berkelanjutan."*

Saat ini proses pendaftaran, pengumpulan karya, penilaian, hingga pengumuman pemenang berpotensi masih dilakukan secara manual (formulir online terpisah, Zoom, dokumen tersebar). Karena Point Project akan terus diadakan setiap tahun, dibutuhkan sebuah **website terpusat** yang dapat:

- Menjadi kanal resmi informasi & pendaftaran kompetisi.
- Menyimpan seluruh data peserta, panitia, dan detail acara secara terstruktur.
- Menampilkan pengumuman finalis dan pemenang secara publik.
- Dapat dipakai berulang setiap tahun tanpa kehilangan data historis (arsip multi-tahun).

## 2. Tujuan Produk

1. Menyediakan satu platform digital resmi untuk seluruh siklus kompetisi Point Project (informasi → registrasi → submission karya → penilaian → pengumuman).
2. Mempermudah panitia dalam mengelola data peserta, jadwal, dan hasil lomba melalui panel admin.
3. Menyimpan data kegiatan secara historis per tahun/angkatan, sehingga Point Project 5.0, 6.0, dst. dapat menggunakan sistem yang sama tanpa menimpa data tahun sebelumnya.
4. Meningkatkan kredibilitas dan profesionalisme acara di mata peserta nasional.

## 3. Target Pengguna & Role

| Role | Deskripsi |
|---|---|
| **Pengunjung Publik** | Calon peserta/masyarakat umum yang melihat info acara, timeline, syarat & ketentuan, serta hasil pemenang. |
| **Peserta (Tim)** | Siswa/i atau mahasiswa/i yang mendaftar sebagai tim, mengunggah proposal & link prototype, memantau status submission dan hasil. |
| **Juri (opsional)** | Dapat login untuk melihat dan menilai karya yang masuk (jika dibutuhkan sistem penilaian digital). |
| **Admin/Panitia** | Mengelola seluruh data master: peserta, panitia, jadwal acara, kategori lomba, dan pengumuman — untuk setiap periode/tahun penyelenggaraan. |
| **Super Admin** | Admin dengan akses penuh, termasuk mengelola akun admin lain dan membuka "tahun/periode acara" baru. |

## 4. Ruang Lingkup (Scope)

### 4.1 Sisi Publik (tanpa login)
- Landing page: nama kegiatan, tema, deskripsi, sasaran peserta.
- Halaman timeline/jadwal kegiatan (registrasi, batch, penilaian, final).
- Halaman syarat & ketentuan serta kategori lomba (Siswa vs Mahasiswa).
- Halaman kepanitiaan (opsional, dapat ditampilkan per tahun).
- Halaman pengumuman finalis & pemenang (per tahun, dapat difilter berdasarkan periode Point Project).
- Galeri karya terbaik (opsional, terhubung dengan publikasi Instagram).
- Kontak/FAQ.

### 4.2 Sisi Peserta (butuh akun/registrasi)
- Form pendaftaran tim (Batch 1 & Batch 2), termasuk:
  - Data ketua & anggota tim
  - Kategori (Siswa/Mahasiswa)
  - Asal sekolah/kampus
  - Unggah/link proposal
  - Unggah/link prototype
- Dashboard peserta: status pendaftaran (terverifikasi/pending), status submission, pengumuman lolos finalis.
- Upload berkas tahap final (PPT, Laporan Akhir, Link Prototype, Poster) sesuai jadwal.
- Notifikasi/email otomatis saat status berubah (opsional — lihat 4.5).

### 4.3 Sisi Admin (Panel Admin)
- **Manajemen Acara/Tahun**: membuat "periode/tahun acara" baru (misalnya Point Project 5.0), mengatur tema, timeline, dan kategori lomba tanpa menghapus data tahun sebelumnya.
- **Manajemen Peserta**: melihat, memverifikasi, mengekspor (Excel/CSV), dan mengarsipkan data peserta per batch & per tahun.
- **Manajemen Panitia**: menyimpan struktur kepanitiaan per tahun (penanggung jawab, ketua pelaksana, kepala divisi, dst.) sesuai Tabel 2.2 pada proposal.
- **Manajemen Jadwal**: input/edit jadwal kegiatan (registrasi, pengumpulan karya, penilaian juri, technical meeting, final).
- **Manajemen Submission & Penilaian**: melihat seluruh karya yang masuk, memberi status lolos finalis, mengunggah hasil pemenang.
- **Manajemen Pengumuman**: publish pengumuman finalis/pemenang yang otomatis tampil di halaman publik.
- **Manajemen Pengguna Admin**: super admin dapat menambah/menghapus akun admin per divisi.
- **Riwayat/Arsip**: seluruh data di atas dapat difilter berdasarkan tahun penyelenggaraan (contoh: Point Project 3.0, 4.0, 5.0, dst.).

### 4.4 Di Luar Cakupan (Out of Scope) — versi awal
- Sistem pembayaran/payment gateway (jika kompetisi berbayar, dibahas terpisah).
- Live streaming acara final.
- Sistem chat real-time antara peserta dan panitia.

### 4.5 Fitur Opsional (Nice to Have)
- Notifikasi email otomatis (status pendaftaran, reminder deadline).
- Sistem penilaian juri digital dengan rubrik skor.
- Integrasi otomatis ke Instagram untuk publikasi karya pemenang.

## 5. Data Model (Entitas Utama)

Agar data setiap tahun tersimpan rapi dan tidak tercampur, seluruh entitas berikut sebaiknya terhubung ke entitas **Event/Periode**.

| Entitas | Atribut Utama |
|---|---|
| **Event/Periode** | id, nama (Point Project 4.0), tema, tahun, tanggal mulai-selesai, status (aktif/arsip) |
| **Kategori Lomba** | id, event_id, nama kategori (Siswa/Mahasiswa) |
| **Panitia** | id, event_id, nama, NIM/NIP, jabatan, divisi |
| **Peserta/Tim** | id, event_id, kategori_id, nama tim, batch (1/2), nama ketua & anggota, asal instansi, kontak, status verifikasi |
| **Submission/Karya** | id, tim_id, tahap (awal/final), link proposal, link prototype, file PPT/laporan/poster, tanggal submit |
| **Penilaian** (opsional) | id, submission_id, juri_id, skor, catatan |
| **Pengumuman** | id, event_id, jenis (finalis/pemenang), judul, isi, tanggal publish |
| **Akun Admin** | id, nama, email, role (admin/super admin), divisi |

## 6. Alur Pengguna (User Flow) Ringkas

**Peserta:**
1. Buka website → baca info & timeline → klik "Daftar".
2. Isi form pendaftaran tim sesuai batch aktif → submit.
3. Terima info verifikasi (email/dashboard).
4. Login ke dashboard → unggah proposal & link prototype sesuai tenggat batch.
5. Menunggu pengumuman finalis di dashboard/website.
6. Jika lolos → unggah berkas tahap final (PPT, laporan, poster, prototype final).
7. Melihat pengumuman pemenang di website.

**Admin:**
1. Login ke panel admin.
2. Pilih/buat periode "Point Project X.0" yang sedang aktif.
3. Atur timeline, kategori, dan data panitia.
4. Pantau & verifikasi peserta yang mendaftar per batch.
5. Rekap submission karya, distribusikan ke juri (jika ada fitur penilaian).
6. Publish pengumuman finalis lalu pemenang.
7. Ekspor seluruh data untuk laporan akhir & arsip.

## 7. Kebutuhan Non-Fungsional

- **Keamanan**: autentikasi admin & peserta, hak akses berbeda per role, proteksi upload file (validasi tipe & ukuran file).
- **Skalabilitas Data**: struktur database mendukung banyak "periode acara" tanpa migrasi ulang tiap tahun.
- **Responsif**: dapat diakses baik dari desktop maupun mobile, mengingat peserta berasal dari berbagai daerah.
- **Performa**: halaman publik (landing, pengumuman) harus cepat diakses meski traffic tinggi saat pengumuman pemenang.
- **Ketersediaan**: uptime tinggi terutama pada periode pendaftaran dan pengumuman.
- **Kemudahan Penggunaan**: form pendaftaran dan dashboard peserta harus sederhana, mengingat sebagian peserta adalah siswa SMA/SMK.

## 8. Kriteria Keberhasilan (Success Metrics)

- Website mampu menampung pendaftaran ≥10 tim per batch sesuai tolok ukur keberhasilan acara.
- 100% data peserta, panitia, dan hasil lomba tersimpan rapi dan dapat diarsipkan per tahun.
- Panitia dapat mengelola seluruh siklus acara (dari buka pendaftaran hingga pengumuman pemenang) tanpa bantuan developer setiap tahunnya.
- Halaman pengumuman pemenang dapat diakses publik tanpa gangguan performa.

## 9. Rekomendasi Teknologi (Opsional — dapat disesuaikan tim dev)

- **Frontend**: React/Next.js, tailwindcss sesuai kapasitas tim.
- **Backend**: Golang, dengan REST API.
- **Database**: PostgreSQL NeonDB melalui environment variable `DATABASE_URL`, dirancang dengan tabel `events` sebagai induk relasi ke seluruh entitas lain agar data per tahun terpisah rapi.
- **Storage File**: Cloudflare R2 Object untuk file proposal, poster, laporan.
- **Autentikasi**: JWT/session-based login dengan role-based access control (RBAC).
- **Hosting**: Vercel(frontend) + Coolify (backend).

## 10. Struktur Halaman Website (Sitemap)

```
Beranda
├── Tentang Point Project (tema, tujuan, sasaran)
├── Timeline & Jadwal
├── Kategori & Syarat Lomba
├── Kepanitiaan
├── Pendaftaran (form, login peserta)
│   └── Dashboard Peserta
│       ├── Status Pendaftaran
│       ├── Upload Karya
│       └── Pengumuman
├── Pengumuman Finalis & Pemenang (arsip per tahun)
├── Galeri Karya
├── FAQ/Kontak
└── Admin Panel (login khusus)
    ├── Manajemen Event/Periode
    ├── Manajemen Peserta
    ├── Manajemen Panitia
    ├── Manajemen Jadwal
    ├── Manajemen Submission & Penilaian
    ├── Manajemen Pengumuman
    └── Manajemen Akun Admin
```

---

# Lampiran: Prompt untuk Membuat Desain UI/UX

Prompt di bawah ini dapat digunakan pada tools AI design (misalnya Figma AI, Uizard, Galileo AI, v0, atau Claude/ChatGPT untuk brainstorming wireframe) untuk menghasilkan desain UI/UX website Point Project.

```
Saya ingin mendesain UI/UX untuk sebuah website kompetisi UI/UX Design bernama
"Point Project 4.0", diselenggarakan oleh Himpunan Mahasiswa Informatika (HMIF)
Institut Teknologi Sumatera. Tema kompetisi tahun ini adalah "Merancang Ekosistem
Masa Depan yang Cerdas, Inklusif, dan Berkelanjutan" — nuansa desain sebaiknya
terasa modern, techy, futuristik, namun tetap ramah dan mudah dipahami oleh
audiens muda (siswa SMA/SMK hingga mahasiswa).

Buatkan desain untuk halaman-halaman berikut, lengkap dengan komponen UI, tata
letak (layout), dan alur antar halaman:

1. Landing Page
   - Hero section dengan judul "Point Project 4.0", tagline tema kegiatan,
     dan tombol CTA "Daftar Sekarang"
   - Section "Tentang Kegiatan" (tujuan & sasaran)
   - Section "Timeline/Jadwal" dalam bentuk stepper/timeline visual
   - Section "Kategori Lomba" (Siswa/Mahasiswa) dalam bentuk card
   - Section "Kepanitiaan"
   - Footer dengan kontak & sosial media

2. Halaman Pendaftaran
   - Form multi-step: Data Tim → Data Anggota → Kategori → Upload
     Proposal/Prototype
   - Progress indicator antar step
   - Validasi input yang jelas (error state)

3. Dashboard Peserta
   - Kartu status pendaftaran (pending/verified)
   - Tombol upload karya sesuai tahap (awal/final)
   - Notifikasi pengumuman

4. Halaman Pengumuman Finalis & Pemenang
   - Tampilan publik, dapat difilter berdasarkan tahun/periode Point Project
   - Highlight juara 1-3 dengan visual menonjol (badge/medali)
   - Galeri karya pemenang

5. Admin Panel/Dashboard
   - Sidebar navigasi: Event, Peserta, Panitia, Jadwal, Submission, Pengumuman,
     Akun Admin
   - Tabel data peserta dengan fitur search, filter per batch/tahun, dan
     export
   - Form untuk membuat "periode acara baru" (misalnya Point Project 5.0)
     tanpa menghapus data tahun sebelumnya
   - Statistik ringkas (jumlah pendaftar, submission masuk, dsb.) dalam
     bentuk card/chart

Gaya visual: gunakan palet warna modern (bisa kombinasi biru tua/navy atau
ungu dengan aksen warna cerah sebagai penanda "inovasi" dan "teknologi"),
tipografi sans-serif yang bersih, serta ikon-ikon flat/line yang konsisten.
Pastikan desain responsif untuk mobile dan desktop, serta ramah aksesibilitas
(kontras warna cukup, ukuran font terbaca).

Output yang diinginkan: wireframe/mockup tiap halaman di atas beserta
penjelasan singkat komponen dan alur interaksinya.
```

---

*Dokumen ini dapat disesuaikan lebih lanjut bersama tim developer dan desainer sebelum masuk tahap implementasi.*
