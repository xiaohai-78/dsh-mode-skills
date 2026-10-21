import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { analyzeSkillText, findSkipped, proposeFix } from '../diagnose.js'

const skill = (front, body = '\nBody\n') => `---\n${front}\n---\n${body}`

test('names the first rule a skill file breaks, in the order DSH checks them', () => {
  assert.equal(analyzeSkillText(skill('name: a\ndescription: Do it')), undefined)
  assert.equal(analyzeSkillText(skill('name: a\ndescription: "Read: forms"\nuser-invocable: no')), undefined)
  assert.deepEqual(analyzeSkillText(`﻿${skill('name: a\ndescription: b')}`), { reason: 'bom' })
  assert.deepEqual(analyzeSkillText('# No frontmatter'), { reason: 'no-frontmatter' })
  assert.deepEqual(analyzeSkillText('---\nname: a\ndescription: b\n'), { reason: 'no-frontmatter' }, 'never closed')
  assert.deepEqual(analyzeSkillText(skill('name: a\ndescription: Read files: forms')), { reason: 'yaml', detail: { line: 3, what: 'unquoted', key: 'description' } })
  assert.deepEqual(analyzeSkillText(skill('name: a\nname: b\ndescription: c')), { reason: 'yaml', detail: { line: 3, what: 'duplicate', key: 'name' } })
  assert.deepEqual(analyzeSkillText(skill('name: a\ndescription: "open')), { reason: 'yaml', detail: { line: 3, what: 'quote', key: 'description' } })
  assert.deepEqual(analyzeSkillText(skill('description: b')), { reason: 'missing-name' })
  assert.deepEqual(analyzeSkillText(skill('name: a\ndescription:')), { reason: 'missing-description' })
  assert.deepEqual(analyzeSkillText(skill('name: a\ndescription: 2024')), { reason: 'not-text', detail: { key: 'description' } })
  assert.deepEqual(analyzeSkillText(skill('name: My Skill\ndescription: b')), { reason: 'name-invalid', detail: { name: 'My Skill' } })
  assert.deepEqual(analyzeSkillText(skill('name: a\ndescription: b\nuserInvocable: false')), { reason: 'legacy-key', detail: { key: 'userInvocable' } })
  assert.deepEqual(analyzeSkillText(skill('name: a\ndescription: b\ndisable-model-invocation: maybe')), { reason: 'invocation-invalid', detail: { key: 'disable-model-invocation' } })
})

test('mends what it can, keeping line endings, and says when the result is still not loadable', () => {
  assert.deepEqual(proposeFix(skill('name: a\ndescription: Read files: forms'), 'a'), { text: skill('name: a\ndescription: "Read files: forms"'), complete: true })
  assert.deepEqual(proposeFix(skill('name: My Skill\ndescription: b\nmodelInvocable: false'), 'x'), { text: skill('name: my-skill\ndescription: b\ndisable-model-invocation: true'), complete: true })
  assert.deepEqual(proposeFix(skill('description: b'), 'Weekly Report'), { text: skill('name: weekly-report\ndescription: b'), complete: true })
  const crlf = proposeFix('﻿---\r\nname: a\r\ndescription: 7\r\n---\r\nBody\r\n', 'a')
  assert.deepEqual(crlf, { text: '---\r\nname: a\r\ndescription: "7"\r\n---\r\nBody\r\n', complete: true })
  const bare = proposeFix('# Notes\nUse it.\n', 'notes')
  assert.equal(bare.text, '---\nname: notes\ndescription: ""\n---\n\n# Notes\nUse it.\n')
  assert.equal(bare.complete, false, 'a description is left for the user to write')
})

test('finds the files no mode lists, skipping recent changes, listed files, the .system folder, and folders without SKILL.md', async () => {
  const dsh = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-diagnose-'))
  const write = async (folder, text) => {
    await mkdir(join(dsh, folder), { recursive: true })
    await writeFile(join(dsh, folder, 'SKILL.md'), text)
    return realpath(join(dsh, folder, 'SKILL.md'))
  }
  const good = await write('good', skill('name: good\ndescription: Fine'))
  await write('broken', skill('name: broken\ndescription: Read: this'))
  await write('.system/internal', skill('name: internal\ndescription: x'))
  await write('twin', skill('name: good\ndescription: Same name'))
  await write('quiet', skill('name: quiet\ndescription: Off everywhere'))
  await write('mystery', skill('name: mystery\ndescription: Passes every check'))
  await mkdir(join(dsh, 'assets'))
  await writeFile(join(dsh, 'loose.md'), '# Not a skill\n')
  const found = await findSkipped({
    roots: [{ source: 'user-dsh', dir: dsh, skipSystem: true }, { source: 'user-agents', dir: join(dsh, 'missing') }],
    listedPaths: new Set([good]),
    listedNames: new Map([['good', good], ['quiet', undefined]]),
    settleMs: 0,
  })
  assert.deepEqual(found.map(item => [item.folder, item.reason, item.fixable]).sort(), [
    ['broken', 'yaml', true],
    ['loose', 'no-frontmatter', true],
    ['mystery', 'unknown', false],
    ['twin', 'shadowed', false],
  ])
  assert.equal(found.find(item => item.folder === 'twin').detail.name, 'good')
  assert.deepEqual(await findSkipped({ roots: [{ source: 'user-dsh', dir: dsh }], listedPaths: new Set(), listedNames: new Map(), settleMs: 60000 }), [], 'files changed just now are not judged yet')
})
