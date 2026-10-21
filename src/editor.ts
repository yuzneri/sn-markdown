import { Compartment, EditorState, Transaction, type ChangeSpec, type Extension, type TransactionSpec } from '@codemirror/state'
import { EditorView, keymap, type Command } from '@codemirror/view'
import { autocompletion } from '@codemirror/autocomplete'
import { closeSearchPanel, openSearchPanel, search, searchKeymap, searchPanelOpen } from '@codemirror/search'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { foldGutter, foldKeymap } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { ChevronDown, ChevronRight, createElement } from 'lucide'
import type { NoteUpdate } from './bridge'
import { closeCodeFence } from './code-fence'
import { completeCodeLanguage } from './code-language'
import { formatKeymap } from './commands'
import { collapseDataUrls } from './data-url'
import { pasteHtmlAsMarkdown } from './html-paste'
import { imageInsertion } from './image-insert'
import { inMath } from './math-context'
import { pasteUrlAsLink } from './paste-link'
import { isInTable } from './table'
import { tableKeymap } from './table-commands'
import { toggleTask } from './task'
import { editorTheme } from './theme'

export interface MarkdownEditor {
  readonly text: string
  /** スクロールする要素と行数（スクロール同期で使う） */
  readonly scroller: HTMLElement
  readonly lineCount: number
  /** 表示している先頭の行（0 始まり、小数で行の中の位置も表す） */
  topLine(): number
  /** line（0 始まり、小数を含む）が表示の先頭に来るようにスクロールする（スクロール同期用。すぐに動かす） */
  scrollToLine(line: number): void
  /**
   * line（0 始まり）を表示の一番上にスクロールする（見出しへのジャンプ用）。まだ描いていない行は高さが推定なので、
   * scrollToLine だと描いた後にずれる。CodeMirror に高さを測ってから動かさせる
   */
  revealLine(line: number): void
  /** 外部（他端末など）からの本文の変更とロックの状態を反映する。本文の変更は保存も履歴への追加もしない */
  update(update: NoteUpdate): void
  /** 画像をカーソルの位置に埋め込む */
  insertImages(files: File[]): void
  /** 書式のコマンドを実行し、エディタにフォーカスを戻す（ボタンから続けて入力できるように） */
  run(command: Command): void
  /** 検索・置換のパネルを開く（開いていれば閉じる） */
  toggleSearch(): void
  /** line 行目（0 始まり）のタスクのチェックを切り替える。行にタスクがないとき、ロック中は false */
  toggleTask(line: number): boolean
}

/** カーソルのある場所の種類。書式バーは、数式の中なら数式の組、表の中なら表の組、それ以外ならブロックの組を出す */
export type CursorContext = 'table' | 'math' | null

// 表のセルの中の数式では、数式の組を出す（式を書いている間は、式のボタンのほうが要る）
function cursorContext(state: EditorState): CursorContext {
  const head = state.selection.main.head
  return inMath(state, head) ? 'math' : isInTable(state, head) ? 'table' : null
}

export interface EditorHandlers {
  /** ユーザーの編集で本文が変わった */
  onChange(text: string): void
  /** 画像を入れられなかったなど、ユーザーに知らせること */
  onError(message: string): void
  /** カーソルのある場所の種類が変わった（書式バーの右の組を差し替える） */
  onContextChange(context: CursorContext): void
}

export function createEditor(parent: HTMLElement, initial: NoteUpdate, handlers: EditorHandlers): MarkdownEditor {
  const lock = new Compartment()
  const images = imageInsertion(handlers.onError)
  let context: CursorContext = null
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initial.text,
      extensions: [
        lock.of(lockExtension(initial.locked)),
        history(),
        // Tab でリストを字下げできるようにする。キーボードだけで抜けるには Esc の後に Tab（CodeMirror の既定の動作）
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]),
        // 見出し（次の同じか上の階層の見出しまで）、コードブロック、引用、表などを、行の左の印で畳む。畳める範囲は lang-markdown が決める
        foldGutter({ markerDOM: foldMarker }),
        // 長いノートでは、画面に見えている部分しか描かないので、ブラウザの検索では画面の外の文字が見つからない
        search({ top: true }),
        formatKeymap,
        // 表の中の Tab / Enter。markdown() のキーマップ（リストの続きの Enter）と同じ優先度なので、その前に置く
        tableKeymap,
        // 補完は言語名だけにする（override）ので、HTML タグの補完ソースは登録しない。
        // URL を選択範囲に貼るとリンクにする処理は、太字の中などでも効くように自前のもの（pasteUrlAsLink）を使う
        markdown({ base: markdownLanguage, codeLanguages: languages, completeHTMLTags: false, pasteURLAsLink: false }),
        pasteUrlAsLink,
        // Web ページなどからの書式のある貼り付けを Markdown にする。URL を選択範囲に貼る処理（上）が先に効く
        pasteHtmlAsMarkdown,
        // 最初から候補を選んでおくと、言語名を打ち終えて Enter を押したときに、改行の代わりに候補が入る。
        // 選ぶのは、矢印キーで動かしたときかクリック（タップ）したときだけにする
        autocompletion({ override: [completeCodeLanguage], selectOnOpen: false, icons: false }),
        closeCodeFence,
        EditorView.lineWrapping,
        editorTheme,
        images.extension,
        collapseDataUrls,
        EditorView.updateListener.of((update) => {
          if (update.transactions.some(isLocalEdit)) handlers.onChange(update.state.doc.toString())
          // 構文木の解析が進んだだけの更新でも変わりうるので、更新のたびに調べる（調べるのはカーソルの行だけ）
          const now = cursorContext(update.state)
          if (now !== context) handlers.onContextChange((context = now))
        }),
      ],
    }),
  })
  if ((context = cursorContext(view.state))) handlers.onContextChange(context)

  return {
    get text() {
      return view.state.doc.toString()
    },
    get scroller() {
      return view.scrollDOM
    },
    get lineCount() {
      return view.state.doc.lines
    },
    topLine() {
      const height = visibleTop(view)
      const block = view.lineBlockAtHeight(height)
      const line = view.state.doc.lineAt(block.from).number - 1
      return line + Math.min(1, Math.max(0, (height - block.top) / Math.max(1, block.height)))
    },
    scrollToLine(line) {
      const { doc } = view.state
      const index = Math.min(doc.lines - 1, Math.max(0, Math.floor(line)))
      const block = view.lineBlockAt(doc.line(index + 1).from)
      view.scrollDOM.scrollTop += block.top + (line - index) * block.height - visibleTop(view)
    },
    revealLine(line) {
      const { doc } = view.state
      const pos = doc.line(Math.min(doc.lines, Math.max(1, line + 1))).from
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 0 }) })
    },
    update({ text, locked }) {
      view.dispatch({
        ...(text === undefined ? {} : externalUpdate(view.state, text)),
        effects: lock.reconfigure(lockExtension(locked)),
      })
    },
    run(command) {
      command(view)
      view.focus()
    },
    toggleTask(line) {
      const spec = toggleTask(view.state, line)
      if (!spec) return false
      view.dispatch(spec)
      return true
    },
    toggleSearch() {
      // 開くと検索の欄にフォーカスが移るので、run と違ってエディタにはフォーカスを戻さない
      if (searchPanelOpen(view.state)) closeSearchPanel(view)
      else openSearchPanel(view)
    },
    insertImages(files) {
      images.insert(view, files).catch((error: unknown) => handlers.onError(error instanceof Error ? error.message : String(error)))
    },
  }
}

// 折りたたみの印。開いているときは下向き、畳んでいるときは右向きの Lucide の chevron
function foldMarker(open: boolean): HTMLElement {
  const marker = document.createElement('span')
  marker.className = 'cm-foldMarker'
  marker.title = open ? 'Fold' : 'Unfold'
  marker.append(createElement(open ? ChevronDown : ChevronRight, { width: 14, height: 14, 'aria-hidden': 'true' }))
  return marker
}

// 表示の先頭の、文書の先頭からの高さ。documentTop は文書の先頭の画面上の位置で、スクロールすると上に動く
function visibleTop(view: EditorView): number {
  return Math.max(0, view.scrollDOM.getBoundingClientRect().top - view.documentTop)
}

// readOnly だけでは足りない。lang-markdown のキーマップ（リスト内の Enter など）は readOnly を確かめずに本文を書き換える。
// editable を外すと contenteditable でなくなり、キー入力そのものが届かない（選択とコピーはできる）
export function lockExtension(locked: boolean): Extension {
  return [EditorState.readOnly.of(locked), EditorView.editable.of(!locked)]
}

/** 外部からの変更を反映するトランザクション。remote の注釈で保存の対象から外し、undo で巻き戻せないよう履歴にも入れない */
export function externalUpdate(state: EditorState, text: string): TransactionSpec {
  return {
    // エディタは改行を LF にそろえて持つので、届いた本文も同じ規則で読み直してから比べる。CRLF のままだと最初の改行から先がすべて差分になる
    changes: minimalChange(state.doc.toString(), state.toText(text).toString()),
    annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
  }
}

/** 保存すべき変更か。外部からの変更をそのまま保存すると、親アプリがノートの更新日時を書き換えてしまう */
export function isLocalEdit(tr: Transaction): boolean {
  return tr.docChanged && tr.annotation(Transaction.remote) !== true
}

// 全文を置き換えるとカーソルとスクロール位置が先頭か末尾へ飛ぶので、共通の先頭と末尾を除いた範囲だけを置き換える
export function minimalChange(from: string, to: string): ChangeSpec | undefined {
  if (from === to) return undefined
  const max = Math.min(from.length, to.length)
  let start = 0
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++
  let end = 0
  while (end < max - start && from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)) end++
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) }
}
