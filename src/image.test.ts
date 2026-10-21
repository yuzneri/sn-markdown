// @vitest-environment jsdom
// FileReader と File が要るので jsdom で動かす
import { describe, expect, it } from 'vitest'
import { imageMarkdown, imageToMarkdown, isEmbeddable } from './image'

describe('imageToMarkdown', () => {
  it('画像をそのまま data: URL にして埋め込む', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', { type: 'image/png' })
    expect(await imageToMarkdown(file)).toBe('![shot](data:image/png;base64,iVBORw==)')
  })

  it('プレビューで表示できない形式は断る', async () => {
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })
    await expect(imageToMarkdown(svg)).rejects.toThrow('Unsupported image type: image/svg+xml')
    await expect(imageToMarkdown(new File(['x'], 'a.bin'))).rejects.toThrow('Unsupported image type: unknown')
  })
})

describe('isEmbeddable', () => {
  it('PNG・JPEG・GIF・WebP だけを埋め込める', () => {
    expect(['image/png', 'image/jpeg', 'image/gif', 'image/webp'].every(isEmbeddable)).toBe(true)
    expect(['image/svg+xml', 'image/heic', 'image/avif', 'image/bmp', ''].some(isEmbeddable)).toBe(false)
  })
})

describe('imageMarkdown', () => {
  it('ファイル名から拡張子を除いて代替テキストにする', () => {
    expect(imageMarkdown('Screenshot 2026-10-21.png', 'data:image/png;base64,AAAA')).toBe(
      '![Screenshot 2026-10-21](data:image/png;base64,AAAA)',
    )
  })

  it('代替テキストの [ ] \\ はエスケープする。名前がなければ image にする', () => {
    expect(imageMarkdown('a[1]\\b.jpg', 'data:x')).toBe('![a\\[1\\]\\\\b](data:x)')
    expect(imageMarkdown('.png', 'data:x')).toBe('![image](data:x)')
    expect(imageMarkdown('', 'data:x')).toBe('![image](data:x)')
  })
})
