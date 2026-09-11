import { SLOTS, type Slot } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'

// null means "no hair". Only the hair slot may be null.
export type Selection = Record<Slot, string | null>

export type Direction = 1 | -1

export const DEFAULT_SELECTION: Selection = {
  hair: 'pirate-hat',
  head: 'smirk',
  body: 'dollar-chain',
  pants: 'tan-camo',
}

// 'white' is the quiet stage, 'color' floods it with the focused slot's colour.
export type Mode = 'white' | 'color'

export const DEFAULT_MODE: Mode = 'color'

// What a share link carries.
export type Shared = { selection: Selection; mode: Mode }

export type ConfiguratorState = {
  selection: Selection
  exploded: boolean
  activeSlot: Slot | null
  focusSlot: Slot
  direction: Direction
  mode: Mode
}

export type Action =
  | { type: 'set'; slot: Slot; id: string | null; direction?: Direction }
  | { type: 'cycle'; slot: Slot; direction: Direction; bySlot: PartsBySlot }
  | { type: 'activate'; slot: Slot | null }
  | { type: 'focus'; slot: Slot }
  | { type: 'explode'; exploded: boolean }
  | { type: 'mode'; mode: Mode }

export function initialState({ selection, mode }: Shared): ConfiguratorState {
  return {
    selection,
    exploded: true,
    activeSlot: null,
    focusSlot: 'body',
    direction: 1,
    mode,
  }
}

// Options for a slot in picker order. Hair gets a trailing "none".
export function optionsFor(bySlot: PartsBySlot, slot: Slot): (string | null)[] {
  const ids: (string | null)[] = bySlot[slot].map((part) => part.id)
  return slot === 'hair' ? [...ids, null] : ids
}

export function nextOption(
  bySlot: PartsBySlot,
  slot: Slot,
  current: string | null,
  direction: Direction,
) {
  const options = optionsFor(bySlot, slot)
  const index = options.indexOf(current)
  return options[(index + direction + options.length) % options.length] ?? null
}

export function reduce(state: ConfiguratorState, action: Action): ConfiguratorState {
  switch (action.type) {
    case 'set': {
      if (state.selection[action.slot] === action.id) return state
      return {
        ...state,
        selection: { ...state.selection, [action.slot]: action.id },
        direction: action.direction ?? 1,
        focusSlot: action.slot,
      }
    }
    case 'cycle': {
      const id = nextOption(
        action.bySlot,
        action.slot,
        state.selection[action.slot],
        action.direction,
      )
      return reduce(state, { type: 'set', slot: action.slot, id, direction: action.direction })
    }
    case 'activate':
      return {
        ...state,
        activeSlot: action.slot,
        focusSlot: action.slot ?? state.focusSlot,
      }
    case 'focus':
      return { ...state, focusSlot: action.slot }
    case 'explode':
      return { ...state, exploded: action.exploded }
    case 'mode':
      return { ...state, mode: action.mode }
  }
}

export function randomSelection(
  bySlot: PartsBySlot,
  random: () => number = Math.random,
): Selection {
  return Object.fromEntries(
    SLOTS.map((slot) => {
      const options = optionsFor(bySlot, slot)
      return [slot, options[Math.floor(random() * options.length)] ?? null]
    }),
  ) as Selection
}
