/**
 * Vercel Serverless Entry Point (source lives here, compiled to api/server.js
 * by script/build.ts). Vercel routes all /api/* requests here (see
 * vercel.json). Static files (the Vite-built frontend) are served by
 * Vercel's CDN from dist/.
 *
 * Local dev: `npm run dev` (tsx, server/index.ts).
 * Production: `npm run build`, then deploy to Vercel.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import { router } from "./routes";

const app = express();
app.use(express.json());
app.use(router);

// Final safety net — any route error that reaches here (e.g. an
// OneDrive/Graph failure not already handled locally) gets a clean JSON
// response instead of a hung request.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[unhandled route error]", err);
  if (!res.headersSent) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default function handler(req: Request, res: Response) {
  app(req, res);
}
