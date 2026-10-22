import { element } from './dom'
import { centered, fitView, panBy, zoomAt, type Point, type Size, type View } from './zoom'

// ボタンとキーで 1 回に変える倍率
const STEP = 1.25
// ホイールの 1 目盛り（deltaY ≒ 100）で約 1.2 倍
const WHEEL_SENSITIVITY = 0.002
// deltaMode が行単位（Firefox のマウスホイール）のときの 1 行の高さ
const LINE_HEIGHT = 16

/**
 * プレビュー中の描き終えた図と画像をクリック（図はフォーカスして Enter / Space でも）すると、編集領域いっぱいに拡大して表示する。
 * プレビューは描き直すたびに中身が作り直されるので、プレビューの要素に 1 回だけ登録する
 */
export function enableViewer(preview: HTMLElement): void {
  preview.addEventListener('click', (event) => {
    const target = viewableAt(event.target)
    if (target) openViewer(target)
  })
  preview.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = viewableAt(event.target)
    if (!target) return
    event.preventDefault()
    openViewer(target)
  })
}

/** 開いている拡大表示を閉じる。拡大表示の図は開いたときの複製なので、テーマの明暗が変わると背景と色が合わなくなる */
export function closeViewer(): void {
  document.querySelector<HTMLDialogElement>('dialog.viewer')?.close()
}

type Viewable = SVGSVGElement | HTMLImageElement

function viewableAt(target: EventTarget | null): Viewable | null {
  if (!(target instanceof Element)) return null
  // リンクの中の画像は、押すとリンクを開く。読み込めていない画像（大きさが 0）は、拡大しても何も見えない
  if (target instanceof HTMLImageElement) return target.closest('a') || target.naturalWidth === 0 ? null : target
  return target.closest('.mermaid-block.is-rendered')?.querySelector('svg') ?? null
}

function openViewer(source: Viewable): void {
  const isImage = source instanceof HTMLImageElement
  const size = isImage ? { width: source.naturalWidth, height: source.naturalHeight } : naturalSize(source)
  // SN の iframe には allow="fullscreen" がなく、ブラウザの全画面表示は使えない。モーダルの dialog で iframe いっぱいに重ねる。
  // 開いている間は後ろ（エディタ）に入力が届かず、Esc で閉じ、閉じるとフォーカスが元の図に戻る
  const dialog = element('dialog', 'viewer')
  dialog.setAttribute('aria-label', isImage ? 'Image' : 'Diagram')
  const toolbar = element('div', 'viewer-toolbar')
  const zoomOut = button('−', 'Zoom out')
  const actual = button('100%', 'Actual size')
  const zoomIn = button('+', 'Zoom in')
  const fit = button('Fit', 'Fit to window')
  const close = button('×', 'Close')
  close.classList.add('viewer-close')
  toolbar.append(zoomOut, actual, zoomIn, fit, close)

  const canvas = element('div', 'viewer-canvas')
  const content = element('div', 'viewer-content')
  const copy = source.cloneNode(true) as Viewable
  // プレビューではペインの幅に縮めている（mermaid の max-width と preview.css）。ここでは本来の大きさで置き、倍率は transform で付ける。
  // 画像は、ノートの HTML の style で大きさを指定していることがあるので、style でも本来の大きさにする
  copy.setAttribute('width', String(size.width))
  copy.setAttribute('height', String(size.height))
  copy.style.maxWidth = 'none'
  if (isImage) {
    copy.style.width = `${size.width}px`
    copy.style.height = `${size.height}px`
  }
  content.append(copy)
  canvas.append(content)
  dialog.append(toolbar, canvas)
  document.body.append(dialog)
  dialog.addEventListener('close', () => dialog.remove())

  const area = (): Size => ({ width: canvas.clientWidth, height: canvas.clientHeight })
  const center = (): Point => ({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 })
  let view: View
  const show = (next: View) => {
    view = next
    content.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
    actual.textContent = `${Math.round(view.scale * 100)}%`
  }

  dialog.showModal()
  // 画像は、引き伸ばすとぼやけるので、最初は 100% より大きくしない（図はベクターなので、画面いっぱいに合わせる）
  const fitted = fitView(size, area())
  show(isImage && fitted.scale > 1 ? centered(size, area(), 1) : fitted)

  zoomIn.addEventListener('click', () => show(zoomAt(view, STEP, center())))
  zoomOut.addEventListener('click', () => show(zoomAt(view, 1 / STEP, center())))
  actual.addEventListener('click', () => show(centered(size, area(), 1)))
  fit.addEventListener('click', () => show(fitView(size, area())))
  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') show(zoomAt(view, STEP, center()))
    else if (event.key === '-') show(zoomAt(view, 1 / STEP, center()))
    else if (event.key === '0') show(centered(size, area(), 1))
  })

  const position = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  canvas.addEventListener(
    'wheel',
    (event) => {
      // ページのスクロールではなく拡大縮小に使う。トラックパッドのピンチも ctrlKey 付きの wheel として届く
      event.preventDefault()
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT : event.deltaY
      show(zoomAt(view, Math.exp(-delta * WHEEL_SENSITIVITY), position(event)))
    },
    { passive: false },
  )

  // 1 本の指（マウス）なら移動、2 本ならピンチで拡大縮小する
  const pointers = new Map<number, Point>()
  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, position(event))
    canvas.classList.add('is-dragging')
  })
  canvas.addEventListener('pointermove', (event) => {
    const before = pointers.get(event.pointerId)
    if (!before) return
    const after = position(event)
    pointers.set(event.pointerId, after)
    const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1]
    if (!other) {
      show(panBy(view, after.x - before.x, after.y - before.y))
      return
    }
    const distanceBefore = Math.hypot(before.x - other.x, before.y - other.y)
    if (distanceBefore === 0) return
    const midBefore = { x: (before.x + other.x) / 2, y: (before.y + other.y) / 2 }
    const midAfter = { x: (after.x + other.x) / 2, y: (after.y + other.y) / 2 }
    const zoomed = zoomAt(view, Math.hypot(after.x - other.x, after.y - other.y) / distanceBefore, midBefore)
    show(panBy(zoomed, midAfter.x - midBefore.x, midAfter.y - midBefore.y))
  })
  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size === 0) canvas.classList.remove('is-dragging')
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
}

/** mermaid の SVG の本来の大きさ。viewBox がなければ、プレビューに表示されている大きさを使う */
function naturalSize(svg: SVGSVGElement): Size {
  const box = svg.viewBox.baseVal
  if (box && box.width > 0 && box.height > 0) return { width: box.width, height: box.height }
  const rect = svg.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

function button(label: string, title: string): HTMLButtonElement {
  const node = element('button', 'viewer-button')
  node.type = 'button'
  node.textContent = label
  node.title = title
  node.setAttribute('aria-label', title)
  return node
}
