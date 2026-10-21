// @vitest-environment jsdom
// エディタ（createEditor）で、見出しを次の同じか上の階層の見出しまで畳めることと、印の列が出ることを確かめる
import { afterEach, describe, expect, it } from 'vitest'
import { foldCode, foldedRanges, unfoldAll } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { createEditor } from './editor'
import './jsdom-range'

const parents: HTMLElement[] = []
afterEach(() => parents.splice(0).forEach((parent) => parent.remove()))

function create(doc: string) {
  const parent = document.body.appendChild(document.createElement('div'))
  parents.push(parent)
  createEditor(parent, { text: doc, locked: false }, { onChange: () => {}, onError: () => {}, onContextChange: () => {} })
  return { view: EditorView.findFromDOM(parent)!, parent }
}

function folded(view: EditorView): string[] {
  const ranges: string[] = []
  foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
    ranges.push(view.state.sliceDoc(from, to))
  })
  return ranges
}

describe('折りたたみ', () => {
  const doc = '## A\n\na text\n\n### A-1\n\nsub\n\n## B\n\nb text'

  it('見出しを、次の同じか上の階層の見出しの前（の最後の本文の行の終わり）まで畳む', () => {
    const { view } = create(doc)
    view.dispatch({ selection: { anchor: 0 } })
    expect(foldCode(view)).toBe(true)
    expect(folded(view)).toEqual(['\n\na text\n\n### A-1\n\nsub'])
    unfoldAll(view)
    expect(folded(view)).toEqual([])
  })

  it('印の列を出す', () => {
    const { parent } = create(doc)
    expect(parent.querySelector('.cm-foldGutter')).not.toBeNull()
  })

  it('ロック中のノートも畳める（表示だけを変える）', () => {
    const parent = document.body.appendChild(document.createElement('div'))
    parents.push(parent)
    createEditor(parent, { text: doc, locked: true }, { onChange: () => {}, onError: () => {}, onContextChange: () => {} })
    const view = EditorView.findFromDOM(parent)!
    expect(foldCode(view)).toBe(true)
  })
})
