/** 図の表示位置。図の左上が表示領域のどこにあるか（x, y）と、倍率（scale） */
export interface View {
  scale: number
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 8
// 図を表示領域に合わせるときの余白（片側）
const FIT_MARGIN = 16

/** 図の全体が表示領域に収まる大きさで、中央に置く。小さい図は拡大する（拡大表示のための機能なので） */
export function fitView(content: Size, area: Size): View {
  if (content.width <= 0 || content.height <= 0) return centered(content, area, 1)
  const scale = Math.min((area.width - FIT_MARGIN * 2) / content.width, (area.height - FIT_MARGIN * 2) / content.height)
  return centered(content, area, scale)
}

/** 指定の倍率で中央に置く */
export function centered(content: Size, area: Size, scale: number): View {
  const clamped = clampScale(scale)
  return { scale: clamped, x: (area.width - content.width * clamped) / 2, y: (area.height - content.height * clamped) / 2 }
}

/** point（表示領域上の位置）の下にある図の点を動かさずに、倍率を factor 倍にする */
export function zoomAt(view: View, factor: number, point: Point): View {
  const scale = clampScale(view.scale * factor)
  const ratio = scale / view.scale
  return { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }
}

export function panBy(view: View, dx: number, dy: number): View {
  return { ...view, x: view.x + dx, y: view.y + dy }
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}
