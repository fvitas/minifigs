import { writeFile } from 'node:fs/promises'
import type { Manifest, Slot } from '../../src/parts/manifest.ts'
import { CANVAS_WIDTH, GEOMETRY, figureHeight, slotBottoms } from '../../src/parts/geometry.ts'

// Local-only alignment check page. Served by `pnpm mockups` at /parts-preview.html.
export async function writePreview(file: string, manifest: Manifest): Promise<void> {
  const bySlot = (slot: Slot) => manifest.parts.filter((p) => p.slot === slot)
  const scale = 0.5
  const assembled = slotBottoms(false)
  const exploded = slotBottoms(true)
  const totalH = figureHeight(true)

  const layer = (slot: Slot, src: string) => {
    const g = GEOMETRY[slot]
    return `<img class="layer ${slot}" src="${src}" style="width:${CANVAS_WIDTH * scale}px;height:${g.canvasHeight * scale}px;--assembled:${assembled[slot] * scale}px;--exploded:${exploded[slot] * scale}px">`
  }
  const figure = (hair: string, head: string, body: string, pants: string, label: string) => `
    <figure style="width:${CANVAS_WIDTH * scale}px;height:${totalH * scale}px">
      ${layer('pants', pants)}${layer('body', body)}${layer('head', head)}${hair ? layer('hair', hair) : ''}
      <figcaption>${label}</figcaption>
    </figure>`

  const heads = bySlot('head')
  const hairs = bySlot('hair')
  const bodies = bySlot('body')
  const pants = bySlot('pants')
  const pick = <T>(arr: T[], i: number) => arr[i % arr.length]!

  const headRow = heads.map((h, i) =>
    figure(pick(hairs, i).src, h.src, pick(bodies, i).src, pick(pants, i).src, h.name),
  )
  const hairRow = hairs.map((h) =>
    figure(h.src, heads[0]!.src, bodies[0]!.src, pants[0]!.src, h.name),
  )
  const bodyRow = bodies.map((b) =>
    figure(hairs[0]!.src, heads[0]!.src, b.src, pants[0]!.src, b.name),
  )
  const pantsRow = pants.map((p) =>
    figure(hairs[0]!.src, heads[0]!.src, bodies[0]!.src, p.src, p.name),
  )

  const grid = manifest.slots
    .map(
      (slot) =>
        `<h2>${slot}</h2><div class="row">${bySlot(slot)
          .map(
            (p) =>
              `<div class="cell"><img src="${p.src}" style="width:${CANVAS_WIDTH * scale * 0.6}px"><span style="background:${p.color}"></span><small>${p.name}<br>${p.id}</small></div>`,
          )
          .join('')}</div>`,
    )
    .join('')

  const html = `<!doctype html><meta charset="utf-8"><title>parts preview</title>
<style>
  body{font:12px system-ui;background:#eee;margin:0;padding:24px}
  h2{margin:32px 0 8px;text-transform:uppercase;letter-spacing:.1em;color:#555}
  .row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end}
  figure{position:relative;margin:0;background:repeating-linear-gradient(0deg,#e4e4e4 0 1px,transparent 1px 25px);outline:1px dashed #bbb}
  .layer{position:absolute;left:0;bottom:var(--assembled);transition:bottom .5s cubic-bezier(.2,.9,.2,1.1)}
  body.exploded .layer{bottom:var(--exploded)}
  .layer:hover{outline:1px solid rgba(255,0,0,.4)}
  figcaption{position:absolute;top:100%;left:0;right:0;text-align:center;padding:4px;color:#333}
  .cell{display:flex;flex-direction:column;align-items:center;gap:4px;background:#fff;padding:8px}
  .cell img{outline:1px dashed #ccc}
  .cell span{width:100%;height:10px;border-radius:2px}
  button{position:fixed;top:12px;right:12px;padding:8px 14px;font:inherit}
</style>
<button onclick="document.body.classList.toggle('exploded')">toggle exploded</button>
<h2>every head</h2><div class="row">${headRow.join('')}</div>
<h2>every hair / hat on head 1</h2><div class="row">${hairRow.join('')}</div>
<h2>every body</h2><div class="row">${bodyRow.join('')}</div>
<h2>every pants</h2><div class="row">${pantsRow.join('')}</div>
<h1 style="margin-top:64px">Canvases</h1>${grid}
`
  await writeFile(file, html)
}

// Geometry as plain JS for the throwaway HTML mockups, so they never drift from the app.
export async function writeGeometryJs(file: string): Promise<void> {
  const data = {
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: Object.fromEntries(Object.entries(GEOMETRY).map(([k, g]) => [k, g.canvasHeight])),
    assembled: slotBottoms(false),
    exploded: slotBottoms(true),
    height: { assembled: figureHeight(false), exploded: figureHeight(true) },
  }
  await writeFile(file, `window.MINIFIG_GEOMETRY = ${JSON.stringify(data, null, 2)}\n`)
}
