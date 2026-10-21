/**
 * Reads the files out of a `.zip` archive, for installing skills, and writes a skill folder as one, for exporting it.
 *
 * Supported when reading: stored and deflated entries in an archive without zip64 records or encryption, which covers
 * what desktop archivers and `git archive` write. Folder entries, links, and macOS metadata (`__MACOSX/`, `.DS_Store`)
 * are skipped. An entry whose path is absolute or climbs out of the archive is refused, and so is an archive past the
 * file or byte limits; the byte limit applies to the inflated size, checked while inflating, so a small archive cannot
 * expand past it.
 */
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'
import { SkillFileError } from './skill-files.js'

const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
const LOCAL_HEADER = 0x04034b50

function refuse(code, message, details) {
  return new SkillFileError(code, message, details)
}

/**
 * A safe relative path for an archive entry, or undefined for an entry to skip.
 * @throws {SkillFileError} `zip-unsafe-path` for an absolute path or one that climbs out.
 */
export function entryPath(name) {
  const path = name.replaceAll('\\', '/')
  if (path.endsWith('/')) return undefined
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw refuse('zip-unsafe-path', `Unsafe path in the archive: ${name}`, { path: name })
  const parts = path.split('/').filter(part => part !== '' && part !== '.')
  if (parts.includes('..')) throw refuse('zip-unsafe-path', `Unsafe path in the archive: ${name}`, { path: name })
  if (parts[0] === '__MACOSX' || parts.at(-1) === '.DS_Store') return undefined
  return parts.join('/')
}

/** The central directory of an archive: its entries as stored, and the archive comment. */
function directory(buffer) {
  let end = -1
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 22 - 0xffff); at--) {
    if (buffer.readUInt32LE(at) === END_OF_DIRECTORY) {
      end = at
      break
    }
  }
  if (end < 0) throw refuse('zip-invalid', 'This is not a zip archive')
  const count = buffer.readUInt16LE(end + 10)
  const size = buffer.readUInt32LE(end + 12)
  const offset = buffer.readUInt32LE(end + 16)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw refuse('zip-unsupported', 'Zip64 archives are not supported')
  if (offset + size > end) throw refuse('zip-invalid', 'The archive is damaged')
  const entries = []
  let at = offset
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || buffer.readUInt32LE(at) !== DIRECTORY_ENTRY) throw refuse('zip-invalid', 'The archive is damaged')
    const nameLength = buffer.readUInt16LE(at + 28)
    const extraLength = buffer.readUInt16LE(at + 30)
    const commentLength = buffer.readUInt16LE(at + 32)
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength)
    entries.push({
      name,
      flags: buffer.readUInt16LE(at + 8),
      method: buffer.readUInt16LE(at + 10),
      compressed: buffer.readUInt32LE(at + 20),
      inflated: buffer.readUInt32LE(at + 24),
      unixMode: buffer.readUInt32LE(at + 38) >>> 16,
      local: buffer.readUInt32LE(at + 42),
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  const commentLength = buffer.readUInt16LE(end + 20)
  return { entries, comment: buffer.toString('utf8', end + 22, Math.min(buffer.length, end + 22 + commentLength)) }
}

/** Whether an entry is a link, which is never extracted. */
function isLink(entry) {
  return (entry.unixMode & 0o170000) === 0o120000
}

/**
 * The comment of an archive. `git archive`, and so GitHub's source archives, write the commit id there.
 * @param {Buffer} buffer - the archive.
 * @returns {string} the comment, empty when there is none.
 * @throws {SkillFileError} `zip-invalid` or `zip-unsupported` when the archive cannot be read.
 */
export function zipComment(buffer) {
  return directory(buffer).comment
}

/**
 * The paths of the files in an archive, without reading their content.
 * @param {Buffer} buffer - the archive.
 * @returns {string[]} each file's relative path (`/`-separated), leaving out folders, links, and macOS metadata.
 * @throws {SkillFileError} `zip-invalid`, `zip-unsupported`, or `zip-unsafe-path`.
 */
export function zipPaths(buffer) {
  const paths = []
  for (const entry of directory(buffer).entries) {
    const path = entryPath(entry.name)
    if (path !== undefined && !isLink(entry)) paths.push(path)
  }
  return paths
}

/**
 * The files of an archive.
 * @param {Buffer} buffer - the archive.
 * @param {{ maxFiles: number, maxBytes: number }} limits - the most files and inflated bytes accepted.
 * @param {{ include?: (path: string) => boolean }} [options] - `include` leaves out the files it rejects before they are
 *   counted or inflated.
 * @returns {{ path: string, data: Buffer }[]} each file's relative path (`/`-separated) and content.
 * @throws {SkillFileError} `zip-invalid`, `zip-unsupported`, `zip-unsafe-path`, or `skill-too-large`.
 */
export function readZip(buffer, { maxFiles, maxBytes }, { include = () => true } = {}) {
  const tooLarge = () => refuse('skill-too-large', `The archive has more than ${maxFiles} files or ${maxBytes} bytes`, { files: maxFiles, megabytes: maxBytes / 1024 / 1024 })
  const files = []
  let total = 0
  for (const entry of directory(buffer).entries) {
    const { name, flags, method, compressed, inflated, local } = entry
    const path = entryPath(name)
    if (path === undefined || isLink(entry) || !include(path)) continue
    if (flags & 1) throw refuse('zip-unsupported', 'Encrypted archives are not supported')
    if (method !== 0 && method !== 8) throw refuse('zip-unsupported', `Unsupported compression in the archive: ${name}`)
    if (compressed === 0xffffffff || inflated === 0xffffffff) throw refuse('zip-unsupported', 'Zip64 archives are not supported')
    if (files.length + 1 > maxFiles || total + inflated > maxBytes) throw tooLarge()
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== LOCAL_HEADER) throw refuse('zip-invalid', 'The archive is damaged')
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    if (start + compressed > buffer.length) throw refuse('zip-invalid', 'The archive is damaged')
    const raw = buffer.subarray(start, start + compressed)
    let data
    try {
      data = method === 0 ? Buffer.from(raw) : inflateRawSync(raw, { maxOutputLength: Math.max(1, maxBytes - total) })
    } catch (error) {
      if (error?.code === 'ERR_BUFFER_TOO_LARGE') throw tooLarge()
      throw refuse('zip-invalid', `The archive is damaged: ${name}`)
    }
    if (data.length !== inflated) throw refuse('zip-invalid', `The archive is damaged: ${name}`)
    total += data.length
    files.push({ path, data })
  }
  return files
}

/** The DOS date and time fields of a moment, as zip headers hold them. */
function dosTime(date) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/**
 * An archive of files, deflated where that makes them smaller, with UTF-8 names and Unix permissions.
 * @param {{ path: string, data: Buffer, executable?: boolean }[]} files - relative paths (`/`-separated) and content.
 * @param {{ when?: Date, comment?: string }} [options] - the modification time given to every file, and the archive comment.
 * @returns {Buffer} the archive.
 * @throws {SkillFileError} `zip-unsupported` when the archive would need zip64 records.
 */
export function writeZip(files, { when = new Date(), comment = '' } = {}) {
  const stamp = dosTime(when)
  const locals = []
  const directoryParts = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.path)
    const deflated = deflateRawSync(file.data)
    const method = deflated.length < file.data.length ? 8 : 0
    const stored = method === 8 ? deflated : file.data
    const checksum = crc32(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_HEADER, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.date, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(stored.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(DIRECTORY_ENTRY, 0)
    central.writeUInt16LE(0x031e, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(stamp.time, 12)
    central.writeUInt16LE(stamp.date, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(stored.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(((file.executable ? 0o100755 : 0o100644) << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    locals.push(local, name, stored)
    directoryParts.push(central, name)
    offset += 30 + name.length + stored.length
    if (offset >= 0xffffffff || files.length >= 0xffff) throw refuse('zip-unsupported', 'The archive would be too large')
  }
  const body = Buffer.concat(locals)
  const entries = Buffer.concat(directoryParts)
  const note = Buffer.from(comment)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_DIRECTORY, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(entries.length, 12)
  end.writeUInt32LE(body.length, 16)
  end.writeUInt16LE(note.length, 20)
  return Buffer.concat([body, entries, end, note])
}
