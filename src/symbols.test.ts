// @vitest-environment jsdom
// 記号の一覧のメニューを開き、選んだ記号のコマンドが本文に入れるものを確かめる
import { afterEach, describe, expect, it } from 'vitest'
import { EditorState, type StateCommand } from '@codemirror/state'
import { createSymbolMenu, SYMBOL_SECTIONS } from './symbols'

afterEach(() => document.body.replaceChildren())

function setup() {
  const bar = document.body.appendChild(document.createElement('div'))
  const button = bar.appendChild(document.createElement('button'))
  const commands: StateCommand[] = []
  const menu = createSymbolMenu(button, (command) => commands.push(command))
  bar.append(menu.element)
  const entries = () => [...menu.element.querySelectorAll<HTMLButtonElement>('[role=menuitem]')]
  return { menu, entries, commands }
}

/** command を `|` の位置で実行した後の本文 */
function apply(command: StateCommand, doc: string): string {
  let state = EditorState.create({ doc: doc.replace('|', ''), selection: { anchor: doc.indexOf('|') } })
  command({ state, dispatch: (tr) => (state = tr.state) })
  return state.doc.toString()
}

describe('createSymbolMenu', () => {
  it('組ごとに記号を並べ、開くと最初の記号にフォーカスを移す', () => {
    const { menu, entries } = setup()
    menu.toggle()
    expect([...menu.element.querySelectorAll('[role=group]')].map((group) => group.getAttribute('aria-label'))).toEqual(SYMBOL_SECTIONS.map((section) => section.label))
    expect(entries()).toHaveLength(SYMBOL_SECTIONS.reduce((sum, section) => sum + section.symbols.length, 0))
    expect(document.activeElement).toBe(entries()[0])
    expect(entries()[0].textContent).toBe('α')
  })

  it('記号を選ぶと、その命令を入れるコマンドを渡して閉じる。lim はひな形として入れる', () => {
    const { menu, entries, commands } = setup()
    menu.toggle()
    entries().find((entry) => entry.textContent === '≤')!.click()
    expect(menu.element.hidden).toBe(true)
    menu.toggle()
    entries().find((entry) => entry.textContent === 'lim')!.click()
    expect(commands.map((command) => apply(command, '$|$'))).toEqual(['$\\le$', '$\\lim_{ \\to }$'])
  })

  it('← と → でもフォーカスを動かす（横に並ぶので）', () => {
    const { menu, entries } = setup()
    menu.toggle()
    const press = (key: string) => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    press('ArrowRight')
    expect(document.activeElement).toBe(entries()[1])
    press('ArrowLeft')
    press('ArrowLeft')
    expect(document.activeElement).toBe(entries()[entries().length - 1])
  })
})
