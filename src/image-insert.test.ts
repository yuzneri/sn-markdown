// @vitest-environment jsdom
// EditorView と FileReader が要るので jsdom で動かす（レイアウトに依存する操作は使わない）
import { afterEach, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { imageInsertion } from './image-insert'

const png = (name = 'shot.png') => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' })
const views: EditorView[] = []

function setup(doc: string, readOnly = false) {
  const errors: string[] = []
  const images = imageInsertion((message) => errors.push(message))
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, extensions: [images.extension, EditorState.readOnly.of(readOnly)] }),
  })
  views.push(view)
  return { view, errors, insert: (files: File[], at?: { from: number; to: number }) => images.insert(view, files, at) }
}

afterEach(() => views.splice(0).forEach((view) => view.destroy()))

describe('imageInsertion', () => {
  it('指定した位置に埋め込み、カーソルを画像の後ろへ動かす', async () => {
    const { view, insert } = setup('abc def')
    view.dispatch({ selection: { anchor: 3 } })
    await insert([png()], { from: 3, to: 3 })
    expect(view.state.doc.toString()).toBe('abc![shot](data:image/png;base64,iVBORw==) def')
    expect(view.state.selection.main.head).toBe(3 + '![shot](data:image/png;base64,iVBORw==)'.length)
  })

  it('読み込みの間に前で文字が増えても、入れる位置がずれない', async () => {
    const { view, insert } = setup('abc def')
    const inserting = insert([png()], { from: 3, to: 3 })
    view.dispatch({ changes: { from: 0, insert: 'XX' } })
    await inserting
    expect(view.state.doc.toString()).toBe('XXabc![shot](data:image/png;base64,iVBORw==) def')
  })

  it('複数の画像は空行で区切り、埋め込めない形式は知らせて残りを入れる', async () => {
    const { view, errors, insert } = setup('')
    await insert([png('a.png'), new File(['<svg/>'], 'b.svg', { type: 'image/svg+xml' }), png('c.png')], { from: 0, to: 0 })
    expect(view.state.doc.toString()).toBe('![a](data:image/png;base64,iVBORw==)\n\n![c](data:image/png;base64,iVBORw==)')
    expect(errors).toEqual(['Could not insert b.svg: Unsupported image type: image/svg+xml (PNG, JPEG, GIF and WebP only)'])
  })

  it('読み込みの間に同じ位置へ打った文字より前に入れる（先に貼り付けたので）', async () => {
    const { view, insert } = setup('abc def')
    const inserting = insert([png()], { from: 3, to: 3 })
    view.dispatch({ changes: { from: 3, insert: 'typed' } })
    await inserting
    expect(view.state.doc.toString()).toBe('abc![shot](data:image/png;base64,iVBORw==)typed def')
  })

  it('範囲を指定しなければ選択範囲を置き換える（テキストの貼り付けと同じ）', async () => {
    const { view, insert } = setup('abc SELECTED def')
    view.dispatch({ selection: { anchor: 4, head: 12 } })
    await insert([png()])
    expect(view.state.doc.toString()).toBe('abc ![shot](data:image/png;base64,iVBORw==) def')
  })

  it('読み込みの間に置き換える範囲の内側が変わっても、範囲ごと置き換える', async () => {
    const { view, insert } = setup('abc SELECTED def')
    const inserting = insert([png()], { from: 4, to: 12 })
    view.dispatch({ changes: { from: 4, to: 7, insert: 'XX' } })
    await inserting
    expect(view.state.doc.toString()).toBe('abc ![shot](data:image/png;base64,iVBORw==) def')
  })

  it('ロック中のノートと、画像以外のファイルは入れずに知らせる', async () => {
    const locked = setup('text', true)
    await locked.insert([png()])
    expect(locked.view.state.doc.toString()).toBe('text')
    expect(locked.errors).toEqual(['This note is locked'])

    const other = setup('text')
    await other.insert([new File(['x'], 'a.txt', { type: 'text/plain' })])
    expect(other.view.state.doc.toString()).toBe('text')
    expect(other.errors).toEqual(['Only images can be inserted'])
  })
})
