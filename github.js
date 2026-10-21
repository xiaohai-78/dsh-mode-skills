/**
 * Skills on GitHub: what a pasted address names, the source archive it downloads, and the skill folders in it.
 *
 * An archive comes from `codeload.github.com`, which serves the files of a branch, tag, or commit as a zip without an
 * account or API quota. Its comment holds the commit the archive was cut from, which is what a later update check
 * compares. Only public repositories can be read; a private or missing repository answers the same way.
 */
import { SkillFileError } from './skill-files.js'

/** The most a downloaded archive may hold, in bytes. */
export const MAX_ARCHIVE_BYTES = 60 * 1024 * 1024
/** How long a download may take. */
const TIMEOUT_MS = 60 * 1000
/** The most skill folders one repository lists. */
const MAX_SKILLS = 300
/** An owner or repository name as GitHub allows it. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
/** The folders of a repository never searched for skills. */
const IGNORED = new Set(['node_modules', '.git'])

function refuse(code, message, details) {
  return new SkillFileError(code, message, details)
}

/**
 * Read an address the user pasted.
 * @param {string} input - a GitHub URL (`https://github.com/owner/repo`, with `/tree/<ref>/<folder>` for a branch and
 *   folder), `github.com/owner/repo`, `git@github.com:owner/repo.git`, or `owner/repo` with an optional `#ref` or
 *   `/folder`.
 * @returns {{ owner: string, repo: string, tries: { ref: string, path: string }[] }} the repository, and the ways to
 *   read its ref from the address, most likely first: a branch name may contain `/`, so `/tree/a/b/c` is `a` with
 *   folder `b/c`, or `a/b` with folder `c`, and so on. A ref of `HEAD` is the default branch.
 * @throws {SkillFileError} `github-url-invalid` when the address names no repository.
 */
export function parseGithub(input) {
  const invalid = () => refuse('github-url-invalid', `Not a GitHub repository address: ${String(input).slice(0, 200)}`)
  const text = String(input ?? '').trim()
  if (text === '') throw invalid()
  const ssh = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(text)
  let segments
  let hashRef
  if (ssh !== null) {
    segments = [ssh[1], ssh[2]]
  } else if (/^https?:\/\//i.test(text) || /^(?:www\.)?github\.com\//i.test(text)) {
    let url
    try {
      url = new URL(/^https?:/i.test(text) ? text : `https://${text}`)
    } catch {
      // A malformed address names no repository.
      throw invalid()
    }
    if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) throw invalid()
    try {
      segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    } catch {
      // An escape that does not decode cannot name a repository.
      throw invalid()
    }
  } else {
    const [path, hash] = text.split('#')
    segments = path.split('/').filter(Boolean)
    hashRef = hash === undefined || hash === '' ? undefined : hash
  }
  if (segments.length < 2) throw invalid()
  const owner = segments[0]
  const repo = segments[1].replace(/\.git$/i, '')
  if (!NAME.test(owner) || !NAME.test(repo) || repo === '.' || repo === '..') throw invalid()
  const tail = segments.slice(2)
  if (tail.some(part => part === '..' || part === '.')) throw invalid()
  if (/^https?:/i.test(text) || /^(?:www\.)?github\.com\//i.test(text)) {
    if (tail.length === 0) return { owner, repo, tries: [{ ref: 'HEAD', path: '' }] }
    if ((tail[0] !== 'tree' && tail[0] !== 'blob') || tail.length < 2) throw invalid()
    const rest = tail.slice(1)
    const tries = []
    for (let at = 1; at <= Math.min(4, rest.length); at++) tries.push({ ref: rest.slice(0, at).join('/'), path: folderOf(rest.slice(at)) })
    return { owner, repo, tries }
  }
  return { owner, repo, tries: [{ ref: hashRef ?? 'HEAD', path: folderOf(tail) }] }
}

/** The folder an address names: a link to a `SKILL.md` stands for its folder. */
function folderOf(parts) {
  const last = parts.at(-1)
  return (last === 'SKILL.md' ? parts.slice(0, -1) : parts).join('/')
}

/**
 * Download a repository's source archive.
 * @param {{ owner: string, repo: string, ref: string }} source - the repository and its branch, tag, commit, or `HEAD`.
 * @param {{ maxBytes?: number, timeoutMs?: number }} [limits] - the most bytes and the longest time to accept.
 * @returns {Promise<Buffer>} the zip archive.
 * @throws {SkillFileError} `github-not-found` (no such public repository or ref), `github-too-large`,
 *   `github-network`, or `github-failed` (any other answer, with `status`).
 */
export async function downloadArchive({ owner, repo, ref }, { maxBytes = MAX_ARCHIVE_BYTES, timeoutMs = TIMEOUT_MS } = {}) {
  const url = `https://codeload.github.com/${owner}/${repo}/zip/${ref.split('/').map(encodeURIComponent).join('/')}`
  let response
  try {
    response = await fetch(url, { headers: { 'user-agent': 'dsh-mode-skills' }, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    throw refuse('github-network', `Cannot reach GitHub: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (response.status === 404) {
    await response.body?.cancel()
    throw refuse('github-not-found', `No public repository or ref found at ${owner}/${repo}@${ref}`, { repo: `${owner}/${repo}`, ref })
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw refuse('github-failed', `GitHub answered ${response.status}`, { status: response.status })
  }
  const tooLarge = () => refuse('github-too-large', `The repository archive is larger than ${maxBytes} bytes`, { megabytes: Math.round(maxBytes / 1024 / 1024) })
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel()
    throw tooLarge()
  }
  const chunks = []
  let total = 0
  try {
    for await (const chunk of response.body) {
      total += chunk.length
      if (total > maxBytes) throw tooLarge()
      chunks.push(chunk)
    }
  } catch (error) {
    if (error instanceof SkillFileError) throw error
    throw refuse('github-network', `The download from GitHub was interrupted: ${error instanceof Error ? error.message : String(error)}`)
  }
  return Buffer.concat(chunks)
}

/**
 * The commit an archive was cut from.
 * @param {string} comment - the archive comment.
 * @returns {string | undefined} the 40-digit commit id, or undefined when the comment holds none.
 */
export function commitOf(comment) {
  return /^[0-9a-f]{40}$/i.test(comment.trim()) ? comment.trim().toLowerCase() : undefined
}

/**
 * The folder every file of an archive sits in: GitHub wraps a repository in `<repo>-<ref>/`.
 * @param {string[]} paths - the archive's file paths.
 * @returns {string} the shared first segment with its slash, or an empty string when the paths have none.
 */
export function wrapperOf(paths) {
  if (paths.length === 0) return ''
  const first = paths[0].split('/')[0]
  return paths.every(path => path.startsWith(`${first}/`)) ? `${first}/` : ''
}

/** Whether a repository path lies in a folder searched for skills. */
function searchable(path) {
  return !path.split('/').some(part => IGNORED.has(part))
}

/**
 * The skill folders of a repository: every folder that holds a `SKILL.md`, outermost first. A folder inside another
 * skill's folder belongs to that skill; a `SKILL.md` at the repository root stands for the root and does not hide the
 * folders below it.
 * @param {string[]} paths - the repository's file paths, relative to its root.
 * @param {string} [under] - a folder to search in (and including); empty for the whole repository.
 * @returns {{ dirs: string[], truncated: boolean }} the folders relative to the root (empty string for the root itself),
 *   sorted, at most {@link MAX_SKILLS}, and whether more were left out.
 */
export function skillDirsIn(paths, under = '') {
  const found = new Set()
  for (const path of paths) {
    if (path !== 'SKILL.md' && !path.endsWith('/SKILL.md')) continue
    const dir = path === 'SKILL.md' ? '' : path.slice(0, -'/SKILL.md'.length)
    if (!searchable(dir)) continue
    if (under === '' || dir === under || dir.startsWith(`${under}/`)) found.add(dir)
  }
  const outer = [...found].filter(dir => ![...found].some(other => other !== '' && other !== dir && dir.startsWith(`${other}/`)))
  outer.sort()
  return { dirs: outer.slice(0, MAX_SKILLS), truncated: outer.length > MAX_SKILLS }
}

/**
 * Whether a repository path belongs to one of the skill folders.
 * @param {string} path - a path relative to the repository root.
 * @param {string[]} dirs - skill folders from {@link skillDirsIn}.
 * @returns {boolean} true for a file inside a folder (any file, for the root).
 */
export function inSkillDirs(path, dirs) {
  return searchable(path) && dirs.some(dir => dir === '' || path.startsWith(`${dir}/`))
}
