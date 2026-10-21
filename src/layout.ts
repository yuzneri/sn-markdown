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
  setMode(mode: Mode): void
  /** サニタイズ済みの HTML を表示する */
  showPreview(html: string): void
  /** バーに短いメッセージ（エラーなど）をしばらく出す */
  showMessage(message: string): void
}

export interface LayoutHandlers {
  onModeChange(mode: Mode): void
  /** Image ボタンで画像が選ばれた */
  onImageFiles(files: File[]): void
}

export function createLayout(root: HTMLElement, initial: Mode, handlers: LayoutHandlers): Layout {
  const toolbar = element('div', 'toolbar')

  const imageButton = element('button', 'tool-button')
  imageButton.type = 'button'
  imageButton.textContent = 'Image'
  imageButton.title = 'Insert image'
  const imageInput = element('input', 'image-input')
  imageInput.type = 'file'
  // 埋め込めるのはこの 4 つ（image.ts）。iOS は、HEIC の写真をこの指定に合わせて JPEG にして渡す
  imageInput.accept = 'image/png,image/jpeg,image/gif,image/webp'
  imageInput.multiple = true
  imageInput.hidden = true
  imageButton.addEventListener('click', () => imageInput.click())
  imageInput.addEventListener('change', () => {
    handlers.onImageFiles([...(imageInput.files ?? [])])
    // 同じファイルをもう一度選んでも change が起きるよう空にする
    imageInput.value = ''
  })
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
  toolbar.append(imageButton, imageInput, message, modes)

  const panes = element('div', 'panes')
  const editorPane = element('div', 'pane editor-pane')
  const previewPane = element('div', 'pane preview-pane')
  const preview = element('div', 'preview')
  previewPane.append(preview)
  panes.append(editorPane, previewPane)
  root.append(toolbar, panes)

  let current = initial
  const layout: Layout = {
    get mode() {
      return current
    },
    editorPane,
    preview,
    setMode(mode) {
      current = mode
      panes.dataset.mode = mode
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(MODES[i] === mode)))
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

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  return node
}
