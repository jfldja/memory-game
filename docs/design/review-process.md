# 審查紀錄格式、審查清單與審查檢查判定規則

| 項目 | 內容 |
|---|---|
| 版本 | 0.2（依設計審查 design-review.md 修訂） |
| 日期 | 2026-11-04 |
| 依據 | 需求 EQ-5、EQ-11、AC-EQ-5、AC-EQ-11；docs/workflow.md W-1、第 4.4 節；agent-dev-workflow 第 3 節、第 3.2 節 |
| 使用者 | 審查 agent（撰寫紀錄）、`scripts/review-gate.mjs`（判定）、產品負責人（AC-EQ-5 抽查） |

---

## 1. 審查前的準備（審查 agent）

1. 以全新工作階段啟動，載入 agent-dev-workflow，完成上工檢查。
2. 只讀：PR 的差異與說明、docs/requirements.md、docs/design/（本文件、spec.md、module-test-standards.md、acceptance-test-plan.md）、docs/workflow.md。**不讀**作者 agent 的對話或推理過程（agent-dev-workflow 3.2）。
3. 確認自己的工作階段識別不在 PR 說明「作者」段落中。若相同，停止並回報統籌 agent（不得審查自己的變更）。
4. 記下 PR 目前的 head SHA（`gh pr view <n> --json headRefOid`）。審查期間若有新 commit，重新審查。

## 2. 審查紀錄格式

審查 agent 以 PR 對話區的**一般評論**留下（不是行內評論、也不是 GitHub 的 review 功能；後者在單一帳號下無法核准自己的 PR）。格式如下，第一行標記與「結果」「針對 commit」兩行由 `review-gate.mjs` 解析，必須逐字照寫：

```markdown
<!-- review-record v1 -->
## 審查紀錄

- 結果：APPROVED
- 針對 commit：3f9c2ab1e0d4c5b6a7980f1e2d3c4b5a69788776
- 審查者：審查 agent，工作階段 review-2026-11-05-pr2-a
- 作者：實作 agent，工作階段 impl-2026-11-05-pr2；測試 agent，工作階段 test-2026-11-05-pr2（照抄 PR 說明「## 作者」段落的全部工作階段）
- 獨立性：審查者與作者為同一模型（Claude）的不同工作階段（docs/workflow.md W-1）。審查者以全新上下文啟動，未讀作者的推理過程
- 審查依據：需求文件 v1.0；軟體規格書 v<版本>；審查清單 v0.2
- 已載入 skill：agent-dev-workflow <版本>；software-design-phase <版本>；requirements-spec 無版本號（DQ-6 關閉前）

### 逐項結果

| 編號 | 項目 | 結果 | 說明 |
|---|---|---|---|
| R-1 | PR 說明含上工檢查與正確的 skill 版本號 | 通過 | |
| R-2 | … | 不適用 | 本 PR 沒有驗收測試 |
| … | | | |

### 發現的問題

（無；或逐條列出：位置、問題、對應編號、嚴重度、建議）
```

規則：

- 「結果」只能是 `APPROVED` 或 `CHANGES_REQUESTED`。任一項為「不通過」時只能是 `CHANGES_REQUESTED`。
- 「針對 commit」必須是完整 40 碼 SHA。
- 每一項審查清單都要有結果（通過／不通過／不適用），「不適用」須寫理由。
- 工作階段識別由統籌 agent 在派工時指定，格式建議 `<角色>-<日期>-<PR 或工作>-<序號>`；只要同一 PR 內可區分即可。
- 紀錄留下後不要編輯；需要更正時留一則新的紀錄（判定以最後一則為準）。

## 3. 審查清單（v0.2）

第一項固定為 workflow.md 第 4.4 節的檢查。

| 編號 | 項目 | 檢查方式 |
|---|---|---|
| R-1 | PR 說明含「上工檢查」全部勾選，以及「已載入的 skill」表格，版本號等於版本庫中各 SKILL.md 變更紀錄的最新版本號 | 讀 PR 說明與 SKILL.md；`pr-body` 檢查已自動做，但審查者仍須人工確認版本號合理（例如設計 skill 有更新時是否反映） |
| R-2 | PR 說明的對應編號完整，每個變更都能對應到需求或設計編號 | 比對差異與「對應編號」段落 |
| R-3 | 角色分工：實作 agent 沒有修改 `tests/acceptance/`、`tests/support/`；測試 agent 沒有修改 `src/`；驗收測試的修改附需求編號與理由（agent-dev-workflow 5.2） | `git diff --stat` 依目錄檢查作者 |
| R-4 | 沒有實作需求文件或規格書沒寫的行為；遇到空白時已回報而非自行決定 | 對照 spec.md 第 5 節轉移表與第 16 節待決問題 |
| R-5 | 狀態機變更與 spec.md 第 5 節一致：轉移、守衛、計時器在暫停與終止時的行為；新增的狀態或操作已依 requirements-spec 3.8 檢查 | 讀 `core/game.js` 差異與單元測試 |
| R-6 | 驗收測試：名稱含正確編號；時間相關測試以控制時鐘並在 `pauseAt` 後推進，檢查點落在容差邊界；NFR-6 不控制時鐘；沒有放寬驗收標準 | 對照需求第 10 節與 acceptance-test-plan.md |
| R-7 | 單元測試涵蓋 module-test-standards.md 對該模組列出的行為與邊界 | 對照模組測試標準 |
| R-8 | 層次相依：`core` 不引用 `ui`、`platform`、DOM、`Date`、`performance`、`Math.random`、`setTimeout`、`localStorage` | 搜尋 `src/js/core/` |
| R-9 | C-2、C-4、C-5、NFR-7：`src/` 沒有外部網址、第三方程式庫、網路字型、cookie；牌面 SVG 不帶牌面識別碼的屬性 | 以正規表示式 `https?://` 搜尋（`faces.js` 依 cards.md 第 2 節已移除 `xmlns`，不應有任何命中）；搜尋 `import` 的來源、`@font-face`、`document.cookie`、`aria-label` |
| R-10 | DOM 測試介面（spec.md 4.11）若有變更，規格書與測試已同步 | 比對 |
| R-11 | 主分支不會壞：CI 全部通過；未實作功能的驗收測試仍為略過而不是失敗 | 查看 PR 檢查結果 |
| R-12 | 文件與 skill：設計變更已更新規格書並升版；skill 的修改附變更紀錄；沒有修改 `.claude/skills/agent-dev-workflow/`、`.claude/skills/requirements-spec/`（W-3） | 檢查差異 |
| R-13 | 程式品質：命名清楚、沒有無用程式碼、錯誤處理符合 spec.md（例如 storage 不丟出例外） | 閱讀 |
| R-14 | CI 與檢查規則的變更：PR 若修改 `.github/workflows/*`、`scripts/check-acceptance-ids.mjs`、`scripts/check-pr-body.mjs`、`scripts/review-gate.mjs`、`playwright.config.mjs`、`package.json` 的測試指令、`docs/design/supplementary-acceptance.json` 或 `docs/requirements.md`：PR 說明列出理由與對應編號；審查者確認沒有降低任何檢查（例如移除必要 job、縮小掃描範圍、增加略過判定的例外、把 `enforced` 改為 false、在 `run:` 插值事件內容）；`docs/requirements.md` 的變更附產品負責人核准的版本。這些檔案在 `pull_request` 事件下以 PR 自己的版本執行，PR 可藉此放寬自己的檢查，只能靠審查攔下 | 逐檔閱讀差異 |

## 4. 審查檢查的判定規則（`scripts/review-gate.mjs`）

輸入：版本庫、PR 編號（`pull_request_target` 取自事件；`issue_comment` 取自 `github.event.issue.number`，且只處理 `github.event.issue.pull_request` 存在的事件）。

步驟：

1. 以 API 重新讀取 PR：最新 head SHA、PR 說明、狀態。PR 已關閉時結束，不寫狀態。
2. 從 PR 說明「## 作者」段落取出所有工作階段識別：段落內每一行符合 `工作階段：<識別>`（全形冒號，去除前後空白與 HTML 註解）者都採計；一個 PR 可有多位作者（例如「- 角色：實作 agent」「- 工作階段：…」兩行一組重複）。
3. 讀取 PR 的全部一般評論，篩選：
   - 第一行為 `<!-- review-record v1 -->`；
   - `author_association` 為 `OWNER`、`MEMBER` 或 `COLLABORATOR`（公開版本庫任何人都能評論）；
   - 「針對 commit」等於最新 head SHA。
4. 取符合條件的**最後一則**（依建立時間）。沒有時：狀態 `failure`，說明「沒有針對 <短碼> 的審查紀錄」。
5. 檢查該則：
   - 「審查者」的工作階段識別存在，且不等於第 2 步任何作者的工作階段；否則 `failure`「審查者與作者相同或未標明」。
   - 含「同一模型」與「不同工作階段」字樣；否則 `failure`「未註明 W-1」。
   - 逐項結果表至少含 R-1～R-14 每一列，且沒有空白結果；否則 `failure`「審查清單不完整」。
   - 「結果」為 `APPROVED` 且表中沒有「不通過」；否則 `failure`「審查要求修改」。
6. 全部通過：`success`，說明「已審查 <短碼>（審查者 <工作階段>）」。
7. 以 `POST /repos/{owner}/{repo}/statuses/{head_sha}` 寫入，`context` 為 `review-record`，`target_url` 指向該則評論（或 PR）。

工作流程設定：

- 權限：`statuses: write`、`pull-requests: read`、`issues: read`、`contents: read`。
- 只簽出預設分支（`actions/checkout` 在 `pull_request_target`／`issue_comment` 下預設即簽出預設分支），**不簽出、不執行 PR 的程式碼**；不執行 `npm install`、不使用 `actions/cache`；腳本只用 Node.js 內建模組。
- **不得把事件內容插值到 `run:`**（評論內容、PR 標題與說明、`head.ref` 等皆為使用者可控字串，插值會造成指令注入）。PR 編號以 `env: PR_NUMBER: ${{ github.event.pull_request.number || github.event.issue.number }}` 傳入，其餘一律由腳本經 API 讀取。
- 並行群組：`group: review-gate-${{ github.event.pull_request.number || github.event.issue.number }}`、`cancel-in-progress: false`。同一 PR 的執行依序進行，每次都重新讀取最新 head SHA 與全部評論，所以最後完成的執行依最新狀態寫入（commit status 對同一 context 以最後寫入為準）。

`review-gate.mjs` 的判定邏輯寫成純函式 `evaluate({ headSha, prBody, comments }) → { state, description, targetUrl }`，由實作 agent 撰寫單元測試；API 呼叫只在外層薄包裝中。

## 5. 已知限制

- CI 只能確認紀錄存在且格式正確，無法確認審查真的做過（需求第 9 節已接受）。產品負責人在 UAT 前抽看（AC-EQ-5）。
- 工作階段識別由 agent 自行填寫，CI 無法驗證真偽。
- 有寫入權限者可以直接以 API 寫入 `review-record` 狀態；分支保護指定來源為 GitHub Actions 可擋下以個人權杖寫入的狀態。
- 第一個 PR（加入本機制的 PR）不受本檢查把關，由產品負責人人工確認；`review-record` 在 PR-2 寫入過一次後才能加為必要檢查（spec.md 12.6 步驟 4、6b；DQ-8）。

## 6. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | 新增 R-14（CI 與檢查規則變更）；R-9 改用正規表示式並檢查 `aria-label`；多位作者的解析規則；工作流程注入防護與並行群組；判定清單改為 R-1～R-14；啟動例外改指向 DQ-8 | design-review.md M-6、M-7、M-8、M-11、P-5 |
