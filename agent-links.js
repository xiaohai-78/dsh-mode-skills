/**
 * Skills for every agent tool on this computer.
 *
 * A skill for every agent has one copy in the shared folder (`~/.agents/skills`), which DSH and some tools read
 * themselves. Each other installed tool gets a link to that copy in its own skills folder, so an edit made anywhere
 * reaches every tool. The `skills` CLI (`npx skills add -g`) makes the same layout, so each understands the other's
 * links. On Windows the links are directory junctions, which need no administrator rights.
 */
import { lstat, mkdir, realpath, rmdir, stat, symlink, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fingerprint } from './skill-import.js'

/**
 * The agent tools whose user skills folder is known, as the `skills` CLI lists them: a tool counts as installed when
 * one of its `homes` exists, and reads user skills from `dir`.
 * @param {Record<string, string | undefined>} env - the process environment.
 * @param {string} home - the user's home directory.
 * @returns {{ id: string, label: string, homes: string[], dir: string }[]} the tools.
 */
export function knownAgents(env = process.env, home = homedir()) {
  const config = env.XDG_CONFIG_HOME || join(home, '.config')
  const claude = env.CLAUDE_CONFIG_DIR || join(home, '.claude')
  const shared = join(home, '.agents', 'skills')
  /** A tool kept in `~/.<folder>` that reads `~/.<folder>/skills`. */
  const dotted = (id, label, folder, ...also) => ({ id, label, homes: [join(home, folder), ...also.map(other => join(home, other))], dir: join(home, folder, 'skills') })
  return [
    { id: 'claude-code', label: 'Claude Code', homes: [claude], dir: join(claude, 'skills') },
    { id: 'codex', label: 'Codex', homes: [env.CODEX_HOME || join(home, '.codex')], dir: shared },
    dotted('cursor', 'Cursor', '.cursor'),
    dotted('gemini-cli', 'Gemini CLI', '.gemini'),
    { id: 'antigravity', label: 'Antigravity', homes: [join(home, '.gemini', 'antigravity')], dir: join(home, '.gemini', 'antigravity', 'skills') },
    dotted('github-copilot', 'GitHub Copilot', '.copilot'),
    { id: 'opencode', label: 'OpenCode', homes: [join(config, 'opencode')], dir: join(config, 'opencode', 'skills') },
    { id: 'windsurf', label: 'Windsurf', homes: [join(home, '.codeium', 'windsurf')], dir: join(home, '.codeium', 'windsurf', 'skills') },
    { id: 'amp', label: 'Amp', homes: [join(config, 'amp')], dir: join(config, 'agents', 'skills') },
    { id: 'cline', label: 'Cline', homes: [join(home, '.cline')], dir: shared },
    { id: 'warp', label: 'Warp', homes: [join(home, '.warp')], dir: shared },
    { id: 'zed', label: 'Zed', homes: [join(config, 'zed')], dir: shared },
    { id: 'kimi-code-cli', label: 'Kimi Code CLI', homes: [join(home, '.kimi-code'), join(home, '.kimi')], dir: shared },
    { id: 'pi', label: 'Pi', homes: [join(home, '.pi', 'agent')], dir: shared },
    dotted('qwen-code', 'Qwen Code', '.qwen'),
    dotted('trae', 'Trae', '.trae'),
    dotted('trae-cn', 'Trae CN', '.trae-cn'),
    dotted('codebuddy', 'CodeBuddy', '.codebuddy'),
    dotted('lingma', 'Lingma', '.lingma'),
    dotted('qoder', 'Qoder', '.qoder'),
    dotted('iflow-cli', 'iFlow CLI', '.iflow'),
    dotted('kiro-cli', 'Kiro CLI', '.kiro'),
    dotted('roo', 'Roo Code', '.roo'),
    dotted('kilo', 'Kilo Code', '.kilo', '.kilocode'),
    dotted('augment', 'Augment', '.augment'),
    dotted('continue', 'Continue', '.continue'),
    { id: 'goose', label: 'Goose', homes: [join(config, 'goose')], dir: join(config, 'goose', 'skills') },
    dotted('droid', 'Droid', '.factory'),
    dotted('junie', 'Junie', '.junie'),
    dotted('openhands', 'OpenHands', '.openhands'),
    { id: 'crush', label: 'Crush', homes: [join(home, '.config', 'crush')], dir: join(home, '.config', 'crush', 'skills') },
    dotted('zcode', 'ZCode', '.zcode'),
  ]
}

async function isDirectory(path) {
  return stat(path).then(info => info.isDirectory(), () => false)
}

/** A path with its links resolved; a part that does not exist yet is kept as written below its nearest parent. */
async function real(path) {
  try {
    return await realpath(path)
  } catch {
    // A folder that does not exist yet is compared by where it would be created.
    const parent = dirname(path)
    return parent === path ? path : join(await real(parent), basename(path))
  }
}

/**
 * The agent tools installed on this computer, in {@link knownAgents} order.
 * @param {string} shared - the shared skills folder DSH reads (`~/.agents/skills` unless `DSH_AGENTS_HOME` moves it).
 * @param {Record<string, string | undefined>} [env] - the process environment.
 * @param {string} [home] - the user's home directory.
 * @returns {Promise<{ id: string, label: string, dir: string, via: 'shared' | 'link' }[]>} each tool, its skills folder,
 *   and `via`: `shared` when that folder is the shared folder (or a link to it), so the tool reads shared skills as they
 *   are; `link` when the tool needs a link to each one.
 */
export async function installedAgents(shared, env = process.env, home = homedir()) {
  const sharedAt = await real(shared)
  const found = []
  for (const agent of knownAgents(env, home)) {
    let installed = false
    for (const dir of agent.homes) installed ||= await isDirectory(dir)
    if (installed) found.push({ id: agent.id, label: agent.label, dir: agent.dir, via: await real(agent.dir) === sharedAt ? 'shared' : 'link' })
  }
  return found
}

/**
 * Whether each installed tool can use a skill.
 * @param {string} root - the skill's folder.
 * @param {{ id: string, dir: string, via: string }[]} agents - from {@link installedAgents}.
 * @param {string} shared - the shared skills folder.
 * @returns {Promise<Record<string, 'shared' | 'linked' | 'missing' | 'same' | 'own'>>} per tool id: `shared` (it reads
 *   the shared folder, which holds the skill), `linked` (its folder links to the skill), `missing` (nothing there, or a
 *   link to nowhere: a link can be made), `same` (its own copy with the same files: it can become a link), or `own` (a
 *   different skill of its own with that name, which is left alone).
 */
export async function reachOf(root, agents, shared) {
  const target = await real(root)
  const inShared = await real(dirname(root)) === await real(shared)
  const name = basename(root)
  let content
  const reach = {}
  for (const agent of agents) {
    if (agent.via === 'shared') {
      reach[agent.id] = inShared ? 'shared' : 'missing'
      continue
    }
    const entry = join(agent.dir, name)
    let info
    try {
      info = await lstat(entry)
    } catch {
      // Nothing with the skill's name in that tool's folder.
      reach[agent.id] = 'missing'
      continue
    }
    const resolved = await realpath(entry).catch(() => undefined)
    if (resolved === target) reach[agent.id] = 'linked'
    else if (resolved === undefined) reach[agent.id] = info.isSymbolicLink() ? 'missing' : 'own'
    else if (info.isSymbolicLink() || !info.isDirectory()) reach[agent.id] = 'own'
    else {
      content ??= (await fingerprint(root)).content
      reach[agent.id] = (await fingerprint(entry).catch(() => ({}))).content === content ? 'same' : 'own'
    }
  }
  return reach
}

/**
 * Link a skill into a tool's skills folder, creating the folder when needed. A link there that leads nowhere is
 * replaced; anything else with the skill's name is refused.
 * @param {{ dir: string }} agent - the tool.
 * @param {string} root - the skill's folder.
 * @param {{ platform?: string }} [options] - the platform to behave as.
 * @returns {Promise<string>} the link's path.
 */
export async function linkSkill(agent, root, { platform = process.platform } = {}) {
  const entry = join(agent.dir, basename(root))
  await mkdir(agent.dir, { recursive: true })
  const info = await lstat(entry).catch(() => undefined)
  if (info !== undefined) {
    if (!info.isSymbolicLink() || await realpath(entry).then(() => true, () => false)) throw Object.assign(new Error(`${entry} already exists`), { code: 'EEXIST' })
    await removeLink(entry)
  }
  // Relative from where the link really sits, so it survives a moved home folder; a junction needs an absolute target.
  if (platform === 'win32') await symlink(resolve(root), entry, 'junction')
  else await symlink(relative(await real(agent.dir), resolve(root)), entry)
  return entry
}

/**
 * Remove a link to a skill. Only a link is removed, never a folder or file.
 * @param {string} entry - the link's path.
 * @returns {Promise<void>} settles once the link is gone.
 */
export async function removeLink(entry) {
  if (!(await lstat(entry)).isSymbolicLink()) throw Object.assign(new Error(`${entry} is not a link`), { code: 'ENOTLINK' })
  try {
    await unlink(entry)
  } catch (error) {
    // Windows may refuse to unlink a directory junction that rmdir removes.
    if (error?.code !== 'EPERM' && error?.code !== 'EISDIR') throw error
    await rmdir(entry)
  }
}
