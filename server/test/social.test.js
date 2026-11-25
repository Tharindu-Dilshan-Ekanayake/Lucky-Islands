import assert from 'node:assert/strict'
import { test } from 'node:test'

import { QUICK_CHAT_MS } from '../../shared/balance.js'
import { GameHost } from '../../shared/host.js'
import { mulberry32 } from '../../shared/rng.js'

test('quick chat reaches everyone in your zone, one line at a time', () => {
  let t = 1_000_000
  const sent = []
  const host = new GameHost({ send: (cid, type, payload) => sent.push({ cid, type, payload }), now: () => t, random: mulberry32(5), log: () => {} })
  host.join('a', 'Ann')
  host.join('b', 'Bo')
  host.message('a', 'qc', { i: 0 })
  const lines = sent.filter((m) => m.type === 'qc')
  assert.deepEqual(lines.map((m) => m.cid).sort(), ['a', 'b'])
  assert.equal(lines[0].payload.name, 'Ann')
  assert.equal(lines[0].payload.i, 0)
  // Too soon, out of range, junk: nothing.
  host.message('a', 'qc', { i: 1 })
  host.message('b', 'qc', { i: 99 })
  host.message('b', 'qc', { i: 'x' })
  assert.equal(sent.filter((m) => m.type === 'qc').length, 2)
  t += QUICK_CHAT_MS
  host.message('a', 'qc', { i: 2 })
  assert.equal(sent.filter((m) => m.type === 'qc').length, 4)
})
