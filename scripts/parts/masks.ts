// Cuts a subject mask for every photo marked `subject` in parts.meta.json. Some shop photos put a
// white sleeve against the white studio paper, where there is no edge for the build's brightness key
// to find; those get a mask cut here instead, by the foreground segmentation macOS already ships.
// The masks are source assets, committed next to the photos: `pnpm parts` only reads them, so a
// build needs neither macOS nor Xcode.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { SLOTS, type Slot } from '../../src/parts/manifest.ts'
import { loadMeta } from './meta.ts'

const run = promisify(execFile)

const ROOT = path.resolve(import.meta.dirname, '../..')
const RAW_DIR = path.join(ROOT, 'assets/raw')
const MASK_DIR = path.join(ROOT, 'assets/masks')
const META_PATH = path.join(ROOT, 'assets/parts.meta.json')
const SOURCE = path.join(import.meta.dirname, 'subject-mask.swift')

export const maskPath = (slot: Slot, filename: string) =>
  path.join(MASK_DIR, slot, `${filename.replace(/\.[^.]+$/, '')}.png`)

async function main(): Promise<void> {
  const meta = await loadMeta(META_PATH)
  const wanted = Object.entries(meta)
    .filter(([, part]) => part.subject && !part.exclude)
    .map(([key]) => key.split('/') as [Slot, string])
    .filter(([slot]) => (SLOTS as readonly string[]).includes(slot))
  if (!wanted.length) {
    console.log('nothing marked `subject` in parts.meta.json')
    return
  }

  const build = await mkdtemp(path.join(tmpdir(), 'subject-mask-'))
  const tool = path.join(build, 'subject-mask')
  console.log(`compiling ${path.relative(ROOT, SOURCE)}`)
  await run('swiftc', ['-O', SOURCE, '-o', tool])

  for (const [slot, filename] of wanted) {
    const out = maskPath(slot, filename)
    await mkdir(path.dirname(out), { recursive: true })
    const { stdout } = await run(tool, [path.join(RAW_DIR, slot, filename), out])
    console.log(`+ ${slot}/${filename} · ${stdout.trim()}`)
  }
  console.log(`\n${wanted.length} masks -> assets/masks`)
}

await main()
