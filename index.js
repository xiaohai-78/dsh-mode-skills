/**
 * Host half: one authenticated POST route, `/api/dsh-mode-skills`, for the Skill Manager page, and the
 * `dshModeSkills` service the policy row (policy.js) reads.
 *
 * `list` mounts each agent mode's scope through `agentPresets.acquireScope`, reads the skill catalog that mode's
 * sessions would see without a workspace (`skills.snapshot`), releases the scope, and combines the catalogs
 * (skill-view.js). A mode's scan is reused for {@link SCAN_TTL_MS} unless the page asks for a refresh or a change
 * touched that mode; a failed scan is not reused.
 *
 * `setModes` turns skills on or off per mode. The settings live in `<profile>/.dsh-mode-skills/state.json`
 * (state.js); a mode with skills turned off gets the policy row in its profile override, written through
 * `configEditor.edit()` (mode-rows.js).
 *
 * The skill library actions (`createSkill`, `readSkillFile`, `writeSkillFile`, the version actions, `skillSources`, and
 * `importSkills`) take the same requests as dsh-modes's actions of the same names. Saved versions are copied under
 * `<profile>/.dsh-mode-skills/skill-versions/<skill>/<version>/` (skill-files.js); imports copy folders in
 * (skill-import.js) and remember where from, so a later change at the source can be flagged.
 *
 * While dsh-modes is installed it owns the skill settings and the library: these actions refuse with
 * `managed-by-modes`, the policy row lists nothing, and the page sends the same requests to dsh-modes instead.
 *
 * The recycle bin (trash.js), the check for skill files DSH skips (diagnose.js), uploads (zip.js), and the folders of
 * other agent tools work the same with or without dsh-modes, which has none of them. `list` also estimates what each
 * skill and each mode's whole catalog cost the model (tokens.js).
 *
 * The update actions check for a newer release of this plugin and install it with DSH's plugin manager
 * (self-update.js); they keep their switch in `<profile>/.dsh-mode-skills/settings.json`.
 */
import { randomBytes } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { analyzeSkillText, findSkipped, proposeFix } from './diagnose.js'
import { MAX_ARCHIVE_BYTES, commitOf, downloadArchive, inSkillDirs, parseGithub, skillDirsIn, wrapperOf } from './github.js'
import { hasPolicyRow, planRows, refreshRows } from './mode-rows.js'
import { same } from './rebase.js'
import { SkillFileError, VERSION_MAX_BYTES, VERSION_MAX_FILES, readVersionMeta, restoreVersion, skillLocation, writeText, writeVersion } from './skill-files.js'
import { DESCRIPTION_MAX_CHARS, agentRoots, copySkill, displayPath, expandHome, findPluginSkills, fingerprint, hasSkillFile, importRoots, listSkillDirs, newSkillText, readCandidate, replaceSkill, scriptFiles, skillFiles, skillRoots, sourceState } from './skill-import.js'
import { NOTE_MAX_CHARS, SKILL_NAME, VERSION_ID, isEditableSkill, nextVersionId, parseSkillFile, plainLines, withLineEndingsOf, withoutVersion } from './skill-store.js'
import { POLICY_PROVIDERS, remembered, summarize } from './skill-view.js'
import { selfUpdateActions } from './self-update.js'
import { searchStore, storeIndex } from './store.js'
import { StateFileError, StateStore } from './state.js'
import { catalogTokens, skillTokens } from './tokens.js'
import { emptyTrash, listTrash, moveItem, purgeTrash, restoreTrash, trashSkill } from './trash.js'
import { collectUsage, summarizeUsage } from './usage.js'
import { entryPath, readZip, writeZip, zipComment, zipPaths } from './zip.js'

const ROUTE = '/api/dsh-mode-skills'
const PRESET_MODULE = '@deepseek-ai/dsh-agent-preset'
const STATE_DIR = '.dsh-mode-skills'
const VERSIONS_DIR = 'skill-versions'
/** How long one mode's scan is reused; the page's Refresh button bypasses it. */
const SCAN_TTL_MS = 60 * 1000
/** Longest SKILL.md the page edits, in characters. */
const SKILL_FILE_MAX_CHARS = 200000
/** Where an import says its skill came from; anything else reads as a folder the user named. */
const IMPORT_SOURCES = new Set(['codex', 'codex-system', 'claude', 'claude-plugin', 'folder'])
/** How long the page waits after writing a skill folder, so the filesystem provider's watcher has seen it. */
const WATCH_SETTLE_MS = 800
/** The time windows the usage figures can cover, in days, and how long a store search is reused. */
const USAGE_WINDOWS = [7, 30, 90, 365]
const DAY_MS = 24 * 60 * 60 * 1000
const STORE_TTL_MS = 5 * 60 * 1000
const STORE_CACHE_SIZE = 50
/** A skill's setting in one mode, and the settings kept as lists in the mode's record. */
const MODE_STATES = new Set(['on', 'manual', 'model', 'off'])
const LISTED_STATES = ['off', 'manual', 'model']
/** Longest display name, tag, and number of tags a skill may have. */
const ALIAS_MAX_CHARS = 40
const TAG_MAX_CHARS = 20
const TAG_MAX_COUNT = 8
/** Longest text file the page opens, in characters, and the longest search text. */
const ASSET_MAX_CHARS = 200000
const SEARCH_MAX_CHARS = 100
/** Upload ids: the time of the upload and four random bytes. */
const UPLOAD_ID = /^[0-9]{13}-[0-9a-f]{8}$/
/** How long an upload that was never imported is kept. */
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000

export const name = 'dsh-mode-skills'
export const inject = ['agentPresets', 'configEditor']

/** A refusal the page can word in its own locale; `message` is the English fallback. */
class ActionError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

export function apply(ctx) {
  const stateDir = join(dirname(ctx.configEditor.documentPath), STATE_DIR)
  const updates = selfUpdateActions({ ctx, stateDir, refuse: (code, text, details) => new ActionError(code, text, details) })
  const m = { ctx, scans: new Map(), usageCache: new Map(), storeCache: new Map(), store: new StateStore(stateDir), watchers: new Set(), updates }
  ctx.provide('dshModeSkills', {
    /** The skills a mode turns off, and those it leaves to the user with each one's file and summary. */
    policyFor: preset => policyFor(m, preset),
    /** Call `listener` after every change to the settings; returns the function that stops it. */
    watch: (listener) => {
      m.watchers.add(listener)
      return () => m.watchers.delete(listener)
    },
  })
  refreshSavedRows(m)
  ctx.inject(['connection'], (c) => {
    c.effect(() => c.connection.fetch.register({
      path: ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handle(m, request),
    }), 'dsh-mode-skills: route')
  })
}

/** Refuse while dsh-modes owns the skill settings and the library. */
function owned(action) {
  return (m, body) => {
    if (m.ctx.get('dshModes') !== undefined) throw new ActionError('managed-by-modes', 'Mode Manager (dsh-modes) is installed and owns the skill settings')
    return action(m, body)
  }
}

const ACTIONS = {
  list: (m, body) => list(m, body.refresh === true, body.cwd),
  setModes: owned((m, body) => setModes(m, body.changes)),
  createSkill: owned(createSkill),
  readSkillFile: owned(readSkillFile),
  writeSkillFile: owned(writeSkillFile),
  saveSkillVersion: owned(saveSkillVersion),
  restoreSkillVersion: owned(restoreSkillVersion),
  deleteSkillVersion: owned(deleteSkillVersion),
  readSkillVersion: owned(readSkillVersion),
  skillSources: owned(skillSources),
  importSkills: owned(importSkills),
  deleteSkill: (m, body) => deleteSkill(m, body),
  restoreTrash: (m, body) => restoreFromTrash(m, body),
  purgeTrash: (m, body) => purgeTrash(trashDir(m), body.id).then(() => ({})),
  emptyTrash: m => emptyTrash(trashDir(m)).then(() => ({})),
  readSkipped: (m, body) => readSkipped(m, body),
  writeSkipped: (m, body) => writeSkipped(m, body),
  stageUpload: (m, body) => stageUpload(m, body),
  importUploads: (m, body) => importUploads(m, body),
  agentSources: async m => ({ groups: await sourceGroups(await m.store.read(), await agentRoots()) }),
  setMeta: (m, body) => setMeta(m, body),
  searchSkills: (m, body) => searchSkills(m, body),
  listSkillFiles: (m, body) => listSkillFiles(m, body),
  readSkillAsset: (m, body) => readSkillAsset(m, body),
  writeSkillAsset: (m, body) => writeSkillAsset(m, body),
  exportSkill: (m, body) => exportSkill(m, body),
  moveSkill: (m, body) => moveSkill(m, body),
  deleteSkillAsset: (m, body) => deleteSkillAsset(m, body),
  githubSources: (m, body) => githubSources(m, body),
  checkUpdates: (m, body) => checkUpdates(m, body),
  updateGithub: (m, body) => updateGithub(m, body),
  clearModes: (m, body) => clearModes(m, body),
  checkProject: async (m, body) => {
    const dir = await checkFolder(body.cwd)
    if (dir === undefined) throw new ActionError('bad-request', 'Give a project folder')
    return { path: displayPath(dir) }
  },
  usage: (m, body) => usageOf(m, body),
  storeSearch: (m, body) => storeSearch(m, body),
  storeIndex: async () => ({ repos: await storeIndex() }),
  /** This plugin's version and the latest release; `refresh` checks now (self-update.js). */
  updateStatus: (m, body) => m.updates.updateStatus(body),
  setUpdateCheck: (m, body) => m.updates.setUpdateCheck(body),
  /** Forget the note that an upgrade from this page finished, once the page has shown it. */
  dismissUpgraded: m => m.updates.dismissUpgraded(),
  /** Install the latest release with DSH's plugin manager; answers at once, and `upgradeStatus` follows it. */
  upgrade: (m, body) => m.updates.upgrade(body),
  upgradeStatus: m => m.updates.upgradeStatus(),
  cancelUpgrade: m => m.updates.cancelUpgrade(),
}

function reply(body) {
  return Response.json(body, { headers: { 'cache-control': 'no-store' } })
}

async function handle(m, request) {
  let body
  try {
    body = await request.json()
  } catch {
    return reply({ ok: false, code: 'bad-request', error: 'Request body must be JSON' })
  }
  const action = ACTIONS[body?.action]
  if (action === undefined) return reply({ ok: false, code: 'bad-request', error: `Unknown action: ${String(body?.action)}` })
  try {
    return reply({ ok: true, value: await action(m, body) })
  } catch (error) {
    const known = error instanceof ActionError || error instanceof StateFileError || error instanceof SkillFileError
    return reply({
      ok: false,
      code: known ? error.code : 'failed',
      error: message(error),
      ...known && error.details !== undefined ? { details: error.details } : {},
    })
  }
}

/** Shipped or bundle-declared modes, keyed by id, with their rows, built-in rows, and Loader entry. */
function declarations(ctx) {
  const found = new Map()
  for (const { entry, inherited } of ctx.configEditor.configuration()) {
    if (entry.options.name !== PRESET_MODULE) continue
    const config = entry.options.config ?? {}
    found.set(config.id, {
      entry,
      plugins: Array.isArray(config.plugins) ? config.plugins : [],
      builtIn: Array.isArray(inherited.plugins) ? inherited.plugins : [],
    })
  }
  return found
}

function message(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * On start, bring the overrides this plugin wrote up to date: add the uninstall condition where it is missing, and
 * take in new built-in rows where the override holds nothing else. A failure is logged and leaves that mode as it was.
 */
async function refreshSavedRows(m) {
  const { ctx } = m
  try {
    const state = await m.store.read()
    for (const [id, declaration] of declarations(ctx)) {
      const base = state.presets[id]?.base
      if (refreshRows({ current: declaration.plugins, builtIn: declaration.builtIn, base, preset: id }) === undefined) continue
      try {
        let builtIn
        await ctx.configEditor.edit(declaration.entry, (current, inherited) => {
          builtIn = Array.isArray(inherited.plugins) ? inherited.plugins : []
          const rows = refreshRows({ current: Array.isArray(current.plugins) ? current.plugins : builtIn, builtIn, base, preset: id })
          return rows === undefined ? current : { ...current, plugins: rows }
        })
        await m.store.update((next) => { (next.presets[id] ??= {}).base = builtIn })
      } catch (error) {
        ctx.logger.warn(`dsh-mode-skills could not update the skill settings row of mode ${id}: ${message(error)}`)
      }
    }
  } catch (error) {
    ctx.logger.warn(`dsh-mode-skills could not check the modes it changed: ${message(error)}`)
  }
}

/**
 * Every mode, every skill any mode sees, and how each mode treats it.
 * @returns {Promise<object>} `modes` in roster order (`isDefault`, `editable`: this plugin can change its rows,
 *   `hasSkillTool`, `off` and `manual`: this plugin's settings there, `catalog`: the skills the model sees there and
 *   their estimated tokens); `skills` (each with `tokens`) and `errors` from skill-view.js; `skipped` skill files and
 *   the `trash` entries;
 *   `manager`: `dsh-modes` while dsh-modes owns the skill settings, else `self`; `registry` is false when the
 *   composition has no skill registry; `stateError` when the state file is damaged.
 */
async function list(m, refresh, folder) {
  const { ctx } = m
  const cwd = await checkFolder(folder)
  const presets = ctx.agentPresets
  const roster = await presets.list()
  const declared = declarations(ctx)
  let state = { presets: {}, skills: {} }
  let stateError
  try {
    state = await m.store.read()
  } catch (error) {
    stateError = message(error)
  }
  const scans = []
  for (const mode of roster) scans.push({ id: mode.id, ...await scan(m, mode, refresh, cwd) })
  const known = Object.fromEntries(Object.entries(state.skills).filter(([, record]) => record?.info !== undefined).map(([skill, record]) => [skill, record.info]))
  const view = summarize(scans, undefined, known)
  if (stateError === undefined) await remember(m, state, view.skills)
  const skills = (await withLibrary(view.skills, state.skills)).map(skill => ({ ...skill, tokens: skillTokens(skill.name, skill.description) }))
  const roots = skillRoots()
  const trash = await listTrash(trashDir(m)).catch(() => [])
  return {
    ...cwd === undefined ? {} : { project: displayPath(cwd) },
    modes: roster.map((mode) => {
      const scanned = scans.find(item => item.id === mode.id)
      const visible = (scanned?.skills ?? []).filter(entry => entry.invocation?.modelInvocable !== false)
      return {
        id: mode.id,
        ...typeof mode.name === 'string' ? { name: mode.name } : {},
        ...mode.id === presets.defaultId ? { isDefault: true } : {},
        editable: declared.has(mode.id),
        hasSkillTool: scanned?.hasSkillTool === true,
        off: state.presets[mode.id]?.off ?? [],
        manual: state.presets[mode.id]?.manual ?? [],
        model: state.presets[mode.id]?.model ?? [],
        ...scanned?.hasSkillTool === true ? { catalog: { skills: visible.length, tokens: catalogTokens(visible) } } : {},
      }
    }),
    ...view,
    skills,
    skipped: await skippedIn(scans, cwd),
    trash: trash.map(entry => ({ id: entry.id, name: entry.name, display: displayPath(entry.from), at: entry.at, ...entry.description === undefined ? {} : { description: entry.description } })),
    manager: ctx.get('dshModes') === undefined ? 'self' : 'dsh-modes',
    roots: { dsh: displayPath(roots.dsh), agents: displayPath(roots.agents) },
    registry: ctx.get('skills') !== undefined,
    ...stateError === undefined ? {} : { stateError },
  }
}

/** Keep the details of every skill read from its file, for when every mode turns it off. */
async function remember(m, state, skills) {
  const changed = skills.filter(skill => skill.seen === true && !same(remembered(skill), state.skills[skill.name]?.info))
  if (changed.length === 0) return
  await m.store.update((next) => {
    for (const skill of changed) {
      next.skills[skill.name] = { ...next.skills[skill.name], info: remembered(skill) }
    }
  })
}

async function exists(path) {
  return stat(path).then(() => true, () => false)
}

/**
 * The listed skills with their library details, plus skills the page wrote that no mode lists yet.
 * @returns {Promise<object[]>} each skill with `editable`, `versions` (newest first), and `imported` (`from`, `display`,
 *   `source`, `at`, and `state`: `same`, `changed`, or `missing` since the import), sorted by name.
 */
async function withLibrary(skills, records) {
  const listed = new Set(skills.map(skill => skill.name))
  const all = [...skills]
  for (const [skill, record] of Object.entries(records)) {
    // A project's skills are listed only while its folder is the one chosen.
    if (listed.has(skill) || typeof record?.info?.path !== 'string' || String(record.info.source).startsWith('project-') || !(await exists(record.info.path))) continue
    all.push({ name: skill, modes: {}, ...record.info })
  }
  all.sort((a, b) => a.name.localeCompare(b.name))
  return Promise.all(all.map(async (skill) => {
    const record = records[skill.name]
    const from = record?.imported?.from
    const github = record?.imported?.github
    return {
      ...skill,
      ...typeof record?.alias === 'string' ? { alias: record.alias } : {},
      ...Array.isArray(record?.tags) && record.tags.length > 0 ? { tags: record.tags } : {},
      ...typeof skill.path === 'string' && skill.display === undefined ? { display: displayPath(skill.path) } : {},
      editable: isEditableSkill(skill),
      versions: [...record?.versions ?? []].reverse(),
      ...github !== undefined
        ? { imported: { from, display: `${github.repo}/${github.path}`.replace(/\/$/, ''), source: 'github', at: record.imported.at, state: githubState(record.imported), github } }
        : typeof from === 'string' ? { imported: { from, display: displayPath(from), source: record.imported.source, at: record.imported.at, state: await sourceState(from, record.imported).catch(() => 'missing') } } : {},
    }
  }))
}

/** One mode's catalog and whether it has the skill tool, from a scope the registry mounts and releases again. */
async function scan(m, mode, refresh, cwd) {
  const key = `${mode.id}\0${cwd ?? ''}`
  const cached = m.scans.get(key)
  if (!refresh && cached !== undefined && Date.now() - cached.at < SCAN_TTL_MS) return cached.value
  if (mode.broken !== undefined) return { error: mode.broken }
  const skills = m.ctx.get('skills')
  if (skills === undefined) return { skills: [] }
  let lease
  let value
  try {
    lease = await m.ctx.agentPresets.acquireScope(mode.id)
    const snapshot = await skills.snapshot({ scope: lease.key, ...cwd === undefined ? {} : { cwd } })
    value = {
      hasSkillTool: m.ctx.get('tools')?.schemas(lease.key).some(schema => schema.name === 'skill') === true,
      skills: snapshot.skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        ...typeof skill.whenToUse === 'string' ? { whenToUse: skill.whenToUse } : {},
        ...skill.path === undefined ? {} : { path: skill.path },
        source: skill.source,
        provider: skill.provider,
        invocation: skill.invocation,
      })),
    }
  } catch (error) {
    return { error: message(error) }
  } finally {
    await lease?.[Symbol.asyncDispose]()
  }
  m.scans.set(key, { at: Date.now(), value })
  return value
}

/**
 * Set skills on, manual only, model only, or off in several modes in one call.
 * @param {unknown} changes - `{ preset, skill, state }` items (`on`, `manual`, `model`, or `off`); `enabled: true | false`
 *   stands for `on` and `off`, as dsh-modes takes it.
 * @returns {Promise<{ failed: { id: string, error: string }[], mounted: string[] }>} the modes whose rows could not be
 *   changed (their settings are saved and apply once a later save succeeds), and the modes that received the policy
 *   row now: their running sessions keep the catalog they started with, so the change reaches new sessions only.
 */
async function setModes(m, changes) {
  if (!Array.isArray(changes) || changes.length === 0) throw new ActionError('bad-request', 'changes must be a non-empty list')
  const declared = declarations(m.ctx)
  for (const change of changes) {
    if (typeof change?.preset !== 'string' || !declared.has(change.preset)) throw new ActionError('not-editable', `Mode ${String(change?.preset)} cannot be changed here`, { id: String(change?.preset) })
    if (typeof change.skill !== 'string' || !SKILL_NAME.test(change.skill)) throw new ActionError('bad-request', `Not a skill name: ${String(change.skill)}`)
    if (!MODE_STATES.has(targetOf(change))) throw new ActionError('bad-request', 'state must be on, manual, model, or off')
  }
  await m.store.update((state) => {
    for (const change of changes) {
      const record = state.presets[change.preset] ??= {}
      const target = targetOf(change)
      for (const key of LISTED_STATES) {
        const names = new Set(record[key] ?? [])
        names.delete(change.skill)
        if (target === key) names.add(change.skill)
        if (names.size > 0) record[key] = [...names].sort()
        else delete record[key]
      }
    }
  })
  const touched = [...new Set(changes.map(change => change.preset))]
  const result = await syncRows(m, touched)
  for (const id of touched) forget(m, id)
  for (const listener of m.watchers) listener()
  return result
}

/** A change's target state. */
function targetOf(change) {
  return change.state ?? (change.enabled === true ? 'on' : change.enabled === false ? 'off' : undefined)
}

/**
 * The skills a mode turns off, and those set to manual only or model only with the file and summary each one has now.
 * @returns {Promise<{ off: string[], manual: object[], model: object[] }>}
 */
async function policyFor(m, preset) {
  const state = await m.store.read()
  const record = state.presets[preset] ?? {}
  const off = record.off ?? []
  const filed = async (skills) => {
    const out = []
    for (const skill of skills) {
      const path = state.skills[skill]?.info?.path
      if (off.includes(skill) || typeof path !== 'string') continue
      try {
        const { fields } = parseSkillFile(await readFile(path, 'utf8'))
        out.push({
          name: skill,
          path,
          description: typeof fields.description === 'string' && fields.description.trim() !== '' ? fields.description : skill,
          ...typeof fields.whenToUse === 'string' && fields.whenToUse.trim() !== '' ? { whenToUse: fields.whenToUse } : {},
        })
      } catch {
        // The file is gone: the skill is left as its own provider lists it, or not at all.
      }
    }
    return out
  }
  return { off, manual: await filed(record.manual ?? []), model: await filed(record.model ?? []) }
}

/** Add the policy row to the modes that turn skills off, and take it out of the others. */
async function syncRows(m, ids) {
  const failed = []
  const mounted = []
  const state = await m.store.read()
  const declared = declarations(m.ctx)
  for (const id of ids) {
    const declaration = declared.get(id)
    const record = state.presets[id] ?? {}
    const wanted = LISTED_STATES.some(key => (record[key] ?? []).length > 0)
    const present = hasPolicyRow(declaration.plugins)
    const plan = planRows({ current: declaration.plugins, builtIn: declaration.builtIn, base: record.base, preset: id, wanted })
    if (same(plan.rows, declaration.plugins) && (!wanted || same(record.base, declaration.builtIn))) continue
    try {
      let builtIn
      await m.ctx.configEditor.edit(declaration.entry, (current, inherited) => {
        builtIn = Array.isArray(inherited.plugins) ? inherited.plugins : []
        const rows = planRows({ current: Array.isArray(current.plugins) ? current.plugins : builtIn, builtIn, base: record.base, preset: id, wanted }).rows
        return { ...current, plugins: rows }
      })
      await m.store.update((next) => {
        const saved = next.presets[id] ??= {}
        if (wanted) saved.base = builtIn
        else delete saved.base
        if (Object.keys(saved).length === 0) delete next.presets[id]
      })
      if (wanted && !present) mounted.push(id)
    } catch (error) {
      failed.push({ id, error: message(error) })
    }
  }
  return { failed, mounted }
}

function versionDir(m, skill, version) {
  return join(m.store.dir, VERSIONS_DIR, skill, version)
}

function checkSkill(skill) {
  if (typeof skill !== 'string' || !SKILL_NAME.test(skill)) throw new ActionError('skill-name-invalid', `Invalid skill name: ${String(skill)}`)
  return skill
}

function checkVersion(version) {
  if (typeof version !== 'string' || !VERSION_ID.test(version)) throw new ActionError('unknown-version', `Unknown version: ${String(version)}`)
  return version
}

/** Read a skill's frontmatter switches the way the filesystem provider does. */
function invocationOf(fields) {
  const flag = (value) => {
    const text = String(value ?? '').trim().toLowerCase()
    return ['true', 'yes', 'on', '1'].includes(text) ? true : ['false', 'no', 'off', '0'].includes(text) ? false : undefined
  }
  return { modelInvocable: flag(fields['disable-model-invocation']) !== true, userInvocable: flag(fields['user-invocable']) !== false }
}

/** The file a skill's details point at, for the actions that read or change it. */
async function skillFile(m, skill) {
  const info = (await m.store.read()).skills[skill]?.info
  if (typeof info?.path !== 'string') throw new ActionError('skill-no-file', `Skill ${skill} has no known file; open the page once while a mode lists it`, { skill })
  return info
}

/**
 * Save the skill's current files as a new version.
 * @param {string} source - why: `manual`, `before-edit`, `before-restore`, or `before-import`.
 * @returns {Promise<string>} the new version id.
 */
async function saveVersion(m, skill, source, note) {
  const info = await skillFile(m, skill)
  const { fields, body } = parseSkillFile(await readFile(info.path, 'utf8'))
  const record = (await m.store.read()).skills[skill]
  const id = nextVersionId(record?.versions, record?.lastVersion)
  const description = (fields.description ?? info.description ?? '').trim() || `Saved version of ${skill}`
  const meta = {
    name: skill,
    description,
    ...typeof fields.whenToUse === 'string' && fields.whenToUse.trim() !== '' ? { whenToUse: fields.whenToUse } : {},
    invocation: invocationOf(fields),
    content: body,
    at: Date.now(),
    source,
    ...note === undefined ? {} : { note },
    from: info.path,
  }
  await writeVersion({ path: info.path, dir: versionDir(m, skill, id), meta })
  await m.store.update((next) => {
    const saved = next.skills[skill] ??= {}
    saved.versions = [...saved.versions ?? [], { id, at: meta.at, source, ...note === undefined ? {} : { note }, description }]
    saved.lastVersion = Number(id.slice(1))
  })
  return id
}

/** Save the current files as a version, with an optional note. */
async function saveSkillVersion(m, body) {
  const skill = checkSkill(body.skill)
  const note = typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : undefined
  if (note !== undefined && note.length > NOTE_MAX_CHARS) throw new ActionError('note-too-long', `The note exceeds ${NOTE_MAX_CHARS} characters`, { max: NOTE_MAX_CHARS })
  return { version: await saveVersion(m, skill, 'manual', note) }
}

/** Copy a saved version over the skill's files, after saving the current files as a version of their own. */
async function restoreSkillVersion(m, body) {
  const skill = checkSkill(body.skill)
  const version = checkVersion(body.version)
  const info = await skillFile(m, skill)
  if (!isEditableSkill(info)) throw new ActionError('skill-read-only', `Skill ${skill} belongs to an installed package and cannot be changed`, { skill })
  if (!((await m.store.read()).skills[skill]?.versions ?? []).some(entry => entry.id === version)) throw new ActionError('unknown-version', `Unknown version: ${version}`)
  const backup = await saveVersion(m, skill, 'before-restore')
  await restoreVersion({ dir: versionDir(m, skill, version), path: info.path })
  m.scans.clear()
  return { backup }
}

/** Delete a saved version; its number is not given out again. */
async function deleteSkillVersion(m, body) {
  const skill = checkSkill(body.skill)
  const version = checkVersion(body.version)
  await m.store.update((current) => {
    const next = withoutVersion(current, skill, version)
    for (const key of Object.keys(current)) delete current[key]
    Object.assign(current, next)
  })
  await rm(versionDir(m, skill, version), { recursive: true, force: true })
  return {}
}

/** A skill's instruction file as it is on disk now. */
async function readSkillFile(m, body) {
  const skill = checkSkill(body.skill)
  const info = await skillFile(m, skill)
  return { skill, path: info.path, text: await readFile(info.path, 'utf8'), editable: isEditableSkill(info) }
}

/**
 * Replace a skill's instruction file, after saving the current one as a version.
 * @param {{ skill?: unknown, text?: unknown, base?: unknown }} body - the new text, and the text the editor started from;
 *   a file that changed since is refused with `skill-conflict`.
 */
async function writeSkillFile(m, body) {
  const skill = checkSkill(body.skill)
  if (typeof body.text !== 'string' || body.text.trim() === '') throw new ActionError('skill-text-empty', 'The skill file cannot be empty')
  if (body.text.length > SKILL_FILE_MAX_CHARS) throw new ActionError('skill-text-too-long', `The skill file exceeds ${SKILL_FILE_MAX_CHARS} characters`, { max: SKILL_FILE_MAX_CHARS })
  const info = await skillFile(m, skill)
  if (!isEditableSkill(info)) throw new ActionError('skill-read-only', `Skill ${skill} belongs to an installed package and cannot be changed`, { skill })
  const current = await readFile(info.path, 'utf8')
  // A browser text area returns LF line endings, so the comparisons ignore them and the file keeps its own.
  if (typeof body.base === 'string' && plainLines(body.base) !== plainLines(current) && plainLines(body.text) !== plainLines(current)) {
    throw new ActionError('skill-conflict', 'The skill file changed after you started editing; reload it or overwrite it', { current: plainLines(current) })
  }
  if (plainLines(body.text) === plainLines(current)) return { changed: false }
  const backup = await saveVersion(m, skill, 'before-edit')
  await writeText(info.path, withLineEndingsOf(body.text, current))
  m.scans.clear()
  return { changed: true, backup }
}

/** A saved version's metadata and instruction file, for a preview. */
async function readSkillVersion(m, body) {
  const skill = checkSkill(body.skill)
  const version = checkVersion(body.version)
  const dir = versionDir(m, skill, version)
  let meta
  try {
    meta = await readVersionMeta(dir)
  } catch {
    // The version directory is gone or unreadable; the page words this as an unknown version.
    throw new ActionError('unknown-version', `Unknown version: ${version}`)
  }
  return { skill, version, meta, text: await readFile(join(dir, 'files', 'SKILL.md'), 'utf8') }
}

/** The folder a new skill goes to: `dsh` (`<DSH home>/skills`, the default) or `agents` (shared with other tools). */
function rootFor(target) {
  const roots = skillRoots()
  if (target === undefined || target === 'dsh') return { root: roots.dsh, source: 'user-dsh' }
  if (target === 'agents') return { root: roots.agents, source: 'user-agents' }
  throw new ActionError('bad-request', 'target must be dsh or agents')
}

/** Whether a known skill or a folder in either skill root already uses a name. */
async function nameTaken(state, skill) {
  const known = state.skills[skill]?.info?.path
  if (typeof known === 'string' && await exists(known)) return true
  return (await Promise.all(Object.values(skillRoots()).map(root => exists(join(root, skill))))).some(Boolean)
}

/** Remember a skill the page wrote, so the list shows it before the provider's watcher reports it. */
async function recordSkill(m, skill, { info, imported }) {
  await m.store.update((next) => {
    const saved = next.skills[skill] ??= {}
    saved.info = info
    if (imported !== undefined) saved.imported = imported
  })
}

/** Give the provider's watcher time to see a written skill folder, then drop the cached scans. */
async function settle(m) {
  await new Promise(done => setTimeout(done, WATCH_SETTLE_MS))
  m.scans.clear()
}

/**
 * Turn a new skill off in the modes left out of `modes`.
 * @param {unknown} modes - mode ids the skill stays on in; anything but an array leaves it on everywhere.
 * @returns {Promise<{ failed: object[], mounted: string[] }>} as {@link setModes} reports them.
 */
async function keepOnlyIn(m, skill, modes) {
  if (!Array.isArray(modes)) return { failed: [], mounted: [] }
  const view = await list(m, false)
  const changes = view.modes
    .filter(mode => mode.editable && mode.hasSkillTool && view.errors[mode.id] === undefined && !modes.includes(mode.id))
    .map(mode => ({ preset: mode.id, skill, enabled: false }))
  return changes.length === 0 ? { failed: [], mounted: [] } : setModes(m, changes)
}

/**
 * Create a skill folder with a `SKILL.md` to write in.
 * @param {{ name?: unknown, description?: unknown, target?: unknown, modes?: unknown }} body - a kebab-case name, a
 *   one-line description, the folder (`dsh` or `agents`), and the modes it stays on in.
 * @returns {Promise<object>} the name, and the failures and mounts of the mode settings.
 */
async function createSkill(m, body) {
  const skill = checkSkill(body.name)
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description === '') throw new ActionError('skill-description-empty', 'A skill needs a description')
  if (description.length > DESCRIPTION_MAX_CHARS || /[\r\n]/.test(description)) throw new ActionError('skill-description-invalid', `The description must be one line of at most ${DESCRIPTION_MAX_CHARS} characters`, { max: DESCRIPTION_MAX_CHARS })
  const { root, source } = rootFor(body.target)
  if (await nameTaken(await m.store.read(), skill)) throw new ActionError('skill-exists', `A skill named ${skill} already exists`, { name: skill })
  const dir = join(root, skill)
  await mkdir(root, { recursive: true })
  await mkdir(dir)
  try {
    await writeFile(join(dir, 'SKILL.md'), newSkillText({ name: skill, description }), { flag: 'wx' })
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
  await recordSkill(m, skill, { info: { description, path: join(dir, 'SKILL.md'), source, invocation: { modelInvocable: true, userInvocable: true } } })
  const modes = await keepOnlyIn(m, skill, body.modes)
  await settle(m)
  return { name: skill, ...modes }
}

/** The skill an earlier import of the folder `dir` created, as `[name, record]`. */
function importedFrom(state, dir) {
  return Object.entries(state.skills).find(([, record]) => record?.imported?.from === dir)
}

/** The skill an earlier install of the folder `path` of the GitHub repository `repo` created, as `[name, record]`. */
function importedFromGithub(state, repo, path) {
  return Object.entries(state.skills).find(([, record]) => record?.imported?.github?.repo === repo && record.imported.github.path === path)
}

/** Whether the source of a GitHub install has a newer version, from the last update check. */
function githubState(imported) {
  const latest = imported.github.latest
  return latest !== undefined && latest.content !== imported.content ? 'changed' : 'same'
}

/**
 * One skill folder as the import list shows it.
 * @returns {Promise<object>} the candidate with `status`: `new`, `imported` (unchanged since), `updated` (the source
 *   changed since its import), `exists` (another skill has the name), `rename` (DSH would ignore the name), or
 *   `invalid`; `as` names the skill an earlier import created.
 */
async function candidateFor(state, dir, source, github) {
  const base = { path: dir, display: displayPath(dir), source }
  let candidate
  try {
    candidate = await readCandidate(dir)
  } catch (error) {
    return { ...base, folder: basename(dir), status: 'invalid', problem: 'unreadable', error: message(error) }
  }
  const item = { ...base, ...candidate }
  if (candidate.problem === 'no-frontmatter') return { ...item, status: 'invalid' }
  const previous = github === undefined ? importedFrom(state, dir) : importedFromGithub(state, github.repo, github.path)
  if (previous !== undefined) {
    const changed = github === undefined
      ? await sourceState(dir, previous[1].imported).catch(() => 'missing')
      : (await fingerprint(dir)).content === previous[1].imported.content ? 'same' : 'changed'
    return { ...item, as: previous[0], status: changed === 'changed' ? 'updated' : 'imported' }
  }
  if (candidate.problem === 'name-invalid') return { ...item, status: 'rename' }
  return { ...item, status: await nameTaken(state, candidate.name) ? 'exists' : 'new' }
}

/**
 * The skills other agent tools keep, or the skills in one folder, for the import list.
 * @param {{ folder?: unknown }} body - a folder to read instead of the Codex and Claude Code folders; it may be a skill
 *   itself or hold skill folders.
 * @returns {Promise<{ roots: object, groups: object[] }>} the two folders new skills go to, and one group per source.
 */
async function skillSources(m, body) {
  const state = await m.store.read()
  const folder = await checkFolder(typeof body.folder === 'string' ? body.folder : undefined)
  const roots = folder === undefined ? [...importRoots(), ...await agentRoots()] : [{ source: 'folder', dir: folder }]
  const groups = await sourceGroups(state, roots)
  const shown = skillRoots()
  return { roots: { dsh: displayPath(shown.dsh), agents: displayPath(shown.agents) }, groups }
}

/**
 * Copy one skill folder in, or over the skill an earlier import of it (or `replace`) names.
 * @param {{ repo: string, ref: string, path: string, commit?: string }} [github] - set when the folder was unpacked from
 *   a GitHub archive: the install is then remembered by repository and folder, not by the local path.
 * @returns {Promise<object>} the source, the skill's name, `status` (`imported`, `updated`, or `replaced`), the version
 *   saved before a replacement, and links left out of the copy.
 */
async function importOne(m, item, target, github) {
  if (typeof item?.path !== 'string' || item.path.trim() === '') throw new ActionError('bad-request', 'Each item needs a path')
  const dir = await realpath(expandHome(item.path))
  if (!(await hasSkillFile(dir))) throw new ActionError('skill-no-file', `No SKILL.md in ${dir}`, { skill: basename(dir) })
  const candidate = await readCandidate(dir)
  if (candidate.problem === 'no-frontmatter') throw new ActionError('skill-no-frontmatter', `${dir}/SKILL.md needs name and description frontmatter`)
  const state = await m.store.read()
  const previous = github === undefined ? importedFrom(state, dir) : importedFromGithub(state, github.repo, github.path)
  const skill = item.name !== undefined ? checkSkill(item.name) : previous?.[0] ?? checkSkill(candidate.name)
  const rename = skill === candidate.name ? undefined : skill
  const sum = await fingerprint(dir)
  const existing = state.skills[skill]?.info
  const existingPath = typeof existing?.path === 'string' && await exists(existing.path) ? existing.path : undefined
  const { root, source } = rootFor(target)
  const imported = github !== undefined
    ? { from: `github:${github.repo}/${github.path}`, source: 'github', content: sum.content, at: Date.now(), github: { repo: github.repo, ref: github.ref, path: github.path, ...github.commit === undefined ? {} : { commit: github.commit } } }
    : item.source === 'upload' ? undefined : { from: dir, source: importSource(item.source), quick: sum.quick, content: sum.content, at: Date.now() }
  if (existingPath === undefined && !(await exists(join(root, skill)))) {
    const to = join(root, skill)
    const { skipped } = await copySkill({ from: dir, to, name: rename })
    await recordSkill(m, skill, { info: { description: candidate.description, path: join(to, 'SKILL.md'), source, invocation: { modelInvocable: true, userInvocable: true } }, imported })
    return { path: github === undefined ? displayPath(dir) : `${github.repo}/${github.path}`, name: skill, status: 'imported', skipped }
  }
  const again = previous?.[0] === skill
  if (!again && item.replace !== true) throw new ActionError('skill-exists', `A skill named ${skill} already exists`, { name: skill })
  const info = existingPath === undefined ? { path: join(root, skill, 'SKILL.md'), source } : existing
  if (!isEditableSkill(info) || skillLocation(info.path).layout !== 'directory') throw new ActionError('skill-read-only', `Skill ${skill} belongs to an installed package and cannot be changed`, { skill })
  const backup = existingPath === undefined ? undefined : await saveVersion(m, skill, 'before-import')
  const { skipped } = await replaceSkill({ from: dir, to: dirname(info.path), name: rename })
  await recordSkill(m, skill, { info: { ...info, description: candidate.description }, imported })
  return { path: github === undefined ? displayPath(dir) : `${github.repo}/${github.path}`, name: skill, status: again ? 'updated' : 'replaced', ...backup === undefined ? {} : { backup }, skipped }
}

/**
 * Copy skill folders in. Each item is done on its own, so one failure leaves the others imported.
 * @param {{ items?: unknown, target?: unknown }} body - `{ path, source?, name?, replace? }` items and the folder new
 *   copies go to (`dsh` or `agents`).
 * @returns {Promise<{ results: object[] }>} one result per item.
 */
async function importSkills(m, body) {
  if (!Array.isArray(body.items) || body.items.length === 0) throw new ActionError('bad-request', 'items must be a non-empty list')
  rootFor(body.target)
  const results = []
  for (const item of body.items) {
    try {
      results.push(await importOne(m, item, body.target))
    } catch (error) {
      const known = error instanceof ActionError || error instanceof SkillFileError
      results.push({
        path: typeof item?.path === 'string' ? displayPath(expandHome(item.path)) : '',
        ...typeof item?.name === 'string' ? { name: item.name } : {},
        status: 'error',
        code: known ? error.code : 'failed',
        error: message(error),
        ...known && error.details !== undefined ? { details: error.details } : {},
      })
    }
  }
  if (results.some(result => result.status !== 'error')) await settle(m)
  return { results }
}

/** Where an import says its skill came from: a known source, another agent tool, or else a folder. */
function importSource(source) {
  return IMPORT_SOURCES.has(source) || /^agent:[a-z0-9._-]+$/.test(String(source)) ? source : 'folder'
}

/** The import list's groups for some skill folders, each with its candidates. */
async function sourceGroups(state, roots) {
  const groups = []
  for (const root of roots) {
    const dirs = root.source === 'claude-plugin' ? await findPluginSkills(root.dir)
      : root.source === 'folder' && await hasSkillFile(root.dir) ? [root.dir]
        : await listSkillDirs(root.dir)
    const items = []
    for (const dir of dirs) items.push(await candidateFor(state, await realpath(dir), root.source))
    groups.push({ source: root.source, ...root.label === undefined ? {} : { label: root.label }, dir: displayPath(root.dir), exists: await exists(root.dir), items })
  }
  return groups
}

function trashDir(m) {
  return join(m.store.dir, 'trash')
}

/**
 * Move a skill to the recycle bin. Its versions, import record, and mode settings stay, so restoring it brings all back.
 * @returns {Promise<{ id: string }>} the bin entry.
 */
async function deleteSkill(m, body) {
  const skill = checkSkill(body.skill)
  const info = await skillFile(m, skill)
  if (!isEditableSkill(info)) throw new ActionError('skill-read-only', `Skill ${skill} belongs to an installed package and cannot be changed`, { skill })
  const where = skillLocation(info.path)
  if (!(await exists(where.root))) throw new ActionError('skill-no-file', `The files of ${skill} are gone`, { skill })
  const id = await trashSkill({ trashDir: trashDir(m), name: skill, from: where.root, layout: where.layout, ...typeof info.description === 'string' ? { description: info.description } : {} })
  await settle(m)
  return { id }
}

/** Put a bin entry back where it came from. */
async function restoreFromTrash(m, body) {
  const restored = await restoreTrash(trashDir(m), body.id)
  await settle(m)
  return { name: restored.name, display: displayPath(restored.from) }
}

/** The two user skill folders DSH reads by default, and the project folder's two, as diagnose.js takes them. */
function userRoots(cwd) {
  const roots = skillRoots()
  return [
    { source: 'user-dsh', dir: roots.dsh, skipSystem: true },
    { source: 'user-agents', dir: roots.agents },
    ...cwd === undefined ? [] : [{ source: 'project-dsh', dir: join(cwd, '.dsh', 'skills') }, { source: 'project-agents', dir: join(cwd, '.agents', 'skills') }],
  ]
}

/** The skill files in the user folders that no mode lists, once some mode with the skill tool was read. */
async function skippedIn(scans, cwd) {
  if (!scans.some(scan => scan.error === undefined && scan.hasSkillTool === true)) return []
  const listedPaths = new Set()
  const listedNames = new Map()
  for (const scan of scans) {
    for (const entry of scan.skills ?? []) {
      if (typeof entry.path === 'string') listedPaths.add(entry.path)
      listedNames.set(entry.name, listedNames.get(entry.name) ?? (POLICY_PROVIDERS.has(entry.provider) ? undefined : entry.path))
    }
  }
  return findSkipped({ roots: userRoots(cwd), listedPaths, listedNames }).catch(() => [])
}

/** A skill file inside one of the user folders (or the chosen project's), by its real path. */
async function skippedFile(path, cwd) {
  if (typeof path !== 'string' || !path.endsWith('.md')) throw new ActionError('bad-request', 'Name a skill file')
  let real
  try {
    real = await realpath(path)
  } catch {
    // The file is gone since the list was read.
    throw new ActionError('skill-no-file', `No file at ${path}`, { skill: basename(dirname(path)) })
  }
  const roots = await Promise.all(userRoots(cwd).map(root => realpath(root.dir).catch(() => root.dir)))
  const inside = roots.some((root) => {
    const rel = relative(root, real)
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  })
  if (!inside) throw new ActionError('bad-request', 'Only files in the user skill folders can be changed here')
  return real
}

function folderOf(path) {
  return basename(path) === 'SKILL.md' ? basename(dirname(path)) : basename(path, '.md')
}

/** A skipped file, why DSH skips it, and the mended text to offer. */
async function readSkipped(m, body) {
  const path = await skippedFile(body.path, await checkFolder(body.cwd))
  const text = await readFile(path, 'utf8')
  const proposal = proposeFix(text, folderOf(path))
  return { path, display: displayPath(path), text: plainLines(text), problem: analyzeSkillText(text) ?? null, proposal: { text: plainLines(proposal.text), complete: proposal.complete } }
}

/**
 * Write a mended skipped file, after keeping the old one in `<store>/backups/`.
 * @returns {Promise<{ problem: object | null }>} what still stops DSH from loading it, if anything.
 */
async function writeSkipped(m, body) {
  const path = await skippedFile(body.path, await checkFolder(body.cwd))
  if (typeof body.text !== 'string' || body.text.trim() === '') throw new ActionError('skill-text-empty', 'The skill file cannot be empty')
  if (body.text.length > SKILL_FILE_MAX_CHARS) throw new ActionError('skill-text-too-long', `The skill file exceeds ${SKILL_FILE_MAX_CHARS} characters`, { max: SKILL_FILE_MAX_CHARS })
  const current = await readFile(path, 'utf8')
  if (typeof body.base === 'string' && plainLines(body.base) !== plainLines(current)) {
    throw new ActionError('skill-conflict', 'The skill file changed after you started editing; reload it or overwrite it', { current: plainLines(current) })
  }
  const backups = join(m.store.dir, 'backups')
  await mkdir(backups, { recursive: true })
  await writeFile(join(backups, `${Date.now()}-${folderOf(path)}.md`), current)
  const text = withLineEndingsOf(body.text, current)
  await writeText(path, text)
  await settle(m)
  return { problem: analyzeSkillText(text) ?? null }
}

function uploadsDir(m) {
  return join(m.store.dir, 'uploads')
}

/** Remove uploads older than {@link UPLOAD_TTL_MS}. */
async function clearOldUploads(m) {
  let names = []
  try {
    names = await readdir(uploadsDir(m))
  } catch {
    // No uploads yet.
    return
  }
  for (const name of names) {
    if (UPLOAD_ID.test(name) && Date.now() - Number(name.slice(0, 13)) > UPLOAD_TTL_MS) await rm(join(uploadsDir(m), name), { recursive: true, force: true })
  }
}

/** The skill folders in an upload: the upload itself, one folder it wraps, the folders in either, or their `skills/`. */
async function uploadedSkillDirs(root) {
  if (await hasSkillFile(root)) return [root]
  const top = await readdir(root, { withFileTypes: true })
  const base = top.length === 1 && top[0].isDirectory() ? join(root, top[0].name) : root
  if (base !== root && await hasSkillFile(base)) return [base]
  const found = await listSkillDirs(base).catch(() => [])
  return found.length > 0 ? found : listSkillDirs(join(base, 'skills')).catch(() => [])
}

/**
 * Keep an uploaded archive or folder under `<store>/uploads/<id>/files/`, and list the skills in it.
 * @param {{ name?: unknown, zip?: unknown, files?: unknown }} body - what was dropped or picked, and a base64 `.zip`
 *   archive or `{ path, data }` files (relative `/`-separated paths, base64 content).
 * @returns {Promise<{ upload: string, label: string, items: object[] }>} the upload id and its candidates, as the
 *   import list shows them.
 */
async function stageUpload(m, body) {
  const limits = { maxFiles: VERSION_MAX_FILES, maxBytes: VERSION_MAX_BYTES }
  let files
  if (typeof body.zip === 'string') {
    files = readZip(Buffer.from(body.zip, 'base64'), limits)
  } else if (Array.isArray(body.files) && body.files.length > 0) {
    files = []
    let total = 0
    for (const file of body.files) {
      const path = entryPath(String(file?.path ?? ''))
      if (path === undefined) continue
      const data = Buffer.from(String(file.data ?? ''), 'base64')
      total += data.length
      if (files.length + 1 > limits.maxFiles || total > limits.maxBytes) {
        throw new SkillFileError('skill-too-large', `The upload has more than ${limits.maxFiles} files or ${limits.maxBytes} bytes`, { files: limits.maxFiles, megabytes: limits.maxBytes / 1024 / 1024 })
      }
      files.push({ path, data })
    }
  } else {
    throw new ActionError('bad-request', 'Send a zip archive or files')
  }
  if (files.length === 0) throw new ActionError('upload-empty', 'The upload holds no files')
  await clearOldUploads(m)
  const upload = newUploadId()
  const root = join(uploadsDir(m), upload, 'files')
  for (const file of files) {
    const to = join(root, ...file.path.split('/'))
    await mkdir(dirname(to), { recursive: true })
    await writeFile(to, file.data)
  }
  const state = await m.store.read()
  const items = []
  for (const dir of await uploadedSkillDirs(root)) {
    const path = await realpath(dir)
    items.push({ ...await candidateFor(state, path, 'upload'), scripts: await scriptFiles(path) })
  }
  return { upload, label: typeof body.name === 'string' && body.name.trim() !== '' ? body.name.trim().slice(0, 200) : 'upload', items }
}

/**
 * Copy skills in from an upload, then drop the upload. Uploaded skills keep no source to check for changes.
 * @param {{ upload?: unknown, items?: unknown, target?: unknown }} body - the upload id, `{ path, name?, replace? }`
 *   items from its list, and the folder new copies go to.
 * @returns {Promise<{ results: object[] }>} one result per item, as `importSkills` gives them.
 */
async function importUploads(m, body) {
  if (typeof body.upload !== 'string' || !UPLOAD_ID.test(body.upload)) throw new ActionError('bad-request', 'Unknown upload')
  if (!Array.isArray(body.items) || body.items.length === 0) throw new ActionError('bad-request', 'items must be a non-empty list')
  rootFor(body.target)
  let root
  try {
    root = await realpath(join(uploadsDir(m), body.upload, 'files'))
  } catch {
    // Uploads are kept for a day; this one is gone.
    throw new ActionError('upload-gone', 'This upload is no longer available; upload it again')
  }
  const origin = await readOrigin(m, body.upload)
  const results = []
  for (const item of body.items) {
    try {
      const path = await realpath(String(item?.path ?? ''))
      const rel = relative(root, path)
      if (rel.startsWith('..') || isAbsolute(rel)) throw new ActionError('bad-request', 'The item is not part of this upload')
      const github = origin === undefined ? undefined : { repo: origin.repo, ref: origin.ref, path: rel.split(sep).join('/'), ...origin.commit === undefined ? {} : { commit: origin.commit } }
      results.push(await importOne(m, { ...item, path, source: github === undefined ? 'upload' : 'github' }, body.target, github))
    } catch (error) {
      const known = error instanceof ActionError || error instanceof SkillFileError
      results.push({ path: typeof item?.path === 'string' ? basename(item.path) : '', ...typeof item?.name === 'string' ? { name: item.name } : {}, status: 'error', code: known ? error.code : 'failed', error: message(error), ...known && error.details !== undefined ? { details: error.details } : {} })
    }
  }
  await rm(join(uploadsDir(m), body.upload), { recursive: true, force: true })
  if (results.some(result => result.status !== 'error')) await settle(m)
  return { results }
}

/** A fresh upload id. */
function newUploadId() {
  return `${Date.now()}-${randomBytes(4).toString('hex')}`
}

/** Where a staged upload came from, when it was downloaded from GitHub; undefined for a plain upload. */
async function readOrigin(m, upload) {
  let text
  try {
    text = await readFile(join(uploadsDir(m), upload, 'origin.json'), 'utf8')
  } catch {
    // A plain upload has no origin file.
    return undefined
  }
  const origin = JSON.parse(text)
  return origin?.kind === 'github' ? origin : undefined
}

/**
 * The project folder the page chose, as an absolute path.
 * @param {unknown} folder - a path the user typed, or nothing for no project.
 * @returns {Promise<string | undefined>} the folder, or undefined when none was given.
 * @throws {ActionError} `folder-relative` for a path that does not start from the root or home folder, `folder-missing`.
 *   Used for the project folder and for a folder to import skills from.
 */
async function checkFolder(folder) {
  if (folder === undefined || folder === null || folder === '') return undefined
  if (typeof folder !== 'string') throw new ActionError('bad-request', 'The project folder must be a path')
  const text = folder.trim().replace(/^(["'])(.*)\1$/, '$2').trim()
  if (!isAbsolute(text) && !/^~(?:[\\/]|$)/.test(text)) throw new ActionError('folder-relative', 'Give the full path of the project folder', { path: text })
  const dir = expandHome(text)
  if (!(await stat(dir).then(info => info.isDirectory(), () => false))) throw new ActionError('folder-missing', `No folder at ${dir}`, { path: displayPath(dir) })
  return dir
}

/** Drop the cached scans of one mode, whatever project folder they were read for. */
function forget(m, id) {
  for (const key of m.scans.keys()) {
    if (key.startsWith(`${id}\0`)) m.scans.delete(key)
  }
}

/**
 * Set a skill's display name and tags. Both live in the settings file only; the skill's files never change.
 * @param {{ skill?: unknown, alias?: unknown, tags?: unknown }} body - the skill, a display name of at most
 *   {@link ALIAS_MAX_CHARS} characters (empty removes it), and tags (an empty list removes them).
 */
async function setMeta(m, body) {
  const skill = checkSkill(body.skill)
  const alias = body.alias === undefined ? undefined : String(body.alias).trim()
  if (alias !== undefined && (alias.length > ALIAS_MAX_CHARS || /[\r\n]/.test(alias))) throw new ActionError('alias-invalid', `The display name must be one line of at most ${ALIAS_MAX_CHARS} characters`, { max: ALIAS_MAX_CHARS })
  let tags
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new ActionError('bad-request', 'tags must be a list')
    tags = [...new Set(body.tags.map(tag => String(tag).trim()).filter(tag => tag !== ''))]
    if (tags.length > TAG_MAX_COUNT || tags.some(tag => tag.length > TAG_MAX_CHARS || /[\r\n,，、]/.test(tag))) {
      throw new ActionError('tags-invalid', `Use at most ${TAG_MAX_COUNT} tags of ${TAG_MAX_CHARS} characters, without commas`, { max: TAG_MAX_COUNT, chars: TAG_MAX_CHARS })
    }
  }
  await m.store.update((next) => {
    const saved = next.skills[skill] ??= {}
    if (alias !== undefined) {
      if (alias === '') delete saved.alias
      else saved.alias = alias
    }
    if (tags !== undefined) {
      if (tags.length === 0) delete saved.tags
      else saved.tags = tags
    }
    if (Object.keys(saved).length === 0) delete next.skills[skill]
  })
  return {}
}

/**
 * The skills whose file contains some text, for a search beyond names and descriptions.
 * @param {{ query?: unknown }} body - at least two characters, matched without regard to case.
 * @returns {Promise<{ names: string[] }>} the skills whose `SKILL.md` (frontmatter and body) holds the text.
 */
async function searchSkills(m, body) {
  const needle = typeof body.query === 'string' ? body.query.trim().toLowerCase() : ''
  if (needle.length < 2 || needle.length > SEARCH_MAX_CHARS) return { names: [] }
  const names = []
  for (const [skill, record] of Object.entries((await m.store.read()).skills)) {
    const path = record?.info?.path
    if (typeof path !== 'string') continue
    try {
      const info = await stat(path)
      if (info.isFile() && info.size <= ASSET_MAX_CHARS * 4 && (await readFile(path, 'utf8')).toLowerCase().includes(needle)) names.push(skill)
    } catch {
      // The file is gone or unreadable; the skill is not a match.
    }
  }
  return { names }
}

/** A skill that is a folder, with its real path. */
async function skillFolder(m, skill) {
  const info = await skillFile(m, skill)
  const where = skillLocation(info.path)
  if (where.layout !== 'directory') throw new ActionError('skill-single-file', `Skill ${skill} is a single file, not a folder`, { skill })
  if (!(await exists(where.root))) throw new ActionError('skill-no-file', `The files of ${skill} are gone`, { skill })
  return { info, root: await realpath(where.root) }
}

/**
 * The files of a skill folder.
 * @returns {Promise<{ files: { rel: string, size: number }[], skipped: string[], editable: boolean, single?: boolean }>}
 *   `skipped`: links left out; `single`: the skill is one file.
 */
async function listSkillFiles(m, body) {
  const skill = checkSkill(body.skill)
  const info = await skillFile(m, skill)
  const where = skillLocation(info.path)
  if (where.layout !== 'directory') return { files: [{ rel: 'SKILL.md', size: (await stat(info.path)).size }], skipped: [], editable: isEditableSkill(info), single: true }
  const { files, skipped } = await skillFiles(where.root)
  return { files: files.map(file => ({ rel: file.rel, size: file.size })), skipped, editable: isEditableSkill(info) }
}

/**
 * A path inside a skill folder, from the relative path the page sent.
 * @returns {Promise<{ target: string, rel: string }>} the path under the folder's real path, and the cleaned relative path.
 * @throws {ActionError} `asset-outside` for a path that leaves the folder, also through a link.
 */
async function assetPath(root, rel) {
  const outside = () => new ActionError('asset-outside', `Not a path inside the skill folder: ${String(rel)}`, { rel: String(rel) })
  if (typeof rel !== 'string' || rel === '' || rel.includes('\0') || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) throw outside()
  const parts = rel.replaceAll('\\', '/').split('/').filter(part => part !== '' && part !== '.')
  if (parts.length === 0 || parts.includes('..')) throw outside()
  const target = join(root, ...parts)
  let probe = target
  for (;;) {
    let real
    try {
      real = await realpath(probe)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      probe = dirname(probe)
      continue
    }
    const inside = relative(root, real)
    if (inside.startsWith('..') || isAbsolute(inside)) throw outside()
    return { target, rel: parts.join('/') }
  }
}

/** A file's text, or undefined when it is not valid UTF-8 text. */
function decodeText(data) {
  if (data.subarray(0, 8000).includes(0)) return undefined
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data)
  } catch {
    // Bytes that are not UTF-8 make the file binary for the editor.
    return undefined
  }
}

/** Keep a copy of a file before the page changes or removes it, under `<store>/backups/`. */
async function backupAsset(m, skill, rel, data) {
  const backups = join(m.store.dir, 'backups')
  await mkdir(backups, { recursive: true })
  await writeFile(join(backups, `${Date.now()}-${skill}-${rel.replaceAll('/', '__')}`), data)
}

/** A text file of a skill folder, for the editor. */
async function readSkillAsset(m, body) {
  const skill = checkSkill(body.skill)
  const { info, root } = await skillFolder(m, skill)
  const { target, rel } = await assetPath(root, body.rel)
  const stats = await stat(target).catch(() => undefined)
  if (stats === undefined || !stats.isFile()) throw new ActionError('asset-missing', `No file ${rel} in ${skill}`, { rel })
  if (stats.size > ASSET_MAX_CHARS * 4) throw new ActionError('asset-too-large', `${rel} is larger than the editor opens`, { max: ASSET_MAX_CHARS })
  const text = decodeText(await readFile(target))
  if (text === undefined) throw new ActionError('asset-binary', `${rel} is not a text file`, { rel })
  if (text.length > ASSET_MAX_CHARS) throw new ActionError('asset-too-large', `${rel} is larger than the editor opens`, { max: ASSET_MAX_CHARS })
  return { skill, rel, text, editable: isEditableSkill(info) && rel !== 'SKILL.md' }
}

/**
 * Change or add a text file of a skill folder other than `SKILL.md`, after keeping the old file under
 * `<store>/backups/`.
 * @param {{ skill?: unknown, rel?: unknown, text?: unknown, base?: unknown, create?: unknown }} body - the new text, the
 *   text the editor started from (a file that changed since is refused with `skill-conflict`), and `create: true` for a
 *   file that must not exist yet.
 */
async function writeSkillAsset(m, body) {
  const skill = checkSkill(body.skill)
  const { info, root } = await skillFolder(m, skill)
  if (!isEditableSkill(info)) throw new ActionError('skill-read-only', `Skill ${skill} belongs to an installed package and cannot be changed`, { skill })
  if (typeof body.text !== 'string') throw new ActionError('bad-request', 'text must be a string')
  if (body.text.length > ASSET_MAX_CHARS) throw new ActionError('skill-text-too-long', `The file exceeds ${ASSET_MAX_CHARS} characters`, { max: ASSET_MAX_CHARS })
  const { target, rel } = await assetPath(root, body.rel)
  if (rel === 'SKILL.md') throw new ActionError('bad-request', 'Edit SKILL.md with the skill editor')
  let data
  try {
    data = await readFile(target)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  if (data === undefined) {
    if (body.create !== true) throw new ActionError('asset-missing', `No file ${rel} in ${skill}`, { rel })
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, body.text, { flag: 'wx' })
    return { changed: true, created: true }
  }
  if (body.create === true) throw new ActionError('asset-exists', `${rel} already exists`, { rel })
  const current = decodeText(data)
  if (current === undefined) throw new ActionError('asset-binary', `${rel} is not a text file`, { rel })
  if (typeof body.base === 'string' && plainLines(body.base) !== plainLines(current) && plainLines(body.text) !== plainLines(current)) {
    throw new ActionError('skill-conflict', 'The file changed after you started editing; reload it or overwrite it', { current: plainLines(current) })
  }
  if (plainLines(body.text) === plainLines(current)) return { changed: false }
  await backupAsset(m, skill, rel, data)
  await writeText(target, withLineEndingsOf(body.text, current))
  return { changed: true }
}

/** Remove a file of a skill folder other than `SKILL.md`, after keeping a copy under `<store>/backups/`. */
async function deleteSkillAsset(m, body) {
  const skill = checkSkill(body.skill)
  const { info, root } = await skillFolder(m, skill)
  if (!isEditableSkill(info)) throw new ActionError('skill-read-only', `Skill ${skill} belongs to an installed package and cannot be changed`, { skill })
  const { target, rel } = await assetPath(root, body.rel)
  if (rel === 'SKILL.md') throw new ActionError('bad-request', 'SKILL.md is the skill itself; move the skill to the recycle bin instead')
  const stats = await stat(target).catch(() => undefined)
  if (stats === undefined || !stats.isFile()) throw new ActionError('asset-missing', `No file ${rel} in ${skill}`, { rel })
  await backupAsset(m, skill, rel, await readFile(target))
  await rm(target)
  return {}
}

/**
 * A skill as a zip archive, with the skill's name as its top folder.
 * @returns {Promise<{ name: string, zip: string }>} the archive's file name and its content in base64.
 */
async function exportSkill(m, body) {
  const skill = checkSkill(body.skill)
  const info = await skillFile(m, skill)
  const where = skillLocation(info.path)
  const entries = []
  if (where.layout === 'directory') {
    const { files } = await skillFiles(where.root)
    for (const file of files) entries.push({ path: `${skill}/${file.rel}`, data: await readFile(file.path), executable: ((await stat(file.path)).mode & 0o111) !== 0 })
  } else {
    entries.push({ path: `${skill}/SKILL.md`, data: await readFile(info.path) })
  }
  return { name: `${skill}.zip`, zip: writeZip(entries).toString('base64') }
}

/**
 * Move a skill folder between the two user skill folders.
 * @param {{ skill?: unknown, target?: unknown }} body - the skill and the folder to move it to (`dsh` or `agents`).
 * @returns {Promise<{ display: string }>} the skill's new location.
 */
async function moveSkill(m, body) {
  const skill = checkSkill(body.skill)
  const { root: destination, source } = rootFor(body.target)
  const info = await skillFile(m, skill)
  if (!isEditableSkill(info)) throw new ActionError('skill-read-only', `Skill ${skill} belongs to an installed package and cannot be changed`, { skill })
  const where = skillLocation(info.path)
  if (where.layout !== 'directory') throw new ActionError('skill-single-file', `Skill ${skill} is a single file, not a folder`, { skill })
  if (!(await exists(where.root))) throw new ActionError('skill-no-file', `The files of ${skill} are gone`, { skill })
  if ((await lstat(where.root)).isSymbolicLink()) throw new ActionError('skill-linked', `The skill folder ${where.root} is a link`, {})
  const here = await realpath(dirname(where.root))
  const roots = await Promise.all(Object.values(skillRoots()).map(dir => realpath(dir).catch(() => dir)))
  if (!roots.includes(here)) throw new ActionError('skill-not-in-user-folder', `Skill ${skill} is not in one of the user skill folders`, { skill })
  const there = await realpath(destination).catch(() => destination)
  if (here === there) throw new ActionError('skill-already-there', `Skill ${skill} is already in ${displayPath(destination)}`, { skill })
  const to = join(destination, basename(where.root))
  if (await exists(to)) throw new ActionError('skill-exists', `A skill named ${skill} already exists`, { name: skill })
  await moveItem(where.root, to)
  const path = join(to, 'SKILL.md')
  await m.store.update((next) => {
    const saved = next.skills[skill]
    if (saved?.info !== undefined) saved.info = { ...saved.info, path, source, display: displayPath(path) }
  })
  await settle(m)
  return { display: displayPath(to) }
}

/** The ways one address names a repository's ref, tried until a download is found. */
async function fetchRepo(parsed) {
  let missing
  for (const attempt of parsed.tries) {
    try {
      return { buffer: await downloadArchive({ owner: parsed.owner, repo: parsed.repo, ref: attempt.ref }), ref: attempt.ref, path: attempt.path }
    } catch (error) {
      if (error?.code !== 'github-not-found') throw error
      missing = error
    }
  }
  throw missing
}

/**
 * Write the skill folders of a downloaded repository under `dest`, keeping their paths from the repository root.
 * @param {Buffer} buffer - the source archive.
 * @param {string} under - a folder to search in; empty for the whole repository.
 * @param {string} dest - where the files go.
 * @param {Set<string>} [only] - skill folders to write; the others are left out.
 * @returns {Promise<{ dirs: string[], truncated: boolean, commit?: string }>} the skill folders found and the commit.
 */
async function unpackRepo(buffer, under, dest, only) {
  const all = zipPaths(buffer)
  const wrapper = wrapperOf(all)
  const strip = path => path.slice(wrapper.length)
  const found = skillDirsIn(all.map(strip), under)
  const dirs = only === undefined ? found.dirs : found.dirs.filter(dir => only.has(dir))
  const files = readZip(buffer, { maxFiles: 5000, maxBytes: MAX_ARCHIVE_BYTES }, { include: path => inSkillDirs(strip(path), dirs) })
  for (const file of files) {
    const to = join(dest, ...strip(file.path).split('/'))
    await mkdir(dirname(to), { recursive: true })
    await writeFile(to, file.data)
  }
  return { dirs, truncated: found.truncated, commit: commitOf(zipComment(buffer)) }
}

/** The folder of a skill inside an unpacked repository (the root itself for an empty path). */
function repoDir(root, path) {
  return path === '' ? root : join(root, ...path.split('/'))
}

/**
 * Download a GitHub repository and list its skills for installing.
 * @param {{ url?: unknown }} body - an address `github.js` reads: a repository, or a branch and folder in one.
 * @returns {Promise<{ upload: string, label: string, github: object, truncated: boolean, items: object[] }>} the staged
 *   upload (import it with `importUploads`), the repository, and the candidates, each with `github` (its repository,
 *   ref, folder, and commit) and `scripts` (files that can run).
 */
async function githubSources(m, body) {
  const parsed = parseGithub(body.url)
  const { buffer, ref, path: under } = await fetchRepo(parsed)
  await clearOldUploads(m)
  const upload = newUploadId()
  const root = join(uploadsDir(m), upload, 'files')
  await mkdir(root, { recursive: true })
  const { dirs, truncated, commit } = await unpackRepo(buffer, under, root)
  const repo = `${parsed.owner}/${parsed.repo}`
  if (dirs.length === 0) {
    await rm(join(uploadsDir(m), upload), { recursive: true, force: true })
    return { upload, label: repo, github: { kind: 'github', repo, ref, ...commit === undefined ? {} : { commit } }, truncated, items: [] }
  }
  const origin = { kind: 'github', repo, ref, ...commit === undefined ? {} : { commit } }
  await writeFile(join(uploadsDir(m), upload, 'origin.json'), JSON.stringify(origin))
  const state = await m.store.read()
  const items = []
  for (const dir of dirs) {
    const path = await realpath(repoDir(root, dir))
    const item = await candidateFor(state, path, 'github', { repo, path: dir })
    items.push({ ...item, display: dir === '' ? repo : `${repo}/${dir}`, github: { repo, ref, path: dir, ...commit === undefined ? {} : { commit } }, scripts: await scriptFiles(path) })
  }
  return { upload, label: repo, github: origin, truncated, items }
}

/** The names of the skills installed from GitHub whose files are still there; a skill in the trash is left alone. */
async function installedFromGithub(state) {
  const names = new Set()
  for (const [skill, record] of Object.entries(state.skills)) {
    if (record?.imported?.github !== undefined && typeof record.info?.path === 'string' && await exists(record.info.path)) names.add(skill)
  }
  return names
}

/** The named skills installed from GitHub, grouped by repository and ref: `[[key, [{ skill, github, content }]]]`. */
function githubGroups(state, names) {
  const groups = new Map()
  for (const [skill, record] of Object.entries(state.skills)) {
    const github = record?.imported?.github
    if (github === undefined || !names.has(skill)) continue
    const key = `${github.repo}\0${github.ref}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ skill, github, content: record.imported.content })
  }
  return groups
}

/** Download one group's repository into a scratch folder, unpacking only the folders its skills came from. */
async function unpackGroup(m, entries) {
  const { repo, ref } = entries[0].github
  const [owner, name] = repo.split('/')
  const id = newUploadId()
  const root = join(uploadsDir(m), id, 'files')
  await mkdir(root, { recursive: true })
  try {
    const unpacked = await unpackRepo(await downloadArchive({ owner, repo: name, ref }), '', root, new Set(entries.map(entry => entry.github.path)))
    return { ...unpacked, root, scratch: join(uploadsDir(m), id) }
  } catch (error) {
    await rm(join(uploadsDir(m), id), { recursive: true, force: true })
    throw error
  }
}

function failureOf(error) {
  const known = error instanceof ActionError || error instanceof SkillFileError
  return { code: known ? error.code : 'failed', error: message(error), ...known && error.details !== undefined ? { details: error.details } : {} }
}

/**
 * Look for newer versions of the skills installed from GitHub. A skill counts as changed when its folder's content at
 * the repository's current commit differs from what was installed; other changes in the repository do not count.
 * @returns {Promise<{ checked: number, updates: string[], failed: object[] }>} the skills checked, those with a newer
 *   version, and the repositories that could not be read (`repo`, `code`, `error`).
 */
async function checkUpdates(m) {
  const state = await m.store.read()
  const result = { checked: 0, updates: [], failed: [] }
  const findings = new Map()
  for (const [, entries] of githubGroups(state, await installedFromGithub(state))) {
    let unpacked
    try {
      unpacked = await unpackGroup(m, entries)
    } catch (error) {
      result.failed.push({ repo: entries[0].github.repo, ...failureOf(error) })
      continue
    }
    try {
      for (const entry of entries) {
        result.checked += 1
        if (!unpacked.dirs.includes(entry.github.path)) {
          findings.set(entry.skill, { gone: true })
          continue
        }
        const { content } = await fingerprint(repoDir(unpacked.root, entry.github.path))
        findings.set(entry.skill, content === entry.content ? {} : { latest: { content, ...unpacked.commit === undefined ? {} : { commit: unpacked.commit } } })
      }
    } finally {
      await rm(unpacked.scratch, { recursive: true, force: true })
    }
  }
  await m.store.update((next) => {
    for (const [skill, finding] of findings) {
      const github = next.skills[skill]?.imported?.github
      if (github === undefined) continue
      github.checkedAt = Date.now()
      if (finding.latest === undefined) delete github.latest
      else github.latest = finding.latest
      if (finding.gone) github.gone = true
      else delete github.gone
    }
  })
  result.updates = [...findings].filter(([, finding]) => finding.latest !== undefined).map(([skill]) => skill)
  return result
}

/**
 * Install the newer versions of skills from GitHub over the installed copies; each current copy is saved as a version
 * first.
 * @param {{ skills?: unknown }} body - the skills to update, or nothing for every one with a newer version.
 * @returns {Promise<{ results: object[] }>} one result per skill, as `importSkills` gives them.
 */
async function updateGithub(m, body) {
  const state = await m.store.read()
  const installed = await installedFromGithub(state)
  const wanted = Array.isArray(body.skills) ? new Set(body.skills.map(checkSkill).filter(skill => installed.has(skill))) : new Set([...installed].filter(skill => state.skills[skill].imported.github.latest !== undefined))
  if (wanted.size === 0) throw new ActionError('bad-request', 'Nothing to update')
  const results = []
  for (const [, entries] of githubGroups(state, wanted)) {
    let unpacked
    try {
      unpacked = await unpackGroup(m, entries)
    } catch (error) {
      for (const entry of entries) results.push({ path: `${entry.github.repo}/${entry.github.path}`, name: entry.skill, status: 'error', ...failureOf(error) })
      continue
    }
    try {
      for (const entry of entries) {
        const label = `${entry.github.repo}/${entry.github.path}`
        if (!unpacked.dirs.includes(entry.github.path)) {
          results.push({ path: label, name: entry.skill, status: 'error', code: 'github-gone', error: `${label} is no longer in the repository`, details: { path: label } })
          continue
        }
        try {
          const dir = await realpath(repoDir(unpacked.root, entry.github.path))
          results.push(await importOne(m, { path: dir, name: entry.skill }, undefined, { ...entry.github, ...unpacked.commit === undefined ? {} : { commit: unpacked.commit } }))
        } catch (error) {
          results.push({ path: label, name: entry.skill, status: 'error', ...failureOf(error) })
        }
      }
    } finally {
      await rm(unpacked.scratch, { recursive: true, force: true })
    }
  }
  if (results.some(result => result.status !== 'error')) await settle(m)
  return { results }
}

/**
 * Remove this plugin's settings of some kinds from every mode, for handing them over to dsh-modes.
 * @param {{ kinds?: unknown }} body - the kinds (`off`, `manual`, `model`) to clear; all when omitted.
 * @returns {Promise<{ failed: object[], mounted: string[] }>} as {@link setModes} reports the mode rows.
 */
async function clearModes(m, body) {
  const kinds = Array.isArray(body.kinds) ? body.kinds.filter(kind => LISTED_STATES.includes(kind)) : LISTED_STATES
  const state = await m.store.read()
  const ids = Object.keys(state.presets).filter(id => declarations(m.ctx).has(id))
  await m.store.update((next) => {
    for (const record of Object.values(next.presets)) {
      for (const kind of kinds) delete record[kind]
    }
  })
  const result = await syncRows(m, ids)
  for (const id of ids) forget(m, id)
  for (const listener of m.watchers) listener()
  return result
}

/**
 * How often each skill was loaded in a time window, from the session history (usage.js).
 * @param {{ days?: unknown, refresh?: unknown }} body - the window in days (7, 30, 90, or 365; 30 by default), and
 *   whether to read every session again instead of reusing saved ones.
 * @returns {Promise<object>} `days`, `since`, how many sessions exist (`total`), were read (`scanned`) and could not be
 *   (`failed`), whether older ones were left out (`truncated`) or the time budget ran out (`complete` false), and `skills`
 *   (per name: loads by the model and the user, first and last time, and the same per mode).
 * @throws {ActionError} `usage-unavailable` when the composition has no `sessionQuery` service.
 */
async function usageOf(m, body) {
  const service = m.ctx.get('sessionQuery')
  if (service === undefined) throw new ActionError('usage-unavailable', 'This composition has no session history, so usage cannot be counted')
  const days = USAGE_WINDOWS.includes(body.days) ? body.days : 30
  const since = Date.now() - days * DAY_MS
  const { sessions, ...counts } = await collectUsage({ service, defaultMode: m.ctx.agentPresets.defaultId ?? '', cache: m.usageCache, force: body.refresh === true })
  return { days, since, ...counts, skills: summarizeUsage(sessions, since) }
}

/**
 * Search the skill store, reusing a recent answer for the same text.
 * @param {{ query?: unknown }} body - the text to look for.
 * @returns {Promise<{ results: object[] }>} `{ id, repo, skill, installs }` per result.
 */
async function storeSearch(m, body) {
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const key = query.toLowerCase()
  const cached = m.storeCache.get(key)
  if (cached !== undefined && Date.now() - cached.at < STORE_TTL_MS) return { results: cached.results }
  const results = await searchStore(query)
  m.storeCache.delete(key)
  m.storeCache.set(key, { at: Date.now(), results })
  if (m.storeCache.size > STORE_CACHE_SIZE) m.storeCache.delete(m.storeCache.keys().next().value)
  return { results }
}
