// @vitest-environment jsdom
// エディタ（createEditor）の上で、表のキーと、カーソルが表に出入りしたときの知らせを確かめる。
// 表のキーは、lang-markdown のキーマップ（リストの続きの Enter）と字下げの Tab より先に効き、表の外では今までどおりに譲る。
// runScopeHandlers でキーイベントをキーマップに通す
import { afterEach, describe, expect, it } from 'vitest'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { createEditor, type MarkdownEditor } from './editor'
import './jsdom-range'

const parents: HTMLElement[] = []
afterEach(() => parents.splice(0).forEach((parent) => parent.remove()))

function create(text: string, onTableChange: (inTable: boolean) => void = () => {}): { editor: MarkdownEditor; view: EditorView } {
  const parent = document.body.appendChild(document.createElement('div'))
  parents.push(parent)
  const editor = createEditor(parent, { text, locked: false }, { onChange: () => {}, onError: () => {}, onTableChange })
  return { editor, view: EditorView.findFromDOM(parent)! }
}

function press(doc: string, key: string, shiftKey = false): MarkdownEditor {
  const { editor, view } = create(doc.replace('‸', ''))
  view.dispatch({ selection: { anchor: doc.indexOf('‸') } })
  runScopeHandlers(view, new KeyboardEvent('keydown', { key, shiftKey }), 'editor')
  return editor
}

describe('表のキー', () => {
  // lang-markdown の Enter は、引用やリストの外では何もせずに譲るので、先に効くかは引用の中の表で確かめる
  it('引用の中の表の Enter は、引用の続きではなく下の行への移動になる', () => {
    expect(press('> | a‸ |\n> |---|', 'Enter').text).toBe('> | a   |\n> | --- |\n> |     |')
  })

  it('表の中の Tab は、字下げではなく次のセルへの移動になる', () => {
    expect(press('| a‸ | b |\n|---|---|', 'Tab').text).toBe('| a   | b   |\n| --- | --- |')
  })

  it('表の外では、今までどおり Enter でリストを続け、Tab で字下げする', () => {
    expect(press('- item‸', 'Enter').text).toBe('- item\n- ')
    expect(press('- item‸', 'Tab').text).toBe('  - item')
  })
})

describe('onTableChange', () => {
  it('カーソルが表に入ったときと出たときだけ知らせる', () => {
    const changes: boolean[] = []
    const doc = 'text\n\n| a | b |\n|---|---|\n\nafter'
    const { view } = create(doc, (inTable) => changes.push(inTable))
    view.dispatch({ selection: { anchor: doc.indexOf('a |') } })
    view.dispatch({ selection: { anchor: doc.indexOf('b |') } })
    view.dispatch({ selection: { anchor: doc.indexOf('after') } })
    expect(changes).toEqual([true, false])
  })

  it('最初から表の中にカーソルがあれば、作ったときに知らせる', () => {
    const changes: boolean[] = []
    create('| a |\n|---|', (inTable) => changes.push(inTable))
    expect(changes).toEqual([true])
  })
})
