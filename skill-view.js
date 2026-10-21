/**
 * Combines the skill catalogs of the agent modes into the one list the Skill Manager page shows.
 *
 * A mode's catalog is what that mode's sessions see without a workspace; the skill registry has already settled
 * duplicate names, so a name appears at most once per mode. The page lists each name once: its details come from the
 * first mode in roster order that has the skill file itself, and each mode reports how it treats the skill. Entries
 * that this plugin or dsh-modes registers to turn a skill off or pin it in one mode are read as that mode's setting,
 * not as the skill.
 */
import { homedir } from 'node:os'
import { sep } from 'node:path'
import { displayPath } from './skill-import.js'

/** Providers whose entries are a mode's skill setting: this plugin's policy row and dsh-modes's. */
export const POLICY_PROVIDERS = new Set(['dsh-mode-skills', 'dsh-modes'])

/**
 * How one mode treats a skill in its catalog.
 * @param {{ provider?: string, path?: string, invocation?: { modelInvocable?: boolean, userInvocable?: boolean } }} entry
 * @returns {'on' | 'manual' | 'model' | 'off' | 'pinned'} `off`: this plugin or dsh-modes turns it off here; `pinned`:
 *   dsh-modes serves a saved version here; `manual`: only the user can start it (this plugin's setting for the mode, or
 *   the skill's own `disable-model-invocation`); `model`: only the model can (this plugin's setting, or the skill's own
 *   `user-invocable: false`); `on` otherwise.
 */
export function modeState(entry) {
  const model = entry.invocation?.modelInvocable !== false
  const user = entry.invocation?.userInvocable !== false
  if (!model && !user && POLICY_PROVIDERS.has(entry.provider)) return 'off'
  if (entry.provider === 'dsh-modes') return 'pinned'
  return !model && user ? 'manual' : model && !user ? 'model' : 'on'
}

/**
 * The page's skill list from every mode's scan.
 * @param {{ id: string, skills?: object[], error?: string }[]} scans - one scan per mode, in roster order; `skills` are
 *   catalog entries (`name`, `description`, `path`, `source`, `provider`, `invocation`), `error` says why the mode
 *   could not be read.
 * @param {string} home - the user's home directory, for display paths.
 * @param {Record<string, object>} known - details last seen per skill name (the `info` of each state record), used for
 *   a skill that every mode lists only as a setting (turned off everywhere).
 * @returns {{ skills: object[], errors: Record<string, string> }} skills sorted by name, each with `modes` mapping a
 *   mode id to its {@link modeState}; a mode without the skill is left out of `modes`. A skill whose details come from
 *   its file carries `seen: true`. `errors` maps a mode id to the reason it could not be read.
 */
export function summarize(scans, home = homedir(), known = {}) {
  const byName = new Map()
  const errors = {}
  for (const scan of scans) {
    if (scan.error !== undefined) {
      errors[scan.id] = scan.error
      continue
    }
    for (const entry of scan.skills ?? []) {
      let skill = byName.get(entry.name)
      if (skill === undefined) {
        skill = { name: entry.name, modes: {} }
        byName.set(entry.name, skill)
      }
      skill.modes[scan.id] = modeState(entry)
      if (POLICY_PROVIDERS.has(entry.provider)) {
        if (skill.description === undefined) Object.assign(skill, known[entry.name] ?? details(entry, home))
      } else if (skill.seen !== true) {
        Object.assign(skill, details(entry, home), { seen: true })
      }
    }
  }
  return { skills: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)), errors }
}

/**
 * The details of a listed skill worth remembering for when every mode turns it off.
 * @param {object} skill - one skill of {@link summarize}.
 * @returns {object} its description, `whenToUse`, source, provider, and paths.
 */
export function remembered(skill) {
  const { name: _name, modes: _modes, seen: _seen, ...rest } = skill
  return rest
}

/**
 * Where an installed package keeps a skill: the path from the package name on, when the path runs through a
 * `node_modules` folder; undefined otherwise.
 * @param {string} path - an absolute path.
 * @returns {string | undefined} for example `@deepseek-ai/dsh-agent-preset/skills/x/SKILL.md`.
 */
export function packagePath(path) {
  const marker = `${sep}node_modules${sep}`
  const at = path.lastIndexOf(marker)
  return at === -1 ? undefined : path.slice(at + marker.length)
}

function details(entry, home) {
  const inPackage = typeof entry.path === 'string' ? packagePath(entry.path) : undefined
  return {
    description: entry.description,
    ...typeof entry.whenToUse === 'string' ? { whenToUse: entry.whenToUse } : {},
    source: entry.source,
    provider: entry.provider,
    ...typeof entry.path === 'string' ? { path: entry.path, display: inPackage ?? displayPath(entry.path, home) } : {},
    ...inPackage === undefined ? {} : { packaged: true },
  }
}
