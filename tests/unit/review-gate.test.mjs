// 模組單元測試：scripts/review-gate.mjs（module-test-standards.md M12、review-process.md 第 4 節）。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, parseReviewRecord, CHECKLIST_IDS, MARKER } from '../../scripts/review-gate.mjs';

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

function record({
  result = 'APPROVED',
  sha = HEAD,
  reviewer = '審查 agent，工作階段 review-1',
  w1 = '審查者與作者為同一模型（Claude）的不同工作階段（docs/workflow.md W-1）',
  rows = CHECKLIST_IDS.map((id) => [id, '通過']),
  marker = MARKER,
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
    '',
    '### 逐項結果',
    '',
    '| 編號 | 項目 | 結果 | 說明 |',
    '|---|---|---|---|',
    ...rows.map(([id, r]) => `| ${id} | 項目 | ${r} | |`),
  ].join('\n');
}

function comment(body, { assoc = 'OWNER', at = '2026-11-09T10:00:00Z', url = 'https://example.test/c/1' } = {}) {
  return { body, author_association: assoc, created_at: at, html_url: url };
}

function run(comments, prBody = PR_BODY) {
  return evaluate({ headSha: HEAD, prBody, prUrl: 'https://example.test/pr/1', comments });
}

describe('parseReviewRecord', () => {
  test('解析結果、SHA、審查者工作階段、W-1 註明與逐項結果', () => {
    const r = parseReviewRecord(record());
    assert.equal(r.result, 'APPROVED');
    assert.equal(r.sha, HEAD);
    assert.equal(r.reviewerSession, 'review-1');
    assert.equal(r.notesW1, true);
    assert.equal(Object.keys(r.items).length, 14);
  });

  test('第一行不是標記時回傳 null（含標記在第二行）', () => {
    assert.equal(parseReviewRecord('一般評論'), null);
    assert.equal(parseReviewRecord(`前言\n${record()}`), null);
  });

  test('審查者工作階段可接全形冒號，並在中文標點前結束', () => {
    assert.equal(parseReviewRecord(record({ reviewer: '審查 agent，工作階段：rv-2，備註' })).reviewerSession, 'rv-2');
    assert.equal(parseReviewRecord(record({ reviewer: '審查 agent' })).reviewerSession, null);
  });

  test('CRLF 換行亦可解析', () => {
    assert.equal(parseReviewRecord(record().replace(/\n/g, '\r\n')).sha, HEAD);
  });
});

describe('evaluate', () => {
  test('符合格式、針對最新 SHA 的紀錄：success，連結指向該則評論', () => {
    const r = run([comment(record())]);
    assert.equal(r.state, 'success');
    assert.match(r.description, /已審查 aaaaaaa（審查者 review-1）/);
    assert.equal(r.targetUrl, 'https://example.test/c/1');
  });

  test('沒有紀錄：failure，連結指向 PR', () => {
    const r = run([comment('LGTM')]);
    assert.deepEqual(r, {
      state: 'failure',
      description: '沒有針對 aaaaaaa 的審查紀錄',
      targetUrl: 'https://example.test/pr/1',
    });
  });

  test('紀錄針對舊 commit：視為沒有紀錄', () => {
    assert.match(run([comment(record({ sha: OLD }))]).description, /沒有針對/);
  });

  test('紀錄只寫短碼：視為沒有紀錄', () => {
    assert.match(run([comment(record({ sha: HEAD.slice(0, 7) }))]).description, /沒有針對/);
  });

  test('紀錄寫大寫 SHA：不視為完整 40 碼小寫 SHA', () => {
    assert.match(run([comment(record({ sha: HEAD.toUpperCase() }))]).description, /沒有針對/);
  });

  test('非協作者的評論不採計', () => {
    for (const assoc of ['NONE', 'CONTRIBUTOR', 'FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR', 'MANNEQUIN']) {
      assert.equal(run([comment(record(), { assoc })]).state, 'failure', assoc);
    }
    for (const assoc of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      assert.equal(run([comment(record(), { assoc })]).state, 'success', assoc);
    }
  });

  test('審查者工作階段等於任一位作者：failure', () => {
    for (const s of ['impl-1', 'test-1']) {
      const r = run([comment(record({ reviewer: `審查 agent，工作階段 ${s}` }))]);
      assert.equal(r.state, 'failure');
      assert.match(r.description, /審查者與作者相同或未標明/);
    }
  });

  test('審查者未標明工作階段：failure', () => {
    assert.match(run([comment(record({ reviewer: '審查 agent' }))]).description, /未標明/);
  });

  test('缺 W-1 註明：failure', () => {
    assert.match(run([comment(record({ w1: '獨立審查' }))]).description, /W-1/);
    assert.match(run([comment(record({ w1: '同一模型' }))]).description, /W-1/);
  });

  test('清單缺 R-1～R-14 任一項或結果空白：failure', () => {
    for (const missing of CHECKLIST_IDS) {
      const rows = CHECKLIST_IDS.filter((id) => id !== missing).map((id) => [id, '通過']);
      const r = run([comment(record({ rows }))]);
      assert.equal(r.state, 'failure', missing);
      assert.match(r.description, new RegExp(`審查清單不完整：${missing}$`));
    }
    const blank = CHECKLIST_IDS.map((id) => [id, id === 'R-7' ? '' : '通過']);
    assert.match(run([comment(record({ rows: blank }))]).description, /R-7/);
  });

  test('「不適用」是有效結果', () => {
    const rows = CHECKLIST_IDS.map((id) => [id, id === 'R-5' ? '不適用' : '通過']);
    assert.equal(run([comment(record({ rows }))]).state, 'success');
  });

  test('含「不通過」卻寫 APPROVED：failure', () => {
    const rows = CHECKLIST_IDS.map((id) => [id, id === 'R-3' ? '不通過' : '通過']);
    assert.match(run([comment(record({ rows }))]).description, /審查要求修改/);
  });

  test('結果為 CHANGES_REQUESTED 或其他值：failure', () => {
    assert.match(run([comment(record({ result: 'CHANGES_REQUESTED' }))]).description, /審查要求修改/);
    assert.match(run([comment(record({ result: 'approved' }))]).description, /審查要求修改/);
  });

  test('多則紀錄以建立時間最後一則為準（與陣列順序無關）', () => {
    const approved = comment(record(), { at: '2026-11-09T10:00:00Z', url: 'u1' });
    const changes = comment(record({ result: 'CHANGES_REQUESTED' }), { at: '2026-11-09T11:00:00Z', url: 'u2' });
    assert.equal(run([approved, changes]).state, 'failure');
    assert.equal(run([changes, approved]).state, 'failure');
    const later = comment(record(), { at: '2026-11-09T12:00:00Z', url: 'u3' });
    const r = run([later, approved, changes]);
    assert.equal(r.state, 'success');
    assert.equal(r.targetUrl, 'u3');
  });

  test('最後一則針對舊 SHA 時，以針對最新 SHA 的最後一則為準', () => {
    const current = comment(record(), { at: '2026-11-09T10:00:00Z' });
    const stale = comment(record({ sha: OLD, result: 'CHANGES_REQUESTED' }), { at: '2026-11-09T11:00:00Z' });
    assert.equal(run([current, stale]).state, 'success');
  });

  test('非協作者較晚留下的紀錄不覆蓋協作者的紀錄', () => {
    const owner = comment(record(), { at: '2026-11-09T10:00:00Z' });
    const outsider = comment(record({ result: 'CHANGES_REQUESTED' }), { assoc: 'NONE', at: '2026-11-09T11:00:00Z' });
    assert.equal(run([owner, outsider]).state, 'success');
  });

  test('PR 說明沒有作者段落時，仍依審查者是否標明工作階段判定', () => {
    assert.equal(run([comment(record())], '').state, 'success');
  });

  test('description 不超過 140 字', () => {
    const r = run([comment(record({ reviewer: `審查 agent，工作階段 ${'x'.repeat(300)}` }))]);
    assert.ok(r.description.length <= 140);
  });
});

describe('main：對模擬的 GitHub API 執行', () => {
  test('重新讀取 PR 與全部評論（分頁），把結果寫入最新 head SHA 的 review-record 狀態', async () => {
    const { createServer } = await import('node:http');
    const { execFile } = await import('node:child_process');
    const pathMod = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const script = pathMod.resolve(pathMod.dirname(fileURLToPath(import.meta.url)), '../../scripts/review-gate.mjs');

    const filler = Array.from({ length: 100 }, (_, k) => comment(`留言 ${k}`, { at: `2026-11-09T09:00:${String(k % 60).padStart(2, '0')}Z` }));
    const posted = [];
    const server = createServer((req, res) => {
      let data = '';
      req.on('data', (d) => (data += d));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.headers.authorization !== 'Bearer t0ken') return res.writeHead(401).end('{}');
        if (req.method === 'GET' && req.url === '/repos/o/r/pulls/7') {
          return res.end(JSON.stringify({ state: 'open', head: { sha: HEAD }, body: PR_BODY, html_url: 'pr-url' }));
        }
        if (req.method === 'GET' && req.url === '/repos/o/r/issues/7/comments?per_page=100&page=1') {
          return res.end(JSON.stringify(filler));
        }
        if (req.method === 'GET' && req.url === '/repos/o/r/issues/7/comments?per_page=100&page=2') {
          return res.end(JSON.stringify([comment(record(), { url: 'rec-url' })]));
        }
        if (req.method === 'POST' && req.url === `/repos/o/r/statuses/${HEAD}`) {
          posted.push(JSON.parse(data));
          return res.writeHead(201).end('{}');
        }
        res.writeHead(404).end('{}');
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
      const env = {
        ...process.env,
        GITHUB_TOKEN: 't0ken',
        GITHUB_REPOSITORY: 'o/r',
        PR_NUMBER: '7',
        GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
      };
      await new Promise((resolve, reject) =>
        execFile(process.execPath, [script], { env }, (err, stdout, stderr) => (err ? reject(new Error(stderr)) : resolve(stdout))),
      );
      assert.deepEqual(posted, [{
        state: 'success',
        context: 'review-record',
        description: '已審查 aaaaaaa（審查者 review-1）',
        target_url: 'rec-url',
      }]);

      const bad = { ...env, PR_NUMBER: '7; echo x' };
      const code = await new Promise((resolve) =>
        execFile(process.execPath, [script], { env: bad }, (err) => resolve(err ? err.code : 0)),
      );
      assert.equal(code, 2);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
