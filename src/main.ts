import 'sn-extension-api/dist/sn.min.css'
import './style.css'
import './preview.css'
import { watchAppearance } from './appearance'
import { connectNote } from './bridge'
import { renderDiagrams } from './diagram'
import { createEditor, type MarkdownEditor } from './editor'
import { onLanguageLoaded } from './highlight'
import { createLayout, type Layout } from './layout'
import { savedFormatBar, savedMode, withFormatBar, withMode } from './preferences'
import { previewText, renderHtml } from './render'
import { closeDiagramViewer, enableDiagramViewer } from './viewer'

const app = document.querySelector<HTMLDivElement>('#app')!
let editor: MarkdownEditor | undefined
let layout: Layout | undefined
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
  renderDiagrams(layout.preview, appearance, renderPreview)
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
  const preferences = bridge.readPreferences()
  layout = createLayout(app, { mode: savedMode(preferences, environment), formatBar: savedFormatBar(preferences, environment) }, {
    onModeChange(mode) {
      bridge.writePreferences(withMode(bridge.readPreferences(), environment, mode))
      renderPreview()
    },
    onFormatBarToggle(visible) {
      bridge.writePreferences(withFormatBar(bridge.readPreferences(), environment, visible))
    },
    onCommand(command) {
      editor?.run(command)
    },
    onImageFiles(files) {
      editor?.insertImages(files)
    },
  })
  layout.setLocked(update.locked)
  enableDiagramViewer(layout.preview)
  onLanguageLoaded(renderPreview)
  editor = createEditor(layout.editorPane, update, {
    onChange(text) {
      bridge.save(text, previewText(text))
      schedulePreview()
    },
    onError(message) {
      layout?.showMessage(message)
    },
  })
  renderPreview()
})
