import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Custom plugin to inject "built by scout" tag
function injectBuiltByScoutPlugin() {
  return {
    name: 'inject-built-by-scout',
    transformIndexHtml(html: string) {
      // Inject the scout tag script reference
      const scriptTag = '<script defer src="/scout-tag.js"></script>';
      
      // Inject the script before the closing body tag
      return html.replace('</body>', scriptTag + '\n  </body>');
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), injectBuiltByScoutPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // PWA Configuration
  define: {
    __SW_URL__: JSON.stringify('/sw.js'),
  },
  // Ensure service worker is accessible
  publicDir: 'public',
  // Build configuration for PWA
  build: {
    rollupOptions: {
      output: {
        // Ensure service worker is not hashed
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'sw.js') {
            return 'sw.js';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
