import { SLOTS, type Slot } from '../parts/manifest'
import type { Catalog } from '../parts/useManifest'
import type { Selection } from '../state/selection'
import { cx } from '../ui/cx'

type SlotCardsProps = {
  catalog: Catalog
  selection: Selection
  activeSlot: Slot | null
  block: boolean
  onActivate: (slot: Slot) => void
}

export function SlotCards({ catalog, selection, activeSlot, block, onActivate }: SlotCardsProps) {
  return (
    <div className='grid grid-cols-[repeat(4,112px)] gap-[18px]' data-testid='slot-cards'>
      {SLOTS.map((slot) => {
        const id = selection[slot]
        const part = id ? catalog.byId.get(id) : undefined
        const active = activeSlot === slot
        return (
          <button
            key={slot}
            type='button'
            className={cx(
              'grid gap-2 text-center text-xs transition-colors duration-500',
              block ? 'text-(--on-slot)/75' : 'text-muted',
            )}
            onClick={() => onActivate(slot)}
            data-testid={`card-${slot}`}
          >
            <span
              className={cx(
                'grid h-[112px] place-items-center rounded-[14px] border-[1.5px] bg-white transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_14px_30px_-18px_rgba(23,28,58,.5)]',
                active
                  ? block
                    ? 'border-white shadow-[0_0_0_4px_rgba(255,255,255,.5)]'
                    : 'border-lego shadow-[0_0_0_4px_rgba(227,0,11,.12)]'
                  : block
                    ? 'border-transparent'
                    : 'border-line',
              )}
            >
              {part ? (
                <img
                  src={part.thumb}
                  alt={part.name}
                  className='size-[70%] object-contain'
                  draggable={false}
                />
              ) : (
                <span className='text-[28px] text-muted'>×</span>
              )}
            </span>
            <span className={cx('font-medium', block ? 'text-(--on-slot)' : 'text-ink')}>
              {part?.name ?? 'No hair'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
