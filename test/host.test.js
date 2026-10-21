import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { isDeepStrictEqual } from 'node:util'
import { apply } from '../index.js'
import { POLICY_MODULE, POLICY_ROW_ID, WHEN_GONE } from '../mode-rows.js'

const persona = { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: 'Hi' } }
const skillTool = { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' }
const policyRow = preset => ({ id: POLICY_ROW_ID, name: POLICY_MODULE, config: { preset }, disabled: { __jsExpr: WHEN_GONE } })

/**
 * A config editor like DSH's: `edit` saves the whole config as the override, and drops the override when the result
 * equals the inherited config.
 */
function configEditor(dir, declared) {
  const entries = Object.entries(declared).map(([id, rows]) => ({
    entry: { options: { id: `preset-${id}`, name: '@deepseek-ai/dsh-agent-preset', config: { id, plugins: structuredClone(rows.current ?? rows.builtIn) } } },
    inherited: { id, plugins: rows.builtIn },
  }))
  const edits = []
  return {
    edits,
    documentPath: join(dir, 'cordis.patch.yml'),
    configuration: () => entries.map(({ entry, inherited }) => ({ entry, inherited, override: isDeepStrictEqual(entry.options.config, inherited) ? {} : { config: entry.options.config } })),
    edit: async (entry, change) => {
      const { inherited } = entries.find(item => item.entry === entry)
      const next = change(structuredClone(entry.options.config), structuredClone(inherited))
      entry.options.config = isDeepStrictEqual(next, inherited) ? structuredClone(inherited) : next
      edits.push({ id: entry.options.config.id, overridden: !isDeepStrictEqual(next, inherited), plugins: entry.options.config.plugins })
    },
    rowsOf: id => entries.find(item => item.inherited.id === id).entry.options.config.plugins,
  }
}

/** Mount the host plugin on a fake context; returns a caller for the route and the fakes. */
async function mount({ roster, catalogs, declared = {}, services = {}, registry = true }) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-host-'))
  const routes = []
  const provided = {}
  const warnings = []
  const leases = { open: 0, acquired: [] }
  const editor = configEditor(dir, declared)
  const ctx = {
    configEditor: editor,
    agentPresets: {
      defaultId: 'standard',
      list: async () => roster,
      acquireScope: async (id) => {
        leases.acquired.push(id)
        if (catalogs[id] instanceof Error) throw catalogs[id]
        leases.open++
        return { key: `scope:${id}`, [Symbol.asyncDispose]: async () => { leases.open-- } }
      },
    },
    provide: (name, value) => { provided[name] = value },
    get: (name) => {
      if (name === 'skills') return registry ? { snapshot: async ({ scope }) => ({ skills: catalogs[scope.slice('scope:'.length)] }) } : undefined
      if (name === 'tools') return { schemas: key => (key === 'scope:minimal' ? [] : [{ name: 'skill' }]) }
      return services[name]
    },
    inject: (_names, callback) => callback({ effect: effect => effect(), connection: { fetch: { register: route => routes.push(route) } } }),
    logger: { warn: text => warnings.push(text) },
  }
  apply(ctx)
  await new Promise(resolve => setImmediate(resolve))
  const call = async (body) => {
    const response = await routes[0].fetch({ json: async () => body })
    return response.json()
  }
  const state = async () => JSON.parse(await readFile(join(dir, '.dsh-mode-skills', 'state.json'), 'utf8'))
  return { call, leases, editor, provided, warnings, state }
}

const skill = (name, extra = {}) => ({ name, description: `${name} text`, path: `/s/${name}/SKILL.md`, source: 'user-dsh', provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: true }, ...extra })

test('lists modes and skills, releasing every scope it mounts', async () => {
  const { call, leases } = await mount({
    roster: [{ id: 'standard' }, { id: 'research', name: 'Research' }, { id: 'minimal' }],
    catalogs: { standard: [skill('a'), skill('b')], research: [skill('a')], minimal: [] },
    declared: { standard: { builtIn: [persona, skillTool] }, minimal: { builtIn: [persona] } },
  })
  const body = await call({ action: 'list' })
  assert.equal(body.ok, true)
  assert.deepEqual(body.value.modes.map(({ catalog: _catalog, ...mode }) => mode), [
    { id: 'standard', isDefault: true, editable: true, hasSkillTool: true, off: [], manual: [], model: [] },
    { id: 'research', name: 'Research', editable: false, hasSkillTool: true, off: [], manual: [], model: [] },
    { id: 'minimal', editable: true, hasSkillTool: false, off: [], manual: [], model: [] },
  ])
  assert.deepEqual(body.value.modes.map(mode => mode.catalog?.skills), [2, 1, undefined], 'only modes with the skill tool carry a catalog')
  assert.ok(body.value.modes[0].catalog.tokens > body.value.modes[1].catalog.tokens)
  assert.ok(body.value.skills.every(entry => entry.tokens > 0))
  assert.deepEqual(body.value.skills.map(entry => [entry.name, entry.modes]), [['a', { standard: 'on', research: 'on' }], ['b', { standard: 'on' }]])
  assert.equal(body.value.manager, 'self')
  assert.equal(leases.open, 0)
})

test('reuses a scan until the page asks for a refresh', async () => {
  const { call, leases } = await mount({ roster: [{ id: 'standard' }], catalogs: { standard: [skill('a')] } })
  await call({ action: 'list' })
  await call({ action: 'list' })
  assert.deepEqual(leases.acquired, ['standard'])
  await call({ action: 'list', refresh: true })
  assert.deepEqual(leases.acquired, ['standard', 'standard'])
})

test('reports a broken mode and a mode whose scope fails, and scans a failed mode again next time', async () => {
  const { call, leases } = await mount({
    roster: [{ id: 'standard' }, { id: 'ptc', broken: 'row x failed' }, { id: 'minimal' }],
    catalogs: { standard: [skill('a')], minimal: new Error('cannot mount') },
  })
  const body = await call({ action: 'list' })
  assert.deepEqual(body.value.errors, { ptc: 'row x failed', minimal: 'cannot mount' })
  await call({ action: 'list' })
  assert.deepEqual(leases.acquired, ['standard', 'minimal', 'minimal'])
})

test('turning a skill off adds the guarded row to the mode; turning the last one on removes the row and the override', async () => {
  const { call, editor, provided, state } = await mount({
    roster: [{ id: 'standard' }],
    catalogs: { standard: [skill('a'), skill('b')] },
    declared: { standard: { builtIn: [persona, skillTool] } },
  })
  const changed = []
  provided.dshModeSkills.watch(() => changed.push(1))
  const off = await call({ action: 'setModes', changes: [{ preset: 'standard', skill: 'a', enabled: false }, { preset: 'standard', skill: 'b', enabled: false }] })
  assert.deepEqual(off.value, { failed: [], mounted: ['standard'] })
  assert.deepEqual(editor.rowsOf('standard'), [persona, skillTool, policyRow('standard')])
  assert.deepEqual(await provided.dshModeSkills.policyFor('standard'), { off: ['a', 'b'], manual: [], model: [] })
  assert.deepEqual((await state()).presets.standard, { off: ['a', 'b'], base: [persona, skillTool] })
  assert.equal(changed.length, 1)

  const partly = await call({ action: 'setModes', changes: [{ preset: 'standard', skill: 'a', enabled: true }] })
  assert.deepEqual(partly.value, { failed: [], mounted: [] }, 'the row is already there')
  assert.equal(editor.edits.length, 1, 'nothing to rewrite')

  await call({ action: 'setModes', changes: [{ preset: 'standard', skill: 'b', enabled: true }] })
  assert.deepEqual(editor.rowsOf('standard'), [persona, skillTool])
  assert.equal(editor.edits.at(-1).overridden, false, 'the override goes away')
  assert.equal((await state()).presets.standard, undefined)
})

test('refuses while dsh-modes owns the settings, and for a mode it cannot change', async () => {
  const declared = { standard: { builtIn: [persona] } }
  const managed = await mount({ roster: [{ id: 'standard' }], catalogs: { standard: [] }, declared, services: { dshModes: {} } })
  assert.equal((await managed.call({ action: 'list' })).value.manager, 'dsh-modes')
  assert.equal((await managed.call({ action: 'setModes', changes: [{ preset: 'standard', skill: 'a', enabled: false }] })).code, 'managed-by-modes')
  const own = await mount({ roster: [{ id: 'research' }], catalogs: { research: [] }, declared })
  assert.equal((await own.call({ action: 'setModes', changes: [{ preset: 'research', skill: 'a', enabled: false }] })).code, 'not-editable')
  assert.equal((await own.call({ action: 'setModes', changes: [{ preset: 'standard', skill: 'Bad Name', enabled: false }] })).code, 'bad-request')
  assert.equal((await own.call({ action: 'setModes', changes: [] })).code, 'bad-request')
})

test('a skill turned off in every mode keeps the details it had when last seen', async () => {
  const catalogs = { standard: [skill('a', { whenToUse: 'Often' })] }
  const { call } = await mount({ roster: [{ id: 'standard' }], catalogs, declared: { standard: { builtIn: [persona, skillTool] } } })
  await call({ action: 'list' })
  catalogs.standard = [{ name: 'a', description: 'Turned off in this mode by Skill Manager.', source: 'dsh-mode-skills', provider: 'dsh-mode-skills', invocation: { modelInvocable: false, userInvocable: false } }]
  const [listed] = (await call({ action: 'list', refresh: true })).value.skills
  assert.deepEqual([listed.description, listed.whenToUse, listed.modes], ['a text', 'Often', { standard: 'off' }])
})

test('on start, gives the condition to a policy row saved without it', async () => {
  const unguarded = { id: POLICY_ROW_ID, name: POLICY_MODULE, config: { preset: 'standard' } }
  const { editor, warnings } = await mount({
    roster: [{ id: 'standard' }],
    catalogs: { standard: [] },
    declared: { standard: { builtIn: [persona], current: [persona, unguarded] }, ptc: { builtIn: [persona] } },
  })
  for (let tries = 0; tries < 200 && editor.edits.length === 0; tries++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(editor.edits.map(edit => edit.id), ['standard'])
  assert.deepEqual(editor.rowsOf('standard'), [persona, policyRow('standard')])
  assert.deepEqual(warnings, [])
})

test('refuses an unknown action', async () => {
  const { call } = await mount({ roster: [], catalogs: {} })
  assert.deepEqual(await call({ action: 'nope' }), { ok: false, code: 'bad-request', error: 'Unknown action: nope' })
})
