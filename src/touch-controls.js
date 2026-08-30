// On-screen touch controls for phones/tablets: a virtual joystick (move),
// a drag area to look around, a big fishing action button, and a pause
// button (there's no Escape key on a touchscreen).
export class TouchControls {
  constructor(root, { onMove, onLook, onActionStart, onActionEnd, onPause, onJump }) {
    this.onMove = onMove
    this.onLook = onLook
    this.onActionStart = onActionStart
    this.onActionEnd = onActionEnd
    this.onPause = onPause
    this.onJump = onJump

    const wrap = document.createElement('div')
    wrap.id = 'touch-controls'
    wrap.innerHTML = `
      <div id="touch-lookpad"></div>
      <div id="touch-joystick"><div id="touch-joystick-knob"></div></div>
      <button id="touch-pause-btn" aria-label="Menu">☰</button>
      <button id="touch-jump-btn" aria-label="Lompat">⤴️</button>
      <button id="touch-action-btn" aria-label="Pancing">🎣</button>
    `
    root.appendChild(wrap)

    this.joystickBase = wrap.querySelector('#touch-joystick')
    this.joystickKnob = wrap.querySelector('#touch-joystick-knob')
    this.lookpad = wrap.querySelector('#touch-lookpad')
    this.actionBtn = wrap.querySelector('#touch-action-btn')
    this.pauseBtn = wrap.querySelector('#touch-pause-btn')
    this.jumpBtn = wrap.querySelector('#touch-jump-btn')

    this._joystickId = null
    this._lookId = null
    this._lookLast = { x: 0, y: 0 }

    this._wireJoystick()
    this._wireLook()
    this._wireAction()

    this.pauseBtn.addEventListener('click', () => this.onPause?.())
    this.jumpBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault()
        this.onJump?.()
      },
      { passive: false }
    )
  }

  _wireJoystick() {
    const radius = 45

    const start = (e) => {
      const t = e.changedTouches[0]
      this._joystickId = t.identifier
      update(t)
      e.preventDefault()
    }
    const update = (t) => {
      const rect = this.joystickBase.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = t.clientX - cx
      let dy = t.clientY - cy
      const dist = Math.min(radius, Math.hypot(dx, dy))
      const angle = Math.atan2(dy, dx)
      dx = Math.cos(angle) * dist
      dy = Math.sin(angle) * dist
      this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`
      this.onMove?.(dx / radius, -dy / radius)
    }
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joystickId) {
          update(t)
          e.preventDefault()
        }
      }
    }
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joystickId) {
          this._joystickId = null
          this.joystickKnob.style.transform = 'translate(0px, 0px)'
          this.onMove?.(0, 0)
        }
      }
    }

    this.joystickBase.addEventListener('touchstart', start, { passive: false })
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
  }

  _wireLook() {
    const start = (e) => {
      const t = e.changedTouches[0]
      this._lookId = t.identifier
      this._lookLast = { x: t.clientX, y: t.clientY }
      e.preventDefault()
    }
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) {
          const dx = t.clientX - this._lookLast.x
          const dy = t.clientY - this._lookLast.y
          this._lookLast = { x: t.clientX, y: t.clientY }
          this.onLook?.(dx, dy)
          e.preventDefault()
        }
      }
    }
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) this._lookId = null
      }
    }

    this.lookpad.addEventListener('touchstart', start, { passive: false })
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
  }

  _wireAction() {
    const start = (e) => {
      e.preventDefault()
      this.onActionStart?.()
    }
    const end = (e) => {
      e.preventDefault()
      this.onActionEnd?.()
    }
    this.actionBtn.addEventListener('touchstart', start, { passive: false })
    this.actionBtn.addEventListener('touchend', end, { passive: false })
    this.actionBtn.addEventListener('touchcancel', end, { passive: false })
  }

  setVisible(visible) {
    document.querySelector('#touch-controls')?.classList.toggle('hidden', !visible)
  }
}
