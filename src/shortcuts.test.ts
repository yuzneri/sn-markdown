// @vitest-environment jsdom
// キーマップは EditorView の上で働くので jsdom で動かす。runScopeHandlers でキーイベントをキーマップに通す
import { afterEach, describe, expect, it } from 'vitest'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, keymap, runScopeHandlers } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { formatKeymap } from './commands'

const views: EditorView[] = []
afterEach(() => views.splice(0).forEach((view) => view.destroy()))

function press(doc: string, from: number, to: number, key: string): string {
  const view = new EditorView({
    parent: document.body,
    // エディタと同じく既定のキーマップと Markdown の言語を入れ、Mod-I が既定の割り当て（selectParentSyntax）に負けないことを確かめる。
    // 言語がないと構文木がなく、selectParentSyntax が何もせずに次の割り当てへ譲るので、確かめられない
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(from, to),
      extensions: [keymap.of(defaultKeymap), markdown(), formatKeymap],
    }),
  })
  views.push(view)
  // jsdom の navigator.platform は macOS ではないので、Mod は Ctrl
  runScopeHandlers(view, new KeyboardEvent('keydown', { key, ctrlKey: true }), 'editor')
  return view.state.doc.toString()
}

describe('formatKeymap', () => {
  it('Mod-B で太字、Mod-I で斜体、Mod-K でリンクにする', () => {
    expect(press('a word b', 2, 6, 'b')).toBe('a **word** b')
    expect(press('a word b', 2, 6, 'i')).toBe('a _word_ b')
    expect(press('a word b', 2, 6, 'k')).toBe('a [word]() b')
  })
})
