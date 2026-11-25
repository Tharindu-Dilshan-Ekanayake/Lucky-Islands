import {
  AD_REWARDS,
  CAPES,
  CASES,
  DAILY_REWARDS,
  DAY_MS,
  DUPLICATE_REFUND,
  GEM_PRODUCTS,
  REWARDS,
  rollCase,
  SWORD_SKINS,
} from './balance.js'

/**
 * The saved profile and the pure rules that change it: round rewards, cases, equipping,
 * daily rewards, Gems and ad grants. No I/O here - the server and the offline stand-in
 * both call these and persist the result their own way.
 */

export const PROFILE_VERSION = 1
export const START_CASH = 300

export function createProfile(id, name) {
  return {
    version: PROFILE_VERSION,
    id,
    name,
    cash: START_CASH,
    wins: 0,
    kills: 0,
    games: 0,
    capes: ['none'],
    swords: ['classic'],
    cape: 'none',
    sword: 'classic',
    passes: {},
    daily: { lastDay: -1, streak: 0 },
    adAt: {},
    tutorial: false,
    welcomeGift: false,
    stats: { playtime: 0, bestKills: 0, cashEarned: 0, casesOpened: 0 },
    createdAt: Date.now(),
    lastSeen: Date.now(),
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** Any stored (or missing, or old) profile made safe to use. */
export function normalizeProfile(raw, id, name) {
  const base = createProfile(id, name)
  if (!raw || typeof raw !== 'object' || raw.version !== PROFILE_VERSION) return base
  const p = { ...base, ...raw, id, name: name || raw.name || base.name }
  for (const k of ['cash', 'wins', 'kills', 'games']) p[k] = isNum(p[k]) ? Math.max(0, Math.floor(p[k])) : 0
  p.capes = [...new Set(['none', ...(Array.isArray(raw.capes) ? raw.capes.filter((c) => CAPES[c]) : [])])]
  p.swords = [...new Set(['classic', ...(Array.isArray(raw.swords) ? raw.swords.filter((s) => SWORD_SKINS[s]) : [])])]
  if (!p.capes.includes(p.cape)) p.cape = 'none'
  if (!p.swords.includes(p.sword)) p.sword = 'classic'
  p.passes = raw.passes && typeof raw.passes === 'object' ? { ...raw.passes } : {}
  p.daily = { lastDay: isNum(raw.daily?.lastDay) ? raw.daily.lastDay : -1, streak: isNum(raw.daily?.streak) ? raw.daily.streak : 0 }
  p.adAt = raw.adAt && typeof raw.adAt === 'object' ? { ...raw.adAt } : {}
  p.stats = { ...base.stats, ...(raw.stats || {}) }
  for (const k of Object.keys(base.stats)) if (!isNum(p.stats[k])) p.stats[k] = 0
  return p
}

/** Per-connection state the UI also reads. */
export function createSession(now) {
  return { startedAt: now }
}

export const dayNumber = (now) => Math.floor(now / DAY_MS)

/** Cash for a finished round, and the profile updated with it. */
export function applyRoundResult(profile, { kills = 0, placement = 99, win = false }) {
  let cash = REWARDS.play + kills * REWARDS.kill
  if (win) cash += REWARDS.win
  cash += REWARDS.placement[placement - 1] || 0
  if (profile.passes.vip) cash *= 2
  profile.cash += cash
  profile.kills += kills
  profile.games += 1
  if (win) profile.wins += 1
  profile.stats.bestKills = Math.max(profile.stats.bestKills, kills)
  profile.stats.cashEarned += cash
  return { cash, kills, placement, win }
}

/**
 * Opens case `caseId`: takes the price, draws a cosmetic. A duplicate gives part of the
 * price back. Returns `{ ok, error?, id, kind, duplicate, refund }`.
 */
export function openCase(profile, caseId, rng = Math.random, free = false) {
  const c = CASES[caseId]
  if (!c) return { ok: false, error: 'Unknown case' }
  if (!free && profile.cash < c.price) return { ok: false, error: 'Not enough cash' }
  if (!free) profile.cash -= c.price
  const id = rollCase(caseId, rng)
  const list = c.kind === 'cape' ? profile.capes : profile.swords
  const duplicate = list.includes(id)
  let refund = 0
  if (duplicate) {
    refund = Math.round(c.price * DUPLICATE_REFUND)
    profile.cash += refund
  } else {
    list.push(id)
  }
  profile.stats.casesOpened += 1
  return { ok: true, caseId, id, kind: c.kind, duplicate, refund }
}

export function equip(profile, kind, id) {
  if (kind === 'cape' && profile.capes.includes(id)) {
    profile.cape = id
    return true
  }
  if (kind === 'sword' && profile.swords.includes(id)) {
    profile.sword = id
    return true
  }
  return false
}

/** `{ day, ready, streak, reward }` for today's daily reward. */
export function dailyStatus(profile, now) {
  const today = dayNumber(now)
  const ready = profile.daily.lastDay !== today
  const continues = profile.daily.lastDay === today - 1
  const streak = ready ? (continues ? profile.daily.streak + 1 : 1) : profile.daily.streak
  const reward = DAILY_REWARDS[Math.min(streak, DAILY_REWARDS.length) - 1] || DAILY_REWARDS[0]
  return { ready, streak, reward }
}

export function claimDaily(profile, now) {
  const status = dailyStatus(profile, now)
  if (!status.ready) return { ok: false }
  profile.daily = { lastDay: dayNumber(now), streak: status.streak }
  profile.cash += status.reward
  return { ok: true, cash: status.reward, streak: status.streak }
}

/** Applies a Gems product's grant. Returns a label for the toast. */
export function applyGemGrant(profile, sku) {
  const product = GEM_PRODUCTS[sku]
  if (!product) return null
  const g = product.grant
  if (g.cash) profile.cash += g.cash
  if (g.pass) profile.passes[g.pass] = true
  if (g.cape && !profile.capes.includes(g.cape)) profile.capes.push(g.cape)
  if (g.sword && !profile.swords.includes(g.sword)) profile.swords.push(g.sword)
  return product.name
}

export function applyAdReward(profile, placement, now) {
  const ad = AD_REWARDS[placement]
  if (!ad) return null
  if (now - (profile.adAt[placement] || 0) < ad.cooldownMs) return null
  profile.adAt[placement] = now
  if (ad.grant.cash) profile.cash += ad.grant.cash
  return ad.label
}

/** Nothing accrues while away in this game. Kept for the server's join flow. */
export function applyOfflineProgress() {
  return null
}
