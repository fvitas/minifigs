import { motion } from 'motion/react'
import type { Part } from '../parts/manifest'
import { cx } from '../ui/cx'

type PartTileProps = {
  part: Part | null
  selected: boolean
  index: number
  block: boolean
  className?: string
  onSelect: () => void
}

export function PartTile({ part, selected, index, block, className, onSelect }: PartTileProps) {
  return (
    <motion.button
      type='button'
      title={part?.name ?? 'No hair'}
      className={cx(
        'grid aspect-square place-items-center rounded-xl border-[1.5px] p-2 transition-[transform,border-color,background-color,box-shadow] duration-150 hover:-translate-y-0.5',
        selected
          ? block
            ? 'border-white bg-white shadow-[0_0_0_3px_rgba(255,255,255,.45)]'
            : 'border-lego bg-white shadow-[0_0_0_3px_rgba(227,0,11,.12)]'
          : 'border-transparent bg-fog hover:border-line hover:bg-white',
        className,
      )}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, delay: index * 0.028, ease: [0.2, 0.9, 0.3, 1.1] }}
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
    </motion.button>
  )
}
