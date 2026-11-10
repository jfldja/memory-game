// 模組單元測試：scripts/review-gate.mjs（module-test-standards.md M12、review-process.md 第 2、4 節 v0.5）。
// 邊界清單（M12「review-gate」）逐項對應下列測試；測試名稱不含真實驗收編號。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluate,
  validateRecord,
  isCandidateFor,
  fieldForm,
  isTableLine,
  hasMarker,
  isSeparatorLike,
  hasUnclosedTag,
  run as runGate,
  CHECKLIST_IDS,
  MARKER,
} from '../../scripts/review-gate.mjs';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/review-gate.mjs');
const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);

const PR_BODY = [
  '## 作者',
  '- 角色：實作 agent',
  '- 工作階段：impl-1',
  '- 角色：測試 agent',
  '- 工作階段：test-1',
  '## 上工檢查',
].join('\n');

const W1 = '審查者與作者為同一模型（Claude）的不同工作階段（docs/workflow.md W-1）';

/** 依 review-process.md 第 2 節產生一則合法紀錄；各部分可覆寫。 */
function record({
  result = 'APPROVED',
  sha = HEAD,
  reviewer = '審查 agent，工作階段 review-1',
  w1 = W1,
  rows = CHECKLIST_IDS.map((id) => `| ${id} | 項目 | 通過 | |`),
  marker = MARKER,
  extraFields = [],
  after = ['', '### 發現的問題', '', '- 無'],
} = {}) {
  return [
    marker,
    '## 審查紀錄',
    '',
    `- 結果：${result}`,
    `- 針對 commit：${sha}`,
    `- 審查者：${reviewer}`,
    '- 作者：實作 agent，工作階段 impl-1',
    `- 獨立性：${w1}`,
    ...extraFields,
    '',
    '### 逐項結果',
    '',
    '| 編號 | 項目 | 結果 | 說明 |',
    '|---|---|---|---|',
    ...rows,
    ...after,
  ].join('\n');
}
const rowsWith = (replace) =>
  CHECKLIST_IDS.map((id) => (id in replace ? replace[id] : `| ${id} | 項目 | 通過 | |`)).flat();

function comment(body, { assoc = 'OWNER', at = '2026-11-09T10:00:00Z', url = 'https://example.test/c/1' } = {}) {
  return { body, author_association: assoc, created_at: at, html_url: url };
}

function judge(comments, prBody = PR_BODY) {
  return evaluate({ headSha: HEAD, prBody, prUrl: 'https://example.test/pr/1', comments });
}
const failsWith = (body, re, prBody) => {
  const r = judge([comment(body)], prBody);
  assert.equal(r.state, 'failure', `應失敗：${re}`);
  assert.match(r.description, re);
};

describe('紀錄的辨識與候選', () => {
  test('第一行為標記（容許行尾空白、CRLF）', () => {
    assert.equal(hasMarker(record()), true);
    assert.equal(hasMarker(record().replace(MARKER, `${MARKER}  `).replace(/\n/g, '\r\n')), true);
    assert.equal(hasMarker(`說明\n${record()}`), false);
  });

  test('候選：任何一行「針對 commit」含 head 完整 SHA；短碼或舊 SHA 不是候選', () => {
    assert.equal(isCandidateFor(record(), HEAD), true);
    assert.equal(isCandidateFor(record({ sha: OLD }), HEAD), false);
    assert.equal(isCandidateFor(record({ sha: HEAD.slice(0, 7) }), HEAD), false);
    // 寫法不符（粗體、全形冒號、半形冒號）仍是候選，之後由白名單判為無效
    assert.equal(isCandidateFor(record({ extraFields: [`**針對 commit**: ${HEAD}`] }).replace(`- 針對 commit：${HEAD}`, ''), HEAD), true);
  });
});

describe('evaluate：既有規則', () => {
  test('符合格式、針對最新 SHA 的紀錄：success，連結指向該則評論', () => {
    const r = judge([comment(record())]);
    assert.deepEqual(r, { state: 'success', description: '已審查 aaaaaaa（審查者 review-1）', targetUrl: 'https://example.test/c/1' });
  });

  test('沒有紀錄：failure，連結指向 PR', () => {
    const r = judge([comment('一般留言')]);
    assert.equal(r.state, 'failure');
    assert.match(r.description, /沒有針對 aaaaaaa 的審查紀錄/);
    assert.equal(r.targetUrl, 'https://example.test/pr/1');
  });

  test('紀錄針對舊 commit、只寫短碼：視為沒有紀錄', () => {
    assert.match(judge([comment(record({ sha: OLD }))]).description, /沒有針對/);
    assert.match(judge([comment(record({ sha: HEAD.slice(0, 7) }))]).description, /沒有針對/);
  });

  test('紀錄寫大寫 SHA：是候選，但不符合 40 碼小寫格式而無效', () => {
    failsWith(record({ sha: HEAD.toUpperCase() }), /欄位重複或格式不符：針對 commit/);
  });

  test('非協作者的評論不採計', () => {
    for (const assoc of ['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR']) {
      assert.match(judge([comment(record(), { assoc })]).description, /沒有針對/);
    }
    for (const assoc of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      assert.equal(judge([comment(record(), { assoc })]).state, 'success');
    }
  });

  test('審查者工作階段等於任一位作者：failure', () => {
    failsWith(record({ reviewer: '審查 agent，工作階段 impl-1' }), /審查者與作者相同/);
    failsWith(record({ reviewer: '審查 agent，工作階段 test-1' }), /審查者與作者相同/);
  });

  test('審查者未標明工作階段：欄位格式不符', () => {
    failsWith(record({ reviewer: '審查 agent' }), /欄位重複或格式不符：審查者/);
  });

  test('缺 W-1 註明：failure', () => {
    failsWith(record({ w1: '審查者與作者不同' }), /未註明 W-1/);
  });

  test('「不適用」附理由是有效結果', () => {
    const r = judge([comment(record({ rows: rowsWith({ 'R-5': '| R-5 | 項目 | 不適用 | 本 PR 沒有狀態機 |' }) }))]);
    assert.equal(r.state, 'success');
  });

  test('含「不通過」卻寫 APPROVED：failure', () => {
    failsWith(record({ rows: rowsWith({ 'R-3': '| R-3 | 項目 | 不通過 | 說明 |' }) }), /審查要求修改/);
  });

  test('結果為 CHANGES_REQUESTED：failure；其他值為格式不符', () => {
    failsWith(record({ result: 'CHANGES_REQUESTED' }), /審查要求修改/);
    failsWith(record({ result: 'APPROVED!' }), /欄位重複或格式不符：結果/);
    failsWith(record({ result: 'approved' }), /欄位重複或格式不符：結果/);
  });

  test('多則紀錄以建立時間最後一則為準（與陣列順序無關）', () => {
    const ok = comment(record(), { at: '2026-11-09T10:00:00Z', url: 'ok' });
    const ng = comment(record({ result: 'CHANGES_REQUESTED' }), { at: '2026-11-09T11:00:00Z', url: 'ng' });
    assert.equal(judge([ng, ok]).state, 'failure');
    assert.equal(judge([ng, ok]).targetUrl, 'ng');
    const later = comment(record(), { at: '2026-11-09T12:00:00Z', url: 'later' });
    assert.equal(judge([later, ng, ok]).state, 'success');
  });

  test('最後一則針對舊 SHA 時，以針對最新 SHA 的最後一則為準', () => {
    const cur = comment(record(), { at: '2026-11-09T10:00:00Z' });
    const old = comment(record({ sha: OLD, result: 'CHANGES_REQUESTED' }), { at: '2026-11-09T11:00:00Z' });
    assert.equal(judge([cur, old]).state, 'success');
  });

  test('非協作者較晚留下的紀錄不覆蓋協作者的紀錄', () => {
    const cur = comment(record(), { at: '2026-11-09T10:00:00Z' });
    const spam = comment(record({ result: 'CHANGES_REQUESTED' }), { assoc: 'NONE', at: '2026-11-09T11:00:00Z' });
    assert.equal(judge([cur, spam]).state, 'success');
  });

  test('description 不超過 140 字', () => {
    const r = judge([comment(record({ reviewer: `審查 agent，工作階段 ${'x'.repeat(300)}` }))]);
    assert.equal(r.state, 'success');
    assert.ok(r.description.length <= 140);
  });
});

describe('evaluate：審查清單 R-1～R-15（v0.5）', () => {
  test('清單為 R-1～R-15 共 15 項', () => {
    assert.equal(CHECKLIST_IDS.length, 15);
    assert.equal(CHECKLIST_IDS.at(-1), 'R-15');
  });

  test('缺 R-1～R-15 任一項：審查清單缺項', () => {
    for (const id of ['R-1', 'R-7', 'R-15']) {
      failsWith(record({ rows: rowsWith({ [id]: [] }) }), new RegExp(`審查清單缺項：${id}$`));
    }
  });

  test('只有 R-1～R-14（舊版清單）時缺 R-15', () => {
    failsWith(record({ rows: rowsWith({ 'R-15': [] }) }), /審查清單缺項：R-15/);
  });

  test('清單以外的項目（R-16、R-0、R-05）無效', () => {
    for (const extra of ['R-16', 'R-0', 'R-05']) {
      failsWith(record({ rows: [...rowsWith({}), `| ${extra} | 項目 | 通過 | |`] }), new RegExp(`清單以外的項目：${extra}`));
    }
  });

  test('清單以外的列為不通過時也失敗', () => {
    failsWith(record({ rows: [...rowsWith({}), '| R-16 | 項目 | 不通過 | |'] }), /清單以外的項目：R-16/);
  });
});

describe('evaluate：同一則紀錄內的重複（v0.5，PR-1 審查 N-1）', () => {
  const dup = (a, b) => record({ rows: rowsWith({ 'R-5': [`| R-5 | 項目 | ${a} | |`, `| R-5 | 項目 | ${b} | |`] }) });

  test('同一 R 編號兩列：先不通過後通過、先通過後不通過、兩列都通過，皆無效', () => {
    failsWith(dup('不通過', '通過'), /審查清單重複：R-5/);
    failsWith(dup('通過', '不通過'), /審查清單重複：R-5/);
    failsWith(dup('通過', '通過'), /審查清單重複：R-5/);
  });

  test('較晚一則合法紀錄可取代較早一則重複而無效的紀錄', () => {
    const bad = comment(dup('不通過', '通過'), { at: '2026-11-09T10:00:00Z' });
    const good = comment(record(), { at: '2026-11-09T11:00:00Z' });
    assert.equal(judge([bad, good]).state, 'success');
  });

  test('較晚一則無效時不退回採用較早的有效紀錄', () => {
    const good = comment(record(), { at: '2026-11-09T10:00:00Z' });
    const bad = comment(dup('通過', '通過'), { at: '2026-11-09T11:00:00Z', url: 'bad' });
    const r = judge([good, bad]);
    assert.equal(r.state, 'failure');
    assert.equal(r.targetUrl, 'bad');
  });
});

describe('evaluate：結果欄（v0.5）', () => {
  test('三值以外（通過？、OK、通過（補充）、空白）：結果值不符', () => {
    for (const v of ['通過？', 'OK', '通過（補充）', '']) {
      failsWith(record({ rows: rowsWith({ 'R-4': `| R-4 | 項目 | ${v} | |` }) }), /結果值不符：R-4/);
    }
  });

  test('「不適用」說明空白：不適用未寫理由', () => {
    failsWith(record({ rows: rowsWith({ 'R-9': '| R-9 | 項目 | 不適用 |  |' }) }), /不適用未寫理由：R-9/);
  });

  test('結果寫在第 2 或第 4 格（「不通過」）：表格格式不符', () => {
    failsWith(record({ rows: rowsWith({ 'R-2': '| R-2 | 不通過 | 通過 | |' }) }), /表格格式不符：第 \d+ 行/);
    failsWith(record({ rows: rowsWith({ 'R-2': '| R-2 | 項目 | 通過 | **不通過** |' }) }), /表格格式不符：第 \d+ 行/);
  });
});

describe('evaluate：白名單格式（第 3 輪審查 M-2）', () => {
  test('含 U+200B、U+FEFF、U+202E、U+2060 或其他控制字元：含不可見字元', () => {
    for (const ch of ['​', '﻿', '‮', '⁠', '\u0007']) {
      failsWith(record({ after: ['', `- 備註${ch}`] }), /含不可見字元/);
    }
  });

  test('CRLF 換行的合法紀錄通過；單獨的 CR 為控制字元', () => {
    assert.equal(judge([comment(record().replace(/\n/g, '\r\n'))]).state, 'success');
    failsWith(record({ after: ['', '- 備註\r其他'] }), /含不可見字元/);
  });

  test('「- 結果：」兩行（先 APPROVED 後 CHANGES_REQUESTED，與反向）無效', () => {
    failsWith(record({ extraFields: ['- 結果：CHANGES_REQUESTED'] }), /欄位重複或格式不符：結果/);
    failsWith(record({ result: 'CHANGES_REQUESTED', extraFields: ['- 結果：APPROVED'] }), /欄位重複或格式不符：結果/);
  });

  test('另有 **結果**：…、`結果`: …、全形「結果：」的行也算重複', () => {
    for (const line of ['**結果**：APPROVED', '`結果`: APPROVED', '* 結果：APPROVED', '> - 結果：APPROVED', '## 結果：APPROVED']) {
      failsWith(record({ extraFields: [line] }), /欄位重複或格式不符：結果/);
    }
  });

  test('欄位寫法不符（粗體、半形冒號、缺清單符號）即使只有一行也無效', () => {
    const body = record().replace('- 結果：APPROVED', '- **結果**：APPROVED');
    failsWith(body, /欄位重複或格式不符：結果/);
    failsWith(record().replace('- 結果：APPROVED', '- 結果: APPROVED'), /欄位重複或格式不符：結果/);
    failsWith(record().replace('- 審查者：', '審查者：'), /欄位重複或格式不符：審查者/);
  });

  test('「針對 commit」欄位重複且其中一行含 head SHA：仍是候選，判為無效（不退回較早紀錄）', () => {
    const good = comment(record(), { at: '2026-11-09T10:00:00Z' });
    const twice = comment(record({ sha: OLD, extraFields: [`- 針對 commit：${HEAD}`] }), { at: '2026-11-09T11:00:00Z' });
    const r = judge([good, twice]);
    assert.equal(r.state, 'failure');
    assert.match(r.description, /欄位重複或格式不符：針對 commit/);
  });

  test('「審查者」欄位重複：無效', () => {
    failsWith(record({ extraFields: ['- 審查者：另一位，工作階段 review-2'] }), /欄位重複或格式不符：審查者/);
  });

  test('看似 R 列卻不符格式的列與正規 R-5 並存：表格格式不符', () => {
    for (const row of ['| **R-5** | 項目 | 不通過 | |', '| Ｒ－５ | 項目 | 不通過 | |', '| R-5（補充） | 項目 | 不通過 | |', '｜ R-5 ｜ 項目 ｜ 不通過 ｜ ｜', '| R-5 | 項目 | 不通過 |']) {
      failsWith(record({ rows: [...rowsWith({}), row] }), /表格格式不符：第 \d+ 行/);
    }
  });

  test('第二個表格無效（「發現的問題」也不得用表格）', () => {
    const after = ['', '### 發現的問題', '', '| 位置 | 問題 |', '|---|---|', '| a | b |'];
    failsWith(record({ after }), /表格格式不符：第 \d+ 行/);
  });

  test('表頭不是逐字的四欄表頭：表格格式不符', () => {
    failsWith(record().replace('| 編號 | 項目 | 結果 | 說明 |', '| 編號 | 結果 | 項目 | 說明 |'), /表格格式不符/);
  });

  test('引用區塊中的表格列也算表格列', () => {
    failsWith(record({ after: ['', '> | R-5 | 項目 | 不通過 | |'] }), /表格格式不符/);
  });

  test('說明欄以 \\| 跳脫的直線不切開欄位', () => {
    const r = judge([comment(record({ rows: rowsWith({ 'R-6': '| R-6 | 項目 | 通過 | a \\| b |' }) }))]);
    assert.equal(r.state, 'success');
  });

  test('沒有任何表格：審查清單缺項', () => {
    const body = record({ rows: [] }).replace('| 編號 | 項目 | 結果 | 說明 |\n|---|---|---|---|\n', '');
    failsWith(body, /審查清單缺項：R-1$/);
  });
});

describe('evaluate：工作階段識別（v0.5 N-1、第 3 輪 M-2）', () => {
  test('審查者 IMPL-1、全形 ｉｍｐｌ－１、前後空白不同時都視為作者 impl-1', () => {
    for (const s of ['IMPL-1', 'ｉｍｐｌ－１', 'Impl-1']) {
      failsWith(record({ reviewer: `審查 agent，工作階段 ${s}` }), /審查者與作者相同/);
    }
    const prBody = PR_BODY.replace('工作階段：impl-1', '工作階段：  IMPL-1  ');
    failsWith(record({ reviewer: '審查 agent，工作階段 impl-1' }), /審查者與作者相同/, prBody);
  });

  test('審查者識別含 U+200B 或西里爾字母 і：不可見字元或識別格式不符', () => {
    failsWith(record({ reviewer: '審查 agent，工作階段 impl​-1' }), /含不可見字元/);
    failsWith(record({ reviewer: '審查 agent，工作階段 іmpl-1' }), /工作階段識別格式不符/);
    failsWith(record({ reviewer: '審查 agent，工作階段 review_1' }), /工作階段識別格式不符/);
  });

  test('審查者識別後接其他文字：識別格式不符', () => {
    failsWith(record({ reviewer: '審查 agent，工作階段 review-1（第二次）' }), /工作階段識別格式不符/);
  });

  test('PR 說明中作者識別格式不符：作者工作階段識別格式不符', () => {
    failsWith(record(), /作者工作階段識別格式不符/, PR_BODY.replace('工作階段：test-1', '工作階段：tеst-1'));
    failsWith(record(), /作者工作階段識別格式不符/, PR_BODY.replace('工作階段：test-1', '工作階段：test​-1'));
  });

  test('PR 說明沒有作者段落時，依審查者是否標明工作階段判定', () => {
    assert.equal(judge([comment(record())], '').state, 'success');
  });
});

describe('validateRecord', () => {
  test('合法紀錄回傳解析結果（15 列、審查者已正規化）', () => {
    const v = validateRecord(record({ reviewer: '審查 agent，工作階段 Review-1' }));
    assert.equal(v.ok, true);
    assert.equal(v.items.length, 15);
    assert.equal(v.reviewerSession, 'review-1');
    assert.equal(v.sha, HEAD);
  });
});

// ───────────────────────── 外層（模擬的 GitHub API） ─────────────────────────

function mockApi({ prState = 'open', pages }) {
  const calls = [];
  const server = createServer((req, res) => {
    let data = '';
    req.on('data', (d) => (data += d));
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, body: data, auth: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && req.url === '/repos/o/r/pulls/7') {
        return res.end(JSON.stringify({ state: prState, head: { sha: HEAD }, body: PR_BODY, html_url: 'pr-url' }));
      }
      const m = req.url.match(/^\/repos\/o\/r\/issues\/7\/comments\?per_page=100&page=(\d+)$/);
      if (req.method === 'GET' && m) return res.end(JSON.stringify(pages[Number(m[1]) - 1] ?? []));
      if (req.method === 'POST' && req.url === `/repos/o/r/statuses/${HEAD}`) return res.writeHead(201).end('{}');
      res.writeHead(404).end('{}');
    });
  });
  return { server, calls };
}

async function withServer(mock, fn) {
  await new Promise((r) => mock.server.listen(0, '127.0.0.1', r));
  try {
    return await fn(`http://127.0.0.1:${mock.server.address().port}`);
  } finally {
    await new Promise((r) => mock.server.close(r));
  }
}

const filler = Array.from({ length: 100 }, (_, k) => comment(`留言 ${k}`, { at: `2026-11-09T09:00:${String(k % 60).padStart(2, '0')}Z` }));

describe('外層：對模擬的 GitHub API 執行', () => {
  test('重新讀取 PR 與全部評論（分頁），把結果寫入最新 head SHA 的 review-record 狀態', async () => {
    const mock = mockApi({ pages: [filler, [comment(record(), { url: 'rec-url' })]] });
    await withServer(mock, async (api) => {
      const env = { ...process.env, GITHUB_TOKEN: 't0ken', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '7', GITHUB_API_URL: api };
      await new Promise((resolve, reject) =>
        execFile(process.execPath, [SCRIPT], { env }, (err, stdout, stderr) => (err ? reject(new Error(stderr)) : resolve(stdout))),
      );
      const posts = mock.calls.filter((c) => c.method === 'POST');
      assert.deepEqual(posts.map((p) => JSON.parse(p.body)), [{
        state: 'success',
        context: 'review-record',
        description: '已審查 aaaaaaa（審查者 review-1）',
        target_url: 'rec-url',
      }]);
      assert.ok(mock.calls.every((c) => c.auth === 'Bearer t0ken'));

      const code = await new Promise((resolve) =>
        execFile(process.execPath, [SCRIPT], { env: { ...env, PR_NUMBER: '7; echo x' } }, (err) => resolve(err ? err.code : 0)),
      );
      assert.equal(code, 2);
    });
  });

  test('PR 已關閉時不寫入狀態', async () => {
    const mock = mockApi({ prState: 'closed', pages: [[comment(record())]] });
    await withServer(mock, async (api) => {
      const r = await runGate({ argv: [], env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '7', GITHUB_API_URL: api }, log: () => {} });
      assert.equal(r, null);
      assert.ok(mock.calls.every((c) => c.method === 'GET'));
    });
  });

  test('--dry-run：讀取同樣的資料並印出 head SHA 與判定，不呼叫任何寫入 API', async () => {
    const mock = mockApi({ pages: [filler, [comment(record({ rows: rowsWith({ 'R-15': [] }) }), { url: 'rec-url' })]] });
    await withServer(mock, async (api) => {
      const out = [];
      const r = await runGate({
        argv: ['--dry-run'],
        env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '7', GITHUB_API_URL: api },
        log: (s) => out.push(s),
      });
      assert.equal(r.written, false);
      assert.equal(r.headSha, HEAD);
      assert.equal(r.result.state, 'failure');
      assert.deepEqual(mock.calls.map((c) => c.method), ['GET', 'GET', 'GET']);
      assert.match(out.join('\n'), new RegExp(`head ${HEAD}`));
      assert.match(out.join('\n'), /判定 failure "審查清單缺項：R-15"/);
      assert.match(out.join('\n'), /未寫入任何狀態/);
    });
  });

  test('--dry-run：PR 已關閉時仍試算；不需要權杖', async () => {
    const mock = mockApi({ prState: 'closed', pages: [[comment(record())]] });
    await withServer(mock, async (api) => {
      const r = await runGate({ argv: ['--dry-run'], env: { GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '7', GITHUB_API_URL: api }, log: () => {} });
      assert.equal(r.result.state, 'success');
      assert.ok(mock.calls.every((c) => c.method === 'GET' && c.auth === undefined));
    });
  });

  test('一般模式缺少權杖時以代碼 2 結束（不呼叫 API）', async () => {
    await assert.rejects(
      runGate({ argv: [], env: { GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '7' }, fetchImpl: () => assert.fail('不應呼叫 API') }),
      (err) => err.exitCode === 2,
    );
  });
});

// ─────────── v0.5.1（簽核後釐清；review-process.md 第 4 節「偵測形式」、module-test-standards.md M12 v0.5.1） ───────────

const FIELD_LINES = {
  結果: { legal: '- 結果：APPROVED', value: 'APPROVED', reason: /欄位重複或格式不符：結果$/ },
  '針對 commit': { legal: `- 針對 commit：${HEAD}`, value: HEAD, reason: /欄位重複或格式不符：針對 commit$/ },
  審查者: { legal: '- 審查者：審查 agent，工作階段 review-1', value: '審查 agent，工作階段 review-1', reason: /欄位重複或格式不符：審查者$/ },
};

describe('evaluate：偵測形式去除行首區塊標記（v0.5.1）', () => {
  test('正例：合法紀錄的三個欄位行各被偵測為恰好一行而通過（v0.5 字面規則下為 0 行而無效）', () => {
    // validateRecord 要求每個欄位的偵測結果恰好一行；合法紀錄通過即證明三行各被偵測一次
    const v = validateRecord(record());
    assert.equal(v.ok, true, JSON.stringify(v));
    // 對照：再加任何一行同一欄位的合法寫法就變成兩行
    for (const [name, f] of Object.entries(FIELD_LINES)) {
      assert.match(judge([comment(record({ extraFields: [f.legal] }))]).description, f.reason, name);
    }
  });

  test('另有一行以引用、標題、有序清單、+ 清單開頭的同一欄位：欄位重複或格式不符', () => {
    for (const [name, f] of Object.entries(FIELD_LINES)) {
      const tail = f.legal.slice(2); // 「結果：APPROVED」等，不含清單符號
      for (const line of [`> - ${tail}`, `> ${tail}`, `## ${tail}`, `1. ${tail}`, `1) ${tail}`, `+ ${tail}`, `>> 12. ${tail}`]) {
        const r = judge([comment(record({ extraFields: [line] }))]);
        assert.equal(r.state, 'failure', `${name}：${line}`);
        assert.match(r.description, f.reason, `${name}：${line}`);
      }
    }
  });

  test('唯一的一行寫在引用區塊或縮排中：原文不符逐字格式而無效', () => {
    for (const [name, f] of Object.entries(FIELD_LINES)) {
      for (const line of [`> ${f.legal}`, `    ${f.legal}`, `\t${f.legal}`]) {
        const r = judge([comment(record().replace(f.legal, line))]);
        assert.equal(r.state, 'failure', `${name}：${JSON.stringify(line)}`);
        assert.match(r.description, f.reason, `${name}：${JSON.stringify(line)}`);
      }
    }
  });

  test('「針對 commit」只寫在引用區塊且含 head SHA：仍是候選，判為無效且不退回較早的有效紀錄', () => {
    const quoted = record().replace(`- 針對 commit：${HEAD}`, `> - 針對 commit：${HEAD}`);
    assert.equal(isCandidateFor(quoted, HEAD), true);
    const good = comment(record(), { at: '2026-11-09T10:00:00Z' });
    const bad = comment(quoted, { at: '2026-11-09T11:00:00Z', url: 'quoted' });
    const r = judge([good, bad]);
    assert.equal(r.state, 'failure');
    assert.match(r.description, /欄位重複或格式不符：針對 commit$/);
    assert.equal(r.targetUrl, 'quoted');
  });

  test('引用區塊中的表格：整個表格在引用中、或唯一的表格列只有一列且在引用中，皆為表格格式不符', () => {
    const quotedTable = record().split('\n').map((l) => (l.startsWith('|') ? `> ${l}` : l)).join('\n');
    failsWith(quotedTable, /表格格式不符：第 \d+ 行/);
    const onlyOne = record({ rows: [] })
      .replace('| 編號 | 項目 | 結果 | 說明 |\n|---|---|---|---|\n', '')
      .concat('\n> | R-5 | 項目 | 不通過 | |');
    failsWith(onlyOne, /表格格式不符：第 \d+ 行/);
  });
});

describe('evaluate：合法格式的對照組（v0.5.1；DQ-13 的對照）', () => {
  test('review-process.md 第 2 節範本（補齊 R-3～R-15）判為 success', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = readFileSync(path.resolve(path.dirname(SCRIPT), '../docs/design/review-process.md'), 'utf8');
    const section = doc.slice(doc.indexOf('## 2. 審查紀錄格式'), doc.indexOf('## 3. 審查清單'));
    const block = section.match(/```markdown\n([\s\S]*?)\n```/);
    assert.ok(block, '找不到第 2 節的範本程式碼區塊');
    const lines = block[1].split('\n');
    const omit = lines.findIndex((l) => l.startsWith('（範例省略'));
    assert.ok(omit > 0, '範本中找不到「範例省略」說明列');
    const filled = CHECKLIST_IDS.slice(2).map((id) =>
      id === 'R-5' ? '| R-5 | 狀態機變更與 spec.md 第 5 節一致 | 不適用 | 本 PR 沒有 core/game.js |' : `| ${id} | 項目 | 通過 | |`);
    const body = [...lines.slice(0, omit), ...filled, ...lines.slice(omit + 1)].join('\n');
    const sha = body.match(/^- 針對 commit：([0-9a-f]{40})$/m)?.[1];
    assert.ok(sha, '範本中找不到 40 碼 SHA');
    const prBody = ['## 作者', '- 角色：實作 agent', '- 工作階段：impl-2026-11-05-pr2', '- 角色：測試 agent', '- 工作階段：test-2026-11-05-pr2'].join('\n');
    const r = evaluate({ headSha: sha, prBody, prUrl: 'pr', comments: [comment(body)] });
    assert.equal(r.state, 'success', r.description);
    assert.match(r.description, /審查者 review-2026-11-05-pr2-a/);
  });

  test('PR #2 上實際通過的紀錄（以 v0.5 格式補上 R-15 列；驗收編號改為虛構）判為 success', () => {
    const r = judge([comment(PROBE_RECORD)], PROBE_PR_BODY);
    assert.equal(r.state, 'success', r.description);
    assert.match(r.description, /審查者 reviewer-probe-a-20261110/);
  });

  test('PR #2 的紀錄原文只有 R-1～R-14：依 v0.5 格式判為審查清單缺項 R-15', () => {
    const withoutR15 = PROBE_RECORD.replace(/\n\| R-15 \|[^\n]*/, '');
    const r = judge([comment(withoutR15)], PROBE_PR_BODY);
    assert.equal(r.state, 'failure');
    assert.match(r.description, /審查清單缺項：R-15$/);
  });

  test('「發現的問題」條列中的「R-5：不通過」維持有效（DQ-13 (b) 不涵蓋；判定只看逐項結果表）', () => {
    for (const line of ['- R-5：不通過，暫停轉移缺少計時器處理', '- R-5 不通過', '1. R-5：不通過', '- **R-5**：不通過']) {
      const r = judge([comment(record({ after: ['', '### 發現的問題', '', line] }))]);
      assert.equal(r.state, 'success', `${line}：${r.description}`);
    }
    // 對照：同樣的「不通過」寫在逐項結果表中即失敗
    failsWith(record({ rows: rowsWith({ 'R-5': '| R-5 | 項目 | 不通過 | 暫停轉移缺少計時器處理 |' }) }), /審查要求修改/);
  });
});

describe('外層：--dry-run 印出 PR 狀態（v0.5.1）', () => {
  for (const prState of ['open', 'closed']) {
    test(`PR 為 ${prState}：輸出含（${prState}），只有讀取請求`, async () => {
      const mock = mockApi({ prState, pages: [[comment(record())]] });
      await withServer(mock, async (api) => {
        const out = [];
        const r = await runGate({ argv: ['--dry-run'], env: { GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '7', GITHUB_API_URL: api }, log: (s) => out.push(s) });
        assert.equal(r.written, false);
        assert.match(out[0], new RegExp(`^review-gate --dry-run：PR #7（${prState}）head ${HEAD}$`));
        assert.ok(mock.calls.every((c) => c.method === 'GET'));
      });
    });
  }
});

// PR #2（探測 PR A）上實際留下並由 main 版 review-gate 判為 success 的紀錄（comment 6762784692），
// 只做三處調整：SHA 換成本檔的 HEAD；文中的真實驗收編號改為虛構編號 AC-ZZ-*（模組單元測試不使用真實編號）；
// 依 v0.5 第 2 節補上 R-15 一列（原文為 v0.4 格式，只有 R-1～R-14）。
const PROBE_PR_BODY = ['## 作者', '- 角色：統籌 agent', '- 工作階段：orchestrator-20261110'].join('\n');
const PROBE_RECORD = `<!-- review-record v1 -->
## 審查紀錄

- 結果：APPROVED
- 針對 commit：${HEAD}
- 審查者：審查 agent，工作階段 reviewer-probe-a-20261110
- 作者：統籌 agent，工作階段 orchestrator-20261110（照抄 PR 說明「## 作者」段落）
- 獨立性：審查者與作者為同一模型（Claude）的不同工作階段（docs/workflow.md W-1）。審查者以全新上下文啟動，未讀作者的推理過程，只讀 PR 差異與說明、需求、設計與審查清單
- 審查依據：需求文件 v1.1；軟體規格書 v0.4；審查清單 v0.2（main 上的 review-process.md v0.4，判定以 main 上 commit 7707e9f 的 \`scripts/review-gate.mjs\` 為準）
- 已載入 skill：agent-dev-workflow 1.1
- 性質：**本 PR 為不合併的探測 PR**（spec.md 12.6 步驟 6b、8；DQ-11 (d)、DQ-12）。本則紀錄供步驟 8 (2)「留紀錄後 review-record 變為 success」的驗證，不代表同意合併

### 檢查結果

- \`GET compare/main...${HEAD}\`：ahead 3、behind 0、**檔案差異 0**。三個 commit：8ff1b34（空 commit，無檔案）、b50ea55（新增 \`tests/unit/probe-unit-failure.test.mjs\`）、060a570（刪除同一檔案）。淨變更為零。
- PR 說明「變更內容」寫明「探測 PR A：不合併」，並寫明完成後關閉、刪除分支。
- PR 說明寫明「6b 完成前，審查 agent 不在本 PR 留審查紀錄」。依本 PR 驗證紀錄 2，以及審查者讀取 \`branches/main/protection\` 的結果（必要檢查 7 項含 \`review-record\`，\`strict: true\`），6b 已完成，可以留紀錄。
- head 060a570 的 check run：\`unit\`、\`acceptance-ids\`、\`pr-body\`、\`e2e (chromium)\`、\`e2e (firefox)\`、\`e2e (webkit)\`、\`review-gate\` 全部 success。\`review-record\` 留紀錄前為 failure，說明「沒有針對 060a570 的審查紀錄」，符合預期。
- 本則草稿留下前，已用 main 上 \`scripts/review-gate.mjs\` 的 \`evaluate\` 搭配本 PR 說明在本機試算，結果為 success。

### 逐項結果

| 編號 | 項目 | 結果 | 說明 |
|---|---|---|---|
| R-1 | PR 說明含上工檢查與正確的 skill 版本號 | 通過 | 上工檢查全部勾選；agent-dev-workflow 1.1 等於 main 上 SKILL.md 變更紀錄最後一列；pr-body success |
| R-2 | 對應編號完整，每個變更可對應到需求或設計編號 | 通過 | 對應 EQ-11、AC-ZZ-11、EQ-2、AC-ZZ-2、spec.md 12.6 步驟 6b、8、DQ-11 (d)、DQ-12；三個 commit 訊息皆標明編號 |
| R-3 | 角色分工 | 通過 | 只有統籌 agent 暫時新增後刪除 \`tests/unit/\` 下的探測檔，屬 DQ-12 (b) 的驗證步驟；沒有修改 \`tests/acceptance/\`、\`tests/support/\`、\`src/\`，淨變更為零 |
| R-4 | 沒有實作需求或規格書沒寫的行為 | 不適用 | 淨變更為零，沒有任何產品行為 |
| R-5 | 狀態機變更與 spec.md 第 5 節一致 | 不適用 | 本 PR 沒有 \`core/game.js\` 的變更 |
| R-6 | 驗收測試命名、時鐘控制、未放寬驗收 | 不適用 | 本 PR 沒有驗收測試的變更 |
| R-7 | 單元測試涵蓋模組測試標準 | 不適用 | 暫時的探測測試已於 060a570 刪除，淨變更沒有單元測試 |
| R-8 | \`core\` 層次相依 | 不適用 | 本 PR 沒有 \`src/js/core/\` 的變更 |
| R-9 | \`src/\` 沒有外部網址、第三方程式庫、網路字型、cookie | 不適用 | 本 PR 沒有 \`src/\` 的變更 |
| R-10 | DOM 測試介面變更已同步 | 不適用 | 本 PR 沒有 DOM 測試介面的變更 |
| R-11 | 主分支不會壞：CI 全部通過，未實作功能的驗收為略過 | 通過 | head 060a570 的六項必要 check run 全部 success；本 PR 不會合併，主分支不受影響 |
| R-12 | 文件與 skill | 不適用 | 本 PR 沒有文件或 skill 的變更；兩個產品負責人維護的 skill 副本未被修改 |
| R-13 | 程式品質 | 不適用 | 淨變更為零，沒有程式碼 |
| R-14 | CI 與檢查規則的變更沒有降低任何檢查 | 不適用 | 本 PR 沒有修改 \`.github/workflows/*\`、檢查腳本、\`playwright.config.mjs\`、\`package.json\`、\`supplementary-acceptance.json\` 或 \`docs/requirements.md\`；review-gate 以 main 上的版本執行 |
| R-15 | 驗收測試確實驗證 | 不適用 | 本 PR 沒有驗收測試的變更 |

### 發現的問題

無。

**給產品負責人：** 本 PR 為不合併的探測 PR，驗證完成後依 PR 說明關閉並刪除分支。本則紀錄只用於 spec.md 12.6 步驟 8 (2)。


---
_Generated by [Claude Code](https://claude.ai/code)_`;

// ─────────── DQ-13 (b)（review-process.md 第 4 節「偵測形式」F1～F8、T1、T2 與 20 種寫法的判定表） ───────────

describe('DQ-13 (b)：判定表中的每一種無效寫法（加入合法紀錄的一行）', () => {
  const CR = 'CHANGES_REQUESTED';
  // [加入的一行, 預期的失敗原因]；判定表的 19 種無效寫法（核取方塊另測 [x]、[X]）
  const INVALID = [
    [`> - 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`> 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`### 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`1. 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`    - 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`• 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`・ 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`– 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`- [ ] 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`- [x] 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`- [X] 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`<b>結果</b>：${CR}`, /欄位重複或格式不符：結果$/],
    // v0.6.1 起 X6 先於欄位行判定（review-process.md 4.1「檢查順序」），原因改為「含 HTML 註解或宣告」
    [`<!-- - 結果：${CR} -->`, /含 HTML 註解或宣告：第 \d+ 行$/],
    [`\\- 結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`1、結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`（1）結果：${CR}`, /欄位重複或格式不符：結果$/],
    [`[結果](#)：${CR}`, /欄位重複或格式不符：結果$/],
    ['> | R-5 | 項目 | 不通過 | |', /表格格式不符：第 \d+ 行$/],
    ['- | R-5 | 項目 | 不通過 | |', /表格格式不符：第 \d+ 行$/],
    ['<table><tr><td>R-5</td><td>不通過</td></tr></table>', /表格格式不符：第 \d+ 行$/],
  ];
  for (const [line, reason] of INVALID) {
    test(`無效：${JSON.stringify(line)}`, () => {
      // 欄位類寫在欄位區、表格類寫在「發現的問題」，與判定表相同：只加入這一行
      const body = reason.source.includes('表格') ? record({ after: ['', '### 發現的問題', '', line] }) : record({ extraFields: [line] });
      const r = judge([comment(body)]);
      assert.equal(r.state, 'failure', line);
      assert.match(r.description, reason, line);
    });
  }

  test('三個欄位都適用：以 •、核取方塊、HTML 註解、跳脫、括號編號、連結寫第二行即無效', () => {
    for (const [name, f] of Object.entries(FIELD_LINES)) {
      const tail = f.legal.slice(2);
      const label = tail.slice(0, tail.indexOf('：'));
      for (const line of [`• ${tail}`, `- [ ] ${tail}`, `\\${f.legal}`, `(2) ${tail}`, `[${label}](https://example.test)${tail.slice(label.length)}`]) {
        assert.match(judge([comment(record({ extraFields: [line] }))]).description, f.reason, `${name}：${line}`);
      }
      // HTML 註解：v0.6.1 起由 X6 先判為無效
      assert.match(judge([comment(record({ extraFields: [`<!-- ${f.legal} -->`] }))]).description, /含 HTML 註解或宣告：第 \d+ 行$/, name);
    }
  });

  test('跨行 HTML 註解中的欄位行：偵測形式逐行偵測（只刪分隔符號、不刪內容）；v0.6.1 起由 X6 先判為無效', () => {
    assert.ok(fieldForm(`- 結果：${CR}`).startsWith('結果:'));
    assert.equal(fieldForm('<!--'), '');
    failsWith(record({ extraFields: ['<!--', `- 結果：${CR}`, '-->'] }), /含 HTML 註解或宣告：第 9 行$/);
  });

  test('唯一的一行寫成 (b) 才偵測到的形式：原文不符逐字格式而無效（候選判定也適用）', () => {
    failsWith(record().replace('- 結果：APPROVED', '• 結果：APPROVED'), /欄位重複或格式不符：結果$/);
    failsWith(record().replace('- 結果：APPROVED', '<b>結果</b>：APPROVED'), /欄位重複或格式不符：結果$/);
    const linked = record().replace(`- 針對 commit：${HEAD}`, `- [針對 commit](#)：${HEAD}`);
    assert.equal(isCandidateFor(linked, HEAD), true);
    failsWith(linked, /欄位重複或格式不符：針對 commit$/);
  });
});

describe('DQ-13 (b)：fieldForm 的各步驟（F1～F8）', () => {
  test('合法欄位行的偵測形式以標籤開頭', () => {
    assert.equal(fieldForm('- 結果：APPROVED'), '結果:approved');
    assert.equal(fieldForm(`- 針對 commit：${HEAD}`), `針對commit:${HEAD}`);
    assert.ok(fieldForm('- 審查者：審查 agent，工作階段 review-1').startsWith('審查者:'));
  });

  test('F2：`<版本>` 這類 `<` 後非 ASCII 字母的文字不是標籤，不刪；巢狀標籤重複到不動點', () => {
    assert.equal(fieldForm('- 審查依據：需求文件 v<版本>'), '審查依據:需求文件v<版本>');
    assert.equal(fieldForm('<i><b>結果</b></i>：X'), '結果:x');
    assert.equal(fieldForm('<<b>b>結果：X'), '結果:x'); // 刪掉內層標籤後外層才成為標籤
  });

  test('F3：連結與圖片換成文字，巢狀重複到不動點', () => {
    assert.equal(fieldForm('![結果](a.png)：X'), '結果:x');
    assert.equal(fieldForm('[[結果](a)](b)：X'), '結果:x');
  });

  test('F4～F6：跳脫、強調與刪除線、行內核取方塊', () => {
    assert.equal(fieldForm('\\# \\* 結果：X'), '結果:x');
    assert.equal(fieldForm('~~**結果**~~：X'), '結果:x');
    assert.equal(fieldForm('- [ ] [x] 結果：X'), '結果:x');
  });

  test('F7 只刪非字母前綴：以字母開頭的前綴不算欄位行（判定表「其他殘餘」）', () => {
    assert.equal(fieldForm('12)…» 結果：X'), '結果:x');
    assert.ok(!fieldForm('a. 結果：X').startsWith('結果:'));
    assert.ok(!fieldForm('備註結果：X').startsWith('結果:'));
  });

  test('F8：英文轉小寫（「針對 Commit」也算）', () => {
    assert.ok(fieldForm(`- 針對 Commit：${HEAD}`).startsWith('針對commit:'));
  });
});

describe('DQ-13 (b)：isTableLine（T1、T2）', () => {
  test('T1：HTML 表格標籤（不分大小寫、可為結尾標籤）；標籤名後接字母數字者不算', () => {
    for (const l of ['<table>', 'x </TD>', '<tr class="a">', '<th>', '<tbody>', '<thead>', '<td']) assert.equal(isTableLine(l), true, l);
    for (const l of ['<trace>', '<tdx>', '<th1>', '<td結果>', '- 備註 <b>粗體</b>']) assert.equal(isTableLine(l), false, l);
  });

  test('T2：刪除行首非字母且非 `|` 的前綴後以 `|` 開頭；全形 `｜`、HTML 註解中的表格列都算', () => {
    for (const l of ['| R-1 |', '  > > | R-1 |', '- | R-1 |', '1. | R-1 |', '• | R-1 |', '｜ R-1 ｜', '<!-- | R-1 | -->']) assert.equal(isTableLine(l), true, l);
    for (const l of ['- R-5：不通過', '說明 | 其他', '---', '']) assert.equal(isTableLine(l), false, l);
  });

  test('合法範本的每一行：只有逐項結果表的列是表格列', () => {
    const lines = record().split('\n');
    const tableLines = lines.filter((l) => isTableLine(l));
    assert.deepEqual(tableLines, lines.filter((l) => l.startsWith('|')));
    assert.equal(tableLines.length, 2 + CHECKLIST_IDS.length);
  });

  test('PR #2 實際紀錄的每一行：三個欄位各偵測一次，表格列恰為逐項結果表', () => {
    const lines = PROBE_RECORD.split('\n');
    for (const label of ['結果:', '針對commit:', '審查者:']) {
      assert.equal(lines.filter((l) => fieldForm(l).startsWith(label)).length, 1, label);
    }
    assert.deepEqual(lines.filter((l) => isTableLine(l)), lines.filter((l) => l.startsWith('|')));
  });
});

// ─────────── v0.6.1：DQ-14 (b)（review-process.md 4.1：拒絕規則 X1～X7、F2′、F9、T3、T4、檢查順序、候選、作者段落） ───────────

const CRQ = 'CHANGES_REQUESTED';
const HF = 'ㅤ'; // HANGUL FILLER（Lo，Default_Ignorable_Code_Point）
/** 4.1「實測方法」的基準：逐項表（R-1～R-15）之後接「### 發現的問題」與「1. 無。」。 */
const BASE_AFTER = ['', '### 發現的問題', '', '1. 無。'];
const DEFAULT_ROWS = CHECKLIST_IDS.map((id) => `| ${id} | 項目 | 通過 | |`);
/** 位置：表後（緊接 R-15 列，沒有空行）、欄位中（欄位行之後）、文末（空一行後）。 */
const at = {
  table: (...lines) => record({ rows: [...DEFAULT_ROWS, ...lines], after: BASE_AFTER }),
  fields: (...lines) => record({ extraFields: lines, after: BASE_AFTER }),
  end: (...lines) => record({ after: [...BASE_AFTER, '', ...lines] }),
};
/** record() 中 R-15 列的下一行（1 起算）：標頭 13 行＋15 列。 */
const AFTER_TABLE_LINE = 13 + CHECKLIST_IDS.length + 1;

const T3_REASON = new RegExp(`表格格式不符：第 ${AFTER_TABLE_LINE} 行$`);
const TABLE_REASON = /表格格式不符：第 \d+ 行$/;
const INVISIBLE_REASON = /含不可見字元$/;
const CHAR_REF_REASON = /含字元參照$/;
const COMMENT_REASON = /含 HTML 註解或宣告：第 \d+ 行$/;
const DUP_RESULT = /欄位重複或格式不符：結果$/;

describe('v0.6.1：4.1 判定表的每一個案例（PR-1c 版的判定與回報原因）', () => {
  // [編號, 紀錄, 預期原因]。表中 PR-1b 版判為有效的案例與 PR-1b 版已判為無效的案例都列入
  const CASES = [
    ['A1', at.table('R-5 | 項目 | 不通過 | x'), T3_REASON],
    ['A2', at.table('R-5 | 項目 | 不通過 | x |'), T3_REASON],
    ['A3', at.table('   R-5 | 項目 | 不通過 | x |'), T3_REASON],
    ['A4', at.table('R-5 不通過'), T3_REASON],
    ['A4b', at.table('補充：R-5 實為不通過'), T3_REASON],
    ['C10', at.table(`${HF}| R-5 | 項目 | 不通過 | x |`), INVISIBLE_REASON],
    ['A5', at.end('編號 | 結果', '--- | ---', 'R-5 | 不通過'), TABLE_REASON],
    ['A7', at.end('> 編號 | 結果', '> --- | ---', '> R-5 | 不通過'), TABLE_REASON],
    ['A8', at.end('- 編號 | 結果', '  --- | ---', '  R-5 | 不通過'), TABLE_REASON],
    ['A9', at.end('R-5 不通過', ':-:'), TABLE_REASON],
    ['A9b', at.end('R-5 不通過 |', '--- |'), TABLE_REASON],
    ['A11', at.end('R-5 &#124; 項目 &#124; 不通過 &#124; x'), CHAR_REF_REASON],
    ['B1', at.fields(`- &#x7D50;果：${CRQ}`), CHAR_REF_REASON],
    ['B2', at.fields(`- &#32080;果：${CRQ}`), CHAR_REF_REASON],
    ['B3', at.end(`-&nbsp;結果：${CRQ}`), CHAR_REF_REASON],
    ['B4', at.end(`&#45; 結果：${CRQ}`), CHAR_REF_REASON],
    ['B5', at.end(`- 結&ZeroWidthSpace;果：${CRQ}`), CHAR_REF_REASON],
    ['B6', at.table('| R&#45;5 | 項目 | 不通過 | |'), CHAR_REF_REASON],
    ['B7', at.end(`- 結果&#xFF1A;${CRQ}`), CHAR_REF_REASON],
    ['B8', at.end(`- 結果&colon;${CRQ}`), CHAR_REF_REASON],
    ['C1', at.end(`${HF}- 結果：${CRQ}`), INVISIBLE_REASON],
    ['C2', at.end(`ﾠ- 結果：${CRQ}`), INVISIBLE_REASON],
    ['C5', at.end(`- ᅟ結果：${CRQ}`), INVISIBLE_REASON],
    ['C3', at.end(`- 結͏果：${CRQ}`), INVISIBLE_REASON],
    ['C4', at.end(`- 結︀果：${CRQ}`), INVISIBLE_REASON],
    ['C6', at.end(`- 結${HF}果：${CRQ}`), INVISIBLE_REASON],
    ['C9', at.end(`- 結\u{E0100}果：${CRQ}`), INVISIBLE_REASON],
    ['C7', at.end(`⠀- 結果：${CRQ}`), INVISIBLE_REASON],
    ['C8', at.end(` - 結果：${CRQ}`), DUP_RESULT],
    ['D1', at.end(`- 結<!--x-->果：${CRQ}`), COMMENT_REASON],
    ['D2', at.end(`- 結<?x?>果：${CRQ}`), COMMENT_REASON],
    ['D4', at.end(`- 結<![CDATA[x]]>果：${CRQ}`), COMMENT_REASON],
    ['D3', at.end(`- 結<x y="a>b">果：${CRQ}`), DUP_RESULT],
    ['H1', at.end('- 結<span', `class="x">果：${CRQ}`), /HTML 標籤未在同一行結束：第 \d+ 行$/],
    ['E1', at.end(`- 结果：${CRQ}`), DUP_RESULT],
    ['G1', record({ after: BASE_AFTER }).replace('- 結果：APPROVED', '<!--\n- 結果：APPROVED\n-->'), COMMENT_REASON],
    ['G2', record({ after: BASE_AFTER }).replace('| 編號 | 項目 | 結果 | 說明 |', '<!--\n| 編號 | 項目 | 結果 | 說明 |').replace('| R-15 | 項目 | 通過 | |', '| R-15 | 項目 | 通過 | |\n-->'), COMMENT_REASON],
    ['G3', record({ w1: '（略）', extraFields: ['<!-- 同一模型 不同工作階段 -->'], after: BASE_AFTER }), COMMENT_REASON],
  ];

  test('對照：基準紀錄本身有效', () => {
    assert.equal(judge([comment(record({ after: BASE_AFTER }))]).state, 'success');
  });

  for (const [id, body, reason] of CASES) {
    test(`${id}：判定無效，原因符合「PR-1c 版」欄`, () => {
      const r = judge([comment(body)]);
      assert.equal(r.state, 'failure', id);
      assert.match(r.description, reason, `${id}：${r.description}`);
    });
  }

  test('H1 的回報行號是標籤開始的那一行；D1 的行號是含註解的那一行', () => {
    const h1 = at.end('- 結<span', `class="x">果：${CRQ}`);
    const n = h1.split('\n').indexOf('- 結<span') + 1;
    assert.equal(validateRecord(h1).reason, `HTML 標籤未在同一行結束：第 ${n} 行`);
    const d1 = at.end(`- 結<!--x-->果：${CRQ}`);
    assert.equal(validateRecord(d1).reason, `含 HTML 註解或宣告：第 ${d1.split('\n').length} 行`);
  });

  test('A9 的回報行號是 :-: 那一行（T4）；A1 的行號是表後的下一行（T3）', () => {
    const a9 = at.end('R-5 不通過', ':-:');
    assert.equal(validateRecord(a9).reason, `表格格式不符：第 ${a9.split('\n').length} 行`);
    assert.equal(validateRecord(at.table('R-5 不通過')).reason, `表格格式不符：第 ${AFTER_TABLE_LINE} 行`);
  });
});

describe('v0.6.1：誤判與維持有效（4.1 回歸表）', () => {
  const readFixture = async (name) => {
    const { readFileSync } = await import('node:fs');
    return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8');
  };
  const PR1_HEAD = '6d279ceb06efa1c86d9816a6be5ff49f52921901';
  const PR3_HEAD = 'e5212c73e57f59cac735408929ffacd140e6e12b';
  const PR1_BODY = ['## 作者', '- 角色：實作 agent', '- 工作階段：implementer-pr1-20261109', '- 角色：測試 agent', '- 工作階段：tester-pr1-20261109', '- 角色：統籌 agent', '- 工作階段：orchestrator-20261109'].join('\n');
  const PR3_BODY = ['## 作者', '- 工作階段：designer-pr1b-20261109', '- 工作階段：designer-pr1b-20261110', '- 工作階段：implementer-pr1b-20261110', '- 工作階段：tester-pr1b-20261110', '- 工作階段：orchestrator-20261110'].join('\n');
  const withR15 = (body) => body.replace(/(\| R-14 \|[^\n]*\n)/, '$1| R-15 | 驗收測試確實驗證 | 不適用 | 本 PR 時尚無 R-15 |\n');

  test('PR #1 的實際紀錄（補 R-15 列；驗收編號改為虛構）有效；原文只有 R-1～R-14 時缺 R-15', async () => {
    const raw = await readFixture('pr1-review-record.md');
    const ev = (body) => evaluate({ headSha: PR1_HEAD, prBody: PR1_BODY, prUrl: 'pr', comments: [comment(body)] });
    assert.match(ev(raw).description, /審查清單缺項：R-15$/);
    const r = ev(withR15(raw));
    assert.equal(r.state, 'success', r.description);
  });

  test('PR #2 的實際紀錄（補 R-15 列）在 v0.6.1 仍有效', () => {
    const r = judge([comment(PROBE_RECORD)], PROBE_PR_BODY);
    assert.equal(r.state, 'success', r.description);
  });

  test('PR #3 的實際紀錄：無效「含字元參照」；把兩個字元參照改寫為文字描述後有效', async () => {
    const raw = await readFixture('pr3-review-record.md');
    const ev = (body) => evaluate({ headSha: PR3_HEAD, prBody: PR3_BODY, prUrl: 'pr', comments: [comment(body)] });
    assert.equal(ev(raw).description, '含字元參照');
    const rewritten = raw.replace('`&nbsp;`', '不換行空白的具名字元參照').replace('`&#x7D50;`', '「結」字的十六進位字元參照');
    assert.doesNotMatch(rewritten, /&[#A-Za-z]/);
    const r = ev(rewritten);
    assert.equal(r.state, 'success', r.description);
  });

  test('第 2 節範本仍有效（另見「合法格式的對照組」）；emoji ✔️（含 U+FE0F）、散文 a<b 無效', () => {
    assert.equal(judge([comment(at.end('- 已確認 ✔️'))]).description, '含不可見字元');
    assert.match(judge([comment(at.end('- 若 a<b 則 …'))]).description, /HTML 標籤未在同一行結束：第 \d+ 行$/);
    // 不帶變體選擇符的字元、加空白的寫法有效
    assert.equal(judge([comment(at.end('- 已確認 ✔', '- 若 a < b 則 …'))]).state, 'success');
  });

  test('「發現的問題」以程式碼區塊貼出表格範例：無效（T2；只有單欄分隔列時 T4）', () => {
    assert.match(judge([comment(at.end('```', '| R-5 | 項目 | 不通過 | |', '```'))]).description, TABLE_REASON);
    assert.match(judge([comment(at.end('```', 'a', ':-:', '```'))]).description, TABLE_REASON);
  });

  test('n < 3、`<script>`、`Array<string>`、12:30-13:00、<版本> 有效', () => {
    const r = judge([comment(at.end('- n < 3 時', '- 不得出現 `<script>`', '- 型別 `Array<string>`', '- 12:30-13:00', '- 需求文件 v<版本>'))]);
    assert.equal(r.state, 'success', r.description);
  });
});

describe('v0.6.1：X1～X7、T3、T4 各自只觸發一條規則的案例', () => {
  const ONLY = [
    ['X1', at.end('- 控制字元\u0001'), /^含不可見字元$/],
    ['X2', at.end(`- 填充${HF}字`), /^含不可見字元$/],
    ['X3', at.end('- 結合符號 é'), /^含不可見字元$/],
    ['X4', at.end('- 點字空白⠀'), /^含不可見字元$/],
    ['X5', at.end('- 具名參照 &amp; 之後'), /^含字元參照$/],
    ['X6', at.end('- 說明 <! 這裡'), /^含 HTML 註解或宣告：第 \d+ 行$/],
    ['X7', at.end('- 若 a<b'), /^HTML 標籤未在同一行結束：第 \d+ 行$/],
    ['T3', at.table('補充'), new RegExp(`^表格格式不符：第 ${AFTER_TABLE_LINE} 行$`)],
    ['T4', at.end('a', ':-:'), /^表格格式不符：第 \d+ 行$/],
  ];
  for (const [rule, body, reason] of ONLY) {
    test(`${rule}`, () => {
      const r = validateRecord(body);
      assert.equal(r.ok, false, rule);
      assert.match(r.reason, reason);
    });
  }

  test('X1～X4 的字元各自不屬於其他規則（確認案例只觸發該規則）', () => {
    assert.ok(!/\p{Default_Ignorable_Code_Point}|\p{M}/u.test('\u0001'));
    assert.ok(!/\p{Cf}|\p{M}/u.test(HF) && /\p{Default_Ignorable_Code_Point}/u.test(HF));
    assert.ok(!/\p{Cf}|\p{Default_Ignorable_Code_Point}/u.test('́') && /\p{M}/u.test('́'));
    assert.ok(!/\p{Cf}|\p{Default_Ignorable_Code_Point}|\p{M}/u.test('⠀'));
  });

  test('檢查順序：同時違反 X5 與 T3 時回報「含字元參照」；同時違反 X1 與 X5 時回報「含不可見字元」', () => {
    assert.equal(validateRecord(at.table('補充 &amp;')).reason, '含字元參照');
    assert.equal(validateRecord(at.table('補充 &amp;​')).reason, '含不可見字元');
  });

  test('檢查順序：X6 先於 X7、X7 先於第 1 行標記與欄位行、T3 先於 T4、T4 先於 R 列缺項', () => {
    assert.match(validateRecord(at.end('<!-- a<b')).reason, /^含 HTML 註解或宣告/);
    assert.match(validateRecord(at.end('a<b').replace(MARKER, '<!-- review-record v2 -->')).reason, /^HTML 標籤未在同一行結束/);
    assert.equal(validateRecord(record().replace(MARKER, '<!-- review-record v2 -->')).reason, '第一行不是紀錄標記');
    assert.match(validateRecord(at.end(`- 若 a<b`, `- 結果：${CRQ}`)).reason, /^HTML 標籤未在同一行結束/);
    const t3t4 = at.table('補充', ':-:');
    assert.equal(validateRecord(t3t4).reason, `表格格式不符：第 ${AFTER_TABLE_LINE} 行`);
    const noTable = record({ rows: [], after: ['', 'a', ':-:'] }).replace('| 編號 | 項目 | 結果 | 說明 |\n|---|---|---|---|\n', '');
    assert.match(validateRecord(noTable).reason, /^表格格式不符：第 \d+ 行$/, '沒有表格時 T4 對每一行判定');
  });

  test('X6：第 1 行（標記）不受限；第 2 行起任何位置的 <! 或 <? 都無效', () => {
    assert.equal(validateRecord(record()).ok, true);
    assert.match(validateRecord(record().replace('## 審查紀錄', '## 審查紀錄 <?x')).reason, /^含 HTML 註解或宣告：第 2 行$/);
  });

  test('`- <b !>結果</b>：…` 由 X7 判為無效（F2′ 不刪不合文法的標籤）', () => {
    assert.match(validateRecord(at.fields(`- <b !>結果</b>：${CRQ}`)).reason, /^HTML 標籤未在同一行結束：第 \d+ 行$/);
    assert.match(validateRecord(record().replace('- 結果：APPROVED', '- <b !>結果</b>：APPROVED')).reason, /^HTML 標籤未在同一行結束/);
  });

  test('T3：表後的下一行只含空白或定位字元時有效；只含 U+00A0 的行不是空行；表格是最後一行時有效', () => {
    assert.equal(validateRecord(record({ after: ['  \t', '### 發現的問題'] })).ok, true);
    assert.equal(validateRecord(record({ after: [' ', '### 發現的問題'] })).reason, `表格格式不符：第 ${AFTER_TABLE_LINE} 行`);
    assert.equal(validateRecord(record({ after: [] })).ok, true);
  });

  test('T4：分隔列寫法的超集（引用、清單中）；分隔線與時間範圍不算；逐項表分隔列本身不算', () => {
    for (const l of [':-:', '> :--', '- |-', '1. --|--', '> - :-: |', '|-', '-:']) assert.ok(isSeparatorLike(l), l);
    for (const l of ['- - -', '---', '***', '12:30-13:00', '--', '|||', ':::', 'a | -', '- 結果：x']) assert.ok(!isSeparatorLike(l), l);
    assert.equal(validateRecord(record()).ok, true);
  });

  test('hasUnclosedTag：完整標籤刪除後仍有 < 緊接 ASCII 字母時成立', () => {
    for (const l of ['a<b', '- 結<span', '<b !>x', '</b', 'x </b !>']) assert.equal(hasUnclosedTag(l), true, l);
    for (const l of ['n < 3', '`<script>`', 'Array<string>', 'v<版本>', '<br/>', '<a href="x>y">t</a>', '< b', '<1>']) assert.equal(hasUnclosedTag(l), false, l);
  });
});

describe('v0.6.1：isCandidateFor 改為原文任何位置含 head 的完整 SHA', () => {
  test('只在說明文字中含 head SHA（沒有「針對 commit」行）的較晚一則：仍是候選，使判定無效', () => {
    const later = [MARKER, '## 審查紀錄', '', `補充：本則針對 ${HEAD}。`].join('\n');
    assert.equal(isCandidateFor(later, HEAD), true);
    const r = judge([comment(record()), comment(later, { at: '2026-11-09T11:00:00Z' })]);
    assert.equal(r.state, 'failure');
    assert.match(r.description, /^欄位重複或格式不符：/);
  });

  test('`- <b !>針對 commit</b>：<SHA>` 的較晚紀錄使較早的有效紀錄不生效', () => {
    const later = record().replace(`- 針對 commit：${HEAD}`, `- <b !>針對 commit</b>：${HEAD}`);
    assert.equal(isCandidateFor(later, HEAD), true);
    const r = judge([comment(record()), comment(later, { at: '2026-11-09T11:00:00Z', url: 'later' })]);
    assert.equal(r.state, 'failure');
    assert.equal(r.targetUrl, 'later');
  });

  test('大寫 SHA 也算候選；沒有標記或非協作者的評論仍不是候選', () => {
    const upper = `${MARKER}\n說明 ${HEAD.toUpperCase()}`;
    assert.equal(isCandidateFor(upper, HEAD), true);
    assert.equal(judge([comment(record()), comment(upper, { at: '2026-11-09T11:00:00Z' })]).state, 'failure');
    assert.equal(judge([comment(record()), comment(`說明 ${HEAD}`, { at: '2026-11-09T11:00:00Z' })]).state, 'success');
    assert.equal(judge([comment(record()), comment(upper, { assoc: 'NONE', at: '2026-11-09T11:00:00Z' })]).state, 'success');
  });

  test('短碼、舊 SHA、head 不是 40 碼時不是候選', () => {
    assert.equal(isCandidateFor(`${MARKER}\n${HEAD.slice(0, 39)}`, HEAD), false);
    assert.equal(isCandidateFor(record({ sha: OLD }), HEAD), false);
    assert.equal(isCandidateFor(record(), HEAD.slice(0, 7)), false);
  });
});

describe('v0.6.1：review-gate 的作者段落（與 pr-body 共用 validateAuthorSection）', () => {
  const body = (...lines) => ['## 作者', ...lines, '## 上工檢查'].join('\n');
  test('看似「工作階段」卻不符逐字格式的行、含字元參照或 U+3164：作者工作階段識別格式不符', () => {
    for (const prBody of [
      body('- 工作階段：impl-1', '- 工作階段: review-1'),
      body('- 工作階段：impl-1', '**工作階段**：review-1'),
      body('- 工作階段：impl-1', '> 工作階段：review-1'),
      body('- 工作階段：impl-1', '- 工作阶段：review-1'),
      body('- 工作階段：impl-1', '- 備註 &#32;'),
      body(`- 工作階段：impl-1${HF}`),
    ]) {
      const r = judge([comment(record())], prBody);
      assert.equal(r.state, 'failure', prBody);
      assert.equal(r.description, '作者工作階段識別格式不符', prBody);
    }
  });

  test('合法的作者段落（含範本中只有註解的空值、角色行）照舊判定', () => {
    assert.equal(judge([comment(record())], body('- 角色：實作 agent', '- 工作階段：impl-1', '- 工作階段：<!-- 例 -->')).state, 'success');
    assert.equal(judge([comment(record())], body('- 角色：實作 agent', '- 工作階段：review-1')).description, '審查者與作者相同或未標明');
  });
});

describe('v0.6.1：review-gate 的相依只有內建模組與本目錄的兩個檔案（review-process.md 第 4 節「工作流程設定」）', () => {
  test('review-gate.mjs、check-pr-body.mjs、detection.mjs 的匯入來源', async () => {
    const { readFileSync } = await import('node:fs');
    const allowed = new Set(['./check-pr-body.mjs', './detection.mjs']);
    for (const f of ['review-gate.mjs', 'check-pr-body.mjs', 'detection.mjs']) {
      const src = readFileSync(path.join(path.dirname(SCRIPT), f), 'utf8');
      const specs = [...src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
      for (const spec of specs) assert.ok(spec.startsWith('node:') || allowed.has(spec), `${f}：${spec}`);
      assert.doesNotMatch(src, /\brequire\(|\bimport\(/, f);
    }
  });
});
