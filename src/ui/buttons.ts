import type { Slot } from '../parts/manifest'
import { cx } from './cx'
import { onSlotIsWhite } from './palette'

export const PILL =
  'inline-flex items-center justify-center rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-200 hover:-translate-y-px active:translate-y-px'

// Same skin assembled or apart — only the label flips. Red here read as an alert, and on a red slot
// it vanished into the backdrop.
export function snapButtonClass(color: boolean, slot: Slot) {
  return cx(
    PILL,
    color
      ? 'bg-(--on-slot) text-(--slot) shadow-[0_12px_28px_-14px_rgba(0,0,0,.5)]'
      : 'bg-navy text-white shadow-[0_10px_24px_-12px_rgba(23,28,58,.6)]',
    // Only where the pill comes out white is it one of the row's white buttons, and takes their border.
    color && onSlotIsWhite(slot) && 'border border-line',
  )
}

// Same lift as the stage's other white controls, so the action row sits on one plane.
export const GHOST = cx(
  PILL,
  'border border-line bg-white text-navy shadow-[0_10px_24px_-12px_rgba(0,0,0,.55)]',
)
