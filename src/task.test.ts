// @vitest-environment jsdom
// toggleTask は EditorState だけで動くが、enableTaskToggle はプレビューの DOM のクリックを受けるので、jsdom で動かす
import { describe, expect, it } from 'vitest'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { renderHtml } from './render'
import { enableTaskToggle, toggleTask } from './task'

function toggle(doc: string, line: number, readOnly = false): string | null {
  const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), EditorState.readOnly.of(readOnly)] })
  const spec = toggleTask(state, line)
  return spec ? state.update(spec).state.doc.toString() : null
}

describe('toggleTask', () => {
  it('[ ] と [x]（[X]）を切り替える', () => {
    expect(toggle('- [ ] a\n- [x] b\n- [X] c', 0)).toBe('- [x] a\n- [x] b\n- [X] c')
    expect(toggle('- [ ] a\n- [x] b\n- [X] c', 1)).toBe('- [ ] a\n- [ ] b\n- [X] c')
    expect(toggle('- [ ] a\n- [x] b\n- [X] c', 2)).toBe('- [ ] a\n- [x] b\n- [ ] c')
  })

  it('入れ子のリスト、番号付きのリスト、引用の中のタスクも切り替える', () => {
    expect(toggle('- [ ] a\n  - [ ] nested', 1)).toBe('- [ ] a\n  - [x] nested')
    expect(toggle('1. [ ] first', 0)).toBe('1. [x] first')
    expect(toggle('> - [ ] quoted', 0)).toBe('> - [x] quoted')
  })

  it('タスクのない行、コードブロックの中、範囲の外、ロック中は null', () => {
    expect(toggle('- item [ ] not a task', 0)).toBeNull()
    expect(toggle('```\n- [ ] code\n```', 1)).toBeNull()
    expect(toggle('- [ ] a', 5)).toBeNull()
    expect(toggle('- [ ] a', 0, true)).toBeNull()
  })
})

describe('enableTaskToggle', () => {
  function setup(result: boolean) {
    const preview = document.createElement('div')
    preview.innerHTML = renderHtml('text\n\n- [ ] a\n- [x] b')
    const lines: number[] = []
    enableTaskToggle(preview, (line) => (lines.push(line), result))
    return { boxes: [...preview.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox')], lines }
  }

  it('押したチェックボックスの項目の行（0 始まり）で切り替える', () => {
    const { boxes, lines } = setup(true)
    boxes[1].click()
    expect(lines).toEqual([3])
    expect(boxes[1].checked).toBe(false)
  })

  it('切り替えられなければ、押した見た目を元に戻す', () => {
    const { boxes } = setup(false)
    boxes[0].click()
    expect(boxes[0].checked).toBe(false)
  })
})
