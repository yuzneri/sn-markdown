import type { MarkdownEditor } from './editor'

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

export interface ScrollSyncOptions {
  editor: MarkdownEditor
  /** エディタを置いた要素（ここでの操作で、エディタを同期の起点にする） */
  editorPane: HTMLElement
  /** プレビューのスクロールする要素と、HTML を入れた要素 */
  previewScroller: HTMLElement
  preview: HTMLElement
  /** 分割表示のときだけ同期する */
  enabled(): boolean
}

export interface ScrollSync {
  /** プレビューを描き直した後などに、起点の側の位置に合わせ直す */
  refresh(): void
}

/**
 * 分割表示で、エディタとプレビューの表示位置を合わせる。
 * 最後に操作された側（ポインター、ホイール、タッチ、キー、フォーカス）だけを起点にし、こちらから動かした側のスクロールでは
 * 合わせ返さない（合わせ合いが続いて、どちらも止まらなくなるのを防ぐ）
 */
export function enableScrollSync(options: ScrollSyncOptions): ScrollSync {
  const { editor, editorPane, previewScroller, preview, enabled } = options
  let active: 'editor' | 'preview' = 'editor'
  let frame = 0

  const anchors = (): Anchor[] => {
    const origin = previewScroller.getBoundingClientRect().top - previewScroller.scrollTop
    const found = [...preview.querySelectorAll<HTMLElement>('[data-line]')].map((element) => ({
      line: Number(element.dataset.line),
      top: element.getBoundingClientRect().top - origin,
    }))
    return normalizeAnchors(found, editor.lineCount, previewScroller.scrollHeight)
  }

  // 起点の側がスクロールしない長さなら、合わせる位置が決まらないので、もう片方は動かさない（ユーザーが動かした位置を保つ）。
  // スクロールしない要素は「末尾にいる」とも判定されるので、これを確かめないと、描き直しのたびにもう片方が末尾へ飛ぶ
  const scrollable = (element: HTMLElement) => element.scrollHeight - element.clientHeight > 1
  // 片方が末尾まで来たら、もう片方も末尾に合わせる。表示の先頭の行で対応させるだけだと、末尾に届かない
  const atBottom = (element: HTMLElement) => element.scrollTop + element.clientHeight >= element.scrollHeight - 1

  const fromEditor = () => {
    if (!scrollable(editor.scroller)) return
    previewScroller.scrollTop = atBottom(editor.scroller) ? previewScroller.scrollHeight : topForLine(anchors(), editor.topLine())
  }
  const fromPreview = () => {
    if (!scrollable(previewScroller)) return
    if (atBottom(previewScroller)) editor.scroller.scrollTop = editor.scroller.scrollHeight
    else editor.scrollToLine(lineForTop(anchors(), previewScroller.scrollTop))
  }
  const sync = (side: 'editor' | 'preview') => {
    if (!enabled() || side !== active) return
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => (side === 'editor' ? fromEditor() : fromPreview()))
  }

  editor.scroller.addEventListener('scroll', () => sync('editor'), { passive: true })
  previewScroller.addEventListener('scroll', () => sync('preview'), { passive: true })
  for (const [element, side] of [
    [editorPane, 'editor'],
    [previewScroller, 'preview'],
  ] as const) {
    for (const type of ['pointerdown', 'wheel', 'touchstart', 'keydown', 'focusin']) {
      element.addEventListener(type, () => (active = side), { capture: true, passive: true })
    }
  }
  // 画像や図が読み込まれると、プレビューの高さが変わる（load は伝わらないので、捕捉の段階で受ける）
  preview.addEventListener('load', () => sync(active), true)

  return {
    refresh() {
      sync(active)
    },
  }
}
