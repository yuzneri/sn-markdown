import type { StateCommand } from '@codemirror/state'
import { element } from './dom'
import { createFormatBar } from './format-bar'
import { MODES, type Mode } from './preferences'

const LABELS: Record<Mode, string> = { edit: 'Edit', split: 'Split', preview: 'Preview' }
// エラーなどのメッセージを出しておく時間
const MESSAGE_DURATION = 6000

export interface Layout {
  readonly mode: Mode
  /** CodeMirror を置く要素 */
  readonly editorPane: HTMLElement
  /** プレビューの HTML を入れる要素 */
  readonly preview: HTMLElement
  /** プレビューのスクロールする要素 */
  readonly previewScroller: HTMLElement
  setMode(mode: Mode): void
  /** ロック中は書式のボタンを無効にする */
  setLocked(locked: boolean): void
  /** サニタイズ済みの HTML を表示する */
  showPreview(html: string): void
  /** バーの下に短いメッセージ（エラーなど）をしばらく出す */
  showMessage(message: string): void
}

export interface LayoutHandlers {
  onModeChange(mode: Mode): void
  /** 書式のボタンが押された */
  onCommand(command: StateCommand): void
  /** Image ボタンで画像が選ばれた */
  onImageFiles(files: File[]): void
}

export function createLayout(root: HTMLElement, initial: Mode, handlers: LayoutHandlers): Layout {
  // 書式のボタンとモードの切り替えを 1 行に並べる。幅が足りなければ、書式のボタンの部分だけを横にスクロールする
  const toolbar = element('div', 'toolbar')
  const formatBar = createFormatBar(handlers)

  // 行の中に置く場所はないので、バーの下に重ねて出す
  const message = element('span', 'toolbar-message')
  message.setAttribute('role', 'status')
  let messageTimer: ReturnType<typeof setTimeout> | undefined

  const modes = element('div', 'modes')
  modes.setAttribute('role', 'group')
  modes.setAttribute('aria-label', 'Display mode')
  const buttons = MODES.map((mode) => {
    const button = element('button', 'mode-button')
    button.type = 'button'
    button.textContent = LABELS[mode]
    button.addEventListener('click', () => {
      if (mode === current) return
      layout.setMode(mode)
      handlers.onModeChange(mode)
    })
    return button
  })
  modes.append(...buttons)
  toolbar.append(formatBar.element, modes, message)

  const panes = element('div', 'panes')
  const editorPane = element('div', 'pane editor-pane')
  const previewPane = element('div', 'pane preview-pane')
  const preview = element('div', 'preview')
  previewPane.append(preview)
  panes.append(editorPane, previewPane)
  root.append(toolbar, panes)

  let current = initial
  let locked = false
  // プレビューのモードではエディタが見えず、ロック中は書き換えられないので、書式のボタンは押せないようにする
  const updateFormatBar = () => formatBar.setEnabled(current !== 'preview' && !locked)

  const layout: Layout = {
    get mode() {
      return current
    },
    editorPane,
    preview,
    previewScroller: previewPane,
    setMode(mode) {
      current = mode
      panes.dataset.mode = mode
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(MODES[i] === mode)))
      updateFormatBar()
    },
    setLocked(value) {
      locked = value
      updateFormatBar()
    },
    showPreview(html) {
      preview.innerHTML = html
    },
    showMessage(text) {
      clearTimeout(messageTimer)
      message.textContent = text
      messageTimer = setTimeout(() => (message.textContent = ''), MESSAGE_DURATION)
    },
  }
  layout.setMode(initial)
  return layout
}
