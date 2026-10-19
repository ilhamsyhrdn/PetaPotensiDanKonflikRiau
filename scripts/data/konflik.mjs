// Titik konflik se-Provinsi Riau dari sumber terbuka:
//   1) TanahKita.id — basis data konflik agraria kurasi masyarakat sipil (JKPP dkk.), plus halaman detail (status, keterlibatan, lampiran)
//   2) Google News RSS — judul berita konflik/sengketa/protes, dilokasikan dengan gazetir dan dideduplikasi per kejadian
// Hasil: data/sumber/konflik.json
// Jalankan: node scripts/data/konflik.mjs   (tambah --segar untuk mengabaikan cache unduhan)
import fs from "node:fs";
import path from "node:path";
import { CACHE, SUMBER, ambil, slug, hash, simpan, tidur, bersihJudul, rapikanTeks } from "./_lib.mjs";
import { cariWilayah, lokasiDariTitik, titikWilayah, getWilayah, rantai, WILAYAH, adalahTempat } from "./_gazetir.mjs";

const SEGAR = process.argv.includes("--segar");
const SEKTOR = ["Perkebunan", "Hutan Produksi", "Hutan Lindung", "Hutan Konservasi", "Pertambangan", "Minyak dan Gas", "Infrastruktur", "Infrastruktur Energi Listrik", "Kawasan Industri", "Sarana Umum", "Pariwisata", "Transmigrasi", "Pesisir dan Laut", "Perumahan dan Kota Baru", "Lainnya"];
const STATUS_TK = { BD: "Belum ditangani", PS: "Dalam proses", SL: "Selesai" };

// unduh lewat cache; jeda hanya bila benar-benar mengakses server
async function unduh(url, kunci, jeda) {
  const adaCache = !SEGAR && fs.existsSync(path.join(CACHE, kunci));
  const teks = await ambil(url, { kunci, segar: SEGAR });
  if (!adaCache) await tidur(jeda);
  return teks;
}

// ---------- teks ----------
const ENTITAS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const dekode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITAS[e.toLowerCase()] ?? m));
const polos = (html) => dekode(String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t\r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9/]+/g, " ").trim();
// rapikan singkatan bertitik supaya pemotongan kalimat tidak salah
const rapikan = (s) => s.replace(/\bPT\s*\.\s*/g, "PT ").replace(/\bCV\s*\.\s*/g, "CV ").replace(/\bKab\.\s*/g, "Kabupaten ").replace(/\bKec\.\s*/g, "Kecamatan ").replace(/\bTbk\.?/g, "Tbk").replace(/[ \t]+/g, " ").trim();

/** Ringkasan ≤ maks karakter berupa kalimat utuh; bila kalimat pertama terlalu panjang, dipotong di batas kata. */
function ringkas(teks, maks = 280) {
  const t = rapikan(teks).replace(/\s+/g, " ").trim();
  if (t.length <= maks) return t;
  let hasil = "";
  for (const k of t.match(/[^.!?]+[.!?]+["”’)]*(?=\s|$)/g) ?? []) {
    if ((hasil + k).trim().length > maks) break;
    hasil += k;
  }
  if (hasil.trim()) return hasil.trim();
  return t.slice(0, maks - 1).replace(/\s+\S*$/, "").replace(/[\s,;:–-]+$/, "") + "…";
}

// ---------- wilayah ----------
const namaKab = (id) => { const k = getWilayah(id); return k ? (["Pekanbaru", "Dumai"].includes(k.nama) ? "Kota " : "Kabupaten ") + k.nama : ""; };
const kabDari = (id) => rantai(id).find((w) => w.level === "kabupaten")?.id ?? null;
const ALIAS = { rohil: "Rokan Hilir", rohul: "Rokan Hulu", inhu: "Indragiri Hulu", inhil: "Indragiri Hilir", kuansing: "Kuantan Singingi", meranti: "Kepulauan Meranti" };
// nama wilayah (dinormalisasi) → nama baku; dipakai untuk memvalidasi "Bupati X", "Warga Desa X", dst.
const NAMA_WIL = new Map([["riau", "Riau"], ...Object.entries(ALIAS)]);
for (const w of WILAYAH) if (!NAMA_WIL.has(norm(w.nama))) NAMA_WIL.set(norm(w.nama), w.nama);
// nama kota/ibu kabupaten yang lazim dipakai nama lembaga (PN Teluk Kuantan, Polsek Duri)
for (const n of ["Teluk Kuantan", "Tembilahan", "Bangkinang", "Pangkalan Kerinci", "Bagansiapiapi", "Pasir Pengaraian", "Selatpanjang", "Duri", "Perawang"]) NAMA_WIL.set(norm(n), n);
// tempat terkenal yang tidak dikenali gazetir tanpa nama kabupatennya → sisipkan kabupaten
const PENGAYA = [
  [/\bsiak hulu\b/i, "Kampar"], [/\btapung\b/i, "Kampar"], [/\bkijang rejo\b/i, "Kampar"], [/\bkuala kampar\b/i, "Pelalawan"], [/\bteluk meranti\b/i, "Pelalawan"],
  [/\b(kandis|minas|dayun|tualang|koto gasib|sungai mandau)\b/i, "Siak"], [/\b(mandau|bathin solapan|rupat|balai makam|sebangar|talang muandau)\b/i, "Bengkalis"],
  [/\b(rantau bais|bagan batu|bagan sinembah|ujung tanjung|tanah putih|pujud|sinaboi)\b/i, "Rokan Hilir"], [/\b(tambusai|ujung ?batu|kunto darussalam|bonai darussalam|rantau kasai|kepenuhan)\b/i, "Rokan Hulu"],
  [/\b(rengat|air molek|peranap|seberida|batang gan[g]?sal|kuala cenaku)\b/i, "Indragiri Hulu"], [/\b(kemuning|keritang|tempuling|reteh|enok)\b/i, "Indragiri Hilir"],
  [/\b(ukui|langgam|tesso nilo|tntn|pangkalan kuras|bunut)\b/i, "Pelalawan"], [/\b(singingi|logas|cerenti)\b/i, "Kuantan Singingi"], [/\bpulau padang\b/i, "Kepulauan Meranti"],
  [/\b(rumbai|tenayan|marpoyan|payung sekaki|binawidya|tuah madani|senapelan)\b/i, "Pekanbaru"],
];
/**
 * Lokasikan teks berita. Kata umum ("duri dalam daging", "kayu meranti"), nama sungai, nama jalan, dan kota/kawasan dikenal
 * ditangani gazetir; di sini teks diperkaya kabupaten tempat terkenal dan diulang tanpa "Pekanbaru" (lokasi aksi/rapat) bila ambigu.
 */
function lokasiTeks(teks) {
  // pengadilan di Pekanbaru hanya tempat sidang; ruas tol Pekanbaru–Rengat berawal di Pekanbaru (bukan lokasi di Inhu)
  let t = teks.replace(/\b(PN|Pengadilan Negeri|Pengadilan Tinggi|PTUN|PT TUN) Pekanbaru\b/gi, " ").replace(/\btol\s+(pekanbaru\s*[-–—]?\s*rengat|rengat\s*[-–—]?\s*pekanbaru)\b/gi, "tol Pekanbaru");
  const tambah = PENGAYA.filter(([re]) => re.test(t)).map(([, kab]) => kab);
  if (tambah.length) t += " " + [...new Set(tambah)].join(" ");
  const hasil = cariWilayah(t) ?? (/pekanbaru/i.test(t) ? cariWilayah(t.replace(/pekanbaru/gi, " ")) : null);
  if (hasil) return hasil;
  // banyak kabupaten disebut di anak kalimat berbeda ("Sidang di PN X, Warga Y …"): ambil anak kalimat pertama yang terlokasi;
  // bila satu anak kalimat menyebut dua kabupaten ("Rohul dan Kampar") kejadian tetap tak dilokasikan
  for (const bagian of teks.split(/[,:;|]/)) {
    const b = bagian.trim();
    if (b.length > 8 && b !== teks.trim()) { const l = cariWilayah(b); if (l) return l; }
  }
  return null;
}

// ---------- klasifikasi ----------
// Urutan = prioritas. Nama perusahaan yang sudah dikenal sektornya ikut dicantumkan (Torganda, Surya Dumai, NWR, SRL, …).
const ATURAN_SEKTOR = [
  ["Minyak dan Gas", /pertamina|\bphr\b|hulu rokan|chevron|\bcpi\b|migas|minyak (bumi|mentah|cemari|mencemari|tumpah)|sumur (minyak|migas|gas|produksi)|pipa (minyak|migas|gas|pertamina|phr)|\bcpp\b|blok (rokan|siak|kampar|langgak)|wk rokan|skk migas|bumi siak pusako|\bbsp\b|tumpahan minyak|\bflare\b|kilang(?! (padi|sagu|beras))|pertagas|\bpgn\b|perusahaan minyak|tambang minyak|lapangan (minyak|migas)|\bttm\b|terkontaminasi minyak|energi mega persada|\bru ii\b/i],
  ["Infrastruktur Energi Listrik", /\bpln\b|sutet|\bsutt\b|transmisi listrik|tower listrik|tiang listrik|pltu|plts|plta|pltd|pltmg|pltbm|gardu induk|pembangkit listrik|ratch power|power plant|listrik/i],
  ["Pertambangan", /pertambangan|penambangan|tambang (emas|pasir|batu|ilegal|galian|bauksit|timah|nikel)|perusahaan tambang|galian c|\bpeti\b|batu ?bara|pasir laut|(sedot|kapal isap|galian|penambang|tambang) pasir|pasir (ilegal|kuarsa)|bauksit|tanah (urug|timbun)|(pengangkutan|angkutan|pengambilan) tanah|\bkuari\b|quarry|\bsirtu\b|\bmining\b|(?<!desa |kecamatan |kec )\btambang\b/i],
  ["Hutan Konservasi", /taman nasional|tesso nilo|\btntn\b|\btnbt\b|bukit ?(tiga|30) ?puluh|suaka margasatwa|\bsm (kerumutan|balai raja|giam|rimbang|tasik)|giam siak kecil|rimbang baling|cagar (biosfer|alam)|kawasan konservasi|hutan konservasi|taman hutan raya|tahura|taman wisata alam/i],
  ["Hutan Lindung", /hutan lindung/i],
  ["Kawasan Industri", /kawasan industri|\bkek\b|indah kiat|\bikpp\b|pabrik (kertas|pulp|kayu lapis|plywood|semen|ban|karet|crumb rubber|pupuk|kimia|sagu|kelapa terpadu)|plywood|kayu lapis|\bkit\b|kemasindo|produsen ban|pulau sambu|sambu group|smelter|hilirisasi/i],
  ["Transmigrasi", /transmigra/i],
  ["Hutan Produksi", /\bhti\b|hutan tanaman|akasia|acacia|eukaliptus|ekaliptus|\brapp\b|riau andalan|arara abadi|april group|asia pacific resources|asia pulp|iuphhk|\bhph\b|\bpbph\b|phpl|hutan produksi|\bhpt\b|\bhpk\b|konsesi hutan|perhutanan sosial|\bkph\b|\bkth\b|kelompok tani hutan|nusa wana raya|\bnwr\b|sumatera riang lestari|\bsrl\b|sumatera s[iy]lva lestari|\bssl\b|seraya sumber lestari|(perkebunan|kebun) kayu|truk kayu|illegal ?logging|pembalakan|kayu ilegal|perambahan|perambah|merambah|dirambah|jalan koridor|rimba peranap|\brpi\b|madukoro|perusahaan (kayu|hti)|\baphi\b|hutani|\bforest|timber/i],
  ["Infrastruktur", /jalan tol|\btol\b|jembatan|bandara|pelabuhan|pelindo|bendungan|waduk|irigasi|flyover|proyek strategis nasional|\bpsn\b|rel kereta|jalur kereta|embung|normalisasi sungai|\broro\b|terminal bus/i],
  ["Perkebunan", /sawit|perkebunan|\bkebun\b|ptpn|\bptp\b|palmco|\bhgu\b|hak guna usaha|plasma|kkpa|\bpks\b|pmks|\btbs\b|\bcpo\b|\bkaret\b|kopsa|agrinas|kelapa|\bkso\b|replanting|peremajaan|\bpsr\b|plantation|\bpalma?\b|\bagro|\bagri\b|agrindo|asian agri|first resources|wilmar|musim mas|duta ?palma|torganda|surya dumai|salim ivomas|ivomas|sindora|sedora|\bktu\b|kimia tirta|astra agro|\badei\b|mitra unggul pusaka|\bmup\b|ciliandra|wanasari|\bwsn\b|duta swakarya|\bdsi\b|\bsbp\b|serikat putra|tabung haji|\bthip\b|gandaerah|gandahera|padasa|indosawit|national sago|\bsagu\b|lahan sitaan|sitaan (satgas|negara)|satgas pkh|koperasi sawit|apkasindo|\bgapki\b|\bispo\b|\brspo\b|priatama/i],
  ["Hutan Produksi", /kawasan hutan|konsesi/i],
  ["Pesisir dan Laut", /nelayan|pesisir|abrasi|\blaut\b|perairan|mangrove|bakau|pantai(?! raja)|tambak|reklamasi/i],
  ["Pariwisata", /pariwisata|wisata|resort/i],
  // aturan "lemah" (true): boleh ditimpa sektor mayoritas perusahaan/tempat yang sama
  ["Perumahan dan Kota Baru", /tempat tinggal|rumah warga|\brumah\b|pemukiman|permukiman|bermukim|perumahan|perumnas|pengembang|developer|rumah susun|kota baru|\bruko\b|\bshm\b|\bhgb\b|\bhpl\b|sertifikat (ganda|tumpang tindih|bodong|palsu)|tumpang tindih (sertifikat|izin)|kavling|kapling|pembongkaran (pagar|rumah|bangunan)|eksekusi (rumah|bangunan)|swalayan|drive thru|digusur paksa|kehilangan (rumah|tempat tinggal)/i, true],
  ["Sarana Umum", /tanah wakaf|\bwakaf\b|(lahan|tanah|aset|areal?|lokasi|pembangunan|pembongkaran|penggusuran|sengketa|klaim|eksekusi|ganti rugi|serobot\w*|markup) (\w+ ){0,2}(sekolah|sd|smp|sma|smpn|sdn|sman|smkn|madrasah|pasar|masjid|musala|mushala|makam|kuburan|pemakaman|puskesmas|rumah sakit|rsud|kantor (desa|camat|bupati|lurah|wali ?kota)|balai desa|lapangan|stadion|gor|terminal|tpa|tpst)\b|\b(sdn|smpn|sman|smkn|ponpes|pondok pesantren|pesantren)\b|eks lapangan|perkantoran|(pemkab|pemko|pemda|pemprov)[^.]{0,60}aset|fasilitas umum|\bfasum\b|\bfasos\b|tanah kas desa|aset (pemda|pemkab|pemko|pemprov|daerah|desa)|lahan (pemda|pemkab|pemko|pemprov|dprd|kantor)/i, true],
  ["Hutan Produksi", /\bhutan\b(?! (adat|desa|kota))/i, true],
  ["Kawasan Industri", /pabrik|industri|smelter|gudang|produsen/i, true],
  ["Infrastruktur", /(pembangunan|proyek|perbaikan|perbaiki|kerusakan|merusak|rusak\w*|lintas|tanam pohon( pisang)? di|akses) jalan|jalan (rusak|lintas|provinsi|kabupaten|negara|nasional|poros|penghubung|desa|umum|pemda|perusahaan|hauling|berlumpur|berdebu|berlubang|hancur|amblas|ditutup)|jalan \S+( \S+)?\s*[-–]\s*\S+( \S+)? rusak|jalan \S+( \S+)? (rusak|berdebu|berlumpur|hancur|amblas)|debu (truk|jalan)|truk (overload|over ?tonase|odol|bermuatan)|over ?tonase|overload|\bodol\b|teronton|infrastruktur|drainase/i, true],
  ["Perkebunan", /(koperasi|\bkud\b|kelompok tani|\bpoktan\b|gapoktan|\bkoptan\b|petani)\b[\s\S]*\b(lahan|kebun|hektare|hektar|\bha\b|tanah|agraria)|(lahan|kebun|hektare|hektar|tanah|agraria)\b[\s\S]*\b(koperasi|\bkud\b|kelompok tani|\bpoktan\b|gapoktan|\bkoptan\b)/i, true],
];
const sektorDari = (teks) => { const a = ATURAN_SEKTOR.find(([, re]) => re.test(teks)); return a ? { sektor: a[0], lemah: !!a[2] } : { sektor: "Lainnya", lemah: true }; };
// pemetaan sektor TanahKita yang tidak ada di daftar SEKTOR
const SEKTOR_TK = { Bendungan: "Infrastruktur", "Sarana Militer/Pemerintahan": "Sarana Umum", "Kawasan Konservasi Laut": "Pesisir dan Laut" };

const ATURAN_JENIS = [
  ["Kriminalisasi", /kriminalisasi|dikriminalisasi|dipolisikan|(petani|warga|nelayan)( \S+){0,2} (ditangkap|ditahan|dipenjara)|penangkapan (petani|warga)|penahanan (petani|warga)/i],
  ["Pencemaran lingkungan", /pencemaran|tercemar|mencemari|cemari|limbah|polusi|bau busuk|ikan (mati|mabuk)|tumpahan minyak|minyak (mentah )?tumpah|oil spill|kebocoran pipa|pipa bocor|semburan|gas beracun|\bh2s\b|(penghancuran|perusakan|pengrusakan|kerusakan) (lahan gambut|gambut|lingkungan|hutan|sungai)/i],
  ["Kebakaran hutan & lahan", /karhutla|kebakaran (hutan|lahan)|lahan terbakar|hutan terbakar|titik api|hotspot/i],
  ["Ketenagakerjaan", /\bphk\b|di-?phk|upah|gaji|mogok|pesangon|\bthr\b|tenaga kerja|\bnaker\b|outsourcing|serikat (pekerja|buruh)|\bburuh\b/i],
  ["Tanah ulayat/adat", /ulayat|masyarakat adat|warga adat|tanah adat|hutan adat|wilayah adat|hak adat|lembaga adat|\blamr?\b|suku (sakai|talang mamak|akit|bonai|duano|asli|laut)|talang mamak|ninik mamak|kenegerian|persukuan|pebatinan/i],
  ["Ganti rugi", /ganti rugi|ganti untung|kompensasi|pembebasan lahan|tali asih|sagu hati|belum dibayar/i],
  ["CSR/TJSL", /\bcsr\b|\btjsl\b|tanggung jawab sosial|\bppm\b|pemberdayaan masyarakat/i],
  ["Sengketa lahan", /lahan|tanah|sengketa|serobot|klaim|\bhgu\b|rampas|caplok|okupasi|gusur|eksekusi|tapal batas|batas desa|sertifikat|mafia tanah|agraria|reclaiming|penguasaan|patok|pengukuran ulang|plasma|kebun|perambahan|\bkso\b|panen/i],
  ["Akses & infrastruktur", /jalan|portal|blokir|blokade|jembatan|listrik|air bersih|banjir|truk|angkutan|hauling/i],
];
const jenisDari = (teks, bawaan = "Lainnya") => ATURAN_JENIS.find(([, re]) => re.test(teks))?.[0] ?? bawaan;
// sektor agraria tanpa kata kunci isu yang jelas hampir selalu soal penguasaan lahan
const SEKTOR_AGRARIA = new Set(["Perkebunan", "Hutan Produksi", "Hutan Lindung", "Hutan Konservasi", "Transmigrasi"]);

// ---------- keterlibatan (lembaga/perusahaan/kelompok, tanpa nama orang) ----------
const PERUSAHAAN_DIKENAL = [
  [/(PT\.?\s*)?Pertamina Hulu Rokan|\bPHR\b/, "PT Pertamina Hulu Rokan (PHR)"], [/Chevron( Pacific Indonesia)?|\bCPI\b/, "PT Chevron Pacific Indonesia (CPI)"],
  [/Riau Andalan Pulp (and|&) Paper|\bRAPP\b/, "PT Riau Andalan Pulp and Paper (RAPP)"], [/Arara Abadi/i, "PT Arara Abadi"], [/Indah Kiat|\bIKPP\b/, "PT Indah Kiat Pulp and Paper (IKPP)"],
  [/Agrinas/i, "PT Agrinas Palma Nusantara"], [/Bumi Siak Pusako|\bBSP\b/, "PT Bumi Siak Pusako (BSP)"], [/\bPLN\b/, "PT PLN (Persero)"], [/Asian Agri/i, "Asian Agri"],
  [/Sinar ?Mas/i, "Sinar Mas"], [/Wilmar/i, "Wilmar"], [/Musim Mas/i, "Musim Mas"], [/Duta Palma/i, "Duta Palma"], [/Duta Swakarya Indah|\bPT DSI\b/, "PT Duta Swakarya Indah (DSI)"],
  [/Tunggal Perkasa Plantation|\bPT TPP\b/, "PT Tunggal Perkasa Plantations (TPP)"], [/Sumatera Riang Lestari|\bPT SRL\b/, "PT Sumatera Riang Lestari (SRL)"], [/Nusa Wana Raya|\bPT NWR\b/, "PT Nusa Wana Raya (NWR)"],
  // "PT SSL" sengaja tidak dipetakan: bisa PT Sumatera Silva Lestari (Rohul) atau PT Seraya Sumber Lestari (Siak)
  [/Sumatera S[iy]lva Lestari/i, "PT Sumatera Silva Lestari"], [/Seberida Subur/i, "PT Seberida Subur"],
];
// kata yang menghentikan nama perusahaan pada judul berita bergaya Title Case
const HENTI = new Set(("di ke dari dan dengan vs versus soal terkait yang untuk atas oleh dalam pada ini itu agar hingga sampai serta bersama tak tidak belum sudah masih akan harus wajib segera kembali lagi terus mulai juga pun " +
  "warga masyarakat petani nelayan buruh karyawan pekerja kelompok koperasi desa kampung lahan tanah kebun hutan sungai jalan kantor dprd pemkab pemprov polres polda bupati gubernur " +
  "diduga duga tolak menolak ditolak gusur menggusur serobot menyerobot caplok klaim garap rusak merusak kuasai menguasai cemari mencemari tutup menutup blokir digugat gugat dilaporkan lapor laporkan " +
  "didemo demo bayar dibayar minta diminta tuntut dituntut menuntut bantah akui janji siap mangkir abaikan langgar beroperasi berkonflik konflik sengketa bentrok bentrokan memanas panas ricuh " +
  "dipanggil panggil hadir mediasi bahas sepakat damai ganti rugi kerahkan tuding desak didesak minta audit ukur diukur keluarkan cabut dicabut izin ilegal tersangka tetapkan resmi " +
  "berlarut larut berlarut-larut makin kian usai selesai tuntas vs. vs, rp ha hektare hektar ribu juta miliar triliun " +
  "masuk tahap saling lempar over tonase tagih bawa buang kepergok sebut apresiasi langkah gelar aksi duduki negara meninggal tewas luka terluka serang hentikan dihentikan " +
  "turun bertemu temui datangi geruduk soroti sorot pertanyakan klarifikasi bantu salurkan serahkan raih beri berikan " +
  "berhasil berujung bersengketa bertikai berdamai bersitegang bermasalah berdalih bungkam capai").split(" "));
// kata kerja khas judul (di-/ter-/meN-/-kan) menandai akhir nama perusahaan/kelompok
const KATA_KERJA = /^(di|ter)[a-z]{3,}$|^(meng|meny|mem[bp]|men[cdjt])[a-z]{2,}$|[a-z]{3,}kan$|-/;
function potongNama(teks, maks = 4) {
  const kata = [];
  for (const k of teks.trim().split(/\s+/)) {
    const b = k.replace(/[.,;:!?"“”')]+$/, "");
    if (!b || HENTI.has(b.toLowerCase()) || !/^[A-Z0-9&(]/.test(b) || (!/^[A-Z0-9&()]+$/.test(b) && KATA_KERJA.test(b.toLowerCase()))) break;
    kata.push(b);
    if (kata.length >= maks || b !== k) break; // tanda baca mengakhiri nama
  }
  return kata;
}
function perusahaanDari(teks) {
  const hasil = new Set();
  for (const [re, nama] of PERUSAHAAN_DIKENAL) if (re.test(teks)) hasil.add(nama);
  for (const m of teks.matchAll(/\b(P[Tt]|CV|PTPN)\b\.?\s+([^\s,;:!?()"“”]+(?:\s+[^\s,;:!?()"“”]+){0,4})/g)) {
    // akronim (PT SBP) atau nomor PTPN (PTPN IV) sudah lengkap
    const kata = /^[A-Z]{2,6}$/.test(m[2].split(/\s+/)[0]) || m[1] === "PTPN" ? potongNama(m[2], 1) : potongNama(m[2]);
    if (!kata.length) continue;
    const nama = `${m[1].toUpperCase()} ${kata.join(" ")}`;
    // jangan duplikasi: cocok per kata ("PT RAPP" ⊂ "PT Riau Andalan … (RAPP)") atau singkatan ("PT SSL" ≈ "PT Seraya Sumber Lestari"); simpan yang lebih lengkap
    const kt = (x) => norm(x).split(" ").filter((k) => !["pt", "cv", "tbk", "persero"].includes(k));
    const ada = [...hasil].find((h) => kt(nama).every((k) => kt(h).includes(k)) || kt(h).every((k) => kt(nama).includes(k)) || kunciPT(h).some((k) => kunciPT(nama).includes(k)));
    if (!ada) hasil.add(nama);
    else if (nama.length > ada.length && !PERUSAHAAN_DIKENAL.some(([, n]) => n === ada)) { hasil.delete(ada); hasil.add(nama); }
  }
  return [...hasil];
}
// kunci pencocokan perusahaan: nama ternormalisasi + singkatan (PT Ujung Tanjung Sejahtera ≈ PT UTS, "(PHR)")
function kunciPT(nama) {
  const kata = norm(nama).split(" ").filter((k) => !["pt", "cv", "tbk", "persero"].includes(k));
  const singkat = kata.length >= 3 ? kata.map((k) => k[0]).join("") : null;
  return [kata.join(" "), singkat, nama.match(/\(([A-Z]{3,6})\)/)?.[1].toLowerCase()].filter(Boolean);
}

// cocokkan nama wilayah (1–4 kata) tepat setelah posisi tertentu; kembalikan nama baku
function wilayahSetelah(teks) {
  const kata = teks.trim().split(/\s+/).slice(0, 4);
  for (let n = kata.length; n >= 1; n--) {
    const k = norm(kata.slice(0, n).join(" "));
    if (NAMA_WIL.has(k)) return NAMA_WIL.get(k);
  }
  return null;
}
const JABATAN = [
  [/\b(Pemkab|Pemerintah Kabupaten|Pemda)\s+/g, (w) => `Pemerintah Kabupaten ${w}`], [/\b(Pemkot|Pemerintah Kota)\s+/g, (w) => `Pemerintah Kota ${w}`],
  [/\b(Pemprov|Pemerintah Provinsi)\s+/g, () => "Pemerintah Provinsi Riau"], [/\bDPRD\)?\s+(Provinsi\s+|Kabupaten\s+|Kota\s+)?/g, (w) => (w === "Riau" ? "DPRD Provinsi Riau" : `DPRD ${w}`)],
  [/\b(Polda|Kapolda|Wakapolda|Waka Polda)\s+/g, () => "Polda Riau"], [/\b(Polres|Polresta|Kapolres)\s+/g, (w) => `Polres ${w}`], [/\b(Polsek|Kapolsek)\s+/g, (w) => `Polsek ${w}`],
  [/\b(Bupati|Wabup|Wakil Bupati|Plt Bupati)\s+/g, (w) => `Bupati ${w}`], [/\b(Wali ?kota|Walkot|Wawako)\s+/g, (w) => `Wali Kota ${w}`],
  [/\b(Gubernur|Gubri|Plt Gubernur|Wagubri)\s*/g, () => "Gubernur Riau"], [/\bCamat\s+/g, (w) => `Camat ${w}`], [/\b(Kades|Kepala Desa|Penghulu|Datuk Penghulu)\s+/g, (w) => `Kepala Desa ${w}`],
  [/\b(Lurah)\s+/g, (w) => `Lurah ${w}`], [/\b(BPN|Kantah|Kantor Pertanahan)\s+/g, (w) => (w === "Riau" ? "Kanwil BPN Riau" : `BPN ${w}`)], [/\b(DLH|DLHK|Dinas Lingkungan Hidup)\s+/g, (w) => `Dinas Lingkungan Hidup ${w}`],
  [/\b(Disnaker|Disnakertrans)\s+/g, (w) => `Disnaker ${w}`], [/\b(Disbun|Dinas Perkebunan)\s+/g, (w) => `Dinas Perkebunan ${w}`], [/\b(Kejari|Kejaksaan Negeri)\s+/g, (w) => `Kejaksaan Negeri ${w}`],
  [/\b(PN|Pengadilan Negeri)\s+/g, (w) => `Pengadilan Negeri ${w}`],
];
const LEMBAGA_PUSAT = [
  [/\bKLHK\b|Kementerian Lingkungan Hidup dan Kehutanan/i, "KLHK"], [/Kemenhut|Kementerian Kehutanan/i, "Kementerian Kehutanan"], [/\bATR\s*\/?\s*BPN\b|Kementerian ATR|Kementerian Agraria/i, "Kementerian ATR/BPN"],
  [/Satgas PKH|Satgas Penertiban Kawasan Hutan/i, "Satgas PKH"], [/Komnas HAM/i, "Komnas HAM"], [/Ombudsman/i, "Ombudsman RI"], [/\bDPR RI\b|Komisi [IVX]+ DPR\b|\bDPR\b(?! ?D)/, "DPR RI"],
  [/\bKPK\b/, "KPK"], [/Mentrans|Kementerian Transmigrasi/i, "Kementerian Transmigrasi"], [/\bESDM\b/, "Kementerian ESDM"], [/SKK Migas/i, "SKK Migas"], [/Kementerian BUMN/i, "Kementerian BUMN"],
  [/Danrem|Korem 031/i, "Korem 031/Wira Bima"], [/Polda Riau|Kapolda/i, "Polda Riau"], [/Gubernur Riau|\bGubri\b/i, "Gubernur Riau"], [/DPRD\)? (Provinsi )?Riau\b/i, "DPRD Provinsi Riau"], [/Pemprov Riau|Pemerintah Provinsi Riau/i, "Pemerintah Provinsi Riau"],
];
function pemerintahDari(teks, lok) {
  const hasil = new Set(LEMBAGA_PUSAT.filter(([re]) => re.test(teks)).map(([, n]) => n));
  for (const [re, buat] of JABATAN) {
    for (const m of teks.matchAll(re)) {
      const w = wilayahSetelah(teks.slice(m.index + m[0].length));
      if (w) hasil.add(buat(w));
      // jabatan tanpa nama wilayah (biasanya diikuti nama orang) → jabatan + wilayah kejadian
      else if (lok && /Bupati|Wabup|Pemkab|Pemda|Polres|Kapolres/.test(m[1] ?? m[0]) && lok.kab) hasil.add(buat(lok.kabNama));
      else if (lok && /Kades|Kepala Desa|Penghulu/.test(m[1] ?? m[0]) && lok.desa) hasil.add(buat(lok.desa));
    }
  }
  return [...hasil].map((h) => h.replace(/\s+/g, " ").trim());
}

const KELOMPOK = /\b(Kelompok Tani|Poktan|Gapoktan|Koperasi|Kopsa|KUD|Serikat Petani|Serikat Tani|Forum|Aliansi|Paguyuban|Himpunan|Perkumpulan|Asosiasi)\s+((?:[A-Z0-9][\w'.&-]*\s*){1,4})/g;
const ORMAS = [[/\bLAMR?\b|Lembaga Adat Melayu/i, "Lembaga Adat Melayu Riau (LAMR)"], [/Walhi/i, "WALHI Riau"], [/Jikalahari/i, "Jikalahari"], [/\bKNARA\b/, "KNARA"], [/\bAMAN\b/, "AMAN"], [/LBH Pekanbaru/i, "LBH Pekanbaru"], [/\bSPI\b/, "Serikat Petani Indonesia (SPI)"]];
function masyarakatDari(teks, lok) {
  const hasil = new Set(ORMAS.filter(([re]) => re.test(teks)).map(([, n]) => n));
  for (const m of teks.matchAll(/\b(Warga|Masyarakat|Petani|Nelayan|Buruh)\s+(Adat\s+)?(Desa|Kelurahan|Kampung|Kepenghuluan|Dusun|Kecamatan)?\s*/gi)) {
    const w = wilayahSetelah(teks.slice(m.index + m[0].length));
    const kata = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    if (w && w !== "Riau") hasil.add([kata, m[2] ? "Adat" : "", m[3] ? m[3][0].toUpperCase() + m[3].slice(1).toLowerCase() : "", w].filter(Boolean).join(" "));
  }
  for (const m of teks.matchAll(/\bSuku\s+(Sakai|Talang Mamak|Akit|Bonai|Duano|Laut|Asli\s+[A-Z]\w+)/gi)) hasil.add(`Suku ${m[1].replace(/\b\w/g, (c) => c.toUpperCase())}`);
  for (const m of teks.matchAll(/\bMasyarakat Adat\s+((?:[A-Z][\w'-]*[.,]?\s*){1,4})/g)) {
    const nm = potongNama(m[1]);
    if (nm.length && !(nm.length === 1 && ["Desa", "Kampung"].includes(nm[0]))) hasil.add(`Masyarakat Adat ${nm.join(" ")}`);
  }
  for (const m of teks.matchAll(KELOMPOK)) {
    const nm = potongNama(m[2]);
    if (nm.length) hasil.add(`${m[1]} ${nm.join(" ")}`.replace(/^Kopsa /, "Koperasi ").replace(/^Poktan /, "Kelompok Tani "));
  }
  // hanya kata umum ("warga", "petani") → kelompok warga di wilayah kejadian
  if (![...hasil].some((h) => !ORMAS.some(([, n]) => n === h)) && lok) {
    const m = teks.match(/\b(warga|masyarakat|petani|nelayan|buruh|karyawan)\b/i);
    if (m) hasil.add(`${m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()} ${lok.label}`);
  }
  // "Warga Balam Sempurna" sudah tercakup "Warga Desa Balam Sempurna"
  const daftar = [...hasil];
  return daftar.filter((h) => !daftar.some((o) => o !== h && o.replace(/ (Desa|Kampung|Kelurahan|Kecamatan|Kepenghuluan|Dusun) /, " ") === h));
}

// konteks lokasi untuk melengkapi jabatan/kelompok tanpa nama wilayah
function konteks(wilayahId) {
  const r = rantai(wilayahId);
  const kab = r.find((w) => w.level === "kabupaten"), kec = r.find((w) => w.level === "kecamatan"), desa = r.find((w) => w.level === "desa");
  if (!kab) return null;
  return { kab: kab.id, kabNama: kab.nama, desa: desa?.nama, label: desa ? `Desa ${desa.nama}` : kec ? `Kecamatan ${kec.nama}` : namaKab(kab.id) };
}

// ---------- 1. TanahKita ----------
console.log("1/3 TanahKita.id");
const geo = JSON.parse(await unduh("https://tanahkita.id/data_service/map/jkpp.geojson?limit=5000&x_gte=95&y_gte=-11&y_lte=11", "tanahkita-jkpp.geojson", 2500));
const fiturRiau = geo.features.filter((f) => /^riau$/i.test(String(f.properties.nm_propinsi).trim()));
console.log(`  ${geo.features.length} fitur nasional, ${fiturRiau.length} di Riau`);

// perbaikan kecil isian keterlibatan TanahKita yang terpotong/salah ketik
const KOREKSI = { "PT R": "PT RAPP", "erkumpulan Elang": "Perkumpulan Elang", "KPH-SIAK": "KPH Siak" };
const AKRONIM = new Set(["PT", "CV", "LHK", "KPH", "DPRD", "BPN", "ATR", "RI", "HAM", "GCN", "PTPN", "RAPP", "IKPP", "DSI", "SRL", "SSL", "NWR", "KLHK", "KSP", "KBUMN", "DLHK", "LAMR", "AHTRMI", "SMBS"]);
const judulKata = (s) => (s === s.toUpperCase() && /\b(MASYARAKAT|DINAS|WARGA|DESA|KELOMPOK|PEMERINTAH|KABUPATEN|SUKU|ASLI|HUTAN|PETANI)\b/.test(s) ? s.toLowerCase().replace(/[a-z]+/g, (w) => (AKRONIM.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))) : s);
// buang isian yang tampak seperti nama orang (2–4 kata kapital tanpa kata kunci lembaga/wilayah)
const KUNCI_LEMBAGA = /\b(PT|CV|PTPN|Pemerintah|Pemda|Pemkab|Pemprov|Pemkot|DPRD|Kementerian|Dinas|Polsek|Polres|Polda|Bupati|Gubernur|Camat|Kepala|KPH|Komnas|Ombudsman|Masyarakat|Warga|Kelompok|Koperasi|Petani|Desa|Asosiasi|Perkumpulan|Suku|Forum|Serikat|Yayasan|Lembaga|Riau)\b/i;
const tampakOrang = (s) => /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(s) && !KUNCI_LEMBAGA.test(s) && !NAMA_WIL.has(norm(s.split(" ").slice(-1)[0]));
const bersihPihak = (list) => [...new Set(list.map((s) => rapikan(judulKata(KOREKSI[s.trim()] ?? s.trim())).replace(/\s+/g, " ").replace(/[.,;:]+$/, "").replace(/^\p{Ll}/u, (c) => c.toUpperCase())).filter((s) => s && !tampakOrang(s)))];

function detailTanahKita(html) {
  const ambilBaris = (label) => polos(html.match(new RegExp(`>${label}(?:&nbsp;)?</td>\\s*<td>:</td>\\s*<td>([\\s\\S]*?)</td>`))?.[1] ?? "");
  const pihak = {};
  for (const m of html.matchAll(/<label for="alamat">(Pemerintah|Perusahaan|Masyarakat)<\/label>([\s\S]*?)(?=<label|<h4)/g))
    pihak[m[1].toLowerCase()] = [...m[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => polos(x[1])).filter(Boolean);
  const blokLampiran = html.match(/LAMPIRAN<\/h4>([\s\S]*?)<\/table>/)?.[1] ?? "";
  const lampiran = [...blokLampiran.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ nama: polos(m[2]) || path.basename(m[1]), url: new URL(dekode(m[1]), "https://tanahkita.id/").href }));
  return { status: ambilBaris("Status Konflik"), konflik: ambilBaris("Konflik"), pihak, lampiran };
}

const dataTK = [];
for (const f of fiturRiau) {
  const p = f.properties;
  const urlDetail = `https://tanahkita.id/data_detail/index/${p.id_enc}`;
  let det = null;
  try { det = detailTanahKita(await unduh(urlDetail, `tanahkita-detail-${p.idx}.html`, 2500)); }
  catch (e) { console.warn(`  ! detail ${p.idx} gagal: ${e.message}`); }

  const bujur = +p.longitude, lintang = +p.latitude;
  let lok = Number.isFinite(bujur) && Number.isFinite(lintang) ? lokasiDariTitik([bujur, lintang]) : null;
  const lokKab = cariWilayah(String(p.nm_kabupaten ?? ""));
  if (lok && lokKab && kabDari(lok.wilayahId) !== lokKab.wilayahId) console.warn(`  ! ${p.idx}: titik jatuh di ${kabDari(lok.wilayahId)}, data menyebut ${p.nm_kabupaten}`);
  if (!lok) lok = lokKab;
  if (!lok) { console.warn(`  ! ${p.idx} tidak dapat dilokasikan, dilewati`); continue; }
  const koordinat = lok.presisi === "titik" ? [+bujur.toFixed(5), +lintang.toFixed(5)] : titikWilayah(lok.wilayahId);

  const judul = rapikan(polos(p.judul));
  const narasiAsli = polos(p.narasi) || polos(p.clip);
  const kab = namaKab(kabDari(lok.wilayahId));
  const sektor = SEKTOR.includes(p.nama_sektor) ? p.nama_sektor : SEKTOR_TK[p.nama_sektor] ?? "Lainnya";
  const sektorLain = sektor === "Lainnya" && p.nama_sektor && !SEKTOR.includes(p.nama_sektor) ? p.nama_sektor : polos(p.sektor_lain);
  const luas = parseFloat(p.luas), dampak = parseInt(p.dampak, 10);
  const status = STATUS_TK[p.status_konflik] ?? "Tidak diketahui";
  const tahapan = det?.status.match(/Dalam Proses\s*(\w+)/i)?.[1];
  const ctx = konteks(lok.wilayahId);

  // keterlibatan: dari halaman detail; kategori kosong dilengkapi heuristik judul+narasi
  const teksPihak = rapikan(`${judul}. ${narasiAsli}`);
  const tebak = { pemerintah: pemerintahDari(teksPihak, ctx), perusahaan: perusahaanDari(teksPihak), masyarakat: masyarakatDari(judul, ctx) };
  const keterlibatan = {};
  for (const k of ["pemerintah", "perusahaan", "masyarakat"]) {
    const dariDetail = bersihPihak(det?.pihak[k] ?? []);
    keterlibatan[k] = dariDetail.length ? dariDetail : bersihPihak(tebak[k]);
  }

  // ringkasan & narasi; entri lama tanpa narasi dibuatkan kalimat dari metadata
  const fakta = [`Konflik sektor ${sektor.toLowerCase()} di ${ctx?.label && ctx.label !== kab ? `${ctx.label}, ` : ""}${kab}`];
  if (luas > 0) fakta.push(`luas sekitar ${luas.toLocaleString("id-ID")} ha`);
  if (dampak > 0) fakta.push(`berdampak pada ${dampak.toLocaleString("id-ID")} jiwa`);
  const kalimatMeta = `${fakta.join(", ")}; status ${status.toLowerCase()}${tahapan ? ` (${tahapan.toLowerCase()})` : ""}.`;
  const ringkasan = ringkas(polos(p.clip) || polos(p.narasi) || `${judul}. ${kalimatMeta}`);
  const narasi = narasiAsli ? rapikan(narasiAsli) : `${judul}. ${kalimatMeta}`;

  // sumber: halaman TanahKita + tautan/lembaga yang dicantumkan pengisi data
  const teksSumber = polos(p.sumber);
  const tautan = [...new Set(teksSumber.match(/https?:\/\/[^\s,]+/g) ?? [])];
  const sumber = [{ nama: "TanahKita.id", url: urlDetail }, ...tautan.map((u) => ({ nama: new URL(u).hostname.replace(/^www\./, ""), url: u }))];
  const sisa = teksSumber.replace(/https?:\/\/[^\s,]+/g, "").replace(/[,\s]+/g, " ").trim();
  if (sisa) sumber.push({ nama: sisa, url: urlDetail });

  const teksKlas = `${judul} ${polos(p.clip)} ${keterlibatan.masyarakat.join(" ")} ${p.kategori === "K1" ? "masyarakat adat" : ""}`;
  dataTK.push({
    id: `k-tk-${p.idx}`, nomor: String(p.nomor_kejadian ?? p.idx), judul,
    tanggal: String(p.tgl_kejadian ?? "").slice(0, 10) || `${p.tahun}-01-01`, tahun: +p.tahun || +String(p.tgl_kejadian).slice(0, 4),
    jenis: jenisDari(teksKlas, "Sengketa lahan"), sektor, sektorLain,
    status, luasHa: luas > 0 ? luas : null, dampakJiwa: dampak > 0 ? dampak : null,
    kerahasiaan: /public/i.test(p.sifat ?? "Public") ? "Publik" : String(p.sifat),
    keterlibatan, ringkasan, narasi, sumber, lampiran: det?.lampiran ?? [],
    wilayahId: lok.wilayahId, presisi: lok.presisi, koordinat, asal: "TanahKita",
  });
}
console.log(`  ${dataTK.length} entri TanahKita`);

// ---------- 2. Google News RSS ----------
console.log("2/3 Google News RSS");
const KUERI = [
  "konflik lahan Riau", "sengketa lahan Riau", "bentrok warga perusahaan Riau", "tanah ulayat Riau", "ganti rugi lahan Riau", "demo warga perusahaan Riau",
  "pencemaran limbah Riau", "kriminalisasi petani Riau", "konflik agraria Riau", "PHR warga protes", "Pertamina Hulu Rokan warga tuntut", "PHR ganti rugi lahan warga",
  "tumpahan minyak warga Riau", "limbah pabrik kelapa sawit sungai Riau", "plasma sawit tuntut warga Riau", "Satgas PKH konflik warga Riau", "Agrinas konflik warga Riau",
  "masyarakat adat Riau tuntut hak", "buruh demo perusahaan Riau", "jalan rusak truk perusahaan warga Riau",
  "konflik lahan Rokan Hilir", "konflik lahan Rokan Hulu", "konflik lahan Bengkalis", "konflik lahan Siak", "konflik lahan Kampar", "konflik lahan Pelalawan",
  "konflik lahan Indragiri Hulu", "konflik lahan Indragiri Hilir", "sengketa lahan Kuansing", "sengketa lahan Kepulauan Meranti", "sengketa lahan Pekanbaru", "sengketa lahan Dumai",
  "warga protes perusahaan Rohil", "warga protes perusahaan Rohul", "warga protes perusahaan Bengkalis Duri", "warga protes perusahaan Siak", "warga protes perusahaan Kampar",
  "warga protes perusahaan Pelalawan", "warga protes perusahaan Inhu", "warga protes perusahaan Inhil", "warga protes perusahaan Kuansing", "warga protes Meranti Dumai",
  // desa studi SIM
  "Rantau Bais warga", "Balai Makam warga", "Sebangar warga", "Kijang Rejo warga", "Kandis warga protes perusahaan", "Perawang warga protes",
];
// kueri umum diulang dengan rentang setahun terakhir agar berita terbaru tidak tergeser
const SETAHUN = KUERI.slice(0, 11).map((q) => `${q} when:1y`);

const item = new Map(); // guid → item
for (const q of [...KUERI, ...SETAHUN]) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
  let xml;
  try { xml = await unduh(url, `gnews-${slug(q)}.xml`, 2000); }
  catch (e) { console.warn(`  ! kueri "${q}" gagal: ${e.message}`); continue; }
  for (const blok of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const tag = (n) => blok.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`))?.[1] ?? "";
    const media = polos(tag("source"));
    // judulAsli dipakai untuk mengenali awalan format ("Oalah", "Infografis") sebelum dibersihkan
    const judulAsli = rapikanTeks(polos(tag("title")));
    const judul = bersihJudul(judulAsli, { media, tempat: adalahTempat });
    let deskripsi = rapikanTeks(polos(dekode(tag("description"))).replace(media, ""));
    // deskripsi feed biasanya = judul asli + nama media; simpan hanya bila ada cuplikan lain
    if (norm(deskripsi).includes(norm(judul)) && norm(deskripsi).length - norm(judul).length < 40) deskripsi = "";
    const guid = polos(tag("guid")) || tag("link");
    if (Number.isNaN(new Date(tag("pubDate")).getTime())) continue;
    if (!item.has(guid)) item.set(guid, { judul, judulAsli, deskripsi, media: media || "Google News", url: dekode(tag("link")).trim(), tanggal: new Date(tag("pubDate")) });
  }
}
console.log(`  ${KUERI.length + SETAHUN.length} kueri, ${item.size} item unik`);

// saringan relevansi: wajib ada kata konflik DAN objek sumber daya/aktor ekonomi
const KATA_KONFLIK = /konflik|sengketa|bentrok|ricuh|rusuh|protes|demo\b|unjuk rasa|aksi (massa|damai|warga)|tuntut|tuntutan|menuntut|desak|pencemaran|tercemar|cemari|dugaan limbah|limbah beracun|buang limbah|pembuangan limbah|kriminalisasi|tolak|menolak|penolakan|gugat|gugatan|serobot|penyerobotan|rampas|caplok|klaim|belum (dibayar|dibayarkan|terima|menerima|ada kejelasan)|tak kunjung|mogok|blokade|blokir|portal|hadang|resah|keluhkan|mengeluh|mengadu|aduan|pengaduan|\blapor\b|melapor|dilaporkan|laporkan|geruduk|duduki|okupasi|gusur|penggusuran|eksekusi|mediasi|keberatan|dipolisikan|ditangkap|diserang|penyerangan|tumpahan minyak|kebocoran pipa|pipa bocor|memanas/i;
const KATA_OBJEK = /lahan|tanah|kebun|sawit|hutan|perusahaan|\bpt\b|ptpn|\bphr\b|pertamina|chevron|limbah|sungai|ulayat|adat|ganti rugi|\bhgu\b|\bhti\b|tambang|galian|plasma|koperasi|kopsa|karyawan|buruh|pekerja|\bcsr\b|tjsl|minyak|pipa|sumur|kawasan|konsesi|izin|nelayan|laut|abrasi|\bpln\b|sutet|\btol\b|pabrik|\bpks\b|gambut|agraria|agrinas|satgas pkh|\bkso\b|transmigrasi|\bpeti\b|\bjalan (rusak|lintas|provinsi|kabupaten|desa|tol|perusahaan|hauling|koridor|poros)|kerusakan jalan|akses jalan|perbaik\w* jalan/i;
// berita non-kejadian (kebijakan umum, acara, kriminal biasa, konflik satwa, sengketa pemilu)
const BUKAN = /gajah|harimau|buaya|beruang|satwa|pilkada|pilkades|pemilu|pileg|sengketa (pilkada|pemilu|pilkades|informasi)|seminar|webinar|\bfgd\b|workshop|sosialisasi|pelatihan|bimtek|edukasi|penyuluhan|lomba|festival|dianugerahi|penghargaan|\bfilm\b|nobar|lowongan|sinopsis|sepak ?bola|liga \d|narkoba|sabu|judi|korupsi (dana|bbm|anggaran|kendaraan)|penipuan|tawuran|pembunuhan|asmara|cerai|warisan|lapas|kecelakaan|terguling|terbalik|tabrakan|\b(r?apbd|perda|ranperda)\b|(cegah|mencegah|pencegahan) (sengketa|konflik)|pendaftaran tanah ulayat|terpidana pencurian|pencurian (sawit|tbs|buah sawit|brondolan|pipa|kabel|trafo)/i;
// bukan peristiwa konflik: opini/feature/editorial, acara (diskusi, peluncuran buku), profil tokoh, gosip, program peningkatan kapasitas
const BUKAN_PERISTIWA = /^(oalah|infografis|opini|editorial|tajuk|kolom|resensi|podcast|profil|sosok|catatan|refleksi|cerpen|puisi|ulasan)\b|^"[^"]{3,80}"\s*:|\b(opini|editorial|tajuk rencana|diskusi (publik|panel|terbatas|ilmiah)|bedah buku|(peluncuran|launching|luncurkan|meluncurkan) buku|talk ?show|dialog publik|kuliah umum|lokakarya|kapasitas hukum|perkuat kapasitas|peningkatan kapasitas|rapat akbar|parlemen jalanan|seperti penyakit|ahli( \w+){1,2} ingatkan|resolusi konflik|one map policy|(bukan|tidak|tak) terkait (konflik|sengketa))\b/i;
const PROV_LAIN = /\b(jambi|sumsel|sumatera selatan|sumut|sumatera utara|sumbar|sumatera barat|kepri|kepulauan riau|batam|rempang|tanjung ?pinang|bintan|karimun|natuna|lingga|anambas|kalimantan|kalbar|kalteng|kaltim|kalsel|ketapang(?! permai)|jawa|jakarta|banten|banyuwangi|pesanggaran|aceh|dprk|nagan|papua|sulawesi|konawe|maluku|bali|\bntt\b|\bntb\b|lampung|bengkulu|bangka|belitung|prabumulih|palembang|medan|padang|bukittinggi|labuhanbatu|asahan|muara enim|ogan|tebo|bungo|merangin|sarolangun|batanghari|tanjung jabung|kuala tungkal|langkat|deli serdang|pasaman|dharmasraya|sijunjung|malaysia|singapura)\b/i;
const NAMA_RIAU_KUAT = /\briau\b(?<!kepulauan riau)|rokan|bengkalis|siak|kampar|pelalawan|indragiri|kuantan|meranti|pekanbaru|dumai|rohil|rohul|inhu|inhil|kuansing/i;

// kata fungsi yang diabaikan saat membandingkan judul
const KATA_FUNGSI = new Set("dan dengan yang untuk atas oleh dalam pada ini itu agar hingga serta bersama tak tidak belum sudah masih akan soal terkait jadi ada bisa riau warga kab kabupaten kota".split(" "));
const kandidat = [];
const alasan = { relevansi: 0, bukan: 0, bukanPeristiwa: 0, provLain: 0, lokasi: 0 };
const contohBukanPeristiwa = [];
for (const it of item.values()) {
  const teks = `${it.judul} ${it.deskripsi}`;
  if (!(KATA_KONFLIK.test(teks) && KATA_OBJEK.test(teks))) { alasan.relevansi++; continue; }
  if (BUKAN.test(teks)) { alasan.bukan++; continue; }
  if (BUKAN_PERISTIWA.test(it.judulAsli) || BUKAN_PERISTIWA.test(it.judul)) { alasan.bukanPeristiwa++; contohBukanPeristiwa.push(it.judulAsli); continue; }
  if (PROV_LAIN.test(teks) && !NAMA_RIAU_KUAT.test(teks.replace(/kepulauan riau/gi, ""))) { alasan.provLain++; continue; }
  const lok = lokasiTeks(teks);
  if (!lok) { alasan.lokasi++; continue; }
  const r = rantai(lok.wilayahId);
  kandidat.push({ ...it, ...lok, kab: kabDari(lok.wilayahId), kec: r.find((w) => w.level === "kecamatan")?.id ?? null,
    pt: perusahaanDari(rapikan(it.judul)).flatMap(kunciPT), token: new Set(norm(it.judul).split(" ").filter((k) => k.length > 2 && !KATA_FUNGSI.has(k))) });
}
console.log(`  ${kandidat.length} relevan & terlokasi; dibuang: ${Object.entries(alasan).map(([k, v]) => `${k} ${v}`).join(", ")}`);

// deduplikasi → satu kejadian bila kabupaten sama, rentang klaster ≤ 14 hari, dan
//   (a) judul mirip (koefisien Dice token ≥ 0,6), atau (b) menyebut perusahaan yang sama dalam ≤ 7 hari dan kecamatannya tidak bertentangan
kandidat.sort((a, b) => a.tanggal - b.tanggal);
const dice = (a, b) => { let s = 0; for (const t of a) if (b.has(t)) s++; return (2 * s) / (a.size + b.size || 1); };
const mirip = (a, b) => dice(a.token, b.token) >= 0.6 ||
  (a.pt.some((p) => b.pt.includes(p)) && Math.abs(b.tanggal - a.tanggal) <= 7 * 864e5 && (!a.kec || !b.kec || a.kec === b.kec));
const klaster = [];
for (const k of kandidat) {
  const c = klaster.find((c) => c.kab === k.kab && k.tanggal - c.awal <= 14 * 864e5 && c.anggota.some((a) => mirip(a, k)));
  if (c) c.anggota.push(k); else klaster.push({ kab: k.kab, awal: k.tanggal, anggota: [k] });
}

const URUT_PRESISI = { desa: 3, kecamatan: 2, kabupaten: 1 };
const fmtTgl = (d) => d.toISOString().slice(0, 10);
// Status per artikel (judul + cuplikan). "Selesai" hanya untuk frasa penyelesaian yang tegas dan bukan harapan/desakan/penyangkalan
// ("desak … diselesaikan", "tak kunjung tuntas", "aksi damai"); kata kunci terakhir frasa diperiksa terhadap kata sebelumnya.
const SELESAI = /berakhir damai|sepakat (berdamai|damai)|berdamai|(?<!(aksi|demo|solusi|secara|jalan|berjalan|rasa|penyelesaian|pendekatan|cara|suasana|tetap|dengan|tertib|dan) )\bdamai\b(?=\s*[,.|!]|\s*$)|(men)?damai'?kan|kesepakatan (tercapai|damai|bersama|ditandatangani)|(ditetapkan|tercapai|capai|diteken|disepakati) kesepakatan|perdamaian|\bislah\b|(cabut|mencabut|dicabut) laporan|(telah|sudah|resmi|akhirnya) (selesai|diselesaikan|dibayar|dibayarkan|dikembalikan|diserahkan|tuntas|dituntaskan|berdamai|dicairkan)|(?<!\bdi)selesaikan (sengketa|konflik|masalah|persoalan|perselisihan)|\bdiselesaikan\b|(konflik|sengketa|polemik|masalah|persoalan|kasus|perselisihan)\b[^,.|:]{0,40}\b(berakhir|selesai|tuntas|kelar|rampung)\b|tuntaskan (persoalan|konflik|sengketa|masalah)|ganti rugi (cair|dicairkan|dibayarkan|dibayar|direalisasikan|tuntas)|mulai direalisasikan|dikembalikan (ke|kepada) (warga|masyarakat|petani|pemilik)|(capai|mencapai|temui|menemui|ada) titik temu|\bkelar\b/gi;
const HARAPAN = /(desak|mendesak|didesak|minta|meminta|diminta|harap|berharap|dorong|mendorong|siap|segera|upaya|berupaya|upayakan|target|janji|akan|bakal|ingin|belum|tak|tidak|kunjung|gagal|bisa|agar|supaya|harus|perlu|wajib|untuk|demi|guna|cari|mencari|hingga|sampai|usut|mau|jangan|sulit)\s+(\S+\s+){0,3}$/i;
const PROSES = /mediasi|dimediasi|memediasi|sidang|persidangan|disidangkan|\bgugat|digugat|menggugat|penggugat|tergugat|praperadilan|kasasi|\bbanding\b|\bputusan\b|vonis|divonis|tuntutan jaksa|\bjaksa\b|pengadilan|\bptun\b|\bpn \w|dilaporkan|melapor|\blapor(kan)?\b|laporan (polisi|ke)|ke (polda|polres|polsek|kejari|kejati|kpk|bareskrim|mabes polri|komnas ham|ombudsman)|\brdp\b|hearing|rapat dengar|audiensi|ditangani|diproses|proses hukum|tim (terpadu|penyelesaian|khusus|gabungan|fasilitasi|ad hoc|investigasi)|satgas (penanganan|penyelesaian) konflik|verifikasi|identifikasi|pengukuran ulang|ukur ulang|diukur|dipanggil|panggil|memanggil|pansus|\bpanja\b|\bbam\b|\bgtra\b|fasilitasi|difasilitasi|memfasilitasi|\busut|diusut|penyelidikan|penyidikan|selidiki|diselidiki|tersangka|ditangkap|diamankan|ditahan|diperiksa|pemeriksaan|status quo|turun tangan|turun ke lokasi|tinjau lokasi|\bsidak\b|somasi|konstatering|dieksekusi|eksekusi lahan|dihentikan sementara|hentikan (sementara )?aktivitas|\bredam|rakor|rapat (koordinasi|mediasi|pembahasan|bersama|lanjutan)|\bbahas\b|membahas|dibahas|pertemuan|bertemu|negosiasi|musyawarah|perundingan|(gelar|menggelar) dialog|klarifikasi|investigasi|uji lab|hasil uji|sanksi|teguran|cabut izin|izin dicabut|titik terang|babak baru|tindak ?lanjut|ditindaklanjuti|kuasa hukum|\bsaksi\b|\brapat\b|(belum|tak|tidak) (ada )?(menemui )?titik temu|laporan\b[^,.|]{0,40}\bmasuk|masuk (ke )?(kejari|kejati|polda|polres|kpk|pengadilan)|bawa (kasus|persoalan|sengketa|masalah)|usul\w* (cabut|pencabutan)|\batasi\b|mengatasi|\btangani\b|menangani|penanganan|turun (ke|langsung)|\b(ma|mahkamah agung) (menangkan|tolak|kabulkan|putuskan)|menang(kan)? (gugatan|kasasi|banding|perkara)|\btangkap\b|\bamankan\b|mengamankan|penjara|dipenjara|kriminalisasi|dikriminalisasi|(bpn|atr)\b[^,.|]{0,30}\b(patahkan|nyatakan|tunda|petakan|terbitkan|batalkan)|terima (aduan|pengaduan)|menerima (aduan|pengaduan)|(dlh|dlhk|klh|klhk|gakkum|disnaker|disnakertrans|disbun|bpn|atr)\b[^,.|]{0,30}\b(cek|periksa|turun|sidak|uji|pastikan|sampel|tinjau|lapor hasil|tangani|ukur|bahas)/i;
const RENCANA = /(akan|siap|ancam|desak|mendesak|didesak|minta|meminta|diminta|harap|berharap|dorong|mendorong|ajak|mengajak|mengancam|berencana|rencana|bakal|hendak|ingin|mau|belum|tak|tidak|tanpa|jangan|tolak|menolak|hiraukan|abaikan|mangkir( dari)?)\s+(\S+\s+){0,2}$/i;
// aksi/protes/keluhan tanpa tindak lanjut yang tercatat → "Belum ditangani"
const AKSI = /\bdemo\b|didemo|berdemo|unjuk rasa|aksi (damai|massa|protes|demo|unjuk rasa|jalan kaki|bakar|blokir|blokade|tutup|duduki|mogok)|gelar aksi|massa aksi|\bprotes|memprotes|diprotes|blokir|blokade|diblokir|\bportal\b|\bsegel|disegel|duduki|menduduki|diduduki|geruduk|digeruduk|bentrok|ricuh|kericuhan|rusuh|kerusuhan|baku hantam|\bbakar\b|dibakar|\bserang\b|diserang|penyerangan|dianiaya|dihajar|pembacokan|\bbacok|tolak|menolak|ditolak|penolakan|tuntut|menuntut|tuntutan|desak|mendesak|keluhkan|mengeluh|keluhan|\bresah|memanas|membara|mengadu|adukan|surati|\bancam|kecam|mengecam|mengutuk|serobot|diserobot|penyerobotan|caplok|dicaplok|rampas|dirampas|perampasan|tergusur|digusur|terancam|mogok|\btagih|menagih|cemari|tercemar|pencemaran|limbah|teror|diteror|intimidasi|tewas|terluka|luka|berdarah|korban jiwa|preman|parang|senjata|serangan|\bpecah\b|dipanen|nginap|menginap|tanam pohon|kecewa|pertanyakan|mempertanyakan|persoalkan|mempersoalkan|sesalkan|menyesalkan|keberatan/i;
// sekataSaja: larangan cukup muncul di anak kalimat yang sama ("Berharap Konflik Lahan dengan PT SPS Tuntas")
function cocokTegas(teks, re, larangan, sekalimat = false) {
  // daftar kata di kelompok pertama pola larangan (dipakai hanya untuk HARAPAN, yang kelompoknya tanpa kurung bersarang)
  const kataLarangan = sekalimat ? new RegExp(`\\b(${larangan.source.match(/^\(([^)]*)\)/)[1]})\\b`, "i") : null;
  for (const m of teks.matchAll(new RegExp(re.source, "gi"))) {
    // "Selesaikan Konflik …" di awal judul = tujuan, bukan hasil
    if (sekalimat && m.index === 0 && /^selesaikan/i.test(m[0])) continue;
    const akhir = m[0].split(/\s+/).pop();
    const sebelum = teks.slice(Math.max(0, m.index - 40), m.index + m[0].length - akhir.length);
    if (larangan.test(sebelum)) continue;
    if (sekalimat && kataLarangan.test(sebelum.split(/[,.;:|]/).pop())) continue;
    return true;
  }
  return false;
}
function statusArtikel(teks) {
  if (cocokTegas(teks, SELESAI, HARAPAN, true)) return "Selesai";
  if (cocokTegas(teks, PROSES, RENCANA)) return "Dalam proses";
  if (AKSI.test(teks)) return "Belum ditangani";
  return "Tidak diketahui";
}
/** Status kejadian gabungan: penanganan terbaru (Selesai/Dalam proses) menang; bila tak ada, aksi/protes → Belum ditangani. */
function statusKejadian(anggota) {
  // terbaru dulu; pada tanggal yang sama "Selesai" didahulukan
  const urutan = { Selesai: 0, "Dalam proses": 1, "Belum ditangani": 2, "Tidak diketahui": 3 };
  const st = anggota.map((a) => ({ t: Math.floor(a.tanggal.getTime() / 864e5), s: statusArtikel(`${a.judul}. ${a.deskripsi}`) })).sort((a, b) => b.t - a.t || urutan[a.s] - urutan[b.s]);
  const tegas = st.find((x) => x.s === "Selesai" || x.s === "Dalam proses");
  // konflik yang memanas lagi sesudah dinyatakan selesai
  if (tegas) return tegas.s === "Selesai" && st.some((x) => x.t > tegas.t && x.s === "Belum ditangani") ? "Belum ditangani" : tegas.s;
  return st.some((x) => x.s === "Belum ditangani") ? "Belum ditangani" : "Tidak diketahui";
}

const dataBR = [];
for (const { anggota } of klaster) {
  const utama = anggota[0];
  const lok = anggota.reduce((a, b) => (URUT_PRESISI[b.presisi] > URUT_PRESISI[a.presisi] ? b : a));
  const teks = rapikan(anggota.map((a) => `${a.judul}. ${a.deskripsi}`).join(" "));
  const ctx = konteks(lok.wilayahId);
  const h = hash(norm(utama.judul) + utama.kab);
  // geser acak-deterministik ≤ 0,012° agar titik satu wilayah tidak menumpuk
  const geser = (s) => ((parseInt(s, 16) / 0xfffff) * 2 - 1) * 0.012;
  const [bj, lt] = titikWilayah(lok.wilayahId);
  const media = [...new Set(anggota.map((a) => a.media))];
  const sumber = [];
  for (const a of anggota) if (!sumber.some((s) => s.url === a.url)) sumber.push({ nama: a.media, url: a.url });
  const tanggal = fmtTgl(utama.tanggal);
  const sek = sektorDari(teks);
  dataBR.push({
    id: `k-br-${h}`, nomor: "", judul: utama.judul, tanggal, tahun: +tanggal.slice(0, 4),
    jenis: jenisDari(teks), sektor: sek.sektor, sektorLain: "", _lemah: sek.lemah, _teks: teks, _kab: utama.kab,
    status: statusKejadian(anggota), luasHa: null, dampakJiwa: null, kerahasiaan: "Publik",
    keterlibatan: { pemerintah: bersihPihak(pemerintahDari(teks, ctx)), perusahaan: bersihPihak(perusahaanDari(teks)), masyarakat: bersihPihak(masyarakatDari(teks, ctx)) },
    ringkasan: ringkas(`${utama.judul.replace(/[.!?]?$/, ".")} Diberitakan ${media.length > 1 ? `oleh ${media.length} media (${media.slice(0, 3).join(", ")}${media.length > 3 ? ", dll." : ""})` : `oleh ${media[0]}`} sejak ${tanggal}.`),
    narasi: anggota.map((a) => `• ${a.judul}${a.deskripsi ? ` — ${a.deskripsi}` : ""} (${a.media}, ${fmtTgl(a.tanggal)})`).join("\n"),
    sumber, lampiran: [],
    wilayahId: lok.wilayahId, presisi: lok.presisi, koordinat: [+(bj + geser(h.slice(0, 5))).toFixed(5), +(lt + geser(h.slice(5, 10))).toFixed(5)], asal: "Berita",
  });
}
// nomor berita urut dari yang terlama supaya relatif stabil saat data baru masuk
dataBR.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id)).forEach((d, i) => (d.nomor = `BR-${String(i + 1).padStart(3, "0")}`));
console.log(`  ${dataBR.length} kejadian dari berita (${kandidat.length} artikel)`);

// ---------- 3. tulis ----------
console.log("3/3 Menulis berkas");
const data = [...dataTK, ...dataBR].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.id.localeCompare(b.id));
// Sektor berita yang lemah/"Lainnya" diganti sektor mayoritas kejadian lain (bersektor tegas) yang menyebut
//   (1) perusahaan yang sama (TanahKita berbobot 3), atau (2) nama tempat yang sama di kabupaten yang sama ("Rantau Kasai", "Sungai Raya").
// Kunci tempat = bigram judul tanpa kata umum/jabatan/nama kabupaten yang khas satu kabupaten; pemenang harus ≥ 2/3 suara.
const KATA_BUKAN_TEMPAT = new Set(("konflik lahan sengketa tanah agraria ulayat adat warga masyarakat petani nelayan buruh karyawan pekerja desa kampung kelurahan dusun " +
  "kecamatan kabupaten kota provinsi pt cv ptpn kso bupati wabup gubernur gubri plt dprd dpr polres polda polsek kapolda kapolres kapolsek waka pemkab pemko pemprov pemda " +
  "camat kades lurah penghulu ketua komisi tim kuasa hukum aksi demo bentrok bentrokan ricuh tuntut desak minta tolak protes memanas kembali hektare hektar ribuan ratusan " +
  "puluhan perusahaan sawit kebun hutan jalan rusak polisi kejati kejari bpn atr mediasi sidang gugatan lapor laporkan diduga dugaan soal terkait pasca usai jadi tak " +
  "siak kampar rohul rohil inhu inhil kuansing bengkalis dumai pekanbaru pelalawan meranti rokan hulu hilir indragiri kuantan singingi kepulauan riau " +
  "geruduk datangi temui tanam pohon duduki blokir segel usir tagih kecam adukan berakhir pecah damai kantor ninik mamak tokoh anak kemenakan pihak oknum korban " +
  "nyaris adu tolak klaim gelar ancam bawa serahkan sampai akhir baru lama tahun bulan hari").split(" "));
// nama kecamatan terlalu luas untuk dijadikan kunci tempat
const NAMA_KEC = new Set(WILAYAH.filter((w) => w.level === "kecamatan").map((w) => norm(w.nama)));
const kunciTempat = (d) => {
  const tok = norm(d.judul).split(" ").filter((k) => k.length > 2 && !/^\d/.test(k));
  const out = new Set();
  const boleh = (k) => !KATA_BUKAN_TEMPAT.has(k) && !KATA_FUNGSI.has(k) && !KATA_KERJA.test(k);
  for (let i = 0; i + 1 < tok.length; i++) if (boleh(tok[i]) && boleh(tok[i + 1]) && !NAMA_KEC.has(tok[i] + " " + tok[i + 1])) out.add(`${kabDari(d.wilayahId)}|${tok[i]} ${tok[i + 1]}`);
  return [...out];
};
const tambahSuara = (peta, k, d) => { const s = peta.get(k) ?? {}; s[d.sektor] = (s[d.sektor] ?? 0) + (d.asal === "TanahKita" ? 3 : 1); peta.set(k, s); };
const suara = new Map(), suaraTempat = new Map();
// bigram tempat hanya dipakai bila khas satu kabupaten (muncul di ≥ 2 kejadian, semuanya di kabupaten yang sama)
const kabBigram = new Map(), dfBigram = new Map();
for (const d of data.filter((x) => x.asal === "Berita")) for (const k of kunciTempat(d)) { const [kab, bg] = k.split("|"); kabBigram.set(bg, new Set([...(kabBigram.get(bg) ?? []), kab])); dfBigram.set(bg, (dfBigram.get(bg) ?? 0) + 1); }
const tempatKhas = (k) => { const bg = k.split("|")[1]; return kabBigram.get(bg).size === 1 && dfBigram.get(bg) >= 2; };
const dfTempat = (k) => dfBigram.get(k.split("|")[1]) ?? 0;
for (const d of data) if (!d._lemah && d.sektor !== "Lainnya") {
  for (const k of new Set(d.keterlibatan.perusahaan.flatMap(kunciPT))) tambahSuara(suara, k, d);
  if (d.asal === "Berita") for (const k of kunciTempat(d)) tambahSuara(suaraTempat, k, d);
}
const pemenang = (tally, minSuara = 1, minPorsi = 0) => {
  const urut = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const total = urut.reduce((n, [, v]) => n + v, 0);
  return urut[0] && urut[0][1] >= minSuara && urut[0][1] / total >= minPorsi ? urut[0][0] : null;
};
// lahan perkotaan (Pekanbaru, kecamatan kota Dumai) tanpa petunjuk sektor lain → perumahan & kota baru
const KOTA = new Set(["kab-pekanbaru", ...WILAYAH.filter((w) => w.induk === "kab-dumai" && /^Dumai /.test(w.nama)).map((w) => w.id)]);
const asalSektor = {};
for (const d of data.filter((x) => x.asal === "Berita")) {
  let asal = d.sektor === "Lainnya" ? "Lainnya" : d._lemah ? "aturan lemah" : "aturan kata kunci";
  if (d._lemah || d.sektor === "Lainnya") {
    const tally = {};
    for (const k of new Set(d.keterlibatan.perusahaan.flatMap(kunciPT))) for (const [s, n] of Object.entries(suara.get(k) ?? {})) tally[s] = (tally[s] ?? 0) + n;
    let baru = pemenang(tally);
    if (baru) asal = "perusahaan sama";
    // kunci tempat hanya untuk yang belum bersektor sama sekali (aturan lemah tetap dihormati)
    if (!baru && d.sektor === "Lainnya") {
      const tTempat = {};
      for (const k of kunciTempat(d).filter(tempatKhas)) for (const [s, n] of Object.entries(suaraTempat.get(k) ?? {})) tTempat[s] = (tTempat[s] ?? 0) + n;
      const kunciDipakai = kunciTempat(d).filter(tempatKhas).filter((k) => suaraTempat.has(k));
      // satu suara cukup bila tempat itu disebut ≥ 3 kejadian ("Rantau Kasai", "Sungai Raya"); selain itu perlu ≥ 2 suara
      baru = pemenang(tTempat, kunciDipakai.some((k) => dfTempat(k) >= 3) ? 1 : 2, 2 / 3);
      if (baru) { asal = "tempat sama"; if (process.argv.includes("--rinci")) console.log(`   [tempat] ${baru} ← ${kunciTempat(d).filter(tempatKhas).filter((k) => suaraTempat.has(k)).join(", ")} : ${d.judul}`); }
    }
    if (baru) d.sektor = baru;
  }
  if (d.sektor === "Lainnya" && rantai(d.wilayahId).some((w) => KOTA.has(w.id)) && /lahan|tanah|sertifikat|ahli waris|eksekusi/i.test(d._teks) && !/ulayat|adat|persukuan|batin/i.test(d._teks)) { d.sektor = "Perumahan dan Kota Baru"; asal = "lahan perkotaan"; }
  asalSektor[asal] = (asalSektor[asal] ?? 0) + 1;
  if (d.jenis === "Lainnya" && SEKTOR_AGRARIA.has(d.sektor)) d.jenis = "Sengketa lahan";
  delete d._lemah; delete d._teks; delete d._kab;
}
console.log("  asal penentuan sektor berita:", Object.entries(asalSektor).map(([k, v]) => `${k} ${v}`).join(" · "));
if (process.argv.includes("--rinci")) console.log("  contoh dibuang (bukan peristiwa):\n   - " + contohBukanPeristiwa.join("\n   - "));
simpan(path.join(SUMBER, "konflik.json"), JSON.stringify({
  dibuat: new Date().toISOString(),
  sumber: [
    { nama: "TanahKita.id", url: "https://tanahkita.id", lisensi: "Tidak ada lisensi data terbuka yang dinyatakan; kaki situs: \"TanahKita © 2022. All Rights Reserved.\" robots.txt tidak membatasi akses. Dipakai untuk riset non-komersial dengan atribusi dan tautan ke halaman detail.",
      catatan: "Portal data konflik agraria koalisi masyarakat sipil (JKPP, HuMA, KPA, KpSHK, Sawit Watch, JATAM). Diambil dari GeoJSON publik data_service/map/jkpp.geojson (nm_propinsi = Riau) dan halaman data_detail/index/<id_enc>. Kode status: BD = Belum Ditangani, PS = Dalam Proses (tahap Mediasi/Hukum), SL = Selesai. Kategori K1 = konflik masyarakat adat, K2 = non-masyarakat adat. Luas/dampak bernilai 0 diperlakukan sebagai tidak diketahui (null). Jenis konflik diklasifikasi heuristik dari judul/ringkasan." },
    { nama: "Google News RSS", url: "https://news.google.com/rss", lisensi: "Ketentuan feed Google: hanya untuk ditampilkan di pembaca feed pribadi, non-komersial; penggunaan lain dilarang. Hak cipta judul berita milik media masing-masing. Hanya judul, nama media, tanggal, dan tautan yang disimpan.",
      catatan: `${KUERI.length} kueri (+${SETAHUN.length} varian when:1y), diunduh ${fmtTgl(new Date())}. Disaring dengan kata kunci konflik + objek, dilokasikan dengan gazetir minimal ke kabupaten, dideduplikasi per kabupaten dalam ≤ 14 hari (kemiripan token judul ≥ 0,6, atau perusahaan sama dalam ≤ 7 hari). Judul dibersihkan (karakter rusak, awalan FOTO/Video, ekor nama media/rubrik); berita non-peristiwa (opini, feature, acara, profil, gosip) dan berita luar Riau dibuang. Sektor "Lainnya" dilengkapi dari kejadian lain dengan perusahaan yang sama atau nama tempat khas yang sama di kabupaten yang sama, dan lahan perkotaan Pekanbaru/Dumai → Perumahan dan Kota Baru. Status per artikel (Selesai/Dalam proses/aksi tanpa tindak lanjut = Belum ditangani); kejadian gabungan memakai penanganan terbaru. Koordinat = titik wilayah digeser ≤ 0,012°. Tautan adalah tautan pengalihan Google News. Jenis, sektor, status, dan keterlibatan hasil heuristik kata kunci — perlu verifikasi manual.` },
  ],
  jumlah: data.length,
  data,
}, null, 1));

// rekap untuk pemeriksaan cepat
const hitung = (f) => Object.entries(data.reduce((a, d) => ((a[f(d)] = (a[f(d)] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ");
console.log("  asal:", hitung((d) => d.asal));
console.log("  sektor:", hitung((d) => d.sektor));
console.log("  jenis:", hitung((d) => d.jenis));
console.log("  kabupaten:", hitung((d) => getWilayah(kabDari(d.wilayahId))?.nama ?? "?"));
console.log("  status:", hitung((d) => d.status));
console.log("  presisi:", hitung((d) => d.presisi));
