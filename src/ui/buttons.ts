import { cx } from './cx'

export const PILL =
  'inline-flex items-center justify-center rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-200 hover:-translate-y-px active:translate-y-px'

export function snapButtonClass(exploded: boolean, color: boolean) {
  return cx(
    PILL,
    exploded
      ? color
        ? 'bg-(--on-slot) text-(--slot) shadow-[0_12px_28px_-14px_rgba(0,0,0,.5)]'
        : 'bg-navy text-white shadow-[0_10px_24px_-12px_rgba(23,28,58,.6)]'
      : 'bg-lego text-white shadow-[0_10px_24px_-12px_rgba(227,0,11,.7)]',
  )
}

export const GHOST = cx(PILL, 'border border-line bg-white text-navy')
