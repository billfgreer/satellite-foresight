import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/satellite-foresight/',
  server: { port: 5175, strictPort: true },

  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor'
        },
      },
    },
  },
})
