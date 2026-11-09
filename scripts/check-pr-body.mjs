// PR 說明檢查（spec.md 12.4，docs/workflow.md 第 4.4 節）。只用 Node.js 內建模組。
//
// 用法（CI）：node scripts/check-pr-body.mjs
//   從 GITHUB_EVENT_PATH 的事件檔讀取 pull_request.body（不以 ${{ }} 插值），
//   以目前簽出的版本庫（PR 的 head commit）中的 .claude/skills/<名稱>/SKILL.md 判定版本號。
// 用法（本機）：node scripts/check-pr-body.mjs --body-file <檔案>
//
// 判定邏輯為純函式 evaluatePrBody，供模組單元測試呼叫；review-gate 共用 parseAuthorSessions。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NO_VERSION = '無版本號';
const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** 移除 HTML 註解（PR 範本的填寫說明）。 */
export function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * 取出以 headingPrefix 開頭的二級標題之下、到下一個一級或二級標題之前的行。
 * 同名段落有多個時取第一個。找不到時回傳 null。
 * @param {string} body
 * @param {string} headingPrefix 例：'## 上工檢查'
 * @returns {string[]|null}
 */
export function sectionLines(body, headingPrefix) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trimEnd().startsWith(headingPrefix));
  if (start < 0) return null;
  const out = [];
  for (let k = start + 1; k < lines.length; k++) {
    if (/^#{1,2}\s/.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out;
}

function splitRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * 解析 Markdown 表格：回傳表頭與資料列（去除分隔列）。lines 中第一個表格。
 * @param {string[]} lines
 */
export function parseFirstTable(lines) {
  let header = null;
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    const cells = splitRow(line);
    if (!cells) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    if (!header) header = cells;
    else if (!isSeparatorRow(cells)) rows.push(cells);
  }
  return { header, rows };
}

/**
 * 讀取 SKILL.md 變更紀錄表格最後一列的版本號。
 * 變更紀錄表格：位於標題含「變更紀錄」的段落中、第一欄表頭為「版本」的表格；有多個時取最後一個。
 * @param {string} skillText
 * @returns {string|null} 沒有變更紀錄時為 null
 */
export function latestChangelogVersion(skillText) {
  // 程式碼區塊（``` 或 ~~~）內的標題與表格是範例，不採計
  const lines = [];
  let fence = null;
  for (const line of skillText.split(/\r?\n/)) {
    const f = line.match(/^\s*(```|~~~)/);
    if (f) {
      if (fence === null) fence = f[1];
      else if (f[1] === fence) fence = null;
      lines.push('');
      continue;
    }
    lines.push(fence === null ? line : '');
  }
  let inChangelogSection = false;
  let latest = null;
  for (let k = 0; k < lines.length; k++) {
    const h = lines[k].match(/^(#+)\s+(.*)$/);
    if (h) {
      inChangelogSection = h[2].includes('變更紀錄');
      continue;
    }
    if (!inChangelogSection) continue;
    const cells = splitRow(lines[k]);
    if (!cells || cells[0] !== '版本') continue;
    // 從表頭往下讀到表格結束
    let last = null;
    let m = k + 1;
    for (; m < lines.length; m++) {
      const row = splitRow(lines[m]);
      if (!row) break;
      if (!isSeparatorRow(row) && row[0]) last = row[0];
    }
    if (last) latest = last;
    k = m - 1;
  }
  return latest;
}

/**
 * 從 PR 說明「## 作者」段落取出全部工作階段識別（review-process.md 第 4 節第 2 步）。
 * 每一行符合 `工作階段：<識別>`（全形冒號；可有清單符號），去除前後空白與 HTML 註解。
 * @param {string|null|undefined} body
 * @returns {string[]}
 */
export function parseAuthorSessions(body) {
  const lines = sectionLines(stripHtmlComments(body ?? ''), '## 作者');
  if (!lines) return [];
  const out = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*]\s+)?工作階段：(.*)$/);
    if (!m) continue;
    const id = m[1].trim();
    if (id) out.push(id);
  }
  return out;
}

/**
 * 判定 PR 說明（spec.md 12.4 第 1～4 點）。
 * @param {{ body: string|null|undefined, readSkill: (name: string) => (string|null) }} input
 *   readSkill：回傳 `.claude/skills/<name>/SKILL.md` 的內容；不存在時回傳 null
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function evaluatePrBody({ body, readSkill }) {
  const errors = [];
  const warnings = [];
  const text = stripHtmlComments(body ?? '');

  // 1. 上工檢查：段落存在，至少一個核取方塊，全部勾選
  const checklist = sectionLines(text, '## 上工檢查');
  if (!checklist) {
    errors.push('缺少「## 上工檢查」段落');
  } else {
    const boxes = checklist.filter((l) => /^\s*[-*]\s+\[[ xX]\]/.test(l));
    const unchecked = boxes.filter((l) => /^\s*[-*]\s+\[ \]/.test(l));
    if (boxes.length === 0) errors.push('「## 上工檢查」段落沒有核取方塊');
    for (const l of unchecked) errors.push(`上工檢查未勾選：${JSON.stringify(l.trim())}`);
  }

  // 2、3. 已載入的 skill：表格、至少含 agent-dev-workflow、版本號與 SKILL.md 一致
  const skillSection = sectionLines(text, '## 已載入的 skill');
  if (!skillSection) {
    errors.push('缺少「## 已載入的 skill」段落');
  } else {
    const { header, rows } = parseFirstTable(skillSection);
    const filled = rows.filter((r) => r.some((c) => c !== ''));
    if (!header) {
      errors.push('「## 已載入的 skill」段落沒有表格');
    } else {
      if (!filled.some((r) => r[0] === 'agent-dev-workflow')) {
        errors.push('「## 已載入的 skill」表格沒有 agent-dev-workflow');
      }
      for (const r of filled) {
        const name = r[0] ?? '';
        const version = (r[1] ?? '').trim();
        if (!SKILL_NAME.test(name)) {
          errors.push(`skill 名稱不合法：${JSON.stringify(name)}`);
          continue;
        }
        const skillText = readSkill(name);
        if (skillText === null || skillText === undefined) {
          errors.push(`版本庫中沒有 .claude/skills/${name}/SKILL.md`);
          continue;
        }
        const expected = latestChangelogVersion(skillText);
        if (expected === null) {
          // DQ-6 的過渡規則：skill 沒有變更紀錄時必須填「無版本號」，記為警告
          if (version === NO_VERSION) {
            warnings.push(`${name} 沒有變更紀錄，版本號填「${NO_VERSION}」（DQ-6 過渡規則）`);
          } else {
            errors.push(`${name} 沒有變更紀錄，版本號欄必須填「${NO_VERSION}」，實際為 ${JSON.stringify(version)}`);
          }
        } else if (version !== expected) {
          errors.push(`${name} 的版本號應為 ${JSON.stringify(expected)}（SKILL.md 變更紀錄最後一列），實際為 ${JSON.stringify(version)}`);
        }
      }
    }
  }

  // 4. 作者：至少一個工作階段
  if (!sectionLines(text, '## 作者')) {
    errors.push('缺少「## 作者」段落');
  } else if (parseAuthorSessions(text).length === 0) {
    errors.push('「## 作者」段落沒有「工作階段：<識別>」');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** 讀取版本庫中 skill 的 SKILL.md；不存在時回傳 null。 */
export function skillReader(root) {
  return (name) => {
    if (!SKILL_NAME.test(name)) return null;
    try {
      return readFileSync(path.join(root, '.claude', 'skills', name, 'SKILL.md'), 'utf8');
    } catch {
      return null;
    }
  };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  let body;
  const fileIdx = args.indexOf('--body-file');
  if (fileIdx >= 0) {
    body = readFileSync(args[fileIdx + 1], 'utf8');
  } else {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) {
      console.error('pr-body：需要 GITHUB_EVENT_PATH 或 --body-file');
      process.exit(2);
    }
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    if (!event.pull_request) {
      console.error('pr-body：事件不是 pull_request');
      process.exit(2);
    }
    body = event.pull_request.body;
  }
  const r = evaluatePrBody({ body, readSkill: skillReader(root) });
  // 訊息中的使用者字串一律以 JSON.stringify 輸出，不會在行首形成工作流程指令
  for (const w of r.warnings) console.log(`pr-body 警告：${w}`);
  for (const e of r.errors) console.error(`pr-body 錯誤：${e}`);
  if (!r.ok) process.exit(1);
  console.log('pr-body：通過');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
