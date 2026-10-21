import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { imageToMarkdown } from './image'

export interface ImageInsertion {
  readonly extension: Extension
  /** range（省略時は選択範囲）を画像で置き換える。画像以外のファイルと、読めなかった画像は onError で知らせる */
  insert(view: EditorView, files: File[], range?: { from: number; to: number }): Promise<void>
}

/** 貼り付けとドロップで画像を埋め込む拡張 */
export function imageInsertion(onError: (message: string) => void): ImageInsertion {
  // 画像を読み込んでいる間に本文が変わっても入れる位置がずれないよう、待っている範囲を変更に合わせて動かす
  const pending = new Set<{ from: number; to: number }>()

  async function insert(view: EditorView, files: File[], range: { from: number; to: number } = view.state.selection.main): Promise<void> {
    if (view.state.readOnly) return onError('This note is locked')
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return onError('Only images can be inserted')

    const target = { from: range.from, to: range.to }
    pending.add(target)
    const parts: string[] = []
    try {
      for (const file of images) {
        try {
          parts.push(await imageToMarkdown(file))
        } catch (error) {
          onError(`Could not insert ${file.name || 'the image'}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } finally {
      pending.delete(target)
    }
    if (parts.length === 0) return
    // 読み込みの間にロックされたら入れない
    if (view.state.readOnly) return onError('This note is locked')

    const text = parts.join('\n\n')
    const { main } = view.state.selection
    // 選択（カーソル）が置き換える範囲のままなら、入れた画像の後ろへ動かす。ほかへ動いていたら、そのままにする
    const selectionAtTarget = main.from === target.from && main.to === target.to
    view.dispatch({
      changes: { from: target.from, to: target.to, insert: text },
      ...(selectionAtTarget ? { selection: { anchor: target.from + text.length } } : {}),
      scrollIntoView: selectionAtTarget,
      userEvent: 'input.paste',
    })
  }

  const report = (error: unknown) => onError(error instanceof Error ? error.message : String(error))
  const extension = [
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      for (const target of pending) {
        // 範囲が空（カーソルの位置に入れる）なら、同じ位置に打った文字より前に入れる（先に貼り付けたので）。
        // 範囲があれば、両端の外側に打った文字は範囲に含めず、内側の変更ごと置き換える
        const empty = target.from === target.to
        target.from = update.changes.mapPos(target.from, empty ? -1 : 1)
        target.to = empty ? target.from : Math.max(target.from, update.changes.mapPos(target.to, -1))
      }
    }),
    EditorView.domEventHandlers({
      paste(event, view) {
        const files = [...(event.clipboardData?.files ?? [])]
        // テキストも入っているときはふつうに貼り付ける。Word などは、テキストと一緒にその画像版もクリップボードに入れる
        if (files.length === 0 || event.clipboardData?.getData('text/plain')) return false
        event.preventDefault()
        insert(view, files).catch(report)
        return true
      },
      drop(event, view) {
        const files = [...(event.dataTransfer?.files ?? [])]
        if (files.length === 0) return false
        event.preventDefault()
        // 落とした点に入れる（選択範囲は置き換えない）
        const at = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head
        insert(view, files, { from: at, to: at }).catch(report)
        return true
      },
    }),
  ]
  return { extension, insert }
}
