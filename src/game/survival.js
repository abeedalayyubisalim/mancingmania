import { recordSurvivalResult } from '../survival-storage.js'

// Sub-tahap Survival-A: the core "stranded on an island for 10 days" loop —
// Hunger/Thirst/Stamina drained by time and weather, fed back up by fishing
// (Hunger) and the freshwater spring (Thirst), with a cave to sleep in every
// night. No monsters/weapons/wave combat yet (that's Sub-tahap Survival-C) —
// this is purely "can you keep yourself alive for 10 in-game days".
//
// Runs on the SAME shared DayNightCycle instance the rest of the game uses
// (for the sun/sky), just temporarily sped way up (see CYCLE_SECONDS below)
// so 10 days fit a reasonable single play session — restored to normal
// pacing whenever a run ends (win, lose, or abandoned).
export const TOTAL_DAYS = 10
const CYCLE_SECONDS = 110 // one full day/night, real seconds, while Survival is active
const NORMAL_CYCLE_SECONDS = 600 // what game/daynight.js otherwise defaults to

const START_HUNGER = 70
const START_THIRST = 70
const START_STAMINA = 100
const START_HP = 100
const START_AMMO = 6
const MAX_AMMO = 10
const AMMO_REGEN_SECONDS = 5 // stray rocks turn up as you wander around

const DEFAULT_RAIN_CHANCE = 0.35 // game/daynight.js's own out-of-the-box default

// Difficulty levels — the two "cuaca" (weather) and "keganasan monster"
// (monster ferocity) levers the player asked for, plus a Hunger/Thirst/
// Stamina drain multiplier so Mudah/Sulit feel meaningfully different even
// before a single monster wave or rain cloud shows up:
//  - drainMult: scales all three base drain rates in tick() below.
//  - rainChance: passed straight to DayNightCycle.setRainChance.
//  - firstWaveNight: which night monster-fish waves start (see
//    game/monsters.js) — Sulit throws you in on night 1, Mudah gives two
//    full days to learn the ropes first.
//  - waveBase/wavePerDay/waveCap: feed waveSizeForDay() below.
//  - damageMult: scales monster contact damage in takeDamage().
export const DIFFICULTIES = {
  easy: {
    label: 'Mudah',
    emoji: '😌',
    desc: 'Cuaca lebih bersahabat, ikan buas datang belakangan dan lebih sedikit.',
    drainMult: 0.8,
    rainChance: 0.2,
    firstWaveNight: 3,
    waveBase: 2,
    wavePerDay: 0.35,
    waveCap: 5,
    damageMult: 0.75,
  },
  normal: {
    label: 'Normal',
    emoji: '⚖️',
    desc: 'Pengalaman survival standar — seimbang antara santai dan menantang.',
    drainMult: 1,
    rainChance: DEFAULT_RAIN_CHANCE,
    firstWaveNight: 2,
    waveBase: 2,
    wavePerDay: 0.5,
    waveCap: 7,
    damageMult: 1,
  },
  hard: {
    label: 'Sulit',
    emoji: '🔥',
    desc: 'Hujan lebih sering, ikan buas datang sejak malam pertama dan lebih ganas.',
    drainMult: 1.25,
    rainChance: 0.55,
    firstWaveNight: 1,
    waveBase: 3,
    wavePerDay: 0.7,
    waveCap: 9,
    damageMult: 1.4,
  },
}
export const DEFAULT_DIFFICULTY = 'normal'

const BASE_HUNGER_DRAIN = 0.55 // per second
const BASE_THIRST_DRAIN = 0.65
const BASE_STAMINA_DRAIN = 0.15

const NIGHT_HUNGER_MULT = 1.6 // cold at night — burns more energy
const NIGHT_RAIN_HUNGER_MULT = 2.2 // cold AND wet is worse
const DAY_THIRST_MULT = 1.5 // hot sun during the day

const AWAKE_AT_NIGHT_EXTRA_STAMINA_DRAIN = 0.4 // per second, on top of the baseline, while it's night and you haven't slept yet
const MISSED_SLEEP_DAWN_PENALTY = 10 // lump stamina hit if dawn arrives and you never made it to the cave

const DRINK_AMOUNT = 40
const DRINK_COOLDOWN = 4 // seconds between drinks at the spring

// How much a caught fish restores Hunger. Junk (boots, etc.) isn't food.
export function foodValueFor(fish) {
  if (!fish || fish.junk) return 0
  return Math.min(40, Math.round(15 + fish.weight * 25))
}

export class SurvivalSession {
  constructor({ dayNight }) {
    this.dayNight = dayNight
    this.active = false
    this.ended = false
    this.day = 1
    this.difficulty = DEFAULT_DIFFICULTY
    this.cfg = DIFFICULTIES[DEFAULT_DIFFICULTY]
    this.hunger = START_HUNGER
    this.thirst = START_THIRST
    this.stamina = START_STAMINA
    this.hp = START_HP
    this.ammo = START_AMMO
    this._wasNight = false
    this._sleptTonight = false
    this._drinkCooldown = 0
    this._ammoRegenTimer = 0

    // Hooks main.js wires up.
    this.onStatChange = null // (snapshot) => void — called on meaningful stat changes
    this.onDayChange = null // (day, missedSleep) => void — fires at dawn
    this.onNightStart = null // (day) => void — fires the moment night falls
    this.onGameOver = null // ({ reason, day }) => void
    this.onWin = null // ({ day }) => void
    this.onEnd = null // () => void — fires on ANY run ending (win, lose, or abandon), for cleanup
  }

  snapshot() {
    return {
      day: this.day,
      totalDays: TOTAL_DAYS,
      difficulty: this.difficulty,
      difficultyLabel: this.cfg.label,
      difficultyEmoji: this.cfg.emoji,
      hunger: this.hunger,
      thirst: this.thirst,
      stamina: this.stamina,
      hp: this.hp,
      maxHp: START_HP,
      ammo: this.ammo,
      maxAmmo: MAX_AMMO,
    }
  }

  // How many monster fish spawn per wave on a given day, at the currently
  // selected difficulty (see DIFFICULTIES above) — called from main.js's
  // startWave() instead of hardcoding the formula there.
  waveSizeForDay(day) {
    return Math.min(Math.round(this.cfg.waveBase + this.cfg.wavePerDay * day), this.cfg.waveCap)
  }

  // Which night monster-fish waves start showing up, at the current
  // difficulty — main.js's onNightStart hook compares against this instead
  // of a fixed constant.
  get firstWaveNight() {
    return this.cfg.firstWaveNight
  }

  start(difficulty = DEFAULT_DIFFICULTY) {
    this.active = true
    this.ended = false
    this.day = 1
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : DEFAULT_DIFFICULTY
    this.cfg = DIFFICULTIES[this.difficulty]
    this.hunger = START_HUNGER
    this.thirst = START_THIRST
    this.stamina = START_STAMINA
    this.hp = START_HP
    this.ammo = START_AMMO
    this._wasNight = this.dayNight.isNight()
    this._sleptTonight = false
    this._drinkCooldown = 0
    this._ammoRegenTimer = 0
    this.dayNight.setCycleSeconds(CYCLE_SECONDS)
    this.dayNight.setRainChance(this.cfg.rainChance)
    this.onStatChange?.(this.snapshot())
  }

  // Manual exit (pause menu "Keluar dari Survival") — not a death, but the
  // day reached still counts toward the best-day record, same as a loss.
  abandon() {
    if (!this.active) return
    this._finish()
  }

  _finish() {
    this.active = false
    this.ended = true
    this.dayNight.setCycleSeconds(NORMAL_CYCLE_SECONDS)
    this.dayNight.setRainChance(DEFAULT_RAIN_CHANCE)
    this.onEnd?.()
  }

  _lose(reason) {
    this._finish()
    const { isNewRecord, record } = recordSurvivalResult(this.difficulty, this.day, false)
    this.onGameOver?.({
      reason,
      day: this.day,
      isNewRecord,
      bestDay: record.bestDay[this.difficulty],
      difficulty: this.difficulty,
      difficultyLabel: this.cfg.label,
    })
  }

  _win() {
    this._finish()
    const { isNewRecord, justWon, record } = recordSurvivalResult(this.difficulty, TOTAL_DAYS, true)
    this.onWin?.({
      day: TOTAL_DAYS,
      isNewRecord,
      justWon,
      bestDay: record.bestDay[this.difficulty],
      difficulty: this.difficulty,
      difficultyLabel: this.cfg.label,
    })
  }

  // Only works at night — fast-forwards to the next dawn (see
  // DayNightCycle.skipToNextDawn) and fully restores Stamina as the reward
  // for making it to the cave instead of being caught out.
  sleep() {
    if (!this.active || !this.dayNight.isNight()) return false
    this._sleptTonight = true
    this.stamina = 100
    this.dayNight.skipToNextDawn()
    this.onStatChange?.(this.snapshot())
    return true
  }

  // Only works at the spring, subject to a short cooldown so it's "walk up
  // and drink" rather than a single held click refilling Thirst instantly.
  drink() {
    if (!this.active || this._drinkCooldown > 0) return false
    this.thirst = Math.min(100, this.thirst + DRINK_AMOUNT)
    this._drinkCooldown = DRINK_COOLDOWN
    this.onStatChange?.(this.snapshot())
    return true
  }

  // Sub-tahap Survival-C: contact damage from a monster fish (see
  // game/monsters.js's onPlayerHit). Ends the run immediately on death
  // instead of waiting for the next tick() pass, so it reads as responsive.
  takeDamage(amount) {
    if (!this.active) return
    this.hp = Math.max(0, this.hp - amount * this.cfg.damageMult)
    this.onStatChange?.(this.snapshot())
    if (this.hp <= 0) this._lose('diserang')
  }

  // Spends one rock if any are on hand — returns false (does nothing) if
  // out of ammo, so the caller knows the throw didn't happen.
  useAmmo() {
    if (!this.active || this.ammo <= 0) return false
    this.ammo -= 1
    this.onStatChange?.(this.snapshot())
    return true
  }

  // Called from the Fishing onCatch callback while a run is active. Returns
  // how much Hunger it restored (0 for junk) so the caller can show it.
  feed(fish) {
    if (!this.active) return 0
    const amount = foodValueFor(fish)
    this.hunger = Math.min(100, this.hunger + amount)
    this.onStatChange?.(this.snapshot())
    return amount
  }

  tick(dt) {
    if (!this.active) return
    if (this._drinkCooldown > 0) this._drinkCooldown = Math.max(0, this._drinkCooldown - dt)

    if (this.ammo < MAX_AMMO) {
      this._ammoRegenTimer += dt
      if (this._ammoRegenTimer >= AMMO_REGEN_SECONDS) {
        this._ammoRegenTimer = 0
        this.ammo = Math.min(MAX_AMMO, this.ammo + 1)
        this.onStatChange?.(this.snapshot())
      }
    }

    const isNight = this.dayNight.isNight()
    const isRaining = this.dayNight.isRaining()

    const hungerMult = (isNight ? (isRaining ? NIGHT_RAIN_HUNGER_MULT : NIGHT_HUNGER_MULT) : 1) * this.cfg.drainMult
    const thirstMult = (!isNight ? DAY_THIRST_MULT : 1) * this.cfg.drainMult
    const staminaDrain =
      (BASE_STAMINA_DRAIN + (isNight && !this._sleptTonight ? AWAKE_AT_NIGHT_EXTRA_STAMINA_DRAIN : 0)) * this.cfg.drainMult

    this.hunger = Math.max(0, this.hunger - BASE_HUNGER_DRAIN * hungerMult * dt)
    this.thirst = Math.max(0, this.thirst - BASE_THIRST_DRAIN * thirstMult * dt)
    this.stamina = Math.max(0, this.stamina - staminaDrain * dt)

    // Dawn just broke — settle the night that just ended (missed-sleep
    // penalty if applicable), advance the day counter, and check for a win.
    if (!isNight && this._wasNight) {
      this._wasNight = false
      const missedSleep = !this._sleptTonight
      if (missedSleep) this.stamina = Math.max(0, this.stamina - MISSED_SLEEP_DAWN_PENALTY)
      this._sleptTonight = false
      this.day += 1
      this.onDayChange?.(this.day, missedSleep)
      if (this.day > TOTAL_DAYS) {
        this._win()
        return
      }
    } else if (isNight && !this._wasNight) {
      this._wasNight = true
      this.onNightStart?.(this.day)
    }

    if (this.hunger <= 0 || this.thirst <= 0 || this.stamina <= 0 || this.hp <= 0) {
      const reason = this.hunger <= 0 ? 'lapar' : this.thirst <= 0 ? 'haus' : this.stamina <= 0 ? 'stamina' : 'diserang'
      this._lose(reason)
      return
    }

    this.onStatChange?.(this.snapshot())
  }
}
