// @vitest-environment jsdom
// プレビューの中の文字の位置から、元の Markdown の行と行の中の位置を求めることを確かめる
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enablePreviewJump, sourcePosition, type SourcePosition } from './preview-jump'
import { renderHtml } from './render'

/**
 * markdown を描き、プレビューで target の文字列（同じものがあれば nth 番目）の先頭を押したときの位置を返す。
 * 押した位置は、その文字列を含む文字のノードの中の位置にする（ブラウザの caretPositionFromPoint と同じ）
 */
function positionAt(markdown: string, target: string, nth = 0) {
  const preview = document.createElement('div')
  preview.innerHTML = renderHtml(markdown)
  const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT)
  let seen = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (let at = text.indexOf(target); at >= 0; at = text.indexOf(target, at + 1)) {
      if (seen++ === nth) return sourcePosition(preview, node, at, markdown.split('\n'))
    }
  }
  throw new Error(`${target} が見つからない`)
}

describe('sourcePosition', () => {
  it('段落の中の改行（<br>）を数えて行を決め、押した文字を元の行から探す', () => {
    expect(positionAt('first\nsecond line\nthird', 'line')).toEqual({ line: 1, column: 7 })
  })

  it('記法の記号の分だけ、行の中の位置をずらす', () => {
    expect(positionAt('- **bold** and more', 'more')).toEqual({ line: 0, column: 15 })
    expect(positionAt('[link](https://example.com) after', 'after')).toEqual({ line: 0, column: 28 })
  })

  it('同じ文字が行に何度も出るときは、プレビューで何番目のものかで選ぶ', () => {
    expect(positionAt('**x** cat cat', 'cat', 1)).toEqual({ line: 0, column: 10 })
  })

  it('押した文字の後ろがノードの終わりなら、前の文字で探す', () => {
    // 「ab」の後ろ（ノードの終わり）を押したときは、after が空になる
    const preview = document.createElement('div')
    preview.innerHTML = renderHtml('**x** ab')
    const node = preview.querySelector('p')!.lastChild!
    expect(sourcePosition(preview, node, node.textContent!.length, ['**x** ab'])).toEqual({ line: 0, column: 8 })
  })

  it('フェンスのコードブロックでは、開始フェンスの次の行から改行を数える', () => {
    expect(positionAt('text\n\n```js\nconst a = 1\nreturn value\n```', 'value')).toEqual({ line: 4, column: 7 })
  })

  it('字下げのコードブロックには開始フェンスがないので、ブロックの行から数える', () => {
    expect(positionAt('text\n\n    one\n    two', 'two')).toEqual({ line: 3, column: 4 })
  })

  it('リスト、引用、表では、その項目・段落・行の位置になる', () => {
    expect(positionAt('- a\n  - nested\n- last', 'last')).toEqual({ line: 2, column: 2 })
    expect(positionAt('- a\n  - nested\n- last', 'nested')).toEqual({ line: 1, column: 4 })
    expect(positionAt('> quote\n> second', 'second')).toEqual({ line: 1, column: 2 })
    expect(positionAt('| a | b |\n|---|---|\n| 1 | 22 |', '22')).toEqual({ line: 2, column: 6 })
  })

  it('後ろの文字が元の行に見つからなければ前の文字で、どちらもなければ行頭にする', () => {
    // &amp; や &lt; は、プレビューでは & や < になる
    expect(positionAt('a\nx &amp; y', '& y')).toEqual({ line: 1, column: 2 })
    expect(positionAt('a\n&lt;&gt;&lt;&gt;', '<>', 1)).toEqual({ line: 1, column: 0 })
  })

  it('data-line の要素の外なら null', () => {
    const preview = document.createElement('div')
    preview.innerHTML = renderHtml('text')
    expect(sourcePosition(preview, preview, 0, ['text'])).toBeNull()
  })
})

describe('enablePreviewJump', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  /** プレビューを作り、押した位置の文字は、いつも段落の「two」の先頭にする（jsdom にはレイアウトがない） */
  function setup(markdown = 'one\ntwo [link](https://example.com)') {
    const preview = document.body.appendChild(document.createElement('div'))
    preview.innerHTML = renderHtml(markdown)
    const text = preview.querySelector('p')!.childNodes[2]
    document.caretPositionFromPoint = () => ({ offsetNode: text, offset: 0, getClientRect: () => null })
    const jumps: SourcePosition[] = []
    enablePreviewJump(preview, () => markdown.split('\n'), (position) => jumps.push(position))
    return { preview, jumps }
  }

  const pointer = (type: string, pointerType: string, target: Element, x = 10) =>
    target.dispatchEvent(new PointerEvent(type, { pointerType, clientX: x, clientY: 10, bubbles: true }))

  it('マウスのダブルクリックで、押した文字の位置を知らせる', () => {
    const { preview, jumps } = setup()
    const paragraph = preview.querySelector('p')!
    pointer('pointerdown', 'mouse', paragraph)
    paragraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(jumps).toEqual([{ line: 1, column: 0 }])
  })

  it('caretPositionFromPoint のない環境（iOS 26.2 未満）では、caretRangeFromPoint を使う', () => {
    const { preview, jumps } = setup()
    const paragraph = preview.querySelector('p')!
    const text = paragraph.childNodes[2]
    Object.defineProperty(document, 'caretPositionFromPoint', { value: undefined, configurable: true })
    document.caretRangeFromPoint = () => {
      const range = document.createRange()
      // 文字のノードは <br> の後ろの「\ntwo 」なので、2 文字目は two の w
      range.setStart(text, 2)
      return range
    }
    paragraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(jumps).toEqual([{ line: 1, column: 1 }])
  })

  it('リンクなどの上のダブルクリックでは知らせない', () => {
    const { preview, jumps } = setup()
    preview.querySelector('a')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(jumps).toEqual([])
  })

  /** タッチのタップ。ブラウザは pointerdown・pointerup の後に click を送る */
  const tap = (target: Element, x = 10) => {
    pointer('pointerdown', 'touch', target, x)
    pointer('pointerup', 'touch', target, x)
    target.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: 10, bubbles: true }))
  }

  it('タッチでは、近い位置の 2 回のタップをダブルタップとし、2 回目の click で移る。タッチから来た dblclick は使わない', () => {
    vi.useFakeTimers()
    const { preview, jumps } = setup()
    const paragraph = preview.querySelector('p')!
    tap(paragraph)
    pointer('pointerdown', 'touch', paragraph)
    pointer('pointerup', 'touch', paragraph)
    // click の前（pointerup の時点）では、まだ移らない
    expect(jumps).toHaveLength(0)
    paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    paragraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(jumps).toHaveLength(1)
  })

  it('間が空いたタップや、離れた位置のタップはダブルタップにしない', () => {
    vi.useFakeTimers()
    const { preview, jumps } = setup()
    const paragraph = preview.querySelector('p')!
    tap(paragraph)
    vi.advanceTimersByTime(500)
    tap(paragraph)
    tap(paragraph, 100)
    expect(jumps).toEqual([])
  })
})
