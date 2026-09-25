import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(router);

if (process.env.NODE_ENV === "production") {
  const distDir = path.resolve(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

// Final safety net — any route error that reaches here (e.g. an
// OneDrive/Graph failure not already handled locally) gets a clean JSON
// response instead of a hung request.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled route error]", err);
  if (!res.headersSent) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`RTQ API listening on :${port}`);
});
