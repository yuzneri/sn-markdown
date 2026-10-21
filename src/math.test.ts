// @vitest-environment jsdom
// KaTeX は実物を読み込む。読み込んだ状態はモジュールに残るので、最初のテストで読み込みを確かめ、後のテストはその上で描く
import { describe, expect, it } from 'vitest'
import { renderMath } from './math'
import { renderHtml } from './render'

function preview(markdown: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = renderHtml(markdown)
  return container
}

describe('renderMath', () => {
  it('数式がなければ、KaTeX を読み込まない', async () => {
    let loaded = false
    renderMath(preview('no math here'), () => (loaded = true))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(loaded).toBe(false)
  })

  it('最初はソースのまま残して KaTeX を読み込み、読み終えたら onLoaded を呼ぶ。描き直すと、その場で式になる', async () => {
    const first = preview('Euler $e^{i\\pi}+1=0$')
    await new Promise<void>((resolve) => renderMath(first, resolve))
    expect(first.querySelector('.math')?.textContent).toBe('e^{i\\pi}+1=0')

    const second = preview('Euler $e^{i\\pi}+1=0$\n\n$$\n\\frac{a}{b}\n$$')
    renderMath(second, () => {})
    expect(second.querySelector('span.math .katex')).not.toBeNull()
    expect(second.querySelector('div.math-display .katex-display')).not.toBeNull()
    expect([...second.querySelectorAll('.math')].every((element) => element.classList.contains('is-rendered'))).toBe(true)
    // 読み上げと TeX のコピーに使う MathML の annotation は、DOMPurify に通しても残す
    expect(second.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toBe('e^{i\\pi}+1=0')
  })

  it('書き間違いは例外にせず、赤い字のソースにする。\\href などでリンクを作らない', () => {
    const container = preview('$\\frac{a}{$ and $\\href{javascript:alert(1)}{x}$')
    renderMath(container, () => {})
    expect(container.querySelector('.katex-error')).not.toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })
})
