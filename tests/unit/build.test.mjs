// 模組單元測試：scripts/build.mjs（module-test-standards.md M11）。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeVersion,
  versionModuleSource,
  build,
  VERSION_PATTERN,
} from '../../scripts/build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('computeVersion', () => {
  test('BUILD_SHA 取前 7 碼', () => {
    assert.equal(
      computeVersion({ pkgVersion: '1.0.0', buildSha: '3f9c2ab1e0d4c5b6a7980f1e2d3c4b5a69788776' }),
      '1.0.0+3f9c2ab',
    );
  });

  test('BUILD_SHA 優先於 git 短碼；大寫轉小寫', () => {
    assert.equal(
      computeVersion({ pkgVersion: '1.0.0', buildSha: 'ABCDEF0123', gitShortSha: '1111111' }),
      '1.0.0+abcdef0',
    );
  });

  test('沒有 BUILD_SHA 時用 git 短碼；兩者都沒有時為 dev', () => {
    assert.equal(computeVersion({ pkgVersion: '1.0.0', buildSha: null, gitShortSha: '1234abc\n' }), '1.0.0+1234abc');
    assert.equal(computeVersion({ pkgVersion: '1.0.0', buildSha: '', gitShortSha: null }), '1.0.0+dev');
    assert.equal(computeVersion({ pkgVersion: '1.0.0' }), '1.0.0+dev');
  });

  test('短碼不足 7 碼或不是十六進位時丟出錯誤，不產生格式不符的版本號', () => {
    assert.throws(() => computeVersion({ pkgVersion: '1.0.0', buildSha: 'abc' }), /格式不符/);
    assert.throws(() => computeVersion({ pkgVersion: '1.0.0', buildSha: 'refs/heads/x' }), /格式不符/);
    assert.throws(() => computeVersion({ pkgVersion: '1.0', buildSha: 'abcdef0' }), /格式不符/);
  });

  test('版本號格式符合 ^\\d+\\.\\d+\\.\\d+\\+([0-9a-f]{7}|dev)$', () => {
    assert.ok(VERSION_PATTERN.test('1.0.0+dev'));
    assert.ok(VERSION_PATTERN.test('1.0.0+0123abc'));
    assert.ok(!VERSION_PATTERN.test('1.0.0+0123ABC'));
    assert.ok(!VERSION_PATTERN.test('1.0.0+0123abcd'));
  });
});

describe('versionModuleSource', () => {
  test('產生只含一個常數匯出的模組', () => {
    assert.equal(versionModuleSource('1.0.0+abcdef0'), "export const APP_VERSION = '1.0.0+abcdef0';\n");
  });
});

describe('build：建置到暫存目錄', () => {
  function listAll(dir, rel = '') {
    return readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
      const r = rel ? `${rel}/${e.name}` : e.name;
      return e.isDirectory() ? listAll(dir, r) : [r];
    }).sort();
  }

  test('輸出只含 src 內容，version.js 被覆寫；舊輸出先清除', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'build-'));
    try {
      const src = path.join(tmp, 'src');
      const out = path.join(tmp, 'dist');
      mkdirSync(path.join(src, 'js'), { recursive: true });
      writeFileSync(path.join(src, 'index.html'), '<!doctype html>');
      writeFileSync(path.join(src, 'js', 'version.js'), "export const APP_VERSION = '1.0.0+dev';\n");
      writeFileSync(path.join(src, 'js', 'main.js'), '');
      mkdirSync(out);
      writeFileSync(path.join(out, 'stale.txt'), 'old');

      build({ srcDir: src, outDir: out, version: '1.0.0+abcdef0' });

      assert.deepEqual(listAll(out), ['index.html', 'js/main.js', 'js/version.js']);
      assert.equal(readFileSync(path.join(out, 'js', 'version.js'), 'utf8'), "export const APP_VERSION = '1.0.0+abcdef0';\n");
      assert.equal(readFileSync(path.join(src, 'js', 'version.js'), 'utf8'), "export const APP_VERSION = '1.0.0+dev';\n");
      assert.ok(!existsSync(path.join(out, 'stale.txt')));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('版本庫中的 src/js/version.js 為開發用預設值 1.0.0+dev', () => {
    assert.equal(
      readFileSync(path.join(ROOT, 'src', 'js', 'version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1],
      '1.0.0+dev',
    );
  });

  test('package.json 的 version 為 1.0.0（spec.md 第 11 節、DA-3）', () => {
    assert.equal(JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, '1.0.0');
  });
});
