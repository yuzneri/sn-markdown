import type { Command } from '@codemirror/view'
import {
  Bold,
  Braces,
  Brackets,
  Code,
  createElement,
  Divide,
  Heading,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Radical,
  Sigma,
  SquareCode,
  SquareSigma,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  TextQuote,
  Type,
  WandSparkles,
  type IconNode,
} from 'lucide'
import { cycleHeading, insertBlock, insertCodeBlock, insertLink, insertMath, insertTex, toggleInline, toggleLinePrefix } from './commands'
import { element } from './dom'
import type { CursorContext } from './editor'
import { addColumnRight, addRowBelow, alignColumn, deleteColumn, deleteRow, formatCurrentTable } from './table-commands'

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
  command?: Command
}

// Lucide には行・列を足す・消すアイコンがないので、Lucide と同じ線（24 の枠、太さ 2）で描く。
// 横長の枠が行、縦長の枠が列で、中の + が足す、× が消す
const ROW: IconNode = [['rect', { x: '2', y: '7', width: '20', height: '10', rx: '2' }]]
const COLUMN: IconNode = [['rect', { x: '7', y: '2', width: '10', height: '20', rx: '2' }]]
const PLUS: IconNode = [['path', { d: 'M12 9v6' }], ['path', { d: 'M9 12h6' }]]
const CROSS: IconNode = [['path', { d: 'm9.5 9.5 5 5' }], ['path', { d: 'm14.5 9.5-5 5' }]]
// 積分の記号（∫）。Lucide にないので、同じ線で描く
const INTEGRAL: IconNode = [['path', { d: 'M16 3.5a2.5 2.5 0 0 0-4 1.8v13.4A2.5 2.5 0 0 1 8 20.5' }]]

// 仕切りで区切った組ごとに並べる。最後の組は、カーソルが表の中にあるときだけ TABLE_GROUP と入れ替える
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
    { icon: SquareCode, label: 'Code block', command: insertCodeBlock },
    // 入れた後に最初の列名を選んで、そのまま書き換えられるようにする
    { icon: Table, label: 'Table', command: insertBlock(TABLE, selecting(TABLE, 'Column')) },
    { icon: SquareSigma, label: 'Math', command: insertMath },
    { icon: Minus, label: 'Horizontal rule', command: insertBlock('---') },
    { icon: Image, label: 'Image' },
  ],
]

// 表の中で、最後の組（ブロックを入れるボタン）の代わりに出す。表の中にブロックは入れられないので、入れ替えてもなくなるものはない。
// 数式の組（MATH_GROUP）も同じ
const TABLE_GROUP: Action[] = [
  { icon: [...ROW, ...PLUS], label: 'Add row below', command: addRowBelow },
  { icon: [...ROW, ...CROSS], label: 'Delete row', command: deleteRow },
  { icon: [...COLUMN, ...PLUS], label: 'Add column right', command: addColumnRight },
  { icon: [...COLUMN, ...CROSS], label: 'Delete column', command: deleteColumn },
  { icon: TextAlignStart, label: 'Align left', command: alignColumn('left') },
  { icon: TextAlignCenter, label: 'Align center', command: alignColumn('center') },
  { icon: TextAlignEnd, label: 'Align right', command: alignColumn('right') },
  { icon: WandSparkles, label: 'Format table', command: formatCurrentTable },
]

// 数式の中で、最後の組の代わりに出す。ひな形の ¦ に選択範囲が入り、選択がなければそこにカーソルを置く（commands.ts の insertTex）
const MATH_GROUP: Action[] = [
  { icon: Divide, label: 'Fraction', command: insertTex('\\frac{¦}{‸}') },
  { icon: Radical, label: 'Square root', command: insertTex('\\sqrt{¦}') },
  { icon: Superscript, label: 'Superscript', command: insertTex('^{¦}') },
  { icon: Subscript, label: 'Subscript', command: insertTex('_{¦}') },
  // 数式の中の日本語などの文字
  { icon: Type, label: 'Text', command: insertTex('\\text{¦}') },
  { icon: Sigma, label: 'Sum', command: insertTex('\\sum_{¦}^{‸}') },
  { icon: INTEGRAL, label: 'Integral', command: insertTex('\\int_{¦}^{‸}') },
  { icon: Brackets, label: 'Matrix', command: insertTex('\\begin{pmatrix} ¦ & ‸ \\\\  &  \\end{pmatrix}') },
  { icon: Braces, label: 'Cases', command: insertTex('\\begin{cases} ¦ & ‸ \\\\  &  \\end{cases}') },
]

export interface FormatBarHandlers {
  onCommand(command: Command): void
  onImageFiles(files: File[]): void
}

export interface FormatBar {
  readonly element: HTMLElement
  /** プレビューのモードとロック中は、押しても意味がないので無効にする */
  setEnabled(enabled: boolean): void
  /** カーソルが表の中にあるときは表の行・列の操作に、数式の中にあるときは数式の入力補助に、最後の組を替える */
  setContext(context: CursorContext): void
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

  const createButton = (action: Action) => {
    const button = element('button', 'format-button')
    button.type = 'button'
    const title = action.key ? `${action.label} (${shortcutPrefix()}${action.key})` : action.label
    button.title = title
    button.setAttribute('aria-label', title)
    button.append(createElement(action.icon, { width: 16, height: 16, 'aria-hidden': 'true' }))
    // ボタンにフォーカスを移さず、エディタの選択範囲を保ったまま書式を付ける
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => (action.command ? handlers.onCommand(action.command) : imageInput.click()))
    bar.append(button)
    return button
  }

  const groups = GROUPS.map((group, index) => {
    if (index > 0) bar.append(element('span', 'format-separator'))
    return group.map(createButton)
  })
  const blockButtons = groups[groups.length - 1]
  const tableButtons = TABLE_GROUP.map(createButton)
  const mathButtons = MATH_GROUP.map(createButton)
  for (const button of [...tableButtons, ...mathButtons]) button.hidden = true
  const buttons = [...groups.flat(), ...tableButtons, ...mathButtons]
  bar.append(imageInput)

  return {
    element: bar,
    setEnabled(enabled) {
      for (const button of buttons) button.disabled = !enabled
    },
    setContext(context) {
      for (const button of blockButtons) button.hidden = context !== null
      for (const button of tableButtons) button.hidden = context !== 'table'
      for (const button of mathButtons) button.hidden = context !== 'math'
    },
  }
}

export function shortcutPrefix(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
}
