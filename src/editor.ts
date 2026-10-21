import { Compartment, EditorState, Transaction, type ChangeSpec, type Extension, type TransactionSpec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { NoteUpdate } from './bridge'

export interface MarkdownEditor {
  /** 外部（他端末など）からの本文の変更とロックの状態を反映する。本文の変更は保存も履歴への追加もしない */
  update(update: NoteUpdate): void
}

export function createEditor(parent: HTMLElement, initial: NoteUpdate, onChange: (text: string) => void): MarkdownEditor {
  const lock = new Compartment()
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
        layout,
        EditorView.updateListener.of((update) => {
          if (update.transactions.some(isLocalEdit)) onChange(update.state.doc.toString())
        }),
      ],
    }),
  })

  return {
    update({ text, locked }) {
      view.dispatch({
        ...(text === undefined ? {} : externalUpdate(view.state, text)),
        effects: lock.reconfigure(lockExtension(locked)),
      })
    },
  }
}

// CodeMirror は自分のスタイルを実行時に head へ追加するので、style.css ではなくテーマとして書かないと詳細度が同じでも負ける
const layout = EditorView.theme({
  '&': { flex: '1', minHeight: '0', fontSize: 'var(--sn-stylekit-font-size-editor)' },
  '.cm-scroller': { fontFamily: 'var(--sn-stylekit-monospace-font)' },
  '.cm-content': { padding: '1rem 0' },
  '.cm-line': { padding: '0 1rem' },
})

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
