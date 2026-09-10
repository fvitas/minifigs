import { SLOTS, type Slot } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'
import { DEFAULT_SELECTION, type Selection } from './selection'

const NONE = 'none'

export function encode(selection: Selection): string {
  const params = new URLSearchParams()
  for (const slot of SLOTS) params.set(slot, selection[slot] ?? NONE)
  return `?${params.toString()}`
}

// Unknown or missing ids fall back to the default so old links keep working when parts change.
export function decode(search: string, bySlot: PartsBySlot): Selection {
  const params = new URLSearchParams(search)
  const selection = { ...DEFAULT_SELECTION }
  for (const slot of SLOTS) selection[slot] = resolve(slot, params.get(slot), bySlot)
  return selection
}

function resolve(slot: Slot, value: string | null, bySlot: PartsBySlot): string | null {
  if (value === null) return DEFAULT_SELECTION[slot]
  if (value === NONE) return slot === 'hair' ? null : DEFAULT_SELECTION[slot]
  return bySlot[slot].some((part) => part.id === value) ? value : DEFAULT_SELECTION[slot]
}
