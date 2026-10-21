import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { entryPath, readZip } from '../zip.js'

/**
 * A zip archive of `entries` (`{ name, data, method?, mode?, flags? }`), written the way archivers lay it out. CRCs are
 * left at zero: the reader does not check them.
 */
function zip(entries) {
  const locals = []
  const directory = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name)
    const data = Buffer.from(entry.data ?? '')
    const method = entry.method ?? 8
    const stored = method === 8 ? deflateRawSync(data) : data
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(entry.flags ?? 0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(stored.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    locals.push(local, name, stored)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(entry.flags ?? 0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(stored.length, 20)
    central.writeUInt32LE(entry.declared ?? data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    directory.push(central, name)
    offset += 30 + name.length + stored.length
  }
  const body = Buffer.concat(locals)
  const dir = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(body.length, 16)
  return Buffer.concat([body, dir, end])
}

const limits = { maxFiles: 10, maxBytes: 1024 }

test('reads stored and deflated files, skipping folders, links, and macOS metadata', () => {
  const files = readZip(zip([
    { name: 'notes/', data: '' },
    { name: 'notes/SKILL.md', data: '---\nname: notes\n---\n' },
    { name: 'notes\\scripts\\run.sh', data: 'echo run\n', method: 0 },
    { name: 'notes/link', data: 'SKILL.md', mode: 0o120777 },
    { name: '__MACOSX/notes/._SKILL.md', data: 'x' },
    { name: 'notes/.DS_Store', data: 'x' },
  ]), limits)
  assert.deepEqual(files.map(file => [file.path, file.data.toString()]), [['notes/SKILL.md', '---\nname: notes\n---\n'], ['notes/scripts/run.sh', 'echo run\n']])
})

test('refuses paths that leave the archive, encryption, and archives past the limits', () => {
  assert.throws(() => entryPath('../evil.md'), error => error.code === 'zip-unsafe-path')
  assert.throws(() => entryPath('/etc/passwd'), error => error.code === 'zip-unsafe-path')
  assert.throws(() => entryPath('C:/Windows/x'), error => error.code === 'zip-unsafe-path')
  assert.throws(() => readZip(zip([{ name: 'a/../../x', data: 'x' }]), limits), error => error.code === 'zip-unsafe-path')
  assert.throws(() => readZip(zip([{ name: 'a', data: 'x', flags: 1 }]), limits), error => error.code === 'zip-unsupported')
  assert.throws(() => readZip(zip(Array.from({ length: 11 }, (_, index) => ({ name: `f${index}`, data: 'x' }))), limits), error => error.code === 'skill-too-large')
  assert.throws(() => readZip(zip([{ name: 'big', data: 'a'.repeat(2000) }]), limits), error => error.code === 'skill-too-large')
  assert.throws(() => readZip(zip([{ name: 'bomb', data: 'a'.repeat(5000), declared: 10 }]), limits), error => error.code === 'skill-too-large', 'a size that lies is caught while inflating')
  assert.throws(() => readZip(Buffer.from('not a zip at all, just text'), limits), error => error.code === 'zip-invalid')
})

test('writes an archive the reader takes back, with its comment, paths, and file modes', async () => {
  const { writeZip, zipComment, zipPaths } = await import('../zip.js')
  const commit = 'a'.repeat(40)
  const archive = writeZip([
    { path: 'repo-main/SKILL.md', data: Buffer.from('---\nname: a\n---\n'.repeat(50)) },
    { path: 'repo-main/scripts/run.sh', data: Buffer.from('echo hi\n'), executable: true },
    { path: 'repo-main/文档/说明.md', data: Buffer.from('中文') },
  ], { comment: commit })
  assert.equal(zipComment(archive), commit)
  assert.deepEqual(zipPaths(archive), ['repo-main/SKILL.md', 'repo-main/scripts/run.sh', 'repo-main/文档/说明.md'])
  const files = readZip(archive, limits.maxBytes === undefined ? limits : { maxFiles: 10, maxBytes: 10000 })
  assert.deepEqual(files.map(file => [file.path, file.data.length]), [['repo-main/SKILL.md', 800], ['repo-main/scripts/run.sh', 8], ['repo-main/文档/说明.md', 6]])
  assert.equal(zipComment(zip([{ name: 'x', data: 'x' }])), '', 'an archive without a comment')
})

test('reads only the files an include filter accepts, without counting the others', () => {
  const archive = zip([{ name: 'a/keep.md', data: 'k' }, { name: 'b/skip.bin', data: 'x'.repeat(5000) }])
  assert.deepEqual(readZip(archive, limits, { include: path => path.startsWith('a/') }).map(file => file.path), ['a/keep.md'])
})
