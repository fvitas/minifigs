import { cx } from './cx'

const DRIBBBLE_SHOT = 'https://dribbble.com/shots/3722311'

export function Credit({ className }: { className?: string }) {
  return (
    <span className={cx('whitespace-nowrap', className)}>
      Inspired by{' '}
      <a
        href={DRIBBBLE_SHOT}
        target='_blank'
        rel='noreferrer'
        className='underline decoration-current/40 underline-offset-2 transition-colors hover:text-lego'
        data-testid='credit'
      >
        Léo Sestier&rsquo;s design
      </a>
    </span>
  )
}
