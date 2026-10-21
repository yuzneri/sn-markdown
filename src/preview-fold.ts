import { ChevronDown, ChevronRight, createElement } from 'lucide'
import { element } from './dom'

const HEADING = /^H([1-6])$/

/**
 * プレビューの見出しを、エディタで畳んでいるもの（folded の行。0 始まり）に合わせて畳む。畳むのは見出しだけで、
 * 畳んだ見出しの後ろの要素を、次の同じか上の階層の見出しまで隠す。プレビューは打つたびに描き直すので、描き直すたびに呼ぶ。
 * 見出しには、畳む・開くボタンを付ける（押すとエディタの折りたたみを切り替える。enablePreviewFold）
 */
export function applyPreviewFolds(preview: HTMLElement, folded: Set<number>): void {
  // 隠している間は、この階層より深い見出しも隠す。0 なら隠していない
  let hiding = 0
  for (const child of preview.children) {
    const block = child as HTMLElement
    const match = HEADING.exec(block.tagName)
    const level = match ? Number(match[1]) : 0
    if (match && hiding && level <= hiding) hiding = 0
    block.hidden = hiding > 0
    if (!match || hiding) continue
    const isFolded = folded.has(Number(block.dataset.line))
    setButton(block, isFolded)
    block.classList.toggle('is-folded', isFolded)
    if (isFolded) hiding = level
  }
}

function setButton(heading: HTMLElement, folded: boolean): void {
  let button = heading.querySelector<HTMLButtonElement>(':scope > .heading-fold')
  if (!button) {
    button = element('button', 'heading-fold')
    button.type = 'button'
    heading.prepend(button)
  }
  const label = folded ? 'Unfold heading' : 'Fold heading'
  if (button.getAttribute('aria-label') === label) return
  button.setAttribute('aria-label', label)
  button.title = label
  button.setAttribute('aria-expanded', String(!folded))
  button.replaceChildren(createElement(folded ? ChevronRight : ChevronDown, { width: 14, height: 14, 'aria-hidden': 'true' }))
}

/** 見出しのボタンを押したら、その見出しの元の行（data-line）で toggle を呼ぶ */
export function enablePreviewFold(preview: HTMLElement, toggle: (line: number) => void): void {
  preview.addEventListener('click', (event) => {
    const button = (event.target as Element).closest?.('.heading-fold')
    const heading = button?.parentElement
    if (!button || !heading || !preview.contains(heading)) return
    event.preventDefault()
    toggle(Number(heading.dataset.line))
  })
}
