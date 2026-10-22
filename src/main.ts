import 'sn-extension-api/dist/sn.min.css'
import './style.css'
import './preview.css'
import { watchAppearance } from './appearance'
import { connectNote } from './bridge'
import { renderDiagrams } from './diagram'
import { createEditor, type MarkdownEditor } from './editor'
import { onLanguageLoaded } from './highlight'
import { createLayout, type Layout } from './layout'
import { renderMath } from './math'
import { savedMode, withMode } from './preferences'
import { headings, previewText, renderHtml } from './render'
import { applyPreviewFolds, enablePreviewFold } from './preview-fold'
import { enablePreviewJump } from './preview-jump'
import { enableScrollSync, type ScrollSync } from './scroll-sync'
import { enableTaskToggle } from './task'
import { closeDiagramViewer, enableDiagramViewer } from './viewer'

const app = document.querySelector<HTMLDivElement>('#app')!
let editor: MarkdownEditor | undefined
let layout: Layout | undefined
let scrollSync: ScrollSync | undefined
// テーマの明暗。Mermaid の図のテーマに使う（ほかの色はすべて CSS 変数なので、テーマの差し替えだけで追従する）
let appearance = watchAppearance((next) => {
  appearance = next
  closeDiagramViewer()
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
  applyPreviewFolds(layout.preview, editor.foldedLines())
  renderDiagrams(layout.preview, appearance, renderPreview)
  renderMath(layout.preview, renderPreview)
  scrollSync?.refresh()
}

// エディタの外（プレビュー、バー、ロック中のエディタ）にファイルを落とすと、ブラウザが iframe でそのファイルを開いてしまう。
// window でも受けて、エディタのカーソルの位置に入れる（エディタの上に落としたものは、エディタが先に受けている）
const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
window.addEventListener('dragover', (event) => {
  if (hasFiles(event)) event.preventDefault()
})
window.addEventListener('drop', (event) => {
  if (!hasFiles(event) || event.defaultPrevented) return
  event.preventDefault()
  editor?.insertImages([...(event.dataTransfer?.files ?? [])])
})

// エディタは最初のノートを受け取ってから作る。受け取る前に入力されると、sn-extension-api がノートのない状態で保存しようとして例外を投げる
const bridge = connectNote((update) => {
  if (editor) {
    editor.update(update)
    layout?.setLocked(update.locked)
    if (update.text !== undefined) schedulePreview()
    return
  }
  const environment = bridge.environment
  layout = createLayout(app, savedMode(bridge.readPreferences(), environment), {
    onModeChange(mode) {
      bridge.writePreferences(withMode(bridge.readPreferences(), environment, mode))
      renderPreview()
    },
    onCommand(command) {
      editor?.run(command)
    },
    onImageFiles(files) {
      editor?.insertImages(files)
    },
    onSearch() {
      editor?.toggleSearch()
    },
    headings: () => (editor ? headings(editor.text) : []),
    onHeading(line) {
      // 見えている側だけを動かす。Split では両方を動かすので、スクロール同期がどちらを起点にしても同じ見出しになる
      if (layout?.mode !== 'preview') editor?.revealLine(line)
      if (layout?.mode !== 'edit') layout?.scrollPreviewToLine(line)
    },
  })
  layout.setLocked(update.locked)
  enableDiagramViewer(layout.preview)
  enableTaskToggle(layout.preview, (line) => editor?.toggleTask(line) ?? false)
  enablePreviewFold(layout.preview, (line) => editor?.toggleFold(line))
  enablePreviewJump(
    layout.preview,
    () => editor?.text.split('\n') ?? [],
    ({ line, column }) => {
      // Preview のモードではエディタが見えないので、Edit のモードにする（Split ではそのまま）
      if (layout?.mode === 'preview') layout.selectMode('edit')
      editor?.select(line, column)
    },
  )
  onLanguageLoaded(renderPreview)
  editor = createEditor(layout.editorPane, update, {
    onChange(text) {
      bridge.save(text, previewText(text))
      schedulePreview()
    },
    onError(message) {
      layout?.showMessage(message)
    },
    onContextChange(context) {
      layout?.setContext(context)
    },
    // エディタで畳む・開くと、プレビューの見出しも畳み直す（打って描き直すときは renderPreview が畳み直す）
    onFoldsChange() {
      if (!editor || !layout || layout.mode === 'edit') return
      applyPreviewFolds(layout.preview, editor.foldedLines())
      scrollSync?.refresh()
    },
  })
  scrollSync = enableScrollSync({
    editor,
    editorPane: layout.editorPane,
    previewScroller: layout.previewScroller,
    preview: layout.preview,
    enabled: () => layout?.mode === 'split',
  })
  renderPreview()
})
