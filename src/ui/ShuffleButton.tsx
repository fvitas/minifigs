import { Shuffle } from 'lucide-react'
import { GHOST } from './buttons'
import { cx } from './cx'

type ShuffleButtonProps = {
  className?: string
  onShuffle: () => void
}

export function ShuffleButton({ className, onShuffle }: ShuffleButtonProps) {
  return (
    <button
      type='button'
      className={cx(GHOST, 'gap-2 whitespace-nowrap', className)}
      onClick={onShuffle}
      data-testid='shuffle'
    >
      <Shuffle className='size-4' />
      Shuffle
    </button>
  )
}
