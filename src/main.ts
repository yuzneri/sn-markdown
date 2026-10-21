import 'sn-extension-api/dist/sn.min.css'
import './style.css'
import './preview.css'
import { watchAppearance } from './appearance'
import { connectNote } from './bridge'
import { renderDiagrams } from './diagram'
import { createEditor, type MarkdownEditor } from './editor'
import { onLanguageLoaded } from './highlight'
import { createLayout, type Layout } from './layout'
import { savedMode, withMode } from './mode'
import { previewText, renderHtml } from './render'

const app = document.querySelector<HTMLDivElement>('#app')!
let editor: MarkdownEditor | undefined
let layout: Layout | undefined
// テーマの明暗。Mermaid の図のテーマに使う（ほかの色はすべて CSS 変数なので、テーマの差し替えだけで追従する）
let appearance = watchAppearance((next) => {
  appearance = next
  renderPreview()
})

// 入力中に毎回描画すると長いノートで入力が重くなるので、手が止まってから描画する
const PREVIEW_DELAY = 100
let previewTimer: ReturnType<typeof setTimeout> | undefined

function schedulePreview(): void {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(renderPreview, PREVIEW_DELAY)
}

function renderPreview(): void {
  clearTimeout(previewTimer)
  // 編集モードではプレビューが見えないので描画しない。モードを切り替えたときに描画する
  if (!editor || !layout || layout.mode === 'edit') return
  layout.showPreview(renderHtml(editor.text))
  renderDiagrams(layout.preview, appearance, renderPreview)
}

// エディタは最初のノートを受け取ってから作る。受け取る前に入力されると、sn-extension-api がノートのない状態で保存しようとして例外を投げる
const bridge = connectNote((update) => {
  if (editor) {
    editor.update(update)
    if (update.text !== undefined) schedulePreview()
    return
  }
  layout = createLayout(app, savedMode(bridge.readPreferences(), bridge.environment), (mode) => {
    bridge.writePreferences(withMode(bridge.readPreferences(), bridge.environment, mode))
    renderPreview()
  })
  onLanguageLoaded(renderPreview)
  editor = createEditor(layout.editorPane, update, (text) => {
    bridge.save(text, previewText(text))
    schedulePreview()
  })
  renderPreview()
})
