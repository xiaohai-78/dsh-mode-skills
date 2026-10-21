import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { isDeepStrictEqual } from 'node:util'
import { readZip, writeZip } from '../zip.js'

// Every folder this file touches lives under one temporary home.
const home = await realpath(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-extras-')))
process.env.HOME = home
process.env.USERPROFILE = home
process.env.DSH_HOME = join(home, '.dsh')
process.env.DSH_AGENTS_HOME = join(home, '.agents')
process.env.CODEX_HOME = join(home, '.codex')
process.env.CLAUDE_CONFIG_DIR = join(home, '.claude')
const { apply } = await import('../index.js')

const persona = { id: 'persona', name: '@deepseek-ai/dsh-persona' }
const skillsDir = join(home, '.dsh', 'skills')
const agentsDir = join(home, '.agents', 'skills')

async function writeSkill(dir, text, extra = {}) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), text)
  for (const [name, data] of Object.entries(extra)) {
    await mkdir(join(dir, name, '..'), { recursive: true })
    await writeFile(join(dir, name), data)
  }
  return join(dir, 'SKILL.md')
}

/** Mount the host on a fake DSH whose catalogs come from `catalog(options)`, with the modes `standard` and `ptc`. */
async function mount(catalog = () => [], services = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-profile-'))
  const routes = []
  const provided = {}
  const snapshots = []
  const entries = ['standard', 'ptc'].map(id => ({ entry: { options: { id: `preset-${id}`, name: '@deepseek-ai/dsh-agent-preset', config: { id, plugins: [persona] } } }, inherited: { id, plugins: [persona] } }))
  apply({
    configEditor: {
      documentPath: join(dir, 'cordis.patch.yml'),
      configuration: () => entries.map(({ entry, inherited }) => ({ entry, inherited, override: isDeepStrictEqual(entry.options.config, inherited) ? {} : { config: entry.options.config } })),
      edit: async (entry, change) => { entry.options.config = change(structuredClone(entry.options.config), structuredClone(entries.find(item => item.entry === entry).inherited)) },
    },
    agentPresets: { defaultId: 'standard', list: async () => [{ id: 'standard' }, { id: 'ptc' }], acquireScope: async id => ({ key: id, [Symbol.asyncDispose]: async () => {} }) },
    provide: (name, value) => { provided[name] = value },
    get: name => (Object.hasOwn(services, name) ? services[name] : name === 'skills' ? { snapshot: async (options) => { snapshots.push(options); return { skills: catalog(options) } } } : name === 'tools' ? { schemas: () => [{ name: 'skill' }] } : undefined),
    inject: (_names, callback) => callback({ effect: effect => effect(), connection: { fetch: { register: route => routes.push(route) } } }),
    logger: { warn: () => {} },
  })
  const call = async (action, payload = {}) => (await (await routes[0].fetch({ json: async () => ({ action, ...payload }) })).json())
  const value = async (action, payload) => {
    const body = await call(action, payload)
    assert.equal(body.ok, true, JSON.stringify(body))
    return body.value
  }
  return { call, value, entries, provided, snapshots, store: join(dir, '.dsh-mode-skills') }
}

const entry = (name, path, description, source = 'user-dsh') => ({ name, description, path, source, provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: true } })

test('sets a skill to model only in one mode, and the policy row lists it for the model alone', async () => {
  const path = await writeSkill(join(skillsDir, 'model-only'), '---\nname: model-only\ndescription: Used by the model\n---\n\nBody\n')
  const { value, entries, provided } = await mount(() => [entry('model-only', path, 'Used by the model')])
  await value('list')
  await value('setModes', { changes: [{ preset: 'ptc', skill: 'model-only', state: 'model' }] })
  assert.deepEqual(entries[1].entry.options.config.plugins.map(row => row.id), ['persona', 'dsh-mode-skills-policy'])
  assert.deepEqual(await provided.dshModeSkills.policyFor('ptc'), { off: [], manual: [], model: [{ name: 'model-only', path, description: 'Used by the model' }] })
  assert.deepEqual((await value('list')).modes.map(mode => [mode.id, mode.model]), [['standard', []], ['ptc', ['model-only']]])
  await value('setModes', { changes: [{ preset: 'ptc', skill: 'model-only', state: 'manual' }] })
  assert.deepEqual(await provided.dshModeSkills.policyFor('ptc'), { off: [], manual: [{ name: 'model-only', path, description: 'Used by the model' }], model: [] }, 'one setting at a time')
})

test('keeps a display name and tags apart from the skill file, and lists them', async () => {
  const path = await writeSkill(join(skillsDir, 'weekly-report'), '---\nname: weekly-report\ndescription: Weekly report\n---\n')
  const { value, call } = await mount(() => [entry('weekly-report', path, 'Weekly report')])
  await value('list')
  await value('setMeta', { skill: 'weekly-report', alias: ' 周报 ', tags: ['工作', '工作', 'writing'] })
  const listed = (await value('list')).skills.find(skill => skill.name === 'weekly-report')
  assert.deepEqual([listed.alias, listed.tags], ['周报', ['工作', 'writing']])
  assert.match(await readFile(path, 'utf8'), /^---\nname: weekly-report/, 'the file is untouched')
  await value('setMeta', { skill: 'weekly-report', tags: [] })
  assert.equal((await value('list')).skills.find(skill => skill.name === 'weekly-report').tags, undefined)
  assert.equal((await value('list')).skills.find(skill => skill.name === 'weekly-report').alias, '周报', 'the display name stays through refreshes')
  assert.equal((await call('setMeta', { skill: 'weekly-report', alias: 'a'.repeat(41) })).code, 'alias-invalid')
  assert.equal((await call('setMeta', { skill: 'weekly-report', tags: ['a,b'] })).code, 'tags-invalid')
  assert.equal((await call('setMeta', { skill: 'weekly-report', tags: Array.from({ length: 9 }, (_, index) => `t${index}`) })).code, 'tags-invalid')
  await value('setMeta', { skill: 'weekly-report', alias: '' })
  assert.equal((await value('list')).skills.find(skill => skill.name === 'weekly-report').alias, undefined)
})

test('searches the text of skill files', async () => {
  const one = await writeSkill(join(skillsDir, 'one'), '---\nname: one\ndescription: First\n---\n\nUse the Quarterly-Budget template.\n')
  const two = await writeSkill(join(skillsDir, 'two'), '---\nname: two\ndescription: Second\n---\n\nNothing here.\n')
  const { value } = await mount(() => [entry('one', one, 'First'), entry('two', two, 'Second')])
  await value('list')
  assert.deepEqual((await value('searchSkills', { query: 'quarterly-budget' })).names, ['one'])
  assert.deepEqual((await value('searchSkills', { query: 'q' })).names, [], 'one character is too short')
  assert.deepEqual((await value('searchSkills', { query: 'zzzz-nothing' })).names, [])
})

test('lists, reads, edits, adds, and removes the other files of a skill, keeping copies', async () => {
  const path = await writeSkill(join(skillsDir, 'pdf-tools'), '---\nname: pdf-tools\ndescription: PDF\n---\n', { 'scripts/run.py': 'print(1)\n', 'data.bin': Buffer.from([0, 1, 2]) })
  const { value, call, store } = await mount(() => [entry('pdf-tools', path, 'PDF')])
  await value('list')
  const listing = await value('listSkillFiles', { skill: 'pdf-tools' })
  assert.deepEqual(listing.files.map(file => file.rel), ['SKILL.md', 'data.bin', 'scripts/run.py'])
  assert.equal(listing.editable, true)
  const read = await value('readSkillAsset', { skill: 'pdf-tools', rel: 'scripts/run.py' })
  assert.deepEqual([read.text, read.editable], ['print(1)\n', true])
  assert.equal((await call('readSkillAsset', { skill: 'pdf-tools', rel: 'data.bin' })).code, 'asset-binary')
  assert.equal((await call('readSkillAsset', { skill: 'pdf-tools', rel: '../other' })).code, 'asset-outside')
  assert.equal((await call('readSkillAsset', { skill: 'pdf-tools', rel: '/etc/passwd' })).code, 'asset-outside')
  assert.equal((await call('readSkillAsset', { skill: 'pdf-tools', rel: 'missing.txt' })).code, 'asset-missing')
  assert.equal((await value('readSkillAsset', { skill: 'pdf-tools', rel: 'SKILL.md' })).editable, false, 'SKILL.md has its own editor')
  assert.deepEqual(await value('writeSkillAsset', { skill: 'pdf-tools', rel: 'scripts/run.py', text: 'print(2)\n', base: 'print(1)\n' }), { changed: true })
  assert.equal(await readFile(join(skillsDir, 'pdf-tools', 'scripts', 'run.py'), 'utf8'), 'print(2)\n')
  const [backup] = await readdir(join(store, 'backups'))
  assert.match(backup, /^\d{13}-pdf-tools-scripts__run\.py$/)
  assert.equal(await readFile(join(store, 'backups', backup), 'utf8'), 'print(1)\n', 'the old file is kept')
  assert.equal((await call('writeSkillAsset', { skill: 'pdf-tools', rel: 'scripts/run.py', text: 'print(3)\n', base: 'print(1)\n' })).code, 'skill-conflict')
  assert.deepEqual(await value('writeSkillAsset', { skill: 'pdf-tools', rel: 'scripts/run.py', text: 'print(2)\n' }), { changed: false })
  assert.equal((await call('writeSkillAsset', { skill: 'pdf-tools', rel: 'SKILL.md', text: 'x' })).code, 'bad-request')
  assert.deepEqual(await value('writeSkillAsset', { skill: 'pdf-tools', rel: 'notes/todo.md', text: 'later\n', create: true }), { changed: true, created: true })
  assert.equal((await call('writeSkillAsset', { skill: 'pdf-tools', rel: 'notes/todo.md', text: 'x', create: true })).code, 'asset-exists')
  assert.equal((await call('writeSkillAsset', { skill: 'pdf-tools', rel: 'nope.md', text: 'x' })).code, 'asset-missing')
  await value('deleteSkillAsset', { skill: 'pdf-tools', rel: 'notes/todo.md' })
  await assert.rejects(stat(join(skillsDir, 'pdf-tools', 'notes', 'todo.md')))
  assert.equal((await readdir(join(store, 'backups'))).length, 2, 'a removed file is kept too')
  assert.equal((await call('deleteSkillAsset', { skill: 'pdf-tools', rel: 'SKILL.md' })).code, 'bad-request')
})

test('exports a skill as an archive and moves it between the two user folders', async () => {
  const path = await writeSkill(join(skillsDir, 'standup'), '---\nname: standup\ndescription: Daily\n---\n', { 'scripts/run.sh': '#!/bin/sh\n' })
  const { value, call } = await mount(() => [entry('standup', path, 'Daily')])
  await value('list')
  const exported = await value('exportSkill', { skill: 'standup' })
  assert.equal(exported.name, 'standup.zip')
  assert.deepEqual(readZip(Buffer.from(exported.zip, 'base64'), { maxFiles: 10, maxBytes: 1000 }).map(file => file.path), ['standup/SKILL.md', 'standup/scripts/run.sh'])
  assert.equal((await call('moveSkill', { skill: 'standup', target: 'dsh' })).code, 'skill-already-there')
  const moved = await value('moveSkill', { skill: 'standup', target: 'agents' })
  assert.equal(moved.display, join('~', '.agents', 'skills', 'standup'))
  assert.match(await readFile(join(agentsDir, 'standup', 'SKILL.md'), 'utf8'), /Daily/)
  await assert.rejects(stat(join(skillsDir, 'standup')))
  assert.equal((await value('readSkillFile', { skill: 'standup' })).path, join(agentsDir, 'standup', 'SKILL.md'), 'the skill is found at its new place')
  await writeSkill(join(skillsDir, 'standup'), '---\nname: standup\ndescription: Another\n---\n')
  assert.equal((await call('moveSkill', { skill: 'standup', target: 'dsh' })).code, 'skill-exists')
})

/** A GitHub source archive, as codeload serves it: one wrapper folder and the commit in the comment. */
function repoArchive({ commit, pdf = 'Read PDFs' }) {
  return writeZip([
    { path: 'skills-main/README.md', data: Buffer.from('# Skills\n') },
    { path: 'skills-main/skills/pdf/SKILL.md', data: Buffer.from(`---\nname: pdf\ndescription: ${pdf}\n---\n\nBody\n`) },
    { path: 'skills-main/skills/pdf/scripts/run.py', data: Buffer.from('print(1)\n') },
    { path: 'skills-main/skills/xlsx/SKILL.md', data: Buffer.from('---\nname: xlsx\ndescription: Spreadsheets\n---\n') },
  ], { comment: commit })
}

test('installs skills from a GitHub address, then finds and applies a newer version', async () => {
  const original = globalThis.fetch
  const served = { archive: repoArchive({ commit: 'a'.repeat(40) }) }
  const requested = []
  globalThis.fetch = async (url) => { requested.push(String(url)); return new Response(served.archive) }
  try {
    const { value, call } = await mount(() => [])
    const staged = await value('githubSources', { url: 'https://github.com/o/skills' })
    assert.deepEqual(requested, ['https://codeload.github.com/o/skills/zip/HEAD'])
    assert.deepEqual([staged.label, staged.github.commit, staged.truncated], ['o/skills', 'a'.repeat(40), false])
    assert.deepEqual(staged.items.map(item => [item.name, item.status, item.display, item.scripts]), [['pdf', 'new', 'o/skills/skills/pdf', ['scripts/run.py']], ['xlsx', 'new', 'o/skills/skills/xlsx', []]])
    const { results } = await value('importUploads', { upload: staged.upload, items: staged.items.map(item => ({ path: item.path })) })
    assert.deepEqual(results.map(result => [result.name, result.status]), [['pdf', 'imported'], ['xlsx', 'imported']])
    assert.match(await readFile(join(skillsDir, 'pdf', 'scripts', 'run.py'), 'utf8'), /print\(1\)/)

    const listed = (await value('list')).skills.find(skill => skill.name === 'pdf')
    assert.deepEqual([listed.imported.source, listed.imported.state, listed.imported.display, listed.imported.github.commit], ['github', 'same', 'o/skills/skills/pdf', 'a'.repeat(40)])

    assert.deepEqual(await value('checkUpdates'), { checked: 2, updates: [], failed: [] })
    served.archive = repoArchive({ commit: 'b'.repeat(40), pdf: 'Read and fill PDFs' })
    assert.deepEqual(await value('checkUpdates'), { checked: 2, updates: ['pdf'], failed: [] })
    const changed = (await value('list')).skills.find(skill => skill.name === 'pdf')
    assert.deepEqual([changed.imported.state, changed.imported.github.latest.commit], ['changed', 'b'.repeat(40)])
    assert.equal((await value('list')).skills.find(skill => skill.name === 'xlsx').imported.state, 'same', 'a commit that leaves a folder alone is no update')

    const updated = await value('updateGithub', {})
    assert.deepEqual(updated.results.map(result => [result.name, result.status, result.backup]), [['pdf', 'updated', 'v1']])
    assert.match(await readFile(join(skillsDir, 'pdf', 'SKILL.md'), 'utf8'), /Read and fill PDFs/)
    const after = (await value('list')).skills.find(skill => skill.name === 'pdf')
    assert.deepEqual([after.imported.state, after.imported.github.commit, after.versions.map(version => version.source)], ['same', 'b'.repeat(40), ['before-import']])
    assert.deepEqual(await value('checkUpdates'), { checked: 2, updates: [], failed: [] })

    const again = await value('githubSources', { url: 'o/skills' })
    assert.deepEqual(again.items.map(item => [item.name, item.status, item.as]), [['pdf', 'imported', 'pdf'], ['xlsx', 'imported', 'xlsx']])

    served.archive = writeZip([{ path: 'skills-main/README.md', data: Buffer.from('gone') }], { comment: 'c'.repeat(40) })
    const gone = await value('checkUpdates')
    assert.deepEqual([gone.checked, gone.updates], [2, []])
    assert.equal((await call('updateGithub', { skills: ['pdf'] })).ok, true)
    assert.equal((await value('updateGithub', { skills: ['pdf'] })).results[0].code, 'github-gone')

    globalThis.fetch = async () => new Response('', { status: 404 })
    assert.equal((await call('githubSources', { url: 'o/missing' })).code, 'github-not-found')
    assert.equal((await call('githubSources', { url: 'https://example.com/a/b' })).code, 'github-url-invalid')
    assert.deepEqual((await value('checkUpdates')).failed.map(failure => [failure.repo, failure.code]), [['o/skills', 'github-not-found']])
  } finally {
    globalThis.fetch = original
  }
})

test('tries longer refs for a branch with a slash, and reports a repository without skills', async () => {
  const original = globalThis.fetch
  const requested = []
  globalThis.fetch = async (url) => {
    requested.push(String(url))
    if (String(url).endsWith('/zip/feature')) return new Response('', { status: 404 })
    return new Response(writeZip([{ path: 'r-feature-x/docs/a.md', data: Buffer.from('x') }]))
  }
  try {
    const { value } = await mount(() => [])
    const staged = await value('githubSources', { url: 'https://github.com/o/r/tree/feature/x/docs' })
    assert.deepEqual(requested, ['https://codeload.github.com/o/r/zip/feature', 'https://codeload.github.com/o/r/zip/feature/x'])
    assert.deepEqual([staged.items, staged.github.ref], [[], 'feature/x'])
  } finally {
    globalThis.fetch = original
  }
})

test('lists the skills of a project folder without adding them to the global list afterwards', async () => {
  const project = join(home, 'work', 'app')
  const path = await writeSkill(join(project, '.dsh', 'skills', 'deploy'), '---\nname: deploy\ndescription: Deploy the app\n---\n')
  const { value, call, snapshots } = await mount(options => (options.cwd === undefined ? [] : [entry('deploy', path, 'Deploy the app', 'project-dsh')]))
  const withProject = await value('list', { cwd: project })
  assert.deepEqual(snapshots.map(options => options.cwd), [project, project])
  assert.deepEqual([withProject.project, withProject.skills.map(skill => [skill.name, skill.source, skill.editable])], [join('~', 'work', 'app'), [['deploy', 'project-dsh', true]]])
  assert.deepEqual((await value('list')).skills.map(skill => skill.name), [], 'a project skill belongs to its project')
  assert.equal((await call('list', { cwd: 'relative/dir' })).code, 'folder-relative')
  assert.equal((await call('list', { cwd: join(home, 'nope') })).code, 'folder-missing')
  const broken = await writeSkill(join(project, '.dsh', 'skills', 'broken'), '---\nname: broken\ndescription: Not quoted: yes\n---\n')
  const { utimes } = await import('node:fs/promises')
  await utimes(broken, Date.now() / 1000 - 60, Date.now() / 1000 - 60)
  const skipped = (await value('list', { cwd: project, refresh: true })).skipped
  assert.deepEqual(skipped.map(item => [item.root, item.folder, item.reason]), [['project-dsh', 'broken', 'yaml']])
  assert.equal((await value('readSkipped', { path: broken, cwd: project })).problem.reason, 'yaml')
  assert.equal((await call('readSkipped', { path: broken })).code, 'bad-request', 'a project file needs its project')
})

test('clears the chosen kinds of settings from every mode and takes the row out', async () => {
  const path = await writeSkill(join(skillsDir, 'clearable'), '---\nname: clearable\ndescription: Clear me\n---\n')
  const other = await writeSkill(join(skillsDir, 'keeper'), '---\nname: keeper\ndescription: Keep me\n---\n')
  const { value, entries, provided } = await mount(() => [entry('clearable', path, 'Clear me'), entry('keeper', other, 'Keep me')])
  await value('list')
  await value('setModes', { changes: [{ preset: 'standard', skill: 'clearable', state: 'off' }, { preset: 'standard', skill: 'keeper', state: 'manual' }] })
  await value('clearModes', { kinds: ['off'] })
  assert.deepEqual(await provided.dshModeSkills.policyFor('standard'), { off: [], manual: [{ name: 'keeper', path: other, description: 'Keep me' }], model: [] })
  assert.deepEqual(entries[0].entry.options.config.plugins.map(row => row.id), ['persona', 'dsh-mode-skills-policy'], 'the manual setting still needs the row')
  await value('clearModes', {})
  assert.deepEqual(entries[0].entry.options.config.plugins.map(row => row.id), ['persona'])
})

test('leaves a GitHub skill alone while it is in the trash', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(writeZip([{ path: 'r-main/skills/gone/SKILL.md', data: Buffer.from('---\nname: trashed-one\ndescription: Soon deleted\n---\n') }], { comment: 'd'.repeat(40) }))
  try {
    const { value, call } = await mount(() => [])
    const staged = await value('githubSources', { url: 'o/r' })
    await value('importUploads', { upload: staged.upload, items: staged.items.map(item => ({ path: item.path })) })
    assert.deepEqual((await value('checkUpdates')).checked, 1)
    const info = await value('list')
    assert.equal(info.skills.some(skill => skill.name === 'trashed-one'), true)
    await value('deleteSkill', { skill: 'trashed-one' })
    assert.deepEqual(await value('checkUpdates'), { checked: 0, updates: [], failed: [] })
    assert.equal((await call('updateGithub', { skills: ['trashed-one'] })).code, 'bad-request')
  } finally {
    globalThis.fetch = original
  }
})

test('counts skill loads per mode from the session history, and says so when there is none', async () => {
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const sessions = [
    { header: { id: 'a', createdAt: now - 2 * day, agentPreset: 'ptc' }, live: false, persisted: true, events: [{ type: 'user/message', time: now - day, data: { source: { kind: 'skill-invocation', name: 'standup', form: 'instructions' } } }] },
    { header: { id: 'b', createdAt: now - 40 * day }, live: false, persisted: true, events: [
      { type: 'tool/call', time: now - 40 * day, data: { callId: 'c1', name: 'skill', arguments: '{"name":"standup"}' } },
      { type: 'tool/result', time: now - 40 * day, data: { message: { toolCallId: 'c1' } } },
    ] },
  ]
  const service = { listSessions: async () => sessions.map(({ events: _events, ...record }) => record), readSession: async id => ({ events: sessions.find(record => record.header.id === id).events }) }
  const { value } = await mount(() => [], { sessionQuery: service })
  const month = await value('usage', { days: 30 })
  assert.deepEqual([month.days, month.scanned, month.total, month.complete], [30, 2, 2, true])
  assert.deepEqual(month.skills.standup.modes, { ptc: { model: 0, user: 1, lastAt: now - day } })
  const year = await value('usage', { days: 365, refresh: true })
  assert.deepEqual(year.skills.standup.modes.standard, { model: 1, user: 0, lastAt: now - 40 * day }, 'a session without a preset is the default mode')
  assert.equal((await value('usage', { days: 5 })).days, 30, 'an unknown window falls back to 30 days')
  const { call: bare } = await mount(() => [], { sessionQuery: undefined })
  assert.equal((await bare('usage')).code, 'usage-unavailable')
})

test('searches the store once for a repeated text, and lists the shipped repositories', async () => {
  const original = globalThis.fetch
  let requests = 0
  globalThis.fetch = async () => { requests += 1; return Response.json({ skills: [{ source: 'o/r', skillId: 'pdf', installs: 3 }] }) }
  try {
    const { value, call } = await mount()
    assert.deepEqual((await value('storeSearch', { query: 'PDF' })).results, [{ id: 'o/r/pdf', repo: 'o/r', skill: 'pdf', installs: 3 }])
    await value('storeSearch', { query: ' pdf ' })
    assert.equal(requests, 1)
    assert.equal((await call('storeSearch', { query: 'x' })).code, 'store-query-short')
    assert.ok((await value('storeIndex')).repos.length >= 5)
  } finally {
    globalThis.fetch = original
  }
})
