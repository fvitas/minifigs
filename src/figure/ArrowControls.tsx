import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { Slot } from '../parts/manifest'
import type { Direction } from '../state/selection'
import { cx } from '../ui/cx'

type ArrowControlsProps = {
  slot: Slot
  visible: boolean
  hoverReveal: boolean
  onCycle: (slot: Slot, direction: Direction) => void
}

export function ArrowControls({ slot, visible, hoverReveal, onCycle }: ArrowControlsProps) {
  const arrow = (direction: Direction) => {
    const onClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onCycle(slot, direction)
    }
    const Icon = direction < 0 ? ArrowLeft : ArrowRight
    return (
      <button
        type='button'
        aria-label={`${direction < 0 ? 'Previous' : 'Next'} ${slot}`}
        className={cx(
          'absolute top-1/2 z-10 grid size-[34px] -translate-y-1/2 place-items-center rounded-full border-[1.5px] border-line bg-white text-navy shadow-[0_8px_20px_-12px_rgba(0,0,0,.4)] transition-[opacity,transform,border-color,color] duration-200 hover:border-lego hover:text-lego active:scale-95 md:size-9',
          direction < 0 ? '-left-[30px] md:-left-3' : '-right-[30px] md:-right-3',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0',
          hoverReveal && !visible && 'group-hover:pointer-events-auto group-hover:opacity-100',
        )}
        onClick={onClick}
        data-testid={`arrow-${slot}-${direction < 0 ? 'prev' : 'next'}`}
      >
        <Icon className='size-4' />
      </button>
    )
  }
  return (
    <>
      {arrow(-1)}
      {arrow(1)}
    </>
  )
}
