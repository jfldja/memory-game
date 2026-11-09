// 建置：src/ → dist/，並以版本號覆寫 dist/js/version.js（spec.md 第 11 節，EQ-9）。
// 只用 Node.js 內建模組。
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION_PATTERN = /^\d+\.\d+\.\d+\+([0-9a-f]{7}|dev)$/;

/**
 * 計算版本號：`<package.json version>+<commit 短碼 7 碼>`。
 * 短碼依序取自 buildSha（BUILD_SHA 前 7 碼）、gitShortSha、'dev'。
 * @param {{ pkgVersion: string, buildSha?: string|null, gitShortSha?: string|null }} input
 * @returns {string}
 */
export function computeVersion({ pkgVersion, buildSha, gitShortSha }) {
  let short;
  if (buildSha) {
    short = buildSha.trim().toLowerCase().slice(0, 7);
  } else if (gitShortSha) {
    short = gitShortSha.trim().toLowerCase().slice(0, 7);
  } else {
    short = 'dev';
  }
  const version = `${pkgVersion}+${short}`;
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`版本號格式不符：${JSON.stringify(version)}（BUILD_SHA 或 git 短碼必須為至少 7 碼的十六進位）`);
  }
  return version;
}

/** @param {string} version */
export function versionModuleSource(version) {
  return `export const APP_VERSION = '${version}';\n`;
}

/** 讀取 git 短碼；不是 git 版本庫或沒有 git 時回傳 null。 */
export function readGitShortSha(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * 把 srcDir 完整複製到 outDir（先清空 outDir），再覆寫 outDir/js/version.js。
 * @param {{ srcDir: string, outDir: string, version: string }} options
 */
export function build({ srcDir, outDir, version }) {
  rmSync(outDir, { recursive: true, force: true });
  cpSync(srcDir, outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'js', 'version.js'), versionModuleSource(version));
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const buildSha = process.env.BUILD_SHA || null;
  const version = computeVersion({
    pkgVersion: pkg.version,
    buildSha,
    gitShortSha: buildSha ? null : readGitShortSha(root),
  });
  build({ srcDir: path.join(root, 'src'), outDir: path.join(root, 'dist'), version });
  console.log(`build: dist/ 已建立，版本 ${version}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
