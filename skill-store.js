/**
 * Pure rules for the skill library: version ids, reading a skill file's frontmatter, line endings, and which skills the
 * page may change. The same rules as dsh-modes, so the two plugins read and number skills alike.
 *
 * The state file keeps, per skill name, `{ info, imported, versions, lastVersion }` (state.js): the details the skill had
 * when last seen, where an import copied it from, and its saved versions.
 */

/** The skill name grammar of the DSH skill registry. */
export const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Version ids: `v1`, `v2`, … per skill. */
export const VERSION_ID = /^v[1-9][0-9]{0,5}$/
/** Longest note on a version, in characters. */
export const NOTE_MAX_CHARS = 200

/**
 * The next version id for a skill. A deleted version's id is never given out again, so a note or a memory of `v3`
 * always means the same content.
 * @param {{ id: string }[] | undefined} versions - the skill's stored versions.
 * @param {number} [last] - the highest number ever given out for this skill.
 * @returns {string} `v<n>`, one above both.
 */
export function nextVersionId(versions, last = 0) {
  const highest = Math.max(0, Number.isInteger(last) ? last : 0, ...(versions ?? []).map(version => Number(VERSION_ID.test(version.id) ? version.id.slice(1) : 0)))
  return `v${highest + 1}`
}

/**
 * Remove a version from a skill's record, remembering the highest number given out so it is not reused.
 * @param {object} state - the parsed state file; left unchanged.
 * @returns {object} the changed state.
 */
export function withoutVersion(state, skill, version) {
  const next = structuredClone(state)
  const record = next.skills?.[skill]
  if (record?.versions !== undefined) {
    const numbers = [...record.versions.map(entry => entry.id), version].filter(id => VERSION_ID.test(id)).map(id => Number(id.slice(1)))
    record.lastVersion = Math.max(record.lastVersion ?? 0, ...numbers)
    record.versions = record.versions.filter(entry => entry.id !== version)
  }
  return next
}

/** Remove one surrounding pair of matching quotes from a YAML scalar. */
function unquote(value) {
  const text = value.trim()
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\'') && text.endsWith('\'')))) {
    return text.startsWith('"') ? text.slice(1, -1).replace(/\\(["\\nt])/g, (_, escaped) => ({ n: '\n', t: '\t' })[escaped] ?? escaped) : text.slice(1, -1).replace(/''/g, '\'')
  }
  return text
}

/**
 * Read a skill file's frontmatter scalars and body. Supports the forms SKILL.md files use: `key: value`, quoted values,
 * and `|` or `>` block scalars; anything else is left out.
 * @param {string} text - the whole SKILL.md (or flat `<name>.md`) file.
 * @returns {{ fields: Record<string, string>, body: string }} top-level string fields and the text after the frontmatter;
 *   without frontmatter, no fields and the whole text.
 */
export function parseSkillFile(text) {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (match === null) return { fields: {}, body: text }
  const fields = {}
  const lines = match[1].split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = /^([A-Za-z][\w-]*):(?:[ \t]+(.*))?$/.exec(lines[index])
    if (line === null) continue
    const [, key, raw = ''] = line
    const block = /^([|>])([+-]?)\s*$/.exec(raw.trim())
    if (block === null) {
      if (raw.trim() !== '') fields[key] = unquote(raw)
      continue
    }
    const collected = []
    while (index + 1 < lines.length && (lines[index + 1].trim() === '' || /^[ \t]/.test(lines[index + 1]))) collected.push(lines[++index])
    const indent = Math.min(...collected.filter(entry => entry.trim() !== '').map(entry => /^[ \t]*/.exec(entry)[0].length))
    const rows = collected.map(entry => entry.slice(Number.isFinite(indent) ? indent : 0))
    const joined = block[1] === '|' ? rows.join('\n') : rows.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ')
    fields[key] = block[2] === '+' ? joined : joined.replace(/\s+$/, '')
  }
  return { fields, body: text.slice(match[0].length) }
}

/**
 * Text with LF line endings, for comparing a file with what a browser text area returns.
 * @param {string} text - any text.
 * @returns {string} the text with CRLF and CR turned into LF.
 */
export function plainLines(text) {
  return text.replace(/\r\n?/g, '\n')
}

/**
 * Text written with the line endings a file already uses, so an edit made in a browser does not turn a CRLF file into LF.
 * @param {string} text - the new content.
 * @param {string} current - the file's content now.
 * @returns {string} `text` with CRLF endings when `current` uses them, LF endings otherwise.
 */
export function withLineEndingsOf(text, current) {
  const plain = plainLines(text)
  return current.includes('\r\n') ? plain.replace(/\n/g, '\r\n') : plain
}

/**
 * Whether the page may change a skill's files: a local file that no package owns. Skills inside `node_modules` belong to
 * DSH or a plugin, and a reinstall would replace any change.
 * @param {{ path?: string, source?: string } | undefined} info - the skill's details.
 * @returns {boolean} false for packaged skills, the entries of a skill policy row, and skills without a file.
 */
export function isEditableSkill(info) {
  return typeof info?.path === 'string' && !['bundled', 'dsh-modes', 'dsh-mode-skills'].includes(info.source) && !/[\\/]node_modules[\\/]/.test(info.path)
}
