import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../policy.js'

/** Mount the row on a fake mode scope; `services` maps service names to values. */
function mount(services) {
  let provider
  const warnings = []
  const invalidations = []
  const abort = new AbortController()
  apply({
    skills: { registerProvider: (factory) => { provider = factory({ invalidate: () => invalidations.push(1), signal: abort.signal }); return () => {} } },
    effect: effect => effect(),
    get: name => services[name],
    logger: { warn: text => warnings.push(text) },
  }, { preset: 'standard' })
  return { provider, warnings, invalidations, abort }
}

test('lists an entry nobody may invoke for each skill the mode turns off', async () => {
  const { provider } = mount({ dshModeSkills: { policyFor: async preset => ({ off: preset === 'standard' ? ['a', 'b'] : [], manual: [] }), watch: () => () => {} } })
  const entries = await provider.list()
  assert.deepEqual(entries.map(entry => [entry.name, entry.invocation, entry.rank, entry.provider]), [
    ['a', { modelInvocable: false, userInvocable: false }, -1000, 'dsh-mode-skills'],
    ['b', { modelInvocable: false, userInvocable: false }, -1000, 'dsh-mode-skills'],
  ])
  assert.equal(await provider.get(entries[0]), undefined)
})

test('lists nothing while dsh-modes is installed, or without the service', async () => {
  const service = { policyFor: async () => ({ off: ['a'], manual: [] }), watch: () => () => {} }
  assert.deepEqual(await mount({ dshModeSkills: service, dshModes: {} }).provider.list(), [])
  assert.deepEqual(await mount({}).provider.list(), [])
})

test('invalidates the catalog on every change and stops watching when the provider goes', async () => {
  const listeners = new Set()
  const { invalidations, abort } = mount({ dshModeSkills: { policyFor: async () => ({ off: [], manual: [] }), watch: (listener) => { listeners.add(listener); return () => listeners.delete(listener) } } })
  for (const listener of listeners) listener()
  assert.equal(invalidations.length, 1)
  abort.abort()
  assert.equal(listeners.size, 0)
})

test('reports a failed read once and lists nothing', async () => {
  const { provider, warnings } = mount({ dshModeSkills: { policyFor: async () => { throw new Error('damaged') }, watch: () => () => {} } })
  assert.deepEqual(await provider.list(), [])
  assert.deepEqual(await provider.list(), [])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /standard.*damaged/)
})

test('lists a manual-only skill for the user only, and loads its current file when the user starts it', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-policy-')), 'notes')
  await mkdir(dir)
  const path = join(dir, 'SKILL.md')
  await writeFile(path, '---\nname: notes\ndescription: Take notes\nwhenToUse: In meetings\n---\n\n# Notes\nWrite them down.\n')
  const { provider } = mount({ dshModeSkills: { policyFor: async () => ({ off: ['x'], manual: [{ name: 'notes', path, description: 'Take notes', whenToUse: 'In meetings' }] }), watch: () => () => {} } })
  const entries = await provider.list()
  const manual = entries.find(entry => entry.name === 'notes')
  assert.deepEqual([manual.invocation, manual.rank, manual.path, manual.resourceBase], [{ modelInvocable: false, userInvocable: true }, -1000, path, { kind: 'directory', path: dir }])
  await writeFile(path, '---\nname: notes\ndescription: Take better notes\n---\n\n# Notes\nWrite them down now.\n')
  const loaded = await provider.get(manual)
  assert.deepEqual([loaded.description, loaded.content, loaded.invocation.modelInvocable], ['Take better notes', '# Notes\nWrite them down now.', false])
  assert.equal(await provider.get(entries.find(entry => entry.name === 'x')), undefined, 'an entry that turns a skill off has nothing to load')
})

test('lists a model-only skill for the model alone, and loads its current file', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-policy-')), 'helper')
  await mkdir(dir)
  const path = join(dir, 'SKILL.md')
  await writeFile(path, '---\nname: helper\ndescription: Helps the model\n---\n\nSteps.\n')
  const { provider } = mount({ dshModeSkills: { policyFor: async () => ({ off: [], manual: [], model: [{ name: 'helper', path, description: 'Helps the model' }] }), watch: () => () => {} } })
  const [entry] = await provider.list()
  assert.deepEqual([entry.invocation, entry.rank], [{ modelInvocable: true, userInvocable: false }, -1000])
  const loaded = await provider.get(entry)
  assert.deepEqual([loaded.content, loaded.invocation], ['Steps.', { modelInvocable: true, userInvocable: false }])
})
