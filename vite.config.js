import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimizaciones de bundle
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace']
      }
    },
    rollupOptions: {
      output: {
        // Code splitting más granular
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs'
          ],
          'utils-vendor': ['@turf/turf', 'date-fns', 'clsx', 'tailwind-merge'],
          
          // Feature chunks
          'admin-features': [
            './src/components/AdminPanel.jsx',
            './src/components/ReportsPanel.jsx'
          ],
          'map-features': [
            './src/components/MapComponent.jsx',
            './src/components/Reportes/ReportButton.jsx',
            './src/components/Reportes/ReportModal.jsx'
          ]
        },
        // Nombres de archivo con hash para cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Optimizar CSS
    cssCodeSplit: true,
    cssMinify: true,
    // Aumentar límite de chunk warning
    chunkSizeWarningLimit: 1000,
    // Sourcemaps solo en desarrollo
    sourcemap: false
  },
  server: {
    // Optimizaciones de desarrollo
    hmr: {
      overlay: false
    },
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all'
  },
  optimizeDeps: {
    // Pre-bundle dependencias pesadas
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'leaflet',
      'react-leaflet',
      '@turf/turf'
    ],
    exclude: [
      // Excluir dependencias que causan problemas
    ]
  },
  // Configuración de assets
  assetsInclude: ['**/*.geojson'],
  publicDir: 'public'
})

