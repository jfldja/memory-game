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
  hasMarker,
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
