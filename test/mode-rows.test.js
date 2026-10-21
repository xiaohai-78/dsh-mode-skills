import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { POLICY_MODULE, POLICY_ROW_ID, WHEN_GONE, hasPolicyRow, isGuard, isOwnModule, planRows, refreshRows, withPolicyRow } from '../mode-rows.js'

/** The Loader's evaluator for a `!!js` value: the expression runs with the entry's context as its scope. */
// eslint-disable-next-line no-new-func
const evaluate = new Function('ctx', 'expr', 'with (ctx) { return eval(expr) }')

const persona = { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: 'Hi' } }
const fs = { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' }
const web = { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web' }
const row = preset => ({ id: POLICY_ROW_ID, name: POLICY_MODULE, config: { preset }, disabled: { __jsExpr: WHEN_GONE } })

test('adds the guarded policy row last, and takes it out again, also from inside a group', () => {
  assert.deepEqual(withPolicyRow([persona, fs], 'standard', true), [persona, fs, row('standard')])
  assert.deepEqual(withPolicyRow([persona, row('standard'), fs], 'standard', true), [persona, fs, row('standard')])
  assert.deepEqual(withPolicyRow([persona, fs, row('standard')], 'standard', false), [persona, fs])
  const grouped = [{ id: 'g', name: 'cordis:group', group: true, config: [fs, row('x')] }]
  assert.equal(hasPolicyRow(grouped), true)
  assert.deepEqual(withPolicyRow(grouped, 'x', false), [{ id: 'g', name: 'cordis:group', group: true, config: [fs] }])
  assert.ok(isGuard(row('x').disabled))
  assert.ok(isOwnModule(POLICY_MODULE) && !isOwnModule('dsh-modes/skills'))
})

test('plans a save: merges new built-in rows when a base is known, and says when the rows are the built-in ones', () => {
  assert.deepEqual(planRows({ current: [persona, fs], builtIn: [persona, fs], preset: 'standard', wanted: true }), { rows: [persona, fs, row('standard')], builtIn: false })
  assert.deepEqual(planRows({ current: [persona, fs, row('standard')], builtIn: [persona, fs], base: [persona, fs], preset: 'standard', wanted: false }), { rows: [persona, fs], builtIn: true })
  const merged = planRows({ current: [persona, fs, row('standard')], builtIn: [persona, fs, web], base: [persona, fs], preset: 'standard', wanted: true })
  assert.deepEqual(merged.rows, [persona, fs, web, row('standard')], 'a row DSH added since the last save is taken in')
  const edited = { ...fs, disabled: true }
  assert.deepEqual(planRows({ current: [persona, edited, row('standard')], builtIn: [persona, fs, web], base: [persona, fs], preset: 'standard', wanted: true }).rows,
    [persona, edited, web, row('standard')], 'someone else\'s change survives the merge')
})

test('on start, brings an override up to date only when it holds nothing but the policy row', () => {
  const unguarded = { id: POLICY_ROW_ID, name: POLICY_MODULE, config: { preset: 'standard' } }
  assert.deepEqual(refreshRows({ current: [persona, fs, unguarded], builtIn: [persona, fs], preset: 'standard' }), [persona, fs, row('standard')], 'the missing condition is added')
  assert.deepEqual(refreshRows({ current: [persona, fs, row('standard')], builtIn: [persona, fs, web], base: [persona, fs], preset: 'standard' }), [persona, fs, web, row('standard')], 'new built-in rows are taken in')
  assert.equal(refreshRows({ current: [persona, fs, row('standard')], builtIn: [persona, fs], base: [persona, fs], preset: 'standard' }), undefined, 'already current')
  assert.equal(refreshRows({ current: [persona, { ...fs, disabled: true }, row('standard')], builtIn: [persona, fs, web], base: [persona, fs], preset: 'standard' }), undefined, 'another edit is left alone')
  assert.equal(refreshRows({ current: [persona, fs], builtIn: [persona, fs, web], base: [persona, fs], preset: 'standard' }), undefined, 'a mode without the row is not touched')
})

test('the condition follows whether dsh-mode-skills resolves from the row base', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'dsh-mode-skills-guard-'))
  const base = { baseUrl: pathToFileURL(`${profile}/`).href }
  assert.equal(evaluate(base, WHEN_GONE), true, 'not installed: the row is off')
  await mkdir(join(profile, 'node_modules', 'dsh-mode-skills'), { recursive: true })
  await writeFile(join(profile, 'node_modules', 'dsh-mode-skills', 'package.json'), JSON.stringify({ name: 'dsh-mode-skills', exports: { './package.json': './package.json' } }))
  assert.equal(evaluate(base, WHEN_GONE), false, 'installed: the row runs')
  assert.equal(evaluate({}, WHEN_GONE), false, 'no base: the row stays on')
})

test('the package exports the files the rows and the condition name', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.name, 'dsh-mode-skills')
  assert.equal(manifest.exports['./package.json'], './package.json')
  assert.equal(manifest.exports['./policy'], './policy.js')
  for (const file of ['policy.js', 'mode-rows.js', 'rebase.js', 'state.js', 'fs-retry.js', 'skill-view.js']) assert.ok(manifest.files.includes(file), file)
})
