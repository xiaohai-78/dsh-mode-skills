import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')

/** The entries of one dictionary literal in client.js. */
function dictionary(name) {
  const start = source.indexOf(`const ${name} = {`)
  const end = source.indexOf('\n    }\n', start)
  return new Map([...source.slice(start, end).matchAll(/^\s{6}'([^']+)': '((?:[^'\\]|\\.)*)',$/gm)].map(match => [match[1], match[2]]))
}

const zh = dictionary('ZH')
const en = dictionary('EN')
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

test('both languages have the same keys', () => {
  assert.ok(zh.size > 300)
  assert.deepEqual([...zh.keys()].filter(key => !en.has(key)), [])
  assert.deepEqual([...en.keys()].filter(key => !zh.has(key)), [])
})

test('both languages use the same {placeholders} for each key', () => {
  for (const [key, text] of zh) assert.deepEqual(placeholders(text), placeholders(en.get(key)), key)
})

test('every key the page names literally exists', () => {
  const used = new Set([...source.matchAll(/\bt\(\s*'([A-Za-z0-9_.-]+)'/g)].map(match => match[1]))
  assert.ok(used.size > 200)
  assert.deepEqual([...used].filter(key => !zh.has(key)), [])
})

test('the store box opens what the Host reads as an address and searches for words', async () => {
  const { parseGithub } = await import('../github.js')
  const literal = /const ADDRESS = (\/.+\/[a-z]*)\r?\n/.exec(source)[1]
  const address = new Function(`return ${literal}`)()
  for (const text of [
    'https://github.com/anthropics/skills',
    'github.com/anthropics/skills/tree/main/skills/pdf',
    'git@github.com:anthropics/skills.git',
    'git+https://github.com/anthropics/skills.git',
    'https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md',
    'https://skills.sh/anthropics/skills/pdf',
    'skills.sh/anthropics/skills/pdf',
    'npx skills add anthropics/skills --skill pdf',
    'pnpm dlx skills add https://github.com/anthropics/skills',
    'anthropics/skills',
    'anthropics/skills#main',
  ]) {
    assert.ok(address.test(text), text)
    assert.doesNotThrow(() => parseGithub(text), text)
  }
  for (const text of ['pdf', 'code review', 'database migrations', 'ui / ux', 'c++']) assert.ok(!address.test(text), text)
})
