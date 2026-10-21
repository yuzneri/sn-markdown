import snApi from 'sn-extension-api'

export type Environment = 'web' | 'desktop' | 'mobile'

export interface NoteUpdate {
  /** エディタに反映すべき本文。本文が変わっていない（ロックの切り替えだけ等）なら undefined */
  text?: string
  locked: boolean
}

export interface NoteBridge {
  /** 最初の NoteUpdate を受け取った後でだけ正しい値になる */
  readonly environment: Environment
  save(text: string): void
  readPreferences(): Record<string, unknown>
  writePreferences(preferences: Record<string, unknown>): void
}

// SN はノートごとに iframe を作り直す（NoteView が ComponentViewer をノートの uuid ごとに生成する）ので、
// 1 つの iframe の中で扱うノートは 1 つだけ。ノートの切り替えは考えなくてよい。
export function connectNote(onUpdate: (update: NoteUpdate) => void): NoteBridge {
  let current: string | undefined

  snApi.initialize()
  // 自分の保存は親アプリがエコーせず、同期完了の再送（isMetadataUpdate）は sn-extension-api が捨てるので、
  // ここに届くのは外部からの変更だけ。本文が同じ通知（ロックの切り替え等）でエディタを書き換えるとカーソルが飛ぶので除く
  snApi.subscribe((text) => {
    const locked = isLocked()
    if (text === current) {
      onUpdate({ locked })
    } else {
      current = text
      onUpdate({ text, locked })
    }
  })

  return {
    get environment() {
      return toEnvironment(snApi.environment)
    },
    save(text) {
      current = text
      snApi.text = text
    },
    readPreferences() {
      return snApi.extensionMeta ?? {}
    },
    writePreferences(preferences) {
      snApi.extensionMeta = preferences
    },
  }
}

function isLocked(): boolean {
  try {
    return snApi.locked === true
  } catch (error) {
    // appData に org.standardnotes.sn ドメインがないノートでは sn-extension-api の getter が TypeError を投げる。
    // ドメインがない＝ロックが一度も設定されていないので false とみなす
    if (error instanceof TypeError) return false
    throw error
  }
}

function toEnvironment(value: string | undefined): Environment {
  return value === 'desktop' || value === 'mobile' ? value : 'web'
}
