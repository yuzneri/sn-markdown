// @vitest-environment jsdom
// コードブロックにコピーのボタンを付けることと、押したときに中身を写すことを確かめる
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addCopyButtons, enableCodeCopy } from './code-copy'
import { renderHtml } from './render'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.replaceChildren()
})

function preview(markdown: string): HTMLElement {
  const container = document.body.appendChild(document.createElement('div'))
  container.innerHTML = renderHtml(markdown)
  addCopyButtons(container)
  return container
}

/** execCommand('copy') の代わり。呼ばれたときに選ばれている欄の文字を覚え、result を返す */
function stubCopy(result: boolean | Error) {
  const copied: string[] = []
  document.execCommand = vi.fn(() => {
    const buffer = document.querySelector<HTMLTextAreaElement>('.copy-buffer')!
    copied.push(buffer.value.slice(buffer.selectionStart, buffer.selectionEnd))
    if (result instanceof Error) throw result
    return result
  })
  return copied
}

describe('addCopyButtons', () => {
  it('フェンスと字下げのコードブロックに 1 つずつ付け、Mermaid のソースには付けない。描き直しで呼び直しても増やさない', () => {
    const container = preview('```js\nconst a = 1\n```\n\n    indented\n\n```mermaid\ngraph TD\n```')
    addCopyButtons(container)
    expect([...container.querySelectorAll('.code-copy')].map((button) => button.parentElement!.textContent)).toEqual(['const a = 1\n', 'indented\n'])
    expect(container.querySelector('.mermaid-block .code-copy')).toBeNull()
  })
})

describe('enableCodeCopy', () => {
  it('押したコードブロックの中身を、最後の改行を除いて写し、しばらくチェックの印にする', () => {
    vi.useFakeTimers()
    const container = preview('```js\nconst a = 1\nreturn a\n```')
    const copied = stubCopy(true)
    const errors: string[] = []
    enableCodeCopy(container, (message) => errors.push(message))
    const button = container.querySelector<HTMLButtonElement>('.code-copy')!
    // Chromium では、押したボタンにフォーカスが移る
    button.focus()
    button.click()
    expect(copied).toEqual(['const a = 1\nreturn a'])
    expect(errors).toEqual([])
    expect(button.getAttribute('aria-label')).toBe('Copied')
    // 一時的な欄は消し、フォーカスは押す前の場所に戻す
    expect(document.querySelector('.copy-buffer')).toBeNull()
    expect(document.activeElement).toBe(button)
    vi.advanceTimersByTime(1500)
    expect(button.getAttribute('aria-label')).toBe('Copy code')
  })

  it('押す前にフォーカスがほかの場所（Safari ではエディタ）にあれば、そこに戻す', () => {
    const container = preview('```\ncode\n```')
    const editor = document.body.appendChild(document.createElement('textarea'))
    stubCopy(true)
    enableCodeCopy(container, () => {})
    editor.focus()
    container.querySelector<HTMLButtonElement>('.code-copy')!.click()
    expect(document.activeElement).toBe(editor)
  })

  it('写せなかったとき（execCommand が false か例外）は知らせ、チェックの印にしない', () => {
    const container = preview('```\ncode\n```')
    const errors: string[] = []
    enableCodeCopy(container, (message) => errors.push(message))
    const button = container.querySelector<HTMLButtonElement>('.code-copy')!
    stubCopy(false)
    button.click()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubCopy(new Error('denied'))
    button.click()
    expect(errors).toEqual(['Could not copy the code', 'Could not copy the code'])
    expect(button.getAttribute('aria-label')).toBe('Copy code')
    expect(document.querySelector('.copy-buffer')).toBeNull()
  })
})
