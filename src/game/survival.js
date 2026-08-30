import { loadSurvivalRecord, saveSurvivalRecord } from '../survival-storage.js'

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
    this.hunger = START_HUNGER
    this.thirst = START_THIRST
    this.stamina = START_STAMINA
    this._wasNight = false
    this._sleptTonight = false
    this._drinkCooldown = 0

    // Hooks main.js wires up.
    this.onStatChange = null // (snapshot) => void — called on meaningful stat changes
    this.onDayChange = null // (day, missedSleep) => void — fires at dawn
    this.onGameOver = null // ({ reason, day }) => void
    this.onWin = null // ({ day }) => void
  }

  snapshot() {
    return {
      day: this.day,
      totalDays: TOTAL_DAYS,
      hunger: this.hunger,
      thirst: this.thirst,
      stamina: this.stamina,
    }
  }

  start() {
    this.active = true
    this.ended = false
    this.day = 1
    this.hunger = START_HUNGER
    this.thirst = START_THIRST
    this.stamina = START_STAMINA
    this._wasNight = this.dayNight.isNight()
    this._sleptTonight = false
    this._drinkCooldown = 0
    this.dayNight.setCycleSeconds(CYCLE_SECONDS)
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
  }

  _recordIfBest(dayReached) {
    const record = loadSurvivalRecord()
    if (dayReached > (record.bestDay ?? 0)) {
      saveSurvivalRecord({ bestDay: dayReached })
      return true
    }
    return false
  }

  _lose(reason) {
    this._finish()
    const isNewRecord = this._recordIfBest(this.day)
    this.onGameOver?.({ reason, day: this.day, isNewRecord, bestDay: loadSurvivalRecord().bestDay })
  }

  _win() {
    this._finish()
    const isNewRecord = this._recordIfBest(TOTAL_DAYS)
    this.onWin?.({ day: TOTAL_DAYS, isNewRecord, bestDay: loadSurvivalRecord().bestDay })
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

    const isNight = this.dayNight.isNight()
    const isRaining = this.dayNight.isRaining()

    const hungerMult = isNight ? (isRaining ? NIGHT_RAIN_HUNGER_MULT : NIGHT_HUNGER_MULT) : 1
    const thirstMult = !isNight ? DAY_THIRST_MULT : 1
    const staminaDrain = BASE_STAMINA_DRAIN + (isNight && !this._sleptTonight ? AWAKE_AT_NIGHT_EXTRA_STAMINA_DRAIN : 0)

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
    }

    if (this.hunger <= 0 || this.thirst <= 0 || this.stamina <= 0) {
      const reason = this.hunger <= 0 ? 'lapar' : this.thirst <= 0 ? 'haus' : 'stamina'
      this._lose(reason)
      return
    }

    this.onStatChange?.(this.snapshot())
  }
}
