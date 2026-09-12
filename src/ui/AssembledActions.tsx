import { Check, Download, Link } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { composePng, downloadBlob, exportFilename } from '../export/composePng'
import { copyLink, shareOnX } from '../export/share'
import type { Catalog } from '../parts/useManifest'
import type { Selection } from '../state/selection'
import { GHOST } from './buttons'
import { cx } from './cx'
import { XLogo } from './XLogo'

type AssembledActionsProps = {
  compact: boolean
  selection: Selection
  catalog: Catalog
}

const COPIED_MS = 1_500

// Download + Copy link + post to X. Always visible; the PNG is composed assembled regardless of
// the stage, and the link already carries the figure in its query string.
export function AssembledActions({ compact, selection, catalog }: AssembledActionsProps) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const download = async () => {
    if (busy) return
    setBusy(true)
    try {
      downloadBlob(await composePng(selection, catalog), exportFilename(selection))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!(await copyLink())) return
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  const button = cx(
    GHOST,
    'shrink-0 hover:border-lego hover:text-lego',
    compact ? 'size-[50px]' : 'size-10',
  )
  const CopyIcon = copied ? Check : Link
  const copyLabel = copied ? 'URL copied' : 'Copy link'

  return (
    <div className='relative flex items-center gap-2 md:gap-[10px]' data-testid='assembled-actions'>
      <AnimatePresence>
        {copied && (
          <motion.span
            role='status'
            className='pointer-events-none absolute right-0 bottom-full mb-2 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-[0_10px_24px_-12px_rgba(23,28,58,.6)]'
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            data-testid='copied-toast'
          >
            URL copied
          </motion.span>
        )}
      </AnimatePresence>
      <button
        type='button'
        title='Download PNG'
        aria-label='Download PNG'
        className={button}
        disabled={busy}
        onClick={download}
        data-testid='download'
      >
        <Download className='size-4' />
      </button>
      <button
        type='button'
        title={copyLabel}
        aria-label={copyLabel}
        className={cx(button, copied && 'border-lego text-lego')}
        onClick={copy}
        data-testid='copy-link'
      >
        <CopyIcon className='size-4' />
      </button>
      <button
        type='button'
        title='Share on X'
        aria-label='Share on X'
        className={button}
        onClick={shareOnX}
        data-testid='share-x'
      >
        <XLogo className='size-[15px]' />
      </button>
    </div>
  )
}
