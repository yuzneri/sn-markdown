// Standard Notes 親アプリの代役。packages/snjs/lib/Services/ComponentManager/ComponentViewer.ts のメッセージ形式を模している。
// プラグイン単体を SN なしで動かし、読み込み・保存・同期エコー・ロック・テーマ・全体設定の往復を確かめるための開発専用ページ。

interface ComponentMessage {
  action: string
  data: Record<string, unknown>
  messageId?: string
  sessionKey?: string
  componentData?: Record<string, unknown>
  original?: ComponentMessage
}

interface NoteContent {
  title: string
  text: string
  preview_plain?: string
  references: unknown[]
  appData: Record<string, Record<string, unknown>>
  [key: string]: unknown
}

interface HarnessState {
  note: NoteContent
  componentData: Record<string, unknown>
}

const STORAGE_KEY = 'sn-markdown-harness'
const NOTE_UUID = '00000000-0000-4000-8000-000000000001'
const COMPONENT_UUID = '00000000-0000-4000-8000-000000000002'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const frame = $<HTMLIFrameElement>('frame')
const environmentSelect = $<HTMLSelectElement>('environment')
const themeSelect = $<HTMLSelectElement>('theme')
const lockedCheckbox = $<HTMLInputElement>('locked')
const echoCheckbox = $<HTMLInputElement>('echo')
const savedView = $<HTMLTextAreaElement>('saved')
const externalInput = $<HTMLTextAreaElement>('external')
const componentDataView = $<HTMLTextAreaElement>('componentData')
const logView = $<HTMLPreElement>('log')

// ?src=<URL> で、ビルド済みのプラグイン（vite preview や公開先）を読み込める
const srcOverride = new URLSearchParams(location.search).get('src')
if (srcOverride) frame.setAttribute('src', srcOverride)

let state = loadState()
let sessionKey = ''
let streamMessage: ComponentMessage | undefined

function initialState(): HarnessState {
  return {
    note: {
      title: 'Harness note',
      text: '# Hello\n\nThis is a **harness** note.\n',
      references: [],
      appData: { 'org.standardnotes.sn': {} },
      editorIdentifier: 'dev.harness.sn-markdown',
    },
    componentData: {},
  }
}

function loadState(): HarnessState {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as HarnessState) : initialState()
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  savedView.value = state.note.text
  componentDataView.value = JSON.stringify(state.componentData)
  lockedCheckbox.checked = state.note.appData['org.standardnotes.sn']?.locked === true
}

function log(direction: '→' | '←', message: ComponentMessage): void {
  const summary = JSON.stringify(message.data).slice(0, 160)
  logView.textContent = `${direction} ${message.action} ${summary}\n` + (logView.textContent ?? '')
}

function post(message: ComponentMessage): void {
  log('→', message)
  // SN はモバイルのときだけ JSON 文字列で送る（ComponentViewer.sendMessage）
  frame.contentWindow?.postMessage(environmentSelect.value === 'mobile' ? JSON.stringify(message) : message, '*')
}

function themeUrls(): string[] {
  return themeSelect.value === 'dark' ? [new URL('./dark-theme.css', location.href).href] : []
}

function streamNote(content: NoteContent, isMetadataUpdate: boolean): void {
  if (!streamMessage) return
  const item = {
    uuid: NOTE_UUID,
    content_type: 'Note',
    created_at: '2026-10-21T00:00:00.000Z',
    updated_at: new Date().toISOString(),
    isMetadataUpdate,
    content: { ...structuredClone(content), spellcheck: true },
    clientData: {},
  }
  post({ action: 'reply', data: { item }, original: streamMessage })
}

function handleMessage(message: ComponentMessage): void {
  switch (message.action) {
    case 'stream-context-item':
      streamMessage = message
      streamNote(state.note, false)
      break
    case 'save-items': {
      const [item] = message.data.items as { content: NoteContent }[]
      state.note = item.content
      persist()
      post({ action: 'reply', data: {}, original: message })
      if (echoCheckbox.checked) {
        // 同期完了（RemoteSaved）の再送を模す。中身は保存した時点の本文で、その後さらに入力していれば古い本文になる。
        // isMetadataUpdate: true なので sn-extension-api が捨て、エディタが古い本文に戻らないことを確かめられる
        const snapshot = structuredClone(item.content)
        setTimeout(() => streamNote(snapshot, true), 1000)
      }
      break
    }
    case 'set-component-data':
      state.componentData = message.data.componentData as Record<string, unknown>
      persist()
      break
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return
  const message = (typeof event.data === 'string' ? JSON.parse(event.data) : event.data) as ComponentMessage
  if (message.sessionKey !== sessionKey) return
  log('←', message)
  handleMessage(message)
})

frame.addEventListener('load', () => {
  sessionKey = crypto.randomUUID()
  streamMessage = undefined
  post({
    action: 'component-registered',
    sessionKey,
    componentData: state.componentData,
    data: { uuid: COMPONENT_UUID, environment: environmentSelect.value, platform: 'linux', activeThemeUrls: themeUrls() },
  })
  post({ action: 'themes', data: { themes: themeUrls() } })
})

// sandbox の iframe は別 origin 扱いで contentWindow.location に触れないので、src の再代入で読み直す
const reloadFrame = () => frame.setAttribute('src', frame.getAttribute('src') ?? '/')

environmentSelect.addEventListener('change', reloadFrame)
themeSelect.addEventListener('change', () => post({ action: 'themes', data: { themes: themeUrls() } }))
lockedCheckbox.addEventListener('change', () => {
  state.note.appData['org.standardnotes.sn'] = { ...state.note.appData['org.standardnotes.sn'], locked: lockedCheckbox.checked }
  persist()
  streamNote(state.note, false)
})
$<HTMLButtonElement>('push').addEventListener('click', () => {
  state.note.text = externalInput.value
  persist()
  streamNote(state.note, false)
})
$<HTMLButtonElement>('reset').addEventListener('click', () => {
  state = initialState()
  persist()
  reloadFrame()
})

persist()
