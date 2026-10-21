import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { isDeepStrictEqual } from 'node:util'
import { deflateRawSync } from 'node:zlib'

// Every folder this file touches lives under one temporary home.
const home = await realpath(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-batch-')))
process.env.HOME = home
process.env.USERPROFILE = home
process.env.DSH_HOME = join(home, '.dsh')
process.env.DSH_AGENTS_HOME = join(home, '.agents')
process.env.CODEX_HOME = join(home, '.codex')
process.env.CLAUDE_CONFIG_DIR = join(home, '.claude')
const { apply } = await import('../index.js')

const persona = { id: 'persona', name: '@deepseek-ai/dsh-persona' }
const skillsDir = join(home, '.dsh', 'skills')

async function writeSkill(dir, text) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), text)
  return join(dir, 'SKILL.md')
}

/** Mount the host on a fake DSH whose catalogs come from `catalog()`, with the two modes `standard` and `ptc`. */
async function mount(catalog) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-profile-'))
  const routes = []
  const provided = {}
  const entries = ['standard', 'ptc'].map(id => ({ entry: { options: { id: `preset-${id}`, name: '@deepseek-ai/dsh-agent-preset', config: { id, plugins: [persona] } } }, inherited: { id, plugins: [persona] } }))
  apply({
    configEditor: {
      documentPath: join(dir, 'cordis.patch.yml'),
      configuration: () => entries.map(({ entry, inherited }) => ({ entry, inherited, override: isDeepStrictEqual(entry.options.config, inherited) ? {} : { config: entry.options.config } })),
      edit: async (entry, change) => { entry.options.config = change(structuredClone(entry.options.config), structuredClone(entries.find(item => item.entry === entry).inherited)) },
    },
    agentPresets: { defaultId: 'standard', list: async () => [{ id: 'standard' }, { id: 'ptc' }], acquireScope: async id => ({ key: id, [Symbol.asyncDispose]: async () => {} }) },
    provide: (name, value) => { provided[name] = value },
    get: name => (name === 'skills' ? { snapshot: async () => ({ skills: catalog() }) } : name === 'tools' ? { schemas: () => [{ name: 'skill' }] } : undefined),
    inject: (_names, callback) => callback({ effect: effect => effect(), connection: { fetch: { register: route => routes.push(route) } } }),
    logger: { warn: () => {} },
  })
  const call = async (action, payload = {}) => (await (await routes[0].fetch({ json: async () => ({ action, ...payload }) })).json())
  const value = async (action, payload) => {
    const body = await call(action, payload)
    assert.equal(body.ok, true, JSON.stringify(body))
    return body.value
  }
  return { call, value, entries, provided }
}

const entry = (name, path, description) => ({ name, description, path, source: 'user-dsh', provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: true } })

test('sets a skill to manual only in one mode, and the policy row serves its file to the user there', async () => {
  const path = await writeSkill(join(skillsDir, 'meeting-notes'), '---\nname: meeting-notes\ndescription: Organize meeting notes\n---\n\nBody\n')
  const { value, entries, provided } = await mount(() => [entry('meeting-notes', path, 'Organize meeting notes')])
  await value('list')
  assert.deepEqual(await value('setModes', { changes: [{ preset: 'standard', skill: 'meeting-notes', state: 'manual' }] }), { failed: [], mounted: ['standard'] })
  assert.deepEqual(entries[0].entry.options.config.plugins.map(row => row.id), ['persona', 'dsh-mode-skills-policy'])
  assert.deepEqual(await provided.dshModeSkills.policyFor('standard'), { off: [], manual: [{ name: 'meeting-notes', path, description: 'Organize meeting notes' }], model: [] })
  assert.deepEqual((await value('list')).modes.map(mode => [mode.id, mode.manual]), [['standard', ['meeting-notes']], ['ptc', []]])
  await value('setModes', { changes: [{ preset: 'standard', skill: 'meeting-notes', state: 'off' }] })
  assert.deepEqual(await provided.dshModeSkills.policyFor('standard'), { off: ['meeting-notes'], manual: [], model: [] }, 'off replaces manual')
  await value('setModes', { changes: [{ preset: 'standard', skill: 'meeting-notes', state: 'on' }] })
  assert.deepEqual(entries[0].entry.options.config.plugins.map(row => row.id), ['persona'])
})

test('deletes a skill into the bin and restores it, refusing skills that belong to a package', async () => {
  const path = await writeSkill(join(skillsDir, 'weekly-report'), '---\nname: weekly-report\ndescription: Weekly report\n---\n')
  const packaged = join(home, 'node_modules', 'pkg', 'skills', 'bundled', 'SKILL.md')
  const { value, call } = await mount(() => [entry('weekly-report', path, 'Weekly report'), { ...entry('bundled', packaged, 'Packaged'), source: 'custom' }])
  await value('list')
  const { id } = await value('deleteSkill', { skill: 'weekly-report' })
  await assert.rejects(readFile(path))
  const listed = await value('list')
  assert.deepEqual(listed.trash.map(item => [item.id, item.name, item.description]), [[id, 'weekly-report', 'Weekly report']])
  assert.deepEqual(await value('restoreTrash', { id }), { name: 'weekly-report', display: join('~', '.dsh', 'skills', 'weekly-report') })
  assert.match(await readFile(path, 'utf8'), /Weekly report/)
  assert.equal((await call('deleteSkill', { skill: 'bundled' })).code, 'skill-read-only')
  assert.equal((await call('restoreTrash', { id: 'nope' })).code, 'trash-unknown')
})

test('reports a skill file no mode loads, and writes the offered fix after keeping the old file', async () => {
  const broken = await writeSkill(join(skillsDir, 'pdf-tools'), '---\nname: pdf-tools\ndescription: Read files: forms and tables\n---\n\nBody\n')
  const old = Date.now() / 1000 - 60
  const { utimes } = await import('node:fs/promises')
  await utimes(broken, old, old)
  const listedPath = await writeSkill(join(skillsDir, 'listed'), '---\nname: listed\ndescription: Fine\n---\n')
  const { value, call } = await mount(() => [entry('listed', listedPath, 'Fine')])
  // Skills other tests left in the shared home are unlisted too once they are older than the settle time.
  const skipped = (await value('list')).skipped.filter(item => item.folder === 'pdf-tools')
  assert.deepEqual(skipped.map(item => [item.folder, item.reason, item.fixable]), [['pdf-tools', 'yaml', true]])
  const read = await value('readSkipped', { path: skipped[0].path })
  assert.deepEqual([read.problem.reason, read.proposal.complete], ['yaml', true])
  assert.match(read.proposal.text, /description: "Read files: forms and tables"/)
  assert.deepEqual(await value('writeSkipped', { path: skipped[0].path, text: read.proposal.text, base: read.text }), { problem: null })
  assert.match(await readFile(broken, 'utf8'), /"Read files: forms and tables"/)
  assert.equal((await call('readSkipped', { path: join(home, 'elsewhere', 'SKILL.md') })).code, 'skill-no-file')
  await writeSkill(join(home, 'outside'), 'x')
  assert.equal((await call('readSkipped', { path: join(home, 'outside', 'SKILL.md') })).code, 'bad-request', 'only the user skill folders')
})

test('installs skills from uploaded files and from a zip archive', async () => {
  const { value, call } = await mount(() => [])
  const b64 = text => Buffer.from(text).toString('base64')
  const staged = await value('stageUpload', { name: 'my-skills', files: [
    { path: 'my-skills/standup/SKILL.md', data: b64('---\nname: standup\ndescription: Daily standup\n---\n') },
    { path: 'my-skills/standup/notes.md', data: b64('extra\n') },
    { path: 'my-skills/retro/SKILL.md', data: b64('---\nname: retro\ndescription: Retrospective\n---\n') },
  ] })
  assert.deepEqual(staged.items.map(item => [item.name, item.status]).sort(), [['retro', 'new'], ['standup', 'new']])
  const { results } = await value('importUploads', { upload: staged.upload, items: staged.items.map(item => ({ path: item.path })) })
  assert.deepEqual(results.map(result => [result.name, result.status]).sort(), [['retro', 'imported'], ['standup', 'imported']])
  assert.equal(await readFile(join(skillsDir, 'standup', 'notes.md'), 'utf8'), 'extra\n')
  assert.equal((await call('importUploads', { upload: staged.upload, items: [{ path: 'x' }] })).code, 'upload-gone', 'an upload is used once')

  const name = Buffer.from('focus/SKILL.md')
  const data = Buffer.from('---\nname: focus\ndescription: Deep work\n---\n')
  const stored = deflateRawSync(data)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(stored.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(name.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(stored.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(name.length, 28)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(46 + name.length, 12)
  end.writeUInt32LE(30 + name.length + stored.length, 16)
  const archive = Buffer.concat([local, name, stored, central, name, end])
  const fromZip = await value('stageUpload', { name: 'focus.zip', zip: archive.toString('base64') })
  assert.deepEqual(fromZip.items.map(item => [item.name, item.status]), [['focus', 'new']])
  assert.equal((await call('stageUpload', { zip: Buffer.from('nope').toString('base64') })).code, 'zip-invalid')
})

test('lists the skills of other agent tools found under the home folder', async () => {
  await writeSkill(join(home, '.cursor', 'skills', 'refactor'), '---\nname: refactor\ndescription: Refactor safely\n---\n')
  await writeSkill(join(home, '.codex', 'skills', 'explain'), '---\nname: explain\ndescription: Explain\n---\n')
  const { value } = await mount(() => [])
  const { groups } = await value('agentSources')
  assert.deepEqual(groups.map(group => [group.source, group.label, group.items.map(item => item.name)]), [['agent:cursor', 'Cursor', ['refactor']]])
  const all = await value('skillSources')
  assert.ok(all.groups.some(group => group.source === 'codex') && all.groups.some(group => group.source === 'agent:cursor'))
})
