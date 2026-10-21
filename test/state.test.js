import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { StateFileError, StateStore } from '../state.js'

test('reads the empty form before the first write, and writes changes one after another', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-state-')), '.dsh-mode-skills')
  const store = new StateStore(dir)
  assert.deepEqual(await store.read(), { version: 1, presets: {}, skills: {} })
  await Promise.all([
    store.update((state) => { state.presets.standard = { off: ['a'] } }),
    store.update((state) => { state.presets.standard.off.push('b') }),
  ])
  assert.deepEqual((await store.read()).presets, { standard: { off: ['a', 'b'] } })
})

test('reports a damaged file and never overwrites it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-state-'))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'state.json'), '{ not json')
  const store = new StateStore(dir)
  await assert.rejects(store.read(), StateFileError)
  await assert.rejects(store.update((state) => { state.presets.x = {} }), error => error.code === 'state-damaged')
  assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), '{ not json')
})
