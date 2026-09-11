// Hand retouch recorded by the erase page (scripts/parts/erase): each stroke is a brush radius and
// the points it was dragged through, in the pixels of the finished part canvas. Kept as source, in
// assets/parts.erase.json, so `pnpm parts` can re-apply it to a rebuilt PNG.
export type Stroke = { r: number; points: [number, number][] }

export type EraseFile = Record<string, Stroke[]>

export function eraseKey(slot: string, id: string): string {
  return `${slot}/${id}`
}

export function readStrokes(value: unknown): EraseFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: EraseFile = {}
  for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue
    const strokes: Stroke[] = []
    for (const entry of list as unknown[]) {
      const { r, points } = (entry ?? {}) as Partial<Stroke>
      if (typeof r !== 'number' || !Array.isArray(points)) continue
      const kept = points.filter(
        (point): point is [number, number] =>
          Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number',
      )
      if (kept.length) strokes.push({ r, points: kept })
    }
    if (strokes.length) out[key] = strokes
  }
  return out
}
