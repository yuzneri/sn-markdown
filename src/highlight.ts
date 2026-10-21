import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { highlightCode } from '@lezer/highlight'
import { highlightStyle } from './theme'

const listeners = new Set<() => void>()
const loading = new Set<LanguageDescription>()

/** コードブロックの言語の読み込みが終わったときに呼ぶ。読み込み前に描いたプレビューはハイライトがないので描き直す */
export function onLanguageLoaded(listener: () => void): void {
  listeners.add(listener)
}

/**
 * プレビューのコードブロックをハイライトした HTML（markdown-it の highlight 用）。
 * エディタと同じパーサーとハイライトの規則を使うので、色もエディタと同じテーマ変数になる。
 * 空文字を返すと、markdown-it はハイライトせずにエスケープだけして表示する
 */
export function highlightToHtml(code: string, lang: string, escape: (text: string) => string): string {
  const description = lang ? LanguageDescription.matchLanguageName(languages, lang, true) : null
  if (!description) return ''
  if (!description.support) {
    // 言語ごとに別のチャンクなので、初めて使う言語は非同期に読み込む。描き直しが重ならないよう、1 言語につき 1 回だけ待つ
    if (!loading.has(description)) {
      loading.add(description)
      description.load().then(
        () => listeners.forEach((listener) => listener()),
        (error: unknown) => console.error(`コードブロックの言語（${description.name}）を読み込めませんでした`, error),
      )
    }
    return ''
  }

  // クラス名は highlightStyle が生成したもの。その CSS はエディタ（syntaxHighlighting）が文書に追加している
  let html = ''
  highlightCode(
    code,
    description.support.language.parser.parse(code),
    highlightStyle,
    (text, classes) => {
      html += classes ? `<span class="${classes}">${escape(text)}</span>` : escape(text)
    },
    () => {
      html += '\n'
    },
  )
  return html
}
