// The committed build is the baseline the working tree is judged against: which torsos a rebuild
// changed, what they looked like before, and how to put one back. Read by the dev plugin for the
// accept page (scripts/parts/accept), which is the only thing that ever reverts a part.
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import type { Manifest } from '../../src/parts/manifest.ts'

const run = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '../..')
const PARTS = 'public/parts'
const MANIFEST = `${PARTS}/parts.json`
// A part is three files; the PNG is what is compared, the other two follow it.
const SUFFIXES = ['.png', '.webp', '.thumb.webp']

export function committedPath(id: string, suffix: string): string {
  return `${PARTS}/body/${id}${suffix}`
}

export async function committed(file: string): Promise<Buffer | null> {
  return run('git', ['show', `HEAD:${file}`], {
    cwd: ROOT,
    encoding: 'buffer',
    maxBuffer: 1 << 28,
  })
    .then((result) => result.stdout)
    .catch(() => null)
}

// Byte equality is no use here: two builds of an unchanged photo can encode differently, and a part
// that only re-encoded is not a change anyone can see. Compare the pixels instead.
async function samePixels(a: Buffer, b: Buffer): Promise<boolean> {
  const [left, right] = await Promise.all([sharp(a).raw().toBuffer(), sharp(b).raw().toBuffer()])
  return left.equals(right)
}

export async function changedTorsos(): Promise<string[]> {
  const { stdout } = await run('git', ['diff', '--name-only', 'HEAD', '--', `${PARTS}/body`], {
    cwd: ROOT,
  })
  const files = stdout.split('\n').filter((file) => file.endsWith('.png'))
  const changed = await Promise.all(
    files.map(async (file) => {
      const [before, after] = await Promise.all([
        committed(file),
        readFile(path.join(ROOT, file)).catch(() => null),
      ])
      // Only parts that exist on both sides can be compared: an added or dropped one has no
      // before-and-after to judge.
      if (!before || !after || (await samePixels(before, after))) return null
      return path.basename(file, '.png')
    }),
  )
  return changed.filter((id): id is string => id !== null).sort()
}

// A reverted torso has to take its manifest entry with it, or the part is the committed one while
// its size and hem still describe the build that was thrown away.
async function revertManifest(ids: string[]): Promise<void> {
  const blob = await committed(MANIFEST)
  if (!blob) return
  const before = JSON.parse(blob.toString('utf8')) as Manifest
  const file = path.join(ROOT, MANIFEST)
  const manifest = JSON.parse(await readFile(file, 'utf8')) as Manifest
  const wanted = new Set(ids)
  manifest.parts = manifest.parts.map((part) => {
    if (part.slot !== 'body' || !wanted.has(part.id)) return part
    return before.parts.find((old) => old.slot === 'body' && old.id === part.id) ?? part
  })
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n')
}

export async function revertTorsos(ids: string[]): Promise<string[]> {
  const reverted: string[] = []
  for (const id of ids) {
    const files = SUFFIXES.map((suffix) => committedPath(id, suffix))
    const blobs = await Promise.all(files.map(committed))
    if (blobs.some((blob) => blob === null)) continue
    await Promise.all(
      files.map((file, index) => writeFile(path.join(ROOT, file), blobs[index] as Buffer)),
    )
    reverted.push(id)
  }
  await revertManifest(reverted)
  return reverted
}
