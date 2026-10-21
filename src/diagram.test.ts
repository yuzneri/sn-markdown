// @vitest-environment jsdom
// mermaid 本体は SVG の寸法を測るので jsdom では描けない。描画の呼び出しを記録する偽物に差し替える
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  themes: [] as string[],
  ids: [] as string[],
  sources: [] as string[],
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: (config: { theme: string }) => fake.themes.push(config.theme),
    render: async (id: string, source: string) => {
      fake.ids.push(id)
      fake.sources.push(source)
      if (source.includes('broken')) throw new Error('Parse error on line 1')
      return { svg: `<svg data-source="${source.length}"><text>${id}</text></svg>` }
    },
  },
}))

const { renderDiagrams } = await import('./diagram')

function preview(...sources: string[]): HTMLElement {
  const container = document.createElement('div')
  for (const source of sources) {
    const block = document.createElement('div')
    block.className = 'mermaid-block'
    block.innerHTML = '<pre><code></code></pre>'
    block.querySelector('code')!.textContent = source
    container.append(block)
  }
  return container
}

/** 描き終えるまで待つ。onRendered が呼ばれた回数を返す */
function render(container: HTMLElement, theme: 'light' | 'dark'): Promise<number> {
  let calls = 0
  return new Promise((resolve) => {
    renderDiagrams(container, theme, () => {
      calls++
      setTimeout(() => resolve(calls), 0)
    })
  })
}

describe('renderDiagrams', () => {
  beforeEach(() => {
    fake.ids = []
    fake.sources = []
  })

  it('初めての図は描き終えてから知らせ、描き直しではその場で差し込む。同じ図を 2 回描かない', async () => {
    const first = preview('graph TD\n  A --> B\n')
    await render(first, 'light')
    expect(first.querySelector('svg')).toBeNull()

    const second = preview('graph TD\n  A --> B\n')
    renderDiagrams(second, 'light', () => {
      throw new Error('描いたことのある図で知らせてはいけない')
    })
    expect(second.querySelector('svg')).not.toBeNull()
    expect(second.querySelector('.mermaid-block')?.classList.contains('is-rendered')).toBe(true)
    expect(fake.sources).toEqual(['graph TD\n  A --> B\n'])
    expect(fake.themes.at(-1)).toBe('redux-color')
  })

  it('描いている途中に同じ図をもう一度頼まれても、描くのは 1 回だけ', async () => {
    const drawn = render(preview('graph LR\n  X --> Y\n'), 'light')
    renderDiagrams(preview('graph LR\n  X --> Y\n'), 'light', () => {
      throw new Error('2 回目の依頼では知らせない（1 回目の知らせで描き直される）')
    })
    expect(await drawn).toBe(1)
    expect(fake.sources).toEqual(['graph LR\n  X --> Y\n'])
  })

  it('構文エラーはソースを残したままエラーを出す。エラーも覚えておき、描き直さない', async () => {
    await render(preview('broken graph'), 'light')
    const container = preview('broken graph')
    renderDiagrams(container, 'light', () => {})
    expect(container.querySelector('pre code')?.textContent).toBe('broken graph')
    expect(container.querySelector('.mermaid-error')?.textContent).toBe('Parse error on line 1')
    expect(fake.sources).toEqual(['broken graph'])
  })

  it('テーマが変わると、そのテーマで初期化し直して描く。id は毎回違う', async () => {
    await render(preview('graph TD\n  T --> U\n'), 'light')
    await render(preview('graph TD\n  T --> U\n'), 'dark')
    expect(fake.themes.at(-1)).toBe('redux-dark-color')
    expect(fake.sources).toEqual(['graph TD\n  T --> U\n', 'graph TD\n  T --> U\n'])
    expect(new Set(fake.ids).size).toBe(2)
  })
})
