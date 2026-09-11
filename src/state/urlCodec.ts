import { SLOTS, type Slot } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'
import { DEFAULT_MODE, DEFAULT_SELECTION, type Mode, type Shared } from './selection'

const NONE = 'none'

const MODES: Mode[] = ['white', 'color']

export function encode({ selection, mode }: Shared): string {
  const params = new URLSearchParams()
  for (const slot of SLOTS) params.set(slot, selection[slot] ?? NONE)
  params.set('mode', mode)
  return `?${params.toString()}`
}

// Unknown or missing ids fall back to the default so old links keep working when parts change.
export function decode(search: string, bySlot: PartsBySlot): Shared {
  const params = new URLSearchParams(search)
  const selection = { ...DEFAULT_SELECTION }
  for (const slot of SLOTS) selection[slot] = resolve(slot, params.get(slot), bySlot)
  const mode = params.get('mode')
  return { selection, mode: MODES.find((known) => known === mode) ?? DEFAULT_MODE }
}

function resolve(slot: Slot, value: string | null, bySlot: PartsBySlot): string | null {
  if (value === null) return DEFAULT_SELECTION[slot]
  if (value === NONE) return slot === 'hair' ? null : DEFAULT_SELECTION[slot]
  return bySlot[slot].some((part) => part.id === value) ? value : DEFAULT_SELECTION[slot]
}
