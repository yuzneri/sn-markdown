import { describe, expect, it } from 'vitest'
import { savedMode, withMode } from './preferences'

describe('savedMode', () => {
  it('保存がなければ環境ごとの既定（モバイルは edit、ほかは split）', () => {
    expect(savedMode({}, 'mobile')).toBe('edit')
    expect(savedMode({}, 'desktop')).toBe('split')
    expect(savedMode({}, 'web')).toBe('split')
  })

  it('環境ごとに保存したモードを使う', () => {
    const preferences = { modes: { desktop: 'preview', mobile: 'split' } }
    expect(savedMode(preferences, 'desktop')).toBe('preview')
    expect(savedMode(preferences, 'mobile')).toBe('split')
    expect(savedMode(preferences, 'web')).toBe('split')
  })

  it('知らない値や壊れた形は既定に戻す', () => {
    expect(savedMode({ modes: { web: 'wysiwyg' } }, 'web')).toBe('split')
    expect(savedMode({ modes: 'preview' }, 'web')).toBe('split')
    expect(savedMode({ modes: null }, 'mobile')).toBe('edit')
  })
})

describe('withMode', () => {
  it('その環境のモードだけを書き換え、ほかの環境とほかの設定は残す', () => {
    const preferences = { modes: { desktop: 'preview' }, other: 1 }
    expect(withMode(preferences, 'mobile', 'split')).toEqual({ modes: { desktop: 'preview', mobile: 'split' }, other: 1 })
    expect(preferences).toEqual({ modes: { desktop: 'preview' }, other: 1 })
  })

  it('壊れた形の modes は作り直す', () => {
    expect(withMode({ modes: 'x' }, 'web', 'edit')).toEqual({ modes: { web: 'edit' } })
  })
})
