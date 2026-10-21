import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteUpdate } from './bridge'

const fake = vi.hoisted(() => ({
  listener: undefined as ((text: string) => void) | undefined,
  locked: (): boolean => false,
  text: '',
  environment: undefined as string | undefined,
}))

vi.mock('sn-extension-api', () => ({
  default: {
    initialize: () => {},
    subscribe: (listener: (text: string) => void) => {
      fake.listener = listener
    },
    get locked() {
      return fake.locked()
    },
    set text(value: string) {
      fake.text = value
    },
    get environment() {
      return fake.environment
    },
  },
}))

const { connectNote } = await import('./bridge')

function connect() {
  const updates: NoteUpdate[] = []
  const bridge = connectNote((update) => updates.push(update))
  const receive = (text: string) => fake.listener?.(text)
  return { bridge, updates, receive }
}

describe('connectNote', () => {
  beforeEach(() => {
    fake.locked = () => false
    fake.environment = undefined
  })

  it('最初に届いた本文をエディタに渡す', () => {
    const { updates, receive } = connect()
    receive('# a')
    expect(updates).toEqual([{ text: '# a', locked: false }])
  })

  it('本文が変わらない通知（ロックの切り替え等）では本文を渡さない', () => {
    const { updates, receive } = connect()
    receive('# a')
    fake.locked = () => true
    receive('# a')
    expect(updates.at(-1)).toEqual({ locked: true })
  })

  it('自分が保存した本文と同じ通知では本文を渡さず、外部の変更は渡す', () => {
    const { bridge, updates, receive } = connect()
    receive('# a')
    bridge.save('# ab')
    expect(fake.text).toBe('# ab')
    receive('# ab')
    expect(updates.at(-1)).toEqual({ locked: false })
    receive('# changed elsewhere')
    expect(updates.at(-1)).toEqual({ text: '# changed elsewhere', locked: false })
  })

  it('appData にロックのドメインがない（getter が TypeError を投げる）ノートはロックなしとみなす', () => {
    fake.locked = () => {
      throw new TypeError("Cannot read properties of undefined (reading 'locked')")
    }
    const { updates, receive } = connect()
    receive('# a')
    expect(updates).toEqual([{ text: '# a', locked: false }])
  })

  it('TypeError 以外の例外は握りつぶさない', () => {
    fake.locked = () => {
      throw new Error('unexpected')
    }
    const { receive } = connect()
    expect(() => receive('# a')).toThrow('unexpected')
  })

  it('環境は desktop と mobile 以外を web とみなす', () => {
    const { bridge } = connect()
    fake.environment = 'mobile'
    expect(bridge.environment).toBe('mobile')
    fake.environment = undefined
    expect(bridge.environment).toBe('web')
  })
})
