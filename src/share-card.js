// Builds a shareable "catch card" image (canvas, drawn from scratch — no
// external assets needed) and offers it via the Web Share API, which opens
// the device's native share sheet (WhatsApp included, on phones that
// support sharing files). Where that's not available, it downloads the PNG
// and opens a WhatsApp text-share link as a fallback so the player can
// attach the image manually.
const W = 720
const H = 900

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawFishShape(ctx, colorHex, cx, cy, scale) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.fillStyle = colorHex
  ctx.beginPath()
  ctx.moveTo(-70, 0)
  ctx.lineTo(-32, -30)
  ctx.lineTo(-32, 30)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(30, 0, 72, 44, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.5)'
  ctx.beginPath()
  ctx.arc(80, -10, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.35)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-4, -20)
  ctx.quadraticCurveTo(40, -34, 78, -12)
  ctx.stroke()
  ctx.restore()
}

function drawJunkShape(ctx, colorHex, cx, cy) {
  ctx.fillStyle = colorHex
  roundRect(ctx, cx - 95, cy - 50, 190, 100, 22)
  ctx.fill()
}

function buildCanvas(fish, username) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#0e3a5c')
  grad.addColorStop(1, '#081c30')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const pad = 36
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 28)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffe9a8'
  ctx.font = 'bold 34px sans-serif'
  ctx.fillText('🎣 Fishing FPS', W / 2, 108)

  const colorHex = '#' + fish.color.toString(16).padStart(6, '0')
  if (fish.junk) drawJunkShape(ctx, colorHex, W / 2, 300)
  else drawFishShape(ctx, colorHex, W / 2, 300, 1.6)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(fish.name, W / 2, 470)

  if (!fish.junk) {
    ctx.font = '28px sans-serif'
    ctx.fillStyle = '#bfe3ff'
    ctx.fillText(`Berat: ${fish.weight.toFixed(2)} kg`, W / 2, 515)

    ctx.font = 'bold 32px sans-serif'
    ctx.fillStyle = '#7CFC9A'
    ctx.fillText(`+${fish.points} poin`, W / 2, 562)
  } else {
    ctx.font = '26px sans-serif'
    ctx.fillStyle = '#bfe3ff'
    ctx.fillText('Cuma sampah nyangkut di kail 😅', W / 2, 525)
  }

  ctx.font = '24px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.65)'
  ctx.fillText(`Ditangkap oleh ${username}`, W / 2, H - 92)
  ctx.fillText(new Date().toLocaleDateString('id-ID'), W / 2, H - 58)

  return canvas
}

export async function shareCatch(fish, username) {
  const canvas = buildCanvas(fish, username || 'Pemancing')
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return

  const text = fish.junk
    ? `Dapat "${fish.name}" pas mancing di Fishing FPS 😅`
    : `Baru nangkap ${fish.name} (${fish.weight.toFixed(2)} kg, +${fish.points} poin) di Fishing FPS! 🎣`

  const file = new File([blob], `tangkapan-${fish.id}.png`, { type: 'image/png' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: 'Fishing FPS' })
      return
    } catch {
      // Cancelled or failed — fall through to the download+link fallback.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tangkapan-${fish.id}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}
