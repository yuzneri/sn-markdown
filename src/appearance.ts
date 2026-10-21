export type Appearance = 'light' | 'dark'

/**
 * 背景色が暗いか。SN のテーマの CSS には明暗の印がない（--sn-stylekit-theme-type は公式テーマの多くで未設定）ので、輝度で決める。
 * 境目は WCAG の相対輝度で 0.179（黒い文字と白い文字のコントラストが等しくなる点）。読めない形式と透明は明るい側に倒す
 */
export function isDarkColor(color: string): boolean {
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(color.trim())
  if (!match) return false
  const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])
  if (alpha === 0) return false
  const [r, g, b] = match.slice(1, 4).map((value) => {
    const channel = parseFloat(value) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.179
}

/**
 * 今の明暗を返し、変わったら onChange を呼ぶ。sn-extension-api はテーマを切り替えるとき、head の link.custom-theme を
 * 足し引きするだけで知らせてくれない（onThemesChangeCallback に setter がない）ので、link の出入りを見張る。
 * 足された link は CSS を読み込み終えるまで色が変わらないので、load を待ってから判定する
 */
export function watchAppearance(onChange: (appearance: Appearance) => void): Appearance {
  let current = currentAppearance()
  const check = () => {
    const next = currentAppearance()
    if (next === current) return
    current = next
    onChange(next)
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (isThemeLink(node)) {
          node.addEventListener('load', check, { once: true })
          // 読み込みに失敗しても、ほかのテーマが外れていれば明暗が変わる
          node.addEventListener('error', check, { once: true })
        }
      }
      if ([...mutation.removedNodes].some(isThemeLink)) check()
    }
  }).observe(document.head, { childList: true })
  return current
}

function currentAppearance(): Appearance {
  return isDarkColor(getComputedStyle(document.body).backgroundColor) ? 'dark' : 'light'
}

function isThemeLink(node: Node): node is HTMLLinkElement {
  return node instanceof HTMLLinkElement && node.classList.contains('custom-theme')
}
