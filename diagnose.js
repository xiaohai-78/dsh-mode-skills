/**
 * Skill files in the user skill folders that DSH does not load, and why.
 *
 * DSH's filesystem provider writes a skipped file's reason to its log and leaves the skill out of every catalog, so a
 * folder holding a `SKILL.md` that no mode lists is skipped. The reason given here is the first rule the file breaks,
 * checked in the order DSH checks them: frontmatter present (the first line is exactly `---`), YAML that parses,
 * `name` and `description` given as text, a valid name, and invocation fields DSH accepts. The YAML check covers the
 * mistakes skill files commonly make, not the whole YAML grammar; a file that passes every check here but is still not
 * loaded is reported as `unknown`, and DSH's log has the reason.
 */
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { displayPath, suggestName, withName } from './skill-import.js'
import { SKILL_NAME } from './skill-store.js'

/** Frontmatter keys DSH refuses, with the key that replaces each. */
const LEGACY_KEYS = { disableModelInvocation: 'disable-model-invocation', modelInvocable: 'disable-model-invocation', userInvocable: 'user-invocable' }
const INVOCATION_KEYS = ['disable-model-invocation', 'user-invocable']
const BOOLEAN_WORDS = new Set(['true', 'false', 'yes', 'no', 'on', 'off', '1', '0'])
/** Plain YAML scalars that do not read as text. */
const NOT_TEXT = /^(?:~|null|true|false|[-+]?(?:\d[\d_]*)(?:\.\d+)?(?:e[-+]?\d+)?|0x[0-9a-f]+|\.inf|\.nan)$/i

/** Split a skill file into its frontmatter lines and the rest, the way DSH finds the frontmatter. */
function frontmatter(text) {
  const lines = text.split('\n')
  if (lines[0].replace(/\r$/, '') !== '---') return undefined
  const end = lines.findIndex((line, index) => index > 0 && line.replace(/\r$/, '') === '---')
  if (end < 0) return { lines: lines.slice(1).map(line => line.replace(/\r$/, '')), closed: false, end: lines.length }
  return { lines: lines.slice(1, end).map(line => line.replace(/\r$/, '')), closed: true, end }
}

/**
 * The top-level `key: value` fields of frontmatter lines, with whether each value is a plain (unquoted) scalar.
 * @returns {{ key: string, raw: string, line: number, plain: boolean, block: boolean }[]}
 */
function fields(lines) {
  const out = []
  for (let index = 0; index < lines.length; index++) {
    const match = /^([A-Za-z][\w-]*):(?:[ \t]+(.*))?$/.exec(lines[index])
    if (match === null) continue
    const raw = (match[2] ?? '').replace(/[ \t]+#.*$/, '').trim()
    out.push({ key: match[1], raw, line: index + 2, plain: raw !== '' && !/^["']/.test(raw) && !/^[|>]/.test(raw), block: /^[|>]/.test(raw) })
  }
  return out
}

/** The first YAML mistake among the common ones, or undefined. */
function yamlProblem(lines, entries) {
  const tab = lines.findIndex(line => /^\t/.test(line))
  if (tab >= 0) return { reason: 'yaml', detail: { line: tab + 2, what: 'tab' } }
  const seen = new Set()
  for (const entry of entries) {
    if (seen.has(entry.key)) return { reason: 'yaml', detail: { line: entry.line, what: 'duplicate', key: entry.key } }
    seen.add(entry.key)
    if (entry.plain && (/: /.test(entry.raw) || /:$/.test(entry.raw) || /^[@`*&!%]/.test(entry.raw))) {
      return { reason: 'yaml', detail: { line: entry.line, what: 'unquoted', key: entry.key } }
    }
    const quote = entry.raw[0]
    if ((quote === '"' || quote === '\'') && (entry.raw.length < 2 || !entry.raw.endsWith(quote))) {
      return { reason: 'yaml', detail: { line: entry.line, what: 'quote', key: entry.key } }
    }
  }
  return undefined
}

/**
 * The first rule a skill file breaks, in the order DSH checks them.
 * @param {string} text - the whole file.
 * @returns {{ reason: string, detail?: object } | undefined} `bom`, `no-frontmatter`, `yaml`, `missing-name`,
 *   `missing-description`, `not-text` (detail `key`), `name-invalid` (detail `name`), `legacy-key` (detail `key`),
 *   `invocation-invalid` (detail `key`); undefined when none applies.
 */
export function analyzeSkillText(text) {
  if (text.startsWith('﻿')) return { reason: 'bom' }
  const front = frontmatter(text)
  if (front === undefined || !front.closed) return { reason: 'no-frontmatter' }
  const entries = fields(front.lines)
  const yaml = yamlProblem(front.lines, entries)
  if (yaml !== undefined) return yaml
  const field = key => entries.find(entry => entry.key === key)
  for (const key of ['name', 'description']) {
    const entry = field(key)
    if (entry === undefined || entry.raw === '' || entry.raw === '""' || entry.raw === '\'\'') return { reason: `missing-${key}` }
    if (entry.plain && NOT_TEXT.test(entry.raw)) return { reason: 'not-text', detail: { key } }
    if (entry.plain && /^[[{]/.test(entry.raw)) return { reason: 'not-text', detail: { key } }
  }
  const name = field('name')
  const value = name.plain ? name.raw : name.raw.slice(1, -1)
  if (!name.block && !SKILL_NAME.test(value)) return { reason: 'name-invalid', detail: { name: value } }
  for (const legacy of Object.keys(LEGACY_KEYS)) {
    if (field(legacy) !== undefined) return { reason: 'legacy-key', detail: { key: legacy } }
  }
  for (const key of INVOCATION_KEYS) {
    const entry = field(key)
    if (entry === undefined) continue
    const word = (entry.plain ? entry.raw : entry.raw.slice(1, -1)).toLowerCase()
    if (!BOOLEAN_WORDS.has(word)) return { reason: 'invocation-invalid', detail: { key } }
  }
  return undefined
}

/** A YAML double-quoted scalar for any text. */
function quoted(value) {
  return JSON.stringify(value)
}

/**
 * The file with the mistakes this module can mend: the byte-order mark, unquoted values YAML misreads, a missing or
 * invalid name (taken from the folder), refused invocation keys, and a missing frontmatter block (whose description
 * is left empty for the user to write).
 * @param {string} text - the whole file.
 * @param {string} folder - the skill's folder name, for a name.
 * @returns {{ text: string, complete: boolean }} the mended text, and whether it now passes {@link analyzeSkillText}.
 */
export function proposeFix(text, folder) {
  const crlf = text.includes('\r\n')
  let next = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const name = suggestName(folder)
  if (frontmatter(next)?.closed !== true) next = `---\nname: ${name}\ndescription: ""\n---\n\n${next}`
  const lines = next.split('\n')
  const end = lines.findIndex((line, index) => index > 0 && line === '---')
  const seen = new Set()
  for (let index = 1; index < end; index++) {
    const match = /^([A-Za-z][\w-]*):(?:[ \t]+(.*))?$/.exec(lines[index])
    if (match === null) continue
    let [, key, raw = ''] = match
    raw = raw.trim()
    if (seen.has(key)) {
      lines[index] = `# ${lines[index]}`
      continue
    }
    seen.add(key)
    if (Object.hasOwn(LEGACY_KEYS, key)) {
      const flag = raw.toLowerCase()
      const value = key === 'modelInvocable' ? (['false', 'no', 'off', '0'].includes(flag) ? 'true' : 'false') : raw
      key = LEGACY_KEYS[key]
      lines[index] = `${key}: ${value}`
    }
    const plain = raw !== '' && !/^["'|>]/.test(raw)
    if (plain && (key === 'name' || key === 'description' || key === 'whenToUse') && (/: |:$/.test(raw) || /^[@`*&!%[{]/.test(raw) || NOT_TEXT.test(raw))) {
      lines[index] = `${key}: ${quoted(raw)}`
    }
  }
  next = lines.join('\n')
  const head = frontmatter(next)
  const keys = fields(head.lines).map(entry => entry.key)
  if (!keys.includes('name')) next = next.replace(/^---\n/, `---\nname: ${name}\n`)
  const current = fields(frontmatter(next).lines).find(entry => entry.key === 'name')
  const currentName = current.plain ? current.raw : current.raw.slice(1, -1)
  if (!SKILL_NAME.test(currentName)) next = withName(next, suggestName(currentName || folder))
  if (crlf) next = next.replace(/\n/g, '\r\n')
  return { text: next, complete: analyzeSkillText(next) === undefined }
}

/**
 * The skill files in `roots` that no mode lists.
 * @param {{ roots: { source: string, dir: string, skipSystem?: boolean }[], listedPaths: Set<string>, listedNames: Map<string, string | undefined>, now?: number, settleMs?: number }} input -
 *   the folders to read, the real paths of every skill file a mode lists, every listed name with its file (undefined
 *   for a setting entry such as a skill turned off), and how recent a change may be before it is reported.
 * @returns {Promise<object[]>} `{ root, path, display, folder, reason, detail?, fixable }` per skipped file; `shadowed`
 *   (detail `by`, the listed file) when another file with the same name wins.
 */
export async function findSkipped({ roots, listedPaths, listedNames, now = Date.now(), settleMs = 3000 }) {
  const out = []
  for (const root of roots) {
    let entries
    try {
      entries = await readdir(root.dir, { withFileTypes: true })
    } catch {
      // A root that does not exist holds nothing to report.
      continue
    }
    for (const entry of entries) {
      if (root.skipSystem && entry.name === '.system') continue
      const full = join(root.dir, entry.name)
      let info
      try {
        info = await stat(full)
      } catch {
        // A broken link: DSH logs it and moves on, and there is no file to mend.
        continue
      }
      const file = info.isDirectory() ? join(full, 'SKILL.md') : info.isFile() && entry.name.endsWith('.md') ? full : undefined
      if (file === undefined) continue
      let real
      let text
      try {
        if (!(await lstat(file)).isFile() && !(await stat(file)).isFile()) continue
        if (settleMs > 0 && now - (await stat(file)).mtimeMs < settleMs) continue
        real = await realpath(file)
        if (listedPaths.has(real)) continue
        text = await readFile(file, 'utf8')
      } catch {
        // A folder without SKILL.md is not a skill, and DSH skips it without a word.
        continue
      }
      const folder = info.isDirectory() ? entry.name : basename(entry.name, '.md')
      const base = { root: root.source, path: file, display: displayPath(file), folder }
      const problem = analyzeSkillText(text)
      if (problem !== undefined) {
        out.push({ ...base, ...problem, fixable: proposeFix(text, folder).text !== text })
        continue
      }
      const declared = /^name:[ \t]*["']?([^"'\r\n]*)["']?[ \t]*$/m.exec(text)?.[1]?.trim()
      if (declared !== undefined && listedNames.has(declared)) {
        const by = listedNames.get(declared)
        if (by !== undefined) out.push({ ...base, reason: 'shadowed', detail: { name: declared, by: displayPath(by) }, fixable: false })
        continue
      }
      out.push({ ...base, reason: 'unknown', fixable: false })
    }
  }
  return out
}
