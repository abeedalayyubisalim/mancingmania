# 🎣 Fishing FPS

Game memancing 3D orang-pertama berbasis web, dibuat dengan [Three.js](https://threejs.org/) + [Vite](https://vitejs.dev/), dengan login user & papan skor online lewat [Supabase](https://supabase.com/).

## Fitur

- Berjalan first-person (WASD + mouse look) di atas dermaga low-poly di tengah laut
- Mekanik memancing: isi tenaga lemparan → lempar kail → tunggu → hook saat ikan menggigit → gulung (reel) sampai dapat
- 6 jenis "tangkapan" dengan tingkat kelangkaan & poin berbeda (termasuk sepatu bot bekas 😄)
- Login/daftar dengan username + password (Supabase Auth), atau main sebagai Tamu tanpa simpan skor
- Papan skor (leaderboard) online, top 10 pemain
- Siap deploy gratis ke GitHub Pages (termasuk GitHub Actions workflow)

## 1. Jalankan di lokal

```bash
npm install
npm run dev
```

Buka URL yang muncul di terminal (biasanya `http://localhost:5173`).

## 2. Setup Supabase (untuk simpan skor online)

Tanpa langkah ini, game tetap bisa dimainkan lewat tombol **Main sebagai Tamu**, tapi skor tidak tersimpan.

1. Buat project gratis di [supabase.com](https://supabase.com/).
2. Buka **Project Settings → API**, salin **Project URL** dan **anon public key**.
3. Buka `src/supabase-client.js`, isi:
   ```js
   export const SUPABASE_URL = 'https://xxxxx.supabase.co'
   export const SUPABASE_ANON_KEY = 'eyJ...'
   ```
4. Buka **SQL Editor** di dashboard Supabase, jalankan isi file `supabase_schema.sql` (bikin tabel `leaderboard` + aturan keamanan/RLS).
5. (Opsional) Di **Authentication → Providers → Email**, matikan "Confirm email" supaya user baru bisa langsung login tanpa verifikasi email (karena game ini pakai email palsu dari username).

## 3. Deploy ke GitHub Pages

1. Push folder ini ke repo GitHub baru.
2. Di repo, buka **Settings → Pages**, pilih source **GitHub Actions**.
3. Push ke branch `main` — workflow di `.github/workflows/deploy.yml` otomatis build & deploy.
4. Situs akan tersedia di `https://<username>.github.io/<nama-repo>/`.

Build manual (kalau mau host sendiri): `npm run build`, lalu upload isi folder `dist/`.

## Struktur project

```
src/
  main.js            # bootstrap game
  auth-ui.js          # layar login/daftar
  hud.js               # HUD (skor, status, leaderboard)
  supabase-client.js  # koneksi & fungsi Supabase
  game/
    scene.js          # dermaga, pulau, pencahayaan
    water.js           # air laut low-poly beranimasi
    player.js          # kontrol first-person + joran di tangan
    fishing.js         # state machine memancing
    fish-data.js        # daftar jenis ikan & rarity
    fish-mesh.js         # model 3D ikan sederhana
supabase_schema.sql    # skema tabel leaderboard
```

## Cara main

- **WASD** — jalan di dermaga
- **Mouse** — lihat sekitar (klik dulu untuk mengunci kursor)
- **Klik kiri tahan lalu lepas** — isi tenaga lemparan, lalu lempar kail
- Tunggu sampai ada tanda ikan menggigit, lalu **klik cepat** untuk mengait
- **Tahan klik kiri** untuk menggulung sampai ikan tertangkap (lepas sebentar-sebentar akan membuat ikan menarik balik)

Selamat memancing! 🐟
