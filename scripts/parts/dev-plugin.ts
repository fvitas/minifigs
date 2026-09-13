// Dev-only: the QA pages POST their state here so decisions survive without a manual export.
// /scripts/parts/picker judges shop photos before import, /scripts/parts/review judges built parts,
// /scripts/parts/fit collects what is wrong with each hair piece on the head, /scripts/parts/erase
// records the brush strokes that wipe leftover artifacts off a finished part,
// /scripts/parts/accept keeps or throws away what the last `pnpm parts` did to each torso.
import type { ServerResponse } from 'node:http'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { changedTorsos, committed, committedPath, revertTorsos } from './baseline.ts'

const DOCS = path.resolve(import.meta.dirname, '../../docs')
const ASSETS = path.resolve(import.meta.dirname, '../../assets')
const MANIFEST = path.resolve(import.meta.dirname, '../../public/parts/parts.json')

const STORES: Record<string, { file: string; empty: string }> = {
  '/__picker/picks': { file: path.join(DOCS, 'picks.json'), empty: '[]' },
  '/__review/verdicts': { file: path.join(DOCS, 'part-review.json'), empty: '{"parts":[]}' },
  '/__fit/notes': { file: path.join(DOCS, 'hair-notes.json'), empty: '{"notes":[]}' },
  // Not a QA verdict but a source asset: the retouch is replayed by every `pnpm parts`.
  '/__erase/strokes': { file: path.join(ASSETS, 'parts.erase.json'), empty: '{}' },
  '/__accept/verdicts': { file: path.join(DOCS, 'torso-accept.json'), empty: '{"parts":[]}' },
}

function json(response: ServerResponse, body: unknown): void {
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
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

      // Which torsos the working build changed. 170-odd pixel comparisons take a moment, so the
      // answer is held against the manifest's timestamp: it is rewritten by every build and by
      // every revert, which are the only two things that can change it.
      let changed: { at: number; ids: Promise<string[]> } | null = null
      server.middlewares.use('/__accept/changed', async (_request, response) => {
        const { mtimeMs } = await stat(MANIFEST)
        if (changed?.at !== mtimeMs) changed = { at: mtimeMs, ids: changedTorsos() }
        json(response, { ids: await changed.ids })
      })

      // The committed torso, straight out of git, so the page can flip between before and after
      // without a second copy of the build lying around on disk.
      server.middlewares.use('/__accept/before', async (request, response) => {
        const id = path.basename(request.url ?? '', '.png')
        const blob = id && (await committed(committedPath(id, '.png')))
        if (!blob) {
          response.statusCode = 404
          response.end()
          return
        }
        response.setHeader('Content-Type', 'image/png')
        // The bytes change under the same URL the moment a revert lands.
        response.setHeader('Cache-Control', 'no-store')
        response.end(blob)
      })

      server.middlewares.use('/__accept/revert', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        const { ids } = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { ids: string[] }
        json(response, { reverted: await revertTorsos(ids) })
      })
    },
  }
}
