import type { Sharp } from 'sharp'

type Rgb = { r: number; g: number; b: number }

function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

function toHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

// Dominant colour of the opaque pixels, biased toward saturated colours so a
// yellow-handed black suit reads as black, but a plain blue jacket reads as blue.
export async function dominantColor(image: Sharp): Promise<string> {
  const { data, info } = await image
    .clone()
    .resize(48, 48, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const buckets = new Map<string, { count: number; sum: Rgb }>()
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3]!
    if (a < 200) continue
    const px = { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! }
    if (px.r > 240 && px.g > 240 && px.b > 240) continue
    const key = [px.r >> 4, px.g >> 4, px.b >> 4].join(',')
    const bucket = buckets.get(key) ?? { count: 0, sum: { r: 0, g: 0, b: 0 } }
    bucket.count += 1
    bucket.sum.r += px.r
    bucket.sum.g += px.g
    bucket.sum.b += px.b
    buckets.set(key, bucket)
  }

  let best: { score: number; rgb: Rgb } | null = null
  for (const { count, sum } of buckets.values()) {
    const rgb = {
      r: Math.round(sum.r / count),
      g: Math.round(sum.g / count),
      b: Math.round(sum.b / count),
    }
    const score = count * (0.35 + saturation(rgb))
    if (!best || score > best.score) best = { score, rgb }
  }
  return best ? toHex(best.rgb) : '#888888'
}
