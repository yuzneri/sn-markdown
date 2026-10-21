import type { Command } from '@codemirror/view'
import { createElement, Search, type IconNode } from 'lucide'
import { element } from './dom'
import { createFormatBar, shortcutPrefix } from './format-bar'
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
  /** カーソルが表の中にあるときは、書式のボタンの右の組を、表の行・列の操作に替える */
  setInTable(inTable: boolean): void
  /** サニタイズ済みの HTML を表示する */
  showPreview(html: string): void
  /** バーの下に短いメッセージ（エラーなど）をしばらく出す */
  showMessage(message: string): void
}

export interface LayoutHandlers {
  onModeChange(mode: Mode): void
  /** 書式のボタンが押された */
  onCommand(command: Command): void
  /** Image ボタンで画像が選ばれた */
  onImageFiles(files: File[]): void
  /** 検索のボタンが押された */
  onSearch(): void
}

export function createLayout(root: HTMLElement, initial: Mode, handlers: LayoutHandlers): Layout {
  // 書式のボタンとモードの切り替えを 1 行に並べる。幅が足りなければ、書式のボタンの部分だけを横にスクロールする
  const toolbar = element('div', 'toolbar')
  const formatBar = createFormatBar(handlers)

  // 行の中に置く場所はないので、バーの下に重ねて出す
  const message = element('span', 'toolbar-message')
  message.setAttribute('role', 'status')
  let messageTimer: ReturnType<typeof setTimeout> | undefined

  // 検索などのボタン。書式ではないので書式のボタンとは分け、モードの切り替えの左に置く（横にスクロールしても隠れない）
  const tools = element('div', 'tools')
  const searchButton = toolButton(Search, `Find and replace (${shortcutPrefix()}F)`, handlers.onSearch)
  tools.append(searchButton)

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
  toolbar.append(formatBar.element, tools, modes, message)

  const panes = element('div', 'panes')
  const editorPane = element('div', 'pane editor-pane')
  const previewPane = element('div', 'pane preview-pane')
  const preview = element('div', 'preview')
  previewPane.append(preview)
  panes.append(editorPane, previewPane)
  root.append(toolbar, panes)

  let current = initial
  let locked = false
  // プレビューのモードではエディタが見えず、ロック中は書き換えられないので、書式のボタンは押せないようにする。
  // 検索はロック中でもできる（置換の欄は、CodeMirror が読み取り専用のときに出さない）
  const updateFormatBar = () => {
    formatBar.setEnabled(current !== 'preview' && !locked)
    searchButton.disabled = current === 'preview'
  }

  // ロック中は、プレビューのタスクのチェックボックスも押せないようにする（押しても本文を書き換えないので、見た目で示す）
  const updateTaskBoxes = () => {
    for (const box of preview.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox')) box.disabled = locked
  }

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
      updateTaskBoxes()
    },
    setInTable(inTable) {
      formatBar.setInTable(inTable)
    },
    showPreview(html) {
      preview.innerHTML = html
      updateTaskBoxes()
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

function toolButton(icon: IconNode, label: string, onClick: () => void): HTMLButtonElement {
  const button = element('button', 'format-button')
  button.type = 'button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.append(createElement(icon, { width: 16, height: 16, 'aria-hidden': 'true' }))
  // エディタのフォーカスと選択範囲を保つ（検索の欄の初期値は、選択している語になる）
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', onClick)
  return button
}
