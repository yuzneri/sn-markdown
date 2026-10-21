import { describe, expect, it } from 'vitest'
import { highlightToHtml, onLanguageLoaded } from './highlight'

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

describe('highlightToHtml', () => {
  it('知らない言語と言語の指定がないコードはハイライトしない', () => {
    expect(highlightToHtml('a < b', 'no-such-language', escape)).toBe('')
    expect(highlightToHtml('a < b', '', escape)).toBe('')
  })

  it('初めての言語は読み込みを始めて空を返し、読み込み後に 1 回だけ知らせる。読み込み後はハイライトする', async () => {
    let notified = 0
    const loaded = new Promise<void>((resolve) =>
      onLanguageLoaded(() => {
        notified++
        resolve()
      }),
    )
    expect(highlightToHtml('const a = 1', 'js', escape)).toBe('')
    expect(highlightToHtml('const b = 2', 'javascript', escape)).toBe('')
    await loaded
    expect(notified).toBe(1)

    const html = highlightToHtml('if (a < b) {\n  return "s"\n}', 'js', escape)
    expect(html).toMatch(/^<span class="[^"]+">if<\/span>/)
    expect(html).toContain('&lt;')
    expect(html).toContain('\n')
    expect(html.replace(/<[^>]+>/g, '')).toBe('if (a &lt; b) {\n  return "s"\n}')
  })
})
