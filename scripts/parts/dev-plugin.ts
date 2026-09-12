// Dev-only: the QA pages POST their state here so decisions survive without a manual export.
// /scripts/parts/picker judges shop photos before import, /scripts/parts/review judges built parts,
// /scripts/parts/fit collects what is wrong with each hair piece on the head, /scripts/parts/erase
// records the brush strokes that wipe leftover artifacts off a finished part.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

const DOCS = path.resolve(import.meta.dirname, '../../docs')
const ASSETS = path.resolve(import.meta.dirname, '../../assets')

const STORES: Record<string, { file: string; empty: string }> = {
  '/__picker/picks': { file: path.join(DOCS, 'picks.json'), empty: '[]' },
  '/__review/verdicts': { file: path.join(DOCS, 'part-review.json'), empty: '{"parts":[]}' },
  '/__fit/notes': { file: path.join(DOCS, 'hair-notes.json'), empty: '{"notes":[]}' },
  // Not a QA verdict but a source asset: the retouch is replayed by every `pnpm parts`.
  '/__erase/strokes': { file: path.join(ASSETS, 'parts.erase.json'), empty: '{}' },
}

export function partsDevPlugin(): Plugin {
  return {
    name: 'minifig-parts-dev',
    apply: 'serve',
    // The pages POST after every stroke; unwatched, or the watcher sees its own write and
    // full-reloads the page mid-edit, dropping the zoom, the pan and the piece you were on.
    config: () => ({
      server: { watch: { ignored: Object.values(STORES).map((store) => store.file) } },
    }),
    configureServer(server) {
      for (const [route, store] of Object.entries(STORES)) {
        server.middlewares.use(route, async (request, response) => {
          if (request.method === 'GET') {
            const body = await readFile(store.file, 'utf8').catch(() => store.empty)
            response.setHeader('Content-Type', 'application/json')
            response.end(body)
            return
          }
          if (request.method !== 'POST') {
            response.statusCode = 405
            response.end()
            return
          }
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(chunk as Buffer)
          await writeFile(store.file, Buffer.concat(chunks))
          response.statusCode = 204
          response.end()
        })
      }
    },
  }
}
