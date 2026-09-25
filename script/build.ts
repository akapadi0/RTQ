import { build } from "esbuild";
import { execSync } from "child_process";

console.log("Building client (vite)...");
execSync("vite build", { stdio: "inherit" });

console.log("Bundling Vercel API handler...");
await build({
  entryPoints: ["server/vercel-handler.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "api/server.js",
  packages: "external",
});

console.log("Build complete.");
