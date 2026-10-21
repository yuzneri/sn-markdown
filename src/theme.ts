import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

// 色はすべて SN のテーマ変数で書く。SN はテーマを切り替えるとき iframe 内のテーマの link を差し替えるだけなので、
// 変数で書いておけば JS なしで追従する。使うのは、既定値と公式のダーク系テーマの両方が定義している info / success / danger / neutral だけにする。
// warning（既定は #EBAD00）は白地で読めないので文字色に使わない
export const highlightStyle = HighlightStyle.define([
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
  // 左には折りたたみの印の列があるので、行の左の余白は小さくする
  '.cm-line': { padding: '0 1rem 0 0.25rem' },
  // 折りたたみの印の列（foldGutter）。既定は灰色の地と境界線なので、本文の地に溶け込ませる
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--sn-stylekit-neutral-color)' },
  '.cm-foldGutter .cm-gutterElement': { paddingLeft: '0.5rem' },
  '.cm-foldMarker': { display: 'inline-flex', height: '100%', alignItems: 'center', opacity: '0.6', cursor: 'pointer' },
  '.cm-foldMarker:hover': { opacity: '1' },
  // タッチの端末では、押す場所を大きくする（CodeMirror は自分のスタイルを後から足すので、style.css ではなくここに書く）
  '@media (pointer: coarse)': {
    '.cm-foldGutter .cm-gutterElement': { minWidth: '1.75rem', paddingLeft: '0', textAlign: 'center' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '0.5em 0.6em' },
  },
  // 畳んだところ（…）。押すと開く
  '.cm-foldPlaceholder': {
    border: 'none',
    borderRadius: '3px',
    padding: '0 0.4em',
    backgroundColor: 'var(--sn-stylekit-contrast-background-color)',
    color: 'var(--sn-stylekit-neutral-color)',
  },
  // 埋め込んだ画像の data: URL を折りたたんだ表示（data-url.ts）
  '.cm-data-url': {
    padding: '0 0.4em',
    borderRadius: '3px',
    background: 'var(--sn-stylekit-contrast-background-color)',
    color: 'var(--sn-stylekit-neutral-color)',
    fontSize: '0.85em',
  },
  // 言語名の補完の一覧（code-language.ts）。既定の色はライトの固定値
  '.cm-tooltip': {
    border: '1px solid var(--sn-stylekit-border-color)',
    backgroundColor: 'var(--sn-stylekit-background-color)',
    color: 'var(--sn-stylekit-foreground-color)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: 'var(--sn-stylekit-info-color)',
    color: 'var(--sn-stylekit-info-contrast-color)',
  },
  '.cm-completionDetail': { color: 'var(--sn-stylekit-neutral-color)' },
  '.cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail': { color: 'inherit' },
  // 検索・置換のパネル（@codemirror/search）。既定の色はライトの固定値で、ボタンはグラデーション
  '.cm-panels': { backgroundColor: 'var(--sn-stylekit-background-color)', color: 'var(--sn-stylekit-foreground-color)' },
  '.cm-panels-top': { borderBottom: '1px solid var(--sn-stylekit-border-color)' },
  '.cm-textfield': {
    border: '1px solid var(--sn-stylekit-border-color)',
    borderRadius: '4px',
    backgroundColor: 'var(--sn-stylekit-editor-background-color)',
    fontSize: '85%',
  },
  '.cm-button': {
    border: '1px solid var(--sn-stylekit-border-color)',
    borderRadius: '4px',
    backgroundImage: 'none',
    backgroundColor: 'var(--sn-stylekit-contrast-background-color)',
    fontSize: '85%',
  },
  // 一致した箇所は info の色を薄く、いま選んでいる一致は濃くする（warning はダーク系のテーマで定義されていないことがある）
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--sn-stylekit-info-color) 20%, transparent)' },
  '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--sn-stylekit-info-color) 45%, transparent)' },
})

export const editorTheme = [editorStyle, syntaxHighlighting(highlightStyle)]
