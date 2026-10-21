// @vitest-environment jsdom
// 検索のボタン（toggleSearch）と Mod-F で、エディタ（createEditor）の検索・置換のパネルが開くことを確かめる
import { afterEach, describe, expect, it } from 'vitest'
import { searchPanelOpen } from '@codemirror/search'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { createEditor } from './editor'
import './jsdom-range'

const parents: HTMLElement[] = []
afterEach(() => parents.splice(0).forEach((parent) => parent.remove()))

function create(locked = false) {
  const parent = document.body.appendChild(document.createElement('div'))
  parents.push(parent)
  const editor = createEditor(parent, { text: 'find me and me', locked }, { onChange: () => {}, onError: () => {}, onTableChange: () => {} })
  return { editor, view: EditorView.findFromDOM(parent)!, parent }
}

describe('検索・置換', () => {
  it('toggleSearch でパネルを開き、もう一度で閉じる', () => {
    const { editor, view, parent } = create()
    editor.toggleSearch()
    expect(searchPanelOpen(view.state)).toBe(true)
    expect(parent.querySelector('.cm-search [name=replace]')).not.toBeNull()
    editor.toggleSearch()
    expect(searchPanelOpen(view.state)).toBe(false)
  })

  it('Mod-F でも開く（jsdom の navigator.platform は macOS ではないので Ctrl）', () => {
    const { view } = create()
    runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }), 'editor')
    expect(searchPanelOpen(view.state)).toBe(true)
  })

  it('ロック中も検索はできるが、置換の欄は出さない', () => {
    const { editor, view, parent } = create(true)
    editor.toggleSearch()
    expect(searchPanelOpen(view.state)).toBe(true)
    expect(parent.querySelector('.cm-search [name=replace]')).toBeNull()
  })
})
