// 本機靜態伺服器（spec.md 第 3、11 節）。只用 Node.js 內建 http。
// 用法：node scripts/serve.mjs <目錄> [連接埠]；連接埠預設取環境變數 PORT，再預設 4173。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 4173;

export const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * 把請求路徑對應到 root 內的檔案路徑；路徑離開 root 時回傳 null。
 * 以「/」結尾的路徑對應 index.html。
 * @param {string} root 絕對路徑
 * @param {string} urlPath 例：'/js/main.js?x=1'
 * @returns {string|null}
 */
export function resolveRequestPath(root, urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(urlPath, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  if (pathname.endsWith('/')) pathname += 'index.html';
  const resolved = path.resolve(root, '.' + pathname);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

/** @param {string} filePath */
export function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * @param {{ root: string, port?: number, host?: string }} options
 * @returns {Promise<import('node:http').Server>}
 */
export function startServer({ root, port = DEFAULT_PORT, host = '127.0.0.1' }) {
  const absRoot = path.resolve(root);
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const filePath = resolveRequestPath(absRoot, req.url ?? '/');
    if (!filePath) {
      res.writeHead(400).end();
      return;
    }
    try {
      let target = filePath;
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      const body = await readFile(target);
      res.writeHead(200, { 'Content-Type': contentTypeFor(target), 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

async function main() {
  const [dir, portArg] = process.argv.slice(2);
  if (!dir) {
    console.error('用法：node scripts/serve.mjs <目錄> [連接埠]');
    process.exit(2);
  }
  const port = Number(portArg ?? process.env.PORT ?? DEFAULT_PORT);
  const server = await startServer({ root: dir, port });
  const { address, port: actual } = server.address();
  console.log(`serve: http://${address}:${actual}/ → ${path.resolve(dir)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
