import { readFile } from 'node:fs/promises'

export type PartMeta = {
  name?: string
  scale?: number
  offsetX?: number
  offsetY?: number
  exclude?: boolean
  order?: number
  // Shop photos often show front and back side by side; keep only the front half.
  crop?: 'left' | 'right'
  // Photo of a hat or hair worn by a display figure, which has to come off. 'red' is La Petite
  // Brique's plain red figure, keyed out by colour; 'white' is extraextrabricks' plain white one,
  // segmented away from the piece it wears.
  keyOut?: 'red' | 'white'
  // The garment carries white as pale as the studio paper, where there is no edge for the key to
  // find. Cut out by `pnpm masks` instead, and built from the mask it leaves in assets/masks.
  subject?: boolean
  // Where the subject mask lost a piece the plain key does find, as [x, y, width, height] rectangles
  // in fractions of the photo: Vision drops the security torso's neck stud, and without it the part
  // measures shorter than it is and comes out oversized.
  keep?: [number, number, number, number][]
  // A piece no darker than the figure wearing it — pale grey plastic on the white display figure —
  // is one every test in the segmentation reads as figure. `keyFloor` is the value the flood will
  // not spread below, and the tests that go by paleness are left off with it: what survives keeps
  // the figure it sits on, and that figure comes off by hand on the erase page.
  keyFloor?: number
  // Openings no threshold can find, as rounded [x, y, width, height] rectangles in fractions of the
  // photo (after `crop`): the face inside the Batman cowl's mouth is in shadow, so it reads as dark
  // as the plastic framing it.
  cut?: [number, number, number, number][]
}

export type MetaFile = Record<string, PartMeta>

export async function loadMeta(path: string): Promise<MetaFile> {
  const raw = await readFile(path, 'utf8')
  const parsed: unknown = JSON.parse(raw.normalize('NFC'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} must be a JSON object keyed by "<slot>/<filename>"`)
  }
  return parsed as MetaFile
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function nameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/-\d+x\d+$/, '')
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
