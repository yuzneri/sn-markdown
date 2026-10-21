import { Compartment, EditorState, Transaction, type ChangeSpec, type Extension, type TransactionSpec } from '@codemirror/state'
import { EditorView, keymap, type Command } from '@codemirror/view'
import { autocompletion } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { NoteUpdate } from './bridge'
import { closeCodeFence } from './code-fence'
import { completeCodeLanguage } from './code-language'
import { formatKeymap } from './commands'
import { collapseDataUrls } from './data-url'
import { imageInsertion } from './image-insert'
import { tableKeymap } from './table-commands'
import { editorTheme } from './theme'

export interface MarkdownEditor {
  readonly text: string
  /** スクロールする要素と行数（スクロール同期で使う） */
  readonly scroller: HTMLElement
  readonly lineCount: number
  /** 表示している先頭の行（0 始まり、小数で行の中の位置も表す） */
  topLine(): number
  /** line（0 始まり、小数を含む）が表示の先頭に来るようにスクロールする */
  scrollToLine(line: number): void
  /** 外部（他端末など）からの本文の変更とロックの状態を反映する。本文の変更は保存も履歴への追加もしない */
  update(update: NoteUpdate): void
  /** 画像をカーソルの位置に埋め込む */
  insertImages(files: File[]): void
  /** 書式のコマンドを実行し、エディタにフォーカスを戻す（ボタンから続けて入力できるように） */
  run(command: Command): void
}

export interface EditorHandlers {
  /** ユーザーの編集で本文が変わった */
  onChange(text: string): void
  /** 画像を入れられなかったなど、ユーザーに知らせること */
  onError(message: string): void
}

export function createEditor(parent: HTMLElement, initial: NoteUpdate, handlers: EditorHandlers): MarkdownEditor {
  const lock = new Compartment()
  const images = imageInsertion(handlers.onError)
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initial.text,
      extensions: [
        lock.of(lockExtension(initial.locked)),
        history(),
        // Tab でリストを字下げできるようにする。キーボードだけで抜けるには Esc の後に Tab（CodeMirror の既定の動作）
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        formatKeymap,
        // 表の中の Tab / Enter。markdown() のキーマップ（リストの続きの Enter）と同じ優先度なので、その前に置く
        tableKeymap,
        // 補完は言語名だけにする（override）ので、HTML タグの補完ソースは登録しない
        markdown({ base: markdownLanguage, codeLanguages: languages, completeHTMLTags: false }),
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
        }),
      ],
    }),
  })

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
    insertImages(files) {
      images.insert(view, files).catch((error: unknown) => handlers.onError(error instanceof Error ? error.message : String(error)))
    },
  }
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
