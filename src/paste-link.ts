import { syntaxTree } from '@codemirror/language'
import type { EditorState, TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

// リンクの先として扱う文字列（前後の空白を除いたもの）。空白を含むものは、文章とみなす
const URL_TEXT = /^(?:https?:\/\/|mailto:|www\.)\S+$/i

// 選択範囲を囲む構文のうち、中にリンクを作れないもの（コード、リンク、画像、URL、HTML など）
const NO_LINK_INSIDE = /code|link|image|url|html|comment|processing|escape|entity/i
// 選択範囲の中に丸ごと入っていてよい構文。リンクの文字は、強調やインラインコードを含められる
const INLINE = /^(?:Emphasis|StrongEmphasis|Strikethrough|InlineCode|EmphasisMark|StrikethroughMark|CodeMark|CodeText|Escape|Entity)$/

/**
 * 選択範囲を、貼り付けた URL へのリンク（[選択範囲](URL)）にする変更。リンクにできないときは null（ふつうに貼り付ける）。
 * lang-markdown の pasteURLAsLink は、選択範囲の端に接しているだけの ** なども「範囲の中の構文」と数えるので、
 * 太字の中の語を選んで貼ると、リンクにならずに語が URL で置き換わる。そのため自前で判定する
 */
export function linkPaste(state: EditorState, text: string): TransactionSpec | null {
  const url = text.trim()
  if (!URL_TEXT.test(url) || state.selection.ranges.length > 1) return null
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)
  // 前後の空白は、リンクの外に残す
  const from = range.from + (selected.length - selected.trimStart().length)
  const to = range.to - (selected.length - selected.trimEnd().length)
  if (from >= to) return null
  // URL を別の URL で置き換えるときは、ふつうに貼り付ける。複数の行にまたがる選択は、段落や表の区切りを壊しうるので扱わない
  if (URL_TEXT.test(state.sliceDoc(from, to)) || state.doc.lineAt(from).number !== state.doc.lineAt(to).number) return null
  if (!linkable(state, from, to)) return null
  const target = /^www\./i.test(url) ? `https://${url}` : url
  // 括弧を含む URL は < > で囲む（閉じ括弧で、リンクの先が途中で終わらないように）
  const close = `](${/[()]/.test(target) ? `<${target}>` : target})`
  return {
    changes: [
      { from, insert: '[' },
      { from: to, insert: close },
    ],
    selection: { anchor: to + 1 + close.length },
    scrollIntoView: true,
    userEvent: 'input.paste',
  }
}

// from から to を、リンクの文字にしてよいか。範囲をまたいで始まるか終わる構文があると、囲んだときに構文が壊れる
function linkable(state: EditorState, from: number, to: number): boolean {
  let ok = true
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      // 範囲の端に接しているだけの構文（**bold** の bold を選んだときの ** など）は関係ない
      if (!ok || node.to <= from || node.from >= to) return false
      const covers = node.from <= from && node.to >= to
      const inside = node.from >= from && node.to <= to
      if (covers ? NO_LINK_INSIDE.test(node.name) : !inside || !INLINE.test(node.name)) ok = false
      return ok
    },
  })
  return ok
}

function handle(view: EditorView, text: string | undefined): boolean {
  const spec = text ? linkPaste(view.state, text) : null
  if (!spec) return false
  view.dispatch(spec)
  return true
}

export const pasteUrlAsLink = [
  EditorView.domEventHandlers({
    paste: (event, view) => handle(view, event.clipboardData?.getData('text/plain')),
  }),
  // Android の Gboard のクリップボードの候補から貼ると、paste イベントではなく、選択範囲を置き換える文字の入力として届く。
  // 1 文字ずつ打つ入力は URL の形にならないので、ここでは扱われない
  EditorView.inputHandler.of((view, from, to, text) => {
    const { main } = view.state.selection
    return from === main.from && to === main.to && from < to && handle(view, text)
  }),
]
