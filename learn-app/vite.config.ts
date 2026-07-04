import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from /learn/ on the existing static site.
// Build output goes to ../learn so any static host serves it with no config.
export default defineConfig({
  plugins: [react()],
  base: '/learn/',
  build: {
    outDir: '../learn',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
