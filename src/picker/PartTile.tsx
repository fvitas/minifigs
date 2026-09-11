import type { Part } from '../parts/manifest'
import { cx } from '../ui/cx'

type PartTileProps = {
  part: Part | null
  selected: boolean
  color: boolean
  className?: string
  onSelect: () => void
}

// No entry animation: pickers hold up to 179 tiles, and staggering them in made the grid crawl.
export function PartTile({ part, selected, color, className, onSelect }: PartTileProps) {
  return (
    <button
      type='button'
      title={part?.name ?? 'No hair'}
      className={cx(
        'grid aspect-square place-items-center rounded-xl border-[1.5px] p-2 transition-[border-color,background-color,box-shadow] duration-150',
        selected
          ? color
            ? 'border-white bg-white shadow-[0_0_0_3px_rgba(255,255,255,.45)]'
            : 'border-lego bg-white shadow-[0_0_0_3px_rgba(227,0,11,.4)]'
          : 'border-transparent bg-fog hover:border-line hover:bg-white',
        className,
      )}
      onClick={onSelect}
      data-testid={`tile-${part?.id ?? 'none'}`}
    >
      {part ? (
        <img
          src={part.thumb}
          alt={part.name}
          className='size-full object-contain'
          draggable={false}
        />
      ) : (
        <span className='text-[26px] leading-none text-muted'>×</span>
      )}
    </button>
  )
}
