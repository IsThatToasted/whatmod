import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/life/',
  plugins: [react()],
  build: {
    sourcemap: true,
    target: 'es2020',
    chunkSizeWarningLimit: 700
  }
})
