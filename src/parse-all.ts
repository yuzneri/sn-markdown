// 作った直後の構文木は、解析の時間の上限（20ms。ensureSyntaxTree で待つところでも 50ms）で途中までのことがある
// （テストを並べて動かして重いときなど）。画面では、残りは後から解析され、操作するころには済んでいるが、
// テストは作ってすぐに構文木を読むので、最後まで解析しておく。テストからだけ読み込む
import { ensureSyntaxTree, forceParsing } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

const TIMEOUT = 5000

/** 構文木を最後まで解析した state を返す */
export function parsed(state: EditorState): EditorState {
  if (!ensureSyntaxTree(state, state.doc.length, TIMEOUT)) throw new Error('構文木を最後まで解析できなかった')
  // 進めた解析は、次の state から syntaxTree に入る
  return state.update({}).state
}

/** エディタの構文木を最後まで解析する */
export function parseAll(view: EditorView): void {
  if (!forceParsing(view, view.state.doc.length, TIMEOUT)) throw new Error('構文木を最後まで解析できなかった')
}
