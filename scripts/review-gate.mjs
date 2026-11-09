// EQ-11 審查紀錄判定（spec.md 第 13 節、review-process.md 第 4 節）。只用 Node.js 內建模組。
//
// 在 pull_request_target／issue_comment 工作流程中執行，只執行預設分支上的本檔，
// 不簽出、不執行 PR 的程式碼。所需環境變數：
//   GITHUB_TOKEN、GITHUB_REPOSITORY（owner/repo）、PR_NUMBER（數字）、GITHUB_API_URL（選用）
// PR 說明、評論、head SHA 一律由 API 重新讀取，不使用事件內容。
//
// 判定邏輯為純函式 evaluate，供模組單元測試呼叫；API 呼叫只在 main 中。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAuthorSessions } from './check-pr-body.mjs';

export const MARKER = '<!-- review-record v1 -->';
export const STATUS_CONTEXT = 'review-record';
export const TRUSTED_ASSOCIATIONS = Object.freeze(['OWNER', 'MEMBER', 'COLLABORATOR']);
export const CHECKLIST_IDS = Object.freeze(Array.from({ length: 14 }, (_, k) => `R-${k + 1}`));
const FULL_SHA = /^[0-9a-f]{40}$/;
const DESCRIPTION_MAX = 140;

function splitRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function fieldValue(lines, label) {
  const re = new RegExp(`^\\s*[-*]\\s+${label}：(.*)$`);
  for (const line of lines) {
    const m = line.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * 解析一則評論。第一行不是標記時回傳 null。
 * @param {string} body
 * @returns {null | { result: string|null, sha: string|null, reviewerSession: string|null, notesW1: boolean, items: Record<string, string> }}
 */
export function parseReviewRecord(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  if (lines[0].trim() !== MARKER) return null;
  const reviewer = fieldValue(lines, '審查者');
  const sessionMatch = reviewer && reviewer.match(/工作階段[：:\s]\s*([^\s，,；;、。）)]+)/);
  const items = {};
  for (const line of lines) {
    const cells = splitRow(line);
    if (cells && /^R-\d+$/.test(cells[0])) items[cells[0]] = cells[2] ?? '';
  }
  return {
    result: fieldValue(lines, '結果'),
    sha: fieldValue(lines, '針對 commit'),
    reviewerSession: sessionMatch ? sessionMatch[1] : null,
    notesW1: body.includes('同一模型') && body.includes('不同工作階段'),
    items,
  };
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
  const authors = parseAuthorSessions(prBody);
  const candidates = comments
    .map((c, idx) => ({ c, idx, rec: parseReviewRecord(c.body) }))
    .filter(({ c, rec }) =>
      rec !== null &&
      TRUSTED_ASSOCIATIONS.includes(c.author_association) &&
      rec.sha !== null && FULL_SHA.test(rec.sha) && rec.sha === headSha,
    )
    .sort((a, b) => Date.parse(a.c.created_at) - Date.parse(b.c.created_at) || a.idx - b.idx);

  if (candidates.length === 0) {
    return { state: 'failure', description: truncate(`沒有針對 ${short} 的審查紀錄`), targetUrl: prUrl };
  }
  const { c, rec } = candidates[candidates.length - 1];
  const fail = (description) => ({ state: 'failure', description: truncate(description), targetUrl: c.html_url ?? prUrl });

  if (!rec.reviewerSession || authors.includes(rec.reviewerSession)) {
    return fail('審查者與作者相同或未標明');
  }
  if (!rec.notesW1) return fail('未註明 W-1（同一模型的不同工作階段）');
  const incomplete = CHECKLIST_IDS.filter((id) => !(id in rec.items) || rec.items[id] === '');
  if (incomplete.length) return fail(`審查清單不完整：${incomplete.join('、')}`);
  const anyFailed = Object.values(rec.items).some((v) => v.includes('不通過'));
  if (rec.result !== 'APPROVED' || anyFailed) return fail('審查要求修改');

  return {
    state: 'success',
    description: truncate(`已審查 ${short}（審查者 ${rec.reviewerSession}）`),
    targetUrl: c.html_url ?? prUrl,
  };
}

async function api(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'review-gate',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^\d+$/.test(prNumber ?? '')) {
    console.error('review-gate：缺少 GITHUB_TOKEN、GITHUB_REPOSITORY 或數字的 PR_NUMBER');
    process.exit(2);
  }
  const base = `${apiBase}/repos/${repo}`;
  const pr = await api('GET', `${base}/pulls/${prNumber}`, token);
  if (pr.state !== 'open') {
    console.log(`review-gate：PR #${prNumber} 已關閉，不寫入狀態`);
    return;
  }
  const comments = [];
  for (let page = 1; ; page++) {
    const batch = await api('GET', `${base}/issues/${prNumber}/comments?per_page=100&page=${page}`, token);
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  const headSha = pr.head.sha;
  const result = evaluate({ headSha, prBody: pr.body, prUrl: pr.html_url, comments });
  await api('POST', `${base}/statuses/${headSha}`, token, {
    state: result.state,
    context: STATUS_CONTEXT,
    description: result.description,
    ...(result.targetUrl ? { target_url: result.targetUrl } : {}),
  });
  // 描述可能含審查者填寫的工作階段識別，以 JSON.stringify 輸出，避免在行首形成工作流程指令
  console.log(`review-gate：${headSha} → ${result.state} ${JSON.stringify(result.description)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`review-gate：${err.message}`);
    process.exit(1);
  });
}
