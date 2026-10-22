import type { Command } from '@codemirror/view'
import { createElement, Search, TableOfContents, type IconNode } from 'lucide'
import type { CursorContext } from './editor'
import { element } from './dom'
import { createFormatBar, shortcutPrefix } from './format-bar'
import { createOutlineMenu } from './outline'
import { MODES, type Mode } from './preferences'
import type { Heading } from './render'

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
  /** モードのボタンを押したのと同じく、モードを切り替えて onModeChange を呼ぶ（保存する） */
  selectMode(mode: Mode): void
  /** ロック中は書式のボタンを無効にする */
  setLocked(locked: boolean): void
  /** カーソルが表の中なら表の行・列の操作に、数式の中なら数式の入力補助に、書式のボタンの右の組を替える */
  setContext(context: CursorContext): void
  /** サニタイズ済みの HTML を表示する */
  showPreview(html: string): void
  /** バーの下に短いメッセージ（エラーなど）をしばらく出す */
  showMessage(message: string): void
  /** プレビューを、元の行が line の要素（data-line）が一番上に来るようにスクロールする */
  scrollPreviewToLine(line: number): void
}

export interface LayoutHandlers {
  onModeChange(mode: Mode): void
  /** 書式のボタンが押された */
  onCommand(command: Command): void
  /** Image ボタンで画像が選ばれた */
  onImageFiles(files: File[]): void
  /** 検索のボタンが押された */
  onSearch(): void
  /** 見出しの一覧を開くときに、いまの本文の見出しを返す */
  headings(): Heading[]
  /** 見出しの一覧で見出しが選ばれた（line は元の行） */
  onHeading(line: number): void
}

export function createLayout(root: HTMLElement, initial: Mode, handlers: LayoutHandlers): Layout {
  // 書式のボタンとモードの切り替えを 1 行に並べる（横幅が狭いときは 2 行に分ける。style.css）。幅が足りなければ、書式のボタンの部分だけを横にスクロールする
  const toolbar = element('div', 'toolbar')
  const formatBar = createFormatBar(handlers)

  // 行の中に置く場所はないので、バーの下に重ねて出す
  const message = element('span', 'toolbar-message')
  message.setAttribute('role', 'status')
  let messageTimer: ReturnType<typeof setTimeout> | undefined

  // 検索などのボタン。書式ではないので書式のボタンとは分け、モードの切り替えの左に置く（横にスクロールしても隠れない）
  const tools = element('div', 'tools')
  const searchButton = toolButton(Search, `Find and replace (${shortcutPrefix()}F)`, handlers.onSearch)
  const outlineButton = toolButton(TableOfContents, 'Headings', () => outline.toggle())
  const outline = createOutlineMenu(outlineButton, handlers.headings, handlers.onHeading)
  tools.append(searchButton, outlineButton)

  const modes = element('div', 'modes')
  modes.setAttribute('role', 'group')
  modes.setAttribute('aria-label', 'Display mode')
  const buttons = MODES.map((mode) => {
    const button = element('button', 'mode-button')
    button.type = 'button'
    button.textContent = LABELS[mode]
    button.addEventListener('click', () => layout.selectMode(mode))
    return button
  })
  modes.append(...buttons)
  toolbar.append(formatBar.element, tools, modes, message, outline.element, ...formatBar.overlays)

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
    selectMode(mode) {
      if (mode === current) return
      layout.setMode(mode)
      handlers.onModeChange(mode)
    },
    setLocked(value) {
      locked = value
      updateFormatBar()
      updateTaskBoxes()
    },
    setContext(context) {
      formatBar.setContext(context)
    },
    showPreview(html) {
      preview.innerHTML = html
      updateTaskBoxes()
    },
    scrollPreviewToLine(line) {
      const target = preview.querySelector(`[data-line="${line}"]`)
      if (target) previewPane.scrollTop += target.getBoundingClientRect().top - previewPane.getBoundingClientRect().top
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
