import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',      // Bind to all network interfaces
    port: 3000,           // Specify your desired port (default is 5173)
    https: false,         // Explicitly disable HTTPS
    allowedHosts: [
      'all',
      'cbs-timer.cbs.site.univ-lorraine.fr'
    ],                    // Allow all hosts and explicitly allow your backend's host
    proxy: {
      '/api': {
        target: 'http://cbs-timer.cbs.site.univ-lorraine.fr:4000',
        changeOrigin: true,
        // Optionally, you can rewrite the path if needed:
        // rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
});
