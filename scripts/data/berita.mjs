// Berita daring tentang PT Pertamina Hulu Rokan (PHR) dan isu sosial-ekonomi-lingkungan di Riau (3 bulan terakhir).
// Sumber terbuka: Google News RSS (judul, nama media, tautan feed) + GDELT DOC 2.0 (URL asli, gambar pratinjau).
// Sentimen: leksikon InSet (Koto & Rahmaningtyas 2017) + kata netral + koreksi domain kecil. Isu: kata kunci. Lokasi: gazetir.
// Hak cipta: hanya judul, cuplikan feed, tautan, nama media, dan URL gambar pratinjau yang disimpan; isi artikel tidak diunduh.
// Jalankan: node scripts/data/berita.mjs [--segar] [--tanpa-gdelt] [--kalibrasi]
//   --segar        abaikan cache berita (ambil ulang dari Google News & GDELT)
//   --tanpa-gdelt  lewati GDELT (mis. saat sedang dibatasi)
//   --kalibrasi    cetak kata leksikon yang paling berpengaruh, 30 judul acak + kata yang kena, dan contoh item yang dibuang
//   --jelaskan "…" skor sentimen satu teks beserta kata yang kena, lalu keluar
//   --uji berkas.json  hitung akurasi sentimen terhadap sampel berlabel manual [{judul, label}], lalu keluar
import fs from "node:fs";
import path from "node:path";
import { CACHE, SUMBER, ambil, hash, simpan, slug, tidur, hariIni, bersihJudul } from "./_lib.mjs";
import { cariWilayah, rantai, WILAYAH, adalahTempat } from "./_gazetir.mjs";

const SEGAR = process.argv.includes("--segar");
const KALIBRASI = process.argv.includes("--kalibrasi");
const HARI = 92;
const DET = 864e5;
const batas = new Date(Date.parse(hariIni()) - HARI * DET).toISOString().slice(0, 10);
const AMBANG = { positif: 0.5, negatif: -0.5 };

// ---------- kueri ----------
const KAB = ["Rokan Hilir", "Rokan Hulu", "Dumai", "Bengkalis", "Kepulauan Meranti", "Siak", "Kampar", "Pekanbaru", "Pelalawan", "Kuantan Singingi", "Indragiri Hulu", "Indragiri Hilir"];
// kueri perusahaan dipecah per bulan (after:/before:) supaya tidak terpotong; lainnya satu kueri when:90d
const KUERI_PERUSAHAAN = ['"Pertamina Hulu Rokan"', "PHR Riau", '"Blok Rokan"', 'PHR "WK Rokan"', "Pertamina Riau", "PHR Duri", "PHR Minas", "PHR Dumai"];
const KUERI_ISU = ['"konflik lahan" Riau', "pencemaran Riau", '"limbah minyak" Riau', '"tumpahan minyak" Riau', '"tenaga kerja lokal" Riau', "CSR Riau", "TJSL Riau", "UMKM Riau", '"petani sawit" Riau', "nelayan Riau", '"jalan rusak" Riau', "karhutla Riau", "banjir Riau"];
// "<kab> warga" polos didominasi berita kriminal & seremoni → dipersempit ke keluhan/aksi warga
const KUERI_KAB = KAB.flatMap((k) => [`"${k}" PHR`, `"${k}" Pertamina`, `"${k}" warga (protes OR tuntut OR keluhkan OR demo OR konflik OR tolak)`]);
// GDELT: kata kunci sederhana, 1 permintaan per ≥ 6 detik. GDELT juga mengindeks terjemahan mesin berbahasa Inggris,
// jadi kueri isu memakai nama diri + padanan Indonesia/Inggris ("Blok Rokan" bisa menjadi "Rokan Block").
const KUERI_GDELT = ['"Pertamina Hulu Rokan"', "Rokan Pertamina", "PHR Riau", "PHR Duri", "PHR Dumai", "PHR Minas", "Pertamina Riau",
  'Riau (karhutla OR hotspot OR "forest fire" OR "forest fires")', "Riau (banjir OR flood OR flooding)", 'Riau ("konflik lahan" OR sengketa OR "land conflict" OR "land dispute")',
  'Riau (pencemaran OR limbah OR pollution OR "oil spill")', 'Riau ("tenaga kerja" OR buruh OR workers)', "Riau (CSR OR TJSL)", "Riau (UMKM OR MSME OR MSMEs)",
  'Riau (sawit OR "palm oil")', "Riau (nelayan OR fishermen)", 'Riau ("jalan rusak" OR "damaged road" OR "road damage")',
  "Bengkalis Pertamina", '"Rokan Hilir" Pertamina', "Siak Pertamina", "Kampar Pertamina", "Dumai Pertamina", '"Rokan Hulu" Pertamina'];

// ---------- unduh dengan jeda per host ----------
const terakhir = {};
async function unduh(url, kunci, jedaMs, opsi = {}) {
  const segar = SEGAR && !kunci.startsWith("inset-");
  if (!segar && fs.existsSync(path.join(CACHE, kunci))) return ambil(url, { kunci });
  const host = new URL(url).host;
  const tunggu = (terakhir[host] ?? 0) + jedaMs - Date.now();
  if (tunggu > 0) await tidur(tunggu);
  try { return await ambil(url, { kunci, segar: true, ...opsi }); } finally { terakhir[host] = Date.now(); }
}

// ---------- teks ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const deEnt = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m));
const tanpaTag = (s) => deEnt(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
function tag(xml, t) {
  const m = xml.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`));
  if (!m) return "";
  const c = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return c ? c[1] : deEnt(m[1]);
}
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tglWIB = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 10);
const hostDari = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };
// karakter rusak, awalan format ("Foto :"), dan ekor nama media/rubrik (" - Energi", " | #Tagar") dibersihkan di _lib.bersihJudul
const rapikanJudul = (judul, media = "") => bersihJudul(judul, { media, tempat: adalahTempat });

// ---------- Google News RSS ----------
function jendela() {
  const t = Date.parse(hariIni());
  const d = [HARI, 61, 30, -1].map((h) => new Date(t - h * DET).toISOString().slice(0, 10));
  return [[d[0], d[1]], [d[1], d[2]], [d[2], d[3]]];
}
async function googleNews(kueri, pecah) {
  const varian = pecah ? jendela().map(([a, b]) => `${kueri} after:${a} before:${b}`) : [`${kueri} when:90d`];
  const hasil = [];
  for (const q of varian) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
    let xml;
    try { xml = await unduh(url, `gn-${slug(q)}.xml`, 1800); } catch (e) { console.warn("  ! Google News gagal:", q, e.message); continue; }
    for (const [, it] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const src = it.match(/<source url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/);
      const media = src ? tanpaTag(src[2]) : "";
      const judulAsli = tanpaTag(tag(it, "title"));
      const judul = rapikanJudul(judulAsli, media);
      // deskripsi Google News biasanya = judul + nama media; simpan hanya bila ada cuplikan lain
      const desk = tanpaTag(tag(it, "description"));
      const sisa = norm(desk).replace(norm(judulAsli), "").replace(norm(judul), "").replace(norm(media), "").trim();
      const ringkasan = sisa.length > 40 ? desk.slice(0, 300) : "";
      const ms = Date.parse(tag(it, "pubDate"));
      if (!judul || !Number.isFinite(ms)) continue;
      hasil.push({ tanggal: tglWIB(ms), sumber: media || hostDari(src?.[1] ?? ""), host: hostDari(src?.[1] ?? ""), judul, ringkasan, url: tanpaTag(tag(it, "link")), gambar: null, kueri, asal: "Google News" });
    }
  }
  return hasil;
}

// ---------- GDELT DOC 2.0 ----------
let gdeltMati = process.argv.includes("--tanpa-gdelt"), gdeltGagal = 0, gdeltMulai = 0;
const GDELT_BATAS_MS = 8 * 60e3; // jangan habiskan lebih dari ±8 menit untuk GDELT per jalankan
async function gdelt(kueri) {
  if (gdeltMati) return [];
  gdeltMulai ||= Date.now();
  if (Date.now() - gdeltMulai > GDELT_BATAS_MS) {
    console.warn("  ! batas waktu GDELT (8 menit) tercapai; sisa kueri GDELT dilewati.");
    gdeltMati = true;
    return [];
  }
  const artikel = await gdeltSekali(kueri);
  if (artikel?.length) console.log(`  GDELT "${kueri}": ${artikel.length} artikel`);
  if (artikel === null && ++gdeltGagal >= 2) {
    console.warn("  ! GDELT tidak bisa diakses sekarang; sisa kueri GDELT dilewati (jalankan ulang nanti).");
    gdeltMati = true;
  }
  return artikel ?? [];
}
async function gdeltSekali(kueri) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`${kueri} sourcelang:indonesian`)}&mode=artlist&maxrecords=250&format=json&timespan=3months&sort=datedesc`;
  const kunci = `gdelt-${slug(kueri)}.json`;
  for (let i = 0; i < 3; i++) {
    let teks;
    try { teks = await unduh(url, kunci, 10000, { coba: 1, jeda: 1000 }); } catch (e) { teks = e.message; } // ≥ 10 dtk antarpermintaan
    if (teks.trim().startsWith("{")) {
      // GDELT kadang mengirim karakter kontrol / escape tak sah di judul
      let artikel = null;
      try { artikel = JSON.parse(teks.replace(/[\u0000-\u001f]/g, " ").replace(/\\(["\\/bfnrtu])?/g, (m, e) => (e ? m : "\\\\"))).articles ?? []; }
      catch { console.warn("  ! JSON GDELT rusak:", kueri); }
      if (!artikel?.length) fs.rmSync(path.join(CACHE, kunci), { force: true }); // hasil kosong/rusak tidak di-cache: dicoba lagi lain kali
      // kosong sesudah sempat 429: anggap masih dibatasi (GDELT kerap membalas daftar kosong saat membatasi)
      if (!artikel?.length && i > 0) return null;
      return artikel ?? [];
    }
    fs.rmSync(path.join(CACHE, kunci), { force: true }); // jangan simpan pesan galat di cache
    if (!/limit requests|HTTP 429|HTTP 5\d\d|fetch failed/i.test(teks)) { console.warn("  ! GDELT menolak kueri:", kueri, teks.slice(0, 80)); return []; }
    if (i === 2) break;
    const t = 30000 * 2 ** i; // 429: tunggu 30 lalu 60 dtk, lalu menyerah
    console.warn(`  … GDELT membatasi permintaan, tunggu ${t / 1000} dtk (${kueri})`);
    await tidur(t);
  }
  console.warn("  ! GDELT gagal untuk kueri:", kueri);
  return null;
}
// nama media rapi untuk domain GDELT: dipelajari dari tag <source> Google News, lalu daftar kecil, lalu domain
const MEDIA = { "antaranews.com": "ANTARA News", "riau.antaranews.com": "ANTARA News Riau", "detik.com": "detikcom", "kompas.com": "Kompas.com", "kompas.id": "Kompas.id", "tribunnews.com": "Tribunnews", "pekanbaru.tribunnews.com": "Tribunpekanbaru.com", "riaupos.jawapos.com": "Riau Pos", "riaupos.co": "Riau Pos", "cakaplah.com": "CAKAPLAH", "goriau.com": "GoRiau", "riauonline.co.id": "Riau Online", "halloriau.com": "HalloRiau", "mediacenter.riau.go.id": "Media Center Riau", "bisnis.com": "Bisnis.com", "cnbcindonesia.com": "CNBC Indonesia", "cnnindonesia.com": "CNN Indonesia", "kontan.co.id": "Kontan", "liputan6.com": "Liputan6.com", "okezone.com": "Okezone", "sindonews.com": "SINDOnews", "tempo.co": "Tempo", "republika.co.id": "Republika", "katadata.co.id": "Katadata", "mongabay.co.id": "Mongabay Indonesia", "suara.com": "Suara.com", "viva.co.id": "VIVA", "merdeka.com": "Merdeka.com", "idntimes.com": "IDN Times", "jpnn.com": "JPNN", "beritasatu.com": "Beritasatu", "rri.co.id": "RRI", "kumparan.com": "kumparan", "inews.id": "iNews", "metrotvnews.com": "Metro TV", "medcom.id": "Medcom", "investor.id": "Investor Daily", "dunia-energi.com": "Dunia Energi" };
function namaMedia(u, belajar) {
  const bagian = hostDari(u).split(".");
  for (let i = 0; i < bagian.length - 1; i++) {
    const h = bagian.slice(i).join(".");
    if (belajar.has(h)) return belajar.get(h);
    if (MEDIA[h]) return MEDIA[h];
  }
  return hostDari(u);
}
const gdeltTgl = (s) => { const m = s?.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/); return m ? tglWIB(Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6])) : null; };

// ---------- sentimen: InSet + kata netral + koreksi domain ----------
// InSet disusun dari tweet: banyak kata fungsi, nama tempat, dan kata topik berita ikut berbobot. Kata-kata ini dinetralkan (0).
const NETRAL = [
  // kata fungsi & kata kerja/keterangan umum
  "yang dari dalam pada bagi atas jadi bersama melalui lewat kini tetap harus makin masuk terkait ikut langsung beri bagikan minta jaga sebagai karena hanya lain lalu " +
  "sudah ada lagi lebih sangat mulai usai terjadi balik cari bawa ambil tekan pasang daftar lengkap jelas soal rapat hadir hadirkan ajukan beber terlibat tangan",
  // bilangan, waktu, satuan, benda & lembaga umum
  "satu dua juta persen tambah tambahan bertambah hasil nilai data unit sistem paket umur pagi jumat kota rumah udara kualitas harga dana kelas kelompok anggota " +
  "petugas tim gabungan siswa lulusan sekolah anak muda generasi badan dewan komisi direksi pemilik perseroan kuasa kapal mobil susu sapi ruang terminal fasilitas " +
  "transaksi studi lelang pajak kejari kejati tawar abadi presiden terbuka cadangan melihat rela intelektual ludes panjang terbaru belanja anggar inap putuskan ekor dekat suni berita tengah permukiman suara air dunia malam fakta batas " +
  "direktur bisnis tempat stok lembaga kelembagaan pengadaan upaya fiskal pelabuhan pengurus armada muatan salat karyawan angkat lawan eco mata pembangkit bidik " +
  "kiriman penjelasan pendaftaran hidup kegiatan sering tua muncul laporkan bahas penyebab kejar bertindak forum bayar jelang waduk dominasi izin izinkan " +
  "berangkat keluarga belajar semakin murid perhatian man tinggal lambang",
  // kata topik berita (topik, bukan penilaian)
  "usaha produk layanan distribusi pasokan hujan pohon jembatan jalur kebun titik energi lingkungan sosial pendidikan kesehatan keselamatan ketahanan potensi mitra " +
  "perubahan serius cek laporan lapor tembus duga dugaan temu tetapkan patroli manggala pekerja tenaga kerja lapangan beroperasi operasi kapasitas akses " +
  "kebutuhan tertinggi luas terluas aksi periksa ketat babak kunci ajang darah eks kronologi pengguna wajib sholat gerakan mengenang rimba tetes bekas panas " +
  "gas kilang minyak migas api perusahaan hutan gelar resmi warga masyarakat pemerintah",
  // nama/unsur nama tempat (Pematang, Balai Makam, Rumbai Jaya, Melayu, ...)
  "hulu hilir kuala duri putih merah simpang tanjung teluk pulau sungai bukit batang rantau tanah makam balai pasir muara lubuk padang selat rawa jaya pematang buluh melayu",
].join(" ").split(" ");
// Koreksi domain: istilah isu yang arahnya harus jelas di berita Riau/migas
const KOREKSI = {
  konflik: -3, pencemaran: -4, tercemar: -4, cemari: -4, limbah: -3, protes: -3, demo: -3, tuntut: -3, tuntutan: -3, sengketa: -3, bentrok: -4, kriminalisasi: -4,
  rusak: -3, tumpahan: -3, tumpah: -3, karhutla: -4, banjir: -3, kebakaran: -3, terbakar: -3, asap: -2, tewas: -4, maut: -4, longsor: -3, abrasi: -3, keluhkan: -3,
  tolak: -3, kecam: -3, blokade: -3, phk: -3, mogok: -3, korupsi: -4, ilegal: -3, bocor: -3, ledakan: -4, keracunan: -4, memanas: -2, turun: -1,
  hotspot: -2, "titik api": -2, "titik panas": -2,
  bantuan: 3, bantu: 2, beasiswa: 3, pelatihan: 2, pemberdayaan: 3, penghargaan: 3, apresiasi: 3, sukses: 3, berhasil: 3, capai: 2, raih: 3, dukung: 2,
  "produksi naik": 3, "produksi meningkat": 3, lampaui: 3, santunan: 2, sejahtera: 3, kuat: 2, perkuat: 2, mandiri: 2, kemandirian: 2, atasi: 2, tangani: 1,
  perluas: 2, menjaga: 1, mulus: 2, pastikan: 2, jamin: 1, sinergi: 2, padamkan: 2, mangkrak: -3, antrean: -2, latih: 2, dorong: 1, efisiensi: 2,
  sumbang: 2, polemik: -2, meluas: -2, "tenaga kerja": 0, serap: 2, sampah: 0, rawan: -2, padam: -2, cegah: 2, tanggulangi: 2, berantas: 2,
  tajak: 0, genjot: 2, ditutup: 0, lancar: 2, mendorong: 1, laik: 2, langgar: -3, perkara: -1, tumbuh: 2, selesai: 1, menang: 3, "tanggung jawab": 1, heroik: 3, terkendali: 3,
  becus: 3, cukup: 2, // InSet: becus −3, cukup −5 → "tak becus"/"tak cukup" jadi positif bila tak dikoreksi
  // kalibrasi 2026-10 (sampel 80 judul berlabel manual): kosakata program/operasi yang tak ada di InSet, dan bobot InSet yang menyimpang
  "tambah produksi": 3, "tambahan produksi": 3, "tambah pasokan": 2, "tambah kapasitas": 2, "temukan tambahan": 3, "temukan potensi": 3, "potensi tambah": 2,
  investasi: 2, raup: 2, magang: 2, vokasi: 2, harapan: 2, "jemput bola": 2, layani: 2, bergairah: 3, "perputaran ekonomi": 2, hidupkan: 2, kolaborasi: 2,
  cuan: 3, "zero waste": 2, transformasi: 2, bertransformasi: 2, gaungkan: 1, salurkan: 2, menyalurkan: 2, bagikan: 2, membagikan: 2,
  vital: 0, mengandalkan: 0, andalkan: 1, ditimbun: 0, timbun: -1, tinggikan: 0, ditinggikan: 0, gratifikasi: -3, hilang: -3, mengular: -2,
  "berakhir damai": 4, "sepakat damai": 4, "kesepakatan damai": 4, berdamai: 3, damai: 2, "aksi damai": -1, "demo damai": -1, "berjalan damai": 1, kesepakatan: 2,
  ujung: 0, berujung: 0, penghubung: 0, hubung: 0, teknik: 0, layak: 2, kelayakan: 0, kaji: 1,
  memutarbalikkan: -3, perbaiki: 2, memperbaiki: 2, kelangkaan: -3, langka: -2, krisis: -3, anjlok: -3, merosot: -3,
};
// pembalik tanda; "nihil"/"bebas"/"zero" ditambahkan karena lazim di judul ("Nihil Karhutla", "Bebas Banjir", "Zero Hotspot");
// "seharusnya/harusnya" = kritik ("PHR Harusnya Bantu Perbaikan Jalan")
const NEGASI = new Set(["tidak", "tak", "bukan", "belum", "jangan", "tanpa", "nihil", "bebas", "zero", "harusnya", "seharusnya", "semestinya", "mestinya"]);
// kata desakan: kata positif dalam 4 kata sesudahnya belum terjadi ("Minta Pertamina Segera Beri Solusi", "Desak PHR Perbaiki Jalan")
const TUNTUTAN = new Set("minta meminta diminta desak mendesak didesak tuntut menuntut dituntut harap berharap mengharapkan tagih menagih harusnya seharusnya semestinya mestinya".split(" "));
const PENGISI = new Set(["ada", "lagi", "akan", "pernah", "bisa", "dapat", "boleh", "mau", "perlu", "sempat", "terlalu", "begitu", "sangat", "lebih", "terbukti"]); // negasi menembus kata ini ("tak terbukti bersekongkol")
// kata kerja penanggulangan: kata negatif dalam 3 kata sesudahnya (dan yang langsung berurutan) dinetralkan
// ("Cegah Karhutla", "Atasi Banjir", "Pemulihan Tanah Terkontaminasi", "Tekan Risiko Kehilangan Produksi")
const MITIGASI = new Set(("cegah mencegah pencegahan atasi mengatasi tangani menangani penanganan tanggulangi menanggulangi penanggulangan padamkan memadamkan " +
  "antisipasi mengantisipasi tangkal menangkal berantas memberantas perangi lawan melawan kendalikan mengendalikan pengendalian lindungi melindungi kurangi " +
  "mengurangi tekan menekan pemulihan pulihkan memulihkan restorasi rehabilitasi deteksi kesiapsiagaan siaga mitigasi hadapi menghadapi waspadai " +
  "perbaiki memperbaiki perbaikan benahi membenahi tambal menambal normalisasi").split(" "));
const kataDari = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]+(?:-[a-z]+)*/g) ?? [];

async function muatInSet() {
  const leks = new Map();
  for (const f of ["positive", "negative"]) {
    const tsv = await unduh(`https://raw.githubusercontent.com/fajri91/InSet/master/${f}.tsv`, `inset-${f}.tsv`, 0);
    for (const baris of tsv.split(/\r?\n/).slice(1)) {
      const [kata, bobot] = baris.split("\t");
      const w = Number(bobot);
      const k = kataDari((kata ?? "").replace(/\([^)]*(\)|$)/g, " ")).join(" ");
      if (k && Number.isFinite(w)) leks.set(k, (leks.get(k) ?? 0) + w); // kata di kedua daftar: bobot dijumlah
    }
  }
  for (const k of NETRAL) leks.set(k, 0);
  for (const [k, w] of Object.entries(KOREKSI)) leks.set(k, w);
  return leks;
}
const LEKS = await muatInSet();
const MAKS_FRASA = Math.max(...[...LEKS.keys()].map((k) => k.split(" ").length));

// pemenggalan imbuhan ringan, hanya bila kata utuh tak ada di leksikon: menolak→tolak, kerusakan→rusak, dituntut→tuntut
function bentukDasar(t) {
  const akar = t.replace(/(nya|lah|kah)$/, "");
  const dasar = new Set([akar]);
  for (const suf of ["kan", "an"]) if (akar.endsWith(suf) && akar.length - suf.length >= 4) dasar.add(akar.slice(0, -suf.length));
  const kand = [];
  for (const d of dasar) {
    kand.push(d);
    let m;
    if ((m = d.match(/^(di|ter|ber|per)(.{4,})$/))) kand.push(m[2]);
    if (d !== akar && (m = d.match(/^ke(.{4,})$/))) kand.push(m[1]); // ke-…-an saja (kerusakan→rusak, bukan kejari→jari)
    if ((m = d.match(/^(?:me|pe)ng(.{3,})$/))) kand.push(m[1], "k" + m[1]);
    if ((m = d.match(/^(?:me|pe)ny(.{3,})$/))) kand.push("s" + m[1]);
    if ((m = d.match(/^(?:me|pe)n(.{3,})$/))) kand.push(m[1], "t" + m[1]);
    if ((m = d.match(/^(?:me|pe)m(.{3,})$/))) kand.push(m[1], "p" + m[1]);
    if ((m = d.match(/^(?:me|pe)([lrwy].{3,})$/))) kand.push(m[1]);
  }
  return kand.filter((k) => k.length >= 4 && k !== t);
}
// Kata bermakna positif yang lazim menjadi bagian nama perusahaan/koperasi/desa ("PT Ujung Tanjung Sejahtera", "Desa Balam Sempurna",
// "Koperasi Harapan Makmur"): dinetralkan bila berada dalam nama setelah PT/CV/PTPN/Koperasi/Desa/…
const KATA_NAMA = new Set(("lestari makmur abadi jaya sejahtera indah sentosa sentausa mulia mulya prima bahagia damai agung perkasa sakti bakti mandiri sukses " +
  "maju utama permai subur gemilang cemerlang berkah barokah harapan raya kencana emas asri setia sehati sinar cahaya bintang megah unggul aman tenteram rukun " +
  "bersatu berjaya sejati murni teguh kuat tangguh adil luhur mekar karya bangun bina sumber rezeki rejeki sempurna permata intan mutiara pratama perdana mukti " +
  "sari madani lancar baru setia kasih sayang bijaksana").split(" "));
const PEMICU_NAMA = /\b(PT|CV|PTPN|PTP|UD|KUD|Koperasi|Kopsa|Yayasan|Poktan|Gapoktan|Kelompok Tani|Desa|Kelurahan|Kampung|Dusun|Kepenghuluan|Kecamatan|Kec|Perumahan|Komplek|Kompleks|Hotel|Grup|Group|SPBU|PKS|Pabrik)\.?\s+((?:[A-Z0-9][\w'&.-]*\s*){1,5})/g;
const HENTI_NAMA = /^(di|ke|dari|dan|dengan|yang|untuk|atas|oleh|pada|ini|itu|agar|hingga|serta|tak|tidak|belum|sudah|akan|vs|soal|terkait|warga|masyarakat|petani|kembali|minta|desak|tolak|tuntut)$/i;
const KATA_KERJA_NAMA = /^(di|ter|ber|per)[a-z]{3,}$|^(meng|meny|mem|men|me)[a-z]{3,}$|[a-z]{3,}kan$/i;
function samarkanNama(teks) {
  return teks.replace(PEMICU_NAMA, (m, pemicu, nama) => {
    const kata = nama.trim().split(/\s+/);
    const keluar = [];
    let dalam = true;
    for (const k of kata) {
      const b = k.replace(/[.,;:!?"')]+$/, "");
      if (dalam && (HENTI_NAMA.test(b) || (!/^[A-Z0-9]+$/.test(b) && KATA_KERJA_NAMA.test(b)))) dalam = false;
      keluar.push(dalam && KATA_NAMA.has(b.toLowerCase()) ? k.replace(b, "xnama") : k);
      if (b !== k) dalam = false; // tanda baca mengakhiri nama
    }
    return m.replace(nama, keluar.join(" ") + (nama.endsWith(" ") ? " " : ""));
  });
}
// nama wilayah ≥ 2 kata dari gazetir ("Marpoyan Damai", "Balam Sempurna", "Teluk Makmur") dilewati sebagai satu unit netral
const NAMA_WILAYAH = new Set(WILAYAH.filter((w) => w.level !== "kabupaten").map((w) => kataDari(w.nama).join(" ")).filter((n) => n.split(" ").length >= 2 && n.split(" ").some((k) => KATA_NAMA.has(k))));
// penyelesaian di ujung judul ("… Kini Mulus", "Sudah Fungsional", "Karhutla Terkendali"): menggeser skor ke positif/netral
const PULIH = /\b(kini|sudah|telah|akhirnya|kembali|mulai|makin|semakin)\s+(mulus|lancar|normal|fungsional|berfungsi|beroperasi|aman|bersih|pulih|tuntas|selesai|terkendali|padam|dibuka|bisa dilalui|diperbaiki|teratasi|tertangani|surut|membaik|nyaman|mengalir|menyala)\b|(?<!(belum|tak|tidak|kunjung|segera|minta|diminta) )\b(ditangani|diatasi|tertangani)\b|\b(terkendali|teratasi|kembali normal|berakhir damai|sepakat damai|sudah fungsional|selesai diperbaiki|berhasil (dipadamkan|diatasi|ditangani|diperbaiki|ditekan|dikendalikan))\b|\b(tuntas|rampung)\s*$/i;

const kena = new Map(); // statistik untuk --kalibrasi
function sentimen(teksAsli) {
  const teks = samarkanNama(teksAsli);
  const tok = kataDari(teks);
  const jejak = [];
  let jumlah = 0, balik = false, redam = 0, positif = 0, negatif = 0, tuntut = 0;
  for (let i = 0; i < tok.length; ) {
    let lewati = 0;
    for (let L = 4; L >= 2 && !lewati; L--) if (NAMA_WILAYAH.has(tok.slice(i, i + L).join(" "))) lewati = L;
    if (lewati) { jejak.push(`[${tok.slice(i, i + lewati).join(" ")}]`); i += lewati; balik = false; tuntut = Math.max(0, tuntut - 1); continue; }
    if (TUNTUTAN.has(tok[i])) tuntut = 5; // termasuk kata desakan itu sendiri
    else tuntut = Math.max(0, tuntut - 1);
    if (NEGASI.has(tok[i])) { balik = true; i++; continue; }
    if (balik && PENGISI.has(tok[i])) { i++; continue; }
    let w = 0, n = 1, kunci = null;
    for (let L = Math.min(MAKS_FRASA, tok.length - i); L >= 1; L--) {
      const f = tok.slice(i, i + L).join(" ");
      if (LEKS.has(f)) { w = LEKS.get(f); n = L; kunci = f; break; }
    }
    if (kunci === null) for (const d of bentukDasar(tok[i])) if (LEKS.has(d)) { w = LEKS.get(d); kunci = `${tok[i]}→${d}`; break; }
    if (balik) { w = -w; kunci = `¬${kunci}`; }
    else if (redam > 0 && w < 0) { jejak.push(`⊘${kunci}`); w = 0; redam = 2; i += n; continue; } // "Cegah Karhutla" ≠ berita karhutla
    if (tuntut > 0 && w > 0) { jejak.push(`?${kunci}`); w = 0; } // hal positif yang masih dituntut belum terjadi
    if (w) {
      jumlah += w;
      if (w > 0) positif += w; else negatif += w;
      jejak.push(`${kunci}${w > 0 ? "+" : ""}${w}`);
      if (KALIBRASI) { const e = kena.get(kunci) ?? { w, n: 0 }; e.n++; kena.set(kunci, e); }
    }
    // kata penanggulangan di dalam desakan ("Desak … Perbaiki Jalan Rusak") tidak menetralkan masalahnya
    redam = MITIGASI.has(tok[i]) && !tuntut ? 3 : w ? 0 : Math.max(0, redam - 1);
    balik = false;
    i += n;
  }
  // harga: naik baik bagi petani (TBS, karet), buruk bagi konsumen (BBM, cabai) — dan sebaliknya
  const tl = ` ${tok.join(" ")} `;
  if (/ (harga|tbs) /.test(tl)) {
    const komoditas = / (tbs|sawit|karet|kelapa|cpo|kernel|pinang|gambir|komoditas) /.test(tl);
    const konsumen = / (bbm|pertamax|pertalite|solar|dexlite|biosolar|lpg|elpiji|cabai|beras|sembako|ayam|bawang|telur|tarif) /.test(tl);
    const naik = / (naik|melonjak|tembus|meningkat|kenaikan) /.test(tl), turun = / (turun|anjlok|merosot|terjun|tertekan|melemah|penurunan|jatuh) /.test(tl);
    const b = naik === turun ? 0 : komoditas && !konsumen ? (naik ? 3 : -3) : konsumen && !komoditas ? (naik ? -3 : 3) : 0;
    if (b) { jumlah += b; if (b > 0) positif += b; else negatif += b; jejak.push(`harga${b > 0 ? "+" : ""}${b}`); }
  }
  // masalah yang sudah teratasi: bobot negatif diredam, ditambah dorongan positif kecil
  if (PULIH.test(teks)) { jumlah = positif + negatif * 0.4 + 2; jejak.push("↻pulih"); }
  const skor = Math.round((jumlah / Math.sqrt(Math.max(1, tok.length))) * 100) / 100;
  return { skor, label: skor >= AMBANG.positif ? "positif" : skor <= AMBANG.negatif ? "negatif" : "netral", jejak };
}

// ---------- isu (urutan = prioritas; isu yang sama boleh muncul lebih dari sekali) ----------
const RX_PHR = /pertamina hulu rokan|blok rokan|wk rokan|wilayah kerja rokan|\bphr\b/;
const RX_PERUSAHAAN = /\bpt\b|ptpn|perusahaan|korporasi|\bbumn\b|\bbank\b|\bbrk\b|pertamina|\bphr\b|\bpln\b|\bbsp\b|\brapp\b|indah kiat|sinar mas|asian agri|wilmar|musim mas|agrinas|chevron|pelindo|\bpgn\b|telkom/;
const RX_AKSI = /\b(demo|protes|unjuk rasa|aksi (damai|massa|unjuk|protes|demo)|massa aksi|tuntut\w*|tolak\w*|keluh\w*|konflik|bentrok\w*|desak\w*|blokade|blokir|mogok|kecam|mengecam|dikecam|kecaman|sengketa|somasi|gugat\w*)\b/;
const ISU = [
  ["Program CSR/TJSL", /\b(csr|tjsl|ppm)\b|tanggung jawab sosial|bina lingkungan/],
  ["Program CSR/TJSL", /\b(bantuan|beasiswa|pelatihan|pemberdayaan|santunan|donasi|sembako|binaan|bedah rumah|salurkan|serahkan|hibah|sumbang\w*|posyandu|stunting|baksos|bakti sosial|peduli|khitan\w*|donor darah|pengobatan gratis)\b/, RX_PERUSAHAAN],
  ["Lingkungan", /karhutla|kebakaran (hutan|lahan|gambut)|(lahan|hutan|gambut) terbakar|\b(pem)?bakar(an)? (hutan|lahan)|hutan dan lahan|titik (api|panas)|hotspot|kabut asap|\bispu\b|\bispa\b|kualitas udara|hujan buatan|modifikasi cuaca|water bombing|manggala agni/],
  ["Lahan", /\blahan\b|\bulayat\b|sengketa|ganti rugi|ganti untung|pembebasan (lahan|tanah)|\bhgu\b|perambahan|tapal batas|mafia tanah|agraria|sertifikat (tanah|lahan)|tanah adat|masyarakat adat|penggusuran|digusur|okupasi|kawasan hutan|eksekusi/],
  ["Lingkungan", /pencemar|tercemar|cemari|limbah|tumpah|\basap\b|banjir|abrasi|longsor|erosi|\bemisi\b|deforestasi|mangrove|gambut|ikan mati|lingkungan|amdal|sampah|\bb3\b|satwa|harimau|gajah|buaya|monyet|beruk|beruang|polusi|kekeringan|puting beliung|reklamasi|penghijauan|tanam pohon|iklim|cuaca|\bdlh\b|bmkg|tanggul|sungai (rusak|tercemar|keruh|tertimbun|ditimbun)|timbun\w* (anak )?sungai/],
  ["Keselamatan & insiden", /kecelakaan|tabrakan|terguling|ledakan|meledak|semburan|\bbocor|terbakar|kebakaran|insiden|keracunan|\bh2s\b|keselamatan|\bk3\b|\bhse\b|tenggelam|hanyut|tewas|korban jiwa|evakuasi|\bhilang\b/],
  ["Tenaga kerja lokal", /tenaga kerja|pekerja|naker|rekrut\w*|lowongan|\bloker\b|\bphk\b|buruh|karyawan|\bupah\b|\bumk\b|\bump\b|outsourcing|alih daya|pengangguran|serikat|vendor lokal|kontraktor lokal|pengusaha lokal|putra daerah|anak tempatan|magang|lapangan kerja/],
  ["Infrastruktur", /\bjalan\b(?! (sehat|santai|di tempat))|jembatan|listrik|\bpln\b|air bersih|pdam|irigasi|pelabuhan|bandara|\btol\b|drainase|infrastruktur|gedung|internet|sinyal|\bbts\b|semenisasi|pengaspalan|\baspal\b/],
  ["Operasi & produksi migas", /produksi|lifting|sumur|pengeboran|\bbor\b|migas|minyak(?! (goreng|makan|sawit|kelapa))|barel|\bbopd\b|skk migas|eksplorasi|cadangan (minyak|migas|gas)|\beor\b|steamflood|injeksi|wilayah kerja|blok rokan|wk rokan|\bpipa\b|kilang(?! (padi|sagu))|\brig\b|onstream|energi|\bgas\b|\bbbm\b|\bspbu\b|\bsolar\b|pertalite|elpiji|\blpg\b|\bmnk\b|\btender\b|\blelang\b|\baset\b/],
  ["Ekonomi lokal", /umkm|\bukm\b|petani|sawit|\btbs\b|karet|nelayan|\bpasar\b|koperasi|bumdes|ekonomi|pariwisata|wisata|investasi|inflasi|\bharga\b|pertanian|perikanan|peternakan|pangan|\busaha\b|pedagang|ekspor|produk lokal|kelapa|panen|beras|pinang|gambir|kemitraan|\bplasma\b|\bkadin\b|\bkur\b|kredit|perbankan/],
  ["Kebijakan & regulasi", /\bperda\b|regulasi|kebijakan|peraturan|pergub|perbup|permen|undang undang|\bruu\b|\buu\b|\bizin|perizinan|\bdbh\b|dana bagi hasil|participating interest|\bpi\b|\bbumd\b|esdm|moratorium|\bdprd\b|pansus|\brdp\b|pemprov|pemkab|pemko|anggaran|\bapbd\b|pajak|retribusi/],
];
function tentukanIsu(t) {
  for (const [isu, rx, syarat] of ISU) if (rx.test(t) && (!syarat || syarat.test(t))) return isu;
  // berita PHR/Pertamina tanpa kata kunci isu: kegiatan korporat/operasi
  return RX_PHR.test(t) || /pertamina/.test(t) ? "Operasi & produksi migas" : "Lainnya";
}

// ---------- relevansi Riau ----------
const LUAR = /prabumulih|sumatera selatan|sumsel|\bjambi\b|kuala tungkal|cianjur|pasuruan|sinjai|sulselrabar|banyuasin|kertapati|anambas|malalak|gunungkidul|tambelan|rempang|konawe|nagan|\bdprk\b|banyuwangi|garut|sukabumi|bogor|bekasi|tangerang|cirebon|lombok|kupang|manado|gorontalo|samarinda|banjarmasin|palangka|lahat|lubuklinggau|tanjung jabung|muaro jambi|kalimantan|kaltim|kalbar|kalsel|kalteng|kaltara|\bjawa\b|jakarta|bandung|surabaya|semarang|yogyakarta|\baceh\b|sumatera utara|\bsumut\b|\bmedan\b|sumatera barat|\bsumbar\b|\bpadang\b|kepulauan riau|\bkepri\b|batam|tanjungpinang|bangka|belitung|lampung|bengkulu|papua|sulawesi|maluku|\bbali\b|\bntt\b|\bntb\b|natuna|cepu|balikpapan|bontang|tarakan|palembang|banten|malaysia|singapura|bojonegoro|cilacap|langkat|pangkalan susu|labuhanbatu|tapanuli|sorong|mahakam|pendopo|\bzona [1-4]\b|karimun|sarawak|solok|bukittinggi|payakumbuh|pasaman|dharmasraya|batu bara|asahan|deli serdang|kendari|makassar|pontianak|timor leste|guyana|suriname|nepal|tibet|australia|china|tiongkok|india|jepang|korea|amerika|eropa|thailand|vietnam|filipina|myanmar|gaza|palestina|israel|iran|rusia|ukraina|arab saudi|turki|mesir|afrika/;
const RIAU = /\briau\b|blok rokan|wk rokan|wilayah kerja rokan|\bminas\b|\bduri\b|rumbai|pekanbaru|dumai|bengkalis|\bsiak\b|kampar|rokan hilir|rokan hulu|\brohil\b|\brohul\b|pelalawan|kuansing|kuantan singingi|indragiri|\binhu\b|\binhil\b|meranti|tembilahan|bangkinang|bagansiapiapi|selatpanjang|perawang|kandis|mandau|bathin solapan|tanah putih|rupat|sungai apit|tualang|rangsang|kerumutan|pangkalan kerinci|langgam|rengat|air molek|t[ae]luk kuantan|ujung batu|tandun|tapung|kampar kiri|bagan batu|rimba melintang|pujud|kotabatak|petapahan|bekasap|kuala enok|tempuling|kateman|sungai guntung|koto gasib|sungai mandau/;
const MEDIA_RIAU = /riau|pekanbaru|dumai|bengkalis|siak|kampar|rohil|rohul|rokan|inhil|inhu|indragiri|kuansing|meranti|pelalawan|cakaplah|bertuahpos|potretnews/;
function relevan(t, it, lok) {
  const riauEksplisit = RIAU.test(t.replace(/kepulauan riau|\bkepri\b/g, " "));
  const adaRiau = !!lok || riauEksplisit;
  // menyebut daerah luar Riau: wajib ada nama Riau yang tegas (lokasi dari nama desa saja, mis. "Pematang", tidak cukup)
  if (LUAR.test(t) && !riauEksplisit) return false; // mis. PHR Zona 4 Prabumulih, "LANGKAT – Ratusan warga Desa Pematang …"
  if (adaRiau) return true;
  if (RX_PHR.test(t) && !/pajak|hotel|restoran/.test(t)) return true; // PHR tanpa lokasi = WK Rokan, Riau
  if (/pertamina/.test(t)) return false; // berita Pertamina nasional/luar Riau yang dimuat media lokal
  return MEDIA_RIAU.test(norm(`${it.sumber} ${it.host ?? ""}`)) && !/kepri|batam/.test(norm(it.sumber)); // media lokal Riau
}

// lokasi: gazetir; bila beberapa kabupaten disebut di anak kalimat berbeda, pakai anak kalimat pertama yang terlokasi
function lokasiBerita(teks) {
  const lok = cariWilayah(teks);
  if (lok) return lok;
  for (const bagian of teks.split(/[,:;|]/)) {
    const b = bagian.trim();
    if (b.length > 8 && b !== teks.trim()) { const l = cariWilayah(b); if (l) return l; }
  }
  return null;
}

// node scripts/data/berita.mjs --jelaskan "judul"  → skor + kata yang kena, tanpa mengunduh berita
const iJelas = process.argv.indexOf("--jelaskan");
if (iJelas > 0) {
  const s = sentimen(process.argv[iJelas + 1] ?? "");
  console.log(s.skor, s.label, s.jejak.join(" "));
  process.exit(0);
}
// node scripts/data/berita.mjs --uji sampel.json  → akurasi terhadap label manual [{judul, label}]
const iUji = process.argv.indexOf("--uji");
if (iUji > 0) {
  const sampel = JSON.parse(fs.readFileSync(process.argv[iUji + 1], "utf8"));
  let benar = 0;
  const matriks = {};
  for (const x of sampel) {
    const s = sentimen(x.judul);
    if (s.label === x.label) benar++;
    else console.log(`  ✗ ${x.label.padEnd(7)} → ${s.label.padEnd(7)} ${String(s.skor).padStart(5)} | ${x.judul}\n      ${s.jejak.join(" ")}`);
    matriks[`${x.label}→${s.label}`] = (matriks[`${x.label}→${s.label}`] ?? 0) + 1;
  }
  console.log(`akurasi ${benar}/${sampel.length} = ${((benar / sampel.length) * 100).toFixed(1)}%`, matriks);
  process.exit(0);
}

// ---------- kumpulkan ----------
console.log(`Berita ${batas} s.d. ${hariIni()}`);
console.log("1/3 Google News RSS");
const gn = [];
for (const q of KUERI_PERUSAHAAN) gn.push(...(await googleNews(q, true)));
for (const q of [...KUERI_ISU, ...KUERI_KAB]) gn.push(...(await googleNews(q, false)));
console.log(`  ${gn.length} item mentah`);
const belajar = new Map(gn.filter((x) => x.host && x.sumber !== x.host).map((x) => [x.host, x.sumber]));

console.log("2/3 GDELT DOC 2.0");
const gd = [];
for (const q of KUERI_GDELT) {
  for (const a of await gdelt(q)) {
    const tanggal = gdeltTgl(a.seendate);
    const sumber = namaMedia(a.url, belajar);
    const judul = rapikanJudul(tanpaTag(a.title ?? ""), sumber);
    if (!tanggal || !judul || !a.url) continue;
    gd.push({ tanggal, sumber, host: hostDari(a.url), judul, ringkasan: "", url: a.url, gambar: a.socialimage || null, kueri: q, asal: "GDELT" });
  }
}
const gdeltTerbatas = gdeltMati || gdeltGagal > 0;
console.log(`  ${gd.length} item mentah${gdeltTerbatas ? " (GDELT dilewati/dibatasi; sebagian atau semua kueri tidak diambil)" : ""}`);

// Cocokkan artikel GDELT ke item Google News (judul ternormalisasi mirip: Dice token ≥ 0,75, tanggal ±3 hari):
// item Google News mendapat URL asli + gambar pratinjau; artikel GDELT yang tak cocok masuk sebagai item baru (tetap disaring relevansi).
const tokenJudul = (j) => new Set(norm(j).split(" ").filter((k) => k.length > 2));
const diceJudul = (a, b) => { let s = 0; for (const t of a) if (b.has(t)) s++; return (2 * s) / (a.size + b.size || 1); };
const gnPerUrl = new Map();
for (const x of gn) gnPerUrl.set(x.url, [...(gnPerUrl.get(x.url) ?? []), x]);
const gnUnik = [...gnPerUrl.values()].map((xs) => ({ xs, tok: tokenJudul(xs[0].judul), t: Date.parse(xs[0].tanggal) }));
const gdBaru = [];
let gdCocok = 0;
for (const a of gd) {
  const ta = tokenJudul(a.judul), t = Date.parse(a.tanggal);
  let terbaik = null, skor = 0;
  for (const g of gnUnik) {
    if (Math.abs(g.t - t) > 3 * DET) continue;
    const d = diceJudul(ta, g.tok);
    if (d > skor) { skor = d; terbaik = g; }
  }
  if (terbaik && skor >= 0.75) {
    if (!terbaik.xs[0].gambar) { gdCocok++; for (const x of terbaik.xs) { x.url = a.url; x.gambar = a.gambar; x.host = a.host; } }
  } else gdBaru.push(a);
}
if (gd.length) console.log(`  GDELT: ${gdCocok} item Google News dilengkapi URL asli/gambar, ${gdBaru.length} artikel GDELT baru`);

console.log("3/3 Saring, deduplikasi, sentimen, isu, lokasi");
const kunciJudul = (j) => norm(j).slice(0, 90);
const sudahUrl = new Set(), sudahJudul = new Set();
const data = [], dibuang = [];
let buangLuar = 0, buangLain = 0, buangLama = 0;
for (const it of [...gdBaru, ...gn]) {
  if (it.tanggal < batas) { buangLama++; continue; }
  const kj = kunciJudul(it.judul);
  if (sudahUrl.has(it.url) || sudahJudul.has(kj)) continue;
  sudahUrl.add(it.url); sudahJudul.add(kj);
  const teks = `${it.judul} ${it.ringkasan}`;
  const t = norm(teks);
  const lok = lokasiBerita(teks);
  if (!relevan(t, it, lok)) { buangLuar++; dibuang.push(`luar  | ${it.judul}`); continue; }
  const isu = tentukanIsu(t);
  // di luar topik studi (kriminal umum, seremoni, olahraga) dibuang kecuali memuat aksi/keluhan warga
  if (isu === "Lainnya" && !RX_AKSI.test(t)) { buangLain++; dibuang.push(`topik | ${it.judul}`); continue; }
  const s = sentimen(teks);
  data.push({
    id: `m-${hash(it.url)}`, tanggal: it.tanggal, tipe: "berita", sumber: it.sumber, judul: it.judul, ringkasan: it.ringkasan, isi: "", url: it.url, gambar: it.gambar,
    sentimen: s.label, skor: s.skor, metodeSentimen: "InSet", isu,
    wilayahId: lok?.wilayahId ?? "riau", presisi: lok?.presisi ?? "provinsi", kueri: it.kueri, asal: it.asal,
  });
  if (KALIBRASI) data.at(-1)._jejak = s.jejak;
}
data.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.judul.localeCompare(b.judul));
console.log(`  ${data.length} item unik (dibuang: ${buangLuar} di luar Riau, ${buangLain} di luar topik, ${buangLama} lebih tua dari ${batas})`);

simpan(path.join(SUMBER, "berita.json"), {
  dibuat: new Date().toISOString(),
  sumber: [
    { nama: "Google News RSS", url: "https://news.google.com", lisensi: "Ketentuan Google News (feed untuk penggunaan pribadi/non-komersial); hak cipta judul pada masing-masing media", catatan: `Pencarian RSS hl=id gl=ID, ${KUERI_PERUSAHAAN.length + KUERI_ISU.length + KUERI_KAB.length} kueri, jendela ${batas} s.d. ${hariIni()}. Disimpan hanya judul, nama media, dan tautan feed.` },
    { nama: "GDELT DOC 2.0", url: "https://api.gdeltproject.org/api/v2/doc/doc", lisensi: "GDELT Project: bebas dipakai dengan atribusi; hak cipta artikel & gambar pada media", catatan: `${KUERI_GDELT.length} kueri sourcelang:indonesian timespan=3months, jeda ≥ 10 dtk. Artikel GDELT dicocokkan ke item Google News (kemiripan judul ≥ 0,75, ±3 hari) untuk mengisi URL asli & URL gambar pratinjau (socialimage); sisanya masuk sebagai item baru.${gdeltTerbatas ? ` Pada pengambilan ${hariIni()} sebagian/semua kueri GDELT tidak terambil (HTTP 429 pembatasan laju) sehingga gambar belum terisi.` : ""}` },
    { nama: "InSet", url: "https://github.com/fajri91/InSet", lisensi: "Tanpa berkas lisensi di repositori; dipakai untuk riset dengan sitasi", catatan: "Koto & Rahmaningtyas (2017), IALP. Bobot kata di kedua daftar dijumlah; + kata netral, koreksi domain, negasi & desakan sederhana, pemenggalan imbuhan ringan, penetralan kata dalam nama perusahaan/desa (PT … Sejahtera, Desa … Makmur), frasa penyelesaian (… Kini Mulus, Terkendali), dan arah harga (TBS naik = positif, BBM naik = negatif). Kalibrasi 2026-10: akurasi sampel validasi 40 judul berlabel manual ±78% (sebelumnya ±68%)." },
  ],
  jumlah: data.length, ambang: AMBANG, data: data.map(({ _jejak, ...d }) => d),
});

// ---------- ringkasan ----------
const hitung = (f) => Object.entries(data.reduce((m, d) => ((m[f(d)] = (m[f(d)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ");
console.log("  asal     ", hitung((d) => d.asal));
console.log("  sentimen ", hitung((d) => d.sentimen));
console.log("  isu      ", hitung((d) => d.isu));
console.log("  kabupaten", hitung((d) => (d.wilayahId === "riau" ? "riau" : rantai(d.wilayahId)[0]?.nama ?? d.wilayahId)));
console.log("  presisi  ", hitung((d) => d.presisi));
console.log(`  bergambar: ${data.filter((d) => d.gambar).length}; rentang ${data.at(-1)?.tanggal} s.d. ${data[0]?.tanggal}`);

if (KALIBRASI) {
  console.log("\nKata leksikon paling berpengaruh (frekuensi × |bobot|):");
  console.log([...kena].sort((a, b) => b[1].n * Math.abs(b[1].w) - a[1].n * Math.abs(a[1].w)).slice(0, 250).map(([k, e]) => `${k}(${e.w > 0 ? "+" : ""}${e.w})×${e.n}`).join("  "));
  const acak = (xs, n) => [...xs].sort((a, b) => hash(JSON.stringify(a)).localeCompare(hash(JSON.stringify(b)))).slice(0, n);
  console.log("\n30 judul acak:");
  for (const d of acak(data, 30)) console.log(`  ${d.skor.toFixed(2).padStart(6)} ${d.sentimen.padEnd(7)} [${d.isu}] ${d.judul}\n         ${d._jejak.join(" ")}`);
  console.log("\n20 contoh item dibuang:");
  for (const j of acak(dibuang, 20)) console.log("  " + j);
}
