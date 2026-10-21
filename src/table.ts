import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { labelDataUrls } from './data-url'

export type Align = 'none' | 'left' | 'center' | 'right'

/** 表の 1 行の中身。整形や行・列の操作は、これを書き換えてから formatTable で文字列に戻す */
export interface TableLine {
  /** 行頭の字下げ、引用やリストの記号。整形しても、行ごとにそのまま残す */
  prefix: string
  /** セルの中身（前後の空白を除く）。区切り行では :-- などの記号 */
  cells: string[]
}

/** 本文の中のセル。from / to は | と | の間、content は中身（前後の空白を除いたもの）の始まり */
interface CellSpan {
  from: number
  to: number
  content: number
}

/** 本文の中の表。lines の 0 番目はヘッダー、1 番目は区切り行、その後ろが本文の行 */
export interface Table {
  /** 最初の行の行頭から、最後の行の行末まで */
  from: number
  to: number
  lines: (TableLine & { from: number; to: number; spans: CellSpan[] })[]
}

/** 表の中の位置。offset はセルの中身の始まりからの文字数 */
export interface CellPosition {
  line: number
  column: number
  offset: number
}

/** pos の行を含む表。区切り行がまだない（ヘッダーだけの）ものは、パーサーが表にしないので null */
export function tableAt(state: EditorState, pos: number): Table | null {
  const line = state.doc.lineAt(pos)
  // 構文木が時間内に間に合わなければ、表の外として扱う（キーは既定の動きになる）
  const tree = ensureSyntaxTree(state, line.to, 50)
  if (!tree) return null
  let rows: { from: number; to: number }[] | null = null
  tree.iterate({
    from: line.from,
    to: line.to,
    enter: (node) => {
      if (rows) return false
      if (node.name !== 'Table') return
      rows = []
      // 直下の子が 1 行ずつ（TableHeader、区切り行の TableDelimiter、TableRow）。引用の記号（QuoteMark）などは飛ばす
      for (let child = node.node.firstChild; child; child = child.nextSibling) {
        if (child.name === 'TableHeader' || child.name === 'TableDelimiter' || child.name === 'TableRow') rows.push(child)
      }
      return false
    },
  })
  // コールバックの中での代入は型の絞り込みに反映されないので、型を付け直す
  const found = rows as { from: number; to: number }[] | null
  if (!found || found.length < 2) return null
  const lines = found.map((row) => {
    const { from, to } = state.doc.lineAt(row.from)
    const spans = splitRow(state.sliceDoc(row.from, to)).map((cell) => ({
      from: row.from + cell.from,
      to: row.from + cell.to,
      content: row.from + cell.content,
      text: cell.text,
    }))
    return { from, to, prefix: state.sliceDoc(from, row.from), cells: spans.map((cell) => cell.text), spans }
  })
  return { from: lines[0].from, to: lines[lines.length - 1].to, lines }
}

/**
 * pos の行が表の中か（書式バーのボタンを差し替えるのに使う）。カーソルが動くたびに呼ぶので、構文木の解析は待たず、
 * 行の区切りも読まない。解析が進めばエディタが更新されるので、そのときにまた調べられる
 */
export function isInTable(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos)
  let found = false
  syntaxTree(state).iterate({
    from: line.from,
    to: line.to,
    enter: (node) => {
      if (node.name === 'Table') found = true
      return !found
    },
  })
  return found
}

/** pos が表のどのセルにあるか。| の上や行頭の記号の上は、近いほうのセルにする */
export function locate(table: Table, pos: number): CellPosition {
  const index = table.lines.findIndex((row) => pos <= row.to)
  const line = index < 0 ? table.lines.length - 1 : index
  const { spans, cells } = table.lines[line]
  if (spans.length === 0) return { line, column: 0, offset: 0 }
  const found = spans.findIndex((span) => pos <= span.to)
  const column = found < 0 ? spans.length - 1 : found
  const offset = Math.min(Math.max(0, pos - spans[column].content), cells[column].length)
  return { line, column, offset }
}

/**
 * 1 行を | で区切る（位置は text の中での位置）。外側の | はあってもなくてもよい。
 * \ は次の 1 文字と組にして読むので、\| はセルの中の文字、\\| の | は区切りになる（cmark-gfm と同じ）
 */
export function splitRow(text: string): { text: string; from: number; to: number; content: number }[] {
  const pipes: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === '|') pipes.push(i)
  }
  const bounds = [-1, ...pipes, text.length]
  const cells: { text: string; from: number; to: number; content: number }[] = []
  for (let k = 0; k + 1 < bounds.length; k++) {
    const from = bounds[k] + 1
    const to = bounds[k + 1]
    const raw = text.slice(from, to)
    // 先頭の | より前と、末尾の | より後ろ（空白だけ）は、セルではない
    const outer = pipes.length > 0 && (k === 0 || k === bounds.length - 2) && !raw.trim()
    if (outer) continue
    cells.push({ text: raw.trim(), from, to, content: from + raw.length - raw.trimStart().length })
  }
  return cells
}

/** 区切り行のセル（:-- など）の配置 */
export function alignOf(cell: string): Align {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':') && cell.length > 1
  return left && right ? 'center' : left ? 'left' : right ? 'right' : 'none'
}

export function delimiterCell(align: Align, width: number): string {
  if (align === 'center') return `:${'-'.repeat(width - 2)}:`
  if (align === 'left') return `:${'-'.repeat(width - 1)}`
  if (align === 'right') return `${'-'.repeat(width - 1)}:`
  return '-'.repeat(width)
}

const segmenter = new Intl.Segmenter()
// 2 文字幅で表示する文字（East Asian Wide / Fullwidth の主な範囲）。フォントによっては、ちょうど 2 文字幅にならない（近似）
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3FFFD}]|\p{Emoji_Presentation}|️/u

/** モノスペースのフォントでの表示幅。書記素（結合文字や絵文字の並びは 1 つ）ごとに数える */
export function displayWidth(text: string): number {
  let width = 0
  for (const { segment } of segmenter.segment(text)) width += WIDE.test(segment) ? 2 : 1
  return width
}

/** 整形した表の文字列と、各セルの中身の位置（text の中での位置）。cells[行][列] */
export interface FormattedTable {
  text: string
  cells: { from: number; to: number }[][]
}

/**
 * 表を整形する。列の数は全行の最大にそろえ（足りない行には空のセルを足す）、列の幅は表示幅の最大（3 以上）にする。
 * セルは列の配置に合わせて空白で詰め、外側の | は常に付ける
 */
export function formatTable(lines: TableLine[]): FormattedTable {
  const columns = Math.max(1, ...lines.map((line) => line.cells.length))
  const aligns = Array.from({ length: columns }, (_, column) => alignOf(lines[1]?.cells[column] ?? ''))
  // 埋め込んだ画像の data: URL は、エディタでは短い表示に折りたたまれる（data-url.ts）。URL の長さで数えると、
  // ほかの行が数十万文字の空白で埋まってしまうので、短い表示の長さで数える
  const width = (text: string) => displayWidth(labelDataUrls(text))
  const widths = aligns.map((_, column) =>
    Math.max(3, ...lines.filter((_, index) => index !== 1).map((line) => width(line.cells[column] ?? ''))),
  )
  let text = ''
  const cells: { from: number; to: number }[][] = []
  lines.forEach((line, index) => {
    if (index > 0) text += '\n'
    text += `${line.prefix}|`
    const row: { from: number; to: number }[] = []
    widths.forEach((columnWidth, column) => {
      const content = index === 1 ? delimiterCell(aligns[column], columnWidth) : (line.cells[column] ?? '')
      const space = columnWidth - width(content)
      const before = aligns[column] === 'right' ? space : aligns[column] === 'center' ? Math.floor(space / 2) : 0
      text += ' ' + ' '.repeat(before)
      row.push({ from: text.length, to: text.length + content.length })
      text += content + ' '.repeat(space - before) + ' |'
    })
    cells.push(row)
  })
  return { text, cells }
}
