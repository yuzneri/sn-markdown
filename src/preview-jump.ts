// 押した文字の前後から元の行の中の位置を探すときの、探す文字の最大の数と、短くしていくときの下限（短すぎると、行の中の別の場所に当たる）
const SNIPPET = 12
const MIN_SNIPPET = 3

export interface SourcePosition {
  /** 0 始まり */
  line: number
  /** 行の中の位置（行頭からの文字数） */
  column: number
}

/**
 * プレビューの中の文字の位置（node の offset 文字目）に対応する、元の Markdown（lines）の位置。
 * 行は、その文字を含む最も内側の data-line の要素（ブロックの始まりの行）に、要素の中でその文字より前の改行の数を足したもの。
 * 段落の中の改行は <br> になる（breaks: true）ので <br> を、コードブロックは中の文字の改行を数える。
 * 行の中の位置は、押した文字の後ろ（なければ前）の文字を元の行から探して決める。記法の記号やエスケープの分だけ、プレビューとずれるため。
 * 見つからなければ行頭にする。data-line の要素の外なら null
 */
export function sourcePosition(preview: HTMLElement, node: Node, offset: number, lines: string[]): SourcePosition | null {
  const start = node instanceof Element ? node : node.parentElement
  const block = start?.closest<HTMLElement>('[data-line]')
  if (!block || !preview.contains(block) || lines.length === 0) return null
  const range = document.createRange()
  range.setStart(block, 0)
  range.setEnd(node, offset)
  const beforeText = range.toString()

  let line = Number(block.dataset.line)
  if (block.closest('pre')) {
    // markdown-it は、フェンスのコードブロックでは data-line を <code> に、字下げのコードブロックでは <pre> に付ける。
    // フェンスなら、中身は開始フェンスの次の行から始まる
    if (block.tagName === 'CODE') line += 1
    line += beforeText.split('\n').length - 1
  } else {
    const fragment = range.cloneContents()
    // 中の別のブロック（入れ子のリストなど）の改行は、そのブロックの行として数えるので除く
    line += fragment.querySelectorAll('br').length - fragment.querySelectorAll('[data-line] br').length
  }
  line = Math.min(line, lines.length - 1)

  // プレビューの、押した文字のある行（ブロックの文字を改行で区切ったもの）と、その中の押した位置
  const blockText = block.textContent ?? ''
  const lineStart = blockText.lastIndexOf('\n', beforeText.length - 1) + 1
  const lineEnd = blockText.indexOf('\n', beforeText.length)
  const rendered = blockText.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
  const caret = beforeText.length - lineStart

  // 探す文字は、押した文字のある文字のノードの中だけから取る。ノードの境目には、元の行では記法の記号（** など）が入る
  const text = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '') : ''
  const after = text.slice(offset).split('\n')[0].slice(0, SNIPPET)
  const before = (text.slice(0, offset).split('\n').at(-1) ?? '').slice(-SNIPPET)
  return { line, column: findColumn(lines[line], rendered, caret, after, before) }
}

function findColumn(source: string, rendered: string, caret: number, after: string, before: string): number {
  for (let n = after.length; n > 0 && n >= Math.min(MIN_SNIPPET, after.length); n--) {
    const found = matching(source, rendered, after.slice(0, n), caret)
    if (found >= 0) return found
  }
  for (let n = before.length; n > 0 && n >= Math.min(MIN_SNIPPET, before.length); n--) {
    const found = matching(source, rendered, before.slice(-n), caret - n)
    if (found >= 0) return found + n
  }
  return 0
}

/**
 * プレビューの行（rendered）の at の位置にある snippet が、元の行（source）のどこにあるか。
 * 同じ文字が行に何度も出るときは、プレビューで何番目のものかを数え、元の行でも同じ番目のものにする。元の行の方が少なければ最後のもの
 */
function matching(source: string, rendered: string, snippet: string, at: number): number {
  const inSource = occurrences(source, snippet)
  if (inSource.length === 0) return -1
  const index = occurrences(rendered, snippet).filter((position) => position < at).length
  return inSource[Math.min(index, inSource.length - 1)]
}

function occurrences(text: string, snippet: string): number[] {
  const result: number[] = []
  for (let at = text.indexOf(snippet); at >= 0; at = text.indexOf(snippet, at + 1)) result.push(at)
  return result
}
