import { describe, expect, it } from 'vitest'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState, type StateCommand } from '@codemirror/state'
import {
  addColumnRight,
  addRowBelow,
  alignColumn,
  deleteColumn,
  deleteRow,
  formatCurrentTable,
  indentOrNextCell,
  nextCell,
  nextRow,
  outdentOrPreviousCell,
  previousCell,
} from './table-commands'

/** `‸` をカーソルとして書いた文書にコマンドを実行し、同じ書き方で結果を返す（表の | と区別するため、| は使わない） */
function run(command: StateCommand, doc: string, options: { readOnly?: boolean } = {}): string | false {
  const cursor = doc.indexOf('‸')
  let state = EditorState.create({
    doc: doc.replace('‸', ''),
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), EditorState.readOnly.of(options.readOnly ?? false)],
  })
  if (!command({ state, dispatch: (tr) => (state = tr.state) })) return false
  const head = state.selection.main.head
  const text = state.doc.toString()
  return text.slice(0, head) + '‸' + text.slice(head)
}

const table = (...lines: string[]) => lines.join('\n')

describe('nextCell（Tab）', () => {
  it('整形して、次のセルの中身の末尾に移る', () => {
    expect(run(nextCell, table('| a‸ | b |', '|---|:-:|', '| 1| 22 |'))).toBe(
      table('| a   |  b‸  |', '| --- | :-: |', '| 1   | 22  |'),
    )
  })

  it('行の最後のセルからは、区切り行を飛ばして次の行の最初のセルに移る', () => {
    expect(run(nextCell, table('| a | b‸ |', '|---|---|', '| 1 | 2 |'))).toBe(table('| a   | b   |', '| --- | --- |', '| 1‸   | 2   |'))
  })

  it('最後のセルからは、行を足して、その最初のセルに移る', () => {
    expect(run(nextCell, table('| a | b |', '|---|---|', '| 1 | 2‸ |'))).toBe(
      table('| a   | b   |', '| --- | --- |', '| 1   | 2   |', '| ‸    |     |'),
    )
  })

  it('引用の中の表では、足した行にも引用の記号を付ける', () => {
    expect(run(nextCell, table('> | a‸ |', '> |---|'))).toBe(table('> | a   |', '> | --- |', '> | ‸    |'))
  })

  it('表の外、区切り行のない行、ロック中は何もしない（false を返して既定の動きに譲る）', () => {
    expect(run(nextCell, 'text‸')).toBe(false)
    expect(run(nextCell, '| a‸ | b |')).toBe(false)
    expect(run(nextCell, table('| a‸ |', '|---|'), { readOnly: true })).toBe(false)
  })
})

describe('previousCell（Shift-Tab）', () => {
  it('前のセルへ。行の最初のセルからは、前の行（区切り行は飛ばす）の最後のセルへ', () => {
    expect(run(previousCell, table('| a | b |', '|---|---|', '| 1 | 2‸ |'))).toBe(table('| a   | b   |', '| --- | --- |', '| 1‸   | 2   |'))
    expect(run(previousCell, table('| a | b |', '|---|---|', '| ‸1 | 2 |'))).toBe(table('| a   | b‸   |', '| --- | --- |', '| 1   | 2   |'))
  })

  it('先頭のセルでは動かない', () => {
    expect(run(previousCell, table('| ‸a | b |', '|---|---|'))).toBe(table('| a‸   | b   |', '| --- | --- |'))
  })
})

describe('nextRow（Enter）', () => {
  it('下の行の同じ列に移る。ヘッダーからは区切り行を飛ばす', () => {
    expect(run(nextRow, table('| a | b‸ |', '|---|---|', '| 1 | 2 |'))).toBe(table('| a   | b   |', '| --- | --- |', '| 1   | 2‸   |'))
  })

  it('最後の行からは、行を足して同じ列に移る', () => {
    expect(run(nextRow, table('| a | b |', '|---|---|', '| 1 | 2‸ |'))).toBe(
      table('| a   | b   |', '| --- | --- |', '| 1   | 2   |', '|     | ‸    |'),
    )
  })

  it('最後の行が空なら、その行を消して、空行を 1 つ空けた次の行に出る', () => {
    // 次の行がもともと空行なら、そこに置く
    expect(run(nextRow, table('| a | b |', '|---|---|', '| 1 | 2 |', '|  | ‸ |', '', 'after'))).toBe(
      table('| a   | b   |', '| --- | --- |', '| 1   | 2   |', '', '‸', 'after'),
    )
    // 文書の末尾の表では、空行と次の行を作る
    expect(run(nextRow, table('| a |', '|---|', '| ‸ |'))).toBe(table('| a   |', '| --- |', '', '‸'))
  })

  it('表の外では何もしない', () => {
    expect(run(nextRow, 'text‸')).toBe(false)
  })
})

describe('行と列の操作（書式バーのボタン）', () => {
  const base = table('| a | b |', '|---|---|', '| 1 | 2‸ |', '| 3 | 4 |')

  it('addRowBelow: カーソルの行の下に行を足し、同じ列に移る。ヘッダーでは本文の最初の行にする', () => {
    expect(run(addRowBelow, base)).toBe(table('| a   | b   |', '| --- | --- |', '| 1   | 2   |', '|     | ‸    |', '| 3   | 4   |'))
    expect(run(addRowBelow, table('| a‸ |', '|---|', '| 1 |'))).toBe(table('| a   |', '| --- |', '| ‸    |', '| 1   |'))
  })

  it('deleteRow: カーソルの行を消し、次の行（最後の行なら前の行）に移る。ヘッダーと区切り行は消さない', () => {
    expect(run(deleteRow, base)).toBe(table('| a   | b   |', '| --- | --- |', '| 3   | 4‸   |'))
    expect(run(deleteRow, table('| a | b |', '|---|---|', '| 1 | 2 |', '| 3 | 4‸ |'))).toBe(table('| a   | b   |', '| --- | --- |', '| 1   | 2‸   |'))
    expect(run(deleteRow, table('| a | b |', '|---|---|', '| 1 | 2‸ |'))).toBe(table('| a   | b‸   |', '| --- | --- |'))
    expect(run(deleteRow, table('| a‸ |', '|---|', '| 1 |'))).toBe(false)
  })

  it('addColumnRight: カーソルの列の右に列を足し、その列に移る。セルの足りない行も列がずれない', () => {
    expect(run(addColumnRight, table('| a‸ | b |', '|---|--:|', '| 1 |'))).toBe(
      table('| a   | ‸    |   b |', '| --- | --- | --: |', '| 1   |     |     |'),
    )
  })

  it('deleteColumn: カーソルの列を消す。列が 1 つなら消さない', () => {
    expect(run(deleteColumn, table('| a | b‸ | c |', '|---|---|--:|'))).toBe(table('| a   |   c‸ |', '| --- | --: |'))
    expect(run(deleteColumn, table('| a | b‸ |', '|---|---|'))).toBe(table('| a‸   |', '| --- |'))
    expect(run(deleteColumn, table('| a‸ |', '|---|'))).toBe(false)
  })

  it('alignColumn: カーソルの列の配置を変え、カーソルは同じ位置に残す', () => {
    expect(run(alignColumn('right'), table('| a | bc‸ |', '|---|---|', '| 1 | 2 |'))).toBe(
      table('| a   |  bc‸ |', '| --- | --: |', '| 1   |   2 |'),
    )
    expect(run(alignColumn('center'), table('| a‸ |', '|---|'))).toBe(table('|  a‸  |', '| :-: |'))
  })

  it('formatCurrentTable: 整形し、カーソルは同じセルの同じ位置に残す', () => {
    expect(run(formatCurrentTable, table('|a‸b|c|', '|-|-|'))).toBe(table('| a‸b  | c   |', '| --- | --- |'))
  })

  it('表の外では何もしない', () => {
    for (const command of [addRowBelow, deleteRow, addColumnRight, deleteColumn, alignColumn('left'), formatCurrentTable]) {
      expect(run(command, 'text‸')).toBe(false)
    }
  })
})

describe('字下げのボタン（タッチの端末の Tab の代わり）', () => {
  it('表の中では、次・前のセルに移る', () => {
    expect(run(indentOrNextCell, table('| a‸ | b |', '|---|---|'))).toBe(table('| a   | b‸   |', '| --- | --- |'))
    expect(run(outdentOrPreviousCell, table('| a | b‸ |', '|---|---|'))).toBe(table('| a‸   | b   |', '| --- | --- |'))
  })

  it('表の外では、行を字下げする・字下げを解除する', () => {
    expect(run(indentOrNextCell, '- item‸')).toBe('  - item‸')
    expect(run(outdentOrPreviousCell, '  - item‸')).toBe('- item‸')
  })

  it('ロック中は何もしない', () => {
    expect(run(indentOrNextCell, '- item‸', { readOnly: true })).toBe(false)
  })
})
