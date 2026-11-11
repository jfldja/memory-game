// PR 說明檢查（spec.md 12.4，docs/workflow.md 第 4.4 節）。只用 Node.js 內建模組。
//
// 用法（CI）：node scripts/check-pr-body.mjs
//   從 GITHUB_EVENT_PATH 的事件檔讀取 pull_request.body（不以 ${{ }} 插值），
//   以目前簽出的版本庫（PR 的 head commit）中的 .claude/skills/<名稱>/SKILL.md 判定版本號。
// 用法（本機）：node scripts/check-pr-body.mjs --body-file <檔案>
//
// 判定邏輯為純函式 evaluatePrBody，供模組單元測試呼叫；review-gate 共用 validateAuthorSection
// （review-process.md 4.1「作者段落」）。偵測形式與字元判定自 scripts/detection.mjs 匯入（同一份實作）。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldForm, firstCharRule } from './detection.mjs';

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

/** 工作階段識別正規化後允許的字元集（review-process.md 第 2 節、第 4 節第 2 步）。 */
export const SESSION_ID_CHARSET = /^[a-z0-9-]+$/;
/** 零寬與其他不可見格式字元（Unicode 類別 Cf）。 */
const FORMAT_CHAR = /\p{Cf}/u;

/**
 * 正規化工作階段識別（spec.md 12.4 第 4 點；review-process.md 第 4 節第 2 步）：
 * 原文不得含 Cf 字元；去除前後空白、NFKC、轉小寫後必須符合 `^[a-z0-9-]+$`。
 * NFKC 不會移除零寬字元，也不會把相似字（例：西里爾字母 і）轉成拉丁字母，所以另以字元集限定。
 * @param {string} raw
 * @returns {string|null} 正規化後的識別；格式不符時為 null
 */
export function normalizeSessionId(raw) {
  const s = String(raw ?? '');
  // 先檢查 Cf：String.prototype.trim 會移除 U+FEFF，必須在去除空白之前檢查
  if (FORMAT_CHAR.test(s)) return null;
  const n = s.trim().normalize('NFKC').trim().toLowerCase();
  return SESSION_ID_CHARSET.test(n) ? n : null;
}

/** 作者段落中工作階段行的逐字格式（spec.md 12.4 第 4 點）。 */
export const AUTHOR_SESSION_LINE = /^\s*(?:[-*]\s+)?工作階段：(.*)$/;
/** 作者段落中「看似工作階段」的行：偵測形式（F1～F9）以此開頭。 */
const AUTHOR_SESSION_LABEL = '工作階段:';

/**
 * 驗證 PR 說明的「## 作者」段落並取出工作階段識別（review-process.md 4.1「作者段落」；spec.md 12.4 第 4 點 v0.6.1）。
 * 先移除 HTML 註解，再取段落內的行（標題下一行為第 1 行）：
 * 1. 段落文字含 X1～X5 的任一字元或字元參照 → `作者段落含不可見字元或字元參照`。
 * 2. 偵測形式（fieldForm，F1～F9）以「工作階段:」開頭的每一行，原文必須符合 AUTHOR_SESSION_LINE，
 *    否則 `作者段落格式不符：第 n 行 <原文的 JSON>`（回報第一個不符的行）。
 * 3. 符合的行中，值去除空白後非空者依原文採計（範本中只有註解的空值不採計、不失敗）。
 * 沒有「## 作者」段落時回傳 ok 與空陣列（段落是否存在由 evaluatePrBody 另外判定）。
 * review-gate 第 2 步與 evaluatePrBody 都使用本函式。
 * @param {string|null|undefined} body PR 說明
 * @returns {{ ok: true, sessions: string[] } | { ok: false, reason: string }}
 */
export function validateAuthorSection(body) {
  const lines = sectionLines(stripHtmlComments(String(body ?? '')), '## 作者');
  if (!lines) return { ok: true, sessions: [] };
  if (firstCharRule(lines.join('\n')) !== null) return { ok: false, reason: '作者段落含不可見字元或字元參照' };
  const sessions = [];
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    if (!fieldForm(line).startsWith(AUTHOR_SESSION_LABEL)) continue;
    const m = line.match(AUTHOR_SESSION_LINE);
    if (!m) return { ok: false, reason: `作者段落格式不符：第 ${k + 1} 行 ${JSON.stringify(line)}` };
    if (m[1].trim()) sessions.push(m[1]);
  }
  return { ok: true, sessions };
}

/**
 * 「## 作者」段落中每一行 `工作階段：<識別>` 的原文（未去除空白；已去除 HTML 註解）。
 * 空白的識別（範本的佔位）不列入。v0.6.1 起呼叫 validateAuthorSection：段落不符 4.1「作者段落」時丟出錯誤
 * （不回傳部分結果，避免呼叫端把格式不符的段落當成作者較少）。
 * @param {string|null|undefined} body
 * @returns {string[]}
 */
export function parseAuthorSessionsRaw(body) {
  const r = validateAuthorSection(body);
  if (!r.ok) throw new Error(r.reason);
  return r.sessions;
}

/**
 * 從 PR 說明「## 作者」段落取出全部工作階段識別（review-process.md 第 4 節第 2 步）。
 * 每一行符合 `工作階段：<識別>`（全形冒號；可有清單符號），去除前後空白與 HTML 註解。
 * 回傳的是去除空白後的原文；比對前以 normalizeSessionId 正規化。
 * @param {string|null|undefined} body
 * @returns {string[]}
 */
export function parseAuthorSessions(body) {
  return parseAuthorSessionsRaw(body).map((s) => s.trim());
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

  // 4. 作者：段落符合 4.1「作者段落」；至少一個工作階段；每個識別正規化後符合字元集、原文不含不可見格式字元
  const authors = validateAuthorSection(text);
  if (!sectionLines(text, '## 作者')) {
    errors.push('缺少「## 作者」段落');
  } else if (!authors.ok) {
    errors.push(authors.reason);
  } else {
    const sessions = authors.sessions;
    if (sessions.length === 0) errors.push('「## 作者」段落沒有「工作階段：<識別>」');
    for (const raw of sessions) {
      if (normalizeSessionId(raw) === null) {
        errors.push(
          `作者工作階段識別格式不符（去除空白、NFKC、轉小寫後須符合 ^[a-z0-9-]+$，且不得含不可見字元）：${JSON.stringify(raw.trim())}`,
        );
      }
    }
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
