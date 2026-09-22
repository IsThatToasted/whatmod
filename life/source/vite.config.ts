import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const projectDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: resolve(projectDir, 'vite'),
  base: './',
  publicDir: resolve(projectDir, 'public'),
  plugins: [react()],
  build: {
    outDir: resolve(projectDir, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: assetInfo => assetInfo.name?.endsWith('.css') ? 'styles.css' : 'assets/[name][extname]',
      },
    },
  },
})
