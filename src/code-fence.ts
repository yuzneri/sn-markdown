import { ensureSyntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

// Android（Gboard）は、ふつうに打つときにも変換の開始（compositionstart）を起こすので、変換中（composing）だけを見る。
// @codemirror/autocomplete の closeBrackets と同じ判定
const android = typeof navigator === 'object' && /Android\b/.test(navigator.userAgent)

// 行頭（インデントは 3 つまで）の、ちょうど 3 つの ``` か ~~~。code-language.ts の FENCE と違って言語名は含めない（打った瞬間だけを見る）。
// 4 つ目を打っても、もう一度は入れない
const OPENING = /^( {0,3})(```|~~~)$/

/**
 * 空の行で ``` を打つと、次の行に閉じるフェンスを入れる。カーソルは開始フェンスの後ろに残す（Code block ボタンと同じ形）。
 * 入れないのは、コードブロックの中で打ったとき（閉じるフェンスを打っている）と、次の行に文字があるとき（既存の行を囲もうとしている）
 */
export const closeCodeFence = EditorView.inputHandler.of((view, from, to, text) => {
  if ((android ? view.composing : view.compositionStarted) || view.state.readOnly) return false
  const { state } = view
  const range = state.selection.main
  if (state.selection.ranges.length > 1 || from !== range.from || to !== range.to || from !== to) return false
  const line = state.doc.lineAt(from)
  const match = OPENING.exec(state.sliceDoc(line.from, from) + text)
  if (!match || from !== line.to) return false
  const next = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null
  if (next?.text.trim() || inCodeBlock(state, line.from)) return false
  const [, indent, fence] = match
  // 打った文字と閉じるフェンスを 1 つのトランザクションにする（1 回の取り消しで両方が消え、保存も 1 回で済む）
  view.dispatch({
    changes: { from, insert: `${text}\n${indent}${fence}` },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
    userEvent: 'input.type',
  })
  return true
})

// pos（行頭）が、前の行から続くコードブロックの中にあるか。閉じていないブロックは、文書の末尾まで続く
function inCodeBlock(state: EditorState, pos: number): boolean {
  const tree = ensureSyntaxTree(state, pos, 50)
  // 構文木が間に合わなければ、閉じるフェンスを打っているのかもしれないので、入れない側に倒す
  if (!tree) return true
  let inside = false
  tree.iterate({
    from: pos,
    to: pos,
    enter: (node) => {
      if (node.name === 'FencedCode' && node.from < pos) inside = true
    },
  })
  return inside
}
