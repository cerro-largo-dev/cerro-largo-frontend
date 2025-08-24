import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",                      // sirve en raíz
  plugins: [react()],             // asegura JSX/React
  define: { "process.env": {} },  // evita "process is not defined" en runtime
  build: {
    target: "es2019",             // mejor compat Safari iOS 16.x
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react","react-dom","react-router-dom"],
          map: ["leaflet","react-leaflet"],
        },
      },
    },
  },
});
