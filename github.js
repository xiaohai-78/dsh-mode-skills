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

/** The start of a `skills` CLI install command, as skills.sh shows it: `npx skills add <source> [--skill <name>]`. */
const SKILLS_COMMAND = /^(?:npx|bunx|pnpx|pnpm\s+dlx|yarn\s+dlx)\s+(?:(?:-y|--yes)\s+)?skills(?:@\S+)?\s+add\s+/i
/** A skill name as the `skills` CLI and skills.sh write it. */
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** The source and the skill a `skills add` command names; any other text is the source itself. */
function fromCommand(text) {
  const match = SKILLS_COMMAND.exec(text)
  if (match === null) return { address: text }
  const words = text.slice(match[0].length).trim().split(/\s+/).map(word => word.replace(/^['"]|['"]$/g, ''))
  let address = ''
  let skill
  for (let at = 0; at < words.length; at++) {
    const word = words[at]
    if (word === '--skill' || word === '-s') skill = words[++at]
    else if (word.startsWith('--skill=')) skill = word.slice('--skill='.length)
    else if (!word.startsWith('-') && address === '') address = word
  }
  return { address, ...skill !== undefined && SKILL_NAME.test(skill) ? { skill } : {} }
}

/** The ways to read a ref and folder from path segments that start with the ref; a branch name may contain `/`. */
function refTries(rest) {
  const tries = []
  for (let at = 1; at <= Math.min(4, rest.length); at++) tries.push({ ref: rest.slice(0, at).join('/'), path: folderOf(rest.slice(at)) })
  return tries
}

/**
 * Read an address the user pasted.
 * @param {string} input - a GitHub URL (`https://github.com/owner/repo`, with `/tree/<ref>/<folder>` or
 *   `/blob/<ref>/<folder>/SKILL.md` for a branch and folder), `github.com/owner/repo`, `git@github.com:owner/repo.git`,
 *   `ssh://git@github.com/owner/repo.git`, a `git+` form of these, a raw file link
 *   (`https://raw.githubusercontent.com/owner/repo/<ref>/<folder>/SKILL.md`), a skills.sh page
 *   (`https://skills.sh/owner/repo/<skill>`), a `skills` CLI command (`npx skills add owner/repo --skill <skill>`), or
 *   `owner/repo` with an optional `#ref` or `/folder`.
 * @returns {{ owner: string, repo: string, tries: { ref: string, path: string }[], skill?: string }} the repository,
 *   the ways to read its ref from the address, most likely first (`/tree/a/b/c` is `a` with folder `b/c`, or `a/b` with
 *   folder `c`, and so on; `HEAD` is the default branch), and the skill a skills.sh page or command names.
 * @throws {SkillFileError} `github-only` (with `host`) for an address on another host, and `github-url-invalid` when the
 *   address names no repository.
 */
export function parseGithub(input) {
  const invalid = () => refuse('github-url-invalid', `Not a GitHub repository address: ${String(input).slice(0, 200)}`)
  const elsewhere = host => refuse('github-only', `Only GitHub repositories can be read, not ${host}`, { host })
  const { address, skill } = fromCommand(String(input ?? '').trim())
  const text = address.replace(/^git\+/i, '')
  if (text === '') throw invalid()
  /** The repository and what follows it, checked; owners and repositories are names GitHub allows. */
  const repository = (segments) => {
    if (segments.length < 2) throw invalid()
    const owner = segments[0]
    const repo = segments[1].replace(/\.git$/i, '')
    if (!NAME.test(owner) || !NAME.test(repo) || repo === '.' || repo === '..') throw invalid()
    const tail = segments.slice(2)
    if (tail.some(part => part === '..' || part === '.')) throw invalid()
    return { owner, repo, tail }
  }
  const withSkill = parsed => (skill === undefined ? parsed : { ...parsed, skill })
  const scp = /^[\w.-]+@([^:/]+):(.+)$/.exec(text)
  if (scp !== null) {
    if (scp[1].toLowerCase() !== 'github.com') throw elsewhere(scp[1])
    const { owner, repo, tail } = repository(scp[2].split('/').filter(Boolean))
    if (tail.length > 0) throw invalid()
    return withSkill({ owner, repo, tries: [{ ref: 'HEAD', path: '' }] })
  }
  const schemed = /^(?:https?|ssh):\/\//i.test(text)
  const first = text.split(/[/#]/)[0]
  if (schemed || first.includes('.')) {
    let url
    try {
      url = new URL(schemed ? text : `https://${text}`)
    } catch {
      // A malformed address names no repository.
      throw invalid()
    }
    let segments
    try {
      segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    } catch {
      // An escape that does not decode cannot name a repository.
      throw invalid()
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'skills.sh') {
      const { owner, repo, tail } = repository(segments)
      const named = tail.length === 1 && SKILL_NAME.test(tail[0]) ? tail[0] : skill
      return { owner, repo, tries: [{ ref: 'HEAD', path: '' }], ...named === undefined ? {} : { skill: named } }
    }
    if (host === 'raw.githubusercontent.com') {
      const { owner, repo, tail } = repository(segments)
      if (tail.length === 0) throw invalid()
      return withSkill({ owner, repo, tries: refTries(tail) })
    }
    if (host !== 'github.com') throw elsewhere(url.hostname)
    const { owner, repo, tail } = repository(segments)
    if (tail.length === 0) return withSkill({ owner, repo, tries: [{ ref: 'HEAD', path: '' }] })
    if ((tail[0] !== 'tree' && tail[0] !== 'blob') || tail.length < 2) throw invalid()
    return withSkill({ owner, repo, tries: refTries(tail.slice(1)) })
  }
  const [path, hash] = text.split('#')
  const { owner, repo, tail } = repository(path.split('/').filter(Boolean))
  return withSkill({ owner, repo, tries: [{ ref: hash === undefined || hash === '' ? 'HEAD' : hash, path: folderOf(tail) }] })
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
