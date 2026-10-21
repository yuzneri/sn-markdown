import type { StateCommand } from '@codemirror/state'
import { createElement, Type } from 'lucide'
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
  setMode(mode: Mode): void
  /** ロック中は書式のボタンを無効にする */
  setLocked(locked: boolean): void
  /** サニタイズ済みの HTML を表示する */
  showPreview(html: string): void
  /** バーに短いメッセージ（エラーなど）をしばらく出す */
  showMessage(message: string): void
}

export interface LayoutHandlers {
  onModeChange(mode: Mode): void
  onFormatBarToggle(visible: boolean): void
  /** 書式のボタンが押された */
  onCommand(command: StateCommand): void
  /** Image ボタンで画像が選ばれた */
  onImageFiles(files: File[]): void
}

export function createLayout(root: HTMLElement, initial: { mode: Mode; formatBar: boolean }, handlers: LayoutHandlers): Layout {
  const toolbar = element('div', 'toolbar')

  const formatToggle = element('button', 'tool-button format-toggle')
  formatToggle.type = 'button'
  formatToggle.title = 'Formatting toolbar'
  formatToggle.setAttribute('aria-label', 'Formatting toolbar')
  formatToggle.append(createElement(Type, { width: 16, height: 16, 'aria-hidden': 'true' }))
  formatToggle.addEventListener('click', () => {
    setFormatBarVisible(!formatBarVisible)
    handlers.onFormatBarToggle(formatBarVisible)
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
  toolbar.append(formatToggle, message, modes)

  const formatBar = createFormatBar(handlers)
  const panes = element('div', 'panes')
  const editorPane = element('div', 'pane editor-pane')
  const previewPane = element('div', 'pane preview-pane')
  const preview = element('div', 'preview')
  previewPane.append(preview)
  panes.append(editorPane, previewPane)
  root.append(toolbar, formatBar.element, panes)

  let formatBarVisible = initial.formatBar
  const setFormatBarVisible = (visible: boolean) => {
    formatBarVisible = visible
    formatBar.element.hidden = !visible
    formatToggle.setAttribute('aria-pressed', String(visible))
  }
  let current = initial.mode
  let locked = false
  // プレビューのモードではエディタが見えず、ロック中は書き換えられないので、書式のボタンは押せないようにする
  const updateFormatBar = () => formatBar.setEnabled(current !== 'preview' && !locked)

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
  setFormatBarVisible(initial.formatBar)
  layout.setMode(initial.mode)
  return layout
}
