// @vitest-environment jsdom
// 折りたたみは EditorView の描画に関わるので jsdom で動かす（レイアウトに依存する操作は使わない）
import { afterEach, describe, expect, it } from 'vitest'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { cursorCharRight, deleteCharBackward } from '@codemirror/commands'
import { collapseDataUrls, dataUrlLabel } from './data-url'

describe('dataUrlLabel', () => {
  it('形式と、復号後のおおよその大きさを出す', () => {
    expect(dataUrlLabel('image/png', 8)).toBe('image/png · 6 B')
    expect(dataUrlLabel('image/jpeg', 4096)).toBe('image/jpeg · 3.0 KB')
    expect(dataUrlLabel('image/webp', 4 * 1024 * 1024)).toBe('image/webp · 3.0 MB')
  })
})

describe('collapseDataUrls', () => {
  const views: EditorView[] = []
  afterEach(() => views.splice(0).forEach((view) => view.destroy()))

  const base64 = 'A'.repeat(200000)
  const image = `![shot](data:image/png;base64,${base64})`
  const doc = `before ${image} after`
  const dataFrom = doc.indexOf('data:')
  const dataTo = doc.indexOf(')', dataFrom)

  function setup(cursor: number) {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc, selection: EditorSelection.cursor(cursor), extensions: [collapseDataUrls, EditorView.lineWrapping] }),
    })
    views.push(view)
    return view
  }

  it('data: URL を短い表示に置き換え、長い文字列を DOM に描かない', () => {
    const view = setup(0)
    expect(view.contentDOM.querySelector('.cm-data-url')?.textContent).toBe('image/png · 146.5 KB')
    expect(view.contentDOM.textContent).toBe('before ![shot](image/png · 146.5 KB) after')
  })

  it('変わった行だけを照合し直す。別の行の編集では残り、壊すと外れ、新しく足すと折りたたむ', () => {
    const collapsed = (state: EditorState) => {
      const ranges: string[] = []
      state.field(collapseDataUrls).between(0, state.doc.length, (from, to) => {
        ranges.push(state.doc.sliceString(from, from + 20) + '…' + (to - from))
      })
      return ranges
    }
    let state = EditorState.create({ doc: `a\n${image}\nb`, extensions: [collapseDataUrls] })
    expect(collapsed(state)).toEqual([`data:image/png;base6…${dataTo - dataFrom}`])
    state = state.update({ changes: { from: 0, insert: 'xx' } }).state
    expect(collapsed(state)).toHaveLength(1)
    const start = state.doc.toString().indexOf('base64,')
    state = state.update({ changes: { from: start, to: start + 7, insert: 'base64;' } }).state
    expect(collapsed(state)).toEqual([])
    state = state.update({ changes: { from: state.doc.length, insert: '\n![b](data:image/gif;base64,R0lGOD==)' } }).state
    expect(collapsed(state)).toEqual(['data:image/gif;base6…30'])
  })

  it('カーソルは折りたたんだ部分を 1 文字のように飛び越え、消すときはまとめて消える', () => {
    const view = setup(dataFrom)
    cursorCharRight(view)
    expect(view.state.selection.main.head).toBe(dataTo)
    deleteCharBackward(view)
    expect(view.state.doc.toString()).toBe('before ![shot]() after')
  })
})
