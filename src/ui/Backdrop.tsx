import { AnimatePresence, motion } from 'motion/react'
import { cx } from './cx'

// Tight display tracking, except where a word's letters collide at it: LEGS runs E-G-S together.
const TRACKING_EM = -0.06
const WORD_TRACKING_EM: Record<string, number> = { LEGS: 0.01 }

type BackdropProps = {
  color: boolean
  word: string
  compact: boolean
}

// Color-mode stage dressing: soft white highlight behind the figure and the big ghost word.
export function Backdrop({ color, word, compact }: BackdropProps) {
  const tracking = WORD_TRACKING_EM[word] ?? TRACKING_EM
  return (
    <>
      <div
        className={cx(
          'pointer-events-none absolute inset-[-10%_-20%] z-0 bg-[radial-gradient(ellipse_50%_45%_at_50%_52%,rgba(255,255,255,.28),transparent_100%)] blur-[40px] transition-opacity duration-500',
          color ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cx(
          // Nudged below the stage's middle: centred, the word ran across the face.
          'pointer-events-none absolute inset-0 z-0 flex translate-y-[5%] items-center justify-center transition-opacity duration-500 select-none',
          color ? 'opacity-[.14]' : 'opacity-0',
        )}
        aria-hidden='true'
      >
        <AnimatePresence mode='popLayout' initial={false}>
          <motion.span
            key={word}
            className={cx(
              'font-display leading-none font-extrabold whitespace-nowrap text-(--on-slot)',
              compact ? 'text-[34vw]' : 'text-[clamp(120px,15vw,260px)]',
            )}
            // The margin cancels the trailing letter-space tracking leaves behind, which would
            // otherwise shift the word off the figure it sits behind.
            style={{ letterSpacing: `${tracking}em`, marginInlineEnd: `${-tracking}em` }}
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
