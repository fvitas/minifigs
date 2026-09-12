/// <reference types="vite/client" />
import { use } from 'react'
import { PARTS_CDN } from './cdn'
import { SLOTS, type Manifest, type Part, type Slot } from './manifest'

// Dev keeps reading public/ so a fresh `pnpm parts` shows up without publishing first.
const PARTS_BASE = import.meta.env.DEV ? '' : PARTS_CDN

export type PartsBySlot = Record<Slot, Part[]>

export type Catalog = {
  manifest: Manifest
  bySlot: PartsBySlot
  byId: Map<string, Part>
}

export function indexManifest(manifest: Manifest): Catalog {
  const bySlot = Object.fromEntries(
    SLOTS.map((slot) => [slot, manifest.parts.filter((part) => part.slot === slot)]),
  ) as PartsBySlot
  const byId = new Map(manifest.parts.map((part) => [part.id, part]))
  return { manifest, bySlot, byId }
}

// The manifest ships the root-absolute paths the dev server answers; the deploy points them at the
// CDN. `png` is left alone — the masters never leave this machine, only the erase tool reads them.
function rebase(manifest: Manifest): Manifest {
  if (!PARTS_BASE) return manifest
  return {
    ...manifest,
    parts: manifest.parts.map((part) => ({
      ...part,
      src: PARTS_BASE + part.src,
      thumb: PARTS_BASE + part.thumb,
    })),
  }
}

const catalogPromise: Promise<Catalog> = fetch(`${PARTS_BASE}/parts/parts.json`)
  .then((response) => {
    // fetch resolves on 4xx/5xx, so an error page would otherwise reach the JSON parser.
    if (!response.ok) throw new Error(`parts.json: ${response.status} ${response.statusText}`)
    return response.json() as Promise<Manifest>
  })
  .then(rebase)
  .then(indexManifest)

export function useCatalog(): Catalog {
  return use(catalogPromise)
}
