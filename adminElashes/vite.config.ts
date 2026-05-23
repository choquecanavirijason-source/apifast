import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'

//https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      // En `vite dev` / build web no hace falta el paquete Tauri instalado.
      ...(process.env.TAURI_ENV_PLATFORM
        ? {}
        : {
            '@tauri-apps/api/core': path.resolve(process.cwd(), 'src/lib/tauri-api-core-stub.ts'),
          }),
    },
  },
  base: '/',
  build: {
    outDir: '../server/public/app',
    emptyOutDir: true,
  },
})
