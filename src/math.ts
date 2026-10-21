import DOMPurify from 'dompurify'
import type Katex from 'katex'

type KatexApi = typeof Katex

// プレビューは入力のたびに全体を描き直すので、描いた式をソースをキーに覚えておく（数式の多いノートで、毎回描き直さない）。
// 式を書いている間はキーが入力のたびに変わるので、古いものから捨てる
const CACHE_LIMIT = 200
const cache = new Map<string, string>()

let katex: Promise<KatexApi> | undefined
let loaded: KatexApi | undefined

/**
 * プレビュー中の数式の目印（.math）を KaTeX で描く。KaTeX を読み込み済みならその場で描き、
 * まだなら読み込みを始め、読み終えてから onLoaded を呼ぶ（呼ばれた側がプレビューを描き直すと、今度はその場で描かれる）
 */
export function renderMath(container: HTMLElement, onLoaded: () => void): void {
  const targets = container.querySelectorAll<HTMLElement>('.math')
  if (targets.length === 0) return
  if (!loaded) {
    load(onLoaded)
    return
  }
  for (const target of targets) {
    target.innerHTML = rendered(loaded, target.textContent ?? '', target.classList.contains('math-display'))
    target.classList.add('is-rendered')
  }
}

function load(onLoaded: () => void): void {
  if (katex) return
  // KaTeX（と CSS、フォント）は、数式のあるノートを開いたときにだけ読み込む。Mermaid も同じ版の KaTeX を同じチャンクで使う
  katex = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([module]) => module.default)
  katex.then(
    (api) => {
      loaded = api
      onLoaded()
    },
    (error: unknown) => {
      // 次の描き直しで読み込みをやり直せるようにする。それまでは、目印のソースがそのまま見える
      katex = undefined
      console.error('KaTeX を読み込めませんでした', error)
    },
  )
}

function rendered(api: KatexApi, source: string, display: boolean): string {
  const key = `${display}\n${source}`
  const hit = cache.get(key)
  if (hit !== undefined) {
    // 使った式を新しい側に移す
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  // throwOnError: false で、書き間違いは KaTeX が赤い字のソースにする。trust: false で \href などのリンクやクラスを作らせない。
  // strict: 'ignore' で、数式の中の日本語などに出る警告をコンソールに出さない
  const html = api.renderToString(source, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore', output: 'htmlAndMathml' })
  // KaTeX の出力は trust: false なら安全だが、念のため DOMPurify にも通す。既定の設定だと、読み上げや TeX のコピーに使う
  // MathML の semantics と annotation（中身は TeX のソースの文字だけ）が消えるので、その 2 つは残す
  const clean = DOMPurify.sanitize(html, { ADD_TAGS: ['semantics', 'annotation'], ADD_ATTR: ['encoding'] })
  cache.set(key, clean)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  return clean
}
