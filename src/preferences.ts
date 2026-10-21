import type { Environment } from './bridge'

// 全体設定（componentData）は端末間で同期されるので、表示に関わる設定は環境ごとに分けて持つ（{ modes: { web, desktop, mobile } } など）。
// 1 つにすると、モバイルで変えたときにデスクトップまで変わってしまう

export const MODES = ['edit', 'split', 'preview'] as const
export type Mode = (typeof MODES)[number]

/** 保存されたモードがないときのモード。モバイルは画面が狭いので編集だけにする */
export function defaultMode(environment: Environment): Mode {
  return environment === 'mobile' ? 'edit' : 'split'
}

export function savedMode(preferences: Record<string, unknown>, environment: Environment): Mode {
  const value = perEnvironment(preferences, 'modes')[environment]
  return MODES.find((mode) => mode === value) ?? defaultMode(environment)
}

/** モードを書き換えた全体設定。ほかの環境の値とほかの設定は残す */
export function withMode(preferences: Record<string, unknown>, environment: Environment, mode: Mode): Record<string, unknown> {
  return withPerEnvironment(preferences, 'modes', environment, mode)
}

/** 書式バーを表示するか。保存がなければ表示する（モバイルはショートカットを使えないので、ボタンが要る） */
export function savedFormatBar(preferences: Record<string, unknown>, environment: Environment): boolean {
  const value = perEnvironment(preferences, 'formatBar')[environment]
  return typeof value === 'boolean' ? value : true
}

export function withFormatBar(preferences: Record<string, unknown>, environment: Environment, visible: boolean): Record<string, unknown> {
  return withPerEnvironment(preferences, 'formatBar', environment, visible)
}

function perEnvironment(preferences: Record<string, unknown>, key: string): Record<string, unknown> {
  const values = preferences[key]
  return typeof values === 'object' && values !== null ? (values as Record<string, unknown>) : {}
}

function withPerEnvironment(
  preferences: Record<string, unknown>,
  key: string,
  environment: Environment,
  value: unknown,
): Record<string, unknown> {
  return { ...preferences, [key]: { ...perEnvironment(preferences, key), [environment]: value } }
}
