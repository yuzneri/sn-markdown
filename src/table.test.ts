import { describe, expect, it } from 'vitest'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { dataUrlLabel } from './data-url'
import { alignOf, displayWidth, formatTable, locate, splitRow, tableAt, type TableLine } from './table'

const state = (doc: string) => EditorState.create({ doc, extensions: markdown({ base: markdownLanguage }) })
const line = (prefix: string, ...cells: string[]): TableLine => ({ prefix, cells })

describe('splitRow', () => {
  it('| で区切り、外側の | はあってもなくてもよい', () => {
    expect(splitRow('| a | b |').map((cell) => cell.text)).toEqual(['a', 'b'])
    expect(splitRow('a | b').map((cell) => cell.text)).toEqual(['a', 'b'])
    expect(splitRow('| a |  ').map((cell) => cell.text)).toEqual(['a'])
    expect(splitRow('|  |').map((cell) => cell.text)).toEqual([''])
  })

  it('\\| はセルの中の文字、\\\\| の | は区切りにする', () => {
    expect(splitRow('| x \\| y | z |').map((cell) => cell.text)).toEqual(['x \\| y', 'z'])
    expect(splitRow('| a \\\\| b |').map((cell) => cell.text)).toEqual(['a \\\\', 'b'])
  })

  it('セルの区切りの間と、中身の始まりの位置を返す', () => {
    expect(splitRow('|  ab | c |')[0]).toEqual({ text: 'ab', from: 1, to: 6, content: 3 })
  })
})

describe('alignOf', () => {
  it('区切り行のセルの配置を読む', () => {
    expect([':--', ':-:', '--:', '---', ':'].map(alignOf)).toEqual(['left', 'center', 'right', 'none', 'left'])
  })
})

describe('displayWidth', () => {
  it('全角と絵文字は 2、半角と結合文字を含む書記素は 1 で数える', () => {
    expect(displayWidth('abc')).toBe(3)
    expect(displayWidth('日本語')).toBe(6)
    expect(displayWidth('Ａ')).toBe(2)
    expect(displayWidth('ｱ')).toBe(1)
    expect(displayWidth('é')).toBe(1)
    expect(displayWidth('👍🏽')).toBe(2)
    expect(displayWidth('👨‍👩‍👧')).toBe(2)
    expect(displayWidth('✓')).toBe(1)
  })
})

describe('formatTable', () => {
  it('列の幅を表示幅でそろえ、配置に合わせて詰める', () => {
    const { text } = formatTable([line('', 'a', '日本語'), line('', ':--', '--:'), line('', '1', 'x'), line('', '2')])
    expect(text).toBe(['| a   | 日本語 |', '| :-- | -----: |', '| 1   |      x |', '| 2   |        |'].join('\n'))
  })

  it('列の数は全行の最大にそろえ、中央寄せは両側に詰める', () => {
    const { text } = formatTable([line('', 'a'), line('', ':-:'), line('', '1', '2')])
    expect(text).toBe(['|  a  |     |', '| :-: | --- |', '|  1  | 2   |'].join('\n'))
  })

  it('行頭の記号は行ごとに残す', () => {
    const { text } = formatTable([line('- ', 'a'), line('  ', '-'), line('  ', 'b')])
    expect(text).toBe(['- | a   |', '  | --- |', '  | b   |'].join('\n'))
  })

  it('埋め込んだ画像（data: URL）は、エディタに出す短い表示の長さで数える（ほかの行を URL の長さまで空白で埋めない）', () => {
    const image = `![photo](data:image/png;base64,${'A'.repeat(100000)})`
    const { text } = formatTable([line('', 'Image', 'Note'), line('', '---', '---'), line('', image, 'a'), line('', '', 'b')])
    expect(text.length).toBeLessThan(image.length + 200)
    const shown = `![photo](${dataUrlLabel('image/png', 100000)})`
    expect(text.split('\n')[0]).toBe(`| ${'Image'.padEnd(shown.length)} | Note |`)
  })

  it('セルの中身の位置を返す', () => {
    const { text, cells } = formatTable([line('', 'a', '日本語'), line('', '--', '--:'), line('', '1', 'x')])
    expect(text.slice(cells[0][1].from, cells[0][1].to)).toBe('日本語')
    expect(text.slice(cells[2][1].from, cells[2][1].to)).toBe('x')
    expect(cells[2][0].to - cells[2][0].from).toBe(1)
  })
})

describe('tableAt と locate', () => {
  const doc = 'text\n\n| a | b |\n|---|---|\n| 1 | 22 |\n\nafter'

  it('カーソルの行を含む表と、カーソルのセルを返す', () => {
    const table = tableAt(state(doc), doc.indexOf('22') + 1)!
    expect(table.lines.map((row) => row.cells)).toEqual([['a', 'b'], ['---', '---'], ['1', '22']])
    expect(doc.slice(table.from, table.to)).toBe('| a | b |\n|---|---|\n| 1 | 22 |')
    expect(locate(table, doc.indexOf('22') + 1)).toEqual({ line: 2, column: 1, offset: 1 })
  })

  it('| の上は左のセル、行末は最後のセル、行頭は最初のセルにする', () => {
    const table = tableAt(state(doc), doc.indexOf('| a'))!
    expect(locate(table, doc.indexOf('| b'))).toEqual({ line: 0, column: 0, offset: 1 })
    expect(locate(table, doc.indexOf('\n|---'))).toEqual({ line: 0, column: 1, offset: 1 })
    expect(locate(table, doc.indexOf('| a'))).toEqual({ line: 0, column: 0, offset: 0 })
  })

  it('表の外と、区切り行のない（ヘッダーだけの）行では null', () => {
    expect(tableAt(state(doc), doc.indexOf('after'))).toBeNull()
    expect(tableAt(state('| a | b |\n\nnext'), 2)).toBeNull()
  })

  it('引用とリストの中の表は、行頭の記号を prefix にする', () => {
    expect(tableAt(state('> | a |\n> |---|\n> | 1 |'), 3)!.lines.map((row) => row.prefix)).toEqual(['> ', '> ', '> '])
    expect(tableAt(state('- | a |\n  |---|\n  | 1 |'), 3)!.lines.map((row) => row.prefix)).toEqual(['- ', '  ', '  '])
  })
})
