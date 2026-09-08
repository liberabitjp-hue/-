import { defineConfig } from 'vitest/config'

// 別紙5.2「正解データを用いた回帰テスト」用の設定。
// アプリ本体のビルド（vite.config.ts, npm run build）には一切関与しない
// 独立した設定ファイルで、`npm test` からのみ使う。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
