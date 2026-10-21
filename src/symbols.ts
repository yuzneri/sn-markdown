import type { StateCommand } from '@codemirror/state'
import { insertSymbol, insertTex } from './commands'
import { element } from './dom'
import { createPopup, type Popup } from './popup'

/** 一覧に出す記号。glyph は見た目（ふつうの文字で出す）、tex は入れる命令。template があれば、ひな形として入れる（insertTex） */
interface MathSymbol {
  glyph: string
  tex: string
  template?: string
}

const symbol = (glyph: string, tex: string, template?: string): MathSymbol => ({ glyph, tex, template })

export const SYMBOL_SECTIONS: { label: string; symbols: MathSymbol[] }[] = [
  {
    label: 'Greek',
    symbols: [
      symbol('α', '\\alpha'),
      symbol('β', '\\beta'),
      symbol('γ', '\\gamma'),
      symbol('δ', '\\delta'),
      symbol('ε', '\\epsilon'),
      symbol('θ', '\\theta'),
      symbol('λ', '\\lambda'),
      symbol('μ', '\\mu'),
      symbol('π', '\\pi'),
      symbol('σ', '\\sigma'),
      symbol('φ', '\\phi'),
      symbol('ω', '\\omega'),
      symbol('Γ', '\\Gamma'),
      symbol('Δ', '\\Delta'),
      symbol('Θ', '\\Theta'),
      symbol('Λ', '\\Lambda'),
      symbol('Σ', '\\Sigma'),
      symbol('Φ', '\\Phi'),
      symbol('Ω', '\\Omega'),
    ],
  },
  {
    label: 'Relations',
    symbols: [
      symbol('≤', '\\le'),
      symbol('≥', '\\ge'),
      symbol('≠', '\\ne'),
      symbol('≈', '\\approx'),
      symbol('≡', '\\equiv'),
      symbol('∝', '\\propto'),
    ],
  },
  {
    label: 'Operators',
    symbols: [
      symbol('±', '\\pm'),
      symbol('×', '\\times'),
      symbol('÷', '\\div'),
      symbol('·', '\\cdot'),
      symbol('∞', '\\infty'),
      symbol('∂', '\\partial'),
      symbol('∇', '\\nabla'),
      symbol('lim', '\\lim', '\\lim_{¦ \\to ‸}'),
    ],
  },
  {
    label: 'Arrows',
    symbols: [symbol('→', '\\to'), symbol('⇒', '\\Rightarrow'), symbol('⇔', '\\Leftrightarrow'), symbol('↦', '\\mapsto')],
  },
  {
    label: 'Sets and logic',
    symbols: [
      symbol('∈', '\\in'),
      symbol('∉', '\\notin'),
      symbol('⊂', '\\subset'),
      symbol('⊆', '\\subseteq'),
      symbol('∪', '\\cup'),
      symbol('∩', '\\cap'),
      symbol('∅', '\\emptyset'),
      symbol('∀', '\\forall'),
      symbol('∃', '\\exists'),
      symbol('¬', '\\neg'),
      symbol('∧', '\\land'),
      symbol('∨', '\\lor'),
    ],
  },
]

/** 記号の一覧（数式の組の Symbols ボタン）。選ぶと onCommand に記号を入れるコマンドを渡して閉じる */
export function createSymbolMenu(button: HTMLButtonElement, onCommand: (command: StateCommand) => void): Popup {
  const popup: Popup = createPopup(button, 'symbol-menu', 'Symbols', (menu) => {
    if (menu.childElementCount > 0) return
    for (const section of SYMBOL_SECTIONS) {
      const group = element('div', 'symbol-group')
      group.setAttribute('role', 'group')
      group.setAttribute('aria-label', section.label)
      const heading = element('div', 'symbol-heading')
      heading.textContent = section.label
      heading.setAttribute('aria-hidden', 'true')
      const grid = element('div', 'symbol-grid')
      for (const item of section.symbols) {
        const entry = element('button', 'symbol-item')
        entry.type = 'button'
        entry.setAttribute('role', 'menuitem')
        entry.textContent = item.glyph
        entry.title = item.tex
        entry.setAttribute('aria-label', item.tex)
        // エディタのフォーカスと選択範囲を保つ（選んだ文字を、記号で置き換えられるように）
        entry.addEventListener('mousedown', (event) => event.preventDefault())
        entry.addEventListener('click', () => {
          popup.close()
          onCommand(item.template ? insertTex(item.template) : insertSymbol(item.tex))
        })
        grid.append(entry)
      }
      group.append(heading, grid)
      menu.append(group)
    }
  })
  return popup
}
