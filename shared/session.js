import { CASES } from './balance.js'
import {
  applyAdReward,
  applyGemGrant,
  applyRoundResult,
  claimDaily,
  createSession,
  equip,
  openCase,
} from './logic.js'

/**
 * One player's profile for the length of a connection: the lobby actions that change
 * their save (cases, equipping, daily reward) and the grants (round rewards, Gems,
 * ads). Round play itself lives in host.js; it calls `awardRound` when your round ends.
 *
 * Runs in the Colyseus room and in the offline stand-in alike.
 */
export class PlayerSession {
  /**
   * @param {object} profile the saved profile, changed in place
   * @param {{ now: number, emit: (type, payload) => void, onLook?: (look) => void, rand?: () => number }} o
   */
  constructor(profile, { now, emit, onLook = () => {}, rand = Math.random }) {
    this.profile = profile
    this.session = createSession(now)
    this.emit = emit
    this.onLook = onLook
    this.rand = rand
    this.dirty = false
  }

  sendProfile() {
    this.dirty = false
    this.emit('profile', { profile: this.profile, session: this.session })
  }

  look() {
    return { cape: this.profile.cape, sword: this.profile.sword }
  }

  /** Lobby actions from the client. Unknown types are ignored. */
  handle(type, payload = {}, now = Date.now()) {
    const p = this.profile
    switch (type) {
      case 'openCase': {
        const result = openCase(p, String(payload.caseId), this.rand)
        if (!result.ok) {
          this.emit('toast', { text: result.error, kind: 'error' })
          return
        }
        this.emit('caseResult', result)
        this.sendProfile()
        return
      }
      case 'equip': {
        if (equip(p, payload.kind, payload.id)) {
          this.onLook(this.look())
          this.sendProfile()
        }
        return
      }
      case 'claimDaily': {
        const result = claimDaily(p, now)
        if (result.ok) {
          this.emit('reward', { label: `Day ${result.streak} reward: +${result.cash} cash` })
          this.sendProfile()
        }
        return
      }
      case 'welcomeGift': {
        if (p.welcomeGift) return
        p.welcomeGift = true
        const result = openCase(p, 'cape', this.rand, true)
        this.emit('caseResult', { ...result, gift: true })
        this.sendProfile()
        return
      }
      case 'tutorialDone':
        if (!p.tutorial) {
          p.tutorial = true
          this.sendProfile()
        }
        return
      default:
    }
  }

  awardRound(result) {
    const r = applyRoundResult(this.profile, result)
    this.emit('roundReward', { ...r, fighters: result.fighters, mode: result.mode })
    this.sendProfile()
    return r
  }

  grantAdReward(placement, now) {
    const label = applyAdReward(this.profile, placement, now)
    if (!label) return
    this.emit('reward', { label })
    this.sendProfile()
  }

  grantGemProduct(sku) {
    const label = applyGemGrant(this.profile, sku)
    if (!label) return { ok: false, error: `Unknown product ${sku}` }
    this.emit('reward', { label })
    this.onLook(this.look())
    this.sendProfile()
    return { ok: true }
  }

  /** Playtime for the boards. */
  tick(dt) {
    this.profile.stats.playtime += dt
  }
}

export { CASES }
