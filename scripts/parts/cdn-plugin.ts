import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import type { HtmlTagDescriptor, Plugin } from 'vite'
import { PARTS_CDN } from '../../src/parts/cdn.ts'
import { SLOTS } from '../../src/parts/manifest.ts'
import { DEFAULT_SELECTION } from '../../src/state/selection.ts'

// Build-only. public/parts is 83 MB — 389 PNG masters the erase tool retouches plus the WebP the
// site actually shows — and the deploy needs none of it: every image is fetched from GitHub Pages.
// So the folder is dropped from dist, and the head gets the handshake with that origin plus the
// four opening parts, which otherwise cannot start downloading until the manifest has arrived.
export function partsCdnPlugin(): Plugin {
  return {
    name: 'minifig-parts-cdn',
    apply: 'build',
    transformIndexHtml() {
      return hints()
    },
    async closeBundle() {
      const dist = path.resolve(import.meta.dirname, '../../dist')
      // Vite copies public/ verbatim, Finder leaves .DS_Store in it, and the deploy would serve it.
      await rm(path.join(dist, '.DS_Store'), { force: true })
      const parts = path.join(dist, 'parts')
      const dropped = await measure(parts)
      if (!dropped.count) return
      await rm(parts, { recursive: true, force: true })
      this.info(`kept ${dropped.count} part files out of the bundle (${mb(dropped.bytes)} MB)`)
    },
  }
}

function hints(): HtmlTagDescriptor[] {
  // The handshake is per origin, not per path; the preloads carry the full URL.
  const origin = new URL(PARTS_CDN).origin
  const opening = SLOTS.flatMap((slot) => {
    const id = DEFAULT_SELECTION[slot]
    return id ? [`${PARTS_CDN}/parts/${slot}/${id}.webp`] : []
  })
  return [
    { tag: 'link', attrs: { rel: 'dns-prefetch', href: origin }, injectTo: 'head' },
    {
      tag: 'link',
      attrs: { rel: 'preconnect', href: origin, crossorigin: '' },
      injectTo: 'head',
    },
    {
      tag: 'link',
      attrs: {
        rel: 'preload',
        as: 'fetch',
        type: 'application/json',
        href: `${PARTS_CDN}/parts/parts.json`,
        crossorigin: '',
      },
      injectTo: 'head',
    },
    // A share link swaps some of these out, but a bare visit always opens on exactly these four.
    ...opening.map((href): HtmlTagDescriptor => ({
      tag: 'link',
      attrs: { rel: 'preload', as: 'image', type: 'image/webp', href, crossorigin: '' },
      injectTo: 'head',
    })),
  ]
}

async function measure(dir: string): Promise<{ count: number; bytes: number }> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => [])
  let count = 0
  let bytes = 0
  for (const entry of entries) {
    if (!entry.isFile()) continue
    bytes += (await stat(path.join(entry.parentPath, entry.name))).size
    count += 1
  }
  return { count, bytes }
}

function mb(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1)
}
