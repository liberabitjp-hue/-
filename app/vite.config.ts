import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// This app must run by double-clicking a file on a Windows PC with no
// server, no install and no admin rights (see instructions section 2).
// Chrome refuses to load separate <script type="module"> / <link
// stylesheet> files over file:// (CORS blocks it - origin "null"), so we
// inline everything (JS + CSS) into one self-contained index.html instead
// of relying on relative asset paths.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
})
