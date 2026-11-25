import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'

import { ATTACK_COOLDOWN_MS, breakSeconds, EFFECTS, ITEMS, lavaHeight, MELEE_REACH, REACH } from '@shared/balance'
import { cellOverlapsBody, PLAYER, stepBody } from '@shared/physics'
import { B, BLOCKS, blockKey, raycastVoxels, rayBox } from '@shared/voxel'

import { materialOf, sfx } from '../audio/sfx'
import { send } from '../net/actions'
import { interpolateRemotes } from '../net/remotes'
import { getGame } from '../store/game'
import { blockOfItem } from './art/items'
import { installInput, wantsSprint } from './input'
import { pushFx, runtime } from './runtime'
import { lobbyLayout, setBlock, worldState } from './world'

/**
 * You: movement against the voxel world (the same physics as the bots on the server),
 * what the crosshair is on, breaking / placing / hitting / using items, and the camera
 * (first person, third person, or following someone while spectating).
 *
 * Everything here runs in the frame loop and writes only to `runtime` and the network -
 * never to React state.
 */

const PLACE_REPEAT_MS = 210
const SWING_SEND_MS = 300
const THROW_REPEAT_MS = 300
const BOW_FULL_MS = 900

const camTarget = new Vector3()
const camPos = new Vector3()
const lookDir = new Vector3()

function heldId() {
  const slot = runtime.me.inv?.[runtime.me.sel]
  return slot ? slot.id : 'fist'
}

function effect(name) {
  const left = runtime.me.effects?.[name]
  return left && performance.now() - runtime.me.effectsAt < left
}

/** Can we act in the round right now (not in the lobby, cages, dead or spectating)? */
function canAct() {
  return runtime.zone === 'match' && runtime.me.alive && getGame().phase.phase === 'fight' && worldState.kind === 'match'
}

export default function Player() {
  const camera = useThree((s) => s.camera)

  useEffect(() => installInput(), [])
  useEffect(() => {
    runtime.camera.mode = getGame().settings.camera === 'third' ? 'third' : 'first'
  }, [])
  useEffect(() => {
    camera.rotation.order = 'YXZ'
  }, [camera])

  // Local edge-detection state for the mouse buttons.
  const state = useStateRef()

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt)
    const now = performance.now()
    const p = runtime.player
    const input = runtime.input
    const game = getGame()
    const world = worldState.world
    interpolateRemotes(dt)
    if (!world) return

    // Look.
    p.yaw -= input.lookX
    p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - input.lookY))
    input.lookX = 0
    input.lookY = 0

    const spectating = runtime.zone === 'spec'
    const frozen = Boolean(game.panel) || Boolean(game.caseOpen)
    const b = p.body

    if (!spectating) {
      // Movement.
      const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0) + input.joyY
      const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX
      const fx = -Math.sin(p.yaw)
      const fz = -Math.cos(p.yaw)
      const rx = Math.cos(p.yaw)
      const rz = -Math.sin(p.yaw)
      let mx = frozen ? 0 : fx * fwd + rx * strafe
      let mz = frozen ? 0 : fz * fwd + rz * strafe
      const len = Math.hypot(mx, mz)
      if (len > 1) {
        mx /= len
        mz /= len
      }
      const sneak = !frozen && (input.sneak || input.sneakToggle)
      // Holding blocks in a round: you never walk off an edge by accident (jumping
      // still can) - so bridging doesn't need Shift.
      const heldKind = ITEMS[heldId()]?.kind
      const guard = runtime.zone === 'match' && (heldKind === 'block' || heldKind === 'tnt') && !input.jump
      const sprint = !frozen && !sneak && fwd > 0.5 && (wantsSprint() || Math.hypot(input.joyX, input.joyY) > 0.95)
      const wasGround = b.onGround
      const fallSpeed = b.vy
      stepBody(
        world,
        b,
        { moveX: mx, moveZ: mz, jump: !frozen && input.jump, sneak, sprint, guard, autoJump: input.touch },
        dt,
        effect('speed') ? EFFECTS.speed.speedMul : 1,
        effect('jump') ? EFFECTS.jump.jumpMul : 1,
      )
      p.sneaking = sneak
      p.sprinting = sprint && len > 0.1
      p.grounded = b.onGround
      const moving = Math.hypot(b.vx, b.vz)
      p.speed = moving
      if (b.onGround && moving > 0.5) {
        const before = p.walkPhase
        p.walkPhase += moving * dt * 2.4
        if (Math.floor(before / Math.PI) !== Math.floor(p.walkPhase / Math.PI)) sfx.step(sneak ? 0.4 : 1, materialOf(world.get(b.x, b.y - 0.1, b.z)))
      }
      if (!wasGround && b.onGround && fallSpeed < -6) {
        // The camera (and the hand) dips with the impact.
        runtime.camera.landAt = performance.now()
        runtime.camera.landAmp = Math.min(1, (-fallSpeed - 4) / 18)
        if (fallSpeed < -9) sfx.land()
      }
      p.anim = !b.onGround ? 4 : sneak ? 3 : moving > 0.5 ? (p.sprinting ? 2 : 1) : 0
      runtime.camera.fovKick += ((p.sprinting ? 1 : 0) - runtime.camera.fovKick) * Math.min(1, dt * 8)

      // Fell off the lobby: back to the spawn.
      if (runtime.zone === 'lobby' && b.y < -10) {
        const s = lobbyLayout().spawn
        b.x = s.x
        b.y = s.y
        b.z = s.z
        b.vx = b.vy = b.vz = 0
      }
    }

    // The lava's height this frame (the HUD and the lava mesh read it).
    if (runtime.lava.active) runtime.lava.y = lavaHeight(now - runtime.lava.fightStart, runtime.lava.mode)

    // What the crosshair is on, and acting on it.
    const eyeY = b.y + PLAYER.eye - (p.sneaking ? 0.18 : 0)
    const cp = Math.cos(p.pitch)
    const dx = -Math.sin(p.yaw) * cp
    const dy = Math.sin(p.pitch)
    const dz = -Math.cos(p.yaw) * cp
    const target = runtime.target
    target.kind = null
    if (!spectating && runtime.zone === 'match') {
      aim(world, b.x, eyeY, b.z, dx, dy, dz, target)
      findPlacement(world, b, eyeY, dx, dy, dz)
      if (!frozen) act(state, world, now, dt, b, eyeY, dx, dy, dz)
    } else {
      runtime.dig.progress = 0
      runtime.place.ok = false
      // In the lobby your sword is just for show: a click swings it (others see it).
      const st = state
      if (runtime.zone === 'lobby' && !frozen && input.attack && !st.attackWas && now - runtime.swingAt > 280) {
        runtime.swingAt = now
        sfx.swing()
        send('swing')
      }
      st.attackWas = input.attack
    }

    placeCamera(camera, game, b, eyeY, dt, now)
  }, -1)

  return null
}

/** A small mutable bag that survives re-renders (no React state in the frame loop). */
function useStateRef() {
  return stateBag
}
const stateBag = { attackWas: false, useWas: false, placeAt: 0, swingSentAt: 0, throwAt: 0, digSoundAt: 0, digCooldownUntil: 0 }

function aim(world, ex, ey, ez, dx, dy, dz, target) {
  const hit = raycastVoxels(world, ex, ey, ez, dx, dy, dz, REACH, (id) => id !== B.AIR)
  let best = hit ? hit.dist : Infinity
  if (hit) {
    target.kind = 'block'
    target.x = hit.x
    target.y = hit.y
    target.z = hit.z
    target.nx = hit.nx
    target.ny = hit.ny
    target.nz = hit.nz
    target.id = hit.id
    target.dist = hit.dist
  }
  for (const r of runtime.remotes.values()) {
    // Teammates aren't targets: your swing goes through to the block behind them.
    if (runtime.teamSize > 1 && r.team === runtime.myTeam) continue
    const t = rayBox(ex, ey, ez, dx, dy, dz, r.x - 0.35, r.y, r.z - 0.35, r.x + 0.35, r.y + PLAYER.height, r.z + 0.35)
    if (t >= 0 && t <= MELEE_REACH + 0.2 && t < best) {
      best = t
      target.kind = 'ent'
      target.eid = r.eid
      target.dist = t
    }
  }
}

/** Can a block go in cell (x, y, z) right now (free, touching a block, not in anyone)? */
function placeable(world, b, x, y, z) {
  if (!world.inBounds(x, y, z) || y < 1 || y >= world.sy - 1) return false
  const here = world.get(x, y, z)
  if (here !== B.AIR && BLOCKS[here].render !== 'cross') return false
  const touching =
    world.isSolid(x + 1, y, z) || world.isSolid(x - 1, y, z) || world.isSolid(x, y + 1, z) || world.isSolid(x, y - 1, z) || world.isSolid(x, y, z + 1) || world.isSolid(x, y, z - 1)
  if (!touching) return false
  if (cellOverlapsBody(x, y, z, b.x, b.y, b.z, PLAYER.halfW - 0.02, PLAYER.height - 0.02)) return false
  for (const r of runtime.remotes.values()) if (cellOverlapsBody(x, y, z, r.x, r.y, r.z, 0.28, 1.75)) return false
  return true
}

/**
 * Where a block would go if you placed one now (`runtime.place`, also drawn as the
 * white preview box): against the face you're aiming at, as usual - or, when you aim
 * past an edge at nothing (over the lava), the free cell in the row under your feet
 * that is closest to where you're looking. That second rule is what makes bridging
 * easy: look ahead and down past the edge, click, walk on, click.
 */
function findPlacement(world, b, eyeY, dx, dy, dz) {
  const pl = runtime.place
  pl.ok = false
  const kind = ITEMS[heldId()]?.kind
  if (kind !== 'block' && kind !== 'tnt') return
  const t = runtime.target
  const fy = Math.floor(b.y - 0.01) - 1
  if (t.kind === 'ent') return
  if (t.kind === 'block') {
    const x = t.x + t.nx
    const y = t.y + t.ny
    const z = t.z + t.nz
    const ok = placeable(world, b, x, y, z)
    // Aiming at a wall or a block above the floor: the face rule, as always.
    if (t.ny !== 1 || t.y > fy) {
      if (ok) {
        pl.x = x
        pl.y = y
        pl.z = z
        pl.ok = true
      }
      return
    }
    // Aiming down at the floor near an edge: extending the bridge beats stacking a
    // block on the floor in front of you - but stack if there's no edge to extend.
    bridgeRow(world, b, eyeY, dx, dy, dz, fy)
    if (!pl.ok && ok) {
      pl.x = x
      pl.y = y
      pl.z = z
      pl.ok = true
    }
    return
  }
  bridgeRow(world, b, eyeY, dx, dy, dz, fy)
}

/** The free, buildable cell in the row under your feet closest to your aim (see above). */
function bridgeRow(world, b, eyeY, dx, dy, dz, fy) {
  const pl = runtime.place
  const bx = Math.floor(b.x)
  const bz = Math.floor(b.z)
  let best = 0.82
  for (let ox = -3; ox <= 3; ox += 1) {
    for (let oz = -3; oz <= 3; oz += 1) {
      for (const y of [fy, fy + 1]) {
        const x = bx + ox
        const z = bz + oz
        const cx = x + 0.5 - b.x
        const cy = y + 0.5 - eyeY
        const cz = z + 0.5 - b.z
        const d = Math.hypot(cx, cy, cz)
        if (d > REACH + 0.5 || d < 0.01) continue
        const cos = (cx * dx + cy * dy + cz * dz) / d
        // The raised row only counts when it's what you're looking straight at.
        if (cos <= best || (y > fy && cos < 0.95)) continue
        if (!placeable(world, b, x, y, z)) continue
        best = cos
        pl.x = x
        pl.y = y
        pl.z = z
        pl.ok = true
      }
    }
  }
}

function act(st, world, now, dt, b, eyeY, dx, dy, dz) {
  const input = runtime.input
  const target = runtime.target
  const fight = canAct()
  const held = heldId()
  const item = ITEMS[held] || ITEMS.fist
  const attackEdge = input.attack && !st.attackWas
  const useEdge = input.use && !st.useWas
  const useRelease = !input.use && st.useWas
  st.attackWas = input.attack
  st.useWas = input.use
  const dig = runtime.dig

  // --- Left button: hit, or break.
  if (input.attack && fight) {
    if (target.kind === 'ent') {
      dig.progress = 0
      if (now - runtime.attackAt >= ATTACK_COOLDOWN_MS) {
        runtime.attackAt = now
        runtime.swingAt = now
        sfx.swing()
        send('attack', { eid: target.eid })
      }
    } else if (target.kind === 'block' && now > st.digCooldownUntil) {
      const def = BLOCKS[target.id]
      const key = blockKey(target.x, target.y, target.z)
      if (Number.isFinite(def.hard)) {
        if (dig.key !== key) {
          dig.key = key
          dig.x = target.x
          dig.y = target.y
          dig.z = target.z
          dig.progress = 0
          send('dig', { x: target.x, y: target.y, z: target.z })
        }
        const need = Math.max(0.05, breakSeconds(def.hard, held))
        dig.progress += dt / need
        if (now - runtime.swingAt > 250) runtime.swingAt = now
        if (now - st.digSoundAt > 200) {
          st.digSoundAt = now
          sfx.dig()
        }
        if (dig.progress >= 1) {
          // Our guess: gone now; the host confirms (or puts it back).
          const id = target.id
          setBlock(target.x, target.y, target.z, B.AIR)
          if (BLOCKS[world.get(target.x, target.y + 1, target.z)]?.render === 'cross') setBlock(target.x, target.y + 1, target.z, B.AIR)
          pushFx({ type: 'break', x: target.x, y: target.y, z: target.z, id })
          sfx.breakBlock(1, materialOf(id))
          send('break', { x: target.x, y: target.y, z: target.z })
          dig.key = -1
          dig.progress = 0
          st.digCooldownUntil = now + 120
        }
      } else {
        dig.progress = 0
      }
    } else if (attackEdge) {
      runtime.swingAt = now
      sfx.swing()
    }
    if (now - st.swingSentAt > SWING_SEND_MS && now - runtime.swingAt < 50) {
      st.swingSentAt = now
      if (target.kind !== 'ent') send('swing')
    }
  } else {
    dig.progress = 0
    dig.key = -1
  }

  if (!fight) return

  // --- Right button: place, eat, drink, throw, draw the bow.
  if (item.kind === 'block' || item.kind === 'tnt') {
    const pl = runtime.place
    if (input.use && pl.ok && (useEdge || now - st.placeAt > PLACE_REPEAT_MS)) {
      st.placeAt = now
      runtime.swingAt = now
      setBlock(pl.x, pl.y, pl.z, blockOfItem(held))
      pushFx({ type: 'place', x: pl.x, y: pl.y, z: pl.z, id: blockOfItem(held) })
      sfx.place(materialOf(blockOfItem(held)))
      send('place', { x: pl.x, y: pl.y, z: pl.z })
    }
  } else if (item.kind === 'food' || item.kind === 'potion' || item.kind === 'heart') {
    if (useEdge) send('use', {})
  } else if (item.kind === 'throw') {
    if (input.use && now - st.throwAt > THROW_REPEAT_MS) {
      st.throwAt = now
      runtime.swingAt = now
      send('use', { dir: [dx, dy, dz] })
    }
  } else if (item.kind === 'bow') {
    if (useEdge) runtime.bowPullAt = now
    if (useRelease && runtime.bowPullAt) {
      const charge = Math.min(1, (now - runtime.bowPullAt) / BOW_FULL_MS)
      runtime.bowPullAt = 0
      if (charge > 0.12) send('use', { dir: [dx, dy, dz], charge })
    }
  }
  if (!input.use && item.kind !== 'bow') runtime.bowPullAt = 0
}

function placeCamera(camera, game, b, eyeY, dt, now) {
  const p = runtime.player
  const cam = runtime.camera
  const world = worldState.world
  cam.shake = Math.max(0, cam.shake - dt * 2.2)
  cam.hurtTilt = Math.max(0, cam.hurtTilt - dt * 4)
  const shakeX = cam.shake ? (Math.random() - 0.5) * cam.shake * 0.3 : 0
  const shakeY = cam.shake ? (Math.random() - 0.5) * cam.shake * 0.3 : 0

  // `?debug` tooling: a fixed camera (`runtime.debugCam = { pos: [x,y,z], target: [x,y,z] }`).
  if (runtime.debugCam) {
    camera.position.set(...runtime.debugCam.pos)
    camera.lookAt(...runtime.debugCam.target)
    return
  }

  const fov = game.settings.fov + cam.fovKick * 8 + (runtime.bowPullAt ? -Math.min(1, (now - runtime.bowPullAt) / BOW_FULL_MS) * 10 : 0)
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 10)
    camera.updateProjectionMatrix()
  }

  if (runtime.zone === 'spec') {
    // Follow someone still in the round.
    let t = runtime.remotes.get(runtime.spectate.eid)
    if (!t) {
      t = runtime.remotes.values().next().value
      runtime.spectate.eid = t?.eid || 0
    }
    if (t) {
      camTarget.set(t.x, t.y + 1.5, t.z)
      lookDir.set(Math.sin(p.yaw) * Math.cos(p.pitch), -Math.sin(p.pitch), Math.cos(p.yaw) * Math.cos(p.pitch))
      camPos.copy(camTarget).addScaledVector(lookDir, 5.5)
      const hit = raycastVoxels(world, camTarget.x, camTarget.y, camTarget.z, lookDir.x, lookDir.y, lookDir.z, 5.5, (id) => BLOCKS[id]?.render === 'solid')
      if (hit) camPos.copy(camTarget).addScaledVector(lookDir, Math.max(0.6, hit.dist - 0.3))
      if (runtime.snap) camera.position.copy(camPos)
      else camera.position.lerp(camPos, Math.min(1, dt * 10))
      camera.lookAt(camTarget)
    } else {
      // Nobody left to watch: hover over the middle.
      camera.position.set(56, 50, 80)
      camera.lookAt(56, 30, 56)
    }
    runtime.snap = false
    return
  }

  const landT = (now - cam.landAt) / 260
  const dip = landT >= 0 && landT < 1 ? Math.sin(landT * Math.PI) * (1 - landT) * cam.landAmp * 0.32 : 0
  const bob = (p.grounded && cam.mode === 'first' ? Math.sin(p.walkPhase * 2) * Math.min(1, p.speed / 5) * 0.045 : 0) - dip
  if (cam.mode === 'first' && runtime.zone !== 'lobby') {
    camera.position.set(b.x + shakeX, eyeY + bob + shakeY, b.z)
    camera.rotation.set(p.pitch, p.yaw, Math.sin(cam.hurtTilt * Math.PI) * 0.08)
  } else {
    // Third person: behind and a little above, pulled in when a wall is in the way.
    camTarget.set(b.x, eyeY + 0.1, b.z)
    lookDir.set(Math.sin(p.yaw) * Math.cos(p.pitch), -Math.sin(p.pitch), Math.cos(p.yaw) * Math.cos(p.pitch))
    const want = runtime.zone === 'lobby' ? 6 : 4.2
    const hit = raycastVoxels(world, camTarget.x, camTarget.y, camTarget.z, lookDir.x, lookDir.y, lookDir.z, want, (id) => BLOCKS[id]?.render === 'solid')
    const d = hit ? Math.max(0.5, hit.dist - 0.25) : want
    camPos.copy(camTarget).addScaledVector(lookDir, d)
    camera.position.set(camPos.x + shakeX, camPos.y + shakeY - dip * 0.5, camPos.z)
    camera.rotation.set(p.pitch, p.yaw, 0)
  }
  runtime.snap = false
}
