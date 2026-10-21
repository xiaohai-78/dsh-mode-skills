/**
 * The one row this plugin adds to a mode, and how a mode's row list changes around it.
 *
 * A mode with skills turned off gets the policy row (policy.js) in its profile override. Writing an override copies
 * the mode's whole row list, so later DSH updates to the built-in rows are merged in with rebase.js against the
 * built-in rows recorded at the last save. The row is saved with a `disabled` condition that is true once
 * `dsh-mode-skills` no longer resolves from the row's resolution base: an uninstall then leaves the row switched off
 * instead of breaking the mode, since DSH rejects a whole mode when one of its rows cannot be imported. When the check
 * cannot tell (any failure other than a missing package), the row stays on.
 */
import { rebase, same } from './rebase.js'

export const POLICY_MODULE = 'dsh-mode-skills/policy'
export const POLICY_ROW_ID = 'dsh-mode-skills-policy'

/** Every condition this module writes starts with this comment, which is how a saved condition is recognized. */
const MARK = '/* dsh-mode-skills: '
const INSTALLED = "(() => { try { process.getBuiltinModule('node:module').createRequire(baseUrl).resolve('dsh-mode-skills/package.json'); return true } catch (error) { return error?.code !== 'MODULE_NOT_FOUND' } })()"
/** `disabled` of the policy row: true once dsh-mode-skills is uninstalled. */
export const WHEN_GONE = `${MARK}off once dsh-mode-skills is uninstalled */ !${INSTALLED}`

function isExpr(value) {
  return value !== null && typeof value === 'object' && typeof value.__jsExpr === 'string'
}

/** Whether a `disabled` value is a condition this module wrote. */
export function isGuard(value) {
  return isExpr(value) && value.__jsExpr.startsWith(MARK)
}

/** Whether a module belongs to this package. */
export function isOwnModule(name) {
  return typeof name === 'string' && name.startsWith('dsh-mode-skills/')
}

/** Whether the list holds the policy row, at the top level or inside a group. */
export function hasPolicyRow(rows) {
  return (Array.isArray(rows) ? rows : []).some(row => row?.id === POLICY_ROW_ID || (row?.group === true && hasPolicyRow(row.config)))
}

function withoutPolicyRow(rows) {
  return rows
    .filter(row => row?.id !== POLICY_ROW_ID)
    .map(row => (row?.group === true && Array.isArray(row.config) ? { ...row, config: withoutPolicyRow(row.config) } : row))
}

/**
 * A mode's rows with or without the policy row, the row guarded as described above.
 * @param {object[]} rows - the mode's rows.
 * @param {string} preset - the mode id, which the row reads as `config.preset`.
 * @param {boolean} wanted - whether the mode has skills turned off.
 * @returns {object[]} a new list with the row last when wanted; the input is not changed.
 */
export function withPolicyRow(rows, preset, wanted) {
  const rest = withoutPolicyRow(rows)
  return wanted ? [...rest, { id: POLICY_ROW_ID, name: POLICY_MODULE, config: { preset }, disabled: { __jsExpr: WHEN_GONE } }] : rest
}

/**
 * The rows to save for a mode.
 * @param {{ current: object[], builtIn: object[], base?: object[], preset: string, wanted: boolean }} input - the mode's
 *   rows now (its override, or the built-in rows when it has none), its latest built-in rows, the built-in rows of the
 *   last merge (unknown for an override this plugin did not write), the mode id, and whether the row is wanted.
 * @returns {{ rows: object[], builtIn: boolean }} the rows, merged onto the latest built-in rows first when a base is
 *   known; `builtIn` is true when they equal the built-in rows, so the override can go.
 */
export function planRows({ current, builtIn, base, preset, wanted }) {
  const merged = base === undefined || same(base, builtIn) ? current : rebase(current, builtIn, base, { keep: row => isOwnModule(row.name) }).rows
  const rows = withPolicyRow(merged, preset, wanted)
  return { rows, builtIn: same(rows, builtIn) }
}

/**
 * The rows that bring an override this plugin wrote up to date with new built-in rows, when the override is nothing
 * but the recorded built-in rows plus the policy row (or that row without its condition). Any other difference is
 * someone else's edit, which this plugin leaves to the next save or to dsh-modes.
 * @param {{ current: object[], builtIn: object[], base?: object[], preset: string }} input - as for {@link planRows}.
 * @returns {object[] | undefined} the rows to save, or undefined when nothing should change.
 */
export function refreshRows({ current, builtIn, base, preset }) {
  if (!hasPolicyRow(current)) return undefined
  const wanted = withPolicyRow(builtIn, preset, true)
  if (same(current, wanted)) return undefined
  if (base === undefined) return same(withoutPolicyRow(current), builtIn) ? wanted : undefined
  return same(withoutPolicyRow(current), base) ? wanted : undefined
}
