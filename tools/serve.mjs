// A plain static server for looking at the app on this machine:
//
//   node tools/serve.mjs            →  http://127.0.0.1:5160/
//
// The app has no build step, so serving site/ is all it takes. The port is fixed (PORT=… to
// change it); if it's busy this stops with an error rather than quietly picking another one.
// HOST=0.0.0.0 lets a phone on the same network reach it.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../site/', import.meta.url));
const PORT = Number(process.env.PORT) || 5160;
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  if (!path || path.endsWith(sep) || path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('no');
    return;
  }
  try {
    const body = await readFile(file);
    // never cached: an edit shows up on the next reload
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is in use. Stop whatever has it, or set PORT.` : e);
  process.exit(1);
});
server.listen(PORT, HOST, () => console.log(`Ambiance at http://${HOST}:${PORT}/`));
