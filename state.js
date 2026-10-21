/**
 * The plugin's state, kept beside the profile patch in `<profile>/.dsh-mode-skills/state.json`:
 *
 * - `presets` maps a mode id to `{ off, base }`: the skills turned off in that mode, and the built-in rows its profile
 *   override was last merged with (see mode-rows.js).
 * - `skills` maps a skill name to the details it had when last seen in a mode, so a skill turned off in every mode is
 *   still described.
 *
 * Writes replace the file atomically (temporary file, then rename) and run one at a time within this process. A file
 * that exists but cannot be parsed is reported and never overwritten.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { renameWithRetry } from './fs-retry.js'

const FILE = 'state.json'

/** A state file that exists but is not a JSON object with `presets` and `skills` maps. */
export class StateFileError extends Error {
  constructor(path, cause) {
    super(`${path} is damaged (${cause instanceof Error ? cause.message : String(cause)}); fix or delete it`)
    this.code = 'state-damaged'
    this.path = path
  }
}

function isMap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export class StateStore {
  /**
   * @param {string} dir - directory holding `state.json`; created on the first write.
   */
  constructor(dir) {
    this.dir = dir
    this.queue = Promise.resolve()
  }

  /**
   * @returns {Promise<{ version: number, presets: Record<string, { off?: string[], base?: object[] }>, skills: Record<string, object> }>}
   *   the content, or the empty form when the file does not exist.
   * @throws {StateFileError} when the file exists but is not valid.
   */
  async read() {
    const path = join(this.dir, FILE)
    let text
    try {
      text = await readFile(path, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return { version: 1, presets: {}, skills: {} }
      throw new StateFileError(path, error)
    }
    let value
    try {
      value = JSON.parse(text)
    } catch (error) {
      throw new StateFileError(path, error)
    }
    if (!isMap(value) || !isMap(value.presets) || !isMap(value.skills ?? {})) throw new StateFileError(path, 'expected an object with "presets" and "skills" maps')
    value.skills ??= {}
    return value
  }

  /**
   * Read, change, and atomically replace the file, after every earlier update.
   * @param {(current: object) => void} change - mutates the parsed content in place.
   * @returns {Promise<void>} settles once the new content is on disk.
   */
  update(change) {
    const run = this.queue.then(async () => {
      const current = await this.read()
      change(current)
      await mkdir(this.dir, { recursive: true })
      const path = join(this.dir, FILE)
      const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temporary, `${JSON.stringify(current, null, 2)}\n`)
      await renameWithRetry(temporary, path)
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}
