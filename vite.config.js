import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/", // servir desde raíz
  plugins: [react()],
  define: { "process.env": {} }, // evita "process is not defined" en runtime
  build: {
    target: "es2019", // mejor compat iOS 16.x
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          map: ["leaflet", "react-leaflet"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
