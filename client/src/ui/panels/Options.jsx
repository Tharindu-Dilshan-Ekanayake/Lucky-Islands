import { useState } from 'react'

import { isMuted, setMuted } from '../../audio/sfx'
import { runtime } from '../../game/runtime'
import { switchLobby } from '../../net/connection'
import { useGame } from '../../store/game'
import { QUALITY_LEVELS, useQuality } from '../../store/quality'
import { u } from '../format'
import { Button } from '../kit'

/** Settings (graphics, sound, controls) and the bots-only private room. */

/** What each graphics level means, for the settings buttons. */
const GRAPHICS = {
  LOW: { label: 'LOW', color: '#3a8f5c', blurb: 'Fastest. Short view, no particles. Best for phones.' },
  MEDIUM: { label: 'MID', color: '#3a6fd8', blurb: 'Particles, glowing lava, more clouds, smoother edges.' },
  HIGH: { label: 'HIGH', color: '#a24ad8', blurb: 'Farthest view and sharpest picture. Strong PCs.' },
}

/** Playing just with bots: a private room of your own (online), or how offline works. */
export function BotsPanel() {
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

export function SettingsPanel() {
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
