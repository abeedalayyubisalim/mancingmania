// Fish "catalog". spawnWeight = relative chance of appearing (higher = more
// common). rarityBias makes rarer fish more likely on longer/stronger casts
// (and can be boosted further by store items — see rollFish below).
//
// Each catch rolls an actual weight (kg) between minKg/maxKg, and points are
// computed from that weight × pointsPerKg — a bigger fish is worth more.
//
// latin/habitat/sizeInfo/lifespan/fact are real facts (for the real species)
// used by the in-game Fish Dex. The legendary fish and the junk items are
// fictional/flavor entries instead.
export const FISH_TYPES = [
  {
    id: 'sardine',
    name: 'Sarden',
    tier: 'common',
    spawnWeight: 40,
    minKg: 0.05,
    maxKg: 0.15,
    pointsPerKg: 60,
    color: 0xb9c7d1,
    size: 0.5,
    rarityBias: 0,
    latin: 'Sardinella lemuru',
    habitat:
      'Perairan pesisir Indo-Pasifik Barat, dari selatan Jepang lewat Nusantara sampai Australia Barat. Salah satu tangkapan utama nelayan di Selat Bali.',
    sizeInfo: 'Umumnya sekitar 20 cm, jarang lebih dari 23 cm.',
    lifespan: 'Sekitar 4-5 tahun.',
    fact: 'Hidup bergerombol besar (schooling) dekat permukaan laut untuk menghindari predator.',
  },
  {
    id: 'mackerel',
    name: 'Kembung',
    tier: 'common',
    spawnWeight: 32,
    minKg: 0.1,
    maxKg: 0.35,
    pointsPerKg: 55,
    color: 0x5c7ea3,
    size: 0.65,
    rarityBias: 0.05,
    latin: 'Rastrelliger kanagurta',
    habitat:
      'Teluk & laguna pesisir berair keruh kaya plankton di seluruh Indo-Pasifik Barat — dari Afrika Timur, Laut Merah, hingga Indonesia, Jepang selatan, dan Australia.',
    sizeInfo: 'Umumnya 25 cm, maksimal tercatat 36-42 cm.',
    lifespan: 'Sekitar 4 tahun.',
    fact: 'Salah satu ikan pelagis kecil terpenting dalam perikanan Asia Tenggara.',
  },
  {
    id: 'bandeng',
    name: 'Bandeng',
    tier: 'common',
    spawnWeight: 28,
    minKg: 0.3,
    maxKg: 1.8,
    pointsPerKg: 40,
    color: 0xc7d6de,
    size: 0.7,
    rarityBias: 0,
    latin: 'Chanos chanos',
    habitat:
      'Perairan payau & tambak pesisir Indo-Pasifik. Salah satu ikan budidaya tambak paling umum di Indonesia.',
    sizeInfo: 'Umumnya 30-50 cm di tambak, bisa lebih dari 1 m di alam liar.',
    lifespan: 'Bisa hidup lebih dari 15 tahun.',
    fact: 'Durinya halus dan banyak, tapi jadi favorit lewat olahan khas "bandeng presto".',
  },
  {
    id: 'nila',
    name: 'Nila',
    tier: 'common',
    spawnWeight: 30,
    minKg: 0.2,
    maxKg: 1.2,
    pointsPerKg: 38,
    color: 0x6b8f6a,
    size: 0.55,
    rarityBias: 0,
    freshwater: true,
    latin: 'Oreochromis niloticus',
    habitat:
      'Sungai, danau, dan waduk air tawar tropis. Aslinya dari Afrika, kini tersebar luas lewat budidaya termasuk di Indonesia.',
    sizeInfo: 'Umumnya 20-35 cm.',
    lifespan: 'Sekitar 6-9 tahun.',
    fact: 'Induk betina mengerami telur dan anaknya di dalam mulut untuk melindungi mereka dari predator.',
  },
  {
    id: 'mujair',
    name: 'Mujair',
    tier: 'common',
    spawnWeight: 26,
    minKg: 0.15,
    maxKg: 0.9,
    pointsPerKg: 35,
    color: 0x8a9a5b,
    size: 0.5,
    rarityBias: 0,
    freshwater: true,
    latin: 'Oreochromis mossambicus',
    habitat: 'Air tawar & payau. Dibawa ke Indonesia tahun 1939 dan langsung menyebar cepat di banyak perairan.',
    sizeInfo: 'Umumnya 15-25 cm.',
    lifespan: 'Sekitar 5-7 tahun.',
    fact: 'Namanya diambil dari nama penemunya di Indonesia, Bapak Mujair.',
  },
  {
    id: 'lele',
    name: 'Lele',
    tier: 'common',
    spawnWeight: 24,
    minKg: 0.3,
    maxKg: 2.5,
    pointsPerKg: 32,
    color: 0x3a3a3a,
    size: 0.75,
    rarityBias: -0.05,
    freshwater: true,
    latin: 'Clarias sp.',
    habitat: 'Sungai, kolam, dan rawa berlumpur air tawar tropis di Asia & Afrika.',
    sizeInfo: 'Umumnya 20-40 cm, bisa lebih besar di alam liar.',
    lifespan: 'Sekitar 8-15 tahun.',
    fact: 'Punya organ pernapasan tambahan (labirin) sehingga bisa bertahan lama di luar air.',
  },
  {
    id: 'snapper',
    name: 'Kakap',
    tier: 'uncommon',
    spawnWeight: 16,
    minKg: 1,
    maxKg: 6,
    pointsPerKg: 45,
    color: 0xe0654a,
    size: 0.8,
    rarityBias: 0.2,
    latin: 'Lutjanus malabaricus',
    habitat:
      'Terumbu karang & perairan lepas pantai Indo-Pasifik, dari Teluk Persia sampai Fiji. Anakannya tumbuh besar di mangrove & padang lamun sebelum pindah ke karang dalam.',
    sizeInfo: 'Umumnya sekitar 50 cm, bisa lebih besar.',
    lifespan: 'Bisa hidup sampai 48 tahun!',
    fact: 'Salah satu ikan karang berumur paling panjang yang pernah tercatat — tumbuhnya lambat, jadi ukuran besar butuh puluhan tahun.',
  },
  {
    id: 'baronang',
    name: 'Baronang',
    tier: 'uncommon',
    spawnWeight: 15,
    minKg: 0.3,
    maxKg: 1.5,
    pointsPerKg: 42,
    color: 0xc9b23c,
    size: 0.6,
    rarityBias: 0.15,
    latin: 'Siganus sp.',
    habitat: 'Terumbu karang, padang lamun, dan muara di seluruh Indo-Pasifik.',
    sizeInfo: 'Umumnya 20-35 cm.',
    lifespan: 'Sekitar 6-10 tahun.',
    fact: 'Duri siripnya mengandung racun ringan — nelayan harus hati-hati saat menanganinya.',
  },
  {
    id: 'kerapu',
    name: 'Kerapu',
    tier: 'uncommon',
    spawnWeight: 13,
    minKg: 1,
    maxKg: 10,
    pointsPerKg: 50,
    color: 0x6b5a3c,
    size: 0.85,
    rarityBias: 0.22,
    latin: 'Epinephelus sp.',
    habitat: 'Gua & celah terumbu karang di perairan tropis Indo-Pasifik.',
    sizeInfo: 'Umumnya 40-70 cm, spesies besar bisa lebih dari 1 m.',
    lifespan: 'Bisa lebih dari 40 tahun.',
    fact: 'Banyak spesies kerapu lahir betina lalu sebagian berubah jadi jantan seiring bertambah usia.',
  },
  {
    id: 'gurame',
    name: 'Gurame',
    tier: 'uncommon',
    spawnWeight: 14,
    minKg: 0.5,
    maxKg: 4,
    pointsPerKg: 40,
    color: 0x8fae7a,
    size: 0.75,
    rarityBias: 0.1,
    freshwater: true,
    latin: 'Osphronemus goramy',
    habitat: 'Sungai & rawa air tawar tenang di Asia Tenggara, juga banyak dibudidayakan di kolam.',
    sizeInfo: 'Umumnya 25-45 cm, bisa tumbuh lebih dari 60 cm.',
    lifespan: 'Bisa lebih dari 20 tahun.',
    fact: 'Salah satu ikan air tawar paling populer di meja makan Indonesia, biasa disajikan goreng atau bakar.',
  },
  {
    id: 'tenggiri',
    name: 'Tenggiri',
    tier: 'rare',
    spawnWeight: 8,
    minKg: 2,
    maxKg: 10,
    pointsPerKg: 65,
    color: 0x8fa8c7,
    size: 1.0,
    rarityBias: 0.3,
    latin: 'Scomberomorus commerson',
    habitat: 'Perairan pesisir & lepas pantai Indo-Pasifik — perenang cepat yang berburu dekat permukaan.',
    sizeInfo: 'Umumnya 60-120 cm, bisa lebih dari 2 m.',
    lifespan: 'Sekitar 10 tahun.',
    fact: 'Dagingnya jadi bahan utama pempek dan kerupuk ikan khas Indonesia.',
  },
  {
    id: 'tuna',
    name: 'Tuna Sirip Kuning',
    tier: 'rare',
    spawnWeight: 6,
    minKg: 5,
    maxKg: 50,
    pointsPerKg: 75,
    color: 0x2b4a6b,
    size: 1.05,
    rarityBias: 0.35,
    latin: 'Thunnus albacares',
    habitat:
      'Lautan tropis & subtropis di seluruh dunia, berenang cepat di perairan terbuka dekat permukaan hingga kedalaman sedang.',
    sizeInfo: 'Bisa tumbuh lebih dari 2 m dan berat lebih dari 150 kg, meski kebanyakan tangkapan jauh lebih kecil.',
    lifespan: 'Sekitar 6-9 tahun.',
    fact: 'Perenang cepat yang harus terus bergerak agar air tetap mengalir melewati insangnya.',
  },
  {
    id: 'cakalang',
    name: 'Cakalang',
    tier: 'rare',
    spawnWeight: 7,
    minKg: 2,
    maxKg: 12,
    pointsPerKg: 60,
    color: 0x3d5a78,
    size: 0.95,
    rarityBias: 0.3,
    latin: 'Katsuwonus pelamis',
    habitat: 'Perairan tropis terbuka di seluruh dunia, hidup bergerombol besar dekat permukaan.',
    sizeInfo: 'Umumnya 40-80 cm.',
    lifespan: 'Sekitar 8-12 tahun.',
    fact: 'Salah satu ikan tangkapan laut terbesar di dunia berdasarkan volume — bahan utama ikan kaleng & katsuobushi Jepang.',
  },
  {
    id: 'marlin',
    name: 'Marlin Biru',
    tier: 'very-rare',
    spawnWeight: 2,
    minKg: 30,
    maxKg: 200,
    pointsPerKg: 85,
    color: 0x1f5c8a,
    size: 1.3,
    rarityBias: 0.5,
    latin: 'Makaira nigricans',
    habitat: 'Laut lepas tropis & subtropis di seluruh dunia, jarang mendekati pantai.',
    sizeInfo: 'Bisa tumbuh lebih dari 4 m — salah satu ikan bertulang tercepat di lautan.',
    lifespan: 'Sekitar 18-27 tahun.',
    fact: 'Bisa berenang meledak hingga lebih dari 80 km/jam — incaran utama pemancing olahraga (sport fishing).',
  },
  {
    id: 'hiu',
    name: 'Hiu Karang Sirip Hitam',
    tier: 'very-rare',
    spawnWeight: 1.5,
    minKg: 10,
    maxKg: 60,
    pointsPerKg: 95,
    color: 0x4a5560,
    size: 1.2,
    rarityBias: 0.55,
    latin: 'Carcharhinus melanopterus',
    habitat: 'Perairan dangkal terumbu karang Indo-Pasifik.',
    sizeInfo: 'Umumnya 1.2-1.6 m.',
    lifespan: 'Sekitar 12-14 tahun.',
    fact: 'Relatif tidak berbahaya bagi manusia — lebih sering menghindar daripada menyerang. Sebaiknya dilepas lagi kalau tertangkap!',
  },
  {
    id: 'layaran',
    name: 'Ikan Layaran',
    tier: 'very-rare',
    spawnWeight: 3,
    minKg: 15,
    maxKg: 60,
    pointsPerKg: 90,
    color: 0x3f6fa0,
    size: 1.25,
    rarityBias: 0.5,
    deepSeaOnly: true,
    latin: 'Istiophorus platypterus',
    habitat: 'Laut lepas tropis & subtropis di seluruh dunia — hanya muncul jauh dari dermaga, di laut dalam.',
    sizeInfo: 'Bisa tumbuh lebih dari 3 m, dengan sirip punggung besar seperti layar kapal.',
    lifespan: 'Sekitar 4-5 tahun.',
    fact: 'Salah satu ikan tercepat di lautan, tercatat bisa berenang lebih dari 100 km/jam dalam ledakan kecepatan singkat.',
  },
  {
    id: 'gurita',
    name: 'Gurita Raksasa',
    tier: 'rare',
    spawnWeight: 4,
    minKg: 3,
    maxKg: 25,
    pointsPerKg: 70,
    color: 0xa8456b,
    size: 0.85,
    rarityBias: 0.35,
    deepSeaOnly: true,
    latin: 'Enteroctopus dofleini',
    habitat: 'Perairan dalam & dingin — di dunia nyata lebih umum di Pasifik Utara, tapi di sini konon bersembunyi di celah laut dalam sekitar dermaga.',
    sizeInfo: 'Rentang lengan bisa mencapai lebih dari 4 m.',
    lifespan: 'Sekitar 3-5 tahun.',
    fact: 'Salah satu invertebrata paling cerdas — tercatat bisa membuka toples dan memecahkan teka-teki sederhana.',
  },
  {
    id: 'golden',
    name: 'Ikan Emas Legendaris',
    tier: 'legendary',
    spawnWeight: 0.4,
    minKg: 0.2,
    maxKg: 0.6,
    pointsPerKg: 600,
    color: 0xf2c14e,
    size: 0.9,
    rarityBias: 0.7,
    legendary: true,
    latin: '??? (belum pernah diklasifikasikan)',
    habitat: 'Tidak ada catatan ilmiah — hanya legenda turun-temurun dari para pemancing di dermaga ini.',
    sizeInfo: 'Ukurannya konon berubah-ubah tergantung siapa yang menceritakannya.',
    lifespan: 'Tidak diketahui.',
    fact: 'Konon hanya muncul sekali dalam seribu lemparan. Kalau kamu berhasil menangkapnya, kamu beruntung sekali!',
  },
  {
    id: 'boot',
    name: 'Sepatu Bot Tua',
    tier: 'junk',
    spawnWeight: 10,
    minKg: 0.4,
    maxKg: 0.9,
    pointsPerKg: 0,
    color: 0x4a4038,
    size: 0.6,
    rarityBias: -0.3,
    junk: true,
    latin: '— bukan makhluk hidup —',
    habitat: 'Dasar dermaga mana pun yang cukup sering dilewati orang ceroboh.',
    sizeInfo: 'Ukuran sepatu bot pada umumnya.',
    lifespan: '—',
    fact: 'Bukan ikan, cuma sampah yang nyangkut di kail. Setidaknya kailnya kepakai.',
  },
  {
    id: 'kaleng',
    name: 'Kaleng Karatan',
    tier: 'junk',
    spawnWeight: 10,
    minKg: 0.05,
    maxKg: 0.3,
    pointsPerKg: 0,
    color: 0x8b8f92,
    size: 0.35,
    rarityBias: -0.3,
    junk: true,
    latin: '— bukan makhluk hidup —',
    habitat: 'Mengendap di dasar dermaga, entah sudah berapa lama.',
    sizeInfo: 'Ukuran kaleng minuman pada umumnya.',
    lifespan: '—',
    fact: 'Bukan ikan, tapi setidaknya masih bisa didaur ulang.',
  },
  {
    id: 'ban',
    name: 'Ban Bekas',
    tier: 'junk',
    spawnWeight: 6,
    minKg: 3,
    maxKg: 8,
    pointsPerKg: 0,
    color: 0x2a2a2a,
    size: 0.9,
    rarityBias: -0.35,
    junk: true,
    latin: '— bukan makhluk hidup —',
    habitat: 'Tenggelam di dermaga ini entah sejak kapan.',
    sizeInfo: 'Ukuran ban kendaraan pada umumnya.',
    lifespan: '—',
    fact: 'Berat dan bikin capek gulung tali pancing, tapi bukan tangkapan yang bisa dibanggakan.',
  },
]

// Picks a random fish. `castPower` (0..1) biases toward rarer fish on
// stronger casts. `rareBonus` and `legendaryBonus` come from equipped store
// items (hooks/nets) and add extra weight to rare-tier and legendary fish
// respectively, on top of the cast-power bias. `zone` (from the day/night
// cycle + player's boat/dock position, or Survival's river/lake proximity —
// see main.js's getFishingZone) can additionally unlock deep-sea-only
// species and give them a further boost, or (Sub-tahap Survival-B) bias
// toward the freshwater-appropriate species (nila/mujair/lele/gurame) when
// fishing a river or lake instead of the sea.
export function rollFish(castPower, rareBonus = 0, legendaryBonus = 0, zone = {}) {
  const { deepSea = false, deepSeaBonus = 0, freshwater = false } = zone
  const pool = FISH_TYPES.filter((f) => !f.deepSeaOnly || deepSea)
  const weighted = pool.map((f) => {
    let bonus = 1 + castPower * f.rarityBias * 4
    if (f.rarityBias > 0) bonus += rareBonus * f.rarityBias * 4
    if (f.legendary) bonus += legendaryBonus * 4
    if (deepSea && f.rarityBias > 0) bonus += deepSeaBonus * f.rarityBias * 4
    // River/lake: freshwater species turn up a lot more; saltwater species
    // (that aren't junk) still possible — you can always haul up an odd
    // stray — but much rarer.
    if (freshwater) bonus *= f.freshwater ? 3.5 : f.junk ? 1 : 0.3
    return { fish: f, w: Math.max(0.001, f.spawnWeight * bonus) }
  })
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const { fish, w } of weighted) {
    if (r < w) return fish
    r -= w
  }
  return pool[0]
}

// Rolls an actual weight (kg) for a caught fish, biased toward the middle
// of its range (average of two rolls) rather than a flat distribution, so
// truly huge specimens stay rare and exciting.
export function rollWeight(fish) {
  const t = (Math.random() + Math.random()) / 2
  const kg = fish.minKg + t * (fish.maxKg - fish.minKg)
  return Math.round(kg * 100) / 100
}

// Points scale with how much the fish actually weighs.
export function pointsForWeight(fish, weightKg) {
  if (fish.junk) return 0
  return Math.max(1, Math.round(weightKg * fish.pointsPerKg))
}

const DIFFICULTY_BY_TIER = {
  junk: 1,
  common: 1,
  uncommon: 2,
  rare: 3,
  'very-rare': 4,
  legendary: 5,
}

// Higher-value fish demand a harder "follow the pattern" reeling
// challenge: more successful taps needed, a faster-moving marker, and a
// narrower target zone to hit it in.
export function catchPatternFor(fish) {
  const diff = DIFFICULTY_BY_TIER[fish.tier] ?? 1
  return {
    beats: 1 + diff,
    beatDuration: Math.max(0.55, 1.5 - diff * 0.18),
    zoneWidth: Math.max(0.14, 0.34 - diff * 0.045),
    maxMisses: Math.max(2, 5 - diff),
  }
}
