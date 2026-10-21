import type { Environment } from './bridge'

export const MODES = ['edit', 'split', 'preview'] as const
export type Mode = (typeof MODES)[number]

/** 保存されたモードがないときのモード。モバイルは画面が狭いので編集だけにする */
export function defaultMode(environment: Environment): Mode {
  return environment === 'mobile' ? 'edit' : 'split'
}

// 全体設定（componentData）は端末間で同期されるので、モードは環境ごとに分けて持つ（{ modes: { web, desktop, mobile } }）。
// 1 つにすると、モバイルで edit にしたときにデスクトップまで edit になる
export function savedMode(preferences: Record<string, unknown>, environment: Environment): Mode {
  const value = modesOf(preferences)[environment]
  return MODES.find((mode) => mode === value) ?? defaultMode(environment)
}

/** モードを書き換えた全体設定。ほかの環境のモードとほかの設定は残す */
export function withMode(preferences: Record<string, unknown>, environment: Environment, mode: Mode): Record<string, unknown> {
  return { ...preferences, modes: { ...modesOf(preferences), [environment]: mode } }
}

function modesOf(preferences: Record<string, unknown>): Record<string, unknown> {
  const modes = preferences.modes
  return typeof modes === 'object' && modes !== null ? (modes as Record<string, unknown>) : {}
}
