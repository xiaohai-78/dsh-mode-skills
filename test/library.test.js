import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { isDeepStrictEqual } from 'node:util'

// Every skill folder this file touches lives under one temporary home.
const home = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-library-'))
process.env.DSH_HOME = join(home, '.dsh')
process.env.DSH_AGENTS_HOME = join(home, '.agents')
process.env.CODEX_HOME = join(home, '.codex')
process.env.CLAUDE_CONFIG_DIR = join(home, '.claude')
const { apply } = await import('../index.js')

const persona = { id: 'persona', name: '@deepseek-ai/dsh-persona' }

/** Mount the host on a fake DSH with two modes that load skills; catalogs list nothing, as before a watcher runs. */
async function mount(services = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-profile-'))
  const routes = []
  const entries = ['standard', 'ptc'].map(id => ({ entry: { options: { id: `preset-${id}`, name: '@deepseek-ai/dsh-agent-preset', config: { id, plugins: [persona] } } }, inherited: { id, plugins: [persona] } }))
  apply({
    configEditor: {
      documentPath: join(dir, 'cordis.patch.yml'),
      configuration: () => entries.map(({ entry, inherited }) => ({ entry, inherited, override: isDeepStrictEqual(entry.options.config, inherited) ? {} : { config: entry.options.config } })),
      edit: async (entry, change) => { entry.options.config = change(structuredClone(entry.options.config), structuredClone(entries.find(item => item.entry === entry).inherited)) },
    },
    agentPresets: { defaultId: 'standard', list: async () => [{ id: 'standard' }, { id: 'ptc' }], acquireScope: async id => ({ key: id, [Symbol.asyncDispose]: async () => {} }) },
    provide() {},
    get: name => (name === 'skills' ? { snapshot: async () => ({ skills: [] }) } : name === 'tools' ? { schemas: () => [{ name: 'skill' }] } : services[name]),
    inject: (_names, callback) => callback({ effect: effect => effect(), connection: { fetch: { register: route => routes.push(route) } } }),
    logger: { warn: () => {} },
  })
  const call = async (action, payload = {}) => (await (await routes[0].fetch({ json: async () => ({ action, ...payload }) })).json())
  const value = async (action, payload) => {
    const body = await call(action, payload)
    assert.equal(body.ok, true, JSON.stringify(body))
    return body.value
  }
  return { call, value, entries }
}

test('creates a skill, keeps it on only in the chosen modes, and lists it before any mode reports it', async () => {
  const { value, call, entries } = await mount()
  const created = await value('createSkill', { name: 'weekly-report', description: 'Write the weekly report', modes: ['standard'] })
  assert.deepEqual(created, { name: 'weekly-report', failed: [], mounted: ['ptc'] })
  const file = join(home, '.dsh', 'skills', 'weekly-report', 'SKILL.md')
  assert.match(await readFile(file, 'utf8'), /^---\nname: weekly-report\ndescription: "Write the weekly report"\n---/)
  assert.deepEqual(entries[1].entry.options.config.plugins.map(row => row.id), ['persona', 'dsh-mode-skills-policy'], 'turned off in ptc')
  const listed = (await value('list')).skills.find(skill => skill.name === 'weekly-report')
  assert.equal(listed.editable, true)
  assert.deepEqual(listed.versions, [])
  assert.equal((await call('createSkill', { name: 'weekly-report', description: 'Again' })).code, 'skill-exists')
  assert.equal((await call('createSkill', { name: 'Bad Name', description: 'x' })).code, 'skill-name-invalid')
  assert.equal((await call('createSkill', { name: 'two-lines', description: 'a\nb' })).code, 'skill-description-invalid')
})

test('edits a skill file after saving it as a version, refuses an edit made over another, and restores and deletes versions', async () => {
  const { value, call } = await mount()
  await value('createSkill', { name: 'release-notes', description: 'Write release notes' })
  const { text } = await value('readSkillFile', { skill: 'release-notes' })
  const edited = `${text}\nGroup changes by area.\n`
  assert.deepEqual(await value('writeSkillFile', { skill: 'release-notes', text: edited, base: text }), { changed: true, backup: 'v1' })
  const conflict = await call('writeSkillFile', { skill: 'release-notes', text: `${text}\nOther edit\n`, base: text })
  assert.equal(conflict.code, 'skill-conflict')
  assert.equal(conflict.details.current, edited)

  assert.deepEqual(await value('saveSkillVersion', { skill: 'release-notes', note: 'reviewed' }), { version: 'v2' })
  assert.equal((await value('readSkillVersion', { skill: 'release-notes', version: 'v1' })).text, text)
  assert.deepEqual(await value('restoreSkillVersion', { skill: 'release-notes', version: 'v1' }), { backup: 'v3' })
  assert.equal(await readFile(join(home, '.dsh', 'skills', 'release-notes', 'SKILL.md'), 'utf8'), text)
  await value('deleteSkillVersion', { skill: 'release-notes', version: 'v2' })
  const listed = (await value('list')).skills.find(skill => skill.name === 'release-notes')
  assert.deepEqual(listed.versions.map(version => [version.id, version.source, version.note]), [['v3', 'before-restore', undefined], ['v1', 'before-edit', undefined]])
  assert.deepEqual(await value('saveSkillVersion', { skill: 'release-notes' }), { version: 'v4' }, 'a deleted number is not given out again')
})

test('imports from Codex as a copy, flags a later change at the source, and imports it again over the copy', async () => {
  const source = join(home, '.codex', 'skills', 'explain-simply')
  await mkdir(source, { recursive: true })
  await writeFile(join(source, 'SKILL.md'), '---\nname: explain-simply\ndescription: Explain like I am five\n---\n\nUse short words.\n')
  const { value } = await mount()
  const codex = (await value('skillSources')).groups.find(group => group.source === 'codex')
  assert.deepEqual(codex.items.map(item => [item.name, item.status]), [['explain-simply', 'new']])

  const { results } = await value('importSkills', { items: [{ path: codex.items[0].path, source: 'codex' }] })
  assert.deepEqual(results.map(result => [result.name, result.status]), [['explain-simply', 'imported']])
  const copy = join(home, '.dsh', 'skills', 'explain-simply', 'SKILL.md')
  assert.match(await readFile(copy, 'utf8'), /Use short words/)
  let listed = (await value('list')).skills.find(skill => skill.name === 'explain-simply')
  assert.deepEqual([listed.imported.source, listed.imported.state], ['codex', 'same'])

  await writeFile(join(source, 'SKILL.md'), '---\nname: explain-simply\ndescription: Explain like I am five\n---\n\nUse short words and one example.\n')
  listed = (await value('list')).skills.find(skill => skill.name === 'explain-simply')
  assert.equal(listed.imported.state, 'changed')
  assert.equal((await value('skillSources')).groups.find(group => group.source === 'codex').items[0].status, 'updated')

  const again = await value('importSkills', { items: [{ path: codex.items[0].path, source: 'codex' }] })
  assert.deepEqual(again.results.map(result => [result.status, result.backup]), [['updated', 'v1']])
  assert.match(await readFile(copy, 'utf8'), /one example/)
})

test('leaves the library to dsh-modes while it is installed', async () => {
  const { call } = await mount({ dshModes: {} })
  for (const action of ['createSkill', 'readSkillFile', 'writeSkillFile', 'saveSkillVersion', 'restoreSkillVersion', 'deleteSkillVersion', 'readSkillVersion', 'skillSources', 'importSkills']) {
    assert.equal((await call(action, { skill: 'x' })).code, 'managed-by-modes', action)
  }
})
