import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Separate build for reports.namotech.in (public report view from the QR code).
 * Output: dist-public/ (index.html, assets/, .htaccess, api.php), copied to the subdomain by .cpanel.yml.
 */
export default defineConfig({
  root: resolve(__dirname, "public-report"),
  publicDir: resolve(__dirname, "public-report/static"),
  base: "/",
  // Local testing: npm run build, then npx vite preview -c vite.public.config.ts and open /r/{token}
  // (preview uses this proxy; the dev server can't load ../src from outside the root)
  server: {
    proxy: {
      "/api": { target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  build: {
    outDir: resolve(__dirname, "dist-public"),
    emptyOutDir: true,
  },
});
