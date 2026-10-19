// Titik potensi ekonomi seluruh Provinsi Riau dari OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Kategori mengacu lapangan usaha BPS / seksi KBLI 2020. Hasil: data/sumber/potensi.json
// Jalankan: node scripts/data/potensi.mjs
import fs from "node:fs";
import path from "node:path";
import { AKAR, CACHE, overpass, slug, simpan, baca, SUMBER, tidur } from "./_lib.mjs";
import { WILAYAH, lokasiDariTitik, rantai } from "./_gazetir.mjs";

// ---------------------------------------------------------------------------
// 1. Query Overpass per kategori (superset; penyaringan halus dilakukan di skrip)
// ---------------------------------------------------------------------------
const AREA = `area["name"="Riau"]["admin_level"="4"]->.r;`;
const Q = {
  pertanian: `
    nwr["landuse"~"^(farmland|orchard|plantation|greenhouse_horticulture|farmyard|animal_keeping)$"]["name"](area.r);
    nwr["place"="farm"](area.r);
    nwr["shop"~"^(agrarian|farm|garden_centre)$"](area.r);
    nwr["name"~"[Pp]ertanian|[Pp]erkebunan|[Pp]enyuluh|[Pp]eternakan|[Hh]ortikultura|[Tt]anaman [Pp]angan|[Bb]alai [Bb]enih|[Kk]elompok [Tt]ani|[Gg]apoktan"](area.r);`,
  perikanan: `
    nwr["landuse"="aquaculture"](area.r);
    nwr["aquaculture"](area.r);
    nwr["water"="fishpond"]["name"](area.r);
    nwr["harbour:category"="fishing"](area.r);
    nwr["seamark:harbour:category"="fishing"](area.r);
    nwr["shop"~"^(seafood|fish)$"](area.r);
    nwr["amenity"="fish_market"](area.r);
    nwr["name"~"[Pp]erikanan|PPI|TPI|[Pp]elelangan [Ii]kan|[Pp]endaratan [Ii]kan|[Pp]asar [Ii]kan|[Kk]eramba|[Tt]ambak|[Kk]olam [Ii]kan|[Nn]elayan|[Bb]udi ?[Dd]aya [Ii]kan|[Bb]enih [Ii]kan"](area.r);`,
  kehutanan: `
    nwr["landuse"="plant_nursery"](area.r);
    nwr["office"="forestry"](area.r);
    nwr["landuse"="forest"]["name"~"HTI|[Hh]utan [Tt]anaman"](area.r);
    nwr["landuse"="forest"]["produce"="timber"]["name"](area.r);
    nwr["name"~"KPH|[Kk]esatuan [Pp]engelolaan [Hh]utan|[Kk]ehutanan|[Pp]ersemaian|[Pp]embibitan|[Hh]utan [Tt]anaman|[Hh]utan [Kk]emasyarakatan|[Hh]utan [Dd]esa|[Hh]utan [Rr]akyat|[Hh]utan [Aa]dat|[Tt]aman [Hh]utan|Tahura|[Aa]rboretum"](area.r);`,
  pertambangan: `
    nwr["landuse"="quarry"](area.r);
    nwr["man_made"~"^(mineshaft|adit)$"](area.r);
    nwr["industrial"~"^(mine|quarry|mining|oil|gas|oil_gas_facility|wellsite)$"](area.r);
    nwr["resource"](area.r);
    nwr["name"~"[Tt]ambang|[Gg]alian [Cc]|[Pp]enambangan|[Qq]uarry|[Bb]atu ?[Bb]ara|[Ss]tone [Cc]rusher"](area.r);`,
  industri: `
    nwr["man_made"="works"](area.r);
    nwr["industrial"](area.r);
    nwr["landuse"="industrial"]["name"](area.r);
    nwr["craft"](area.r);
    nwr["building"~"^(industrial|factory|manufacture)$"]["name"](area.r);
    nwr["name"~"^(PKS|PMKS|Pabrik)|[Pp]alm [Oo]il [Mm]ill|[Kk]ilang|[Rr]efinery|[Pp]abrik"](area.r);`,
  energi: `
    nwr["power"="plant"](area.r);
    nwr["power"="generator"]["name"](area.r);
    nwr["name"~"^(PLT[A-Z]*|[Pp]embangkit)"](area.r);`,
  perdagangan: `
    nwr["amenity"="marketplace"](area.r);
    nwr["shop"~"^(mall|department_store|wholesale|supermarket)$"](area.r);
    nwr["name"~"^[Pp]asar "](area.r);`,
  transportasi: `
    nwr["aeroway"~"^(aerodrome|airstrip|heliport)$"](area.r);
    nwr["amenity"~"^(ferry_terminal|bus_station)$"](area.r);
    nwr["harbour"](area.r);
    nwr["seamark:type"~"^(harbour|harbour_basin|small_craft_facility)$"](area.r);
    nwr["landuse"~"^(port|harbour)$"](area.r);
    nwr["public_transport"="station"](area.r);
    nwr["name"~"[Pp]elabuhan|[Tt]erminal|[Dd]ermaga|[Bb]andara|[Bb]andar [Uu]dara|[Jj]etty|[Pp]elantar|[Gg]udang|[Ww]arehouse|[Pp]ergudangan|[Pp]enyeberangan"](area.r);`,
  pariwisata: `
    nwr["tourism"~"^(attraction|museum|viewpoint|theme_park|zoo|hotel|resort|guest_house|motel|hostel|camp_site|aquarium|gallery|chalet)$"](area.r);
    nwr["historic"]["name"](area.r);
    nwr["natural"~"^(beach|waterfall|hot_spring|cave_entrance)$"]["name"](area.r);
    nwr["leisure"~"^(park|water_park|nature_reserve|beach_resort|resort|garden)$"]["name"](area.r);
    nwr["name"~"[Ww]isata|[Aa]ir [Tt]erjun|[Ee]kowisata|[Aa]gro ?[Ww]isata"](area.r);`,
  keuangan: `
    nwr["amenity"~"^(bank|bureau_de_change|money_lender|microfinance)$"](area.r);
    nwr["shop"~"^(pawnbroker|money_lender)$"](area.r);
    nwr["office"~"^(cooperative|financial|insurance|financial_advisor)$"](area.r);
    nwr["name"~"[Kk]operasi|KUD|KSP|BUMDes|[Bb]umdes|BUMKam|[Bb]adan [Uu]saha [Mm]ilik ([Dd]esa|[Kk]ampung)|[Cc]redit [Uu]nion|BPRS?|[Bb]ank [Pp]erkreditan|BMT|[Bb]aitul [Mm]aa?l|[Pp]egadaian|[Ll]embaga [Pp]erkreditan"](area.r);`,
};

// Hasil Overpass yang terpotong (timeout/memori) tidak boleh tertinggal di cache
async function unduh(kunci, query) {
  const res = await overpass(query, kunci);
  if (res.remark && /error|timed out|out of memory/i.test(res.remark)) {
    fs.rmSync(path.join(CACHE, kunci), { force: true });
    throw new Error(`Overpass ${kunci}: ${res.remark}`);
  }
  return res;
}

console.log("1/4 Unduh Overpass per kategori");
// --segar: ambil ulang kategori yang cache-nya > 6 hari; yang baru saja berhasil diunduh dipakai lagi,
// jadi bila Overpass gagal di tengah jalan, percobaan berikutnya melanjutkan dari kategori yang gagal
if (process.argv.includes("--segar")) for (const f of fs.readdirSync(CACHE))
  if (f.startsWith("overpass-potensi-") && Date.now() - fs.statSync(path.join(CACHE, f)).mtimeMs > 6 * 864e5) fs.rmSync(path.join(CACHE, f));
const semua = new Map(); // "n123" → elemen (satu objek bisa muncul di beberapa query)
let jeda = false;
for (const [kat, isi] of Object.entries(Q)) {
  const kunci = `overpass-potensi-${kat}.json`;
  if (!fs.existsSync(path.join(CACHE, kunci))) { if (jeda) await tidur(5000); jeda = true; }
  const res = await unduh(kunci, `[out:json][timeout:300];${AREA}(${isi});out center meta;`);
  for (const e of res.elements) semua.set(e.type[0] + e.id, e);
  console.log(`  ${kat}: ${res.elements.length} elemen`);
}
if (!fs.existsSync(path.join(CACHE, "overpass-potensi-sumur-count.json")) && jeda) await tidur(5000);
const hitungSumur = await unduh("overpass-potensi-sumur-count.json", `[out:json][timeout:180];${AREA}nwr["man_made"="petroleum_well"](area.r);out count;`);
const SUMUR = +(hitungSumur.elements[0]?.tags?.total ?? 0);
console.log(`  ${semua.size} elemen unik; sumur minyak (man_made=petroleum_well) di Riau: ${SUMUR}`);

// ---------------------------------------------------------------------------
// 2. Pemetaan tag OSM → kategori/subkategori
// ---------------------------------------------------------------------------
// Nama yang menandakan bukan titik usaha (sekolah, ibadah, permukiman, fasilitas penunjang, dll.)
const BUKAN_USAHA = /\b(SD|SDN|SMP|SMPN|SMA|SMAN|SMK|SMKN|MTs|sekolah|school|universitas|fakultas|politeknik|akademi|kampus|lab|laboratorium|asrama|kos|kost|kontrakan|perumahan|mess|posko|masjid|mesjid|mushalla|musholla|gereja|pemakaman|makam pahlawan|TPU|imigrasi|polsek|polres|kodim|koramil|puskesmas|rumah sakit|lapangan|futsal|halte|SPBU|SPBE|bengkel|warnet|warung|rumah makan|ruang tunggu|gerbang|gapura|jambat|jembatan|parkir|menara|security|ATM|software|kursus|UIN|KUA|PDAM|SPAM|air minum|water (plant|intake)|pompa|ruko|sekeluarga|procurement|tiket|ticket|learning|institute|training|R ?& ?D|technology center|pool transport|pool truk|biro jasa|pusdikat)\b|^perum\.|^rumah (kepala )?dusun|^kantor (desa|kepala desa|lurah|kelurahan|camat|penghulu|bupati|wali ?kota|UPP)\b/i;
// Nama terlalu umum → diperlakukan sebagai tanpa nama
const NAMA_UMUM = new Set(["pt", "cv", "industri", "pabrik", "gudang", "pelabuhan", "pasar", "hotel", "bank", "taman", "koperasi", "terminal", "bus station", "sawit", "kebun", "dermaga", "private property", "lahan kosong", "home", "asri", "pergudangan", "air terjun", "agrowisata",
  "toserba", "swalayan", "supermarket", "minimarket", "mall", "kedai harian", "sukses"]);
// Nilai operator generik → diterjemahkan / dibuang
const OPERATOR_UMUM = { personal: "Perorangan", pribadi: "Perorangan", private: "Perorangan", government: "Pemerintah", public: "", publik: "", umum: "", "pihak bank": "", yes: "", no: "", d: "" };
// Fasilitas operasi hulu migas (aset operasi perusahaan) — dikecualikan seperti sumur
const MIGAS = /\b(field|GS|gathering station|gas plant|camp|pipe yard|junk yard|bioremediation)\b|chevron|\bCPI\b|pertamina hulu|pertamina EP|ladang minyak|minas area|schlumberger|south balam/i;

const JENIS_ENERGI = { coal: "batu bara", gas: "gas", diesel: "diesel", oil: "minyak", hydro: "tenaga air", solar: "tenaga surya", biomass: "biomassa", biogas: "biogas", wind: "angin" };
const SUB_ENERGI = { coal: "PLTU batu bara", gas: "Pembangkit listrik tenaga gas", diesel: "Pembangkit listrik tenaga diesel", oil: "Pembangkit listrik tenaga diesel/minyak", hydro: "PLTA (tenaga air)", solar: "PLTS (tenaga surya)", biomass: "Pembangkit listrik biomassa", biogas: "Pembangkit listrik biomassa" };
const KRIYA = {
  blacksmith: "Kerajinan logam (pandai besi)", boatbuilder: "Pembuatan kapal/perahu", weaver: "Kerajinan tenun", handicraft: "Kerajinan tangan",
  pottery: "Kerajinan gerabah", basket_maker: "Kerajinan anyaman", cabinet_maker: "Industri mebel", furniture: "Industri mebel", joiner: "Industri mebel",
  upholsterer: "Industri mebel", shoemaker: "Industri alas kaki", tailor: "Konveksi/penjahitan", dressmaker: "Konveksi/penjahitan", jeweller: "Kerajinan perhiasan",
  goldsmith: "Kerajinan perhiasan", printer: "Percetakan", bakery: "Industri makanan & minuman", confectionery: "Industri makanan & minuman",
  brewery: "Industri makanan & minuman", winery: "Industri makanan & minuman", distillery: "Industri makanan & minuman", sawmill: "Industri kayu",
  sculptor: "Kerajinan pahat", stonemason: "Kerajinan pahat", soap_maker: "Industri kecil",
};
// Komoditas dibaca dari tag (crop/produce/product/trees/resource/…) atau kata eksplisit pada nama; dibatasi per kategori
const KOMODITAS = [
  [/oil_?palm|\bsawit\b|palm ?oil|\belaeis\b|\bpalms?\b|\bPKS\b|\bPMKS\b/i, "Kelapa sawit", "pertanian industri"],
  [/\brubber\b|\bkaret\b/i, "Karet", "pertanian industri"],
  [/coconut|kopra|copra|\bkelapa\b(?! sawit)/i, "Kelapa", "pertanian industri"],
  [/\bsagu\b|\bsago\b/i, "Sagu", "pertanian industri"],
  [/\bpinang\b|areca/i, "Pinang", "pertanian industri"],
  [/\brice\b|\bpadi\b|\bberas\b|\bsawah\b|persawahan/i, "Padi", "pertanian industri"],
  [/banana|pisang/i, "Pisang", "pertanian"],
  [/\bjeruk\b|citrus/i, "Jeruk", "pertanian"],
  [/semangka|watermelon/i, "Semangka", "pertanian"],
  [/\bsayur|vegetable/i, "Sayuran", "pertanian"],
  [/\bbuah\b|\bfruit/i, "Buah-buahan", "pertanian"],
  [/\bayam\b|chicken|poultry|unggas/i, "Unggas", "pertanian"],
  [/\bsapi\b|cattle/i, "Sapi", "pertanian"],
  [/kambing|\bgoat/i, "Kambing", "pertanian"],
  [/udang|shrimp|prawn/i, "Udang", "perikanan"],
  [/\bpatin\b/i, "Ikan patin", "perikanan"],
  [/\bikan\b|\bfish\b/i, "Ikan", "perikanan"],
  [/acacia|akasia/i, "Akasia", "kehutanan"],
  [/eucalyptus|ekaliptus/i, "Eukaliptus", "kehutanan"],
  [/timber|\bkayu\b|lumber|plywood|sawmill/i, "Kayu", "kehutanan industri"],
  [/pulp|paper|kertas/i, "Pulp & kertas", "industri"],
  [/\bclay\b|tanah liat/i, "Tanah liat", "pertambangan"],
  [/\bsand\b|(tambang|galian) pasir/i, "Pasir", "pertambangan"],
  [/\bgold\b|\bemas\b/i, "Emas", "pertambangan"],
  [/\bcoal\b|batu ?bara/i, "Batu bara", "pertambangan"],
  [/gravel|\bstone\b|\brock\b|kerikil|granit|(galian|tambang) batu\b/i, "Batu", "pertambangan"],
  [/refinery|crude|petroleum|kilang minyak/i, "Minyak bumi", "industri"],
];
const komoditasDari = (kat, t, n) => {
  const teks = [n, t.crop, t.produce, t.product, t.trees, t.plant, t.genus, t.resource, t.aquaculture, t.industrial].filter(Boolean).join(" | ").replace(/_/g, " ");
  return KOMODITAS.filter(([re, , k]) => k.split(" ").includes(kat) && re.test(teks)).map(([, label]) => label);
};

const AMENITY_OK = new Set(["marketplace", "bank", "ferry_terminal", "bus_station", "fish_market", "money_lender", "bureau_de_change", "microfinance"]);
const LAHAN = new Set(["farmland", "orchard", "plantation", "greenhouse_horticulture", "farmyard", "animal_keeping"]);
const SEKTOR_INSTANSI = [
  ["pertanian", /pertanian|perkebunan|peternakan|tanaman pangan|hortikultura|ketahanan pangan|\bdisbun\b|\bdistan\b|\bBPP\b/i],
  ["perikanan", /perikanan|kelautan|benih ikan/i],
  ["kehutanan", /kehutanan|\bKPH\b|kesatuan pengelolaan hutan/i],
];
const INSTANSI = /\b(dinas|disbun|distan|uptd?|balai|loka|badan|kementerian|kementrian|karantina|kantor|BPP|penyuluhan|KPH|kesatuan|pusdiklat|diklat)\b/i;

/** Kembalikan { kat, sub, penting, klaster, aktif, org } / { abaikan } / null. */
function golongkan(t, n) {
  // sumur & tapak sumur migas dihitung terpisah, tidak dipetakan
  if (t.man_made === "petroleum_well") return { abaikan: "sumur" };
  if (t.industrial === "wellsite") return { abaikan: "tapak" };
  if (t.highway || t.railway || t.route || t.barrier || t.military || t.healthcare || t.boundary === "administrative" || t.boundary === "national_park") return null;
  if (t.place && !["farm", "locality"].includes(t.place)) return null;
  if (t.amenity && !AMENITY_OK.has(t.amenity)) return null;
  if (/^(school|university|college|kindergarten|dormitory)$/.test(t.building ?? "") || /^(residential|cemetery|religious|military|education|grass)$/.test(t.landuse ?? "")) return null;
  if (/^(educational_institution|religion|political_party)$/.test(t.office ?? "")) return null;
  if (BUKAN_USAHA.test(n)) return null;
  if (/^kantor\b/i.test(n) && !/dinas|balai|upt|penyuluh|koperasi|\bKUD\b|bank|bumdes|pegadaian|bumiputera|asuransi/i.test(n)) return null;
  const r = (kat, sub, o = {}) => ({ kat, sub, penting: false, klaster: false, aktif: true, ...o });

  // D — pembangkit listrik (bukan generator kecil/gardu)
  if (t.power === "plant" || (t.power === "generator" && /^PLT|\bPLN\b/i.test(`${n} ${t.operator ?? ""}`))) {
    const src = (t["plant:source"] ?? t["generator:source"] ?? "").split(";")[0];
    // jenis tersurat di nama (PLTU/PLTMG/…) didahulukan; "PLTD/G" ambigu → pakai tag sumber
    const awalan = n.match(/^PLT(MG|GU|G|U|D|A|M|MH|S|Bm|Bg)\b(?!\/)/i)?.[1]?.toUpperCase();
    const dariNama = { MG: "gas", GU: "gas", G: "gas", D: "diesel", A: "hydro", M: "hydro", MH: "hydro", S: "solar", BM: "biomass", BG: "biogas" }[awalan];
    const sub = awalan === "U" ? (src === "coal" ? SUB_ENERGI.coal : "PLTU (tenaga uap)") : SUB_ENERGI[dariNama ?? src] ?? "Pembangkit listrik";
    return r("energi", sub, { penting: true });
  }
  // A — pelabuhan perikanan & tempat pelelangan ikan (sebelum pelabuhan umum)
  if (!/imigrasi/i.test(n) && (t["harbour:category"] === "fishing" || t["seamark:harbour:category"] === "fishing" || /pelabuhan perikanan|\bPP[INS]\b|pendaratan ikan/i.test(n)))
    return r("perikanan", "Pelabuhan perikanan", { penting: true });
  if (/\bTPI\b|pelelangan ikan/i.test(n) && !/imigrasi/i.test(n)) return r("perikanan", "Tempat pelelangan ikan", { penting: true });

  // H — bandara, pelabuhan, terminal BBM
  if (/^(aerodrome|airstrip)$/.test(t.aeroway ?? "")) return /heli/i.test(n) ? null : r("transportasi", "Bandar udara", { penting: true });
  const namaPelabuhan = /^(dermaga|pelantar|jetty)\b|\bpelabuhan\b|\bport\b/i.test(n);
  if (t.harbour || /^(harbour|harbour_basin|small_craft_facility)$/.test(t["seamark:type"] ?? "") || /^(port|harbour)$/.test(t.landuse ?? "") ||
      /^(port|container_terminal)$/.test(t.industrial ?? "") || t.amenity === "ferry_terminal" || (namaPelabuhan && (t.man_made === "pier" || t.leisure === "marina" || t.waterway === "dock" || t.shop || t.landuse === "industrial" || !Object.keys(t).some((k) => k !== "name")))) {
    const cat = `${t["harbour:category"] ?? ""} ${t["seamark:harbour:category"] ?? ""}`;
    const sub = t.industrial === "container_terminal" || /peti ?kemas|container/i.test(n) ? "Terminal peti kemas"
      : t.amenity === "ferry_terminal" || /ferry/.test(cat) || /roro|ferry|feri|penyeberangan/i.test(n) ? "Pelabuhan penyeberangan/penumpang"
      : /\bPT\b|industri|pertamina|chevron/i.test(n) ? "Pelabuhan khusus (industri)" : "Pelabuhan";
    return r("transportasi", sub, { penting: true });
  }
  if ((/^(oil|gas)$/.test(t.industrial ?? "") && /terminal|depot/i.test(n)) || (t.building && /(fuel|BBM|LPG).*(depot|terminal|tank)|(depot|terminal) (BBM|LPG)/i.test(n)))
    return r("transportasi", "Terminal/depot BBM & LPG");

  // operasi hulu migas: dikecualikan (dilaporkan jumlahnya)
  if (!t.amenity && !t.tourism && !t.shop && !t.aeroway && !t.leisure && (MIGAS.test(n) && (t.landuse === "industrial" || t.building || t.industrial || /minas area/i.test(n)) ||
      /^(gathering_station|oil_gas_facility|soil_bioremediation)$/.test(t.industrial ?? "") || (/^(oil|gas)$/.test(t.industrial ?? "") && !/PKS|sawit|palm|agr|refinery|kilang/i.test(n))))
    return { abaikan: "migas" };

  // I/R — pariwisata & akomodasi
  const T = t.tourism;
  if (/pemancingan|\bpancing\b/i.test(n) && !/hobbi|toko/i.test(n)) return r("pariwisata", "Kolam pemancingan");
  if (/taman hutan raya|tahura/i.test(n) && !t.boundary) return r("kehutanan", "Taman hutan raya (Tahura)", { aktif: false });
  if (T === "hotel") return r("pariwisata", "Hotel");
  if (/^(motel|guest_house|hostel|chalet)$/.test(T ?? "")) return /^rumah\b/i.test(n) ? null : r("pariwisata", "Penginapan (wisma/homestay)");
  if (T === "resort" || /^(resort|beach_resort)$/.test(t.leisure ?? "")) return r("pariwisata", "Resor/vila");
  if (T === "museum") return r("pariwisata", "Museum");
  if (T === "gallery") return r("pariwisata", "Galeri seni");
  if (T === "aquarium") return r("pariwisata", "Akuarium");
  if (T === "zoo" && !/kandang|peternakan/i.test(n)) return r("pariwisata", "Kebun binatang/taman satwa");
  if (T === "theme_park") return r("pariwisata", "Taman rekreasi");
  if (t.leisure === "water_park") return r("pariwisata", "Taman rekreasi air");
  if (T === "camp_site") return r("pariwisata", "Bumi perkemahan", { aktif: false });
  if (/^(attraction|yes|picnic_site)$/.test(T ?? "")) return r("pariwisata", "Objek wisata", { aktif: false });
  if (T === "viewpoint") return /tepian|bukit|puncak|pandang|view|panorama|wisata|danau|pantai/i.test(n) ? r("pariwisata", "Objek wisata", { aktif: false }) : null;
  if (t.historic) {
    const h = t.historic;
    if (/^(boundary_stone|battlefield|wayside_cross|wayside_shrine|milestone)$/.test(h)) return null;
    if (h === "archaeological_site") return r("pariwisata", "Situs arkeologi/candi", { aktif: false });
    if (/^(monument|memorial|pillory|city_gate)$/.test(h)) return /^(tugu|monumen|patung|prasasti|candi)\b/i.test(n) && !/batas/i.test(n) ? r("pariwisata", "Tugu/monumen", { aktif: false }) : null;
    if (h === "tomb") return /^makam\b/i.test(n) ? r("pariwisata", "Makam bersejarah", { aktif: false }) : null;
    return /\bhome\b|^gang\b/i.test(n) ? null : r("pariwisata", "Bangunan/situs bersejarah", { aktif: false });
  }
  if (t.natural) {
    const sub = { beach: "Pantai", waterfall: "Air terjun", hot_spring: "Pemandian air panas", cave_entrance: "Gua" }[t.natural];
    return sub ? r("pariwisata", sub, { aktif: false }) : null;
  }
  if ((t.leisure === "nature_reserve" || t.boundary === "protected_area" || t.landuse === "recreation_ground") && /taman wisata alam|\bwisata\b/i.test(n)) return r("pariwisata", "Taman wisata alam", { aktif: false });
  if (t.leisure === "nature_reserve" || t.boundary === "protected_area") return null; // kawasan hutan alam/konservasi besar tidak dimasukkan
  if ((t.leisure === "park" || t.leisure === "garden" || /^taman kota\b/i.test(n)) && /^(taman|hutan kota|RTH|ruang terbuka hijau|alun)/i.test(n))
    return /^taman (bermain|apotik hidup|apotek hidup|smkf|fst)\b/i.test(n) ? null : r("pariwisata", "Taman kota/RTH", { aktif: false });
  if (/\b(wisata|ekowisata|agrowisata)\b|^air terjun\b/i.test(n) && !t.office) return r("pariwisata", "Objek wisata", { aktif: false });

  // K — jasa keuangan & koperasi
  if (!/^(kantor )?dinas\b/i.test(n) && t.amenity !== "marketplace" && !/^pasar\b/i.test(n)) {
    if (/bank sampah/i.test(n)) return null; // bank sampah = pengelolaan sampah, bukan lembaga keuangan
    if (t.shop === "pawnbroker" || /pegadaian|penggadaian|pagadaian/i.test(n)) return r("keuangan", "Pegadaian/jasa gadai");
    if (/\bfinance\b|pembiayaan|leasing/i.test(n)) return r("keuangan", "Lembaga pembiayaan");
    if (t.amenity === "bank" || (/^bank\b|\bBPRS?\b|perkreditan rakyat/i.test(n) && (t.building || t.office))) {
      const b = `${n} ${t.brand ?? ""}`;
      return r("keuangan", /^bank indonesia$/i.test(n) ? "Bank sentral" : /\bBPRS?\b|perkreditan rakyat/i.test(b) ? "Bank perkreditan rakyat (BPR)" : /syariah|muamalat|\bBSI\b/i.test(b) ? "Bank syariah" : "Bank umum");
    }
    if (/\bbumdes\b|bumkam|badan usaha milik (desa|kampung)/i.test(n)) return r("keuangan", "BUMDes", { org: "masyarakat" });
    if (t.office === "cooperative" || /koperasi|\bKUD\b|\bKSP\b|credit union/i.test(n)) return r("keuangan", "Koperasi", { org: "masyarakat" });
    if (/\bBMT\b|baitul ma/i.test(n) || t.amenity === "microfinance") return r("keuangan", "Lembaga keuangan mikro", { org: "masyarakat" });
    if (t.office === "insurance" || /asuransi/i.test(n)) return r("keuangan", "Asuransi");
    if (/^(financial|financial_advisor)$/.test(t.office ?? "") || /\bfinance\b|pembiayaan|leasing/i.test(n)) return r("keuangan", "Lembaga pembiayaan");
    if (/^(bureau_de_change|money_lender)$/.test(t.amenity ?? "")) return r("keuangan", "Jasa keuangan lainnya");
  }

  // G — perdagangan
  if (t.amenity === "marketplace" || /^pasar\b/i.test(n)) {
    // toko/kios yang keliru diberi tag marketplace dibuang
    if (!/pasar|pekan|bazar|market|balai|sentra|plaza|pusat|kios|\blos\b/i.test(n) && /alfamart|indomaret|mini ?market|\bmart\b|\btoko\b|kedai|salon|apotek|plafon|riaupos|serba|fashion|butik|boutique|cafe|warung/i.test(n)) return null;
    if (/pasar ikan/i.test(n)) return r("perikanan", "Pasar ikan", { penting: true });
    return r("perdagangan", /hewan|ternak/i.test(n) ? "Pasar hewan" : /induk/i.test(n) ? "Pasar induk" : "Pasar tradisional", { penting: t.amenity === "marketplace" });
  }
  if (t.shop === "wholesale" || t.wholesale || /grosir/i.test(n) && /^(mall|supermarket|department_store)$/.test(t.shop ?? "")) return /gudang/i.test(n) ? r("transportasi", "Gudang/pergudangan") : r("perdagangan", "Perdagangan grosir");
  if (t.shop === "mall") return r("perdagangan", "Pusat perbelanjaan (mal)");
  if (t.shop === "department_store") return /hardware|parfum/i.test(n) ? r("perdagangan", "Toko serba ada") : r("perdagangan", "Toserba/department store");
  if (t.shop === "supermarket")
    return /swalayan|supermarket|hypermar|lotte|transmart|carrefour|giant|superindo|toserba|plaza|\bmall?\b|market\b|\bmart\b/i.test(n) &&
      !/mini ?market|minimart|indomar|alfamart|alfamidi|kedai|\btoko\b|apotek|fashion|elektronik|cake|count?er|pergudangan/i.test(n) ? r("perdagangan", "Swalayan/supermarket") : null;

  // A — perikanan (budidaya, toko ikan)
  if (t.landuse === "aquaculture" || t.aquaculture || t.water === "fishpond" || /fish|shrimp/.test(t.produce ?? "") && t.landuse) {
    const sub = /udang|shrimp/i.test(`${n} ${t.produce ?? ""} ${t.aquaculture ?? ""}`) ? "Tambak udang" : /tambak/i.test(n) ? "Tambak" : "Kolam budidaya ikan";
    return r("perikanan", sub, { klaster: true, aktif: false });
  }
  if (/^(seafood|fish)$/.test(t.shop ?? "") || t.amenity === "fish_market") return r("perikanan", "Pasar/toko ikan");

  // A — pembibitan (sawit/pertanian → pertanian, selain itu → persemaian kehutanan)
  if (t.landuse === "plant_nursery" || /pembibitan|persemaian|nursery/i.test(n)) {
    if (/palm|elaeis|sawit/i.test(`${n} ${t.plant ?? ""} ${t.genus ?? ""} ${t.trees ?? ""}`)) return r("pertanian", "Pembibitan kelapa sawit", { aktif: false });
    if (/pertanian|perkebunan/i.test(n)) return r("pertanian", "Balai benih/pembibitan");
    return r("kehutanan", "Persemaian/pembibitan", { aktif: false });
  }
  // instansi teknis sektor A (sektor = kata kunci yang muncul paling awal pada nama)
  if (INSTANSI.test(n) && (t.office || t.building || t.government || t.landuse || t.amenity || !Object.keys(t).some((k) => k !== "name"))) {
    const kena = SEKTOR_INSTANSI.map(([k, re]) => [k, n.search(re)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1])[0];
    if (kena) {
      const [k] = kena;
      const sub = k === "pertanian" ? (/penyuluh|\bBPP\b/i.test(n) ? "Balai penyuluhan pertanian" : /benih/i.test(n) ? "Balai benih/pembibitan" : "Instansi pertanian")
        : k === "perikanan" ? (/benih/i.test(n) ? "Balai benih ikan" : "Instansi perikanan & kelautan")
        : /KPH|kesatuan pengelolaan/i.test(n) ? "Kesatuan pengelolaan hutan (KPH)" : /diklat|pendidikan|pelatihan/i.test(n) ? "Balai diklat kehutanan" : "Instansi kehutanan";
      return r(k, sub, { org: "pemerintah" });
    }
  }
  // A — kehutanan: hutan tanaman (HTI) bernama & perhutanan sosial; hutan alam tidak dimasukkan
  if (t.landuse === "forest" || t.natural === "wood") {
    if (/\bHTI\b|hutan tanaman/i.test(n) || t.produce === "timber" || /acacia|eucalyptus/i.test(t.trees ?? "")) return r("kehutanan", "Hutan tanaman industri (HTI)", { aktif: false });
    return null;
  }
  if (/hutan (desa|kemasyarakatan|adat|rakyat|tanaman rakyat)/i.test(n)) return r("kehutanan", "Perhutanan sosial", { aktif: false });
  if (/kelompok tani|gapoktan|poktan/i.test(n)) return r("pertanian", "Kelompok tani", { org: "masyarakat" });

  // A — pertanian, perkebunan, peternakan
  if (LAHAN.has(t.landuse) || t.place === "farm" || (t.leisure === "garden" && /^(kebun|sawah|persawahan|lokasi persawahan|ladang)\b/i.test(n)) || /kandang|peternakan/i.test(n) && T === "zoo") {
    const kom = komoditasDari("pertanian", t, n);
    const sub = t.landuse === "animal_keeping" || /kandang|peternakan|ternak|\bayam\b|\bsapi\b|kambing|\bkuda|stable/i.test(n) ? "Peternakan"
      : kom.includes("Kelapa sawit") ? "Perkebunan kelapa sawit" : kom.includes("Karet") ? "Perkebunan karet" : kom.includes("Kelapa") ? "Perkebunan kelapa"
      : kom.includes("Pinang") ? "Perkebunan pinang" : kom.includes("Padi") ? "Persawahan" : t.landuse === "greenhouse_horticulture" ? "Hortikultura (rumah kaca)"
      : kom.some((k) => /Pisang|Jeruk|Semangka|Sayuran|Buah/.test(k)) ? "Hortikultura (buah & sayur)" : t.place === "farm" ? "Usaha tani" : "Kebun/lahan pertanian";
    return r("pertanian", sub, { aktif: false });
  }
  if (t.shop === "agrarian") return r("pertanian", "Toko sarana produksi pertanian");
  if (t.shop === "farm") return r("pertanian", "Kios hasil pertanian");
  if (t.shop === "garden_centre") return r("pertanian", "Toko tanaman & bibit");

  // B — pertambangan & penggalian (tanpa migas)
  if (t.landuse === "quarry" || /^(mineshaft|adit)$/.test(t.man_made ?? "") || /^(mine|quarry|mining)$/.test(t.industrial ?? "") ||
      /tambang (pasir|batu|emas|timah|tanah)|galian c|galian pasir|penambangan|quarry|stone crusher/i.test(n) && !t.shop) {
    const res = `${t.resource ?? ""} ${n}`;
    const sub = /sand|pasir/i.test(res) ? "Galian pasir" : /clay|tanah liat/i.test(res) ? "Galian tanah liat" : /gold|emas/i.test(res) ? "Tambang emas"
      : /coal|batu ?bara/i.test(res) ? "Tambang batu bara" : /gravel|stone|rock|batu|granit/i.test(res) ? "Galian batu" : "Pertambangan/penggalian";
    return r("pertambangan", sub, { klaster: true, aktif: false });
  }

  // H — terminal bus (halte dibuang)
  if (t.amenity === "bus_station" || t.public_transport === "station")
    return /halte|busway|bus stop|pemberhentian|travel|retail|\bTMP\b|shelter|chevron/i.test(n) || (!t.amenity && !/terminal/i.test(n)) ? null : r("transportasi", "Terminal bus");
  // H — pergudangan (nama/tag gudang)
  if (/^(warehouse|logistics|depot)$/.test(t.industrial ?? "") || t.building === "warehouse" || /^(gudang|pergudangan|kompleks pergudangan|komplek pergudangan|warehouse)\b|\bbulog\b|logisti[ck]/i.test(n))
    return /ruko/i.test(n) ? null : r("transportasi", "Gudang/pergudangan");

  // C — industri pengolahan
  const k = t.industrial ?? "";
  if (/\b(PKS|PMKS|POM)\b|pabrik (kelapa )?sawit|palm oil mill|kilang sawit/i.test(n) || /palm_?oil|\bCPO\b/i.test(t.product ?? "") || (k === "oil_mill" && /sawit|palm/i.test(`${n} ${t.product ?? ""} ${t.crop ?? ""}`)))
    return r("industri", "Pabrik kelapa sawit", { penting: true, kom: ["Kelapa sawit"] });
  if (k === "oil_mill") return r("industri", "Pabrik minyak nabati", { penting: true });
  if (k === "refinery" || /refinery|kilang minyak/i.test(n)) return r("industri", "Kilang minyak", { penting: true });
  if (k === "paper_mill" || /pulp|paper|kertas/i.test(n) && (t.landuse || k || t.man_made)) return r("industri", "Industri pulp & kertas", { penting: true });
  if (/^(sawmill|timber|lumber_yard|wood)$/.test(k) || t.craft === "sawmill" || /plywood|sawmill|kayu lapis|penggergajian|pabrik kayu|lumber/i.test(n)) return r("industri", "Industri kayu", { penting: true });
  if (k === "slaughterhouse" || /rumah potong hewan|\bRPH\b/i.test(n)) return r("industri", "Rumah potong hewan", { penting: true });
  if (/^(food_processing|dairy|bakery|brewery)$/.test(k) || /pabrik (tahu|tempe|roti|es|kerupuk|keripik|kecap|mie|minuman)|\broti\b|keripik|kerupuk|\bfood\b|makanan|minuman|coca-cola/i.test(n) && (t.landuse || t.building || t.man_made || k || !Object.keys(t).some((x) => !/^(name|description)$/.test(x))))
    return r("industri", "Industri makanan & minuman", { penting: true });
  if (k === "brickworks" || /batu bata|batako|genteng/i.test(n)) return r("industri", "Industri bata & genteng", { penting: true });
  if (/^(concrete_plant|tarmac|asphalt|cement)$/.test(k) || /beton|aspal|semen\b/i.test(n) && (t.landuse || k || t.man_made)) return r("industri", "Industri beton & aspal", { penting: true });
  if (t.craft) return KRIYA[t.craft] ? r("industri", KRIYA[t.craft]) : null;
  if (/^(scrap_yard|cooling)$/.test(k)) return null;
  if (/kawasan industri|industrial (estate|park)|\bKIT\b|\bKEK\b/i.test(n)) return r("industri", "Kawasan industri", { aktif: false });
  if (t.man_made === "works" || k) return r("industri", "Pabrik/industri pengolahan", { penting: true });
  if (t.landuse === "industrial") return r("industri", "Fasilitas industri", { aktif: false });
  if (/^(industrial|factory|manufacture)$/.test(t.building ?? "") || (t.building && !t.shop && !t.office)) // bangunan saja: perlu petunjuk kuat di nama
    return /pabrik|\bmill\b|industri|factory|\bPT\b|\bCV\b/i.test(n) ? r("industri", "Fasilitas industri", { aktif: false }) : null;
  if (!Object.keys(t).some((x) => !/^(name|description)$/.test(x)) && /^(pabrik|industri)\b/i.test(n)) return r("industri", "Pabrik/industri pengolahan", { penting: true });
  return null;
}

// ---------------------------------------------------------------------------
// 3. Bantuan teks: nama, aktor, atribut, deskripsi
// ---------------------------------------------------------------------------
const JENIS_KAB = new Map(baca(path.join(AKAR, "src/data/wilayah.json")).data.filter((d) => d[2] === "kabupaten").map((d) => [d[0], d[6]]));
const rapikan = (s) => {
  let n = String(s ?? "").replace(/\s+/g, " ").trim();
  if (n && n === n.toLowerCase()) n = n.replace(/(^|[\s(/-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()); // "kebun sawit" → "Kebun Sawit"
  return n.replace(/\b(Pt|Cv)\b\.?/g, (m) => m.toUpperCase());
};
const namaUmum = (n) => !n || n.length < 3 || /^[\d\s.,-]+$/.test(n) || NAMA_UMUM.has(n.toLowerCase());

// Kelompok aktor dari nama organisasi: BUMN/BUMD/Pemda → pemerintah; koperasi/kelompok/BUMDes → masyarakat; selainnya swasta
const MERK_BUMN = /^(BRI|BNI|BTN|BSI|Mandiri|Bank Riau Kepri|BRK( Syariah)?|Pegadaian|Pertamina|PLN|Bulog|Pelindo|ASDP|Angkasa Pura|PTPN.*)$/i;
function golongAktor(s) {
  if (/koperasi|\bKUD\b|\bKSP\b|kelompok|gapoktan|poktan|bumdes|bumkam|badan usaha milik (desa|kampung)|pokdarwis|masyarakat|swadaya|credit union|yayasan|\bBMT\b/i.test(s)) return "masyarakat";
  if (MERK_BUMN.test(s.trim()) || /\b(BUMN|BUMD|persero|perum|perumda|pemerintah|government|pemkab|pemko|pemprov|pemda|dinas|dispora|kementerian|kementrian|kemenhub|balai|loka|UPTD?|badan|unit penyelenggara|pertamina|PLN|pelindo|ASDP|angkasa pura|PTPN|perkebunan nusantara|bulog|pegadaian|perhutani|bank rakyat indonesia|bank negara indonesia|bank mandiri|bank syariah mandiri|bank tabungan negara|bank syariah indonesia|bank riau|BRK|BRI|BNI|BTN|bumi siak pusaka|PDAM|otoritas|syahbandar|KPH)\b/i.test(s)) return "pemerintah";
  return "swasta";
}
const PT_DI_NAMA = /\b(PT|CV)(\.\s*|\s+)[^,;()]+/;
const BUMN_DI_NAMA = /\b(PTPN\s*[IVX\d]+|Pertamina|PLN|Bulog|Pelindo|Pegadaian|ASDP|Angkasa Pura|BRI|BNI|BTN|BSI|Bank Mandiri|Bank Riau( Kepri)?|BRK)\b/i;
// instansi yang tersurat di nama (mis. "Tambak Udang Dinas Perikanan Pelalawan"); "Balai" saja bisa nama tempat
const INSTANSI_DI_NAMA = /\b(Dinas|UPTD?|Pemerintah|Pemkab|Pemko|Pemprov)\b[^,;()]*|\bBalai (Benih|Penyuluhan|Karantina|Besar|Pertanian|Perikanan|Diklat|Pendidikan)[^,;()]*/;

function alamat(t) {
  if (t["addr:full"]) return t["addr:full"];
  const jalan = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  return [jalan, t["addr:village"] ?? t["addr:subdistrict"], t["addr:district"], t["addr:city"], t["addr:postcode"]].filter(Boolean).join(", ");
}
const kapasitas = (t) => {
  const mw = t["plant:output:electricity"] ?? t["generator:output:electricity"];
  if (mw && /[a-z]/i.test(mw) && mw !== "yes") return mw;
  return t.capacity && /\d/.test(t.capacity) ? t.capacity : t.rooms ? `${t.rooms} kamar` : t.beds ? `${t.beds} tempat tidur` : "";
};
const huruf = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// 4. Klasifikasi, lokasi, dedup
// ---------------------------------------------------------------------------
console.log("2/4 Pemetaan tag → kategori");
const abaikan = { sumur: 0, tapak: 0, migas: [] };
const diLuar = [];
let tanpaNama = 0;
const calon = [];
for (const [kunci, e] of semua) {
  const t = e.tags ?? {};
  const mentahNama = t.name ?? t["name:id"] ?? t.official_name ?? "";
  const g = golongkan(t, mentahNama.trim());
  if (!g) continue;
  if (g.abaikan) { if (g.abaikan === "migas") abaikan.migas.push(mentahNama || kunci); else abaikan[g.abaikan]++; continue; }
  const lon = e.lon ?? e.center?.lon, lat = e.lat ?? e.center?.lat;
  if (lon == null) continue;
  const lok = lokasiDariTitik([lon, lat]);
  if (!lok) { diLuar.push(mentahNama || `${g.sub} ${kunci}`); continue; } // di luar poligon kecamatan gazetir
  let nama = rapikan(mentahNama.split(";")[0]);
  if (!nama && (g.kat === "keuangan" || g.kat === "perdagangan")) nama = rapikan(t.brand);
  // nama pasar yang bukan nama pasar (mis. "Gedung 2", "Ranggon") → diperlakukan tanpa nama
  if (namaUmum(nama) || (t.amenity === "marketplace" && !/pasar|pekan|bazar|market|balai|sentra|plaza|pusat|kios|\blos\b/i.test(nama))) nama = "";
  if (!nama && !g.penting && !g.klaster) { tanpaNama++; continue; }
  // pengelola = operator → brand → owner (nilai generik seperti "public" dibuang, "personal" → "Perorangan")
  const asalPengelola = ["operator", "brand", "owner"].find((k) => t[k]?.trim() && OPERATOR_UMUM[t[k].trim().toLowerCase()] !== "");
  const mentahPengelola = asalPengelola ? t[asalPengelola].trim() : "";
  const pengelolaList = (OPERATOR_UMUM[mentahPengelola.toLowerCase()] ?? mentahPengelola).split(/\s*;\s*/).filter(Boolean);
  const pengelola = pengelolaList.join(", ");
  // skor kelengkapan: dipakai memilih wakil saat dedup
  const skor = Object.keys(t).filter((x) => !/^(building|source|access:roof|roof|layer|area)/.test(x)).length + (e.type === "node" ? 0 : 0.5);
  calon.push({ kunci, e, t, ...g, nama, pengelola, pengelolaList, asalPengelola, skor, xy: [lon, lat], lok, hanyaBangunan: !!t.building && !t.landuse && !t.man_made && !t.industrial && !t.amenity && !t.shop && !t.office && !t.tourism });
}
console.log(`  ${calon.length} calon; ${abaikan.tapak} tapak sumur, ${abaikan.migas.length} fasilitas hulu migas diabaikan; ${diLuar.length} di luar poligon kecamatan; ${tanpaNama} tanpa nama dibuang`);

const jarakM = ([x1, y1], [x2, y2]) => 1000 * Math.hypot((x1 - x2) * 111.32 * Math.cos(((y1 + y2) / 2) * Math.PI / 180), (y1 - y2) * 110.57);
// kumpulkan anggota grup ke wakil (wakil = bukan sekadar bangunan/bagian, lalu tag terlengkap, lalu nama terpendek)
const bagian = (c) => /\b(office|area|house|room|pos|gedung|ruang)\b/i.test(c.nama);
const gabung = (grup) => {
  grup.sort((a, b) => (a.hanyaBangunan - b.hanyaBangunan) || (bagian(a) - bagian(b)) || (b.skor - a.skor) || (a.nama.length - b.nama.length));
  const [w, ...lain] = grup;
  w.anggota = [...(w.anggota ?? [w]), ...lain.flatMap((x) => x.anggota ?? [x])];
  return w;
};
// union-find sederhana untuk klaster berbasis jarak
function klaster(list, dekat) {
  const ind = list.map((_, i) => i);
  const akar = (i) => (ind[i] === i ? i : (ind[i] = akar(ind[i])));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (dekat(list[i], list[j])) ind[akar(i)] = akar(j);
  const m = new Map();
  list.forEach((x, i) => m.set(akar(i), [...(m.get(akar(i)) ?? []), x]));
  return [...m.values()];
}
const kelompokkan = (list, f) => list.reduce((m, x) => m.set(f(x), [...(m.get(f(x)) ?? []), x]), new Map());

console.log("3/4 Dedup & klaster");
const bernama = calon.filter((c) => c.nama);
// (a) nama sama + kategori sama dalam ≤ 300 m → satu titik (node & way untuk objek yang sama);
//     urutan kata & kata "hotel" diabaikan ("Hotel Parma City" = "Parma City Hotel")
const kunciNama = (n) => slug(n).split("-").filter((w) => w && w !== "hotel" && w !== "the").sort().join("-");
let hasil = [...kelompokkan(bernama, (c) => `${c.kat}|${kunciNama(c.nama)}`).values()]
  .flatMap((g) => klaster(g, (a, b) => jarakM(a.xy, b.xy) <= 300).map(gabung));
// (b) kompleks non-POI: bagian bangunan/area satu fasilitas (mis. "Gudang Bulog I" & "Bulog") ≤ 500 m dengan kata khas yang sama
const KATA_UMUM = new Set(["pabrik", "kelapa", "sawit", "pelabuhan", "gudang", "kantor", "dinas", "balai", "power", "plant", "industri", "industrial", "kawasan", "terminal", "office", "center", "centre", "house", "indonesia", "nusantara", "makmur", "sejahtera", "abadi", "utama", "mandiri", "perkasa", "persada", "group", "global", "international", "kabupaten", "provinsi", "pertanian", "perikanan", "kehutanan", "perkebunan", "peternakan", "kelautan", "tanaman", "pangan", "hutan", "estate", "pulp", "paper", "riau", "andalan", "pembangkit", "station", "kebun", "lahan", "tambak", "galian", "tambang"]);
for (const w of WILAYAH) for (const k of slug(w.nama).split("-")) KATA_UMUM.add(k); // nama tempat bukan penanda kompleks
const kataKhas = (n) => slug(n).split("-").filter((w) => w.length >= 5 && !KATA_UMUM.has(w) && !/^\d+$/.test(w));
const NON_POI = new Set(["industri", "energi", "kehutanan", "pertanian", "pertambangan", "perikanan", "transportasi"]);
hasil = [...kelompokkan(hasil, (c) => (NON_POI.has(c.kat) && c.sub !== "Hutan tanaman industri (HTI)" ? c.kat : `${c.kat}|${c.kunci}`)).values()].flatMap((g) =>
  klaster(g, (a, b) => {
    const m = jarakM(a.xy, b.xy);
    if (m > 1000) return false;
    const ka = slug(a.nama).split("-"), kb = slug(b.nama).split("-");
    // "Perawang Mill Power Plant" ⊂ "Perawang Mill Coal Power Plant"; nama satu kata hanya bila khas ("Bulog", bukan "Dumai")
    const [kecil, besar] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
    const subset = kecil.every((w) => besar.includes(w)) && (kecil.length > 1 || kataKhas(kecil[0]).length > 0);
    const sama = m <= 500 && kataKhas(a.nama).some((w) => kataKhas(b.nama).includes(w));
    return subset || sama;
  }).map(gabung));
// (c) titik tanpa nama: lebur ke fasilitas sejenis ≤ 500 m (sub sama, atau sama-sama fasilitas penting di kategori itu),
//     sisanya diklaster (budidaya/galian ≤ 1 km, lainnya ≤ 500 m)
const tanpa = calon.filter((c) => !c.nama);
const sisa = tanpa.filter((c) => {
  const induk = hasil.find((h) => h.kat === c.kat && (h.sub === c.sub || (h.penting && c.penting)) && jarakM(h.xy, c.xy) <= 500);
  if (induk) induk.anggota.push(c);
  return !induk;
});
for (const g of kelompokkan(sisa, (c) => `${c.kat}|${c.sub}`).values())
  for (const k of klaster(g, (a, b) => jarakM(a.xy, b.xy) <= (a.klaster ? 1000 : 500))) {
    const w = gabung(k);
    w.dibuat = true;
    hasil.push(w);
  }

// ---------------------------------------------------------------------------
// 5. Susun rekaman keluaran
// ---------------------------------------------------------------------------
console.log("4/4 Menyusun rekaman");
const URL_OSM = { node: "node", way: "way", relation: "relation" };
function status(t, aktif) {
  const k = Object.keys(t);
  if (t.disused === "yes" || t.abandoned === "yes" || k.some((x) => /^(disused|abandoned|was|demolished|razed|removed):/.test(x)) ||
      /closed|abandoned|disused/.test(t.operational_status ?? "") || /^(closed|off)$/i.test(t.opening_hours ?? "")) return "Tidak aktif";
  if (t.construction || k.some((x) => /^construction:/.test(x)) || t.landuse === "construction" || t.building === "construction" || /construction/.test(t.status ?? "")) return "Dalam pembangunan";
  return aktif ? "Beroperasi" : "Tidak diketahui";
}

const data = hasil.map((c) => {
  const t = c.t;
  const [kab, kec, desa] = rantai(c.lok.wilayahId);
  const tempat = desa ? desa.nama : `Kec. ${kec.nama}`;
  const kabTeks = `${JENIS_KAB.get(kab.id) === "Kota" ? "Kota" : "Kabupaten"} ${kab.nama}`;
  const lokTeks = `${desa ? `sekitar ${desa.nama}, ` : ""}Kecamatan ${kec.nama}, ${kabTeks}`;
  const nAnggota = c.anggota.length;
  // nama deskriptif untuk objek tanpa nama
  let nama = nAnggota > 1 ? c.nama.replace(/\s+(office|area|house)$/i, "") : c.nama; // wakil kompleks: buang akhiran bagian
  if (!nama) nama = c.sub.startsWith("Pasar") ? `Pasar ${tempat}` : c.pengelola && !c.klaster ? `${c.sub} ${c.pengelola}` : `${c.sub} di ${tempat}`;
  const kom = [...new Set([...(c.kom ?? []), ...c.anggota.flatMap((a) => komoditasDari(c.kat, a.t, a.nama))])];
  const st = status(t, c.aktif);
  const src = (t["plant:source"] ?? t["generator:source"] ?? "").split(";")[0];
  const kap = kapasitas(t);

  // aktor: pengelola dari tag + organisasi yang tersurat di nama (PT/CV) + entitas itu sendiri bila ia organisasi
  const dariNama = [nama.match(PT_DI_NAMA)?.[0]?.trim(), / PT\.?$/.test(nama) ? nama : null, nama.match(BUMN_DI_NAMA)?.[0],
    NON_POI.has(c.kat) && !c.org ? nama.match(INSTANSI_DI_NAMA)?.[0]?.trim() : null];
  const aktor = [...new Set([...c.pengelolaList, ...dariNama].filter(Boolean))];
  if (!aktor.length && (c.org || c.kat === "keuangan")) aktor.push(nama);
  const keterlibatan = { pemerintah: [], swasta: [], masyarakat: [] };
  for (const a of aktor) {
    const g = c.org && a === nama ? c.org : golongAktor(a);
    // dari tag pengelola boleh default swasta; dari nama hanya bila tersurat (PT/CV/Tbk) — jangan menebak
    if (g === "swasta" && !c.pengelolaList.includes(a) && !/\b(PT|CV|Tbk)\b/.test(a)) continue;
    if (!keterlibatan[g].includes(a)) keterlibatan[g].push(a);
  }
  // nama menyebut BUMN/BUMD (mis. "BRI") tetapi tag operator berisi nama orang → operator itu tidak dihitung swasta
  if (golongAktor(nama) === "pemerintah") keterlibatan.swasta = keterlibatan.swasta.filter((s) => /\b(PT|CV|Tbk)\b/.test(s) || !c.pengelolaList.includes(s));

  const atribut = {};
  const isi = (k, v) => { v = String(v ?? "").trim(); if (v) atribut[k] = v; };
  isi("Jam buka", t.opening_hours);
  isi("Situs web", t.website ?? t["contact:website"] ?? t.url);
  isi("Telepon", t.phone ?? t["contact:phone"]);
  isi("Email", t.email ?? t["contact:email"]);
  isi("Alamat", alamat(t));
  isi("Sumber energi", JENIS_ENERGI[src] ?? src);
  isi("Kapasitas", kap);
  isi("Produk", t.product?.replace(/_/g, " "));
  isi("Tanaman/hasil", [t.crop, t.trees, t.produce].filter(Boolean).join("; ").replace(/_/g, " "));
  isi("Bahan tambang", t.resource);
  isi("Kode IATA", t.iata);
  isi("Kode ICAO", t.icao);
  isi("Bintang", t.stars);
  isi("Cabang", t.branch);
  if (c.asalPengelola !== "brand") isi("Merek", t.brand);
  if (c.asalPengelola !== "owner") isi("Pemilik", t.owner);
  isi("Nama lain", [t.alt_name, t.official_name, t.old_name, t.loc_name, t.short_name].filter((x) => x && x !== t.name).join("; "));
  isi("Keterangan OSM", t.description?.replace(/\s+/g, " ").slice(0, 300));
  if (c.dibuat) isi("Catatan nama", "Nama dibuat otomatis — objek OSM tanpa nama");
  if (nAnggota > 1) isi("Objek OSM digabung", nAnggota);

  // deskripsi 1–2 kalimat, hanya dari tag
  const rinci = [];
  if (c.dibuat && nAnggota > 1) rinci.push(`gabungan ${nAnggota} objek OSM tanpa nama yang berdekatan`);
  if (c.pengelola) rinci.push(`${{ operator: "dikelola oleh", brand: "merek", owner: "milik" }[c.asalPengelola]} ${c.pengelola}`);
  const komBaru = kom.filter((k) => !c.sub.toLowerCase().includes(k.toLowerCase())); // "Pabrik kelapa sawit" tak perlu diulang
  if (komBaru.length) rinci.push(`komoditas: ${komBaru.join(", ").toLowerCase()}`);
  const jenisEnergi = JENIS_ENERGI[src] ?? src;
  if (src && !c.sub.toLowerCase().includes(jenisEnergi)) rinci.push(`sumber energi ${jenisEnergi}${kap ? `, kapasitas ${kap}` : ""}`);
  else if (kap && c.kat === "energi") rinci.push(`kapasitas ${kap}`);
  if (t.stars) rinci.push(`hotel bintang ${t.stars}`);
  if (t.iata || t.icao) rinci.push(`kode ${[t.iata && `IATA ${t.iata}`, t.icao && `ICAO ${t.icao}`].filter(Boolean).join(" / ")}`);
  if (st === "Tidak aktif") rinci.push("ditandai tidak aktif/terbengkalai di OSM");
  if (st === "Dalam pembangunan") rinci.push("ditandai sedang dibangun di OSM");
  const deskripsi = `${c.sub} di ${lokTeks}.` + (rinci.length ? ` ${huruf(rinci.join("; "))}.` : "");

  return {
    id: `p-osm-${c.e.type[0]}${c.e.id}`,
    nama, kategori: c.kat, subkategori: c.sub, komoditas: kom, status: st, deskripsi,
    pengelola: c.pengelola, keterlibatan, atribut,
    sumber: c.anggota.slice(0, 10).map((a) => ({ nama: "OpenStreetMap", url: `https://www.openstreetmap.org/${URL_OSM[a.e.type]}/${a.e.id}` })),
    lampiran: [], wilayahId: c.lok.wilayahId, presisi: "titik",
    koordinat: c.xy.map((v) => Math.round(v * 1e5) / 1e5),
    asal: "OSM", kerahasiaan: "Publik",
    tanggal: (c.e.timestamp ?? "").slice(0, 10),
  };
});

// nama buatan yang kembar (mis. dua klaster galian di desa yang sama) diberi nomor urut
for (const list of kelompokkan(data.filter((d) => d.atribut["Catatan nama"]), (d) => d.nama).values())
  if (list.length > 1) list.sort((a, b) => a.koordinat[1] - b.koordinat[1]).forEach((d, i) => (d.nama += ` (${i + 1})`));

const URUT = ["pertanian", "perikanan", "kehutanan", "pertambangan", "industri", "energi", "perdagangan", "transportasi", "pariwisata", "keuangan"];
data.sort((a, b) => URUT.indexOf(a.kategori) - URUT.indexOf(b.kategori) || a.wilayahId.localeCompare(b.wilayahId) || a.nama.localeCompare(b.nama));
const ringkasan = Object.fromEntries(URUT.map((k) => [k, data.filter((d) => d.kategori === k).length]));
const hariIni = new Date().toISOString().slice(0, 10);

simpan(path.join(SUMBER, "potensi.json"), {
  dibuat: new Date().toISOString(),
  sumber: [{
    nama: "OpenStreetMap", url: "https://www.openstreetmap.org", lisensi: "ODbL 1.0 — © OpenStreetMap contributors",
    catatan: `Diunduh lewat Overpass API ${hariIni} (area admin_level=4 Riau). Titik = node atau titik tengah way/relation. Kategori dipetakan dari tag OSM ke lapangan usaha BPS/KBLI 2020; ` +
      `objek sama (nama sama ≤ 300 m, bagian satu kompleks ≤ 500 m) digabung, objek penting tanpa nama diberi nama deskriptif. ` +
      `Status "Beroperasi" mengikuti konvensi OSM bahwa tag utama menggambarkan fungsi saat ini; lahan/situs tanpa tanda aktivitas = "Tidak diketahui". ` +
      `Tidak dimasukkan: ${SUMUR} sumur minyak (man_made=petroleum_well), ${abaikan.tapak} tapak sumur (industrial=wellsite), ${abaikan.migas.length} fasilitas operasi hulu migas (field/GS/camp), serta kawasan hutan alam/konservasi besar.`,
  }],
  jumlah: data.length, ringkasan, sumurMinyakDiabaikan: SUMUR, data,
});

// ringkasan untuk log
console.log(`  total ${data.length} titik`);
console.log("  per kategori:", ringkasan);
const perKab = kelompokkan(data, (d) => rantai(d.wilayahId)[0].nama);
console.log("  per kabupaten/kota:", Object.fromEntries([...perKab].map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1])));
console.log("  per subkategori:", Object.fromEntries([...kelompokkan(data, (d) => `${d.kategori}/${d.subkategori}`)].map(([k, v]) => [k, v.length])));
console.log("  status:", Object.fromEntries([...kelompokkan(data, (d) => d.status)].map(([k, v]) => [k, v.length])));
console.log("  fasilitas hulu migas diabaikan:", abaikan.migas.join(" | "));
console.log("  dibuang karena lokasiDariTitik = null:", diLuar.join(" | "));
