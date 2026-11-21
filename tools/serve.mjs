// serve.mjs — tiny static file server for the smoke test (dev-only).
// Serves the repo root on http://localhost:<PORT> (default 5599), like Cloudflare
// Pages does, so pages load over http:// rather than file://.
// Usage: node tools/serve.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 5599);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
};

/** Map a URL path to a file inside ROOT, or null if it escapes the root. */
function toFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const file = normalize(join(ROOT, decoded));
  return file.startsWith(ROOT) ? file : null;
}

async function resolveFile(file) {
  const info = await stat(file);
  return info.isDirectory() ? join(file, "index.html") : file;
}

createServer(async (req, res) => {
  const file = toFilePath(req.url);
  if (!file) {
    res.writeHead(403).end();
    return;
  }
  try {
    const target = await resolveFile(file);
    const body = await readFile(target);
    res.writeHead(200, { "content-type": TYPES[extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(PORT, () => console.warn(`Serving ${ROOT} on http://localhost:${PORT}`));
