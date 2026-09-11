import { Credit } from './Credit'
import { cx } from './cx'

export function Footer({ color }: { color: boolean }) {
  return (
    <footer
      className={cx(
        'flex items-end justify-between px-10 py-3 text-xs transition-colors duration-500',
        color ? 'text-(--on-slot)/75' : 'text-muted',
      )}
    >
      <Credit />
      <span>← → swap · ↑ ↓ change part · Space or ⏎ snaps</span>
    </footer>
  )
}
