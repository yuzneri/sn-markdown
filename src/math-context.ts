import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

// ブロックの数式の行の範囲は、構文木が変わったときだけ調べ直す。構文木は、本文が変わったときと、大きい文書で解析が進んだときに
// 新しいオブジェクトになる（文書だけをキーにすると、解析の途中で見落としたコードの中の $$ を、本文が変わるまで数えてしまう）
const blocks = new WeakMap<ReturnType<typeof syntaxTree>, [number, number][]>()

// 行頭の字下げ、引用の記号、リストの記号。$$ はその後ろに書いても、ブロックの数式になる
const PREFIX = /^(?:\s*(?:>|[-*+]|\d+[.)])(?=\s|$))*\s*/
// 構文木で、中にコードブロックを含みうるもの（ここだけ子をたどる）
const CONTAINER = /^(?:Document|BulletList|OrderedList|ListItem|Blockquote)$/

/**
 * ブロックの数式（$$…$$ と ```math）の行の範囲（0 始まり。終わりは含まない）。
 * プレビューの解析（markdown-it）を打つたびに行うと、大きい画像を含むノートで 1 回に数百 ms かかるので、
 * @mdit/plugin-tex のブロックの規則を写した軽い走査にする。$$ で始まる行で開き、$$ で終わる行で閉じる（空行を含められる）。
 * 1 行で閉じる $$…$$ もブロック。コードの中（構文木の FencedCode と CodeBlock）の $$ は数えない
 */
export function mathBlockLines(state: EditorState): [number, number][] {
  const tree = syntaxTree(state)
  const cached = blocks.get(tree)
  if (cached) return cached
  const { doc } = state
  const result: [number, number][] = []
  const code = new Set<number>()
  tree.iterate({
    enter: (node) => {
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
        const first = doc.lineAt(node.from).number
        const last = doc.lineAt(node.to).number
        for (let line = first; line <= last; line++) code.add(line)
        const info = node.node.getChild('CodeInfo')
        if (info && state.sliceDoc(info.from, info.to).trim().split(/\s+/)[0].toLowerCase() === 'math') result.push([first - 1, last])
      }
      return CONTAINER.test(node.name)
    },
  })
  let open = 0
  for (let line = 1; line <= doc.lines; line++) {
    if (code.has(line)) continue
    const text = doc.line(line).text
    const body = text.slice(PREFIX.exec(text)![0].length).trimEnd()
    if (open) {
      if (body.endsWith('$$')) {
        result.push([open - 1, line])
        open = 0
      }
      continue
    }
    if (!body.startsWith('$$')) continue
    if (body.slice(2).includes('$$')) {
      // 行の中で閉じている。後ろに文字が続く（$$ x $$ tail）なら、ブロックではなく行の中の文字
      if (body.endsWith('$$')) result.push([line - 1, line])
      continue
    }
    open = line
  }
  // 閉じていないブロックは、文書の終わりまで続く
  if (open) result.push([open - 1, doc.lines])
  blocks.set(tree, result)
  return result
}

/**
 * pos が数式の中か（書式バーのボタンを数式の組に替えるのに使う）。lang-markdown は $ を数式として読まないので、
 * ブロックの数式（$$…$$、```math）も行の中の数式（$…$）も、プレビューのプラグインと同じ規則で調べる
 */
export function inMath(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos)
  const index = line.number - 1
  if (mathBlockLines(state).some(([from, to]) => index >= from && index < to)) return true
  if (inCode(state, pos)) return false
  return inInlineMath(maskInlineCode(state, line.from, line.text), pos - line.from)
}

// ```math 以外のコードの中は数式ではない（```math は、上のブロックの範囲に入っている）
function inCode(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolveInner(pos, -1)
  for (;;) {
    if (/^(?:FencedCode|CodeBlock|InlineCode)$/.test(node.name)) return true
    if (!node.parent) return false
    node = node.parent
  }
}

// 行の中のインラインコードは、$ を探す前に伏せる（markdown-it も、コードを先に読むので、コードの中の $ は数式にならない）
function maskInlineCode(state: EditorState, from: number, text: string): string {
  let masked = text
  syntaxTree(state).iterate({
    from,
    to: from + text.length,
    enter: (node) => {
      if (node.name !== 'InlineCode') return
      const start = Math.max(0, node.from - from)
      const end = Math.min(text.length, node.to - from)
      masked = masked.slice(0, start) + ' '.repeat(end - start) + masked.slice(end)
      return false
    },
  })
  return masked
}

const DOLLAR = 36
const isSpace = (code: number) => code === 32 || code === 9
const isWord = (code: number) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95

function escaped(text: string, index: number): boolean {
  let count = 0
  for (let i = index - 1; i >= 0 && text.charCodeAt(i) === 92; i--) count++
  return count % 2 === 1
}

// 以下の規則は @mdit/plugin-tex の行の中の $ の規則と同じ（金額の $5 と $10 を数式にしない）
function canOpen(text: string, i: number): boolean {
  const before = text.charCodeAt(i - 1)
  const after = text.charCodeAt(i + 1)
  return before !== DOLLAR && (i === 0 || isSpace(before) || !isWord(before)) && !isSpace(after)
}

function canClose(text: string, i: number): boolean {
  const before = text.charCodeAt(i - 1)
  const after = text.charCodeAt(i + 1)
  return after !== DOLLAR && (Number.isNaN(after) || isSpace(after) || !isWord(after)) && !isSpace(before)
}

/** 行 text の offset が、$…$ の中（開きの直後から閉じの直前まで）か。ボタンで入れたばかりの空の $$ の間も中とする */
export function inInlineMath(text: string, offset: number): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== DOLLAR || escaped(text, i)) continue
    if (text.charCodeAt(i + 1) === DOLLAR && offset === i + 1) return true
    if (!canOpen(text, i)) continue
    let close = -1
    for (let j = text.indexOf('$', i + 1); j !== -1; j = text.indexOf('$', j + 1)) {
      if (escaped(text, j)) continue
      if (canClose(text, j)) {
        close = j
        break
      }
      // 空白に挟まれた $ は飛ばして、その先の閉じを探す。それ以外は、この開きでは数式にならない
      if (!(isSpace(text.charCodeAt(j - 1)) && (j + 1 >= text.length || isSpace(text.charCodeAt(j + 1))))) break
    }
    if (close === -1) continue
    if (offset > i && offset <= close) return true
    i = close
  }
  return false
}
