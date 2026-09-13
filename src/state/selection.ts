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
  | { type: 'set'; slot: Slot; id: string | null; direction?: Direction; focus?: boolean }
  | { type: 'restore'; shared: Shared }
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
  // The default leads its picker: the part the stage opens on is the first tile in every slot,
  // instead of sitting at #176 of 179 and making the strip scroll to find itself.
  const fallback = DEFAULT_SELECTION[slot]
  const rest: (string | null)[] = bySlot[slot]
    .map((part) => part.id)
    .filter((id) => id !== fallback)
  const ids =
    rest.length === bySlot[slot].length ? rest : ([fallback, ...rest] as (string | null)[])
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
        // Shuffle passes focus: false — it changes all four slots, and following each one would
        // strobe the stage through four palettes and four words.
        focusSlot: action.focus === false ? state.focusSlot : action.slot,
      }
    }
    // Browser history: the URL is the whole share state, so Back replaces selection and mode.
    case 'restore':
      return { ...state, selection: action.shared.selection, mode: action.shared.mode }
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
