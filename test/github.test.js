import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commitOf, downloadArchive, inSkillDirs, parseGithub, skillDirsIn, wrapperOf } from '../github.js'

test('reads the addresses people paste', () => {
  const head = [{ ref: 'HEAD', path: '' }]
  assert.deepEqual(parseGithub('https://github.com/anthropics/skills'), { owner: 'anthropics', repo: 'skills', tries: head })
  assert.deepEqual(parseGithub('https://github.com/anthropics/skills.git'), { owner: 'anthropics', repo: 'skills', tries: head })
  assert.deepEqual(parseGithub('github.com/a/b/'), { owner: 'a', repo: 'b', tries: head })
  assert.deepEqual(parseGithub('git@github.com:a/b.git'), { owner: 'a', repo: 'b', tries: head })
  assert.deepEqual(parseGithub('a/b'), { owner: 'a', repo: 'b', tries: head })
  assert.deepEqual(parseGithub('a/b#v1.2'), { owner: 'a', repo: 'b', tries: [{ ref: 'v1.2', path: '' }] })
  assert.deepEqual(parseGithub('a/b/skills/pdf'), { owner: 'a', repo: 'b', tries: [{ ref: 'HEAD', path: 'skills/pdf' }] })
  assert.deepEqual(parseGithub('https://github.com/a/b/tree/main/skills/pdf').tries, [
    { ref: 'main', path: 'skills/pdf' },
    { ref: 'main/skills', path: 'pdf' },
    { ref: 'main/skills/pdf', path: '' },
  ])
  assert.deepEqual(parseGithub('https://github.com/a/b/blob/main/skills/pdf/SKILL.md').tries[0], { ref: 'main', path: 'skills/pdf' })
})

test('refuses addresses that name no repository', () => {
  for (const bad of ['', 'github', 'https://gitlab.com/a/b', 'https://github.com/a', 'https://github.com/a/b/issues', 'a/b/../x', '-a/b', 'a/b c', 'http://[bad']) {
    assert.throws(() => parseGithub(bad), error => error.code === 'github-url-invalid', bad)
  }
})

test('finds the outermost skill folders, under a folder if given, leaving out vendored code', () => {
  const paths = ['README.md', 'skills/pdf/SKILL.md', 'skills/pdf/examples/SKILL.md', 'skills/xlsx/SKILL.md', 'node_modules/x/SKILL.md', 'other/SKILL.md']
  assert.deepEqual(skillDirsIn(paths), { dirs: ['other', 'skills/pdf', 'skills/xlsx'], truncated: false })
  assert.deepEqual(skillDirsIn(paths, 'skills').dirs, ['skills/pdf', 'skills/xlsx'])
  assert.deepEqual(skillDirsIn(paths, 'skills/pdf').dirs, ['skills/pdf'])
  assert.deepEqual(skillDirsIn(['SKILL.md', 'extra/SKILL.md']).dirs, ['', 'extra'], 'a root skill does not hide the folders below')
  assert.equal(inSkillDirs('skills/pdf/a.py', ['skills/pdf']), true)
  assert.equal(inSkillDirs('skills/pdfs/a.py', ['skills/pdf']), false)
  assert.equal(inSkillDirs('node_modules/skills/pdf/a.py', ['node_modules/skills/pdf']), false)
  assert.equal(inSkillDirs('anything', ['']), true)
})

test('knows the wrapper folder of an archive and the commit in its comment', () => {
  assert.equal(wrapperOf(['skills-main/a', 'skills-main/b/c']), 'skills-main/')
  assert.equal(wrapperOf(['a/x', 'b/y']), '')
  assert.equal(wrapperOf([]), '')
  assert.equal(commitOf(`${'AB'.repeat(20)}\n`), 'ab'.repeat(20))
  assert.equal(commitOf('not a commit'), undefined)
})

test('downloads an archive, and words each way it can fail', async () => {
  const original = globalThis.fetch
  try {
    const seen = []
    globalThis.fetch = async (url) => { seen.push(String(url)); return new Response(Buffer.from('zipdata')) }
    assert.equal((await downloadArchive({ owner: 'a', repo: 'b', ref: 'feature/x y' })).toString(), 'zipdata')
    assert.deepEqual(seen, ['https://codeload.github.com/a/b/zip/feature/x%20y'])
    const fail = async (response, expected, limits) => {
      globalThis.fetch = typeof response === 'function' ? response : async () => response
      await assert.rejects(downloadArchive({ owner: 'a', repo: 'b', ref: 'HEAD' }, limits), error => error.code === expected, expected)
    }
    await fail(new Response('', { status: 404 }), 'github-not-found')
    await fail(new Response('', { status: 500 }), 'github-failed')
    await fail(() => Promise.reject(new TypeError('fetch failed')), 'github-network')
    await fail(new Response(Buffer.alloc(100)), 'github-too-large', { maxBytes: 50 })
    await fail(new Response(Buffer.alloc(100), { headers: { 'content-length': '100' } }), 'github-too-large', { maxBytes: 50 })
  } finally {
    globalThis.fetch = original
  }
})
