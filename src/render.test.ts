// @vitest-environment jsdom
// DOMPurify は DOM が要る。happy-dom では DOMPurify が何も除去しないので、サニタイズを確かめられる jsdom を使う
import { describe, expect, it } from 'vitest'
import { onLanguageLoaded } from './highlight'
import { previewText, renderHtml } from './render'

const parse = (markdown: string) => {
  const container = document.createElement('div')
  container.innerHTML = renderHtml(markdown)
  return container
}

describe('renderHtml', () => {
  it('ブロック要素に元の行番号を data-line で付ける', () => {
    const html = parse('# Title\n\ntext\n\n- a\n- b\n\n```js\ncode\n```\n')
    expect(html.querySelector('h1')?.dataset.line).toBe('0')
    expect(html.querySelector('p')?.dataset.line).toBe('2')
    expect(html.querySelector('ul')?.dataset.line).toBe('4')
    expect([...html.querySelectorAll('li')].map((li) => li.dataset.line)).toEqual(['4', '5'])
    expect(html.querySelector<HTMLElement>('pre code')?.dataset.line).toBe('7')
  })

  it('GFM の表・取り消し線・タスクリストと、段落内の改行を表示する', () => {
    const html = parse('| a | b |\n|---|---|\n| 1 | 2 |\n\n~~del~~\n\n- [x] done\n- [ ] todo\n\nline1\nline2')
    expect(html.querySelectorAll('td')).toHaveLength(2)
    expect(html.querySelector('s')?.textContent).toBe('del')
    const boxes = [...html.querySelectorAll<HTMLInputElement>('input[type=checkbox]')]
    expect(boxes.map((box) => [box.checked, box.disabled])).toEqual([
      [true, true],
      [false, true],
    ])
    expect(html.querySelector('p:last-child br')).not.toBeNull()
  })

  it('生の HTML は表示するが、スクリプトにつながる要素と属性は除く', () => {
    const html = parse(
      '<b>bold</b><img src="x.png" onerror="alert(1)"><a href="javascript:alert(1)">j</a><script>alert(1)</script><svg><foreignObject><img src=x onerror=1></foreignObject></svg>',
    )
    expect(html.querySelector('b')?.textContent).toBe('bold')
    expect(html.querySelector('img')?.getAttribute('src')).toBe('x.png')
    expect(html.innerHTML).not.toMatch(/onerror|javascript:|<script|foreignObject/i)
  })

  it('コードブロックは、言語を読み込んだ後の描画でハイライトする（クラスと data-line はサニタイズ後も残る）', async () => {
    const source = '```python\ndef f():\n    return 1\n```'
    const loaded = new Promise<void>((resolve) => onLanguageLoaded(resolve))
    expect(parse(source).querySelector('pre code span')).toBeNull()
    await loaded
    const code = parse(source).querySelector<HTMLElement>('pre code')
    expect(code?.className).toBe('language-python')
    expect(code?.dataset.line).toBe('0')
    expect(code?.querySelector('span[class]')?.textContent).toBe('def')
    expect(code?.textContent).toBe('def f():\n    return 1\n')
  })

  it('<style> は除く（プラグインの画面全体に効いてしまうため）', () => {
    expect(parse('<style>body { display: none }</style>text').querySelector('style')).toBeNull()
  })

  it('<form> は除く（送信先が外部になるだけで、プレビューでは使い道がないため）', () => {
    expect(parse('<form action="https://example.com"><button>go</button></form>').querySelector('form')).toBeNull()
  })

  it('画像マップのリンク（<area>）にも rel="noopener noreferrer" を付ける', () => {
    const area = parse('<map name="m"><area href="https://example.com" shape="rect" coords="0,0,1,1"></map>').querySelector('area')
    expect(area?.rel).toBe('noopener noreferrer')
  })

  it('リンクに rel="noopener noreferrer" を付ける', () => {
    const html = parse('[a](https://example.com) <https://example.org> https://example.net <a href="https://example.jp">raw</a>')
    const links = [...html.querySelectorAll('a')]
    expect(links).toHaveLength(4)
    expect(links.every((link) => link.rel === 'noopener noreferrer')).toBe(true)
  })
})

describe('previewText', () => {
  it('記法の記号を除いた本文にする', () => {
    expect(previewText('# Title\n\nSome **bold** and `code` with a [link](https://example.com).\n\n- [x] task')).toBe(
      'Title Some bold and code with a link. task',
    )
  })

  it('生の HTML のタグを除き、画像は代替テキストを使う', () => {
    expect(previewText('<div>in html</div>\n\n![alt text](a.png) <b>b</b>')).toBe('alt text b')
  })

  it('コードブロックの中身は残す', () => {
    expect(previewText('```js\nconst a = 1\n```')).toBe('const a = 1')
  })

  it('90 文字を超えたら切って … を付ける。絵文字を途中で切らない', () => {
    const long = '😀'.repeat(100)
    expect(previewText(long)).toBe(`${'😀'.repeat(90)}…`)
    expect(previewText('a'.repeat(90))).toBe('a'.repeat(90))
  })

  it('空のノートは空にする', () => {
    expect(previewText('')).toBe('')
  })
})
