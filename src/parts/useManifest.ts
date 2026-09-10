import { use } from 'react'
import { SLOTS, type Manifest, type Part, type Slot } from './manifest'

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

const catalogPromise: Promise<Catalog> = fetch('/parts/parts.json')
  .then((response) => response.json() as Promise<Manifest>)
  .then(indexManifest)

export function useCatalog(): Catalog {
  return use(catalogPromise)
}
