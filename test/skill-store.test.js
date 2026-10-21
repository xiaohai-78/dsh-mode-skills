import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isEditableSkill, nextVersionId, parseSkillFile, plainLines, withLineEndingsOf, withoutVersion } from '../skill-store.js'

test('numbers versions from the highest one, and a deleted number is not given out again', () => {
  assert.equal(nextVersionId(undefined), 'v1')
  assert.equal(nextVersionId([{ id: 'v1' }, { id: 'v7' }, { id: 'x' }]), 'v8')
  assert.equal(nextVersionId([{ id: 'v1' }], 3), 'v4', 'a deleted v3 is not given out again')
  const state = { version: 1, presets: {}, skills: { pdf: { versions: [{ id: 'v1' }, { id: 'v2' }] } } }
  const removed = withoutVersion(state, 'pdf', 'v2')
  assert.deepEqual(removed.skills.pdf.versions, [{ id: 'v1' }])
  assert.equal(removed.skills.pdf.lastVersion, 2)
  assert.equal(nextVersionId(removed.skills.pdf.versions, removed.skills.pdf.lastVersion), 'v3')
  assert.deepEqual(state.skills.pdf.versions, [{ id: 'v1' }, { id: 'v2' }], 'the input is not changed')
})

test('reads frontmatter scalars, quoted values, and block scalars, and returns the body after it', () => {
  const text = [
    '---',
    'name: pdf',
    'description: "Read and write PDF files: forms, tables"',
    'whenToUse: >-',
    '  When the user mentions',
    '  a PDF file.',
    'notes: |',
    '  line one',
    '  line two',
    'disable-model-invocation: yes',
    'metadata:',
    '  owner: me',
    '---',
    '# PDF',
    'Body text.',
  ].join('\n')
  const parsed = parseSkillFile(text)
  assert.equal(parsed.fields.name, 'pdf')
  assert.equal(parsed.fields.description, 'Read and write PDF files: forms, tables')
  assert.equal(parsed.fields.whenToUse, 'When the user mentions a PDF file.')
  assert.equal(parsed.fields.notes, 'line one\nline two')
  assert.equal(parsed.fields['disable-model-invocation'], 'yes')
  assert.equal(parsed.fields.owner, undefined)
  assert.equal(parsed.body, '# PDF\nBody text.')
  assert.deepEqual(parseSkillFile('No frontmatter here.'), { fields: {}, body: 'No frontmatter here.' })
})

test('reads a SKILL.md saved with Windows line endings', () => {
  const parsed = parseSkillFile('---\r\nname: pdf\r\ndescription: Read PDFs\r\n---\r\nBody line\r\n')
  assert.equal(parsed.fields.description, 'Read PDFs')
  assert.equal(parsed.body, 'Body line\r\n')
})

test('keeps a file\'s own line endings when a browser edit comes back with LF', () => {
  assert.equal(plainLines('a\r\nb\rc\n'), 'a\nb\nc\n')
  assert.equal(withLineEndingsOf('a\nb\n', 'x\r\ny\r\n'), 'a\r\nb\r\n')
  assert.equal(withLineEndingsOf('a\r\nb', 'x\ny'), 'a\nb')
})

test('treats skills inside node_modules as read-only on any platform', () => {
  assert.equal(isEditableSkill({ path: '/Users/me/.dsh/skills/pdf/SKILL.md', source: 'user-dsh' }), true)
  assert.equal(isEditableSkill({ path: 'C:\\Users\\me\\.dsh\\skills\\pdf\\SKILL.md', source: 'user-dsh' }), true)
  assert.equal(isEditableSkill({ path: 'C:\\Program Files\\dsh\\node_modules\\@deepseek-ai\\dsh-agent-preset\\skills\\x\\SKILL.md', source: 'custom' }), false)
  assert.equal(isEditableSkill({ path: '/opt/dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/x/SKILL.md', source: 'custom' }), false)
  assert.equal(isEditableSkill({ path: '/x/SKILL.md', source: 'bundled' }), false)
  assert.equal(isEditableSkill({ source: 'user-dsh' }), false)
  assert.equal(isEditableSkill({ path: '/x/SKILL.md', source: 'dsh-mode-skills' }), false)
})
