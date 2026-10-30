import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { isDeepStrictEqual } from 'node:util'

// A home with Claude Code, Codex, Cursor, and Gemini CLI installed.
const home = await realpath(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-scope-')))
process.env.HOME = home
process.env.USERPROFILE = home
process.env.DSH_HOME = join(home, '.dsh')
process.env.DSH_AGENTS_HOME = join(home, '.agents')
process.env.CODEX_HOME = join(home, '.codex')
process.env.CLAUDE_CONFIG_DIR = join(home, '.claude')
delete process.env.XDG_CONFIG_HOME
for (const dir of ['.claude', '.codex', '.cursor', '.gemini']) await mkdir(join(home, dir), { recursive: true })
const { apply } = await import('../index.js')

const dshDir = join(home, '.dsh', 'skills')
const sharedDir = join(home, '.agents', 'skills')
const claudeDir = join(home, '.claude', 'skills')
const cursorDir = join(home, '.cursor', 'skills')
const geminiDir = join(home, '.gemini', 'skills')
const STANDUP = '---\nname: standup\ndescription: Daily\n---\n\nBody\n'

async function writeSkill(dir, text, extra = {}) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), text)
  for (const [name, data] of Object.entries(extra)) {
    await mkdir(join(dir, name, '..'), { recursive: true })
    await writeFile(join(dir, name), data)
  }
}

const gone = path => lstat(path).then(() => false, () => true)

/** Mount the host on a fake DSH whose one mode lists the skill folders in the two user folders, `~/.dsh` first, as DSH does. */
async function mount() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-profile-'))
  const routes = []
  const persona = { id: 'persona', name: '@deepseek-ai/dsh-persona' }
  const entries = [{ entry: { options: { id: 'preset-standard', name: '@deepseek-ai/dsh-agent-preset', config: { id: 'standard', plugins: [persona] } } }, inherited: { id: 'standard', plugins: [persona] } }]
  const catalog = async () => {
    const found = new Map()
    for (const [root, source] of [[dshDir, 'user-dsh'], [sharedDir, 'user-agents']]) {
      for (const name of await readdir(root).catch(() => [])) {
        const path = join(root, name, 'SKILL.md')
        if (!found.has(name) && !(await gone(path))) found.set(name, { name, description: 'A skill', path, source, provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: true } })
      }
    }
    return [...found.values()]
  }
  apply({
    configEditor: {
      documentPath: join(dir, 'cordis.patch.yml'),
      configuration: () => entries.map(({ entry, inherited }) => ({ entry, inherited, override: isDeepStrictEqual(entry.options.config, inherited) ? {} : { config: entry.options.config } })),
      edit: async (entry, change) => { entry.options.config = change(structuredClone(entry.options.config), structuredClone(inherited)) },
    },
    agentPresets: { defaultId: 'standard', list: async () => [{ id: 'standard' }], acquireScope: async id => ({ key: id, [Symbol.asyncDispose]: async () => {} }) },
    provide: () => {},
    get: name => (name === 'skills' ? { snapshot: async () => ({ skills: await catalog() }) } : name === 'tools' ? { schemas: () => [{ name: 'skill' }] } : undefined),
    inject: (_names, callback) => callback({ effect: effect => effect(), connection: { fetch: { register: route => routes.push(route) } } }),
    logger: { warn: () => {} },
  })
  const call = async (action, payload = {}) => (await (await routes[0].fetch({ json: async () => ({ action, ...payload }) })).json())
  const value = async (action, payload) => {
    const body = await call(action, payload)
    assert.equal(body.ok, true, JSON.stringify(body))
    return body.value
  }
  const reach = async name => (await value('list', { refresh: true })).skills.find(skill => skill.name === name).reach
  return { call, value, reach }
}

test('gives a skill to every agent tool through one shared copy and links, then keeps it for DSH alone', async () => {
  await writeSkill(join(dshDir, 'standup'), STANDUP, { 'scripts/run.sh': '#!/bin/sh\n' })
  // Cursor holds a copy with the same files; Gemini CLI has a different skill of its own with that name.
  await writeSkill(join(cursorDir, 'standup'), STANDUP, { 'scripts/run.sh': '#!/bin/sh\n' })
  await writeSkill(join(geminiDir, 'standup'), '---\nname: standup\ndescription: Gemini own\n---\n')
  const { call, value, reach } = await mount()

  const listed = await value('list')
  assert.deepEqual(listed.agents.map(agent => [agent.id, agent.via]), [['claude-code', 'link'], ['codex', 'shared'], ['cursor', 'link'], ['gemini-cli', 'link']])
  assert.deepEqual(await reach('standup'), { scope: 'dsh', agents: { 'claude-code': 'missing', codex: 'missing', cursor: 'same', 'gemini-cli': 'own' } })

  const [shared] = (await value('setScope', { skills: ['standup'], scope: 'all' })).results
  assert.deepEqual(shared, { skill: 'standup', status: 'done', moved: true, linked: ['claude-code'], replaced: ['cursor'], kept: ['gemini-cli'], failed: [] })
  assert.ok(await gone(join(dshDir, 'standup')))
  for (const dir of [claudeDir, cursorDir]) {
    assert.ok((await lstat(join(dir, 'standup'))).isSymbolicLink(), dir)
    assert.equal(await realpath(join(dir, 'standup')), join(sharedDir, 'standup'))
  }
  assert.match(await readFile(join(geminiDir, 'standup', 'SKILL.md'), 'utf8'), /Gemini own/, 'a different skill of its own is left alone')
  assert.deepEqual(await reach('standup'), { scope: 'all', agents: { 'claude-code': 'linked', codex: 'shared', cursor: 'linked', 'gemini-cli': 'own' } })
  assert.equal((await value('readSkillFile', { skill: 'standup' })).path, join(sharedDir, 'standup', 'SKILL.md'))
  assert.deepEqual((await value('list')).trash.map(entry => [entry.name, entry.display]), [['standup', join('~', '.cursor', 'skills', 'standup')]], 'the replaced copy can be restored')

  // A link to a skill DSH already reads is that skill in the import list.
  const claude = (await value('skillSources')).groups.find(group => group.source === 'claude')
  assert.deepEqual(claude.items.map(item => [item.name, item.status]), [['standup', 'mine']])

  const [kept] = (await value('setScope', { skills: ['standup'], scope: 'dsh' })).results
  assert.deepEqual(kept, { skill: 'standup', status: 'done', moved: true, unlinked: ['claude-code', 'cursor'], failed: [] })
  assert.ok(await gone(join(claudeDir, 'standup')))
  assert.ok(await gone(join(cursorDir, 'standup')))
  assert.ok(await gone(join(sharedDir, 'standup')))
  assert.match(await readFile(join(dshDir, 'standup', 'scripts', 'run.sh'), 'utf8'), /bin\/sh/)
  assert.deepEqual(await reach('standup'), { scope: 'dsh', agents: { 'claude-code': 'missing', codex: 'missing', cursor: 'missing', 'gemini-cli': 'own' } })

  await writeSkill(join(sharedDir, 'standup'), '---\nname: standup\ndescription: Another\n---\n')
  const [blocked] = (await value('setScope', { skills: ['standup'], scope: 'all' })).results
  assert.deepEqual([blocked.status, blocked.code, blocked.details], ['error', 'skill-exists-there', { name: 'standup', path: join('~', '.agents', 'skills', 'standup') }])
  assert.match(await readFile(join(dshDir, 'standup', 'SKILL.md'), 'utf8'), /Daily/, 'a refused skill stays where it was')
  assert.equal((await call('setScope', { skills: ['standup'], scope: 'everyone' })).code, 'bad-request')
})

test('links a shared skill into the tools that miss it, replaces links to nowhere, and follows delete and restore', async () => {
  await writeSkill(join(sharedDir, 'notes'), '---\nname: notes\ndescription: Notes\n---\n')
  await mkdir(claudeDir, { recursive: true })
  await symlink(join(home, 'nowhere'), join(claudeDir, 'notes'), process.platform === 'win32' ? 'junction' : undefined)
  const { value, reach } = await mount()
  assert.deepEqual((await reach('notes')).agents, { 'claude-code': 'missing', codex: 'shared', cursor: 'missing', 'gemini-cli': 'missing' })

  const [filled] = (await value('setScope', { skills: ['notes'], scope: 'all' })).results
  assert.deepEqual([filled.moved, filled.linked], [false, ['claude-code', 'cursor', 'gemini-cli']])
  assert.equal(await realpath(join(claudeDir, 'notes')), join(sharedDir, 'notes'), 'a link to nowhere is replaced')

  const { id } = await value('deleteSkill', { skill: 'notes' })
  for (const dir of [claudeDir, cursorDir, geminiDir]) assert.ok(await gone(join(dir, 'notes')), `${dir} keeps no link to a deleted skill`)
  await value('restoreTrash', { id })
  assert.deepEqual((await reach('notes')).agents, { 'claude-code': 'linked', codex: 'shared', cursor: 'linked', 'gemini-cli': 'linked' })
})

test('links a skill just put in the shared folder before the page has listed it', async () => {
  await writeSkill(join(sharedDir, 'fresh'), '---\nname: fresh\ndescription: Fresh\n---\n')
  const { value } = await mount()
  const [result] = (await value('setScope', { skills: ['fresh'], scope: 'all' })).results
  assert.deepEqual([result.status, result.moved, result.linked], ['done', false, ['claude-code', 'cursor', 'gemini-cli']])
})
