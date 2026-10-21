// @vitest-environment jsdom
// 候補を開く（startCompletion）のは EditorView の上で働くので jsdom で動かす
import { afterEach, describe, expect, it, vi } from 'vitest'
import { autocompletion, completionStatus, currentCompletions } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { completeCodeLanguage } from './code-language'
import { insertCodeBlock } from './commands'

// jsdom の Range には、一覧を置く位置を測る getClientRects / getBoundingClientRect がない（レイアウトがない）
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()

const views: EditorView[] = []
afterEach(() => views.splice(0).forEach((view) => view.destroy()))

describe('insertCodeBlock', () => {
  it('コードブロックを入れ、言語名を打つ前から候補を開く', async () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: 'text', selection: { anchor: 4 }, extensions: autocompletion({ override: [completeCodeLanguage] }) }),
    })
    views.push(view)
    expect(insertCodeBlock(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('text\n\n```\n```')
    expect(view.state.selection.main.head).toBe('text\n\n```'.length)
    await vi.waitFor(() => expect(completionStatus(view.state)).toBe('active'))
    expect(currentCompletions(view.state).map((option) => option.label)).toContain('mermaid')
  })
})
