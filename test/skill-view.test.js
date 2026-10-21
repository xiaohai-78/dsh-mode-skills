import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { modeState, packagePath, summarize } from '../skill-view.js'

const home = join('/home', 'u')
const file = (...parts) => join(home, '.dsh', 'skills', ...parts)

test('reads how a mode treats a skill from its catalog entry', () => {
  assert.equal(modeState({ provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: true } }), 'on')
  assert.equal(modeState({ provider: 'filesystem' }), 'on')
  assert.equal(modeState({ provider: 'filesystem', invocation: { modelInvocable: false, userInvocable: true } }), 'manual')
  assert.equal(modeState({ provider: 'filesystem', invocation: { modelInvocable: true, userInvocable: false } }), 'model')
  assert.equal(modeState({ provider: 'dsh-mode-skills', invocation: { modelInvocable: true, userInvocable: false } }), 'model')
  assert.equal(modeState({ provider: 'dsh-mode-skills', invocation: { modelInvocable: false, userInvocable: true } }), 'manual')
  assert.equal(modeState({ provider: 'dsh-mode-skills', invocation: { modelInvocable: false, userInvocable: false } }), 'off')
  assert.equal(modeState({ provider: 'dsh-modes', invocation: { modelInvocable: false, userInvocable: false } }), 'off')
  assert.equal(modeState({ provider: 'dsh-modes', invocation: { modelInvocable: true, userInvocable: true } }), 'pinned')
})

test('lists each skill once with how every mode treats it, and reports modes that could not be read', () => {
  const review = { name: 'code-review', description: 'Review changes', path: file('code-review', 'SKILL.md'), source: 'user-dsh', provider: 'filesystem' }
  const view = summarize([
    { id: 'standard', skills: [review, { name: 'weekly-report', description: 'Turned off in this mode by dsh-modes.', source: 'dsh-modes', provider: 'dsh-modes', invocation: { modelInvocable: false, userInvocable: false } }] },
    { id: 'ptc', skills: [review, { name: 'weekly-report', description: 'Write a weekly report', whenToUse: 'On Fridays', path: file('weekly-report', 'SKILL.md'), source: 'user-dsh', provider: 'filesystem' }] },
    { id: 'minimal', error: 'agent-preset/invalid: row failed' },
  ], home)
  assert.deepEqual(view.errors, { minimal: 'agent-preset/invalid: row failed' })
  assert.deepEqual(view.skills.map(skill => [skill.name, skill.modes]), [
    ['code-review', { standard: 'on', ptc: 'on' }],
    ['weekly-report', { standard: 'off', ptc: 'on' }],
  ])
  const weekly = view.skills[1]
  assert.equal(weekly.description, 'Write a weekly report', 'the skill file wins over the entry that hides it')
  assert.equal(weekly.whenToUse, 'On Fridays')
  assert.equal(weekly.display, join('~', '.dsh', 'skills', 'weekly-report', 'SKILL.md'))
})

test('a skill hidden in every mode keeps the details of the entry that hides it', () => {
  const off = { name: 'sql-style', description: 'Turned off in this mode by dsh-modes.', source: 'dsh-modes', provider: 'dsh-modes', invocation: { modelInvocable: false, userInvocable: false } }
  const view = summarize([{ id: 'standard', skills: [off] }, { id: 'ptc', skills: [off] }], home)
  assert.deepEqual(view.skills, [{ name: 'sql-style', modes: { standard: 'off', ptc: 'off' }, description: off.description, source: 'dsh-modes', provider: 'dsh-modes' }])
})

test('the first mode with the skill file gives its details', () => {
  const a = { name: 'x', description: 'from standard', source: 'user-dsh', provider: 'filesystem' }
  const b = { name: 'x', description: 'from cordis', source: 'bundled', provider: 'filesystem' }
  assert.equal(summarize([{ id: 'standard', skills: [a] }, { id: 'cordis', skills: [b] }], home).skills[0].description, 'from standard')
})

test('a skill inside an installed package is shown from the package name on', () => {
  const path = join('/opt', 'dsh', 'node_modules', '.pnpm', 'x@1', 'node_modules', '@deepseek-ai', 'dsh-agent-preset', 'skills', 'a', 'SKILL.md')
  assert.equal(packagePath(path), join('@deepseek-ai', 'dsh-agent-preset', 'skills', 'a', 'SKILL.md'))
  assert.equal(packagePath(join(home, '.dsh', 'skills', 'a', 'SKILL.md')), undefined)
  const [skill] = summarize([{ id: 'cordis', skills: [{ name: 'a', description: 'd', path, source: 'custom', provider: 'filesystem' }] }], home).skills
  assert.equal(skill.display, join('@deepseek-ai', 'dsh-agent-preset', 'skills', 'a', 'SKILL.md'))
  assert.equal(skill.packaged, true)
})
