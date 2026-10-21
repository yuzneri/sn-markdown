import { Compartment, EditorState, Transaction, type ChangeSpec, type Extension, type TransactionSpec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { NoteUpdate } from './bridge'
import { imageInsertion } from './image-insert'
import { editorTheme } from './theme'

export interface MarkdownEditor {
  readonly text: string
  /** 外部（他端末など）からの本文の変更とロックの状態を反映する。本文の変更は保存も履歴への追加もしない */
  update(update: NoteUpdate): void
  /** 画像をカーソルの位置に埋め込む */
  insertImages(files: File[]): void
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
        // 補完 UI（autocompletion）を入れていないので、HTML タグの補完ソースは登録しない
        markdown({ base: markdownLanguage, codeLanguages: languages, completeHTMLTags: false }),
        EditorView.lineWrapping,
        editorTheme,
        images.extension,
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
    update({ text, locked }) {
      view.dispatch({
        ...(text === undefined ? {} : externalUpdate(view.state, text)),
        effects: lock.reconfigure(lockExtension(locked)),
      })
    },
    insertImages(files) {
      images.insert(view, files).catch((error: unknown) => handlers.onError(error instanceof Error ? error.message : String(error)))
    },
  }
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
