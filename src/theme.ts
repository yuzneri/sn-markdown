import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

// 色はすべて SN のテーマ変数で書く。SN はテーマを切り替えるとき iframe 内のテーマの link を差し替えるだけなので、
// 変数で書いておけば JS なしで追従する。使うのは、既定値と公式のダーク系テーマの両方が定義している info / success / danger / neutral だけにする。
// warning（既定は #EBAD00）は白地で読めないので文字色に使わない
const highlightStyle = HighlightStyle.define([
  { tag: t.heading, fontWeight: 'bold', color: 'var(--sn-stylekit-info-color)' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.quote, fontStyle: 'italic' },
  { tag: [t.link, t.labelName], color: 'var(--sn-stylekit-info-color)' },
  { tag: t.url, color: 'var(--sn-stylekit-neutral-color)', textDecoration: 'underline' },
  { tag: t.monospace, color: 'var(--sn-stylekit-success-color)' },
  // 記法の記号（# * ` > - など）は控えめにして本文を目立たせる
  { tag: [t.processingInstruction, t.contentSeparator, t.comment, t.meta], color: 'var(--sn-stylekit-neutral-color)' },
  // ここから下はコードブロック内の言語用
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword], color: 'var(--sn-stylekit-info-color)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--sn-stylekit-success-color)' },
  { tag: [t.number, t.bool, t.null, t.typeName, t.className, t.tagName, t.invalid], color: 'var(--sn-stylekit-danger-color)' },
  // atom はタスクの [x] にも付く（@lezer/markdown の TaskMarker）。danger だとエラーに見えるので info にする
  { tag: [t.atom, t.attributeName, t.propertyName], color: 'var(--sn-stylekit-info-color)' },
])

// CodeMirror は自分のスタイルを実行時に head へ追加するので、style.css ではなくテーマとして書かないと詳細度が同じでも負ける
const editorStyle = EditorView.theme({
  '&': {
    flex: '1',
    minHeight: '0',
    color: 'var(--sn-stylekit-editor-foreground-color)',
    fontSize: 'var(--sn-stylekit-font-size-editor)',
  },
  // 既定のフォーカス枠（点線）は iframe 全体を囲んで目障りなので消す。キャレットでフォーカスは分かる
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--sn-stylekit-monospace-font)',
    scrollbarColor: 'var(--sn-stylekit-scrollbar-thumb-color) transparent',
  },
  // 既定のキャレット色は黒（ライト）か白（ダーク）の固定値
  '.cm-content': { padding: '1rem 0', caretColor: 'var(--sn-stylekit-editor-foreground-color)' },
  '.cm-line': { padding: '0 1rem' },
})

export const editorTheme = [editorStyle, syntaxHighlighting(highlightStyle)]
