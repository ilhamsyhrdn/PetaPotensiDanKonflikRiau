# Dashboard Potensi Ekonomi & Peta Konflik (prototipe)

WebGIS untuk Studi Social Intelligence Mapping (SIM) wilayah PHR, Riau. Cakupan seluruh Provinsi Riau
(12 kabupaten/kota, 170 kecamatan, 1.873 desa/kelurahan) dengan data dari sumber terbuka.

## Menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000 lalu masuk dengan akun demo:

| Username | Password | Peran |
|---|---|---|
| admin | admin123 | Semua akses, termasuk memuat ulang data sumber |
| editor | editor123 | Tambah, ubah, hapus data |
| viewer | viewer123 | Hanya melihat |

Butuh koneksi internet untuk citra satelit, peta jalan, dan font label peta.

## Halaman

| Halaman | Isi |
|---|---|
| Dashboard `/` | Angka kunci, peta ringkas (konflik/potensi), tren berita mingguan, tabel 12 kabupaten/kota, sektor & status konflik, berita terbaru |
| Peta Konflik `/peta/konflik` | Titik konflik berwarna menurut sektor, filter sektor/status/tahun/asal data, kepadatan per wilayah, klik titik → detail |
| Peta Potensi Ekonomi `/peta/potensi` | Titik potensi menurut lapangan usaha BPS (KBLI), filter kategori, kepadatan per wilayah |
| Detail `/konflik/[id]`, `/potensi/[id]` | Format "data detil" ala TanahKita: mini peta, atribut, keterlibatan, narasi, sumber, lampiran, data sekitar |
| Berita `/berita`, `/berita/[id]` | Daftar berita dengan pencarian, filter, halaman; detail dengan analisis sentimen dan liputan terkait |
| Analitik Media `/media` | Volume harian, letupan negatif/positif, sentimen per kabupaten, isu, sumber teraktif |
| Aktor `/aktor` | Sosiogram & matriks pengaruh–kepentingan (DATA CONTOH sampai hasil lapangan tersedia) |
| Mode Presentasi `/presentasi` | 4 panel ringkasan (umum, konflik, potensi, pemberitaan) lalu popup titik bergantian di peta |
| Kelola Data `/kelola` | Tambah/ubah/hapus; berita bisa diberi tautan sumber luar, gambar unggahan, dan isi tulisan |

**Tampilan.** Navigasi ada di atas (`src/components/TopNav.tsx`): menu tarik-turun di desktop, menu layar penuh di HP.
Semua halaman responsif sampai lebar 360 px. Di HP, filter dan ringkasan peta muncul sebagai lembar bawah (*bottom sheet*).
Efek gulir: hero dengan lapisan parallax dan angka berhitung (`Efek.tsx`), kartu yang muncul saat digulir, dan bilah
progres baca di halaman detail. Efek ini memakai CSS scroll-driven animation bila peramban mendukung, dan dimatikan
bila pengguna memilih "kurangi gerakan" di sistem operasinya.

## Data terbuka & cara memperbarui

```bash
npm run data          # semua: wilayah → konflik → potensi → berita
npm run data:berita   # hanya berita (paling sering berubah)
```

Hasil skrip ditulis ke `data/sumber/*.json` dan `public/geo/*.geojson`. Setelah itu, admin menekan
**Muat ulang data** di Kelola Data (atau hapus `data/db.json`). Unduhan mentah di-cache di
`scripts/data/.cache`; tambahkan `--segar` pada skrip untuk mengunduh ulang.

| Data | Sumber | Catatan lisensi |
|---|---|---|
| Batas kab/kec & titik desa | OpenStreetMap (Nominatim, Overpass) | ODbL, wajib atribusi "© OpenStreetMap contributors". Batas desa belum ada di OSM untuk sebagian besar Riau |
| Konflik (19 entri kurasi) | TanahKita.id (koalisi JKPP, HuMA, KPA, Sawit Watch, dll.) | Situs mencantumkan "All Rights Reserved"; minta izin sebelum dipakai di luar internal |
| Konflik dari berita (524) | Google News RSS + klasifikasi kata kunci, sektor & status per artikel | Status & sektor otomatis (70 "tidak diketahui", 143 "belum terklasifikasi"); perlu verifikasi lapangan |
| Potensi ekonomi (±1.000) | OpenStreetMap, dikelompokkan ke lapangan usaha BPS (KBLI 2020) | ODbL. Sumur & fasilitas hulu migas sengaja tidak dimasukkan |
| Berita & sentimen (±1.550) | Google News RSS; GDELT DOC API (sering membatasi akses) | **Ketentuan Google News RSS hanya untuk pemakaian pribadi non-komersial** |
| Kamus sentimen | InSet (Koto & Rahmaningtyas, 2017) | Repositori tanpa berkas lisensi; ditambah aturan nama perusahaan/desakan/arah harga, akurasi pada sampel validasi ±78% |
| Aktor & sosmed | DATA CONTOH | Diganti hasil lapangan; sosmed butuh API berbayar atau input manual |

## Struktur

```
scripts/data/          Skrip pengambil data terbuka (_lib, _gazetir, wilayah, konflik, potensi, berita)
data/sumber/           Hasil skrip (data terbuka)
data/db.json           Database kerja prototipe (dibuat ulang otomatis dari data/sumber)
data/uploads/          Gambar unggahan berita (disajikan lewat /api/berkas, wajib login)
public/geo/            Batas wilayah & titik desa (GeoJSON)
src/data/wilayah.json  Hierarki Kab → Kec → Desa
src/lib/               Logika: kategori & warna, peta, ringkasan, narasi presentasi, skema form, validasi
src/components/        Komponen halaman
```

## Belum ada / langkah berikutnya

- Database PostgreSQL + PostGIS (`src/lib/db.ts` satu-satunya titik yang perlu diganti) dan paket Docker.
- Login dengan tabel pengguna & password ter-hash (sekarang akun demo di `src/lib/auth.ts`); isi `AUTH_SECRET` di `.env.local`.
- Import Excel/GeoJSON dan hasil formulir lapangan.
- Sumber berita yang lisensinya jelas untuk pemakaian kantor (RSS resmi media, GDELT dengan kuota, atau layanan berbayar).
- Penyamaran nama orang pada narasi konflik dan judul berita sebelum dibuka ke pengguna lebih luas (UU PDP).
- Citra satelit Esri dipakai untuk prototipe; cek ketentuan pemakaian atau ganti layanan berlisensi untuk produksi.
