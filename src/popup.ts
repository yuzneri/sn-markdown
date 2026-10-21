import { element } from './dom'

export interface Popup {
  /** ツールバー（position: relative）に入れる。ボタンの下に重ねて出す */
  readonly element: HTMLElement
  toggle(): void
  close(): void
}

/**
 * ボタンの下に重ねて開く一覧（見出しの一覧など）。開くたびに fill で中身を作り直し、最初の項目（role=menuitem）にフォーカスを移す。
 * 一覧の外を押したとき、Esc、もう一度ボタンを押したときに閉じる。↑↓（と、記号の一覧のように横にも並ぶもののために ←→）で
 * 項目のフォーカスを動かし、端では反対の端に回る。
 * Popover API は iOS 17 より前で動かないので、ふつうの要素の表示を切り替える
 */
export function createPopup(button: HTMLButtonElement, className: string, label: string, fill: (menu: HTMLElement) => void): Popup {
  const menu = element('div', `popup ${className}`)
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', label)
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
    fill(menu)
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
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const entries = items()
    const next = entries.indexOf(document.activeElement as HTMLElement) + step
    entries[(next + entries.length) % entries.length]?.focus()
  })

  return {
    element: menu,
    toggle: () => (menu.hidden ? open() : close()),
    close: () => close(),
  }
}
