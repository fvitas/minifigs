import type { Slot } from '../parts/manifest'

// Static per-slot colours for Block mode. Never derived from the selected part (D30).
export const SLOT_PALETTE: Record<Slot, { slot: string; onSlot: string }> = {
  hair: { slot: '#f26b1d', onSlot: '#ffffff' },
  head: { slot: '#ffcf00', onSlot: '#171c3a' },
  body: { slot: '#e3000b', onSlot: '#ffffff' },
  pants: { slot: '#0f6fd6', onSlot: '#ffffff' },
}

export const SLOT_LABEL: Record<Slot, string> = {
  hair: 'Hair & hats',
  head: 'Head',
  body: 'Torso',
  pants: 'Legs',
}
export const SLOT_SHORT: Record<Slot, string> = {
  hair: 'Hair',
  head: 'Head',
  body: 'Torso',
  pants: 'Legs',
}
export const SLOT_WORD: Record<Slot, string> = {
  hair: 'HAIR',
  head: 'HEAD',
  body: 'TORSO',
  pants: 'LEGS',
}
export const SLOT_CHOOSE: Record<Slot, string> = {
  hair: 'hair & hats',
  head: 'a head',
  body: 'a torso',
  pants: 'legs',
}
