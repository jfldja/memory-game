// 探測 PR C 診斷（不合併）：在 macOS 上重現 AC-EQ-9 第一個測試的建置與伺服器步驟。
import { cpSync, mkdtempSync, realpathSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
console.log('os.tmpdir =', tmpdir());
const tmp = mkdtempSync(path.join(tmpdir(), 'diag-'));
console.log('tmp =', tmp, '| realpath =', realpathSync(tmp));
for (const p of ['package.json', 'src', 'scripts']) cpSync(path.join(ROOT, p), path.join(tmp, p), { recursive: true });
execFileSync(process.execPath, [path.join(tmp, 'scripts/build.mjs')], {
  env: { ...process.env, BUILD_SHA: 'a'.repeat(40) },
  stdio: 'inherit',
});
console.log('tmp entries =', readdirSync(tmp));
try { console.log('dist entries =', readdirSync(path.join(tmp, 'dist'))); } catch (e) { console.log('dist missing:', e.message); }
try { console.log('realpath dist entries =', readdirSync(path.join(realpathSync(tmp), 'dist'))); } catch (e) { console.log('realpath dist missing:', e.message); }
const { startServer } = await import(path.join(ROOT, 'scripts/serve.mjs'));
const server = await startServer({ root: path.join(tmp, 'dist'), port: 0 });
const { port } = server.address();
for (const u of ['/', '/js/main.js', '/js/version.js']) {
  const r = await fetch(`http://127.0.0.1:${port}${u}`);
  console.log(u, r.status, (await r.text()).slice(0, 150).replace(/\n/g, ' '));
}
server.close();
