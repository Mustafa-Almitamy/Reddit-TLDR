import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: {
      port: 5173
    },
    proxy: {
      '/api/reddit': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});