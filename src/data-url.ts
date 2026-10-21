import { StateField, type EditorState, type Range, type Text } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'

/** 埋め込んだ画像の data: URL を表す短い表示。形式と、復号後のおおよその大きさ */
export function dataUrlLabel(type: string, base64Length: number): string {
  const bytes = Math.floor((base64Length * 3) / 4)
  const size = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${type} · ${size}`
}

class DataUrlWidget extends WidgetType {
  constructor(readonly label: string) {
    super()
  }

  eq(other: DataUrlWidget): boolean {
    return other.label === this.label
  }

  toDOM(): HTMLElement {
    const node = document.createElement('span')
    node.className = 'cm-data-url'
    node.textContent = this.label
    return node
  }

  // 既定（true）ではウィジェット上のクリックをエディタが扱わず、ブラウザがカーソルを文書の先頭に置いてしまう。
  // エディタに扱わせて、クリックした側の端にカーソルを置く
  ignoreEvent(): boolean {
    return false
  }
}

const DATA_URL = /data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g

/** text の中の data: URL を、エディタに出す短い表示に置き換えたもの（表の列の幅を、見た目の長さで数えるため） */
export function labelDataUrls(text: string): string {
  return text.replace(DATA_URL, (_, type: string, base64: string) => dataUrlLabel(type, base64.length))
}

/** from から to までの行（を含む行の全体）にある data: URL の置き換えの装飾 */
function scan(doc: Text, from: number, to: number): Range<Decoration>[] {
  const start = doc.lineAt(from).from
  const end = doc.lineAt(to).to
  const ranges: Range<Decoration>[] = []
  for (const match of doc.sliceString(start, end).matchAll(DATA_URL)) {
    const at = start + match.index
    ranges.push(Decoration.replace({ widget: new DataUrlWidget(dataUrlLabel(match[1], match[2].length)) }).range(at, at + match[0].length))
  }
  return ranges
}

/**
 * 埋め込んだ画像の data: URL を、エディタでは短い表示に折りたたむ。長い文字列を DOM に描かないので、エディタも重くならない。
 * カーソルは折りたたんだ部分を 1 文字のように飛び越え、消すときもまとめて消える（atomicRanges）。
 *
 * ViewPlugin（MatchDecorator）ではなく StateField で持つ。CodeMirror は長い行の高さと描かない範囲（line gap）を、
 * state から来る装飾（関数でないもの）だけを見て見積もる。ViewPlugin の装飾だと、折りたたんだ部分も文字数どおりの高さとして扱われ、
 * その後ろの文字や次の行が描かれないまま、空白が続いてしまう
 */
export const collapseDataUrls = StateField.define<DecorationSet>({
  create(state: EditorState) {
    return Decoration.set(scan(state.doc, 0, state.doc.length))
  },
  update(decorations, tr) {
    if (!tr.docChanged) return decorations
    let next = decorations.map(tr.changes)
    // 変わった行だけを照合し直す（数 MB の文書でも、入力のたびに全体を走査しない）
    tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
      const from = tr.state.doc.lineAt(fromB).from
      const to = tr.state.doc.lineAt(toB).to
      next = next.update({
        filter: (rangeFrom, rangeTo) => rangeTo < from || rangeFrom > to,
        filterFrom: from,
        filterTo: to,
        add: scan(tr.state.doc, from, to),
        sort: true,
      })
    })
    return next
  },
  provide: (field) => [EditorView.decorations.from(field), EditorView.atomicRanges.of((view) => view.state.field(field))],
})
