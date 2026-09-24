import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
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

/**
 * Ported from PlannerXchange's own official starter template
 * (github.com/PlannerXchange/plannerxchange-template/blob/main/vite.config.ts)
 * — generates the two files PlannerXchange review requires in the committed
 * dist output: `plannerxchange.publish.json` (maps the manifest entryPoint to
 * the hosted JS/CSS) and `plannerxchange.build-provenance.json` (source/
 * lockfile/artifact digests PlannerXchange verifies before upload). Adapted
 * only for our repo's own appRoot/distRoot ("client" / "dist/public") — the
 * digest logic itself is unchanged.
 */
const rootDir = __dirname;
const manifestPath = "plannerxchange.app.json";
const publishManifestFileName = "plannerxchange.publish.json";
const buildProvenanceFileName = "plannerxchange.build-provenance.json";

interface FileDigest {
  path: string;
  sha256: string;
  sizeBytes: number;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isPathWithin(filePath: string, rootPath: string): boolean {
  return filePath === rootPath || filePath.startsWith(`${rootPath.replace(/\/+$/, "")}/`);
}

const appBoundary = {
  appRoot: "client",
  distRoot: "dist/public",
  workspacePackage: null as string | null,
  entryPoint: "src/plugin.tsx",
  pluginSourcePath: "client/src/plugin.tsx",
  buildProvenancePath: `dist/public/${buildProvenanceFileName}`,
};

function sha256Hex(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function createFileDigest(filePath: string, body: string | Uint8Array): FileDigest {
  const buffer = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
  return { path: filePath, sha256: sha256Hex(buffer), sizeBytes: buffer.length };
}

function sortFileDigests(files: FileDigest[]): FileDigest[] {
  return files.map((f) => ({ ...f })).sort((a, b) => a.path.localeCompare(b.path));
}

function buildAggregateDigest(files: FileDigest[]): string {
  const hash = createHash("sha256");
  for (const file of sortFileDigests(files)) {
    hash.update(file.path, "utf8");
    hash.update("\0", "utf8");
    hash.update(file.sha256, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(file.sizeBytes), "utf8");
    hash.update("\n", "utf8");
  }
  return hash.digest("hex");
}

function isDependencyLockfilePath(filePath: string): boolean {
  const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);
  return fileName === "package-lock.json" || fileName === "npm-shrinkwrap.json" || fileName === "yarn.lock" || fileName === "pnpm-lock.yaml" || fileName === "bun.lock" || fileName === "bun.lockb";
}

function isBuildInputPath(filePath: string): boolean {
  const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);
  if (isPathWithin(filePath, appBoundary.distRoot) || filePath.startsWith("node_modules/") || filePath.startsWith(".git/") || filePath.startsWith("build/") || filePath.startsWith("coverage/")) {
    return false;
  }
  return (
    filePath === manifestPath ||
    filePath === "package.json" ||
    isDependencyLockfilePath(filePath) ||
    fileName === "index.html" ||
    fileName === "tsconfig.json" ||
    fileName.startsWith("vite.config.") ||
    isPathWithin(filePath, "client/src") ||
    isPathWithin(filePath, "client/public") ||
    isPathWithin(filePath, "shared")
  );
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relPath = normalizeRelativePath(relative(rootDir, fullPath));
    if (relPath === ".git" || relPath === "node_modules" || relPath === "dist" || isPathWithin(relPath, appBoundary.distRoot) || relPath === "build" || relPath === "coverage") continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...walkFiles(fullPath));
    else if (stat.isFile()) files.push(fullPath);
  }
  return files;
}

function readBuildInputDigests(): FileDigest[] {
  return sortFileDigests(
    walkFiles(rootDir)
      .map((filePath) => ({ fullPath: filePath, relPath: normalizeRelativePath(relative(rootDir, filePath)) }))
      .filter((f) => isBuildInputPath(f.relPath))
      .map((f) => createFileDigest(f.relPath, readFileSync(f.fullPath)))
  );
}

function readLockfileDigests(): FileDigest[] {
  const candidates = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"];
  return sortFileDigests(
    candidates.filter((f) => existsSync(resolve(rootDir, f))).map((f) => createFileDigest(f, readFileSync(resolve(rootDir, f))))
  );
}

function walkOutputFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...walkOutputFiles(fullPath));
    else if (stat.isFile()) files.push(fullPath);
  }
  return files;
}

function readDistArtifactDigests(outputDir: string): FileDigest[] {
  return sortFileDigests(
    walkOutputFiles(outputDir)
      .map((filePath) => ({ fullPath: filePath, relPath: normalizeRelativePath(relative(rootDir, filePath)) }))
      .filter((f) => f.relPath !== appBoundary.buildProvenancePath)
      .map((f) => createFileDigest(f.relPath, readFileSync(f.fullPath)))
  );
}

function inferPackageManager(lockfileDigests: FileDigest[]): "npm" | "yarn" | "pnpm" | "bun" | "unknown" {
  const paths = new Set(lockfileDigests.map((f) => f.path));
  if (paths.has("package-lock.json") || paths.has("npm-shrinkwrap.json")) return "npm";
  if (paths.has("pnpm-lock.yaml")) return "pnpm";
  if (paths.has("yarn.lock")) return "yarn";
  if (paths.has("bun.lock") || paths.has("bun.lockb")) return "bun";
  return "unknown";
}

function plannerXchangePublishManifestPlugin(): Plugin {
  return {
    name: "plannerxchange-publish-manifest",
    generateBundle(_, bundle) {
      const pluginEntryChunk = Object.values(bundle).find(
        (entry): entry is Extract<(typeof bundle)[string], { type: "chunk" }> =>
          entry.type === "chunk" && entry.isEntry && typeof entry.facadeModuleId === "string" && normalizeRelativePath(entry.facadeModuleId).endsWith(`/${appBoundary.pluginSourcePath}`)
      );
      if (!pluginEntryChunk) {
        throw new Error(`Unable to find built output for ${appBoundary.pluginSourcePath}.`);
      }
      const publishManifestSource = `${JSON.stringify(
        {
          schemaVersion: 1,
          appRoot: appBoundary.appRoot,
          distRoot: appBoundary.distRoot,
          workspacePackage: appBoundary.workspacePackage,
          entryPoints: {
            [appBoundary.entryPoint]: {
              file: pluginEntryChunk.fileName,
              css: pluginEntryChunk.viteMetadata?.importedCss ? [...pluginEntryChunk.viteMetadata.importedCss] : [],
            },
          },
        },
        null,
        2
      )}\n`;
      this.emitFile({ type: "asset", fileName: publishManifestFileName, source: publishManifestSource });
    },
    writeBundle(options) {
      const outputDir = options.dir ? resolve(rootDir, options.dir) : resolve(rootDir, "dist/public");
      const artifactDigests = readDistArtifactDigests(outputDir);
      const lockfileDigests = readLockfileDigests();
      const sourceInputDigests = readBuildInputDigests();
      const sourceInputTotalBytes = sourceInputDigests.reduce((sum, f) => sum + f.sizeBytes, 0);
      const buildProvenanceSource = `${JSON.stringify(
        {
          schemaVersion: "build_provenance_v1",
          appRoot: appBoundary.appRoot,
          distRoot: appBoundary.distRoot,
          workspacePackage: appBoundary.workspacePackage,
          sourceInputDigest: buildAggregateDigest(sourceInputDigests),
          sourceInputFileCount: sourceInputDigests.length,
          sourceInputTotalBytes,
          buildCommand: "npm run build",
          packageManager: inferPackageManager(lockfileDigests),
          nodeVersion: process.version,
          builder: {
            type: "committed_dist_attestation",
            source: appBoundary.buildProvenancePath,
            name: "plannerxchange-template-vite-plugin",
          },
          aggregateArtifactDigest: buildAggregateDigest(artifactDigests),
          dependencyLockfileDigests: lockfileDigests,
          files: artifactDigests,
        },
        null,
        2
      )}\n`;
      writeFileSync(join(outputDir, buildProvenanceFileName), buildProvenanceSource);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), plannerXchangeArtifactHtml(), plannerXchangePublishManifestPlugin()],
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
