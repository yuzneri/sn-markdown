import { describe, expect, it } from 'vitest'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { tex } from '@mdit/plugin-tex'
import MarkdownIt from 'markdown-it'
import { inInlineMath, inMath, mathBlockLines } from './math-context'
import { parsed } from './parse-all'

/** `‸` の位置が数式の中か */
function at(doc: string): boolean {
  const state = parsed(EditorState.create({ doc: doc.replace('‸', ''), extensions: markdown({ base: markdownLanguage }) }))
  return inMath(state, doc.indexOf('‸'))
}

describe('inMath', () => {
  it('行の中の $…$ の中（開きの直後から閉じの直前まで）', () => {
    expect(at('Euler $e^‸x$ here')).toBe(true)
    expect(at('Euler $‸e^x$ here')).toBe(true)
    expect(at('Euler $e^x‸$ here')).toBe(true)
    expect(at('Euler ‸$e^x$ here')).toBe(false)
    expect(at('Euler $e^x$‸ here')).toBe(false)
  })

  it('$$…$$ のブロックの中。空行を含むブロック、リストの中のブロックも中とする', () => {
    expect(at('text\n\n$$\na^2 ‸+ b^2\n$$\n\nafter')).toBe(true)
    expect(at('$$\n‸\n$$')).toBe(true)
    expect(at('$$\na\n\n‸b\n$$')).toBe(true)
    expect(at('- $$\n  ‸x\n  $$')).toBe(true)
    expect(at('$$\nx\n$$\n\na‸fter')).toBe(false)
  })

  it('```math の中。ほかの言語のコードブロックとインラインコードの中は数式ではない', () => {
    expect(at('```math\nx ‸= 1\n```')).toBe(true)
    expect(at('```js\nconst a = $x‸$\n```')).toBe(false)
    expect(at('see `$x‸$` here')).toBe(false)
  })

  it('金額の $ は数式ではない', () => {
    expect(at('costs $5 and ‸$10')).toBe(false)
    expect(at('costs $5‸ and $10')).toBe(false)
  })
})

describe('inInlineMath', () => {
  it('ボタンで入れたばかりの空の $$ の間は中とする', () => {
    expect(inInlineMath('text $$', 6)).toBe(true)
  })

  it('エスケープした \\$ は開きにも閉じにもならない', () => {
    expect(inInlineMath('a \\$x$ b', 4)).toBe(false)
    expect(inInlineMath('$a \\$ b$', 3)).toBe(true)
  })

  it('空白に挟まれた $ は飛ばして、その先の閉じを探す', () => {
    expect(inInlineMath('$a $ b$', 5)).toBe(true)
  })
})

describe('mathBlockLines', () => {
  // プレビューと同じ規則か、markdown-it と @mdit/plugin-tex の解析と比べる
  const md = new MarkdownIt().use(tex, { render: () => '' })
  const expected = (doc: string) =>
    md
      .parse(doc, {})
      .filter((token) => token.map && (token.type === 'math_block' || (token.type === 'fence' && token.info.trim() === 'math')))
      .map((token) => token.map)

  it.each([
    ['ふつうのブロック', 'text\n\n$$\na^2\n$$\n\nafter'],
    ['中が空のブロック', '$$\n\n$$'],
    ['空行を含むブロック', '$$\na\n\nb\n$$'],
    ['段落に続くブロック', 'text\n$$\nx\n$$'],
    ['1 行のブロック', '$$x$$\n\ntext'],
    ['後ろに文字が続く $$（ブロックではない）', '$$ x $$ tail'],
    ['閉じていないブロック', 'text\n\n$$\nx\ny'],
    ['リストの中のブロック', '- $$\n  x\n  $$'],
    ['引用の中のブロック', '> $$\n> x\n> $$'],
    ['コードブロックの中の $$', '```\n$$\n```\n\n$$\ny\n$$'],
    ['```math', 'a\n\n```math\nx = 1\n```\n\nb'],
  ])('%s', (_, doc) => {
    const state = parsed(EditorState.create({ doc, extensions: markdown({ base: markdownLanguage }) }))
    expect(mathBlockLines(state)).toEqual(expected(doc))
  })
})
