import { startCompletion } from '@codemirror/autocomplete'
import { EditorSelection, Prec, type ChangeSpec, type EditorState, type StateCommand, type Text } from '@codemirror/state'
import { keymap, type Command } from '@codemirror/view'

/**
 * 選択範囲を marker で囲む。すでに囲まれていれば外す。選択がなければ marker を 2 つ入れ、間にカーソルを置く。
 * 斜体は `_` を使う（`*` だと太字の `**` と記号が重なり、付け外しの判定があいまいになる）
 */
export function toggleInline(marker: string): StateCommand {
  return ({ state, dispatch }) => {
    if (state.readOnly) return false
    const size = marker.length
    dispatch(
      state.update(
        state.changeByRange((range) => {
          if (range.empty) {
            return { changes: { from: range.from, insert: marker + marker }, range: EditorSelection.cursor(range.from + size) }
          }
          const text = state.sliceDoc(range.from, range.to)
          // 選択の内側に記号がある（`**bold**` を選んでいる）
          if (text.length >= size * 2 && text.startsWith(marker) && text.endsWith(marker)) {
            return {
              changes: [
                { from: range.from, to: range.from + size },
                { from: range.to - size, to: range.to },
              ],
              range: EditorSelection.range(range.from, range.to - size * 2),
            }
          }
          // 選択の外側に記号がある（`**bold**` の bold だけを選んでいる）
          if (state.sliceDoc(range.from - size, range.from) === marker && state.sliceDoc(range.to, range.to + size) === marker) {
            return {
              changes: [
                { from: range.from - size, to: range.from },
                { from: range.to, to: range.to + size },
              ],
              range: EditorSelection.range(range.from - size, range.to - size),
            }
          }
          return {
            changes: [
              { from: range.from, insert: marker },
              { from: range.to, insert: marker },
            ],
            range: EditorSelection.range(range.from + size, range.to + size),
          }
        }),
        { scrollIntoView: true, userEvent: 'input' },
      ),
    )
    return true
  }
}

export type LinePrefix = 'quote' | 'bullet' | 'ordered' | 'task'

// 行頭のリストの記号（インデントの後ろ）。箇条書き・タスク・番号付きは互いに入れ替える
const LIST_MARKER = /^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/
const TASK_MARKER = /^(\s*)[-*+] \[[ xX]\] /
const BULLET_MARKER = /^(\s*)[-*+] (?!\[[ xX]\] )/
const ORDERED_MARKER = /^(\s*)\d+[.)] /
const QUOTE_MARKER = /^> ?/

/** 選んだ行の行頭に記号を付ける。すべての行がすでにその記号なら外す。複数行のときは空行を飛ばす */
export function toggleLinePrefix(kind: LinePrefix): StateCommand {
  return ({ state, dispatch }) => {
    const lines = selectedLines(state)
    if (state.readOnly || lines.length === 0) return false
    const has = (text: string) => prefixPattern(kind).test(text)
    const remove = lines.every((line) => has(line.text))
    const changes = lines.map((line, index) => {
      if (remove) {
        const match = prefixPattern(kind).exec(line.text)!
        const indent = kind === 'quote' ? '' : match[1]
        return { from: line.from + indent.length, to: line.from + match[0].length }
      }
      if (kind === 'quote') return { from: line.from, insert: '> ' }
      // ほかのリストの記号は付け替える（インデントは保つ）
      const existing = LIST_MARKER.exec(line.text)
      const indent = existing ? existing[1] : (/^\s*/.exec(line.text)?.[0] ?? '')
      const marker = kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : `${index + 1}. `
      return { from: line.from + indent.length, to: line.from + (existing ? existing[0].length : indent.length), insert: marker }
    })
    dispatch(state.update(withCursorAfter(state, changes)))
    return true
  }
}

function prefixPattern(kind: LinePrefix): RegExp {
  return kind === 'quote' ? QUOTE_MARKER : kind === 'task' ? TASK_MARKER : kind === 'bullet' ? BULLET_MARKER : ORDERED_MARKER
}

/** 見出しのレベルを なし → # → ## → ### → なし の順に変える。選んだ行は最初の行に合わせる */
export const cycleHeading: StateCommand = ({ state, dispatch }) => {
  const lines = selectedLines(state)
  if (state.readOnly || lines.length === 0) return false
  const level = /^(#{1,6}) /.exec(lines[0].text)?.[1].length ?? 0
  const next = level >= 3 ? 0 : level + 1
  const changes = lines.map((line) => {
    const current = /^#{1,6} /.exec(line.text)?.[0].length ?? 0
    return { from: line.from, to: line.from + current, insert: next ? `${'#'.repeat(next)} ` : '' }
  })
  dispatch(state.update(withCursorAfter(state, changes)))
  return true
}

// 行頭に記号を入れたとき、そこにあったカーソルは記号の後ろへ動かす（そのまま書き続けられるように）。既定の写し方では記号の前に残る
function withCursorAfter(state: EditorState, changes: ChangeSpec) {
  const set = state.changes(changes)
  return { changes: set, selection: state.selection.map(set, 1), scrollIntoView: true, userEvent: 'input' }
}

/** 選択範囲をリンクにする。選んだのが URL なら [](URL) にして文字を入れる位置へ、文字なら [文字]() にして URL を入れる位置へカーソルを置く */
export const insertLink: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false
  dispatch(
    state.update(
      state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to)
        const isUrl = /^https?:\/\/\S+$/.test(text)
        const insert = isUrl ? `[](${text})` : `[${text}]()`
        // URL なら文字を、文字なら URL を、選択がなければ文字を入れる位置へ
        const cursor = isUrl || !text ? range.from + 1 : range.from + insert.length - 1
        return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(cursor) }
      }),
      { scrollIntoView: true, userEvent: 'input' },
    ),
  )
  return true
}

/**
 * ブロック（コードブロック、表など）をカーソルの位置に入れる。前後に空行を確保する
 * （`---` は直前の行に文字があると見出しの下線になり、表は段落の続きとして読まれうるため）。
 * select は、入れた後に選択する範囲（ブロックの中での位置）
 */
export function insertBlock(block: string, select?: { from: number; to: number }): StateCommand {
  return ({ state, dispatch }) => {
    if (state.readOnly) return false
    // 選択範囲は消さずに、その後ろに入れる（ほかの書式のボタンと同じつもりで押しても、選んだ文章が消えないように）
    const at = state.selection.main.to
    const before = blockSeparator(state.doc, at, 'before')
    const after = blockSeparator(state.doc, at, 'after')
    const start = at + before.length
    const selection = select ? EditorSelection.range(start + select.from, start + select.to) : EditorSelection.cursor(start + block.length)
    dispatch(state.update({ changes: { from: at, insert: before + block + after }, selection, scrollIntoView: true, userEvent: 'input' }))
    return true
  }
}

/**
 * 選んだ行をコードブロックで囲む。選択がなければ空のコードブロックを入れる。
 * カーソルは開始フェンスの後ろ（言語名を書く位置）に置く。空のブロックは中の行を作らずに入れるので、
 * 言語名を書いて Enter を押すと、そのまま中の行に移る
 */
export const wrapCodeBlock: StateCommand = (target) => {
  const { state } = target
  const range = state.selection.main
  if (range.empty) return insertBlock('```\n```', { from: 3, to: 3 })(target)
  if (state.readOnly) return false
  const first = state.doc.lineAt(range.from)
  const last = state.doc.lineAt(range.to)
  const body = state.sliceDoc(first.from, last.to)
  return insertBlockAt(target, first.from, last.to, `\`\`\`\n${body}\n\`\`\``, 3)
}

/** Code block のボタン。コードブロックを入れてから、言語名の候補を開く（code-language.ts） */
export const insertCodeBlock: Command = (view) => {
  if (!wrapCodeBlock(view)) return false
  startCompletion(view)
  return true
}

/**
 * 数式のひな形を入れる（数式の組のボタン）。¦ に選択範囲を入れ、選択がなければそこにカーソルを置く。
 * 選択を入れたときは、‸ があればそこに、なければ入れた後ろにカーソルを置く（‸ は ¦ より後ろに書く）
 */
export function insertTex(template: string): StateCommand {
  return ({ state, dispatch }) => {
    if (state.readOnly) return false
    const slot = template.indexOf('¦')
    const next = template.indexOf('‸')
    dispatch(
      state.update(
        state.changeByRange((range) => {
          const selected = state.sliceDoc(range.from, range.to)
          const insert = template.replace('¦', selected).replace('‸', '')
          // ¦ の 1 文字が選択範囲に置き換わるので、‸ の位置は選択範囲の長さ - 1 だけずれる
          const cursor = !selected ? slot : next >= 0 ? next - 1 + selected.length : insert.length
          return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + cursor) }
        }),
        { scrollIntoView: true, userEvent: 'input' },
      ),
    )
    return true
  }
}

/**
 * 数式を入れる（数式の外の「数式」ボタン）。空の行ではブロックの $$、行の途中では $…$ を入れる。
 * 1 行の選択は $ で、複数の行の選択は $$ のブロックで囲む。カーソルは数式の中に置く（すぐに数式の組のボタンを使えるように）
 */
export const insertMath: StateCommand = (target) => {
  const { state } = target
  const range = state.selection.main
  const first = state.doc.lineAt(range.from)
  const last = state.doc.lineAt(range.to)
  if (range.empty && !first.text.trim()) return insertBlock('$$\n\n$$', { from: 3, to: 3 })(target)
  if (state.readOnly) return false
  if (first.number !== last.number) {
    const body = state.sliceDoc(first.from, last.to)
    return insertBlockAt(target, first.from, last.to, `$$\n${body}\n$$`, 3 + body.length)
  }
  return insertTex('$¦‸$')(target)
}

/** from から to をブロックで置き換え、カーソルをブロックの中の cursor の位置に置く */
function insertBlockAt(
  { state, dispatch }: Parameters<StateCommand>[0],
  from: number,
  to: number,
  block: string,
  cursor: number,
): boolean {
  const before = blockSeparator(state.doc, from, 'before')
  const after = blockSeparator(state.doc, to, 'after')
  dispatch(
    state.update({
      changes: { from, to, insert: before + block + after },
      selection: EditorSelection.cursor(from + before.length + cursor),
      scrollIntoView: true,
      userEvent: 'input',
    }),
  )
  return true
}

function blockSeparator(doc: Text, pos: number, side: 'before' | 'after'): string {
  const line = doc.lineAt(pos)
  if (side === 'before') {
    if (pos > line.from && doc.sliceString(line.from, pos).trim()) return '\n\n'
    if (line.number > 1 && doc.line(line.number - 1).text.trim()) return pos > line.from ? '\n\n' : '\n'
    return pos > line.from ? '\n' : ''
  }
  if (pos < line.to && doc.sliceString(pos, line.to).trim()) return '\n\n'
  if (line.number < doc.lines && doc.line(line.number + 1).text.trim()) return '\n'
  return ''
}

function selectedLines(state: EditorState): { from: number; text: string }[] {
  const seen = new Set<number>()
  const lines: { from: number; text: string }[] = []
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    // 範囲の終わりが行頭なら、その行は選んでいないものとする（行を丸ごと選んだときの見た目に合わせる）
    const endLine = state.doc.lineAt(range.to)
    const last = range.to > range.from && range.to === endLine.from ? endLine.number - 1 : endLine.number
    for (let number = first; number <= last; number++) {
      if (seen.has(number)) continue
      seen.add(number)
      const line = state.doc.line(number)
      lines.push({ from: line.from, text: line.text })
    }
  }
  // 複数行のときは空行を飛ばす（空行に記号を付けると、リストや引用が途切れて見える）
  return lines.length > 1 ? lines.filter((line) => line.text.trim()) : lines
}

/**
 * 書式のショートカット。Mod は macOS では Cmd、ほかでは Ctrl。
 * 既定のキーマップの Mod-I（selectParentSyntax）より先に効かせるため、優先度を上げる
 */
export const formatKeymap = Prec.high(
  keymap.of([
    { key: 'Mod-b', run: toggleInline('**') },
    { key: 'Mod-i', run: toggleInline('_') },
    { key: 'Mod-k', run: insertLink },
  ]),
)
