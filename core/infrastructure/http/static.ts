/**
 * Serving the built application.
 *
 * One origin: the API answers `/api/*`, and everything else is the React build.
 * Reads only — the deployment needs no writable filesystem.
 *
 * Unknown paths return `index.html` so the client-side path switch survives a
 * refresh, which is how the representative arrives most mornings.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export type StaticSite = (req: IncomingMessage, res: ServerResponse, url: URL) => boolean;

/**
 * Returns a handler, or null when no build is present — in development the
 * frontend is served by Vite and this must stay out of the way.
 */
export function staticSite(root = process.env.LIFE_OS_WEB_ROOT ?? "frontend/dist"): StaticSite | null {
  const base = resolve(root);
  if (!existsSync(join(base, "index.html"))) return null;

  return (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") return false;

    // `..` cannot escape the build directory.
    const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const candidate = resolve(join(base, requested));
    const inside = candidate === base || candidate.startsWith(`${base}/`);

    const file = inside && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : join(base, "index.html");

    const type = TYPES[extname(file)] ?? "application/octet-stream";
    // Hashed assets are immutable; the shell is not.
    const cache = file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";

    res.writeHead(200, { "content-type": type, "cache-control": cache });

    if (req.method === "HEAD") { res.end(); return true; }

    createReadStream(file).pipe(res);
    return true;
  };
}
