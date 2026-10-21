import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectUsage, scanEvents, summarizeUsage } from '../usage.js'

const call = (callId, name, time, tool = 'skill') => ({ type: 'tool/call', time, data: { callId, name: tool, arguments: JSON.stringify({ name }) } })
const result = (callId, time, isError = false) => ({ type: 'tool/result', time, data: { message: { role: 'tool', toolCallId: callId, isError } } })
const selected = (agentPreset, time) => ({ type: 'agent-preset/selected', time, data: { agentPreset } })
const invoked = (name, time) => ({ type: 'user/message', time, data: { source: { kind: 'skill-invocation', name, form: 'instructions' } } })

test('counts the skills the model loaded and the ones the user started, leaving out failures and other tools', () => {
  const uses = scanEvents([
    call('a', 'pdf', 10), result('a', 11),
    call('b', 'missing', 20), result('b', 21, true),
    call('c', 'pdf', 30),
    call('d', 'x', 40, 'bash'), result('d', 41),
    invoked('weekly-report', 50),
    { type: 'user/message', time: 60, data: { source: { kind: 'user' } } },
    { type: 'tool/call', time: 70, data: { callId: 'e', name: 'skill', arguments: 'not json' } },
  ], 'standard')
  assert.deepEqual(uses, [{ name: 'pdf', kind: 'model', at: 10, mode: 'standard' }, { name: 'weekly-report', kind: 'user', at: 50, mode: 'standard' }])
})

test('attributes each load to the mode the session ran under then, following mode changes in the log', () => {
  const uses = scanEvents([call('a', 'one', 1), result('a', 2), selected('ptc', 3), invoked('two', 4), call('b', 'three', 5), selected('minimal', 6), result('b', 7)], 'standard')
  assert.deepEqual(uses.map(use => [use.name, use.mode]), [['one', 'standard'], ['two', 'ptc'], ['three', 'ptc']], 'a call counts for the mode it was made in')
})

test('adds up loads per skill and per mode inside the window, keeping odd names as plain keys', () => {
  const sessions = [
    { id: 's1', uses: [{ name: 'pdf', kind: 'model', at: 100, mode: 'standard' }, { name: 'pdf', kind: 'user', at: 300, mode: 'standard' }, { name: 'old', kind: 'model', at: 5, mode: 'standard' }] },
    { id: 's2', uses: [{ name: 'pdf', kind: 'model', at: 200, mode: 'ptc' }, { name: '__proto__', kind: 'model', at: 150, mode: 'ptc' }] },
  ]
  const skills = summarizeUsage(sessions, 50)
  assert.deepEqual(Object.keys(skills).sort(), ['__proto__', 'pdf'])
  assert.deepEqual(skills.pdf, { model: 2, user: 1, firstAt: 100, lastAt: 300, modes: { standard: { model: 1, user: 1, lastAt: 300 }, ptc: { model: 1, user: 0, lastAt: 200 } } })
  assert.equal(Object.hasOwn(skills, 'old'), false)
})

/** A fake `sessionQuery` with some sessions: `{ id, createdAt, agentPreset?, live?, events }`. */
function fakeService(sessions, reads = []) {
  return {
    listSessions: async () => sessions.map(session => ({ header: { id: session.id, createdAt: session.createdAt, ...session.agentPreset === undefined ? {} : { agentPreset: session.agentPreset } }, live: session.live === true, persisted: true })),
    readSession: async (id) => {
      reads.push(id)
      const session = sessions.find(entry => entry.id === id)
      if (session.broken) throw new Error('corrupt')
      return { events: session.events }
    },
  }
}

test('reads the newest sessions into modes, treats a session without a preset as the default mode, and skips unreadable ones', async () => {
  const reads = []
  const service = fakeService([
    { id: 'old', createdAt: 1, events: [call('a', 'one', 1), result('a', 2)] },
    { id: 'mid', createdAt: 2, agentPreset: 'ptc', events: [invoked('two', 3)] },
    { id: 'bad', createdAt: 3, broken: true, events: [] },
    { id: 'new', createdAt: 4, events: [invoked('three', 4)] },
  ], reads)
  const collected = await collectUsage({ service, defaultMode: 'standard', maxSessions: 3 })
  assert.deepEqual(reads, ['new', 'bad', 'mid'], 'newest first, and only as many as the limit')
  assert.deepEqual(collected.sessions.map(session => [session.id, session.uses.map(use => use.mode)]).sort(), [['mid', ['ptc']], ['new', ['standard']]])
  assert.deepEqual([collected.total, collected.scanned, collected.failed, collected.truncated, collected.complete], [4, 2, 1, true, true])
})

test('reuses a saved session for ten minutes, always reads a live one, and returns what it has when time runs out', async () => {
  const reads = []
  const service = fakeService([{ id: 'saved', createdAt: 1, events: [invoked('a', 1)] }, { id: 'live', createdAt: 2, live: true, events: [invoked('b', 2)] }], reads)
  const cache = new Map()
  let clock = 0
  const now = () => clock
  await collectUsage({ service, defaultMode: 'standard', cache, now })
  await collectUsage({ service, defaultMode: 'standard', cache, now })
  assert.deepEqual(reads.sort(), ['live', 'live', 'saved'])
  clock += 11 * 60 * 1000
  await collectUsage({ service, defaultMode: 'standard', cache, now })
  assert.equal(reads.filter(id => id === 'saved').length, 2, 'the saved copy expired')
  await collectUsage({ service, defaultMode: 'standard', cache, now, force: true })
  assert.equal(reads.filter(id => id === 'saved').length, 3, 'a forced pass reads it again')
  const slow = await collectUsage({ service, defaultMode: 'standard', now: () => (clock += 30000), budgetMs: 1000 })
  assert.equal(slow.complete, false)
})
