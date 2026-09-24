import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Strips any CDN font <link> tags from the built index.html — PlannerXchange
// treats network fetches baked into the published artifact as undeclared
// egress, so fonts need to be system/bundled, not fetched from a CDN.
const plannerXchangeArtifactHtml = () => ({
  name: "plannerxchange-artifact-html",
  apply: "build" as const,
  transformIndexHtml(html: string) {
    return html
      .replace(/\s*<link[^>]+href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*>\s*/gi, "\n")
      .replace(/\s*<link[^>]+href=["']https:\/\/fonts\.gstatic\.com[^"']*["'][^>]*>\s*/gi, "\n");
  },
});

export default defineConfig({
  base: "./",
  plugins: [react(), plannerXchangeArtifactHtml()],
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    manifest: true,
    minify: "terser",
    terserOptions: {
      mangle: {
        reserved: ["mount", "pluginModule", "manifest"],
      },
    },
    rollupOptions: {
      input: {
        plugin: path.resolve(__dirname, "client", "src", "plugin.tsx"),
      },
      preserveEntrySignatures: "exports-only",
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
