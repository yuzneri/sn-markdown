// ノートに埋め込める形式。プレビューの markdown-it（validateLink）が data: として通すのはこの 4 つだけなので、
// ほかの形式（SVG、HEIC、AVIF など）は埋め込んでも表示されない
const EMBEDDABLE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export function isEmbeddable(type: string): boolean {
  return EMBEDDABLE_TYPES.includes(type)
}

/** 画像をそのまま data: URL にして、ノートに埋め込む Markdown（`![名前](data:…)`）にする。縮小や再圧縮はしない */
export async function imageToMarkdown(file: File): Promise<string> {
  if (!isEmbeddable(file.type)) throw new Error(`Unsupported image type: ${file.type || 'unknown'} (PNG, JPEG, GIF and WebP only)`)
  return imageMarkdown(file.name, await readAsDataUrl(file))
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 埋め込みの Markdown。代替テキストはファイル名（拡張子を除く）。[ ] \ はエスケープする */
export function imageMarkdown(fileName: string, dataUrl: string): string {
  const alt = fileName.replace(/\.[^.]*$/, '').replace(/[\\[\]]/g, '\\$&') || 'image'
  return `![${alt}](${dataUrl})`
}
