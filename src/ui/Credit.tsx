import { cx } from './cx'

const DRIBBBLE_SHOT = 'https://dribbble.com/shots/3722311'
const TWITTER = 'https://x.com/vitasdev'

const LINK = 'underline decoration-current/40 underline-offset-2 transition-colors hover:text-lego'

type CreditProps = {
  inline?: boolean
  className?: string
}

export function Credit({ inline, className }: CreditProps) {
  return (
    <span
      className={cx(
        'flex whitespace-nowrap',
        inline ? 'justify-center gap-x-1.5' : 'flex-col',
        className,
      )}
    >
      <span>
        Built by{' '}
        <a href={TWITTER} target='_blank' rel='noreferrer' className={LINK} data-testid='author'>
          Filip Vitas
        </a>
      </span>
      {inline && <span aria-hidden='true'>·</span>}
      <span>
        Inspired by{' '}
        <a
          href={DRIBBBLE_SHOT}
          target='_blank'
          rel='noreferrer'
          className={LINK}
          data-testid='credit'
        >
          Léo Sestier&rsquo;s design
        </a>
      </span>
    </span>
  )
}
