import { element } from './dom'
import { createPopup, type Popup } from './popup'
import type { Heading } from './render'

/** 見出しの一覧のメニュー。開くたびに headings() で見出しを読み直し、選ぶと onSelect(元の行) を呼んで閉じる */
export function createOutlineMenu(button: HTMLButtonElement, headings: () => Heading[], onSelect: (line: number) => void): Popup {
  const popup: Popup = createPopup(button, 'outline-menu', 'Headings', (menu) => {
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
              popup.close()
              onSelect(heading.line)
            })
            return entry
          })
        : [Object.assign(element('div', 'outline-empty'), { textContent: 'No headings' })]),
    )
  })
  return popup
}
