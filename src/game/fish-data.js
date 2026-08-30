// Fish "catalog". Weight = relative chance of appearing (higher = more common).
// depthBonus makes rarer fish more likely on longer/stronger casts.
//
// latin/habitat/sizeInfo/lifespan/fact are real facts (for the real species)
// used by the in-game Fish Dex — sourced from FishBase and Wikipedia. The
// legendary fish and the junk item are fictional/flavor entries instead.
export const FISH_TYPES = [
  {
    id: 'sardine',
    name: 'Sarden',
    points: 10,
    weight: 45,
    color: 0xb9c7d1,
    size: 0.5,
    depthBonus: 0,
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
    points: 20,
    weight: 30,
    color: 0x5c7ea3,
    size: 0.65,
    depthBonus: 0.1,
    latin: 'Rastrelliger kanagurta',
    habitat:
      'Teluk & laguna pesisir berair keruh kaya plankton di seluruh Indo-Pasifik Barat — dari Afrika Timur, Laut Merah, hingga Indonesia, Jepang selatan, dan Australia.',
    sizeInfo: 'Umumnya 25 cm, maksimal tercatat 36-42 cm.',
    lifespan: 'Sekitar 4 tahun.',
    fact: 'Salah satu ikan pelagis kecil terpenting dalam perikanan Asia Tenggara.',
  },
  {
    id: 'snapper',
    name: 'Kakap',
    points: 35,
    weight: 16,
    color: 0xe0654a,
    size: 0.8,
    depthBonus: 0.2,
    latin: 'Lutjanus malabaricus',
    habitat:
      'Terumbu karang & perairan lepas pantai Indo-Pasifik, dari Teluk Persia sampai Fiji. Anakannya tumbuh besar di mangrove & padang lamun sebelum pindah ke karang dalam.',
    sizeInfo: 'Umumnya sekitar 50 cm, bisa lebih besar.',
    lifespan: 'Bisa hidup sampai 48 tahun!',
    fact: 'Salah satu ikan karang berumur paling panjang yang pernah tercatat — tumbuhnya lambat, jadi ukuran besar butuh puluhan tahun.',
  },
  {
    id: 'tuna',
    name: 'Tuna',
    points: 60,
    weight: 7,
    color: 0x2b4a6b,
    size: 1.05,
    depthBonus: 0.35,
    latin: 'Katsuwonus pelamis (Cakalang)',
    habitat: 'Lautan tropis & subtropis di seluruh dunia, hidup bergerombol di perairan terbuka dekat permukaan.',
    sizeInfo: 'Bisa tumbuh sampai 80 cm dan berat 8-10 kg.',
    lifespan: 'Sekitar 8-12 tahun.',
    fact: 'Perenang cepat yang harus terus bergerak agar air tetap mengalir melewati insangnya.',
  },
  {
    id: 'golden',
    name: 'Ikan Emas Legendaris',
    points: 150,
    weight: 2,
    color: 0xf2c14e,
    size: 0.9,
    depthBonus: 0.5,
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
    points: 0,
    weight: 20,
    color: 0x4a4038,
    size: 0.6,
    depthBonus: -0.3,
    junk: true,
    latin: '— bukan makhluk hidup —',
    habitat: 'Dasar dermaga mana pun yang cukup sering dilewati orang ceroboh.',
    sizeInfo: 'Ukuran sepatu bot pada umumnya.',
    lifespan: '—',
    fact: 'Bukan ikan, cuma sampah yang nyangkut di kail. Setidaknya kailnya kepakai.',
  },
]

// Picks a random fish, boosting rare-fish weight based on cast power (0..1).
export function rollFish(castPower) {
  const weighted = FISH_TYPES.map((f) => {
    const bonus = 1 + castPower * f.depthBonus * 4
    return { fish: f, w: Math.max(0.001, f.weight * bonus) }
  })
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const { fish, w } of weighted) {
    if (r < w) return fish
    r -= w
  }
  return FISH_TYPES[0]
}
