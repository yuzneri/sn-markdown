import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { languages } from '@codemirror/language-data'

// 言語名として書ける文字。空白を含む名前（common lisp など）は、最初の語までしか言語名として読まれないので候補にしない
const NAME = /^[\w+#.-]+$/

/**
 * 言語名の候補。言語ごとの名前と別名（alias には小文字にした名前も入っている）を 1 つずつ候補にする。
 * エディタ（codeLanguages）もプレビュー（highlight.ts）も同じ languages から言語を探すので、どれを選んでもハイライトが効く。
 * 同じ名前を持つ言語が複数あれば、探すときと同じく先の言語を採る
 */
export const languageOptions: readonly Completion[] = (() => {
  const options = new Map<string, Completion>()
  for (const description of languages) {
    for (const alias of description.alias) {
      if (NAME.test(alias) && !options.has(alias)) options.set(alias, { label: alias, detail: description.name })
    }
  }
  // Mermaid は language-data にない（図にするのはプレビューの render.ts）
  options.set('mermaid', { label: 'mermaid', detail: 'Mermaid diagram' })
  return [...options.values()]
})()

// 開始フェンス（インデントは 3 つまで。4 つ以上はインデントのコードブロック）と、その後ろの入力中の言語名
const FENCE = /^ {0,3}(?:`{3,}|~{3,})[\w+#.-]*$/

/**
 * コードブロックの開始フェンスの行で、言語名を補完する。
 * 言語名をまだ打っていないときは、明示的に開いたとき（Code block のボタン、Ctrl-Space）だけ候補を出す。
 * 打っただけで開くと、閉じるフェンスを打つたびにも一覧が出てしまう
 */
export function completeCodeLanguage(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(FENCE)
  if (!match) return null
  const from = match.from + /^ *(?:`+|~+)/.exec(match.text)![0].length
  if (from === context.pos && !context.explicit) return null
  return { from, options: languageOptions, validFor: /^[\w+#.-]*$/ }
}
