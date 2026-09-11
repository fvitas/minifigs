import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Part, Slot } from '../parts/manifest'
import type { PartsBySlot } from '../parts/useManifest'
import { optionsFor, type Direction } from '../state/selection'
import { cx } from '../ui/cx'
import { PartTile } from './PartTile'

type PartStripProps = {
  slot: Slot
  bySlot: PartsBySlot
  selected: string | null
  color: boolean
  onSelect: (slot: Slot, id: string | null, direction: Direction) => void
}

const EDGE_SLACK = 4

// Mobile: one horizontal row of thumbs. Edge fades and chevrons show where more thumbs are hidden.
export function PartStrip({ slot, bySlot, selected, color, onSelect }: PartStripProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const options = optionsFor(bySlot, slot)

  const updateEdges = () => {
    const element = scroller.current
    if (!element) return
    setEdges({
      left: element.scrollLeft > EDGE_SLACK,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - EDGE_SLACK,
    })
  }

  // Centre the selected thumb whenever the slot or selection changes. Scrolls the strip only,
  // never the document.
  useEffect(() => {
    const element = scroller.current
    const target = element?.querySelector<HTMLElement>('[data-selected="true"]')
    if (!element || !target) return
    element.scrollTo({
      left: target.offsetLeft - element.clientWidth / 2 + target.clientWidth / 2,
      behavior: 'smooth',
    })
    const timer = setTimeout(updateEdges, 450)
    updateEdges()
    return () => clearTimeout(timer)
  }, [slot, selected])

  const scrollBy = (direction: Direction) => {
    scroller.current?.scrollBy({
      left: direction * scroller.current.clientWidth * 0.7,
      behavior: 'smooth',
    })
  }

  const style = { '--edge': color ? 'var(--slot)' : 'var(--color-fog)' } as CSSProperties
  const fade = 'pointer-events-none absolute inset-y-0 z-[2] w-14 transition-opacity duration-300'
  const chevron =
    'absolute top-1/2 z-[3] grid size-[30px] -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-navy shadow-[0_6px_16px_-10px_rgba(0,0,0,.5)] transition-[opacity,transform] duration-300 active:scale-90'

  return (
    <div className='relative min-w-0' style={style} data-testid='part-strip'>
      <div
        className={cx(
          fade,
          'left-0 bg-[linear-gradient(90deg,var(--edge)_30%,transparent)]',
          edges.left ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cx(
          fade,
          'right-0 bg-[linear-gradient(-90deg,var(--edge)_30%,transparent)]',
          edges.right ? 'opacity-100' : 'opacity-0',
        )}
      />
      <button
        type='button'
        aria-label='Scroll left'
        className={cx(
          chevron,
          'left-2',
          edges.left ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => scrollBy(-1)}
      >
        <ChevronLeft className='size-4' />
      </button>
      <button
        type='button'
        aria-label='Scroll right'
        className={cx(
          chevron,
          'right-2',
          edges.right ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => scrollBy(1)}
      >
        <ChevronRight className='size-4' />
      </button>
      <div
        ref={scroller}
        className='flex min-h-[79px] gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        onScroll={updateEdges}
      >
        {options.map((id, index) => {
          const part: Part | null = id
            ? (bySlot[slot].find((candidate) => candidate.id === id) ?? null)
            : null
          const currentIndex = options.indexOf(selected)
          return (
            <div key={id ?? 'none'} data-selected={id === selected} className='shrink-0'>
              <PartTile
                part={part}
                selected={id === selected}
                index={index}
                color={color}
                className={cx(
                  'size-[68px]',
                  !color && !(id === selected) && 'border-line bg-white',
                )}
                onSelect={() => onSelect(slot, id, index >= currentIndex ? 1 : -1)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
