import { element } from './dom'
import type { Heading } from './render'

export interface OutlineMenu {
  /** ツールバー（position: relative）に入れる。ボタンの下に重ねて出す */
  readonly element: HTMLElement
  toggle(): void
}

/**
 * 見出しの一覧のメニュー。開くたびに headings() で見出しを読み直し、選ぶと onSelect(元の行) を呼んで閉じる。
 * 一覧の外を押したとき、Esc、もう一度ボタンを押したときにも閉じる。
 * Popover API は iOS 17 より前で動かないので、ふつうの要素の表示を切り替える
 */
export function createOutlineMenu(button: HTMLButtonElement, headings: () => Heading[], onSelect: (line: number) => void): OutlineMenu {
  const menu = element('div', 'outline-menu')
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', 'Headings')
  menu.hidden = true
  button.setAttribute('aria-haspopup', 'menu')
  button.setAttribute('aria-expanded', 'false')

  const items = () => [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')]

  const onOutside = (event: PointerEvent) => {
    const target = event.target as Node
    if (!menu.contains(target) && !button.contains(target)) close()
  }

  function close(restoreFocus = false) {
    if (menu.hidden) return
    menu.hidden = true
    button.setAttribute('aria-expanded', 'false')
    document.removeEventListener('pointerdown', onOutside, true)
    if (restoreFocus) button.focus()
  }

  function open() {
    const list = headings()
    // 一番浅い見出しを左端にそろえ、深くなるほど字下げする
    const top = Math.min(...list.map((heading) => heading.level))
    menu.replaceChildren(
      ...(list.length > 0
        ? list.map((heading) => {
            const entry = element('button', 'outline-item')
            entry.type = 'button'
            entry.setAttribute('role', 'menuitem')
            entry.textContent = heading.text || '(empty heading)'
            entry.style.paddingInlineStart = `${0.75 + (heading.level - top)}rem`
            entry.addEventListener('click', () => {
              close()
              onSelect(heading.line)
            })
            return entry
          })
        : [Object.assign(element('div', 'outline-empty'), { textContent: 'No headings' })]),
    )
    // ボタンの右端にそろえる（ツールバーの右端からの距離）。狭い画面で左にはみ出すなら、ツールバーの左端に寄せる
    const bar = menu.parentElement
    menu.style.left = ''
    if (bar) menu.style.right = `${bar.getBoundingClientRect().right - button.getBoundingClientRect().right}px`
    menu.hidden = false
    if (bar && menu.getBoundingClientRect().left < bar.getBoundingClientRect().left) {
      menu.style.right = ''
      menu.style.left = '0.5rem'
    }
    button.setAttribute('aria-expanded', 'true')
    document.addEventListener('pointerdown', onOutside, true)
    items()[0]?.focus()
  }

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const entries = items()
    const index = entries.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1
    entries[(next + entries.length) % entries.length]?.focus()
  })

  return {
    element: menu,
    toggle: () => (menu.hidden ? open() : close()),
  }
}
