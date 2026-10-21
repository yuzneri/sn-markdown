import 'sn-extension-api/dist/sn.min.css'
import './style.css'
import { connectNote } from './bridge'

const app = document.querySelector<HTMLDivElement>('#app')!
const textarea = document.createElement('textarea')
textarea.className = 'editor'
textarea.spellcheck = false
app.append(textarea)

const bridge = connectNote(({ text, locked }) => {
  if (text !== undefined) textarea.value = text
  textarea.readOnly = locked
})

textarea.addEventListener('input', () => bridge.save(textarea.value))
