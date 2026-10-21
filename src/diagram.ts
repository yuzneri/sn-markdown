import type { Mermaid } from 'mermaid'
import type { Appearance } from './appearance'

type DiagramResult = { svg: string } | { error: string }

// ライトは mermaid 12 の既定のテーマ、ダークはその対のテーマ
const MERMAID_THEMES = { light: 'redux-color', dark: 'redux-dark-color' } as const

// プレビューは入力のたびに全体を描き直すので、描いた図をソースとテーマをキーに覚えておき、同期的に差し込む（ちらつかせない）。
// 図を書いている間はキーが入力のたびに変わるので、古いものから捨てる
const CACHE_LIMIT = 50
const cache = new Map<string, DiagramResult>()
const pending = new Set<string>()

let mermaid: Promise<Mermaid> | undefined
let initializedTheme: Appearance | undefined
let nextId = 0
// mermaid は描画中に一時的な要素を文書に足すので、描画は 1 つずつ行う
let queue: Promise<void> = Promise.resolve()

/**
 * プレビュー中の Mermaid の目印（.mermaid-block）を図にする。描いたことのある図はその場で差し込み、
 * まだのものは描き終えてから onRendered を呼ぶ（呼ばれた側がプレビューを描き直すと、今度はその場で差し込まれる）
 */
export function renderDiagrams(container: HTMLElement, theme: Appearance, onRendered: () => void): void {
  for (const block of container.querySelectorAll<HTMLElement>('.mermaid-block')) {
    const source = block.textContent ?? ''
    const key = `${theme}\n${source}`
    const result = cache.get(key)
    if (result) {
      // 使った図を新しい側に移す
      cache.delete(key)
      cache.set(key, result)
      show(block, result)
    } else if (!pending.has(key)) {
      pending.add(key)
      queue = queue
        .then(async () => {
          try {
            remember(key, await draw(source, theme))
          } finally {
            pending.delete(key)
          }
          onRendered()
        })
        // draw は失敗を結果として返すので、ここに来るのは描き直し（onRendered）の失敗。後続の図を止めないよう知らせるだけにする
        .catch((error: unknown) => console.error('Mermaid の図を差し込めませんでした', error))
    }
  }
}

async function draw(source: string, theme: Appearance): Promise<DiagramResult> {
  let api: Mermaid
  try {
    // mermaid は大きい（ELK を含む）ので、図のあるノートを開いたときにだけ読み込む
    mermaid ??= import('mermaid').then((module) => module.default)
    api = await mermaid
  } catch (error) {
    // 次の図で読み込みをやり直せるようにする。mermaid 12 は Safari 17.4 未満では読み込めない
    mermaid = undefined
    return { error: `Failed to load Mermaid: ${message(error)}` }
  }
  if (initializedTheme !== theme) {
    // strict: ラベル中の HTML を無害化し、クリックでスクリプトを動かさない。
    // suppressErrorRendering: 構文エラーのときに mermaid が文書へエラーの図を足さず、例外を投げるだけにする
    api.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme: MERMAID_THEMES[theme] })
    initializedTheme = theme
  }
  try {
    // id は文書内で一意である必要がある。同じソースを描き直しても重ならないよう、毎回新しくする
    const { svg } = await api.render(`mermaid-diagram-${++nextId}`, source)
    return { svg }
  } catch (error) {
    return { error: message(error) }
  }
}

function remember(key: string, result: DiagramResult): void {
  cache.set(key, result)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
}

function show(block: HTMLElement, result: DiagramResult): void {
  if ('svg' in result) {
    // mermaid の出力は DOMPurify に通さない。securityLevel: 'strict' で mermaid 自身がラベルを無害化しており、
    // 既定の設定の DOMPurify はラベルの foreignObject を消してしまう
    block.innerHTML = result.svg
    block.classList.add('is-rendered')
    // クリックで拡大表示する（viewer.ts）。キーボードでも選べるようにする
    block.tabIndex = 0
    block.setAttribute('role', 'button')
    block.setAttribute('aria-label', 'Enlarge diagram')
  } else {
    // ソースは残したまま、その下にエラーを出す
    const error = document.createElement('p')
    error.className = 'mermaid-error'
    error.textContent = result.error
    block.append(error)
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
