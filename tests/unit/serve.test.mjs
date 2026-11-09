// 模組單元測試：scripts/serve.mjs。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveRequestPath, contentTypeFor, startServer } from '../../scripts/serve.mjs';

describe('resolveRequestPath', () => {
  const root = path.resolve('/srv/site');

  test('「/」與以「/」結尾的路徑對應 index.html；查詢字串被忽略', () => {
    assert.equal(resolveRequestPath(root, '/'), path.join(root, 'index.html'));
    assert.equal(resolveRequestPath(root, '/a/'), path.join(root, 'a', 'index.html'));
    assert.equal(resolveRequestPath(root, '/js/main.js?v=1'), path.join(root, 'js', 'main.js'));
  });

  test('離開根目錄的路徑回傳 null', () => {
    // URL 解析會先把「%2e%2e」正規化，結果仍在根目錄內
    assert.equal(resolveRequestPath(root, '/%2e%2e/secret'), path.join(root, 'secret'));
    // 編碼的「/」在解碼後才出現，必須由路徑檢查擋下
    assert.equal(resolveRequestPath(root, '/..%2fsecret'), null);
    assert.equal(resolveRequestPath(root, '/..%2f..%2fetc/passwd'), null);
    assert.equal(resolveRequestPath(root, '/a%00b'), null);
    assert.equal(resolveRequestPath(root, '/%E0%A4%A'), null);
  });
});

describe('contentTypeFor', () => {
  test('ES 模組以 JavaScript 型別提供（瀏覽器要求）', () => {
    assert.match(contentTypeFor('a/main.js'), /^text\/javascript/);
    assert.match(contentTypeFor('index.html'), /^text\/html/);
    assert.match(contentTypeFor('style.CSS'), /^text\/css/);
    assert.equal(contentTypeFor('x.unknown'), 'application/octet-stream');
  });
});

describe('startServer', () => {
  test('提供檔案、目錄的 index.html，不存在時 404，不允許 POST', async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'serve-'));
    mkdirSync(path.join(tmp, 'js'));
    writeFileSync(path.join(tmp, 'index.html'), '<p>hi</p>');
    writeFileSync(path.join(tmp, 'js', 'a.js'), 'export {};');
    const server = await startServer({ root: tmp, port: 0 });
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      let res = await fetch(`${base}/`);
      assert.equal(res.status, 200);
      assert.equal(await res.text(), '<p>hi</p>');
      res = await fetch(`${base}/js/a.js`);
      assert.match(res.headers.get('content-type'), /^text\/javascript/);
      await res.arrayBuffer();
      res = await fetch(`${base}/js`);
      assert.equal(res.status, 404);
      await res.arrayBuffer();
      res = await fetch(`${base}/missing.js`);
      assert.equal(res.status, 404);
      await res.arrayBuffer();
      res = await fetch(`${base}/`, { method: 'POST' });
      assert.equal(res.status, 405);
      await res.arrayBuffer();
    } finally {
      await new Promise((r) => server.close(r));
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
