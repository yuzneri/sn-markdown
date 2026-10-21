// @vitest-environment jsdom
// 見出しの一覧のメニューの開閉と、選んだときの呼び出しを確かめる（位置と見た目は Playwright で確かめる）
import { afterEach, describe, expect, it } from 'vitest'
import { createOutlineMenu } from './outline'
import type { Heading } from './render'

afterEach(() => document.body.replaceChildren())

function setup(list: Heading[]) {
  const bar = document.body.appendChild(document.createElement('div'))
  const button = bar.appendChild(document.createElement('button'))
  const selected: number[] = []
  const menu = createOutlineMenu(button, () => list, (line) => selected.push(line))
  bar.append(menu.element)
  button.addEventListener('click', () => menu.toggle())
  const entries = () => [...menu.element.querySelectorAll<HTMLButtonElement>('[role=menuitem]')]
  return { button, menu, entries, selected }
}

const list: Heading[] = [
  { level: 2, text: 'Intro', line: 0 },
  { level: 3, text: 'Detail', line: 4 },
  { level: 2, text: 'End', line: 9 },
]

describe('createOutlineMenu', () => {
  it('ボタンで開き、見出しを並べ、最初の見出しにフォーカスを移す。一番浅い見出しを左端にそろえる', () => {
    const { button, menu, entries } = setup(list)
    button.click()
    expect(menu.element.hidden).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(entries().map((entry) => [entry.textContent, entry.style.paddingInlineStart])).toEqual([
      ['Intro', '0.75rem'],
      ['Detail', '1.75rem'],
      ['End', '0.75rem'],
    ])
    expect(document.activeElement).toBe(entries()[0])
  })

  it('見出しを選ぶと、その元の行を渡して閉じる', () => {
    const { button, menu, entries, selected } = setup(list)
    button.click()
    entries()[1].click()
    expect(selected).toEqual([4])
    expect(menu.element.hidden).toBe(true)
  })

  it('もう一度ボタンを押す、Esc、一覧の外を押す、のどれでも閉じる', () => {
    const { button, menu } = setup(list)
    button.click()
    button.click()
    expect(menu.element.hidden).toBe(true)

    button.click()
    menu.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(menu.element.hidden).toBe(true)
    expect(document.activeElement).toBe(button)

    button.click()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(menu.element.hidden).toBe(true)
  })

  it('↓ と ↑ でフォーカスを動かし、端では反対の端に回る', () => {
    const { button, menu, entries } = setup(list)
    button.click()
    const press = (key: string) => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    press('ArrowDown')
    expect(document.activeElement).toBe(entries()[1])
    press('ArrowUp')
    press('ArrowUp')
    expect(document.activeElement).toBe(entries()[2])
    expect(menu.element.hidden).toBe(false)
  })

  it('見出しがなければ、そのことを出す', () => {
    const { button, menu, entries } = setup([])
    button.click()
    expect(entries()).toHaveLength(0)
    expect(menu.element.textContent).toBe('No headings')
  })
})
