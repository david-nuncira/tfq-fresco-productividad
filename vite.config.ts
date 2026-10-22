/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite para TFQ Fresco | Productividad.
// La aplicación se compila a archivos estáticos en la carpeta `dist`,
// que es la que publica Cloudflare Pages.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
