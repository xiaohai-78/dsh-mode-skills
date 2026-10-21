import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CATALOG_DESCRIPTION_MAX, catalogLine, catalogTokens, estimateTokens, skillTokens } from '../tokens.js'

test('estimates 0.3 tokens per English character and 0.6 per Chinese one, rounded up', () => {
  assert.equal(estimateTokens(''), 0)
  assert.equal(estimateTokens('abcdefghij'), 3)
  assert.equal(estimateTokens('你好世界'), 3)
  assert.equal(estimateTokens('a，b'), 2, 'full-width punctuation counts as wide')
})

test('writes a catalog line the way DSH does: collapsed, cut at 500 characters, escaped', () => {
  assert.equal(catalogLine('pdf', '  Read\n and <write>   PDFs & forms '), '- `pdf`: Read and &lt;write&gt; PDFs &amp; forms')
  const long = catalogLine('x', 'a'.repeat(CATALOG_DESCRIPTION_MAX + 10))
  assert.equal(long, `- \`x\`: ${'a'.repeat(CATALOG_DESCRIPTION_MAX - 3)}...`)
})

test('a catalog costs nothing without skills, and its frame plus every line otherwise', () => {
  assert.equal(catalogTokens([]), 0)
  const one = catalogTokens([{ name: 'a', description: 'Review code changes' }])
  const two = catalogTokens([{ name: 'a', description: 'Review code changes' }, { name: 'b', description: '按团队规范审查代码改动' }])
  assert.ok(one > skillTokens('a', 'Review code changes'))
  assert.equal(two - one, skillTokens('b', '按团队规范审查代码改动'))
})
