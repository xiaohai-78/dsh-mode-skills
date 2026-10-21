/**
 * The skill store: search on skills.sh, and a short list of well-known skill repositories that ships with the plugin.
 *
 * skills.sh answers `GET https://skills.sh/api/search?q=<text>&limit=<n>` (at least two characters) with the skills that
 * match and how often each was installed through its CLI; this is the request that CLI makes, and it needs no account.
 * A result names a GitHub repository (`source`) and a skill in it (`skillId`); the page installs it through the GitHub
 * flow, which reads the repository and asks before copying anything. Results whose source is not an `owner/repo` pair,
 * such as a skill published from another host, are left out.
 */
import { readFile } from 'node:fs/promises'
import { SkillFileError } from './skill-files.js'

const SEARCH_URL = 'https://skills.sh/api/search'
const TIMEOUT_MS = 20 * 1000
/** Most results one search returns. */
export const SEARCH_LIMIT = 40
/** Shortest search text skills.sh accepts. */
export const QUERY_MIN_CHARS = 2
/** Longest search text sent. */
export const QUERY_MAX_CHARS = 100
/** An `owner/repo` source as GitHub names repositories. */
const REPO = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/
/** A skill id as a folder or skill name. */
const SKILL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function refuse(code, message, details) {
  return new SkillFileError(code, message, details)
}

/**
 * Search skills.sh.
 * @param {string} query - the text to look for.
 * @returns {Promise<{ id: string, repo: string, skill: string, installs: number }[]>} the results in skills.sh's order.
 * @throws {SkillFileError} `store-query-short`, `store-network`, `store-rate-limited`, or `store-failed` (with `status`).
 */
export async function searchStore(query) {
  const text = String(query ?? '').trim().slice(0, QUERY_MAX_CHARS)
  if ([...text].length < QUERY_MIN_CHARS) throw refuse('store-query-short', `Type at least ${QUERY_MIN_CHARS} characters`, { min: QUERY_MIN_CHARS })
  let response
  try {
    response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(text)}&limit=${SEARCH_LIMIT}`, { headers: { 'user-agent': 'dsh-mode-skills', accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    throw refuse('store-network', `Cannot reach skills.sh: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (response.status === 429) {
    await response.body?.cancel()
    throw refuse('store-rate-limited', 'skills.sh asked to slow down; try again in a moment')
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw refuse('store-failed', `skills.sh answered ${response.status}`, { status: response.status })
  }
  let body
  try {
    body = await response.json()
  } catch {
    // An answer that is not JSON is a failure of the service, not of the search.
    throw refuse('store-failed', 'skills.sh sent an answer this plugin cannot read', { status: response.status })
  }
  const results = []
  for (const item of Array.isArray(body?.skills) ? body.skills : []) {
    if (typeof item?.source !== 'string' || typeof item.skillId !== 'string' || !REPO.test(item.source) || !SKILL_ID.test(item.skillId)) continue
    results.push({ id: `${item.source}/${item.skillId}`, repo: item.source, skill: item.skillId, installs: Number.isFinite(item.installs) ? item.installs : 0 })
  }
  return results
}

/**
 * The repositories that ship with the plugin.
 * @returns {Promise<{ repo: string, zh: string, en: string, note?: { zh: string, en: string } }[]>} each repository with a
 *   one-line description in both languages, and a note where it needs something besides the skills themselves.
 */
export async function storeIndex() {
  const index = JSON.parse(await readFile(new URL('./store-index.json', import.meta.url), 'utf8'))
  return index.repos.filter(entry => REPO.test(entry.repo))
}
