// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { isDarkColor, watchAppearance } from './appearance'

describe('isDarkColor', () => {
  it.each([
    ['rgb(255, 255, 255)', false],
    ['rgb(246, 246, 246)', false],
    ['rgb(15, 16, 17)', true],
    ['rgb(32, 32, 43)', true], // Midnight の背景（#20202b）
    ['rgb(118, 118, 118)', false], // 境目のすぐ上（相対輝度 0.181）
    ['rgb(115, 115, 115)', true], // 境目のすぐ下（相対輝度 0.171）
    ['rgba(15, 16, 17, 0.5)', true],
    ['rgb(15 16 17 / 50%)', true],
  ])('%s → %s', (color, dark) => {
    expect(isDarkColor(color)).toBe(dark)
  })

  it('透明と読めない形式は明るい側に倒す', () => {
    expect(isDarkColor('rgba(0, 0, 0, 0)')).toBe(false)
    expect(isDarkColor('oklch(0.2 0.01 260)')).toBe(false)
    expect(isDarkColor('')).toBe(false)
  })
})

describe('watchAppearance', () => {
  const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

  afterEach(() => {
    document.head.querySelectorAll('link').forEach((link) => link.remove())
    document.body.style.backgroundColor = ''
  })

  it('テーマの link が読み込まれたら判定し直し、明暗が変わったときだけ知らせる。link が外れたら判定し直す', async () => {
    const changes: string[] = []
    expect(watchAppearance((appearance) => changes.push(appearance))).toBe('light')

    const link = document.createElement('link')
    link.className = 'custom-theme'
    document.head.append(link)
    await nextTask()
    document.body.style.backgroundColor = 'rgb(15, 16, 17)'
    link.dispatchEvent(new Event('load'))
    expect(changes).toEqual(['dark'])

    const other = document.createElement('link')
    other.className = 'custom-theme'
    document.head.append(other)
    await nextTask()
    other.dispatchEvent(new Event('load'))
    expect(changes).toEqual(['dark'])

    document.body.style.backgroundColor = ''
    link.remove()
    other.remove()
    await nextTask()
    expect(changes).toEqual(['dark', 'light'])
  })

  it('テーマ以外の link は見ない', async () => {
    const changes: string[] = []
    watchAppearance((appearance) => changes.push(appearance))
    const link = document.createElement('link')
    document.head.append(link)
    await nextTask()
    document.body.style.backgroundColor = 'rgb(15, 16, 17)'
    link.dispatchEvent(new Event('load'))
    expect(changes).toEqual([])
  })
})
