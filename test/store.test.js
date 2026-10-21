import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchStore, storeIndex } from '../store.js'

async function withFetch(handler, run) {
  const original = globalThis.fetch
  globalThis.fetch = handler
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

test('searches skills.sh and keeps the results that name a GitHub repository and a skill', async () => {
  const seen = []
  const body = { skills: [
    { id: 'anthropics/skills/pdf', source: 'anthropics/skills', skillId: 'pdf', name: 'pdf', installs: 214047 },
    { id: 'open.feishu.cn/lark-doc', source: 'open.feishu.cn', skillId: 'lark-doc', installs: 5 },
    { source: 'a/b', skillId: '../escape', installs: 1 },
    { source: 'o/r', skillId: 'ok', installs: 'many' },
    null,
  ] }
  const results = await withFetch(async (url, options) => { seen.push([String(url), options.headers['user-agent']]); return Response.json(body) }, () => searchStore(' 文档 pdf '))
  assert.deepEqual(seen, [[`https://skills.sh/api/search?q=${encodeURIComponent('文档 pdf')}&limit=40`, 'dsh-mode-skills']])
  assert.deepEqual(results, [
    { id: 'anthropics/skills/pdf', repo: 'anthropics/skills', skill: 'pdf', installs: 214047 },
    { id: 'o/r/ok', repo: 'o/r', skill: 'ok', installs: 0 },
  ])
})

test('words each way a search can fail', async () => {
  const fail = (handler, code) => withFetch(handler, () => assert.rejects(searchStore('pdf'), error => error.code === code, code))
  await fail(async () => new Response('', { status: 429 }), 'store-rate-limited')
  await fail(async () => new Response('', { status: 500 }), 'store-failed')
  await fail(async () => new Response('<html>', { status: 200 }), 'store-failed')
  await fail(() => Promise.reject(new TypeError('fetch failed')), 'store-network')
  await assert.rejects(searchStore('a'), error => error.code === 'store-query-short')
  await assert.rejects(searchStore(' 文 '), error => error.code === 'store-query-short', 'two characters, not two bytes')
})

test('ships a repository list with a description in both languages for every entry', async () => {
  const repos = await storeIndex()
  assert.ok(repos.length >= 5)
  assert.equal(new Set(repos.map(entry => entry.repo)).size, repos.length, 'no repository twice')
  for (const entry of repos) {
    assert.match(entry.repo, /^[\w.-]+\/[\w.-]+$/)
    assert.ok(entry.zh.length > 0 && entry.en.length > 0, entry.repo)
    if (entry.note !== undefined) assert.ok(entry.note.zh && entry.note.en, `${entry.repo} note`)
  }
})
