import { describe, expect, it } from 'vitest'
import { savedFormatBar, savedMode, withFormatBar, withMode } from './preferences'

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

describe('savedFormatBar', () => {
  it('保存がなければ、どの環境でも表示する', () => {
    expect(savedFormatBar({}, 'mobile')).toBe(true)
    expect(savedFormatBar({}, 'desktop')).toBe(true)
  })

  it('環境ごとに保存した値を使い、真偽値でなければ表示する', () => {
    const preferences = { formatBar: { mobile: false, desktop: 'no' } }
    expect(savedFormatBar(preferences, 'mobile')).toBe(false)
    expect(savedFormatBar(preferences, 'desktop')).toBe(true)
    expect(savedFormatBar(preferences, 'web')).toBe(true)
  })
})

describe('withFormatBar', () => {
  it('その環境の値だけを書き換え、モードなどほかの設定は残す', () => {
    const preferences = { modes: { mobile: 'edit' }, formatBar: { desktop: true } }
    expect(withFormatBar(preferences, 'mobile', false)).toEqual({ modes: { mobile: 'edit' }, formatBar: { desktop: true, mobile: false } })
  })
})
