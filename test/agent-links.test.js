import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readlink, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installedAgents, knownAgents, linkSkill, reachOf, removeLink } from '../agent-links.js'

const dirLink = process.platform === 'win32' ? 'junction' : undefined

test('finds the installed tools and which of them read the shared folder', async () => {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-agents-')))
  const shared = join(home, '.agents', 'skills')
  const config = join(home, 'xdg')
  await mkdir(shared, { recursive: true })
  // Claude Code's skills folder is a link to the shared folder, so it reads shared skills as they are.
  await mkdir(join(home, '.claude'))
  await symlink(shared, join(home, '.claude', 'skills'), dirLink)
  await mkdir(join(home, '.kimi'))
  await mkdir(join(config, 'opencode'), { recursive: true })
  const env = { XDG_CONFIG_HOME: config }
  assert.deepEqual((await installedAgents(shared, env, home)).map(agent => [agent.id, agent.dir, agent.via]), [
    ['claude-code', join(home, '.claude', 'skills'), 'shared'],
    ['opencode', join(config, 'opencode', 'skills'), 'link'],
    ['kimi-code-cli', shared, 'shared'],
  ])
  assert.equal(knownAgents({ CLAUDE_CONFIG_DIR: join(home, 'claude-elsewhere') }, home)[0].dir, join(home, 'claude-elsewhere', 'skills'))
  assert.equal(new Set(knownAgents({}, home).map(agent => agent.id)).size, knownAgents({}, home).length, 'ids are unique')
})

test('links only where nothing real is in the way, and removes only links', async () => {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'dsh-mode-skills-links-')))
  const shared = join(home, '.agents', 'skills')
  const root = join(shared, 'notes')
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'SKILL.md'), '---\nname: notes\ndescription: Notes\n---\n')
  const agent = { id: 'cursor', dir: join(home, '.cursor', 'skills'), via: 'link' }
  const entry = await linkSkill(agent, root)
  assert.equal(await realpath(entry), root)
  if (process.platform !== 'win32') assert.equal(await readlink(entry), join('..', '..', '.agents', 'skills', 'notes'), 'the link is relative')
  assert.deepEqual(await reachOf(root, [agent], shared), { cursor: 'linked' })
  await assert.rejects(linkSkill(agent, root), error => error.code === 'EEXIST')
  await removeLink(entry)
  await mkdir(entry)
  await assert.rejects(removeLink(entry), error => error.code === 'ENOTLINK', 'a real folder is never removed')
  await assert.rejects(linkSkill(agent, root), error => error.code === 'EEXIST')
  assert.deepEqual(await reachOf(root, [agent], shared), { cursor: 'own' }, 'an empty folder is not the same skill')
})
