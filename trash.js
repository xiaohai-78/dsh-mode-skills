/**
 * The recycle bin for deleted skills.
 *
 * Deleting moves the skill's folder (or flat `<name>.md` file) to `<store>/trash/<id>/item` and records in
 * `<store>/trash/<id>/meta.json` its name and where it came from; restoring moves it back unchanged. Nothing expires on
 * its own: an entry stays until it is restored, removed, or the bin is emptied.
 *
 * A move between file systems (`EXDEV`), or of a folder Windows will not rename while DSH's file watcher holds it, is
 * done by copying and then removing the original. When Windows also refuses to remove the emptied folder, it is left
 * behind empty, which DSH ignores; the move only fails if the skill's instruction file is still there.
 */
import { cp, lstat, mkdir, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { renameWithRetry } from './fs-retry.js'
import { SkillFileError } from './skill-files.js'

/** How links inside a skill are copied: kept as links, except on Windows (see skill-files.js). */
const LINKS = process.platform === 'win32' ? { dereference: true } : { verbatimSymlinks: true }
/** Bin entry ids: the time of the deletion and the skill's name. */
const ENTRY_ID = /^[0-9]{13}-[a-z0-9]+(?:-[a-z0-9]+)*$/
const BUSY = new Set(['EPERM', 'EACCES', 'EBUSY'])

async function exists(path) {
  return lstat(path).then(() => true, () => false)
}

/** Remove what is inside a folder, leaving the folder itself. */
async function emptyFolder(dir) {
  for (const entry of await readdir(dir)) await rm(join(dir, entry), { recursive: true, force: true })
}

/**
 * Move a file or folder, copying and removing when a rename cannot do it.
 * @param {string} from - the current path.
 * @param {string} to - the new path, which must not exist.
 * @param {{ platform?: string, renameImpl?: Function }} [options] - the platform to behave as, and the rename to use.
 * @returns {Promise<void>} settles once `to` holds the item and `from` no longer does.
 */
export async function moveItem(from, to, { platform = process.platform, renameImpl } = {}) {
  await mkdir(dirname(to), { recursive: true })
  try {
    await renameWithRetry(from, to, { platform, ...renameImpl === undefined ? {} : { renameImpl } })
    return
  } catch (error) {
    if (error?.code !== 'EXDEV' && !(platform === 'win32' && BUSY.has(error?.code))) throw error
  }
  const info = await lstat(from)
  await cp(from, to, { recursive: true, errorOnExist: true, force: false, ...LINKS })
  try {
    await rm(from, { recursive: true, force: true })
  } catch (error) {
    if (!info.isDirectory()) throw error
    await emptyFolder(from)
    await rmdir(from).catch(() => undefined)
  }
}

/**
 * Move a skill into the bin.
 * @param {{ trashDir: string, name: string, from: string, layout: 'directory' | 'file', description?: string, now?: number }} input -
 *   the bin folder, the skill's name, its folder or flat file, its layout, and its description for the bin's list.
 * @returns {Promise<string>} the entry id.
 */
export async function trashSkill({ trashDir, name, from, layout, description, now = Date.now(), platform, renameImpl }) {
  const id = `${now}-${name}`
  const dir = join(trashDir, id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'meta.json'), `${JSON.stringify({ name, from, layout, ...description === undefined ? {} : { description }, at: now }, null, 2)}\n`)
  try {
    await moveItem(from, join(dir, 'item'), { platform, renameImpl })
  } catch (error) {
    if (!(await exists(join(dir, 'item')))) await rm(dir, { recursive: true, force: true })
    throw error
  }
  return id
}

/**
 * The entries in the bin, newest first; an entry without its item (an interrupted delete) is left out.
 * @returns {Promise<{ id: string, name: string, from: string, layout: string, description?: string, at: number }[]>}
 */
export async function listTrash(trashDir) {
  let names
  try {
    names = await readdir(trashDir)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const entries = []
  for (const id of names.filter(name => ENTRY_ID.test(name))) {
    try {
      if (!(await exists(join(trashDir, id, 'item')))) continue
      entries.push({ id, ...JSON.parse(await readFile(join(trashDir, id, 'meta.json'), 'utf8')) })
    } catch {
      // An entry whose record cannot be read is skipped; its files stay in the bin folder.
    }
  }
  return entries.sort((a, b) => b.at - a.at)
}

function entryDir(trashDir, id) {
  if (typeof id !== 'string' || !ENTRY_ID.test(id)) throw new SkillFileError('trash-unknown', `No such entry in the bin: ${String(id)}`)
  return join(trashDir, id)
}

/**
 * Put an entry back where it came from. A folder left there empty by a Windows delete is reused.
 * @returns {Promise<{ name: string, from: string }>} the skill's name and place.
 * @throws {SkillFileError} `trash-unknown` for a missing entry, `trash-target-exists` when something else is there now.
 */
export async function restoreTrash(trashDir, id, options = {}) {
  const dir = entryDir(trashDir, id)
  let meta
  try {
    meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'))
  } catch {
    // A missing or unreadable record means there is nothing this page can restore.
    throw new SkillFileError('trash-unknown', `No such entry in the bin: ${id}`)
  }
  if (await exists(meta.from)) {
    const left = (await lstat(meta.from)).isDirectory() && (await readdir(meta.from)).length === 0
    if (!left) throw new SkillFileError('trash-target-exists', `Something is already at ${meta.from}`, { name: meta.name })
    await rmdir(meta.from)
  }
  await moveItem(join(dir, 'item'), meta.from, options)
  await rm(dir, { recursive: true, force: true })
  return { name: meta.name, from: meta.from }
}

/** Remove one entry for good. */
export async function purgeTrash(trashDir, id) {
  await rm(entryDir(trashDir, id), { recursive: true, force: true })
}

/** Remove every entry for good. */
export async function emptyTrash(trashDir) {
  await rm(trashDir, { recursive: true, force: true })
}
