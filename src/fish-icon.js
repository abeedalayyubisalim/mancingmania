// Small inline-SVG fish icon, colored per species — used in the gallery so
// we don't depend on any external image (keeps the game fully self-contained
// and safe to host as a static site).
export function fishIconSVG(fish, sizePx = 56) {
  const hex = '#' + fish.color.toString(16).padStart(6, '0')
  if (fish.junk) {
    return `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 40 L14 20 L38 20 L38 28 L50 28 Q54 28 54 34 L54 44 Q54 48 50 48 L18 48 Q14 48 14 44 Z" fill="${hex}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <rect x="14" y="20" width="24" height="6" fill="rgba(255,255,255,.15)"/>
    </svg>`
  }
  if (fish.id === 'gurita') {
    const tentacles = [-18, -11, -4, 4, 11, 18]
      .map((dx, i) => {
        const x = 32 + dx
        const sway = i % 2 === 0 ? 6 : -6
        return `<path d="M${x} 34 Q${x + sway} 46 ${x} 58" fill="none" stroke="${hex}" stroke-width="5" stroke-linecap="round"/>`
      })
      .join('')
    return `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 64 64" aria-hidden="true">
      ${tentacles}
      <ellipse cx="32" cy="26" rx="20" ry="17" fill="${hex}"/>
      <circle cx="24" cy="22" r="3" fill="rgba(0,0,0,.6)"/>
      <circle cx="40" cy="22" r="3" fill="rgba(0,0,0,.6)"/>
      <circle cx="25" cy="21" r="1" fill="#fff"/>
      <circle cx="41" cy="21" r="1" fill="#fff"/>
    </svg>`
  }
  return `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 64 64" aria-hidden="true">
    <polygon points="6,32 18,24 18,40" fill="${hex}" opacity="0.9"/>
    <ellipse cx="38" cy="32" rx="22" ry="14" fill="${hex}"/>
    <circle cx="52" cy="28" r="2.4" fill="rgba(0,0,0,.55)"/>
    <path d="M22 32 Q38 24 54 30" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>
  </svg>`
}
