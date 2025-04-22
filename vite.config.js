import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: {}  // Polyfill `global` for browser :contentReference[oaicite:4]{index=4}
  }
});