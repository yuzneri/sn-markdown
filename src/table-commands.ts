import { Prec, type EditorState, type StateCommand, type TransactionSpec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentLess, indentMore } from '@codemirror/commands'
import { delimiterCell, formatTable, locate, tableAt, type Align, type CellPosition, type Table, type TableLine } from './table'

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

// ここから下は、表の中にいるときに書式バーに出すボタン（行・列の操作）。どれも操作の後に整形する。
// カーソルが区切り行にあるときは、ヘッダーにあるものとして扱う

/** すべての行のセルを、列の数まで空のセルで埋める（行の途中に列を足したり消したりしても、列がずれないように） */
function fillColumns(lines: TableLine[]): number {
  const columns = columnCount(lines)
  for (const line of lines) while (line.cells.length < columns) line.cells.push('')
  return columns
}

/** カーソルの行の下に行を足し、その行の同じ列に移る。ヘッダーでは、本文の最初の行として足す */
export const addRowBelow: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found) return false
  const { table, at, lines } = found
  const line = at.line <= 1 ? 2 : at.line + 1
  addRow(lines, line)
  dispatch(state.update(replaceTable(state, table, lines, { line, column: at.column, offset: 'end' })))
  return true
}

/** カーソルの行を消す。ヘッダーと区切り行は消さない */
export const deleteRow: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found || found.at.line <= 1) return false
  const { table, at, lines } = found
  lines.splice(at.line, 1)
  // 消した行の位置（最後の行を消したら、その前の行）に移る。本文の行がなくなったら、ヘッダーに移る
  const line = Math.min(at.line, lines.length - 1)
  dispatch(state.update(replaceTable(state, table, lines, { line: line === 1 ? 0 : line, column: at.column, offset: 'end' })))
  return true
}

/** カーソルの列の右に列を足し、その列に移る */
export const addColumnRight: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found) return false
  const { table, at, lines } = found
  fillColumns(lines)
  for (const line of lines) line.cells.splice(at.column + 1, 0, '')
  dispatch(state.update(replaceTable(state, table, lines, { line: at.line === 1 ? 0 : at.line, column: at.column + 1, offset: 'end' })))
  return true
}

/** カーソルの列を消す。列が 1 つしかなければ消さない */
export const deleteColumn: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found) return false
  const { table, at, lines } = found
  const columns = fillColumns(lines)
  if (columns <= 1) return false
  for (const line of lines) line.cells.splice(at.column, 1)
  const column = Math.min(at.column, columns - 2)
  dispatch(state.update(replaceTable(state, table, lines, { line: at.line === 1 ? 0 : at.line, column, offset: 'end' })))
  return true
}

/** カーソルの列の配置を変える（区切り行の :-- / :-: / --:） */
export function alignColumn(align: Align): StateCommand {
  return ({ state, dispatch }) => {
    const found = current(state)
    if (!found) return false
    const { table, at, lines } = found
    fillColumns(lines)
    // 幅は整形で列に合わせ直すので、ここでは配置だけが分かればよい
    lines[1].cells[at.column] = delimiterCell(align, 3)
    dispatch(state.update(replaceTable(state, table, lines, { line: at.line, column: at.column, offset: at.offset })))
    return true
  }
}

/** 表を整形する。カーソルは、同じセルの同じ位置に残す */
export const formatCurrentTable: StateCommand = ({ state, dispatch }) => {
  const found = current(state)
  if (!found) return false
  const { table, at, lines } = found
  dispatch(state.update(replaceTable(state, table, lines, { line: at.line, column: at.column, offset: at.offset })))
  return true
}

/** Tab と同じ（字下げのボタン）。表の中では次のセル、それ以外では字下げ。タッチの端末のキーボードには Tab がないので、ボタンにする */
export const indentOrNextCell: StateCommand = (target) => nextCell(target) || indentMore(target)

/** Shift-Tab と同じ（字下げ解除のボタン）。表の中では前のセル、それ以外では字下げ解除 */
export const outdentOrPreviousCell: StateCommand = (target) => previousCell(target) || indentLess(target)

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
