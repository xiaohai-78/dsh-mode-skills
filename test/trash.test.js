import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { emptyTrash, listTrash, moveItem, purgeTrash, restoreTrash, trashSkill } from '../trash.js'

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-trash-'))
  const skill = join(root, 'skills', 'notes')
  await mkdir(join(skill, 'scripts'), { recursive: true })
  await writeFile(join(skill, 'SKILL.md'), '---\nname: notes\ndescription: Take notes\n---\n')
  await writeFile(join(skill, 'scripts', 'run.sh'), 'echo run\n')
  return { root, skill, trashDir: join(root, 'trash') }
}

test('moves a skill into the bin and back, unchanged', async () => {
  const { skill, trashDir } = await setup()
  const id = await trashSkill({ trashDir, name: 'notes', from: skill, layout: 'directory', description: 'Take notes', now: 1760000000000 })
  assert.equal(id, '1760000000000-notes')
  await assert.rejects(readFile(join(skill, 'SKILL.md')))
  assert.deepEqual((await listTrash(trashDir)).map(entry => [entry.id, entry.name, entry.from, entry.description]), [[id, 'notes', skill, 'Take notes']])
  assert.deepEqual(await restoreTrash(trashDir, id), { name: 'notes', from: skill })
  assert.equal(await readFile(join(skill, 'scripts', 'run.sh'), 'utf8'), 'echo run\n')
  assert.deepEqual(await listTrash(trashDir), [])
})

test('refuses to restore over something new, reuses a folder left empty, and lists newest first', async () => {
  const { skill, trashDir } = await setup()
  const first = await trashSkill({ trashDir, name: 'notes', from: skill, layout: 'directory', now: 1760000000000 })
  await mkdir(skill)
  await writeFile(join(skill, 'SKILL.md'), 'new\n')
  await assert.rejects(restoreTrash(trashDir, first), error => error.code === 'trash-target-exists')
  const second = await trashSkill({ trashDir, name: 'notes', from: skill, layout: 'directory', now: 1760000001000 })
  assert.deepEqual((await listTrash(trashDir)).map(entry => entry.id), [second, first])
  await mkdir(skill)
  await restoreTrash(trashDir, first)
  assert.match(await readFile(join(skill, 'SKILL.md'), 'utf8'), /Take notes/)
  await assert.rejects(restoreTrash(trashDir, '../outside'), error => error.code === 'trash-unknown')
})

test('removes one entry or the whole bin for good', async () => {
  const { root, skill, trashDir } = await setup()
  const id = await trashSkill({ trashDir, name: 'notes', from: skill, layout: 'directory' })
  const other = join(root, 'skills', 'other.md')
  await writeFile(other, '---\nname: other\ndescription: x\n---\n')
  await trashSkill({ trashDir, name: 'other', from: other, layout: 'file', now: Date.now() + 1 })
  await purgeTrash(trashDir, id)
  assert.deepEqual((await listTrash(trashDir)).map(entry => entry.name), ['other'])
  await emptyTrash(trashDir)
  assert.deepEqual(await listTrash(trashDir), [])
})

test('copies and removes when a rename cannot move the folder', async () => {
  const { root, skill } = await setup()
  const to = join(root, 'elsewhere', 'notes')
  const renameImpl = async () => { throw Object.assign(new Error('cross-device'), { code: 'EXDEV' }) }
  await moveItem(skill, to, { renameImpl })
  assert.deepEqual((await readdir(to)).sort(), ['SKILL.md', 'scripts'])
  await assert.rejects(readdir(skill))
  const busy = await setup()
  const windows = async () => { throw Object.assign(new Error('busy'), { code: 'EPERM' }) }
  await moveItem(busy.skill, join(busy.root, 'moved'), { platform: 'win32', renameImpl: windows })
  assert.deepEqual((await readdir(join(busy.root, 'moved'))).sort(), ['SKILL.md', 'scripts'])
  await assert.rejects(moveItem(join(busy.root, 'moved'), join(busy.root, 'again'), { platform: 'darwin', renameImpl: windows }), error => error.code === 'EPERM', 'elsewhere a refused rename is a real problem')
})
