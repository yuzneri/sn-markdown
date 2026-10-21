import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages のサブパスとデスクトップ版のローカル配信（/Extensions/<id>/）の両方で動くよう相対パスにする
  base: './',
  test: {
    environment: 'node',
  },
})
