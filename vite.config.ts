import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// For a GitHub Pages *project* site the app is served from /<repo>/.
// Set BASE_PATH=/your-repo/ in CI (the deploy workflow does this automatically).
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "words.json"],
      manifest: {
        name: "Spanish Vocab Trainer",
        short_name: "Vocab",
        description: "Spaced-repetition trainer for the 5000 most frequent Spanish words",
        theme_color: "#1f2937",
        background_color: "#111827",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json,woff2}"],
        // words.json is ~1 MB; make sure it is precached for offline first run
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ]
});
