// @vitest-environment jsdom
// プレビューの見出しを、畳んでいる行に合わせて畳むことと、ボタンを押したときの呼び出しを確かめる
import { describe, expect, it } from 'vitest'
import { applyPreviewFolds, enablePreviewFold } from './preview-fold'
import { renderHtml } from './render'

const doc = ['# Top', '', 'intro', '', '## A', '', 'a text', '', '### A-1', '', 'sub', '', '## B', '', 'b text'].join('\n')

function preview(): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = renderHtml(doc)
  return container
}

const visible = (container: HTMLElement) => [...container.children].filter((child) => !(child as HTMLElement).hidden).map((child) => child.textContent)

describe('applyPreviewFolds', () => {
  it('畳んだ見出しの後ろを、次の同じか上の階層の見出しまで隠す（深い見出しも隠す）', () => {
    const container = preview()
    applyPreviewFolds(container, new Set([4]))
    expect(visible(container)).toEqual(['Top', 'intro', 'A', 'B', 'b text'])
    expect(container.querySelector('h2')!.classList.contains('is-folded')).toBe(true)
  })

  it('畳んでいなければ、すべて見せる。描き直しのたびに呼んでも、ボタンは 1 つ', () => {
    const container = preview()
    applyPreviewFolds(container, new Set([4]))
    applyPreviewFolds(container, new Set())
    expect(visible(container)).toEqual(['Top', 'intro', 'A', 'a text', 'A-1', 'sub', 'B', 'b text'])
    expect(container.querySelectorAll('h2:first-of-type .heading-fold')).toHaveLength(1)
  })

  it('ボタンに、畳んでいるかを出す', () => {
    const container = preview()
    applyPreviewFolds(container, new Set([4]))
    const [top, a] = [...container.querySelectorAll<HTMLElement>('.heading-fold')]
    expect([top.getAttribute('aria-expanded'), a.getAttribute('aria-expanded')]).toEqual(['true', 'false'])
    expect(a.getAttribute('aria-label')).toBe('Unfold heading')
  })
})

describe('enablePreviewFold', () => {
  it('見出しのボタンを押すと、その見出しの元の行で toggle を呼ぶ', () => {
    const container = preview()
    applyPreviewFolds(container, new Set())
    const lines: number[] = []
    enablePreviewFold(container, (line) => lines.push(line))
    container.querySelectorAll<HTMLElement>('.heading-fold')[2].click()
    container.querySelector<HTMLElement>('p')!.click()
    expect(lines).toEqual([8])
  })
})
