import { ensureSyntaxTree } from '@codemirror/language'
import type { EditorState, TransactionSpec } from '@codemirror/state'

/**
 * line 行目（0 始まり。プレビューの data-line）のタスクのチェック（[ ] と [x]）を切り替える変更。
 * タスクの記号は構文木（TaskMarker）で探すので、引用やリストの字下げの中でも、コードブロックの中の [ ] と取り違えない。
 * 行にタスクがないとき、ロック中は null
 */
export function toggleTask(state: EditorState, line: number): TransactionSpec | null {
  if (state.readOnly || !Number.isInteger(line) || line < 0 || line >= state.doc.lines) return null
  const { from, to } = state.doc.line(line + 1)
  const tree = ensureSyntaxTree(state, to, 50)
  if (!tree) return null
  let marker: { from: number; to: number } | null = null
  tree.iterate({
    from,
    to,
    enter: (node) => {
      if (node.name === 'TaskMarker' && node.from >= from) marker = { from: node.from, to: node.to }
      return !marker
    },
  })
  // コールバックの中での代入は型の絞り込みに反映されないので、型を付け直す
  const found = marker as { from: number; to: number } | null
  if (!found) return null
  const checked = state.sliceDoc(found.from + 1, found.to - 1).trim() !== ''
  return { changes: { from: found.from + 1, to: found.to - 1, insert: checked ? ' ' : 'x' }, userEvent: 'input' }
}

/**
 * プレビューのタスクのチェックボックスを押したら、元の行のチェックを切り替える（toggle）。
 * 切り替えたら、チェックボックスの見た目はそのままにし、描き直しで本文と同じ状態になる。
 * 切り替えられなければ（ロック中、行が見つからない）、押した見た目を元に戻す
 */
export function enableTaskToggle(preview: HTMLElement, toggle: (line: number) => boolean): void {
  preview.addEventListener('click', (event) => {
    const box = event.target
    if (!(box instanceof HTMLInputElement) || !box.matches('.task-list-item-checkbox')) return
    // 項目（li）の data-line は、その項目の最初の行。タスクの記号はその行にある
    const line = Number(box.closest('li[data-line]')?.getAttribute('data-line'))
    if (!toggle(line)) event.preventDefault()
  })
}
