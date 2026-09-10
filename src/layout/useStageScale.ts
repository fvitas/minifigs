import { useRef } from 'react'
import { useElementSize } from '../hooks/useElementSize'
import { CANVAS_WIDTH, figureHeight } from '../parts/geometry'

const DESKTOP_MAX_SCALE = 0.42

// px per geometry px so the exploded figure always fits the stage. 0 until the stage is measured.
export function useStageScale(compact: boolean) {
  const stageRef = useRef<HTMLElement>(null)
  const { width, height } = useElementSize(stageRef)
  const exploded = figureHeight(true)
  const scale =
    width === 0 || height === 0
      ? 0
      : compact
        ? Math.min((height - 16) / exploded, (width - 90) / CANVAS_WIDTH)
        : Math.min(DESKTOP_MAX_SCALE, (height - 24) / exploded, (width - 100) / CANVAS_WIDTH)
  return { stageRef, scale: Math.max(0, scale) }
}
