# NipBakery - Bakery Cost Calculator

Aplikasi web PWA (*Progressive Web App*) offline-first modern untuk menghitung Harga Pokok Produksi (HPP) dan Harga Jual produk bakery secara presisi dan dinamis. Aplikasi ini dirancang untuk berjalan di komputer maupun perangkat mobile (seperti iPhone) dengan kemampuan sinkronisasi database lokal dan fitur AI terintegrasi.

---

## 🚀 Fitur Utama

1. **Dashboard Statistik Dinamis**:
   - Menampilkan total bahan baku, total resep, dan rata-rata persentase margin secara waktu nyata.
   - Umpan riwayat harga bahan baku (*Price History Feed*) terbaru.
   - Daftar 3 resep dengan margin keuntungan tertinggi.

2. **Kalkulator HPP Akurat (Decimal.js)**:
   - Penghitungan matematis tanpa pembulatan mengambang (floating-point error) menggunakan `Decimal.js`.
   - Pendeteksi rekursif ketergantungan melingkar (*Circular Dependency* / DFS) untuk mengamankan perhitungan biaya sub-resep.

3. **Master Data Komprehensif**:
   - Manajemen bahan baku, kategori bahan, daftar supplier, dan satuan unit (Berat/Volume/Pcs).
   - Dilengkapi kalkulator yield/konversi bahan dasar secara *live*.

4. **Impor Resep via Screenshot (Gemini 2.5 Flash AI)**:
   - Pindai screenshot resep Anda langsung dari galeri/kamera untuk membuat resep baru secara instan.
   - **Pencocokan Semantik**: Secara otomatis memetakan bahan di screenshot ke bahan Master yang sudah ada di database (contoh: "gula" di screenshot dipetakan ke bahan master "Gula Pasir") guna menghindari duplikasi bahan baku.
   - **Pembuatan Otomatis & Estimasi Harga**: Jika bahan baku dari screenshot benar-benar baru, AI otomatis mengestimasi **harga rata-rata bahan baku tersebut di Indonesia** serta menentukan satuan unit pembeliannya secara akurat (tidak bernilai Rp0).

5. **Konsolidasi Bahan Baku Cerdas (AI Database Cleanup)**:
   - Alat pembersihan satu-kali langsung di halaman Pengaturan.
   - AI akan mendeteksi bahan-bahan yang mirip atau duplikat (misal: "terigu" dan "tepung terigu") untuk digabungkan.
   - Sistem akan menghapus duplikatnya, memperbarui referensi bahan baku di seluruh resep terkait secara aman (mencegah data rusak), dan menyetel harganya ke estimasi rata-rata pasar di Indonesia.

6. **Gambar Thumbnail Resep (Lokal & Offline-ready)**:
   - Pengunggahan foto hasil akhir resep.
   - **Canvas Compression**: Gambar dikompresi di sisi klien (resolusi maks 300px, kualitas 0.7) menjadi data URL Base64 (~10KB).
   - Gambar disimpan langsung di Firestore untuk memastikan foto resep dapat dimuat secara instan dan sepenuhnya offline (tanpa ketergantungan storage eksternal).

7. **Tautan Sumber Video YouTube/TikTok**:
   - Kolom deskripsi resep ditransformasikan menjadi tautan link video sumber YouTube / TikTok.
   - Menampilkan tombol klik tautan *"Tonton Video Sumber"* yang responsif di daftar kartu resep untuk navigasi cepat ke video panduan pembuatan roti.

8. **Simulator Harga Jual & Profit**:
   - Menghitung markup keuntungan secara interaktif melalui slider (0% s/d 500%).
   - Mendukung pencarian target harga jual (*back-calculation* ke nilai markup).
   - Klasifikasi margin otomatis dengan indikator warna (Low, Medium, Good, Premium).

9. **Cadangan Data Mandiri (Backup & Restore)**:
   - Ekspor seluruh data proyek ke dalam bentuk berkas `.json`.
   - Impor data cadangan dengan validasi skema data terintegrasi menggunakan Zod (`BackupDataSchema`).
   - Fitur hapus bersih data (*Reset Database*) dengan konfirmasi keamanan.

10. **Offline-First & PWA**:
    - Menyimpan seluruh data secara lokal via Firestore Offline Persistence.
    - Indikator status koneksi (Online/Offline) responsif di bagian header.

---

## 🛠️ Stack Teknologi

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui.
- **State & Data**: TanStack Query, React Hook Form, Zod, Fuse.js.
- **Database & Auth**: Firebase Auth (Anonymous & Email/Google) & Cloud Firestore (Offline Caching).
- **Inference AI**: Firebase AI SDK (`firebase/ai`) + Google AI Gemini 2.5 Flash API.
- **Perhitungan Biaya**: Decimal.js.
- **PWA**: `vite-plugin-pwa`.

---

## 💻 Cara Menjalankan Secara Lokal

### Prasyarat
- Pastikan Anda sudah menginstal [Node.js](https://nodejs.org/).

### Langkah Pengoperasian
1. Clone repositori ini atau masuk ke direktori proyek.
2. Instal semua dependensi proyek:
   ```bash
   npm install
   ```
3. Buat berkas `.env.local` di folder root dan isi kredensial Firebase Anda (Gunakan contoh format di `.env.example`).
4. Jalankan server pengembangan lokal:
   - Di Command Prompt / Bash:
     ```bash
     npm run dev
     ```
   - Di Windows PowerShell (jika terhambat Execution Policy):
     ```powershell
     npm.cmd run dev
     ```
5. Buka `http://localhost:5173` di browser Anda.

---

## ☁️ Panduan Deploy ke Firebase Hosting & Setup AI

### 1. Inisialisasi Firebase AI Logic
Agar fitur pemindaian AI Gemini aktif, inisialisasi AI logic di CLI Firebase:
```bash
npx -y firebase-tools@latest init ailogic
```
Pilih proyek Firebase Anda, ini akan otomatis mengaktifkan backend Gemini Developer API di Firebase Console Anda.

### 2. Aktifkan Fitur Firebase di Console
- Masuk ke [Firebase Console](https://console.firebase.google.com/).
- Aktifkan **Authentication** $\rightarrow$ **Sign-in Method** $\rightarrow$ Aktifkan **Anonymous & Google/Email**.
- Aktifkan **Firestore Database** $\rightarrow$ Buat database baru (Gunakan *Test Mode* saat setup awal).
- Masuk menu **Build -> GenAI** lalu klik **Get started** untuk mengaktifkan izin panggilan model Gemini Developer API.

### 3. Build & Deploy
```bash
npm run build
npx firebase deploy --only hosting
```

---

## 📱 Cara Memasang (Install) Aplikasi di iPhone (iOS)

1. Buka browser **Safari** di iPhone Anda.
2. Akses alamat URL hasil deploy aplikasi Anda (contoh: `https://kuehanip.web.app/`).
3. Ketuk ikon **Bagikan** (*Share* - berbentuk kotak dengan anak panah mengarah ke atas di bagian bawah Safari).
4. Gulir ke bawah dan ketuk opsi **"Add to Home Screen"** (atau **"Tambahkan ke Layar Utama"**).
5. Klik **Add** / **Tambah**. Aplikasi PWA NipBakery kini telah terpasang di layar utama iPhone Anda dan siap dijalankan secara offline!
