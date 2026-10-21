/** プレビューの中の位置の目印。元の行番号（0 始まり、data-line）と、プレビューの先頭からの高さ */
export interface Anchor {
  line: number
  top: number
}

/**
 * 目印を、行番号と高さの両方が増えていく順に整える。両端に「先頭（0 行目、高さ 0）」と「末尾（行数、全体の高さ）」を足し、
 * 入れ子の要素（リストの中の項目など）で高さが前の目印より上に戻るものは捨てる（補間の区間が逆向きにならないように）
 */
export function normalizeAnchors(anchors: Anchor[], lineCount: number, height: number): Anchor[] {
  const sorted = [...anchors].sort((a, b) => a.line - b.line || a.top - b.top)
  const result: Anchor[] = [{ line: 0, top: 0 }]
  for (const anchor of [...sorted, { line: lineCount, top: height }]) {
    const last = result[result.length - 1]
    // 同じ行の目印は最初のもの（いちばん上）だけを使う
    if (anchor.line > last.line && anchor.top >= last.top) result.push(anchor)
  }
  return result
}

/** エディタの行（小数を含む）に対応するプレビューの高さ。前後の目印の間を比例で補う */
export function topForLine(anchors: Anchor[], line: number): number {
  return interpolate(anchors, line, 'line', 'top')
}

/** プレビューの高さに対応するエディタの行（小数を含む） */
export function lineForTop(anchors: Anchor[], top: number): number {
  return interpolate(anchors, top, 'top', 'line')
}

function interpolate(anchors: Anchor[], value: number, from: keyof Anchor, to: keyof Anchor): number {
  if (anchors.length === 0) return 0
  if (value <= anchors[0][from]) return anchors[0][to]
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (value < b[from]) {
      const span = b[from] - a[from]
      return span === 0 ? a[to] : a[to] + ((value - a[from]) / span) * (b[to] - a[to])
    }
  }
  return anchors[anchors.length - 1][to]
}
