import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  // Usar esbuild para minificar y dropear console/debugger
  esbuild: {
    target: 'es2020',
    drop: ['console', 'debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },

  build: {
    target: 'es2020',
    minify: 'esbuild', // ← evita requerir 'terser'
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
          ],
          'utils-vendor': ['@turf/turf', 'date-fns', 'clsx', 'tailwind-merge'],

          // Feature chunks
          'admin-features': [
            './src/components/AdminPanel.jsx',
            './src/components/ReportsPanel.jsx',
          ],
          'map-features': [
            './src/components/MapComponent.jsx',
            './src/components/Reportes/ReportButton.jsx',
            './src/components/Reportes/ReportModal.jsx',
          ],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    cssCodeSplit: true,
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
  },

  server: {
    hmr: { overlay: false },
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all',
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'leaflet',
      'react-leaflet',
      '@turf/turf',
    ],
    exclude: [],
  },

  assetsInclude: ['**/*.geojson'],
  publicDir: 'public',
})
