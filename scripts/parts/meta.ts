import { readFile } from 'node:fs/promises'

export type PartMeta = {
  name?: string
  scale?: number
  offsetX?: number
  offsetY?: number
  exclude?: boolean
  order?: number
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
