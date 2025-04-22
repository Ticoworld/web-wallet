import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Remove the process.env definition block
  define: {
    global: 'window'
  }
});