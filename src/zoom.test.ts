import { describe, expect, it } from 'vitest'
import { centered, fitView, MAX_SCALE, MIN_SCALE, panBy, zoomAt } from './zoom'

const area = { width: 832, height: 632 }

describe('fitView', () => {
  it('全体が余白付きで収まる倍率にし、中央に置く', () => {
    expect(fitView({ width: 400, height: 1200 }, area)).toEqual({ scale: 0.5, x: 316, y: 16 })
  })

  it('小さい図は拡大する。ただし上限は超えない', () => {
    expect(fitView({ width: 200, height: 100 }, area).scale).toBe(4)
    expect(fitView({ width: 10, height: 10 }, area).scale).toBe(MAX_SCALE)
  })

  it('大きさが分からない図は等倍で置く', () => {
    expect(fitView({ width: 0, height: 0 }, area)).toEqual({ scale: 1, x: 416, y: 316 })
  })
})

describe('centered', () => {
  it('指定の倍率で中央に置く', () => {
    expect(centered({ width: 400, height: 300 }, area, 1)).toEqual({ scale: 1, x: 216, y: 166 })
  })
})

describe('zoomAt', () => {
  it('指定した点の下にある図の点を動かさない', () => {
    const view = { scale: 1, x: 100, y: 50 }
    const point = { x: 300, y: 250 }
    const next = zoomAt(view, 2, point)
    expect(next.scale).toBe(2)
    // 拡大前に point の下にあった図の座標（200, 200）が、拡大後も point の下にある
    expect((point.x - next.x) / next.scale).toBe((point.x - view.x) / view.scale)
    expect((point.y - next.y) / next.scale).toBe((point.y - view.y) / view.scale)
  })

  it('倍率は上限と下限で止まり、止まったときは位置も動かさない', () => {
    const view = { scale: MAX_SCALE, x: 10, y: 20 }
    expect(zoomAt(view, 2, { x: 300, y: 300 })).toEqual(view)
    expect(zoomAt({ scale: 0.2, x: 0, y: 0 }, 0.1, { x: 0, y: 0 }).scale).toBe(MIN_SCALE)
  })
})

describe('panBy', () => {
  it('倍率を変えずに動かす', () => {
    expect(panBy({ scale: 2, x: 10, y: 20 }, -5, 15)).toEqual({ scale: 2, x: 5, y: 35 })
  })
})
