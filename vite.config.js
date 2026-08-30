import { defineConfig } from 'vite'

// Relative base so the built site works when served from a GitHub Pages
// project path (https://<user>.github.io/<repo>/) without extra config.
export default defineConfig({
  base: './',
})
