import { useEffect, useMemo, useRef, useState } from 'react'

import { AD_REWARDS, CAPES, casePool, CASES, DAILY_REWARDS, GEM_PRODUCTS, LEVEL_CASE_EVERY, levelCash, levelXp, QUESTS, RARITIES, RARITY_ORDER, SWORD_SKINS } from '@shared/balance'
import { dailyStatus } from '@shared/logic'
import { mulberry32 } from '@shared/rng'

import { isMuted, setMuted, sfx } from '../audio/sfx'
import { buyGems, isRewardedAvailable, useGemsBalance, watchRewardedAd } from '../bloxity/services'
import { capePreview } from '../game/art/capes'
import { itemIcon } from '../game/art/items'
import { runtime } from '../game/runtime'
import { actions } from '../net/actions'
import { switchLobby } from '../net/connection'
import { useGame } from '../store/game'
import { QUALITY_LEVELS, useQuality } from '../store/quality'
import { formatCash, u } from './format'
import { Button, Fancy } from './kit'

/**
 * The lobby's panels (cases, backpack, shop, daily reward, leaderboards, settings) and
 * the case-opening reel. Their own chunk: loaded after the game is on screen.
 */
export default function Panels() {
  const panel = useGame((s) => s.panel)
  const caseOpen = useGame((s) => s.caseOpen)
  return (
    <>
      {panel && !caseOpen && <PanelBody panel={panel} />}
      {caseOpen && <CaseOpening result={caseOpen} />}
    </>
  )
}

function PanelBody({ panel }) {
  const close = useGame((s) => s.closePanel)
  const titles = { bots: 'PLAY WITH BOTS', cases: 'CASES', backpack: 'BACKPACK', shop: 'SHOP', daily: 'DAILY REWARD', quests: 'LEVEL & QUESTS', leaderboards: 'TOP PLAYERS', settings: 'SETTINGS' }
  const Body = { bots: BotsPanel, cases: CasesPanel, backpack: BackpackPanel, shop: ShopPanel, daily: DailyPanel, quests: QuestsPanel, leaderboards: LeaderboardsPanel, settings: SettingsPanel }[panel]
  if (!Body) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="mc-panel pop-in relative flex flex-col text-white" style={{ width: `min(94vw, ${u(820)})`, maxHeight: '88vh', padding: u(18), gap: u(12) }}>
        <div className="flex items-center justify-between">
          <Fancy size={32} from="#ffffff" to="#ffd23b">
            {titles[panel]}
          </Fancy>
          <Button color="#d8443a" style={{ width: u(46), height: u(46), fontSize: u(24) }} onClick={close}>
            ✕
          </Button>
        </div>
        <div className="overflow-y-auto" style={{ paddingRight: u(4) }}>
          <Body />
        </div>
      </div>
    </div>
  )
}

const rarityColor = (r) => RARITIES[r]?.color || '#fff'

function CosmeticTile({ kind, id, rarity, chance, owned, equipped, onClick }) {
  const isCape = kind === 'cape'
  const def = isCape ? CAPES[id] : SWORD_SKINS[id]
  return (
    <button
      type="button"
      className="slot flex flex-col items-center"
      style={{ padding: u(8), gap: u(4), borderColor: equipped ? '#fff' : rarityColor(rarity), opacity: owned === false ? 0.55 : 1 }}
      onClick={onClick}
    >
      <img src={isCape ? capePreview(id) : itemIcon('diamond_sword', id)} alt="" className="pixelated" style={{ height: u(64), width: isCape ? u(40) : u(64) }} draggable={false} />
      <span className="txt-o text-center" style={{ fontSize: u(14), lineHeight: 1.1 }}>
        {def?.name}
      </span>
      <span className="txt-o" style={{ fontSize: u(12), color: rarityColor(rarity) }}>
        {chance !== undefined ? `${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}%` : RARITIES[rarity]?.name}
        {equipped ? ' · ON' : ''}
      </span>
    </button>
  )
}

function CasesPanel() {
  const data = useGame((s) => s.panelData)
  const cash = useGame((s) => s.profile.cash)
  const [caseId, setCaseId] = useState(data?.caseId && CASES[data.caseId] ? data.caseId : 'cape')
  const c = CASES[caseId]
  const pool = useMemo(() => casePool(caseId), [caseId])
  const afford = cash >= c.price
  return (
    <div className="flex flex-col" style={{ gap: u(12) }}>
      <div className="flex" style={{ gap: u(10) }}>
        {Object.entries(CASES).map(([id, cs]) => (
          <Button key={id} color={id === caseId ? cs.color : '#4b5563'} style={{ padding: `${u(8)} ${u(16)}`, fontSize: u(20) }} onClick={() => setCaseId(id)}>
            {cs.name.toUpperCase()}
          </Button>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(110)}, 1fr))`, gap: u(8) }}>
        {pool.map((e) => (
          <CosmeticTile key={e.id} kind={c.kind} id={e.id} rarity={e.rarity} chance={e.chance} />
        ))}
      </div>
      <div className="flex items-center justify-between" style={{ gap: u(10) }}>
        <div className="txt-o" style={{ fontSize: u(22), color: '#7cff6b' }}>
          You have {formatCash(cash)}
        </div>
        <Button
          color={c.color}
          disabled={!afford}
          style={{ padding: `${u(10)} ${u(28)}`, fontSize: u(24), fontWeight: 700 }}
          onClick={() => {
            sfx.buy()
            actions.openCase(caseId)
          }}
        >
          OPEN · ${c.price}
        </Button>
      </div>
      <div className="txt-o" style={{ fontSize: u(14), color: '#bdb3e0' }}>
        Win rounds and get kills to earn cash. Duplicates give {Math.round(0.4 * 100)}% of the price back.
      </div>
    </div>
  )
}

let strips = 1

/** The case reel: a strip of prizes scrolls fast, slows, and stops on what you got. */
function CaseOpening({ result }) {
  const setCaseOpen = useGame((s) => s.setCaseOpen)
  const c = CASES[result.caseId] || CASES.cape
  const pool = useMemo(() => casePool(result.caseId || 'cape'), [result.caseId])
  const [stage, setStage] = useState('spin')
  const strip = useMemo(() => {
    // 40 tiles drawn by chance, with the prize at index 34.
    let seed = 0
    for (const ch of `${result.id}${result.caseId}${result.refund}`) seed = (seed * 31 + ch.charCodeAt(0)) | 0
    const rng = mulberry32(seed ^ strips++)
    const pick = () => {
      let r = rng()
      for (const e of pool) {
        r -= e.chance
        if (r <= 0) return e
      }
      return pool[0]
    }
    const tiles = Array.from({ length: 40 }, pick)
    tiles[34] = pool.find((e) => e.id === result.id) || { id: result.id, rarity: 'common' }
    return tiles
  }, [pool, result])
  const stripRef = useRef(null)
  const TILE = 130

  useEffect(() => {
    const el = stripRef.current
    if (!el) return undefined
    const width = el.parentElement.clientWidth
    const scale = el.firstChild ? el.firstChild.getBoundingClientRect().width / 1 : TILE
    const tileW = scale + 8
    const target = 34 * tileW + tileW / 2 - width / 2 + (Math.random() - 0.5) * tileW * 0.6
    el.style.transition = 'none'
    el.style.transform = 'translateX(0px)'
    let raf = 0
    let lastTile = -1
    const start = performance.now()
    const tickSounds = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
      const tile = Math.floor((-m.m41 + width / 2) / tileW)
      if (tile !== lastTile) {
        lastTile = tile
        sfx.caseTick(1 + Math.min(1, (performance.now() - start) / 5000) * 0.3)
      }
      raf = requestAnimationFrame(tickSounds)
    }
    requestAnimationFrame(() => {
      el.style.transition = 'transform 4.6s cubic-bezier(0.08, 0.7, 0.12, 1)'
      el.style.transform = `translateX(${-target}px)`
      raf = requestAnimationFrame(tickSounds)
    })
    const done = setTimeout(() => {
      cancelAnimationFrame(raf)
      setStage('done')
      sfx.reveal(RARITY_ORDER.indexOf(pool.find((e) => e.id === result.id)?.rarity || 'common'))
    }, 4800)
    return () => {
      clearTimeout(done)
      cancelAnimationFrame(raf)
    }
  }, [strip, pool, result])

  const prize = strip[34]
  const kind = result.kind || c.kind
  const def = kind === 'cape' ? CAPES[result.id] : SWORD_SKINS[result.id]
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60" style={{ gap: u(18) }}>
      <div className="txt-o" style={{ fontSize: u(40), fontWeight: 700, color: c.color }}>
        {result.gift ? 'WELCOME GIFT · ' : ''}
        {c.name.toUpperCase()}
      </div>
      <div className="mc-panel relative overflow-hidden" style={{ width: `min(92vw, ${u(760)})`, padding: `${u(12)} 0` }}>
        <div className="absolute left-1/2 top-0 z-10 h-full -translate-x-1/2" style={{ width: u(4), background: '#ffd23b', boxShadow: '0 0 8px #ffd23b' }} />
        <div ref={stripRef} className="flex" style={{ gap: 8, willChange: 'transform' }}>
          {strip.map((e, i) => (
            <div key={i} className="slot flex shrink-0 flex-col items-center justify-center" style={{ width: u(TILE), height: u(150), borderColor: rarityColor(e.rarity), gap: u(4) }}>
              <img src={kind === 'cape' ? capePreview(e.id) : itemIcon('diamond_sword', e.id)} alt="" className="pixelated" style={{ height: u(80), width: kind === 'cape' ? u(50) : u(80) }} draggable={false} />
              <span className="txt-o text-center" style={{ fontSize: u(13), lineHeight: 1.1 }}>
                {(kind === 'cape' ? CAPES[e.id] : SWORD_SKINS[e.id])?.name}
              </span>
            </div>
          ))}
        </div>
      </div>
      {stage === 'done' && (
        <div className="pop-in flex flex-col items-center" style={{ gap: u(8) }}>
          <div className="txt-o" style={{ fontSize: u(20), color: rarityColor(prize.rarity) }}>
            {RARITIES[prize.rarity]?.name.toUpperCase()}
          </div>
          <div className="txt-o" style={{ fontSize: u(38), fontWeight: 700, color: rarityColor(prize.rarity) }}>
            {def?.name}
          </div>
          <div className="txt-o" style={{ fontSize: u(18) }}>
            {result.duplicate ? `Duplicate! +$${result.refund} back` : 'NEW! Added to your backpack'}
          </div>
          <div className="flex" style={{ gap: u(12) }}>
            {!result.duplicate && (
              <Button
                color="#3a6fd8"
                style={{ padding: `${u(8)} ${u(20)}`, fontSize: u(20) }}
                onClick={() => {
                  actions.equip(kind, result.id)
                  setCaseOpen(null)
                }}
              >
                EQUIP
              </Button>
            )}
            <Button style={{ padding: `${u(8)} ${u(20)}`, fontSize: u(20) }} onClick={() => setCaseOpen(null)}>
              NICE!
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function BackpackPanel() {
  const profile = useGame((s) => s.profile)
  const [tab, setTab] = useState('cape')
  const table = tab === 'cape' ? CAPES : SWORD_SKINS
  const owned = tab === 'cape' ? profile.capes : profile.swords
  const equipped = tab === 'cape' ? profile.cape : profile.sword
  const ids = Object.keys(table).sort((a, b) => RARITY_ORDER.indexOf(table[b].rarity) - RARITY_ORDER.indexOf(table[a].rarity))
  return (
    <div className="flex flex-col" style={{ gap: u(12) }}>
      <div className="flex" style={{ gap: u(10) }}>
        <Button color={tab === 'cape' ? '#ffb52e' : '#4b5563'} style={{ padding: `${u(8)} ${u(16)}`, fontSize: u(20) }} onClick={() => setTab('cape')}>
          CAPES {profile.capes.length}/{Object.keys(CAPES).length}
        </Button>
        <Button color={tab === 'sword' ? '#3fa2ff' : '#4b5563'} style={{ padding: `${u(8)} ${u(16)}`, fontSize: u(20) }} onClick={() => setTab('sword')}>
          SWORDS {profile.swords.length}/{Object.keys(SWORD_SKINS).length}
        </Button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(110)}, 1fr))`, gap: u(8) }}>
        {ids.map((id) => (
          <CosmeticTile
            key={id}
            kind={tab}
            id={id}
            rarity={table[id].rarity}
            owned={owned.includes(id)}
            equipped={equipped === id}
            onClick={() => owned.includes(id) && actions.equip(tab, id)}
          />
        ))}
      </div>
      <div className="txt-o" style={{ fontSize: u(14), color: '#bdb3e0' }}>
        Tap something you own to wear it. Get more from cases.
      </div>
    </div>
  )
}

function ShopPanel() {
  const gems = useGemsBalance()
  const [busy, setBusy] = useState(null)
  const show = useGame((s) => s.showToast)
  const adReady = isRewardedAvailable()
  return (
    <div className="flex flex-col" style={{ gap: u(10) }}>
      {gems !== null && gems !== undefined && (
        <div className="txt-o" style={{ fontSize: u(18), color: '#7fdcff' }}>
          Your Gems: {gems}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(220)}, 1fr))`, gap: u(10) }}>
        {Object.entries(GEM_PRODUCTS).map(([sku, p]) => (
          <div key={sku} className="slot flex flex-col" style={{ padding: u(12), gap: u(6) }}>
            <div className="txt-o" style={{ fontSize: u(22), fontWeight: 700, color: '#ffd23b' }}>
              {p.name}
            </div>
            <div className="txt-o" style={{ fontSize: u(15), minHeight: u(36) }}>
              {p.blurb}
            </div>
            <Button
              color="#3a6fd8"
              disabled={busy === sku}
              style={{ padding: `${u(6)} 0`, fontSize: u(18) }}
              onClick={async () => {
                setBusy(sku)
                const r = await buyGems(sku)
                setBusy(null)
                if (!r.success && r.error) show(r.error, 'error')
              }}
            >
              BUY WITH GEMS
            </Button>
          </div>
        ))}
        {Object.entries(AD_REWARDS).map(([placement, ad]) => (
          <div key={placement} className="slot flex flex-col" style={{ padding: u(12), gap: u(6) }}>
            <div className="txt-o" style={{ fontSize: u(22), fontWeight: 700, color: '#7cff6b' }}>
              FREE {ad.label}
            </div>
            <div className="txt-o" style={{ fontSize: u(15), minHeight: u(36) }}>
              Watch a short video
            </div>
            <Button
              color="#4a8f2c"
              disabled={!adReady || busy === placement}
              style={{ padding: `${u(6)} 0`, fontSize: u(18) }}
              onClick={async () => {
                setBusy(placement)
                const r = await watchRewardedAd(placement)
                setBusy(null)
                if (!r.ok && r.status !== 'skipped') show('No video available right now', 'error')
              }}
            >
              {adReady ? 'WATCH' : 'UNAVAILABLE'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyPanel() {
  const profile = useGame((s) => s.profile)
  const [openedAt] = useState(() => Date.now())
  const status = dailyStatus(profile, openedAt)
  return (
    <div className="flex flex-col items-center" style={{ gap: u(14) }}>
      <div className="flex flex-wrap justify-center" style={{ gap: u(8) }}>
        {DAILY_REWARDS.map((cash, i) => {
          const day = i + 1
          const current = Math.min(status.streak, DAILY_REWARDS.length) === day
          const past = day < Math.min(status.streak, DAILY_REWARDS.length) || (!status.ready && current)
          return (
            <div key={day} className="slot flex flex-col items-center" style={{ width: u(92), padding: u(8), borderColor: current ? '#ffd23b' : undefined, opacity: past && !current ? 0.6 : 1 }}>
              <span className="txt-o" style={{ fontSize: u(15) }}>
                DAY {day}
              </span>
              <span className="txt-o" style={{ fontSize: u(20), color: '#7cff6b', fontWeight: 700 }}>
                ${cash}
              </span>
              {past && <span style={{ fontSize: u(16) }}>✔</span>}
            </div>
          )
        })}
      </div>
      <Button
        color="#3fa2ff"
        disabled={!status.ready}
        style={{ padding: `${u(10)} ${u(30)}`, fontSize: u(24), fontWeight: 700 }}
        onClick={() => actions.claimDaily()}
      >
        {status.ready ? `CLAIM $${status.reward}` : 'COME BACK TOMORROW'}
      </Button>
    </div>
  )
}

function QuestsPanel() {
  const profile = useGame((s) => s.profile)
  const level = profile.level || 1
  const need = levelXp(level)
  const xp = profile.xp || 0
  const nextCase = Math.ceil((level + 1) / LEVEL_CASE_EVERY) * LEVEL_CASE_EVERY
  const quests = profile.quests?.list || []
  return (
    <div className="flex flex-col" style={{ gap: u(14) }}>
      <div className="slot flex items-center" style={{ padding: u(12), gap: u(14) }}>
        <div className="flex flex-col items-center" style={{ minWidth: u(80) }}>
          <span className="txt-o" style={{ fontSize: u(13), color: '#d9ccff' }}>
            LEVEL
          </span>
          <Fancy size={40} from="#fff7b0" to="#ffb21a">
            {String(level)}
          </Fancy>
        </div>
        <div className="flex flex-1 flex-col" style={{ gap: u(6) }}>
          <div className="flex justify-between txt-o" style={{ fontSize: u(15) }}>
            <span>
              {xp} / {need} XP
            </span>
            <span style={{ color: '#7cff6b' }}>Next level: +${levelCash(level + 1)}</span>
          </div>
          <div style={{ height: u(16), borderRadius: u(8), background: 'rgba(0,0,0,0.45)', overflow: 'hidden' }}>
            <div className="xp-fill" style={{ width: `${Math.min(100, (xp / need) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #7cf0ff, #5f8bff)' }} />
          </div>
          <span className="txt-o" style={{ fontSize: u(13), color: '#e6c7ff' }}>
            Free case at level {nextCase} · XP from playing, kills, lucky blocks, wins and quests
          </span>
        </div>
      </div>
      <Fancy size={22} from="#ffffff" to="#ffc28a">
        TODAY'S QUESTS
      </Fancy>
      {quests.map((q) => {
        const def = QUESTS[q.id]
        if (!def) return null
        return (
          <div key={q.id} className="slot flex items-center" style={{ padding: u(10), gap: u(12), borderColor: q.done ? '#7cff6b' : undefined }}>
            <span style={{ fontSize: u(26), width: u(32), textAlign: 'center' }}>{q.done ? '✔' : '★'}</span>
            <div className="flex flex-1 flex-col" style={{ gap: u(4) }}>
              <span className="txt-o" style={{ fontSize: u(17), fontWeight: 700 }}>
                {def.name}
              </span>
              <div style={{ height: u(10), borderRadius: u(5), background: 'rgba(0,0,0,0.45)', overflow: 'hidden' }}>
                <div className="xp-fill" style={{ width: `${(q.progress / def.goal) * 100}%`, height: '100%', background: q.done ? '#7cff6b' : 'linear-gradient(90deg, #ffd23b, #ff8a3c)' }} />
              </div>
            </div>
            <div className="flex flex-col items-end txt-o" style={{ fontSize: u(14), minWidth: u(90) }}>
              <span>
                {Math.floor(q.progress)} / {def.goal}
              </span>
              <span style={{ color: '#7cff6b' }}>
                ${def.cash} · {def.xp} XP
              </span>
            </div>
          </div>
        )
      })}
      <span className="txt-o" style={{ fontSize: u(13), color: '#bdb3e0', textAlign: 'center' }}>
        New quests every day. Rewards are paid the moment a quest is done.
      </span>
    </div>
  )
}

function LeaderboardsPanel() {
  const boards = useGame((s) => s.leaderboards)
  const profile = useGame((s) => s.profile)
  const [tab, setTab] = useState('wins')
  const tabs = { wins: 'WINS', kills: 'KILLS', games: 'ROUNDS', playtime: 'MINUTES' }
  const rows = boards?.[tab] || []
  return (
    <div className="flex flex-col" style={{ gap: u(10) }}>
      <div className="flex flex-wrap" style={{ gap: u(8) }}>
        {Object.entries(tabs).map(([id, label]) => (
          <Button key={id} color={tab === id ? '#2bb3a3' : '#4b5563'} style={{ padding: `${u(6)} ${u(14)}`, fontSize: u(18) }} onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="txt-o" style={{ fontSize: u(18), color: '#bdb3e0' }}>
          {boards ? 'No scores yet - be the first!' : 'Boards appear when you play online.'} You: {profile.wins} wins, {profile.kills} kills.
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="slot flex justify-between" style={{ padding: `${u(6)} ${u(12)}`, fontSize: u(18) }}>
          <span className="txt-o" style={{ color: i === 0 ? '#ffd23b' : '#fff' }}>
            {i + 1}. {r.name}
          </span>
          <span className="txt-o">{tab === 'playtime' ? Math.floor(r.value / 60) : Math.floor(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** What each graphics level means, for the settings buttons. */
const GRAPHICS = {
  LOW: { label: 'LOW', color: '#3a8f5c', blurb: 'Fastest. Short view, no particles. Best for phones.' },
  MEDIUM: { label: 'MID', color: '#3a6fd8', blurb: 'Particles, glowing lava, more clouds, smoother edges.' },
  HIGH: { label: 'HIGH', color: '#a24ad8', blurb: 'Farthest view and sharpest picture. Strong PCs.' },
}

/** Playing just with bots: a private room of your own (online), or how offline works. */
function BotsPanel() {
  const net = useGame((s) => s.net)
  const close = useGame((s) => s.closePanel)
  const online = net.mode === 'online'
  return (
    <div className="flex flex-col" style={{ gap: u(12) }}>
      <div className="txt-o" style={{ fontSize: u(17), lineHeight: 1.35 }}>
        Every round has 8 fighters: any island without a player gets a bot. Bots open lucky blocks, build bridges, fight - and team up with you in team modes.
      </div>
      <div className="txt-o" style={{ fontSize: u(15), color: '#cfc6ee', lineHeight: 1.35 }}>
        Pick how hard they play in the lobby vote (BOTS: EASY / NORMAL / HARD).
      </div>
      {online ? (
        <div className="flex flex-wrap items-center" style={{ gap: u(10) }}>
          <Button
            color="#7a5cd8"
            style={{ padding: `${u(10)} ${u(22)}`, fontSize: u(20), fontWeight: 700 }}
            onClick={() => {
              close()
              switchLobby({ mode: 'private' })
            }}
          >
            {net.isPrivate ? 'NEW PRIVATE ROOM' : 'PRIVATE ROOM: ME + BOTS'}
          </Button>
          {net.isPrivate && (
            <Button
              color="#3a6fd8"
              style={{ padding: `${u(10)} ${u(22)}`, fontSize: u(20) }}
              onClick={() => {
                close()
                switchLobby({ mode: 'public' })
              }}
            >
              BACK TO PUBLIC
            </Button>
          )}
        </div>
      ) : (
        <div className="txt-o" style={{ fontSize: u(16), color: '#7cff6b' }}>
          You're offline, so every round is you and 7 bots already.
        </div>
      )}
      {online && net.isPrivate && net.code && (
        <div className="txt-o" style={{ fontSize: u(15), color: '#bfe8ff' }}>
          Room code {net.code} - friends can join with it.
        </div>
      )}
    </div>
  )
}

function SettingsPanel() {
  const settings = useGame((s) => s.settings)
  const setSetting = useGame((s) => s.setSetting)
  const level = useQuality((s) => s.level)
  const manual = useQuality((s) => s.manual)
  const setLevel = useQuality((s) => s.setLevel)
  const [muted, setMutedState] = useState(isMuted())
  const row = (label, control) => (
    <div className="flex items-center justify-between" style={{ gap: u(12), padding: `${u(6)} 0` }}>
      <span className="txt-o" style={{ fontSize: u(20) }}>
        {label}
      </span>
      {control}
    </div>
  )
  const slider = (key, min, max, step) => (
    <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => setSetting(key, Number(e.target.value))} style={{ width: u(240) }} />
  )
  return (
    <div className="flex flex-col">
      <div className="flex flex-col" style={{ gap: u(8), paddingBottom: u(10), marginBottom: u(6), borderBottom: `${u(3)} solid rgba(255,255,255,0.12)` }}>
        <span className="txt-o" style={{ fontSize: u(22), fontWeight: 700 }}>
          GRAPHICS
        </span>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: u(8) }}>
          {QUALITY_LEVELS.map((l) => {
            const q = GRAPHICS[l]
            const on = l === level
            return (
              <button
                key={l}
                type="button"
                className="mc-btn flex flex-col items-center text-center"
                style={{ '--c': on ? q.color : '#3f4654', padding: `${u(10)} ${u(6)}`, gap: u(4), outline: on ? `${u(4)} solid #fff` : 'none' }}
                onClick={() => setLevel(l)}
              >
                <span className="txt-o" style={{ fontSize: u(24), fontWeight: 700 }}>
                  {q.label}
                </span>
                <span className="txt-o" style={{ fontSize: u(12), lineHeight: 1.25, opacity: 0.95 }}>
                  {q.blurb}
                </span>
              </button>
            )
          })}
        </div>
        <span className="txt-o" style={{ fontSize: u(13), color: '#bdb3e0' }}>
          {manual ? 'Your choice is saved on this device.' : 'Picked for your device. If the game slows down it lowers this by itself.'}
        </span>
      </div>
      {row(`Mouse / touch sensitivity ${settings.sensitivity.toFixed(1)}`, slider('sensitivity', 0.3, 2.5, 0.1))}
      {row(`Field of view ${settings.fov}`, slider('fov', 60, 100, 1))}
      {row(
        'Invert look up/down',
        <Button color={settings.invertY ? '#4a8f2c' : '#4b5563'} style={{ padding: `${u(4)} ${u(14)}`, fontSize: u(16) }} onClick={() => setSetting('invertY', !settings.invertY)}>
          {settings.invertY ? 'ON' : 'OFF'}
        </Button>,
      )}
      {row(
        'Camera in rounds',
        <Button
          color="#4b5563"
          style={{ padding: `${u(4)} ${u(14)}`, fontSize: u(16) }}
          onClick={() => {
            runtime.camera.mode = runtime.camera.mode === 'first' ? 'third' : 'first'
            setSetting('camera', runtime.camera.mode)
          }}
        >
          {settings.camera === 'third' ? 'THIRD PERSON' : 'FIRST PERSON'}
        </Button>,
      )}
      {row(
        'Sound',
        <Button
          color={muted ? '#d8443a' : '#4a8f2c'}
          style={{ padding: `${u(4)} ${u(14)}`, fontSize: u(16) }}
          onClick={() => {
            setMuted(!muted)
            setMutedState(!muted)
          }}
        >
          {muted ? 'MUTED' : 'ON'}
        </Button>,
      )}
      <div className="txt-o" style={{ fontSize: u(14), color: '#bdb3e0', marginTop: u(8) }}>
        Keys: WASD move · Space jump · Shift sneak · Ctrl / double-tap W sprint · 1-9 or wheel pick a slot · V camera · E open a case
      </div>
    </div>
  )
}
