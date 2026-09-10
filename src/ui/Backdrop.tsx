import { AnimatePresence, motion } from 'motion/react'
import { cx } from './cx'

type BackdropProps = {
  block: boolean
  word: string
  compact: boolean
}

// Block-mode stage dressing: soft white highlight behind the figure and the big ghost word.
export function Backdrop({ block, word, compact }: BackdropProps) {
  return (
    <>
      <div
        className={cx(
          'pointer-events-none absolute inset-[-10%_-20%] z-0 bg-[radial-gradient(ellipse_50%_45%_at_50%_52%,rgba(255,255,255,.28),transparent_100%)] blur-[40px] transition-opacity duration-500',
          block ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cx(
          'pointer-events-none absolute inset-0 z-0 grid place-items-center transition-opacity duration-500 select-none',
          block ? 'opacity-[.14]' : 'opacity-0',
        )}
        aria-hidden='true'
      >
        <AnimatePresence mode='popLayout' initial={false}>
          <motion.span
            key={word}
            className={cx(
              'font-display leading-none font-extrabold tracking-[-.06em] whitespace-nowrap text-(--on-slot)',
              compact ? 'text-[34vw]' : 'text-[clamp(120px,15vw,260px)]',
            )}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </div>
    </>
  )
}
