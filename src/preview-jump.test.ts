// @vitest-environment jsdom
// プレビューの中の文字の位置から、元の Markdown の行と行の中の位置を求めることを確かめる
import { describe, expect, it } from 'vitest'
import { sourcePosition } from './preview-jump'
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
