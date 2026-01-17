import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Output to backend's static directory for Heroku deployment
    outDir: path.resolve(__dirname, '../backend/staticfiles/frontend'),
    emptyOutDir: true,
  },
})
