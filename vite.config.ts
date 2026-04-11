import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5175,
    proxy: {
      // En dev, proxifie les appels /api vers le serveur Express local
      '/api': 'http://localhost:3001',
    },
  },
})
