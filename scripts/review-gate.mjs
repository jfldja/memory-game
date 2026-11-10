// EQ-11 審查紀錄判定（spec.md 第 13 節、review-process.md 第 2、4 節與 4.1 v0.6.1；偵測形式依 DQ-13 (b)，
// 拒絕規則 X1～X7、F2′、F9、表格邊界 T3、T4 依 DQ-14 (b)）。只用 Node.js 內建模組與本目錄的 detection.mjs、check-pr-body.mjs。
//
// 在 pull_request_target／issue_comment 工作流程中執行，只執行預設分支上的本檔，
// 不簽出、不執行 PR 的程式碼。所需環境變數：
//   GITHUB_TOKEN、GITHUB_REPOSITORY（owner/repo）、PR_NUMBER（數字）、GITHUB_API_URL（選用）
// PR 說明、評論、head SHA 一律由 API 重新讀取，不使用事件內容。
//
// --dry-run（spec.md 12.6「PR-1b 由舊版判定」第 1 道；review-process.md 第 4 節）：
//   以 API 讀取同樣的資料、呼叫同一個 evaluate，只印出 head SHA、判定與原因，不寫入任何狀態。
//   只需讀取權限；GITHUB_TOKEN 可省略（公開版本庫，受未驗證的 API 次數限制）。PR 已關閉時仍試算。
//   例：GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY=owner/repo PR_NUMBER=2 node scripts/review-gate.mjs --dry-run
//
// 判定邏輯為純函式 evaluate，供模組單元測試呼叫；API 呼叫只在 run 中。
// 紀錄格式採白名單（review-process.md 第 2 節）：任何一處不符即整則無效，不嘗試解讀。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAuthorSection, normalizeSessionId } from './check-pr-body.mjs';
import { fieldForm, stripHtml, firstCharRule, charRuleReason, HTML_TAG } from './detection.mjs';

export { fieldForm };

export const MARKER = '<!-- review-record v1 -->';
export const STATUS_CONTEXT = 'review-record';
export const TRUSTED_ASSOCIATIONS = Object.freeze(['OWNER', 'MEMBER', 'COLLABORATOR']);
/** 審查清單 R-1～R-15（review-process.md 第 3 節 v0.5）。 */
export const CHECKLIST_IDS = Object.freeze(Array.from({ length: 15 }, (_, k) => `R-${k + 1}`));
export const ITEM_RESULTS = Object.freeze(['通過', '不通過', '不適用']);
export const RECORD_RESULTS = Object.freeze(['APPROVED', 'CHANGES_REQUESTED']);
export const TABLE_HEADER = '| 編號 | 項目 | 結果 | 說明 |';
const FULL_SHA = /^[0-9a-f]{40}$/;
const DESCRIPTION_MAX = 140;

/** 欄位：顯示名稱、偵測用的正規化標籤、逐字格式。 */
const FIELDS = Object.freeze([
  { name: '結果', label: '結果:', strict: /^- 結果：(.*)$/ },
  { name: '針對 commit', label: '針對commit:', strict: /^- 針對 commit：(.*)$/ },
  { name: '審查者', label: '審查者:', strict: /^- 審查者：(.+)，工作階段 (.+)$/ },
]);

function toLines(body) {
  return String(body ?? '').replace(/\r\n/g, '\n').split('\n');
}

const HTML_TABLE_TAG = /<\/?(?:table|thead|tbody|tr|td|th)(?![\p{L}\p{N}])/iu;

/**
 * 表格列偵測（review-process.md 第 4 節「表格列偵測 isTableLine」）：
 * T1：NFKC 後含 HTML 表格標籤；T2：NFKC、F2′ 後去除前後空白，刪除行首最長的「非字母且不是 `|`」前綴後以 `|` 開頭。
 */
export function isTableLine(line) {
  const s = String(line).normalize('NFKC');
  if (HTML_TABLE_TAG.test(s)) return true; // T1
  return stripHtml(s).trim().replace(/^[^\p{L}|]+/u, '').startsWith('|'); // T2
}

/** 以未跳脫的 `|` 切開表格列；回傳 null 表示不是 `|` 開頭且結尾的列。 */
function splitStrictRow(line) {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|') || t.length < 2) return null;
  const cells = [];
  let cur = '';
  for (let k = 1; k < t.length - 1; k++) {
    if (t[k] === '\\' && t[k + 1] === '|') {
      cur += '|';
      k++;
    } else if (t[k] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += t[k];
    }
  }
  if (t[t.length - 2] === '\\') return null; // 結尾的 `\|` 不是欄位分隔
  cells.push(cur.trim());
  return cells;
}

function isSeparatorRow(line) {
  const cells = splitStrictRow(line);
  return Boolean(cells) && cells.length === 4 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

const stripEmphasis = (s) => s.replace(/[*_`\s]/g, '');

/** 第一行是否為標記（容許行尾空白）。 */
export function hasMarker(body) {
  return toLines(body)[0].trimEnd() === MARKER;
}

/**
 * 是否為針對 headSha 的候選紀錄（review-process.md 第 4 節第 3 步、4.1「候選的判定」v0.6.1）：
 * 原文任何位置含 head 的完整 40 碼 SHA（不分大小寫）即為候選（標記與作者由 evaluate 另外判定）。
 * 候選集合是 v0.5.1（偵測形式以「針對commit:」開頭的行含 SHA）的超集；較晚的候選只會使判定變為無效，
 * 不會讓較早的紀錄生效（之後的白名單檢查與「針對 commit 等於 head」照舊）。
 */
export function isCandidateFor(body, headSha) {
  const sha = String(headSha).toLowerCase();
  if (!FULL_SHA.test(sha)) return false;
  return String(body ?? '').toLowerCase().includes(sha);
}

/** T3：表後的下一行必須符合此式或不存在（review-process.md 4.1「表格邊界」）。 */
const BLANK_LINE = /^[ \t]*$/;
/** T4：去除所有 `\s` 後符合此式、且含 `-`、並含 `|` 或 `:` 的行是 GFM 分隔列寫法（任何容器中）。 */
const SEPARATOR_LIKE = /^(?:>|[-+*]|[0-9]{1,9}[.)])*[|:-]+$/;

/** T4 的判定：一行是否為（任何容器中的）GFM 分隔列寫法。 */
export function isSeparatorLike(line) {
  const s = String(line).replace(/\s/g, '');
  return SEPARATOR_LIKE.test(s) && s.includes('-') && (s.includes('|') || s.includes(':'));
}

/** X7 的判定：以 F2′ 的文法刪除一行中所有完整的開始與結束標籤後，仍含 `<` 或 `</` 緊接 ASCII 字母。 */
export function hasUnclosedTag(line) {
  return /<\/?[A-Za-z]/.test(String(line).replace(HTML_TAG, ''));
}

/**
 * 依白名單驗證一則紀錄（review-process.md 第 2 節「規則」、第 4 節第 5 步第 1 項、4.1）。
 * 檢查順序（4.1「檢查順序」）：X1 → X2 → X3 → X4 → X5 → X6（逐行）→ X7（逐行）→ 第 1 行標記 → 欄位行（F1～F9）
 * → 表格列（T1、T2 的連續性與逐字格式）→ T3 → T4 → R 列的重複、缺項、清單外、結果值、「不適用」理由 → 審查者識別格式。
 * 回報第一個不符之處；全部符合時回傳解析結果。
 * @param {string} body
 * @returns {{ ok: false, reason: string } | { ok: true, result: string, sha: string, reviewerSession: string, items: Array<{ id: string, result: string, note: string }> }}
 */
export function validateRecord(body) {
  const text = String(body ?? '').replace(/\r\n/g, '\n');
  const bad = (reason) => ({ ok: false, reason });
  const charRule = firstCharRule(text); // X1～X5
  if (charRule) return bad(charRuleReason(charRule));
  const lines = text.split('\n');
  for (let k = 1; k < lines.length; k++) {
    if (lines[k].includes('<!') || lines[k].includes('<?')) return bad(`含 HTML 註解或宣告：第 ${k + 1} 行`); // X6
  }
  for (let k = 0; k < lines.length; k++) {
    if (hasUnclosedTag(lines[k])) return bad(`HTML 標籤未在同一行結束：第 ${k + 1} 行`); // X7
  }
  if (lines[0].trimEnd() !== MARKER) return bad('第一行不是紀錄標記');

  // 欄位行：各恰好一行，且為逐字格式
  const values = {};
  for (const f of FIELDS) {
    const hits = lines.filter((l) => fieldForm(l).startsWith(f.label));
    const m = hits.length === 1 ? hits[0].trimEnd().match(f.strict) : null;
    if (!m) return bad(`欄位重複或格式不符：${f.name}`);
    values[f.name] = m.slice(1);
  }
  const [result] = values['結果'];
  if (!RECORD_RESULTS.includes(result)) return bad('欄位重複或格式不符：結果');
  const [sha] = values['針對 commit'];
  if (!FULL_SHA.test(sha)) return bad('欄位重複或格式不符：針對 commit');
  const rawSession = values['審查者'][1];

  // 表格：只能有一個，表頭、分隔列、R 列連續
  const tableIdx = lines.map((l, k) => (isTableLine(l) ? k : -1)).filter((k) => k >= 0);
  const rows = [];
  if (tableIdx.length > 0) {
    const start = tableIdx[0];
    for (let n = 0; n < tableIdx.length; n++) {
      const k = tableIdx[n];
      const where = `表格格式不符：第 ${k + 1} 行`;
      if (k !== start + n) return bad(where); // 第二個表格，或表格中斷後再出現的列
      const line = lines[k];
      if (n === 0) {
        if (line.trimEnd() !== TABLE_HEADER) return bad(where);
        continue;
      }
      if (n === 1) {
        if (!isSeparatorRow(line)) return bad(where);
        continue;
      }
      const cells = splitStrictRow(line);
      if (!cells || cells.length !== 4 || !/^R-\d+$/.test(cells[0])) return bad(where);
      // 結果寫錯欄（第 2 或第 4 格恰為「不通過」）也是格式不符
      if (stripEmphasis(cells[1]) === '不通過' || stripEmphasis(cells[3]) === '不通過') return bad(where);
      rows.push({ id: cells[0], result: cells[2], note: cells[3] });
    }
    if (tableIdx.length < 2) return bad(`表格格式不符：第 ${start + 1} 行`);
    // T3：逐項結果表最後一列的下一行必須是空行或不存在（GFM 表格延續到空行為止）
    const next = tableIdx[tableIdx.length - 1] + 1;
    if (next < lines.length && !BLANK_LINE.test(lines[next])) return bad(`表格格式不符：第 ${next + 1} 行`);
  }
  // T4：逐項結果表分隔列以外不得有 GFM 分隔列寫法（沒有表格時每一行都判定）
  const separatorIdx = tableIdx.length > 0 ? tableIdx[0] + 1 : -1;
  for (let k = 0; k < lines.length; k++) {
    if (k !== separatorIdx && isSeparatorLike(lines[k])) return bad(`表格格式不符：第 ${k + 1} 行`);
  }

  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.id)) return bad(`審查清單重複：${r.id}`);
    seen.add(r.id);
  }
  for (const id of CHECKLIST_IDS) if (!seen.has(id)) return bad(`審查清單缺項：${id}`);
  for (const r of rows) if (!CHECKLIST_IDS.includes(r.id)) return bad(`清單以外的項目：${r.id}`);
  for (const r of rows) if (!ITEM_RESULTS.includes(r.result)) return bad(`結果值不符：${r.id}`);
  for (const r of rows) if (r.result === '不適用' && r.note === '') return bad(`不適用未寫理由：${r.id}`);

  const reviewerSession = normalizeSessionId(rawSession);
  if (reviewerSession === null) return bad('工作階段識別格式不符');

  return { ok: true, result, sha, reviewerSession, items: rows };
}

function truncate(s) {
  return s.length <= DESCRIPTION_MAX ? s : s.slice(0, DESCRIPTION_MAX - 1) + '…';
}

/**
 * 判定 PR 最新 head commit 的審查狀態（review-process.md 第 4 節第 2～6 步）。
 * @param {{
 *   headSha: string,
 *   prBody: string|null,
 *   prUrl?: string,
 *   comments: Array<{ body: string, author_association: string, created_at: string, html_url?: string }>
 * }} input
 * @returns {{ state: 'success'|'failure', description: string, targetUrl: string|null }}
 */
export function evaluate({ headSha, prBody, prUrl = null, comments }) {
  const short = String(headSha).slice(0, 7);
  const candidates = comments
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) =>
      hasMarker(c.body) &&
      TRUSTED_ASSOCIATIONS.includes(c.author_association) &&
      isCandidateFor(c.body, headSha),
    )
    .sort((a, b) => Date.parse(a.c.created_at) - Date.parse(b.c.created_at) || a.idx - b.idx);

  if (candidates.length === 0) {
    return { state: 'failure', description: truncate(`沒有針對 ${short} 的審查紀錄`), targetUrl: prUrl };
  }
  // 以最後一則為準；最後一則無效時不退回較早的紀錄（第 4 步）
  const { c } = candidates[candidates.length - 1];
  const fail = (description) => ({ state: 'failure', description: truncate(description), targetUrl: c.html_url ?? prUrl });

  const rec = validateRecord(c.body);
  if (!rec.ok) return fail(rec.reason);
  if (rec.sha !== headSha) return fail('欄位重複或格式不符：針對 commit');

  // 第 2 步：作者段落依 4.1「作者段落」檢查（與 pr-body 同一個函式）；不符或識別格式不符皆為 failure
  const section = validateAuthorSection(prBody);
  if (!section.ok) return fail('作者工作階段識別格式不符');
  const authors = section.sessions.map(normalizeSessionId);
  if (authors.some((a) => a === null)) return fail('作者工作階段識別格式不符');
  if (authors.includes(rec.reviewerSession)) return fail('審查者與作者相同或未標明');

  const text = String(c.body);
  if (!(text.includes('同一模型') && text.includes('不同工作階段'))) {
    return fail('未註明 W-1（同一模型的不同工作階段）');
  }
  if (rec.result !== 'APPROVED' || rec.items.some((r) => r.result === '不通過')) return fail('審查要求修改');

  return {
    state: 'success',
    description: truncate(`已審查 ${short}（審查者 ${rec.reviewerSession}）`),
    targetUrl: c.html_url ?? prUrl,
  };
}

function makeApi(fetchImpl, token) {
  return async (method, url, body) => {
    const res = await fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'review-gate',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${url} → HTTP ${res.status}`);
    return res.json();
  };
}

/**
 * 外層：讀取 PR 與全部評論、判定、寫入（或 --dry-run 時只印出）。
 * @param {{ argv?: string[], env?: Record<string, string|undefined>, fetchImpl?: typeof fetch, log?: (s: string) => void }} [options]
 * @returns {Promise<{ headSha: string, result: object, written: boolean } | null>}
 */
export async function run({ argv = process.argv.slice(2), env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  const dryRun = argv.includes('--dry-run');
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY;
  const prNumber = env.PR_NUMBER;
  const apiBase = env.GITHUB_API_URL || 'https://api.github.com';
  if ((!dryRun && !token) || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^\d+$/.test(prNumber ?? '')) {
    throw Object.assign(new Error('缺少 GITHUB_TOKEN、GITHUB_REPOSITORY 或數字的 PR_NUMBER'), { exitCode: 2 });
  }
  const api = makeApi(fetchImpl, token);
  const base = `${apiBase}/repos/${repo}`;
  const pr = await api('GET', `${base}/pulls/${prNumber}`);
  if (pr.state !== 'open' && !dryRun) {
    log(`review-gate：PR #${prNumber} 已關閉，不寫入狀態`);
    return null;
  }
  const comments = [];
  for (let page = 1; ; page++) {
    const batch = await api('GET', `${base}/issues/${prNumber}/comments?per_page=100&page=${page}`);
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  const headSha = pr.head.sha;
  const result = evaluate({ headSha, prBody: pr.body, prUrl: pr.html_url, comments });
  // 描述可能含審查者填寫的工作階段識別，以 JSON.stringify 輸出，避免在行首形成工作流程指令
  if (dryRun) {
    log(`review-gate --dry-run：PR #${prNumber}（${pr.state}）head ${headSha}`);
    log(`review-gate --dry-run：判定 ${result.state} ${JSON.stringify(result.description)}；連結 ${JSON.stringify(result.targetUrl)}`);
    log('review-gate --dry-run：未寫入任何狀態');
    return { headSha, result, written: false };
  }
  await api('POST', `${base}/statuses/${headSha}`, {
    state: result.state,
    context: STATUS_CONTEXT,
    description: result.description,
    ...(result.targetUrl ? { target_url: result.targetUrl } : {}),
  });
  log(`review-gate：${headSha} → ${result.state} ${JSON.stringify(result.description)}`);
  return { headSha, result, written: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error(`review-gate：${err.message}`);
    process.exit(err.exitCode ?? 1);
  });
}
