import { MODES, type Mode } from './mode'

const LABELS: Record<Mode, string> = { edit: 'Edit', split: 'Split', preview: 'Preview' }

export interface Layout {
  readonly mode: Mode
  /** CodeMirror を置く要素 */
  readonly editorPane: HTMLElement
  setMode(mode: Mode): void
  /** サニタイズ済みの HTML を表示する */
  showPreview(html: string): void
}

export function createLayout(root: HTMLElement, initial: Mode, onModeChange: (mode: Mode) => void): Layout {
  const toolbar = element('div', 'toolbar')
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
      onModeChange(mode)
    })
    return button
  })
  modes.append(...buttons)
  toolbar.append(modes)

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
    setMode(mode) {
      current = mode
      panes.dataset.mode = mode
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(MODES[i] === mode)))
    },
    showPreview(html) {
      preview.innerHTML = html
    },
  }
  layout.setMode(initial)
  return layout
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  return node
}
