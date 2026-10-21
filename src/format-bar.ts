import type { StateCommand } from '@codemirror/state'
import {
  Bold,
  Code,
  createElement,
  Heading,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
  type IconNode,
} from 'lucide'
import { cycleHeading, insertBlock, insertLink, toggleInline, toggleLinePrefix, wrapCodeBlock } from './commands'
import { element } from './dom'

const TABLE = '| Column | Column |\n| --- | --- |\n|  |  |'

/** block の中の text を選ぶ範囲 */
function selecting(block: string, text: string): { from: number; to: number } {
  const from = block.indexOf(text)
  return { from, to: from + text.length }
}

interface Action {
  icon: IconNode
  label: string
  /** ショートカットのキー（Mod と組み合わせる） */
  key?: string
  /** コマンドがなければ画像の挿入（ファイルの選択） */
  command?: StateCommand
}

// 仕切りで区切った組ごとに並べる
const GROUPS: Action[][] = [
  [
    { icon: Heading, label: 'Heading', command: cycleHeading },
    { icon: Bold, label: 'Bold', key: 'B', command: toggleInline('**') },
    { icon: Italic, label: 'Italic', key: 'I', command: toggleInline('_') },
    { icon: Strikethrough, label: 'Strikethrough', command: toggleInline('~~') },
    { icon: Code, label: 'Inline code', command: toggleInline('`') },
    { icon: Link, label: 'Link', key: 'K', command: insertLink },
  ],
  [
    { icon: TextQuote, label: 'Quote', command: toggleLinePrefix('quote') },
    { icon: List, label: 'Bulleted list', command: toggleLinePrefix('bullet') },
    { icon: ListOrdered, label: 'Numbered list', command: toggleLinePrefix('ordered') },
    { icon: ListTodo, label: 'Task list', command: toggleLinePrefix('task') },
  ],
  [
    { icon: SquareCode, label: 'Code block', command: wrapCodeBlock() },
    // 入れた後に最初の列名を選んで、そのまま書き換えられるようにする
    { icon: Table, label: 'Table', command: insertBlock(TABLE, selecting(TABLE, 'Column')) },
    { icon: Minus, label: 'Horizontal rule', command: insertBlock('---') },
    { icon: Image, label: 'Image' },
  ],
]

export interface FormatBarHandlers {
  onCommand(command: StateCommand): void
  onImageFiles(files: File[]): void
}

export interface FormatBar {
  readonly element: HTMLElement
  /** プレビューのモードとロック中は、押しても意味がないので無効にする */
  setEnabled(enabled: boolean): void
}

export function createFormatBar(handlers: FormatBarHandlers): FormatBar {
  const bar = element('div', 'format-bar')
  bar.setAttribute('role', 'toolbar')
  bar.setAttribute('aria-label', 'Formatting')

  const imageInput = element('input', 'image-input')
  imageInput.type = 'file'
  // 埋め込めるのはこの 4 つ（image.ts）。iOS は、HEIC の写真をこの指定に合わせて JPEG にして渡す
  imageInput.accept = 'image/png,image/jpeg,image/gif,image/webp'
  imageInput.multiple = true
  imageInput.hidden = true
  imageInput.addEventListener('change', () => {
    handlers.onImageFiles([...(imageInput.files ?? [])])
    // 同じファイルをもう一度選んでも change が起きるよう空にする
    imageInput.value = ''
  })

  const buttons: HTMLButtonElement[] = []
  GROUPS.forEach((group, index) => {
    if (index > 0) bar.append(element('span', 'format-separator'))
    for (const action of group) {
      const button = element('button', 'format-button')
      button.type = 'button'
      const title = action.key ? `${action.label} (${shortcutPrefix()}${action.key})` : action.label
      button.title = title
      button.setAttribute('aria-label', title)
      button.append(createElement(action.icon, { width: 16, height: 16, 'aria-hidden': 'true' }))
      // ボタンにフォーカスを移さず、エディタの選択範囲を保ったまま書式を付ける
      button.addEventListener('mousedown', (event) => event.preventDefault())
      button.addEventListener('click', () => (action.command ? handlers.onCommand(action.command) : imageInput.click()))
      buttons.push(button)
      bar.append(button)
    }
  })
  bar.append(imageInput)

  return {
    element: bar,
    setEnabled(enabled) {
      for (const button of buttons) button.disabled = !enabled
    },
  }
}

function shortcutPrefix(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
}
