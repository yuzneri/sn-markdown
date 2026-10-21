import { describe, expect, it } from 'vitest'
import { ChangeSet, Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { history, undoDepth } from '@codemirror/commands'
import { externalUpdate, isLocalEdit, lockExtension, minimalChange } from './editor'

describe('minimalChange', () => {
  it.each([
    ['挿入', 'hello world', 'hello brave world'],
    ['削除', 'hello brave world', 'hello world'],
    ['置換', 'a cat sat', 'a dog sat'],
    ['繰り返しを含む短縮', 'abcabc', 'abc'],
    ['繰り返しを含む延長', 'aa', 'aaaa'],
    ['空から', '', 'new'],
    ['空へ', 'old', ''],
  ])('%s: 適用すると変更後の本文になる', (_, from, to) => {
    const change = minimalChange(from, to)
    expect(ChangeSet.of(change ?? [], from.length).apply(EditorState.create({ doc: from }).doc).toString()).toBe(to)
  })

  it('共通の先頭と末尾を置き換えの範囲に含めない', () => {
    expect(minimalChange('# Title\nold line\nend', '# Title\nnew line\nend')).toEqual({ from: 8, to: 11, insert: 'new' })
  })

  it('同じ本文なら変更しない', () => {
    expect(minimalChange('same', 'same')).toBeUndefined()
  })
})

describe('externalUpdate', () => {
  const createState = (doc: string, cursor: number) =>
    EditorState.create({ doc, selection: EditorSelection.cursor(cursor), extensions: [history()] })

  it('本文を置き換え、保存の対象にも undo の履歴にも入れない', () => {
    const state = createState('first', 0)
    const tr = state.update(externalUpdate(state, 'second'))
    expect(tr.state.doc.toString()).toBe('second')
    expect(isLocalEdit(tr)).toBe(false)
    expect(undoDepth(tr.state)).toBe(0)
  })

  it('CRLF の本文でも、変更箇所より前のカーソルを動かさない', () => {
    const state = createState('line1\r\nline2\r\nline3 tail', 15)
    const tr = state.update(externalUpdate(state, 'line1\r\nline2\r\nline3 tail!'))
    expect(tr.state.doc.toString()).toBe('line1\nline2\nline3 tail!')
    expect(tr.state.selection.main.head).toBe(15)
  })

  it('変更箇所より前のカーソルを動かさない', () => {
    const state = createState('# Title\n\nbody', 3)
    const tr = state.update(externalUpdate(state, '# Title\n\nbody from another device'))
    expect(tr.state.selection.main.head).toBe(3)
  })
})

describe('lockExtension', () => {
  it('ロックの切り替えで読み取り専用になり、解除で戻る', () => {
    const lock = new Compartment()
    const unlocked = EditorState.create({ extensions: [lock.of(lockExtension(false))] })
    expect(unlocked.readOnly).toBe(false)
    const locked = unlocked.update({ effects: lock.reconfigure(lockExtension(true)) }).state
    expect(locked.readOnly).toBe(true)
    expect(locked.update({ effects: lock.reconfigure(lockExtension(false)) }).state.readOnly).toBe(false)
  })
})

describe('isLocalEdit', () => {
  const state = EditorState.create({ doc: 'text' })

  it('ユーザーの編集は保存の対象にする', () => {
    expect(isLocalEdit(state.update({ changes: { from: 0, insert: 'x' } }))).toBe(true)
  })

  it('本文を変えないトランザクション（カーソル移動など）は保存しない', () => {
    expect(isLocalEdit(state.update({ selection: EditorSelection.cursor(2) }))).toBe(false)
  })
})
