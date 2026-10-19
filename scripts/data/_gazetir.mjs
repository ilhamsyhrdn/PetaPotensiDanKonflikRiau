// Gazetir: mencocokkan teks atau koordinat ke wilayah Riau (Kab → Kec → Desa).
// Dipakai skrip konflik dan berita supaya penentuan lokasi seragam (potensi hanya memakai lokasiDariTitik).
import path from "node:path";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { AKAR, GEO, baca } from "./_lib.mjs";

const { data } = baca(path.join(AKAR, "src/data/wilayah.json"));
export const WILAYAH = data.map(([id, nama, level, induk, bujur, lintang]) => ({ id, nama, level, induk, koordinat: [bujur, lintang] }));
const BY_ID = new Map(WILAYAH.map((w) => [w.id, w]));
export const getWilayah = (id) => BY_ID.get(id);
export const rantai = (id) => { const r = []; let w = BY_ID.get(id); while (w) { r.unshift(w); w = w.induk ? BY_ID.get(w.induk) : undefined; } return r; };
const kabDari = (id) => rantai(id).find((w) => w.level === "kabupaten")?.id ?? null;

const norm = (s) => ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

// Nama/singkatan kabupaten yang lazim di media Riau. Nama kota (Duri, Tembilahan, …) dipetakan ke kecamatannya di TEMPAT.
const ALIAS_KAB = {
  "kab-indragiri-hulu": ["inhu", "indragiri hulu"], "kab-indragiri-hilir": ["inhil", "indragiri hilir"],
  "kab-kuantan-singingi": ["kuansing", "kuantan singingi"], "kab-rokan-hulu": ["rohul", "rokan hulu"],
  "kab-rokan-hilir": ["rohil", "rokan hilir"], "kab-kepulauan-meranti": ["kepulauan meranti", "kep meranti", "meranti"],
  "kab-bengkalis": ["bengkalis"], "kab-siak": ["siak"], "kab-kampar": ["kampar"],
  "kab-pelalawan": ["pelalawan"], "kab-pekanbaru": ["pekanbaru"], "kab-dumai": ["dumai"],
};
// Frasa yang memuat nama kabupaten tapi bukan kabupatennya: sungai, kecamatan/desa di kabupaten lain, nama perusahaan,
// nama jalan di Pekanbaru (Jalan Siak, Jalan Kampar, …), dan kata umum "kayu meranti".
const BUKAN_KAB = new RegExp(" (" + [
  "(sungai|sei) (siak|kampar|rokan|indragiri|kuantan)", "siak hulu", "siak kecil", "giam siak kecil", "bumi siak pusako", "tirta siak", "kuala kampar",
  "(sri|bukit|sungai|sei|batang|teluk|bagan punak|desa|kelurahan|kampung|kayu|pohon|hutan) meranti", "meranti (pandak|bunting|makmur|darussalam)",
  "(jalan|jl|jln|gang|gg|komplek|kompleks|perumahan|perum) (siak|kampar|bengkalis|dumai|pelalawan|meranti|rokan|indragiri|kuantan)",
  "(pn|pengadilan negeri|pengadilan tinggi|ptun|pt tun) pekanbaru",
].join("|") + ") ", "g");
// Nama kecamatan yang juga kata/frasa umum: hanya dicocokkan lewat "kecamatan X" (KETAT) atau bila kabupatennya disebut (KONTEKS)
const KEC_KETAT = new Set(["tambang", "lirik", "tanah merah", "bukit batu", "bukit kapur", "gaung", "kepenuhan", "merbau", "lima puluh", "tampan", "sail", "bukit raya", "pusako", "kampa", "salo", "kuok", "enok", "kubu", "benai", "kempas", "siak", "kampar", "bengkalis", "pelalawan", "bangkinang"]);
const KEC_KONTEKS = new Set(["pinggir", "rengat", "kelayang", "tebing tinggi", "sukajadi", "kulim", "bunut", "simpang kanan", "batu hampar", "lubuk dalam", "tanah putih", "kemuning", "bangko", "tambusai"]);

// Kata umum yang kebetulan sama dengan nama kota: "kawat duri", "duri dalam daging", "ikan duri", …
const KATA_UMUM = [
  [/ (kawat|pagar|ikan|landak|mawar|bagai|seperti|bak|laksana|jadi|menjadi|sebuah|tanpa|tulang|cabut|tertusuk|menusuk|penuh|ber) duri /g, " "],
  [/ duri (dalam|di dalam|tajam|ikan|landak|mawar|pohon|tanaman|nya) /g, " "],
  // jalan tol Pekanbaru–Rengat berawal di Pekanbaru; "Rengat" di sini nama ruas, bukan lokasi
  [/ tol (pekanbaru rengat|rengat pekanbaru) /g, " tol pekanbaru "],
  // tol Pekanbaru–Bangkinang/XIII Koto Kampar melintasi Kabupaten Kampar
  [/ tol (pekanbaru bangkinang|bangkinang pekanbaru|pekanbaru xiii koto kampar) /g, " tol kampar "],
  [/ manggala agni /g, " "],
];

// Kota kecamatan, kawasan, dan lapangan migas yang lazim di berita Riau → id kecamatan/desa di wilayah.json.
// [pola pada teks ternormalisasi, id, syarat konteks (opsional), penolak konteks (opsional)]
const TEMPAT = [
  [/ duri /, "kec-bengkalis-mandau"], [/ perawang /, "kec-siak-tualang"], [/ minas /, "kec-siak-minas"], [/ kandis /, "kec-siak-kandis"],
  [/ bagan ?batu /, "kec-rokan-hilir-bagan-sinembah"], [/ ujungbatu /, "kec-rokan-hulu-ujung-batu"],
  [/ pangkalan kerinci /, "kec-pelalawan-pangkalan-kerinci"], [/ tembilahan /, "kec-indragiri-hilir-tembilahan"], [/ rengat /, "kec-indragiri-hulu-rengat"],
  [/ t[ae]luk kuantan /, "kec-kuantan-singingi-kuantan-tengah"], [/ bangkinang /, "kec-kampar-bangkinang-kota"],
  [/ pasir ?peng[ae]ra[iy]an /, "kec-rokan-hulu-rambah"], [/ bagan ?siapi ?api /, "kec-rokan-hilir-bangko"], [/ selat ?panjang /, "kec-kepulauan-meranti-tebing-tinggi"],
  [/ siak sri indrapura /, "kec-siak-siak"], [/ air molek /, "kec-indragiri-hulu-pasir-penyu"], [/ belilas /, "kec-indragiri-hulu-seberida"],
  [/ lipat kain /, "kec-kampar-kampar-kiri"], [/ dalu dalu /, "kec-rokan-hulu-tambusai"], [/ baserah /, "kec-kuantan-singingi-kuantan-hilir"],
  [/ lubuk jambi /, "kec-kuantan-singingi-kuantan-mudik"], [/ muara lembu /, "kec-kuantan-singingi-singingi"], [/ kuala enok /, "kec-indragiri-hilir-tanah-merah"],
  [/ (sungai|sei) guntung /, "kec-indragiri-hilir-kateman"], [/ (sungai|sei) pakning /, "kec-bengkalis-bukit-batu"], [/ panipahan /, "kec-rokan-hilir-pasir-limau-kapas"],
  [/ sorek /, "kec-pelalawan-pangkalan-kuras"], [/ sedinginan /, "kec-rokan-hilir-tanah-putih"], [/ batang gangsal /, "kec-indragiri-hulu-batang-gansal"],
  [/ ujung tanjung /, "kec-rokan-hilir-tanah-putih", null, / (kuansing|kuantan singingi|benai) /], [/ tenayan /, "kec-pekanbaru-tenayan-raya"],
  [/ marpoyan /, "kec-pekanbaru-marpoyan-damai"], [/ (fuel terminal|terminal bbm|tbbm|ft|integrated terminal) (sei|sungai) siak /, "kab-pekanbaru"],
  // lapangan/fasilitas migas WK Rokan (dicek terhadap nama desa di wilayah.json)
  [/ libo /, "kec-siak-kandis"], [/ sebangar? /, "kec-bengkalis-bathin-solapan"], [/ petapahan /, "kec-kampar-tapung", null, / (kuansing|kuantan singingi|gunung toar) /],
  [/ balam /, "kec-rokan-hilir-balai-jaya", / (rohil|rokan hilir|phr|pertamina|migas|blok rokan|bagan sinembah|balai jaya) /, / (balam jaya kampar|tambang|balam merah|banjar balam|tanjung balam) /],
  [/ (menggala|manggala south) /, "kab-rokan-hilir"],
  // desa/kawasan yang sering muncul tanpa kata "desa"
  [/ rantau bais /, "desa-tanah-putih-rantau-bais"], [/ balai makam /, "desa-bathin-solapan-balai-makam"], [/ kijang rejo /, "desa-tapung-kijang-rejo"],
  [/ (kota|koto) garo /, "desa-tapung-hilir-kota-garo"], [/ s[ei]nama nenek /, "desa-tapung-hulu-sinama-nenek"], [/ pantai raja /, "desa-perhentian-raja-pantai-raja"],
  [/ danau lancang /, "desa-tapung-hulu-danau-lancang"], [/ meranti pandak /, "desa-rumbai-meranti-pandak"], [/ okura /, "desa-rumbai-timur-tebing-tinggi-okura"],
  [/ pulau muda /, "desa-teluk-meranti-pulau-muda"], [/ pangkalan gondai /, "desa-langgam-pangkalan-gondai"], [/ segati /, "desa-langgam-segati"],
  [/ balai pungut /, "desa-pinggir-balai-pungut"], [/ pematang pudu /, "desa-mandau-pematang-pudu"], [/ tarai bangun /, "desa-tambang-tarai-bangun"],
  [/ pulau padang /, "kab-kepulauan-meranti", null, / (kuansing|kuantan singingi|singingi) /], [/ (tesso nilo|tntn) /, "kab-pelalawan"],
];
// lembaga yang berkantor di ibu kota kabupaten: "PN Rengat", "Polres Bangkinang" → cukup kabupatennya
const LEMBAGA = / (pn|pengadilan negeri|pengadilan agama|kejari|kejaksaan negeri|polres|polresta|rutan|lapas|kodim|rsud|bpn|kantah|ulp|up3|kpp|bapenda|dprd|pemkab|pemko|kantor bupati|kantor wali kota) $/;
// untuk kabupaten ganda: hanya lembaga peradilan/penegak hukum (perkara satu kabupaten sering disidangkan di kabupaten lain)
const LEMBAGA_POLA = " (pn|pengadilan negeri|pengadilan agama|kejari|kejaksaan negeri|rutan|lapas)";

const kecByNama = new Map();
for (const w of WILAYAH.filter((x) => x.level === "kecamatan")) {
  const k = norm(w.nama).trim();
  kecByNama.set(k, [...(kecByNama.get(k) ?? []), w]);
}
const desaByNama = new Map();
for (const w of WILAYAH.filter((x) => x.level === "desa")) {
  const k = norm(w.nama).trim();
  desaByNama.set(k, [...(desaByNama.get(k) ?? []), w]);
}
// nama terpanjang dicoba lebih dulu ("Tapung Hilir" sebelum "Tapung")
const KEC_URUT = [...kecByNama].sort((a, b) => b[0].length - a[0].length);
const DESA_URUT = [...desaByNama].sort((a, b) => b[0].length - a[0].length);
const namaKab = new Set(Object.values(ALIAS_KAB).flat());
// desa yang boleh dicocokkan tanpa kata "desa" bila kabupatennya disebut: ≥ 2 kata, unik di kabupaten itu, bukan frasa umum
const DESA_UMUM = new Set(["kota baru", "pasar baru", "kampung baru", "sungai baru", "desa baru", "koto baru", "simpang tiga", "simpang empat", "pasir putih", "air hitam", "bukit batu", "tanah merah", "sungai pinang", "kampung dalam", "kampung tengah", "kota lama", "teluk dalam", "suka maju", "sumber jaya", "bukit raya", "kota tengah", "pulau kijang", "sungai buluh", "jalan baru", "rantau panjang", "air putih", "bandar jaya", "sri meranti", "tanjung medan", "kelapa sawit", "sungai sawit", "bina baru", "tanjung harapan"]);
const DESA_TANPA_AWALAN = new Map(); // kabId → [[nama, desa]]
for (const [nama, list] of DESA_URUT) {
  if (nama.split(" ").length < 2 || nama.length < 8 || DESA_UMUM.has(nama) || kecByNama.has(nama) || namaKab.has(nama)) continue;
  const perKab = new Map();
  for (const w of list) { const k = kabDari(w.id); perKab.set(k, [...(perKab.get(k) ?? []), w]); }
  for (const [k, ws] of perKab) if (ws.length === 1) DESA_TANPA_AWALAN.set(k, [...(DESA_TANPA_AWALAN.get(k) ?? []), [nama, ws[0]]]);
}

const DESA_UNIK = DESA_URUT.filter(([nama, list]) => list.length === 1 && nama.split(" ").length >= 2 && nama.length >= 8 && !DESA_UMUM.has(nama) && !kecByNama.has(nama)).map(([nama, list]) => [nama, list[0]]);

/** Nama wilayah/tempat yang dikenal gazetir (untuk menjaga " - Kubu" atau "Pekanbaru - Rengat" di judul). */
const NAMA_TEMPAT = new Set([...kecByNama.keys(), ...desaByNama.keys(), ...namaKab, "riau", "sumut", "sumbar", "jambi", "kepri", "rengat", "duri", "minas", "perawang", "bagan batu"]);
export const adalahTempat = (s) => NAMA_TEMPAT.has(norm(s).trim());

/**
 * Cari wilayah paling spesifik yang disebut dalam teks.
 * Urutan: desa ("desa/kelurahan/kampung/kepenghuluan X") → "kecamatan X" → kota/kawasan dikenal → nama kecamatan unik
 * → desa tanpa awalan (bila kabupatennya disebut) → kabupaten. Semua harus sejalan dengan kabupaten yang disebut.
 * Hasil: { wilayahId, presisi } atau null (tidak ada lokasi, atau lebih dari satu kabupaten).
 */
export function cariWilayah(teks) {
  let t = norm(teks);
  for (const [re, ganti] of KATA_UMUM) t = t.replace(re, ganti);
  const tk = t.replace(BUKAN_KAB, " ").replace(BUKAN_KAB, " ");
  let kabTeks = Object.entries(ALIAS_KAB).filter(([, al]) => al.some((a) => tk.includes(` ${a} `))).map(([id]) => id);
  // lebih dari satu kabupaten: kabupaten yang hanya muncul sebagai nama lembaga ("PN Bengkalis" untuk perkara Meranti) diabaikan
  if (kabTeks.length > 1) {
    const tanpaLembaga = Object.entries(ALIAS_KAB).filter(([, al]) => al.some((a) => new RegExp(`(?<!${LEMBAGA_POLA}) ${a} `).test(tk))).map(([id]) => id);
    if (tanpaLembaga.length >= 1) kabTeks = tanpaLembaga;
  }

  // kota/kawasan dikenal; di belakang nama lembaga cukup kabupatennya
  const tempat = [];
  for (const [re, id, syarat, tolak] of TEMPAT) {
    const m = re.exec(t);
    if (!m || (syarat && !syarat.test(t)) || (tolak && tolak.test(t))) continue;
    if (/ (pt|cv|pks|kso|koperasi|kud|poktan) $/.test(t.slice(0, m.index + 1))) continue; // "PT Ujung Tanjung Sejahtera" bukan tempat
    tempat.push(LEMBAGA.test(t.slice(0, m.index + 1)) ? kabDari(id) : id);
  }
  const kabs = [...new Set([...kabTeks, ...tempat.map(kabDari)])];
  const sejalan = (w) => !kabs.length || kabs.includes(kabDari(w.id));

  // kecamatan: lintasan 1 "kecamatan X" eksplisit; lintasan 2 nama unik (≥ 5 huruf) yang sejalan dengan kabupaten
  let kec = null;
  const tKec = t.replace(/ (kecamatan|kec) /g, " kecamatan ");
  for (const eksplisit of [true, false]) {
    for (const [nama, list] of KEC_URUT) {
      if (!eksplisit && (nama.length < 5 || namaKab.has(nama) || KEC_KETAT.has(nama))) continue;
      const pola = eksplisit ? ` kecamatan ${nama} ` : ` ${nama} `;
      const i = tKec.indexOf(pola);
      if (i < 0) continue;
      // "Kecamatan Siak Kecil" tidak boleh terbaca "Kecamatan Siak"
      const cocok = list.filter((w) => sejalan(w) || (eksplisit && list.length === 1 && kabTeks.length <= 1));
      if (cocok.length !== 1) continue;
      if (!eksplisit && KEC_KONTEKS.has(nama) && !kabTeks.includes(cocok[0].induk)) continue;
      if (!eksplisit && LEMBAGA.test(tKec.slice(0, i + 1))) continue; // "PN Rengat" → cukup kabupaten
      if (!eksplisit && !kabs.length && list.length !== 1) continue;
      if (!eksplisit && kabs.length > 1) continue; // dua kabupaten disebut: kecamatan pertama yang cocok belum tentu lokasinya
      kec = cocok[0]; break;
    }
    if (kec) break;
  }

  let desa = null;
  if (/ (desa|kelurahan|kampung|kepenghuluan|dusun) /.test(t)) {
    for (const [nama, list] of DESA_URUT) {
      if (nama.length < 4) continue;
      if (![" desa ", " kelurahan ", " kampung ", " kepenghuluan "].some((p) => t.includes(`${p}${nama} `))) continue;
      const cocok = list.filter((w) => (kec ? w.induk === kec.id : sejalan(w)));
      if (cocok.length === 1) { desa = cocok[0]; break; }
    }
  }
  // desa tanpa awalan: ≥ 2 kata, unik di kabupatennya, bukan bagian nama perusahaan/jalan ("PT Sumber Makmur")
  const desaPolos = (kabId, kecId) => (DESA_TANPA_AWALAN.get(kabId) ?? []).find(([nama, w]) => (!kecId || w.induk === kecId) && t.includes(` ${nama} `) && !new RegExp(` (pt|cv|kud|koperasi|kopsa|ptpn|yayasan|hotel|jalan|jl|jln|gang|perumahan|pdam) ${nama} `).test(t))?.[1];
  if (!desa && kec) desa = desaPolos(kec.induk, kec.id) ?? null;
  // "Warga Pulau Bayur", "Bentrok di Muara Langsat": nama desa unik se-Riau (≥ 2 kata) tepat setelah penanda warga/tempat
  if (!desa) desa = DESA_UNIK.find(([nama, w]) => (kec ? w.induk === kec.id : sejalan(w)) && new RegExp(` (warga|masyarakat|petani|nelayan|penghulu|kades|pemuda|ninik mamak|di|ke|dari) ${nama}`).test(t))?.[1] ?? null;
  if (desa) return { wilayahId: desa.id, presisi: "desa" };
  if (kec) return { wilayahId: kec.id, presisi: "kecamatan" };

  // tempat dikenal: paling spesifik, asalkan semua tempat & kabupaten yang disebut berada di satu kabupaten
  if (tempat.length && kabs.length === 1) {
    const terbaik = tempat.map((id) => BY_ID.get(id)).sort((a, b) => ({ desa: 3, kecamatan: 2, kabupaten: 1 })[b.level] - ({ desa: 3, kecamatan: 2, kabupaten: 1 })[a.level]);
    const kecTempat = new Set(terbaik.filter((w) => w.level !== "kabupaten").map((w) => (w.level === "desa" ? w.induk : w.id)));
    if (kecTempat.size <= 1 && terbaik[0].level !== "kabupaten") return { wilayahId: terbaik[0].id, presisi: terbaik[0].level };
  }
  if (kabs.length === 1) {
    const d = desaPolos(kabs[0]);
    return d ? { wilayahId: d.id, presisi: "desa" } : { wilayahId: kabs[0], presisi: "kabupaten" };
  }
  return null;
}

const KEC_GEO = baca(path.join(GEO, "kecamatan.geojson")).features;
const DESA = WILAYAH.filter((w) => w.level === "desa");
const jarakKm = ([x1, y1], [x2, y2]) => Math.hypot((x1 - x2) * 111.32 * Math.cos(((y1 + y2) / 2) * Math.PI / 180), (y1 - y2) * 110.57);

/** Wilayah dari koordinat: kecamatan lewat point-in-polygon, lalu desa terdekat (≤ 4 km) di kecamatan itu. */
export function lokasiDariTitik([bujur, lintang]) {
  const kecF = KEC_GEO.find((f) => booleanPointInPolygon({ type: "Point", coordinates: [bujur, lintang] }, f));
  if (!kecF) return null;
  const kandidat = DESA.filter((d) => d.induk === kecF.properties.id).map((d) => ({ d, km: jarakKm(d.koordinat, [bujur, lintang]) })).sort((a, b) => a.km - b.km)[0];
  if (kandidat && kandidat.km <= 4) return { wilayahId: kandidat.d.id, presisi: "titik" };
  return { wilayahId: kecF.properties.id, presisi: "titik" };
}

/** Koordinat perwakilan untuk sebuah wilayah (titik label poligon / titik desa). */
export const titikWilayah = (id) => BY_ID.get(id)?.koordinat ?? null;
