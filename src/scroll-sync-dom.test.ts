// @vitest-environment jsdom
// jsdom にはレイアウトがないので、スクロールの大きさと位置を持たせた要素で、同期の判断だけを確かめる
import { describe, expect, it } from 'vitest'
import type { MarkdownEditor } from './editor'
import { enableScrollSync } from './scroll-sync'

function scroller(scrollHeight: number, clientHeight: number, scrollTop = 0): HTMLElement {
  const element = document.createElement('div')
  let top = scrollTop
  Object.defineProperty(element, 'scrollHeight', { get: () => scrollHeight })
  Object.defineProperty(element, 'clientHeight', { get: () => clientHeight })
  Object.defineProperty(element, 'scrollTop', { get: () => top, set: (value: number) => (top = Math.min(value, scrollHeight - clientHeight)) })
  return element
}

function setup(editorScroller: HTMLElement, previewScroller: HTMLElement) {
  const lines: number[] = []
  const editor = {
    scroller: editorScroller,
    lineCount: 5,
    topLine: () => 0,
    scrollToLine: (line: number) => lines.push(line),
  } as unknown as MarkdownEditor
  const preview = document.createElement('div')
  previewScroller.append(preview)
  const sync = enableScrollSync({ editor, editorPane: document.createElement('div'), previewScroller, preview, enabled: () => true })
  return { sync, lines }
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

describe('enableScrollSync', () => {
  it('起点のエディタがスクロールしない長さなら、プレビューを動かさない（末尾に飛ばさない）', async () => {
    const preview = scroller(2000, 500, 120)
    const { sync } = setup(scroller(500, 500), preview)
    sync.refresh()
    await nextFrame()
    expect(preview.scrollTop).toBe(120)
  })

  it('起点のエディタが末尾までスクロールしていれば、プレビューも末尾にする', async () => {
    const preview = scroller(2000, 500)
    const { sync } = setup(scroller(1500, 500, 1000), preview)
    sync.refresh()
    await nextFrame()
    expect(preview.scrollTop).toBe(1500)
  })
})
