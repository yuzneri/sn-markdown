import 'sn-extension-api/dist/sn.min.css'
import './style.css'
import { connectNote } from './bridge'
import { createEditor, type MarkdownEditor } from './editor'
import { previewText } from './render'

const app = document.querySelector<HTMLDivElement>('#app')!
let editor: MarkdownEditor | undefined

// エディタは最初のノートを受け取ってから作る。受け取る前に入力されると、sn-extension-api がノートのない状態で保存しようとして例外を投げる
const bridge = connectNote((update) => {
  if (editor) {
    editor.update(update)
  } else {
    editor = createEditor(app, update, (text) => bridge.save(text, previewText(text)))
  }
})
