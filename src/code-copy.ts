import { Check, Copy, createElement, type IconNode } from 'lucide'
import { element } from './dom'

// 写したことを示す印（チェック）を出しておく時間
const COPIED_DURATION = 1500

/**
 * プレビューのコードブロックの右上に、中身をコピーするボタンを付ける。プレビューは打つたびに描き直すので、描き直すたびに呼ぶ。
 * Mermaid の図のソース（図にする前と、図にできなかったとき）は除く
 */
export function addCopyButtons(preview: HTMLElement): void {
  for (const code of preview.querySelectorAll<HTMLElement>('pre > code')) {
    const pre = code.parentElement!
    if (pre.closest('.mermaid-block') || pre.querySelector(':scope > .code-copy')) continue
    const button = element('button', 'code-copy')
    button.type = 'button'
    setIcon(button, Copy, 'Copy code')
    // ボタンを pre ごと横にスクロールさせないよう、横のスクロールは code でする（preview.css の .has-copy）
    pre.classList.add('has-copy')
    pre.append(button)
  }
}

/** コピーのボタンを押したら、そのコードブロックの中身をクリップボードに書き込む。書き込めなければ onError で知らせる */
export function enableCodeCopy(preview: HTMLElement, onError: (message: string) => void): void {
  preview.addEventListener('click', (event) => {
    const button = (event.target as Element).closest?.<HTMLButtonElement>('.code-copy')
    const code = button?.parentElement?.querySelector(':scope > code')
    if (!button || !code || !preview.contains(button)) return
    // コードの最後の改行（閉じるフェンスの前の改行）は、写さない
    const text = (code.textContent ?? '').replace(/\n$/, '')
    const focused = document.activeElement
    let copied = false
    try {
      copied = copyText(text)
    } catch (error) {
      console.error('コードをコピーできませんでした', error)
    }
    // コピーのために一時的な欄へ移ったフォーカスを、押す前の場所に戻す（Safari は、ボタンを押してもフォーカスを移さないので、
    // エディタに入力していたならエディタに戻す）
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true })
    if (!copied) {
      onError('Could not copy the code')
      return
    }
    setIcon(button, Check, 'Copied')
    setTimeout(() => setIcon(button, Copy, 'Copy code'), COPIED_DURATION)
  })
}

/**
 * text をクリップボードに書き込み、書き込めたかを返す。navigator.clipboard は、SN の iframe に allow="clipboard-write" がないので、
 * Chromium 系（デスクトップ版の Electron を含む）では Permissions Policy に拒否される。そのため、非推奨だがその対象外の
 * execCommand('copy') で、一時的な欄の文字を選んで写す
 */
function copyText(text: string): boolean {
  const buffer = element('textarea', 'copy-buffer')
  buffer.value = text
  // iOS で、フォーカスしたときにキーボードを出さない
  buffer.readOnly = true
  document.body.append(buffer)
  try {
    buffer.select()
    // iOS は select() だけでは、読み取り専用の欄の文字を選ばない
    buffer.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } finally {
    buffer.remove()
  }
}

function setIcon(button: HTMLButtonElement, icon: IconNode, label: string): void {
  button.title = label
  button.setAttribute('aria-label', label)
  button.replaceChildren(createElement(icon, { width: 14, height: 14, 'aria-hidden': 'true' }))
}
