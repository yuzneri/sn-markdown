import { describe, expect, it } from 'vitest'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { linkPaste } from './paste-link'

/** `«` `»` を選択範囲として書いた文書に url を貼り、`‸` をカーソルとして結果を返す。リンクにしないときは null */
function paste(doc: string, url: string): string | null {
  const from = doc.indexOf('«')
  const to = doc.indexOf('»') - 1
  let state = EditorState.create({
    doc: doc.replace('«', '').replace('»', ''),
    selection: { anchor: from, head: to },
    extensions: markdown({ base: markdownLanguage }),
  })
  const spec = linkPaste(state, url)
  if (!spec) return null
  state = state.update(spec).state
  const head = state.selection.main.head
  const text = state.doc.toString()
  return text.slice(0, head) + '‸' + text.slice(head)
}

const url = 'https://example.com/a'

describe('linkPaste', () => {
  it('選択範囲を、貼った URL へのリンクにして、カーソルをリンクの後ろに置く', () => {
    expect(paste('see the «docs» here', url)).toBe('see the [docs](https://example.com/a)‸ here')
    expect(paste('詳しくは«こちら»を参照', url)).toBe('詳しくは[こちら](https://example.com/a)‸を参照')
  })

  it('URL の前後の空白と改行を除き、www. には https:// を補い、括弧を含むものは < > で囲む', () => {
    expect(paste('«docs»', ' https://example.com/a\n')).toBe('[docs](https://example.com/a)‸')
    expect(paste('«docs»', 'www.example.com')).toBe('[docs](https://www.example.com)‸')
    expect(paste('«Foo»', 'https://en.wikipedia.org/wiki/Foo_(bar)')).toBe('[Foo](<https://en.wikipedia.org/wiki/Foo_(bar)>)‸')
  })

  it('選択範囲の前後の空白は、リンクの外に残す', () => {
    expect(paste('a« docs »b', url)).toBe('a [docs](https://example.com/a)‸ b')
  })

  it('太字の中の語や、強調を丸ごと含む範囲もリンクにする', () => {
    expect(paste('see **«bold»** text', url)).toBe('see **[bold](https://example.com/a)‸** text')
    expect(paste('see «**bold** text»', url)).toBe('see [**bold** text](https://example.com/a)‸')
    expect(paste('«run `npm test`»', url)).toBe('[run `npm test`](https://example.com/a)‸')
  })

  it('見出し、リスト、表のセルの中の語もリンクにする', () => {
    expect(paste('# «Title» here', url)).toBe('# [Title](https://example.com/a)‸ here')
    expect(paste('- «item» text', url)).toBe('- [item](https://example.com/a)‸ text')
    expect(paste('| a | b |\n|---|---|\n| «one» | two |', url)).toBe('| a | b |\n|---|---|\n| [one](https://example.com/a)‸ | two |')
  })

  it('構文を途中で切る範囲、記号を含む範囲、コードやリンクの中はリンクにしない', () => {
    expect(paste('see **«bold** te»xt', url)).toBeNull()
    expect(paste('«# Title»', url)).toBeNull()
    expect(paste('| a | b |\n|---|---|\n| «one | two» |', url)).toBeNull()
    expect(paste('`«code» here`', url)).toBeNull()
    expect(paste('[«docs»](https://old.example.com)', url)).toBeNull()
    expect(paste('```\n«code»\n```', url)).toBeNull()
  })

  it('URL でない文字列、URL を選んでいるとき、複数の行、空の選択では、ふつうに貼り付ける', () => {
    expect(paste('«docs»', 'just text')).toBeNull()
    expect(paste('«docs»', 'https://example.com/a and more')).toBeNull()
    expect(paste('«https://old.example.com»', url)).toBeNull()
    expect(paste('«one\ntwo»', url)).toBeNull()
    expect(paste('a«  »b', url)).toBeNull()
  })
})
