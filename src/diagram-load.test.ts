// @vitest-environment jsdom
// mermaid の読み込みに失敗したとき（Safari 17.4 未満、オフライン）の経路。vi.mock はファイル単位なので diagram.test.ts と分ける
import { expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({ failing: true, loads: 0 }))

vi.mock('mermaid', () => ({
  // 読み込みの失敗を、モジュールの default を取り出すときの例外で模す
  get default() {
    fake.loads++
    if (fake.failing) throw new SyntaxError('Unexpected token')
    return {
      initialize: () => {},
      render: async () => ({ svg: '<svg></svg>' }),
    }
  },
}))

const { renderDiagrams } = await import('./diagram')

function preview(source: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = '<div class="mermaid-block"><pre><code></code></pre></div>'
  container.querySelector('code')!.textContent = source
  return container
}

const drawn = (container: HTMLElement) =>
  new Promise<void>((resolve) => renderDiagrams(container, 'light', () => setTimeout(resolve, 0)))

it('読み込みに失敗したらソースを残してエラーを出し、次の図で読み込みをやり直す', async () => {
  await drawn(preview('graph TD\n  A --> B\n'))
  const failed = preview('graph TD\n  A --> B\n')
  renderDiagrams(failed, 'light', () => {})
  expect(failed.querySelector('pre code')?.textContent).toBe('graph TD\n  A --> B\n')
  expect(failed.querySelector('.mermaid-error')?.textContent).toBe('Failed to load Mermaid: Unexpected token')

  fake.failing = false
  await drawn(preview('graph TD\n  C --> D\n'))
  const loaded = preview('graph TD\n  C --> D\n')
  renderDiagrams(loaded, 'light', () => {})
  expect(loaded.querySelector('svg')).not.toBeNull()
  expect(fake.loads).toBe(2)
})
