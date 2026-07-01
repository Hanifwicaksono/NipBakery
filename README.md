# NipBakery - Bakery Cost Calculator

Aplikasi web PWA (*Progressive Web App*) offline-first modern untuk menghitung Harga Pokok Produksi (HPP) dan Harga Jual produk bakery secara presisi dan dinamis. Aplikasi ini dirancang untuk berjalan di komputer maupun perangkat mobile (seperti iPhone) dengan kemampuan sinkronisasi database lokal.

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
4. **Simulator Harga Jual & Profit**:
   - Menghitung markup keuntungan secara interaktif melalui slider (0% s/d 500%).
   - Mendukung pencarian target harga jual (*back-calculation* ke nilai markup).
   - Klasifikasi margin otomatis dengan indikator warna (Low, Medium, Good, Premium).
5. **Cadangan Data Mandiri (Backup & Restore)**:
   - Ekspor seluruh data proyek ke dalam bentuk berkas `.json`.
   - Impor data cadangan dengan validasi skema data terintegrasi menggunakan Zod (`BackupDataSchema`).
   - Fitur hapus bersih data (*Reset Database*) dengan konfirmasi keamanan.
6. **Offline-First & PWA**:
   - Menyimpan seluruh data secara lokal via Firestore Offline Persistence.
   - Indikator status koneksi (Online/Offline) responsif di bagian header.

---

## 🛠️ Stack Teknologi

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui.
- **State & Data**: TanStack Query, React Hook Form, Zod.
- **Database & Auth**: Firebase Auth (Anonymous Sign-In) & Cloud Firestore (Offline Caching).
- **Perhitungan Biaya**: Decimal.js.
- **PWA**: `vite-plugin-pwa`.

---

## 💻 Cara Menjalankan Secara Lokal

### Prasyarat
- Pastikan Anda sudah menginstal [Node.js](https://nodejs.org/).

### Langkah Pengoperasian
1. Clone repositori ini atau masuk ke direktori proyek:
   ```bash
   cd NipBakery
   ```
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

## ☁️ Panduan Deploy ke Firebase Hosting

Agar aplikasi bisa dipasang (*install*) sebagai aplikasi mandiri di HP, Anda harus men-deploy-nya ke hosting berbasis HTTPS.

1. **Aktifkan Fitur Firebase di Console**:
   - Masuk ke [Firebase Console](https://console.firebase.google.com/).
   - Aktifkan **Authentication** $\rightarrow$ **Sign-in Method** $\rightarrow$ Aktifkan **Anonymous**.
   - Aktifkan **Firestore Database** $\rightarrow$ Buat database baru (Gunakan *Test Mode* saat setup awal).
2. **Koneksikan Project di CLI**:
   - Instal CLI Firebase jika belum ada: `npm install -g firebase-tools`.
   - Jalankan login: `firebase login`.
   - Inisialisasi hosting: `firebase init hosting`.
     - Pilih *Use an existing project*.
     - Set folder publik ke **`dist`**.
     - Pilih **Yes** untuk konfigurasi Single-Page App (SPA).
3. **Build & Deploy**:
   ```bash
   npm run build
   firebase deploy
   ```

---

## 📱 Cara Memasang (Install) Aplikasi di iPhone (iOS)

1. Buka browser **Safari** di iPhone Anda.
2. Akses alamat URL hasil deploy aplikasi Anda (contoh: `https://kuehanip.web.app/`).
3. Ketuk ikon **Bagikan** (*Share* - berbentuk kotak dengan anak panah mengarah ke atas di bagian bawah Safari).
4. Gulir ke bawah dan ketuk opsi **"Add to Home Screen"** (atau **"Tambahkan ke Layar Utama"**).
5. Klik **Add** / **Tambah**. Aplikasi PWA NipBakery kini telah terpasang di layar utama iPhone Anda dengan visual penuh (tanpa bilah navigasi Safari) dan siap dijalankan secara offline!

---

## 🔄 Cara Menyelaraskan (Sync) Data antar Perangkat
Karena Firebase menggunakan login anonim yang menghasilkan ID akun berbeda untuk tiap perangkat:
1. Di **Laptop**: Masuk ke **Pengaturan & Backup**, klik **Ekspor Berkas Backup** untuk mengunduh file `.json`.
2. Kirim file `.json` tersebut ke **iPhone** Anda (via AirDrop, WhatsApp, Email, dll).
3. Di **iPhone**: Buka aplikasi, masuk ke **Pengaturan & Backup**, ketuk **Unggah Berkas Backup**, lalu pilih file `.json` tersebut. Seluruh data resep & bahan baku akan langsung tersinkronisasi sempurna!
