import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Bind to all network interfaces
    port: 3000,      // Optional: specify a port (default is 5173)
    allowedHosts: 'all'  // Optional: only allow connections from localhost
  }
});
