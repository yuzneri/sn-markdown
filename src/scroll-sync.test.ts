import { describe, expect, it } from 'vitest'
import { lineForTop, normalizeAnchors, topForLine } from './scroll-sync'

describe('normalizeAnchors', () => {
  it('先頭と末尾を足し、行番号の順に並べる', () => {
    expect(normalizeAnchors([{ line: 4, top: 300 }, { line: 2, top: 100 }], 10, 800)).toEqual([
      { line: 0, top: 0 },
      { line: 2, top: 100 },
      { line: 4, top: 300 },
      { line: 10, top: 800 },
    ])
  })

  it('高さが前の目印より上に戻るものと、同じ行の 2 つ目以降は捨てる', () => {
    expect(
      normalizeAnchors(
        [
          { line: 2, top: 100 },
          { line: 2, top: 140 },
          { line: 3, top: 90 },
          { line: 5, top: 200 },
        ],
        8,
        400,
      ),
    ).toEqual([
      { line: 0, top: 0 },
      { line: 2, top: 100 },
      { line: 5, top: 200 },
      { line: 8, top: 400 },
    ])
  })

  it('目印がなければ、先頭と末尾だけで比例させる', () => {
    expect(normalizeAnchors([], 10, 500)).toEqual([
      { line: 0, top: 0 },
      { line: 10, top: 500 },
    ])
  })

  it('最初の目印が 0 行目なら、先頭の目印と重ねない', () => {
    expect(normalizeAnchors([{ line: 0, top: 16 }], 4, 100)).toEqual([
      { line: 0, top: 0 },
      { line: 4, top: 100 },
    ])
  })
})

describe('topForLine と lineForTop', () => {
  const anchors = normalizeAnchors(
    [
      { line: 0, top: 0 },
      { line: 10, top: 200 },
      { line: 12, top: 600 }, // 10〜11 行目は大きい図（Mermaid）で、プレビューでは高い
    ],
    20,
    800,
  )

  it('目印の間を比例で補う', () => {
    expect(topForLine(anchors, 5)).toBe(100)
    expect(topForLine(anchors, 11)).toBe(400)
    expect(topForLine(anchors, 16)).toBe(700)
  })

  it('逆向きの変換は元に戻る', () => {
    for (const line of [0, 3.5, 10, 11.25, 12, 19]) expect(lineForTop(anchors, topForLine(anchors, line))).toBeCloseTo(line)
  })

  it('範囲の外は両端に寄せる', () => {
    expect(topForLine(anchors, -3)).toBe(0)
    expect(topForLine(anchors, 99)).toBe(800)
    expect(lineForTop(anchors, 5000)).toBe(20)
  })
})
