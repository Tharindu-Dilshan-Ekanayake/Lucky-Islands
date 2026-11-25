import { useEffect, useRef, useState } from 'react'

import { BOT_LEVEL_IDS, BOT_LEVELS, CASES, EFFECTS, ITEMS, lavaHeight, LAVA, MODES, MODE_IDS, ROUND, TEAMS } from '@shared/balance'
import { MAP_IDS, MAPS } from '@shared/maps'
import { dailyStatus } from '@shared/logic'

import { exitPointerLock, selectSlot } from '../game/input'
import { itemIcon } from '../game/art/items'
import { runtime } from '../game/runtime'
import { actions } from '../net/actions'
import { switchLobby } from '../net/connection'
import { useBloxity } from '../bloxity/BloxityContext'
import { useGame } from '../store/game'
import { formatCash, formatClock, u, useCountUp, useNow } from './format'
import GameIcon from './GameIcon'
import { Button, Fancy, Hearts } from './kit'

/**
 * The heads-up display: round clock and players left, the objective, hearts, hotbar,
 * crosshair, kill feed, loot popups and toasts in a round; the vote, menu, wallet and
 * case prompt in the lobby; the spectator bar when you're out.
 */
export default function HUD() {
  const zone = useGame((s) => s.zone)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-white">
      {/* Every zone change (lobby, round, spectating) fades in from dark. */}
      <div key={zone} className="zone-fade" />
      <SettingsButton />
      <NetBadge />
      <TopCenter />
      {zone === 'match' && (
        <>
          <Objective />
          <BigCount />
          <Crosshair />
          <BottomBar />
          <LootPopup />
        </>
      )}
      {zone === 'lobby' && (
        <>
          <LobbyMenu />
          <Wallet />
          <StationPrompt />
          <WelcomeGift />
        </>
      )}
      {zone === 'spec' && <SpectateBar />}
      <NameTag />
      <KillFeed />
      <Toasts />
    </div>
  )
}

/** You, top right: your Bloxity picture and name, with your wins and kills. */
/** 3, 2, 1 in the middle of the screen as the cages open, then GO! */
function BigCount() {
  const phase = useGame((s) => s.phase)
  const now = useNow(100)
  let text = null
  if (phase.phase === 'cages') {
    const n = Math.ceil((phase.endsAt - now) / 1000)
    if (n >= 1 && n <= 3) text = String(n)
  } else if (phase.phase === 'fight' && ROUND.fightMs - (phase.endsAt - now) < 1000) text = 'GO!'
  if (!text) return null
  const go = text === 'GO!'
  return (
    <div key={text} className={`big-count absolute left-1/2 top-1/2 ${go ? 'big-go' : ''}`}>
      <Fancy size={go ? 120 : 140} from={go ? '#d8ffb0' : '#ffffff'} to={go ? '#3fdc4a' : '#ffc21a'}>
        {text}
      </Fancy>
    </div>
  )
}

function NameTag() {
  const { identity } = useBloxity()
  const profileName = useGame((s) => s.profile.name)
  const wins = useGame((s) => s.profile.wins)
  const kills = useGame((s) => s.profile.kills)
  const name = identity?.displayName || identity?.username || profileName || 'Guest'
  const pfp = identity?.pfp
  return (
    <div className="name-tag slide-in-right mc-panel absolute" style={{ right: u(14), top: u(14), padding: `${u(5)} ${u(14)} ${u(5)} ${u(5)}`, gap: u(10) }}>
      <div className="slot flex shrink-0 items-center justify-center overflow-hidden" style={{ width: u(46), height: u(46), padding: 0 }}>
        {pfp ? (
          <img src={pfp} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        ) : (
          <span className="txt-o" style={{ fontSize: u(24), fontWeight: 700 }}>
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-col" style={{ lineHeight: 1.1 }}>
        <span className="txt-o" style={{ fontSize: u(19), fontWeight: 700, maxWidth: u(220), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span className="txt-o" style={{ fontSize: u(14) }}>
          <span style={{ color: '#ffd23b' }}>👑 {wins}</span> <span style={{ color: '#ff8a8a', marginLeft: u(8) }}>⚔ {kills}</span>
        </span>
      </div>
    </div>
  )
}

/** The settings button, top left, in the lobby and in a round alike. */
function SettingsButton() {
  const open = useGame((s) => s.openPanel)
  return (
    <Button
      className="pointer-events-auto absolute flex items-center justify-center"
      color="#4b5563"
      title="Settings"
      style={{ left: u(14), top: u(14), width: u(52), height: u(52), padding: 0 }}
      onClick={() => {
        exitPointerLock()
        open('settings')
      }}
    >
      <GameIcon name="gear" size={30} />
    </Button>
  )
}

function NetBadge() {
  const net = useGame((s) => s.net)
  if (net.mode === 'online') return null
  const text = net.mode === 'offline' ? 'OFFLINE · BOTS' : net.message || 'CONNECTING…'
  return (
    <div className="mc-panel txt-o absolute" style={{ left: u(78), top: u(24), padding: `${u(4)} ${u(12)}`, fontSize: u(16) }}>
      {text}
    </div>
  )
}

function TopCenter() {
  const phase = useGame((s) => s.phase)
  const zone = useGame((s) => s.zone)
  const now = useNow(250)
  const left = Math.max(0, phase.endsAt - now)

  // Title as parts: [text, highlighted?] - each drawn as gradient title text.
  let parts = null
  let sub = null
  let bar = null
  if (zone !== 'lobby') {
    if (phase.phase === 'cages') {
      parts = [['CAGES OPEN IN '], [String(Math.ceil(left / 1000)), true]]
      sub = MODES[phase.mode]?.name ? `${MODES[phase.mode].name} · ${MAPS[phase.map]?.name || ''}` : null
    } else if (phase.phase === 'fight') {
      const teams = phase.teamSize > 1
      parts = [[`${teams ? phase.teamsLeft : phase.alive}`, true], [teams ? ' TEAMS LEFT  ' : ' PLAYERS LEFT  '], [formatClock(left), true]]
      bar = left / ROUND.fightMs
    } else if (phase.phase === 'ended') parts = [['ROUND OVER']]
  } else if (phase.phase === 'intermission') {
    parts = [['ROUND STARTS IN '], [formatClock(left), true]]
  } else if (phase.phase === 'waiting') {
    parts = [[phase.afk ? 'YOU ARE AFK' : 'WAITING FOR PLAYERS...']]
    sub = phase.afk ? 'Turn AFK off to join the next round' : null
  } else {
    parts = [['ROUND IN PROGRESS · '], [`${phase.alive}`, true], [' LEFT']]
  }

  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: u(12), gap: u(8) }}>
      {parts && (
        <div key={`${zone}:${phase.phase}`} className="drop-in flex items-baseline" style={{ gap: u(14) }}>
          {parts.map(([text, hot], i) => (
            <Fancy key={i} size={30} from={hot ? '#fff7b0' : '#ffffff'} to={hot ? '#ffb21a' : '#d7ccff'}>
              {text.trim()}
            </Fancy>
          ))}
        </div>
      )}
      {bar !== null && (
        <div className="mc-panel" style={{ width: u(460), height: u(20), padding: u(3) }}>
          <div style={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%`, height: '100%', background: bar < 0.25 ? 'linear-gradient(#ffb36b, #e2441c)' : 'linear-gradient(#d9a8ff 0%, #a35cff 50%, #7a2fe0 100%)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35)' }} />
        </div>
      )}
      {sub && (
        <div className="txt-o" style={{ fontSize: u(18), color: '#d9ccff' }}>
          {sub}
        </div>
      )}
      {zone !== 'lobby' && phase.teamSize > 1 && (phase.phase === 'cages' || phase.phase === 'fight') && <TeamChip />}
      {zone === 'lobby' && <PlayerCount />}
      {zone === 'lobby' && (phase.phase === 'intermission' || phase.phase === 'waiting') && !phase.afk && <VoteCards phase={phase} />}
      {zone === 'lobby' && (phase.phase === 'cages' || phase.phase === 'fight') && (
        <div className="pointer-events-auto flex" style={{ gap: u(10) }}>
          {phase.canJoin && (
            <Button color="#3fae4a" style={{ padding: `${u(8)} ${u(26)}`, fontSize: u(22) }} onClick={() => actions.joinRound()}>
              JOIN ROUND
            </Button>
          )}
          <Button color="#3a6fd8" style={{ padding: `${u(8)} ${u(26)}`, fontSize: u(22) }} onClick={() => actions.spectate()}>
            SPECTATE
          </Button>
        </div>
      )}
    </div>
  )
}

/** Team modes: which team you're on, and who's with you. */
function TeamChip() {
  const roster = useGame((s) => s.roster)
  const mine = Object.values(roster).find((e) => e.eid === runtime.eid)
  if (!mine || mine.team < 0) return null
  const team = TEAMS[mine.team % TEAMS.length]
  const mates = Object.values(roster).filter((e) => e.team === mine.team && e.eid !== mine.eid && e.zone === 'match')
  return (
    <div className="mc-panel txt-o flex items-center" style={{ gap: u(8), padding: `${u(3)} ${u(12)}`, fontSize: u(15), borderColor: team.color }}>
      <span style={{ color: team.color, fontWeight: 700 }}>{team.name.toUpperCase()} TEAM</span>
      {mates.length > 0 && (
        <span style={{ color: '#e6dcff' }}>
          with{' '}
          {mates.map((m, i) => (
            <span key={m.eid} style={{ color: m.alive ? '#fff' : '#8b84a8', textDecoration: m.alive ? 'none' : 'line-through' }}>
              {i ? ', ' : ''}
              {m.name}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

/** How full this server is (rounds always fill up to 8 with bots). */
function PlayerCount() {
  const net = useGame((s) => s.net)
  let text = 'OFFLINE - PLAYING WITH BOTS'
  if (net.mode === 'online') text = net.isPrivate ? `PRIVATE ROOM ${net.code || ''} · ${net.players}/${net.maxPlayers} PLAYERS` : `${net.players}/${net.maxPlayers} PLAYERS IN THIS SERVER`
  return (
    <div className="flex items-center" style={{ gap: u(10) }}>
      <span className="txt-o" style={{ fontSize: u(14), color: '#bfe8ff' }}>
        {text} · 8 FIGHT EVERY ROUND
      </span>
      {net.mode === 'online' && net.isPrivate && (
        <Button className="pointer-events-auto" color="#3a6fd8" style={{ padding: `${u(2)} ${u(10)}`, fontSize: u(13) }} onClick={() => switchLobby({ mode: 'public' })}>
          PUBLIC SERVER
        </Button>
      )}
    </div>
  )
}

/**
 * The lobby vote, decided by everyone in the room, in two steps: first the mode (and
 * whether to play with bots, and how hard), then - with the chosen mode shown - the map.
 * Each step ends when its time is up or as soon as everyone has voted; once the map is
 * picked the round starts.
 */
function VoteCards({ phase }) {
  const now = useNow(250)
  const label = (n) => `${n || 0} VOTE${n === 1 ? '' : 'S'}`
  const modeStep = phase.voteStage !== 'map'
  const stageLeft = Math.max(0, (phase.stageEndsAt || 0) - now)
  const step = (n, text) => (
    <div className="flex items-center" style={{ gap: u(10) }}>
      <span className="chip" style={{ fontSize: u(13), color: '#ffd23b' }}>
        STEP {n}/2
      </span>
      <Fancy size={22} from="#ffffff" to="#c9b8ff">
        {text}
      </Fancy>
      {phase.phase === 'intermission' && (
        <span className="chip" style={{ fontSize: u(15), color: '#ffd23b' }}>
          {Math.ceil(stageLeft / 1000)}s
        </span>
      )}
    </div>
  )

  if (modeStep) {
    return (
      <div className="vote-panel pointer-events-auto mc-panel flex flex-col items-center" style={{ gap: u(10), marginTop: u(4), padding: `${u(10)} ${u(12)} ${u(12)}` }}>
        {step(1, 'PICK THE MODE')}
        <div className="flex" style={{ gap: u(8) }}>
          {MODE_IDS.map((id, i) => {
            const m = MODES[id]
            const mine = phase.myVote === id
            return (
              <button
                key={id}
                type="button"
                className={`mc-btn vote-card flex flex-col items-center text-center ${mine ? 'picked' : ''}`}
                style={{ '--c': m.color, '--i': i, width: u(150), padding: `${u(8)} ${u(8)}` }}
                onClick={() => actions.vote(id)}
              >
                <span className="txt-o" style={{ fontSize: u(19), fontWeight: 700 }}>
                  {m.name}
                </span>
                <span className="txt-o" style={{ fontSize: u(12), lineHeight: 1.2, minHeight: u(56), opacity: 0.95, fontWeight: 500 }}>
                  {m.blurb}
                </span>
                <span key={phase.votes?.[id] || 0} className="vote-count bump">
                  {label(phase.votes?.[id])}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center" style={{ gap: u(8) }}>
          <span className="txt-o" style={{ fontSize: u(16), color: '#d9ccff', fontWeight: 700 }}>
            BOTS
          </span>
          {BOT_LEVEL_IDS.map((id) => {
            const lv = BOT_LEVELS[id]
            const mine = phase.myBotVote === id
            return (
              <button
                key={id}
                type="button"
                className={`mc-btn txt-o ${mine ? 'picked' : ''}`}
                style={{ '--c': mine ? lv.color : '#4b5468', padding: `${u(4)} ${u(14)}`, fontSize: u(15) }}
                onClick={() => actions.voteBots(id)}
              >
                {lv.name} · {phase.botVotes?.[id] || 0}
              </button>
            )
          })}
        </div>
        <span className="txt-o" style={{ fontSize: u(13), color: '#bdb3e0', fontWeight: 500 }}>
          Most votes wins - then everyone picks the map, and the round begins
        </span>
      </div>
    )
  }

  const chosen = MODES[phase.chosenMode]
  return (
    <div className="vote-panel pointer-events-auto mc-panel flex flex-col items-center" style={{ gap: u(10), marginTop: u(4), padding: `${u(10)} ${u(12)} ${u(12)}` }}>
      {chosen && (
        <div className="flex items-center" style={{ gap: u(10) }}>
          <span className="txt-o" style={{ fontSize: u(13), color: '#bdb3e0' }}>
            MODE
          </span>
          <span className="chip" style={{ fontSize: u(18), background: chosen.color, color: '#fff', fontWeight: 700 }}>
            {chosen.name}
          </span>
          {phase.chosenBots && (
            <span className="chip" style={{ fontSize: u(14), color: BOT_LEVELS[phase.chosenBots]?.color }}>
              {phase.chosenBots === 'off' ? 'NO BOTS' : `${BOT_LEVELS[phase.chosenBots]?.name} bots`}
            </span>
          )}
        </div>
      )}
      {step(2, 'PICK THE MAP')}
      <div className="flex" style={{ gap: u(10) }}>
        {MAP_IDS.map((id, i) => {
          const mine = phase.myMapVote === id
          return (
            <button
              key={id}
              type="button"
              className={`mc-btn vote-card flex flex-col items-center text-center ${mine ? 'picked' : ''}`}
              style={{ '--c': mine ? '#e0a21b' : '#4b5468', '--i': i, width: u(196), padding: u(6), gap: u(4) }}
              onClick={() => actions.voteMap(id)}
            >
              <img src={`${import.meta.env.BASE_URL}maps/${id}.webp`} alt={MAPS[id].name} draggable={false} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: u(10) }} />
              <span className="txt-o" style={{ fontSize: u(17), fontWeight: 700, lineHeight: 1.1 }}>
                {MAPS[id].name}
              </span>
              <span key={phase.mapVotes?.[id] || 0} className="vote-count bump">
                {label(phase.mapVotes?.[id])}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Objective() {
  const tutorialSeen = useGame((s) => s.profile.tutorial)
  const step = useGame((s) => s.tutorial)
  const phase = useGame((s) => s.phase)
  const now = useNow(500)
  const touch = runtime.input.touch
  let text = null
  let sub = null
  let hot = false
  if (!tutorialSeen && step < 3 && phase.phase === 'fight') {
    const steps = [
      ['1/3 BREAK A LUCKY BLOCK', touch ? 'Hold the pickaxe button while aiming at it' : 'Hold left click on it'],
      ['2/3 HOLD YOUR BLOCKS', touch ? 'Tap the block slot in your hotbar' : 'Press the number of your block slot'],
      ['3/3 BUILD TO THE MIDDLE ISLAND', touch ? 'Look past the edge - the white box shows where - tap PLACE' : 'Look past the edge - the white box shows where - right click'],
    ]
    ;[text, sub] = steps[step]
  } else if (phase.phase === 'fight') {
    const elapsed = ROUND.fightMs - Math.max(0, phase.endsAt - now)
    if (lavaHeight(elapsed, phase.mode) > LAVA.startY + 0.05) {
      text = 'THE LAVA IS RISING!'
      hot = true
    }
  }
  if (!text) return null
  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center text-center" style={{ top: u(118) }}>
      <div className={hot ? 'bob' : ''}>
        <Fancy size={hot ? 26 : 32} from={hot ? '#ffe27a' : '#ffffff'} to={hot ? '#ff4a1c' : '#9fe6ff'}>
          {text}
        </Fancy>
      </div>
      {sub && (
        <div className="txt-o" style={{ fontSize: u(18), color: '#e6dcff' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function Crosshair() {
  return (
    <>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: u(22), height: u(22), mixBlendMode: 'difference' }}>
        <div className="absolute left-1/2 top-0 h-full -translate-x-1/2 bg-white" style={{ width: u(3) }} />
        <div className="absolute left-0 top-1/2 w-full -translate-y-1/2 bg-white" style={{ height: u(3) }} />
      </div>
      {/* Flashes when your hit lands (ui/juice.js). */}
      <div id="hitmarker" style={{ width: u(34), height: u(34) }}>
        {[45, -45].map((r) => (
          <div key={r} className="absolute left-1/2 top-1/2" style={{ width: u(34), height: u(5), background: '#ff4a3a', boxShadow: '0 0 0 2px #1a0f2e', transform: `translate(-50%, -50%) rotate(${r}deg)` }} />
        ))}
      </div>
      <div id="dmg-layer" className="absolute inset-0" />
      <KillBanner />
    </>
  )
}

/** "ELIMINATED <name>" in the middle of the screen, with streaks. */
function KillBanner() {
  const banner = useGame((s) => s.killBanner)
  if (!banner) return null
  return (
    <div key={banner.id} className="kill-banner absolute left-1/2 flex flex-col items-center" style={{ top: '25%' }}>
      {banner.streak && (
        <Fancy size={34} from="#ffe9ff" to="#d05cff">
          {banner.streak}
        </Fancy>
      )}
      <Fancy size={26} from="#ffd0c4" to="#ff3a2a">
        ELIMINATED
      </Fancy>
      <span className="txt-o" style={{ fontSize: u(20), fontWeight: 700 }}>
        {banner.name}
      </span>
      <span className="txt-o" style={{ fontSize: u(18), color: '#7cff6b' }}>
        +${banner.cash}
      </span>
    </div>
  )
}

function BottomBar() {
  const me = useGame((s) => s.me)
  const sword = useGame((s) => s.profile.sword)
  const [label, setLabel] = useState(null)
  const labelId = useRef(0)
  const selId = me.inv[me.sel]?.id
  useEffect(() => {
    if (!selId) return undefined
    labelId.current += 1
    setLabel({ text: ITEMS[selId]?.name, id: labelId.current })
    const id = setTimeout(() => setLabel(null), 1600)
    return () => clearTimeout(id)
  }, [selId, me.sel])

  return (
    <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ paddingBottom: u(14), gap: u(6) }}>
      {label?.text && (
        <div key={label.id} className="txt-o pop-in" style={{ fontSize: u(20) }}>
          {label.text}
        </div>
      )}
      <EffectChips effects={me.effects} />
      <div className="flex w-full items-end justify-between" style={{ gap: u(16) }}>
        <Hearts hp={me.hp} maxHp={me.maxHp} />
        {me.kills > 0 && (
          <div className="txt-o" style={{ fontSize: u(18), color: '#ff8a8a' }}>
            ⚔ {me.kills}
          </div>
        )}
      </div>
      <div className="pointer-events-auto flex" style={{ gap: u(3) }}>
        {Array.from({ length: 9 }, (_, i) => {
          const slot = me.inv[i]
          return (
            <button
              key={i}
              type="button"
              className={`slot relative flex items-center justify-center ${i === me.sel ? 'sel' : ''}`}
              style={{ width: 'var(--slot)', height: 'var(--slot)' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                selectSlot(i)
              }}
            >
              {slot && <img src={itemIcon(slot.id, sword)} alt="" className="pixelated" style={{ width: '68%', height: '68%' }} draggable={false} />}
              {slot && slot.n > 1 && (
                <span key={slot.n} className="txt-o bump absolute" style={{ right: u(3), bottom: u(-2), fontSize: u(18), fontWeight: 700 }}>
                  {slot.n}
                </span>
              )}
              <span className="absolute opacity-50" style={{ left: u(4), top: u(1), fontSize: u(11) }}>
                {i + 1}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const EFFECT_LABELS = { speed: ['SPEED', '#5fd3ff'], jump: ['JUMP', '#7cff6b'], strength: ['STRENGTH', '#ff5050'], regen: ['REGEN', '#ff7bd5'], burn: ['BURNING', '#ff9a3c'] }

function EffectChips({ effects }) {
  const now = useNow(500)
  const at = runtime.me.effectsAt
  const list = Object.entries(effects || {}).filter(([k, ms]) => EFFECT_LABELS[k] && ms - (now - at) > 0 && EFFECTS[k])
  if (!list.length) return null
  return (
    <div className="flex" style={{ gap: u(6) }}>
      {list.map(([k, ms]) => (
        <span key={k} className="mc-panel txt-o" style={{ padding: `${u(2)} ${u(8)}`, fontSize: u(14), color: EFFECT_LABELS[k][1] }}>
          {EFFECT_LABELS[k][0]} {Math.ceil((ms - (now - at)) / 1000)}s
        </span>
      ))}
    </div>
  )
}

function LootPopup() {
  const loot = useGame((s) => s.loot)
  const sword = useGame((s) => s.profile.sword)
  if (!loot) return null
  const color = loot.bad ? '#ff5a3c' : loot.rare ? '#d08cff' : '#ffd23b'
  return (
    <div key={loot.id} className="fade-up absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(190), gap: u(6) }}>
      <Fancy size={38} from={loot.bad ? '#ffb0a0' : loot.rare ? '#f3d4ff' : '#fff7b0'} to={color}>
        {loot.text}
      </Fancy>
      <div className="flex" style={{ gap: u(8) }}>
        {loot.items.map(([id, n], i) => (
          <div key={i} className="mc-panel flex items-center" style={{ padding: `${u(2)} ${u(8)}`, gap: u(4) }}>
            <img src={itemIcon(id, sword)} alt="" className="pixelated" style={{ width: u(28), height: u(28) }} />
            <span className="txt-o" style={{ fontSize: u(16) }}>
              +{n}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KillFeed() {
  const feed = useGame((s) => s.feed)
  if (!feed.length) return null
  const how = { melee: '⚔', arrow: '➶', snowball: '❄', tnt: '✹', lava: '🔥', void: '↓', burn: '🔥', lightning: 'ϟ', left: '⇥', pearl: '✦' }
  return (
    <div className="absolute flex flex-col items-end" style={{ right: u(14), top: u(84), gap: u(4) }}>
      {feed.map((f) => (
        <div key={f.id} className="mc-panel txt-o slide-in-right" style={{ padding: `${u(3)} ${u(10)}`, fontSize: u(16) }}>
          {f.k ? (
            <>
              <span style={{ color: '#ffd23b' }}>{f.k}</span> {how[f.how] || '⚔'} <span style={{ color: '#ff8a8a' }}>{f.v}</span>
            </>
          ) : (
            <>
              <span style={{ color: '#ff8a8a' }}>{f.v}</span> {f.how === 'left' ? 'left the round' : f.how === 'lava' ? 'melted in the lava' : 'was eliminated'}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const colors = { success: '#7cff6b', error: '#ff6b6b', kill: '#ffd23b', info: '#ffffff' }
  return (
    <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: u(205), gap: u(6) }}>
      {toasts.map((t) => (
        <div key={t.id} className="txt-o pop-in" style={{ fontSize: u(22), color: colors[t.kind] || '#fff' }}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

// --- Lobby ------------------------------------------------------------------------------

function MenuButton({ label, color, badge, onClick }) {
  return (
    <Button color={color} className="relative" style={{ width: u(150), padding: `${u(9)} 0`, fontSize: u(17), fontWeight: 700 }} onClick={onClick}>
      {label}
      {badge && (
        <span className="absolute flex items-center justify-center rounded-full bg-red-600" style={{ right: u(-10), top: u(-10), width: u(24), height: u(24), fontSize: u(15), border: `${u(3)} solid #0d0a18` }}>
          !
        </span>
      )}
    </Button>
  )
}

function LobbyMenu() {
  const open = useGame((s) => s.openPanel)
  const profile = useGame((s) => s.profile)
  const afk = useGame((s) => s.phase.afk)
  const [openedAt] = useState(() => Date.now())
  const dailyReady = dailyStatus(profile, openedAt).ready
  const go = (panel, data) => {
    exitPointerLock()
    open(panel, data)
  }
  return (
    <div className="lobby-menu pointer-events-auto absolute" style={{ left: u(14), gap: u(12) }}>
      <MenuButton label="SHOP" color="#e0a21b" onClick={() => go('shop')} />
      <MenuButton label="CASES" color="#c25cff" onClick={() => go('cases', { caseId: 'cape' })} />
      <MenuButton label="BACKPACK" color="#b0633a" onClick={() => go('backpack')} />
      <MenuButton label="DAILY" color="#3fa2ff" badge={dailyReady} onClick={() => go('daily')} />
      <MenuButton label="TOP" color="#2bb3a3" onClick={() => go('leaderboards')} />
      <MenuButton label="BOTS ONLY" color="#7a5cd8" onClick={() => go('bots')} />
      <MenuButton label={afk ? 'AFK: ON' : 'AFK: OFF'} color={afk ? '#d8443a' : '#4b5563'} onClick={() => actions.afk(!afk)} />
    </div>
  )
}

function Wallet() {
  const wins = useGame((s) => s.profile.wins)
  const cash = useGame((s) => s.profile.cash)
  const shown = useCountUp(cash)
  return (
    <div className="slide-in-up absolute flex flex-col" style={{ left: u(14), bottom: u(14), gap: u(6) }}>
      <div className="txt-o" style={{ fontSize: u(28), fontWeight: 700, color: '#ffd23b' }}>
        👑 {wins}
      </div>
      <div key={cash} className="txt-o bump" style={{ fontSize: u(30), fontWeight: 700, color: '#7cff6b', transformOrigin: 'left center' }}>
        {formatCash(shown)}
      </div>
    </div>
  )
}

function StationPrompt() {
  const prompt = useGame((s) => s.prompt)
  const open = useGame((s) => s.openPanel)
  if (!prompt?.startsWith('case:')) return null
  const caseId = prompt.slice(5)
  const c = CASES[caseId]
  return (
    <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: u(120) }}>
      <Button
        className="pointer-events-auto bob"
        color={c.color}
        style={{ padding: `${u(10)} ${u(26)}`, fontSize: u(24), fontWeight: 700 }}
        onClick={() => {
          exitPointerLock()
          open('cases', { caseId })
        }}
      >
        {runtime.input.touch ? 'OPEN' : '[E]'} {c.name.toUpperCase()} · ${c.price}
      </Button>
    </div>
  )
}

/** First visit: a free Cape Case, opened right away. */
function WelcomeGift() {
  const loaded = useGame((s) => s.profileLoaded)
  const given = useGame((s) => s.profile.welcomeGift)
  const phase = useGame((s) => s.phase)
  const now = useNow(1000)
  const asked = useRef(false)
  // Not with a round about to start: the reel would be cut short.
  const calm = phase.phase === 'waiting' || (phase.phase === 'intermission' && phase.endsAt - now > 12_000)
  useEffect(() => {
    if (!loaded || given || asked.current || !calm) return undefined
    const id = setTimeout(() => {
      asked.current = true
      actions.welcomeGift()
    }, 2500)
    return () => clearTimeout(id)
  }, [loaded, given, calm])
  return null
}

function SpectateBar() {
  const name = useGame((s) => s.spectating)
  const canJoin = useGame((s) => s.phase.canJoin)
  const cycle = (dir) => {
    const ids = [...runtime.remotes.keys()]
    if (!ids.length) return
    const i = ids.indexOf(runtime.spectate.eid)
    runtime.spectate.eid = ids[(i + dir + ids.length) % ids.length]
    runtime.snap = true
  }
  return (
    <div className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(24), gap: u(8) }}>
      <div className="mc-panel flex items-center" style={{ gap: u(12), padding: `${u(6)} ${u(10)}` }}>
        <Button color="#4b5563" style={{ width: u(46), height: u(40), fontSize: u(22) }} onClick={() => cycle(-1)}>
          ‹
        </Button>
        <div className="flex flex-col items-center" style={{ minWidth: u(200) }}>
          <span className="txt-o" style={{ fontSize: u(13), color: '#bdb3e0' }}>
            SPECTATING
          </span>
          <span className="txt-o" style={{ fontSize: u(22), fontWeight: 700 }}>
            {name || '—'}
          </span>
        </div>
        <Button color="#4b5563" style={{ width: u(46), height: u(40), fontSize: u(22) }} onClick={() => cycle(1)}>
          ›
        </Button>
      </div>
      <div className="flex" style={{ gap: u(10) }}>
        {canJoin && (
          <Button color="#3fae4a" style={{ padding: `${u(6)} ${u(20)}`, fontSize: u(18) }} onClick={() => actions.joinRound()}>
            JOIN ROUND
          </Button>
        )}
        <Button color="#d8443a" style={{ padding: `${u(6)} ${u(20)}`, fontSize: u(18) }} onClick={() => actions.toLobby()}>
          BACK TO LOBBY
        </Button>
      </div>
    </div>
  )
}
