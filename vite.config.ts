import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages のサブパスとデスクトップ版のローカル配信（/Extensions/<id>/）の両方で動くよう相対パスにする
  base: './',
  server: {
    // SN の iframe には allow-same-origin がなく Origin が "null" になる。開発ハーネスから読めるよう null だけ追加で許可する。
    // null origin は任意のサイトが sandbox の iframe で作れるため、起動中はこのプロジェクトのソースを外部から読まれうる（公開予定のソースなので許容）
    cors: { origin: ['null', /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/] },
  },
  test: {
    environment: 'node',
  },
})
