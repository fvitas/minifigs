import { Check, Download, Link } from 'lucide-react'
import { useState } from 'react'
import { composePng, downloadBlob, exportFilename } from '../export/composePng'
import { copyLink } from '../export/share'
import type { Catalog } from '../parts/useManifest'
import type { Selection } from '../state/selection'
import { GHOST } from './buttons'
import { cx } from './cx'

type AssembledActionsProps = {
  compact: boolean
  selection: Selection
  catalog: Catalog
}

const COPIED_MS = 1_500

// Download + Copy link. Always visible; the PNG is composed assembled regardless of the stage.
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
  const copyLabel = copied ? 'Copied!' : 'Copy link'

  return (
    <div className='flex items-center gap-2 md:gap-[10px]' data-testid='assembled-actions'>
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
    </div>
  )
}
