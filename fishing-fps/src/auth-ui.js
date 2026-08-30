import { signIn, signUp, isSupabaseConfigured } from './supabase-client.js'

// Renders the login/register gate into `root` and resolves once the player
// is ready to start, with either a real Supabase session or a guest name.
export function showAuthGate(root) {
  return new Promise((resolve) => {
    root.innerHTML = `
      <div id="auth-gate">
        <div id="auth-card">
          <h1>🎣 Fishing FPS</h1>
          <p class="auth-sub">Mancing gaya orang pertama. Login untuk simpan skor ke papan peringkat.</p>
          ${!isSupabaseConfigured ? '<p class="auth-warn">Supabase belum dikonfigurasi (src/supabase-client.js) — kamu bisa main sebagai Tamu, skor tidak akan tersimpan online.</p>' : ''}
          <div id="auth-tabs">
            <button class="auth-tab active" data-tab="login">Masuk</button>
            <button class="auth-tab" data-tab="register">Daftar</button>
          </div>
          <form id="auth-form">
            <input id="auth-username" type="text" placeholder="Username" autocomplete="username" required minlength="3" />
            <input id="auth-password" type="password" placeholder="Password" autocomplete="current-password" required minlength="6" />
            <button id="auth-submit" type="submit">Masuk & Mulai Mancing</button>
          </form>
          <p id="auth-error" class="hidden"></p>
          <button id="auth-guest">Main sebagai Tamu</button>
        </div>
      </div>
    `

    let mode = 'login'
    const form = root.querySelector('#auth-form')
    const submitBtn = root.querySelector('#auth-submit')
    const errorEl = root.querySelector('#auth-error')
    const tabs = root.querySelectorAll('.auth-tab')

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.tab
        tabs.forEach((t) => t.classList.toggle('active', t === tab))
        submitBtn.textContent = mode === 'login' ? 'Masuk & Mulai Mancing' : 'Daftar & Mulai Mancing'
        errorEl.classList.add('hidden')
      })
    })

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      errorEl.classList.add('hidden')
      const username = root.querySelector('#auth-username').value.trim()
      const password = root.querySelector('#auth-password').value

      if (!isSupabaseConfigured) {
        errorEl.textContent = 'Supabase belum dikonfigurasi — pakai tombol "Main sebagai Tamu".'
        errorEl.classList.remove('hidden')
        return
      }

      submitBtn.disabled = true
      submitBtn.textContent = 'Memproses...'
      try {
        const data = mode === 'login' ? await signIn(username, password) : await signUp(username, password)
        resolve({ session: data.session, username, guest: false })
      } catch (err) {
        errorEl.textContent = translateError(err.message)
        errorEl.classList.remove('hidden')
        submitBtn.disabled = false
        submitBtn.textContent = mode === 'login' ? 'Masuk & Mulai Mancing' : 'Daftar & Mulai Mancing'
      }
    })

    root.querySelector('#auth-guest').addEventListener('click', () => {
      const name = `Tamu${Math.floor(Math.random() * 9000 + 1000)}`
      resolve({ session: null, username: name, guest: true })
    })
  })
}

function translateError(msg) {
  if (/already registered/i.test(msg)) return 'Username sudah dipakai, coba login.'
  if (/invalid login/i.test(msg)) return 'Username atau password salah.'
  if (/password/i.test(msg) && /6/i.test(msg)) return 'Password minimal 6 karakter.'
  return msg
}
