// @joplin/turndown-plugin-gfm は型定義を持たない。使うのは gfm（表、取り消し線、タスクをまとめたプラグイン）だけ
declare module '@joplin/turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  export const gfm: TurndownService.Plugin
}
