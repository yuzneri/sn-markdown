import { Prec, type EditorState, type StateCommand, type TransactionSpec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { formatTable, locate, tableAt, type CellPosition, type Table, type TableLine } from './table'

/** 移動先のセル。offset が end なら、セルの中身の末尾に置く（中身を選ぶと、打ったときに中身が消えるため） */
interface Target {
  line: number
  column: number
  offset: number | 'end'
}

/** カーソルのある表と、カーソルのセル。表の外、ロック中、複数のカーソルのときは null */
function current(state: EditorState): { table: Table; at: CellPosition; lines: TableLine[] } | null {
  if (state.readOnly || state.selection.ranges.length > 1) return null
  const head = state.selection.main.head
  const table = tableAt(state, head)
  if (!table) return null
  const lines = table.lines.map(({ prefix, cells }) => ({ prefix, cells: [...cells] }))
  return { table, at: locate(table, head), lines }
}

/**
 * 表を lines で置き換えて整形し、カーソルを target のセルに置く。整形しても変わらなければ、カーソルだけを動かす。
 * target が after なら、表の後ろに空行を 1 つ空けた次の行に置く（表のすぐ下の行は、空行で区切らないと表の行として読まれる）
 */
function replaceTable(state: EditorState, table: Table, lines: TableLine[], target: Target | 'after'): TransactionSpec {
  const { text, cells } = formatTable(lines)
  let insert = text
  let anchor: number
  if (target === 'after') {
    const last = state.doc.lineAt(table.to)
    const next = last.number < state.doc.lines ? state.doc.line(last.number + 1) : null
    // 表の最後の行（消した行）を空行にする。その次がもともと空行なら、そこに置く。そうでなければ、空行をもう 1 つ作る
    insert += next && !next.text.trim() ? '\n' : '\n\n'
    anchor = table.from + insert.length + (next && !next.text.trim() ? 1 : 0)
  } else {
    const cell = cells[target.line][target.column]
    anchor = table.from + (target.offset === 'end' ? cell.to : Math.min(cell.from + target.offset, cell.to))
  }
  const changed = insert !== state.sliceDoc(table.from, table.to)
  return {
    changes: changed ? { from: table.from, to: table.to, insert } : undefined,
    selection: { anchor },
    scrollIntoView: true,
    userEvent: 'input',
  }
}

const columnCount = (lines: TableLine[]) => Math.max(1, ...lines.map((line) => line.cells.length))

/** 本文の行を足す。行頭は区切り行のもの（リストの中の表でも、2 行目からの字下げになる） */
function addRow(lines: TableLine[], index: number): void {
  lines.splice(index, 0, { prefix: lines[1].prefix, cells: [] })
}

/** Tab: 次のセルへ。最後のセルなら行を足して、その最初のセルへ。区切り行は飛ばす */
export const nextCell: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found) return false
  const { table, at, lines } = found
  let target: Target
  if (at.line !== 1 && at.column + 1 < columnCount(lines)) {
    target = { line: at.line, column: at.column + 1, offset: 'end' }
  } else {
    const line = at.line === 0 ? 2 : at.line + 1
    if (line >= lines.length) addRow(lines, line)
    target = { line, column: 0, offset: 'end' }
  }
  dispatch(state.update(replaceTable(state, table, lines, target)))
  return true
}

/** Shift-Tab: 前のセルへ。先頭のセルでは動かない（表の外の字下げに譲らない） */
export const previousCell: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found) return false
  const { table, at, lines } = found
  let target: Target
  if (at.line !== 1 && at.column > 0) target = { line: at.line, column: at.column - 1, offset: 'end' }
  else if (at.line === 0) target = { line: 0, column: 0, offset: 'end' }
  else target = { line: at.line === 2 || at.line === 1 ? 0 : at.line - 1, column: columnCount(lines) - 1, offset: 'end' }
  dispatch(state.update(replaceTable(state, table, lines, target)))
  return true
}

/**
 * Enter: 下の行の同じ列へ。最後の行なら行を足す。
 * 最後の行が空なら、その行を消して表の外（空行を 1 つ空けた次の行）に出る（表の入力を終える）
 */
export const nextRow: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found) return false
  const { table, at, lines } = found
  const last = lines.length - 1
  if (at.line === last && at.line >= 2 && lines[last].cells.every((cell) => !cell)) {
    lines.pop()
    dispatch(state.update(replaceTable(state, table, lines, 'after')))
    return true
  }
  const line = at.line <= 1 ? 2 : at.line + 1
  if (line >= lines.length) addRow(lines, line)
  dispatch(state.update(replaceTable(state, table, lines, { line, column: at.column, offset: 'end' })))
  return true
}

/**
 * 表の中だけで効くキー。表の外では false を返し、いまの動き（Tab の字下げ、Enter のリストの続きなど）に譲る。
 * lang-markdown のキーマップ（Prec.high）より先に効かせるため、エディタの拡張では markdown() より前に置く
 */
export const tableKeymap = Prec.high(
  keymap.of([
    { key: 'Tab', run: nextCell, shift: previousCell },
    { key: 'Enter', run: nextRow },
  ]),
)
