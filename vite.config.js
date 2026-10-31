import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    strictPort: true,
    hmr: { overlay: true },
  },
  build: {
    sourcemap: false,
    target: 'chrome130',
  },
});
