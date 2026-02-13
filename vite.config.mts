import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';

// Vite config
override
// - root: src/frontend (where index.html + main.jsx live)
// - build.outDir: src/static/llm-console so Flask can serve built assets

export default defineConfig({
  root: resolve(__dirname, 'src/frontend'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'src/static/llm-console'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
