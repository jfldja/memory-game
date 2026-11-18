# 查證紀錄：Q4、Q6

| 項目 | 內容 |
|---|---|
| 版本 | 0.7（新增 2.8：CI 外部相依的逾時與穩定性，DQ-15 的依據；含選項 (g) 的 macOS 執行器查證與 PR #6 實測、D-macOS 的重現；v0.7 待簽核）；0.6.1（2.7 補 node:test 子測試的實測）；0.6（新增 2.7：PR-1b 合併後的平台狀態與 GFM 渲染實測，DQ-14 的依據）；0.5（`review-record` 的必要檢查改在 PR-1b 設定；PR-1 合併後的平台狀態紀錄） |
| 日期 | 2026-11-18（查證日期 2026-11-04；第 2.6 節為 2026-11-09、第 2.7 節為 2026-11-10 以 API 讀取與本機實測；第 2.8 節為 2026-11-18 讀取官方文件原始檔與 API） |
| 撰寫 | 設計 agent |
| 依據 | docs/requirements.md v1.1（Q4、Q6 與查證相關內容與 v1.0 相同）第 12 節 Q4、Q6；第 8.2 節 A-1、A-2；第 8.4 節 |
| 查證方式 | 2026-11-04 以 WebSearch／WebFetch 讀取 docs.github.com 官方頁面；工具授權讀取本機安裝檔的 LICENSE。部分官方頁面因本工作階段的網路允許清單無法擷取，於該列標明「未查證」 |

標示說明：**已查證**＝本次讀到官方原文；**實測**＝本次在本機實際執行確認；**未查證**＝未讀到原文，結論為推定，須在實作第一批變更時實測確認。

---

## 1. Q4：免費開發與測試工具

### 1.1 結論

**建議關閉 Q4：允許。** 下列工具全部免費、只在開發環境與 CI 執行，網站發布的檔案中不包含任何一個（見 1.3 的散布檢查）。A-1 成立，EQ-3、EQ-4、NFR-1、NFR-3、NFR-5～NFR-7 的量測方法不需改寫。

### 1.2 工具與授權

| 工具 | 用途 | 版本（建議） | 授權 | 查證 | 是否隨網站散布 |
|---|---|---|---|---|---|
| Node.js | 執行單元測試（內建 `node --test`）、建置腳本、本機靜態伺服器、CI 檢查腳本 | 22.x LTS（本機實測 v22.23.4） | MIT 型授權（本機 `/opt/node22/LICENSE` 開頭為 “Node.js is licensed for use as follows … Permission is hereby granted, free of charge …”） | 實測（讀本機授權檔） | 否 |
| npm | 安裝開發相依套件 | 隨 Node.js | Artistic License 2.0 | 未查證（依一般認知） | 否 |
| Playwright（`@playwright/test`、`playwright-core`） | 端對端測試、三引擎、時鐘控制 | 1.x（本機實測 1.63.0） | Apache-2.0（本機 `playwright-core/LICENSE` 與 `package.json` 的 `"license": "Apache-2.0"`） | 實測（讀本機授權檔） | 否 |
| Playwright 下載的瀏覽器：Chromium、Firefox、WebKit | 端對端測試執行環境 | 隨 Playwright 版本 | 各自的開放原始碼授權（Chromium：BSD 型；Firefox：MPL-2.0；WebKit：LGPL／BSD）；Playwright 隨附 `ThirdPartyNotices.txt` | 未查證（未讀到各瀏覽器授權原文） | 否，只在 CI 與開發機下載執行 |
| GitHub Actions 官方 action：`actions/checkout`、`actions/setup-node`、`actions/configure-pages`、`actions/upload-pages-artifact`、`actions/deploy-pages` | CI 與部署 | 見規格書第 12 節 | MIT | 未查證（未讀到各版本庫授權原文）；這些 action 在 GitHub 的執行器上執行，不進入網站檔案 | 否 |

本專案**不使用**任何其他 npm 套件。執行時程式碼為原生 HTML、CSS、JavaScript（C-2），單元測試用 Node.js 內建測試執行器，不需測試框架套件。

### 1.3 不隨網站散布的保證方式

- 發布的檔案只來自 `src/`，由建置腳本複製到 `dist/`（規格書第 11 節）。`node_modules/`、`tests/`、`scripts/` 不會被複製。
- NFR-7 的端對端測試記錄全部網路請求，可同時證明執行時沒有載入第三方資源。
- 審查清單第 R-9 項檢查 `src/` 中沒有 `import` 外部網址或 `node_modules` 路徑。

### 1.4 對需求的影響

無。A-1 由「假設」變為「已確認」，建議統籌 agent 在需求文件下次修訂時把 Q4 移入已關閉（本 agent 不修改需求文件）。

---

## 2. Q6：GitHub Actions、Pages、分支保護與 EQ-11

### 2.1 Actions 與 Pages 是否免費（A-2、C-1、C-3）

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| 公開版本庫的 Actions 是否免費 | 是：標準 GitHub 託管執行器在公開版本庫免費，不扣免費額度 | “GitHub Actions usage is free for standard GitHub-hosted runners in public repositories, and for self-hosted runners.” | https://docs.github.com/en/actions/reference/usage-limits-billing-and-administration ；https://docs.github.com/en/billing/concepts/product-billing/github-actions | 已查證 |
| 會付費的情況 | 「大型執行器」（larger runners）在公開版本庫也收費。本專案只用標準執行器 `ubuntu-latest` | “Larger runners are billed for public repositories.” | https://docs.github.com/en/billing/concepts/product-billing/github-actions | 已查證 |
| 單一 job 時間上限 | 6 小時 | “Each job in a workflow can run for up to 6 hours of execution time.” | https://docs.github.com/actions/reference/limits | 已查證 |
| 同時執行的 job 數（Free 方案） | 20 個（macOS 最多 5 個）。本專案每個 PR 約 6 個 job，不會碰到 | — | 同上 | 已查證 |
| `GITHUB_TOKEN` 的 API 速率限制 | 每版本庫每小時 1,000 次。審查檢查每次執行約 3～5 次 API 呼叫，不會碰到 | “The rate limit for GITHUB_TOKEN is 1,000 requests per hour per repository.” | 同上 | 已查證 |
| 公開版本庫的 Pages 是否免費 | 是：GitHub Free 的公開版本庫可用 Pages；私有版本庫需付費方案 | 「Pages is available in public repositories with GitHub Free…」（WebFetch 摘要） | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits | 已查證 |
| Pages 用量限制 | 發布網站最大 1 GB；頻寬軟性上限每月 100 GB；建置軟性上限每小時 10 次，但**以自訂 Actions 工作流程建置與發布時不適用**；部署超過 10 分鐘會逾時 | 同左 | 同上 | 已查證 |
| Pages 禁止用途 | 不得作為商業交易或商業 SaaS 的主機；不得處理密碼、信用卡等敏感交易。本專案不涉及 | — | 同上 | 已查證 |

**結論：A-2 成立。** 本專案（靜態網站約數百 KB、公開版本庫、標準執行器）不會碰到收費或用量限制。

### 2.2 分支保護能否套用於管理員（EQ-2）

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| 公開版本庫可否使用分支保護 | 可以 | “Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations.” | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches | 已查證 |
| 管理員預設是否受限 | **預設不受限**；必須勾選「Do not allow bypassing the above settings」才會套用於管理員 | “By default, the restrictions of a branch protection rule don't apply to people with admin permissions to the repository” ；“You can enable this setting to apply the restrictions to admins.” | 同上 | 已查證 |
| 公開版本庫可否使用 rulesets | 可以 | “Rulesets are available in public repositories with GitHub Free and GitHub Free for organizations” | https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets | 已查證 |
| rulesets 是否預設約束管理員 | 文件說明可把「Repository admins」加入繞過清單（bypass list），但本次讀到的頁面**沒有明文**寫「不在清單上的管理員即受約束」 | “When you create a ruleset, you can allow certain users to bypass the rules in the ruleset.” | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository | 未查證（預設行為） |
| 必要檢查可以是 commit status 或 check run | 可以；可指定預期來源 app，指定後其他來源設定的狀態不會讓合併通過 | “Required status checks can be checks or statuses.” ；“If the status is set by any other person or integration, merging won't be allowed.” | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets | 已查證 |
| 誰能設定 commit status | 任何對版本庫有寫入權限的人或整合 | “Any person or integration with write permissions to a repository can set the state of any status check.” | 同上 | 已查證 |

**結論：EQ-2 可達成。** 設計採用**傳統分支保護規則**並勾選「Do not allow bypassing the above settings」，因為這是官方明文保證套用於管理員的設定（rulesets 的對應行為本次未查證）。設定步驟見規格書第 12.6 節，必須由產品負責人在網頁手動設定。AC-EQ-2 由產品負責人人工驗收。

**EQ-2 的兩個啟動例外（產品負責人已依 spec.md DQ-8 明確接受，2026-11-09；處理方式見 spec.md 12.6「EQ-2 啟動例外的處理」）：** (1) 初始 commit 已直接推送到 main（開 PR 必須有基底分支）；(2) PR-1 在分支保護與審查檢查生效前合併。

### 2.3 PR 評論能否觸發附在 commit 上的檢查（EQ-11）

**已查證的事實：**

| 事實 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|
| `pull_request` 預設只在 `opened`、`synchronize`、`reopened` 觸發；**評論不是這三種之一**，所以 PR 上原本的 CI 檢查不會因評論重跑 | “By default, a workflow only runs when a pull_request event's activity type is opened, synchronize, or reopened.” | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows | 已查證 |
| `issue_comment` 會在 issue 與 PR 的評論觸發，但執行環境是**預設分支**：`GITHUB_SHA` 為「預設分支的最後一個 commit」。因此此工作流程的 job 結果**不會**掛在 PR 的 commit 上 | `GITHUB_SHA`: “Last commit on default branch”；`GITHUB_REF`: “Default branch” | 同上 | 已查證 |
| `issue_comment` 只有在工作流程檔**已存在於預設分支**時才觸發 | “This event will only trigger a workflow run if the workflow file exists on the default branch.” | 同上 | 已查證 |
| 區分 PR 評論與 issue 評論：用 `github.event.issue.pull_request` | — | 同上 | 已查證 |
| `pull_request_review` 的 `GITHUB_SHA` 是 PR 的合併 commit；來自 fork 的 PR，`GITHUB_TOKEN` 為唯讀 | “The GITHUB_TOKEN has read-only permissions in pull requests from forked repositories.” | 同上 | 已查證 |
| `pull_request_target` 在基底版本庫預設分支的情境中執行（可取得寫入權限），官方警告不要在此事件中執行 PR 的程式碼 | “This event runs in the context of the default branch of the base repository.” ；“Running untrusted code on the pull_request_target trigger may lead to security vulnerabilities.” | 同上 | 已查證 |
| 以 `GITHUB_TOKEN` 觸發的事件不會建立新的工作流程執行（`workflow_dispatch`、`repository_dispatch` 例外） | “events triggered by the GITHUB_TOKEN will not create a new workflow run” | https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow | 已查證 |
| commit status 綁在指定的 commit SHA；`state` 為 `error`、`failure`、`pending`、`success`；以 `context` 區分；每個 SHA＋context 最多 1,000 筆；有推送權限者可建立 | “Users with push access in a repository can create commit statuses for a given SHA.” ；“a limit of 1000 statuses per sha and context within a repository” | https://docs.github.com/en/rest/commits/statuses | 已查證 |
| check run 只能由 GitHub App 建立（一般使用者與 OAuth app 不能） | “Write permission for the REST API to interact with checks is only available to GitHub Apps.” | https://docs.github.com/en/rest/checks/runs | 已查證 |
| `GITHUB_TOKEN` 的 `statuses: write` 權限鍵名稱與效果 | — | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax （本次無法擷取） | **未查證**：第一批變更以實際 PR 驗證 |

**可行做法（採用）：** 獨立的審查檢查工作流程，以 **commit status** 回寫 PR 最新 commit。

1. 觸發：`pull_request_target`（`opened`、`synchronize`、`reopened`、`edited`）與 `issue_comment`（`created`、`edited`、`deleted`，且 `github.event.issue.pull_request` 存在）。
2. 不簽出、不執行 PR 的程式碼；只執行預設分支上的判定腳本（避開 `pull_request_target` 的安全風險，也讓 fork PR 有寫入狀態的權限）。
3. 每次執行都以 API **重新讀取** PR 的最新 head SHA 與全部評論，不信任事件內容中的 SHA（避免評論與推送競速時寫錯 commit）。
4. 依規格書第 13 節的規則判定，對最新 head SHA 寫入 context 為 `review-record` 的 commit status：`success` 或 `failure`，description 寫明原因。
5. 分支保護把 `review-record` 列為必要檢查，並指定預期來源為 GitHub Actions。

**各情境的結果：**

| 情境 | 結果 | 對應 AC-EQ-11 |
|---|---|---|
| PR 開啟，尚無審查紀錄 | `pull_request_target` 觸發 → 寫入 `failure`（無審查紀錄） | 第 1 步：檢查失敗，無法合併 |
| 審查 agent 留下針對最新 commit、結果為 APPROVED 的紀錄 | `issue_comment` 觸發 → 重新讀取 → 寫入 `success` | 第 2 步：通過 |
| 之後推送新 commit | 新 commit 本來就沒有任何 `review-record` 狀態（狀態綁 SHA，舊的成功狀態不會帶到新 commit），必要檢查呈「等待中」而無法合併；同時 `synchronize` 觸發 → 對新 SHA 寫入 `failure` | 第 3 步：再次失敗，直到重新審查 |
| 審查紀錄被編輯或刪除 | `issue_comment` 的 `edited`／`deleted` 觸發 → 重新判定 | — |
| 非協作者在公開版本庫留下假的審查紀錄 | 判定腳本只採計 `author_association` 為 `OWNER`、`MEMBER`、`COLLABORATOR` 的評論 | 防止偽造 |
| fork 的 PR | `pull_request_target` 與 `issue_comment` 都在基底版本庫執行，有寫入狀態的權限；因不執行 PR 程式碼，沒有權限外洩風險。本專案只有一個帳號，預期不會有 fork PR | — |

**對 AC-EQ-11 的影響：**

1. **AC-EQ-11 可以達成**，不需修改需求。
2. **啟動順序限制（重要）：** `issue_comment` 與 `pull_request_target` 只執行預設分支上的工作流程檔，所以審查檢查在「加入它的 PR 合併之後」才生效。第一個 PR 無法由它把關：產品負責人須人工確認第一個 PR 有審查紀錄後合併，再啟用分支保護。又因必要檢查名稱須執行過才選得到（推定），`review-record` 要等 PR-1 之後的第一個 PR（v0.5：**PR-1b**，原為 PR-2）寫入過一次狀態後、合併前才加入必要檢查（spec.md 12.6 步驟 6a、6b）。AC-EQ-11 的人工驗收在 PR-1b 執行（步驟 8）。以上例外經產品負責人依 spec.md DQ-8 接受（2026-11-09）。
3. **殘餘風險（需求文件第 9 節已接受）：** 任何有寫入權限者（含 agent）都能直接呼叫 API 寫一個 `success` 狀態。把必要檢查的預期來源指定為 GitHub Actions，可擋下以個人權杖寫入的狀態；但仍無法證明審查真的做過。

### 2.4 GitHub Pages 以 Actions 部署與延遲（EQ-12）

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| 以自訂工作流程部署的方式 | 用 `actions/configure-pages`、`actions/upload-pages-artifact`、`actions/deploy-pages`；部署 job 至少需要 `pages: write` 與 `id-token: write`；預設部署環境 `github-pages` | “The job must have a minimum of pages: write and id-token: write permissions.” ；“The default environment is github-pages.” | https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages | 已查證 |
| 需要在網頁設定的事項 | 必須先在版本庫啟用自訂工作流程（Settings → Pages 的發布來源）；官方建議為 `github-pages` 環境加上「只允許預設分支部署」的保護規則；由 PR 觸發時會略過部署步驟 | “To start using custom workflows you must first enable them for your current repository” ；“We recommend that you add a deployment protection rule so that only the default branch can deploy to this environment.” | 同上；https://github.com/github/docs/blob/main/content/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site.md | 已查證 |
| 部署延遲 | 官方說「最多可能需要 10 分鐘」才會發布；部署本身超過 10 分鐘會逾時 | “Note that it can take up to 10 minutes for changes to your site to publish after you push the changes to GitHub.” | https://docs.github.com/en/pages/quickstart | 已查證 |

**對 EQ-12 的影響：** 官方的上限（最多 10 分鐘）與需求的期限（10 分鐘內）相同，**沒有餘裕**。設計的對策：

1. 部署工作流程在推送主分支時立即執行，不等待端對端測試（PR 階段已全部通過，且分支保護要求分支為最新）。建置只複製檔案與注入版本號，預估 1 分鐘內完成。
2. 部署後的煙霧測試 job 每 15 秒讀取公開網址的版本號，直到等於本次 commit 短碼；自合併起 9 分鐘仍未出現則失敗，作為 EQ-12 的自動證據（AC-EQ-12 仍是人工驗收）。
3. 殘餘風險：GitHub 端延遲超過 10 分鐘時 AC-EQ-12 會失敗，屬外部因素。處理方式已由產品負責人依 spec.md DQ-9 接受（2026-11-09）：`smoke` 失敗時重跑一次並記錄兩次的時間；仍失敗或 AC-EQ-12 超過 10 分鐘時，記為外部因素造成的觀察，附 GitHub Status 當時狀態，由產品負責人判定是否視為通過，不修改程式（spec.md 12.5）。

### 2.5 其他會碰到的限制

| 限制 | 影響 | 對策 |
|---|---|---|
| 單一帳號無法核准自己的 PR（推定，本次未讀到官方原文） | 不能用「Require approvals」 | 依需求 Q5 的決定，以審查紀錄＋`review-record` 檢查取代；分支保護不勾選必要核准數 |
| 分支保護的必要檢查清單只能選「最近有執行過」的檢查名稱（推定，未查證） | 第一個 PR 合併前無法選到檢查；`review-record` 在 PR-1 期間不執行，PR-1 合併後仍選不到 | PR-1 合併後先設定其餘必要檢查（步驟 6a）；PR-1b（v0.5；原為 PR-2）寫入過 `review-record` 後、合併前再加入（步驟 6b）。若產品負責人偏好一次設定，可改用 REST API 直接指定 context 名稱（未查證，PR-1 時實測） |
| 勾選「Require branches to be up to date」後，每次更新分支都產生新 commit，必須重新審查 | 審查次數增加 | 本專案 PR 依序進行，影響小；接受 |

---

### 2.6 PR-1 合併後的平台狀態（v0.5，2026-11-09 以 API 讀取）

| 項目 | 讀取方式 | 結果 | 對設計的影響 |
|---|---|---|---|
| review-gate 是否在預設分支 | `git ls-tree main .github/workflows/`；`GET /repos/{owner}/{repo}/actions/workflows` | main（7707e9f）含 `review-gate.yml`，狀態 active | PR-1b 開啟時會以 main 上的版本執行（spec.md 12.6） |
| review-gate 是否執行過 | `GET /repos/{owner}/{repo}/actions/runs` | 沒有任何執行紀錄（只有 PR-1 的 ci、pr-body 與 main 的 ci、deploy） | PR-1b 是第一次實際執行；`statuses: write`（DA-1）仍未實測，無法寫入時見 DQ-11 |
| 分支保護（步驟 6a） | `GET /repos/{owner}/{repo}/branches/main/protection` | 必要檢查 6 個（`unit`、`acceptance-ids`、`e2e (chromium)`、`e2e (firefox)`、`e2e (webkit)`、`pr-body`），皆 app_id 15368；`strict: true`；`enforce_admins: true`；不允許強制推送、刪除；`required_approving_review_count: 0` | 6a 已生效；`review-record` 尚未是必要檢查。API 的 `checks` 欄位可指定 context 與 app_id，但能否指定**從未執行過**的 context 仍未查證（DQ-11 選項 (b)） |

實測紀錄（本機，Node.js 22.23.4、Playwright 1.63.0；spec.md 12.2.1 的依據）：node:test 自訂 reporter 的事件含 `file`、`skip`、`todo`，略過的 `describe` 內的測試不出現在結果中，內建 JUnit reporter 沒有檔名；Playwright json reporter 中 `test.fail()` 的測試為 `expectedStatus: failed`、`status: expected`，計入 `stats.expected`；本體內 `test.skip()`、條件略過、`testInfo.skip()`、`annotation: { type: 'skip' }`、別名呼叫皆為 `expectedStatus: skipped`；`test.describe.serial.skip` 不存在，載入時 TypeError。

第 3 輪審查後的實測（同一環境；spec.md 12.2.1 第 6 項的依據）：Playwright `json` reporter 的 `steps` 不含 `expect`；自訂 reporter 的 `onStepEnd` 收到 `category: 'expect'` 的步驟，計數為：空本體 0、第一個斷言前 `return` 0、`expect.soft` 1、`expect.poll` 2、`test.step` 內的 `expect` 1、被 `try/catch` 吞掉的失敗斷言 1 且帶 `error`（測試狀態仍為 `passed`）。node:test：在輔助模組最上層註冊的 `beforeEach`／`afterEach` 套用於匯入它的測試檔，`afterEach` 中 `t.diagnostic(…)` 的事件帶有該測試的 `file`、`line`、`column`，與 `test:pass` 相同，可據以對應；略過的測試不執行 hook；以包裝 `test` 的函式註冊測試時，事件的 `file`、`line` 變成包裝模組的位置，不可行。NFKC 不移除 U+200B（設計審查第 3 輪實測，本輪未重做）。

### 2.7 PR-1b 合併後的平台狀態與 GFM 渲染實測（v0.6，2026-11-10；DQ-14 的依據）

| 項目 | 讀取或實測方式 | 結果 | 對設計的影響 |
|---|---|---|---|
| PR-1b 合併 | `GET /repos/{owner}/{repo}/pulls/3` | `merged_at` 2026-11-10T13:34:43Z，merge commit fa05bbb，head e5212c7 | main 上的 review-gate 為 PR-1b 版 |
| review-gate 的執行紀錄 | `GET /repos/{owner}/{repo}/actions/workflows/review-gate.yml/runs` | 共 10 次（探測 PR A、PR-1b 的 `pull_request_target` 與 `issue_comment`），全部在 main 7707e9f 上執行，結論皆 success；最後一次 13:34:28Z，在合併之前。fa05bbb 上沒有任何執行 | PR-1b 版從未在平台執行；PR-1c 開啟時是第一次（spec.md 12.6「v0.6 的順序」第 4 點） |
| 分支保護 | `GET /repos/{owner}/{repo}/branches/main/protection` | 必要檢查 7 項（6a 的 6 項＋`review-record`），皆 app_id 15368；`strict: true`；`enforce_admins: true` | 6b 已生效；PR-1b 版無法寫入狀態時 PR-1c 無法合併（DQ-11 (a)） |
| 評論的渲染結果 | `GET /repos/{owner}/{repo}/issues/3/comments`，`Accept: application/vnd.github.full+json` | 回傳 `body_html`：標記行的 HTML 註解被移除；清單、段落、標題結構與 cmark-gfm 一致；表格外包 `<markdown-accessiblity-table>`（非標準元素）；儲存格中的 commit 短碼被轉為連結 | DQ-14 選項 (d) 可行，但格式不是 GitHub 公開承諾的介面 |
| GitHub 的 Markdown 渲染 API | `POST /markdown`（mode=gfm） | 本工作階段以 HTTP 403 拒絕（只允許版本庫範圍的端點） | 未能以 GitHub 本身渲染構造的案例；改以 cmark-gfm 實測 |
| GFM 規格原文 | https://github.github.com/gfm/ | 不在本工作階段的網路允許清單內，**未查證原文** | 表格與字元參照的行為以下一列的實測為準 |
| GFM 表格與字元參照的行為 | 本機以 GitHub 的 cmark-gfm（Python 綁定 `cmarkgfm` 2025.10.22；擴充 table、strikethrough、autolink、tagfilter、tasklist；`CMARK_OPT_UNSAFE` 保留原始 HTML）渲染 | **實測**：(1) 表格延續到空行或另一個區塊（標題、引用、清單、HTML、圍欄、分隔線）開始前；緊接在後的任何行都成為一列，不需要直線（`R-5 不通過`、`補充：…` 皆成為列）；只含 U+00A0 的行不是空行；以 U+3164 開頭的列，U+3164 成為第一格。(2) 分隔列只有 `-` 時是 Setext 標題；`:--`、`--:`、`:-:`、`\|-`、`-\|` 都能構成單欄表格。(3) 以 `&#124;` 或反斜線跳脫寫的直線、縮排 4 格的分隔列都不構成表格。(4) 引用與清單項目中的表格不延續到容器外的行。(5) `&#x7D50;`、`&#32080;`、`&nbsp;`、`&colon;`、`&ZeroWidthSpace;` 在一般文字中解碼。(6) 標籤可跨行（`<span` 換行 `class="x">`），渲染時兩行接成一段文字。(7) `<?x?>`、`<![CDATA[x]]>` 原樣輸出（GitHub sanitizer 之後的結果未實測，推定為不顯示） | review-process.md 4.1 的判定表與 DQ-14 各選項的規則 |
| node:test 的子測試與並行（v0.6.1） | Node.js 22.23.4，`node --test --test-reporter=tap` 執行一個含四種寫法的檔案 | **實測**：在測試本體內呼叫最上層 `test()`、`it()` 與 `t.test()` 都建立子測試（TAP 中為巢狀 `# Subtest`）；`describe(…, { concurrency: 2 })` 被接受並執行 | spec.md 12.2 第 9e 點 |
| Unicode 性質（JavaScript） | Node.js 22.23.4，`/\p{Default_Ignorable_Code_Point}/u` 等 | U+3164、U+FFA0、U+115F、U+1160、U+034F、U+FE00、U+FE0F、U+E0100、U+180B 屬於 Default_Ignorable_Code_Point 而不屬於 Cf；U+034F、U+FE00、U+FE0F、U+E0100、U+180B 屬於 M；U+2800 兩者皆否；NFKC 把 U+3164、U+FFA0 轉為 U+1160（仍為字母）、U+00A0 轉為空格 | DQ-14 (b) 的 X2～X4 |

### 2.8 CI 外部相依的逾時與穩定性（v0.7，2026-11-18；DQ-15 的依據）

**讀取方式：** 本工作階段無法連線 docs.github.com、playwright.dev、mcr.microsoft.com（連線失敗或不在網路允許清單內）。GitHub 文件改讀其官方原始檔版本庫 `github/docs` 的 `main`（docs.github.com 由此產生）；Playwright 文件改讀 `microsoft/playwright` 版本庫 **v1.63.0 標籤**的 `docs/src/`（playwright.dev 由此產生，版本與本專案的 `@playwright/test` 1.63.0 相同）。下表「來源」先列公開網址，再列實際讀取的原始檔。標示「已查證」者為讀到原文；「實測」為以 API 讀取本版本庫的執行紀錄與日誌；「未查證」為沒有讀到原文或無法量測，結論為推定。

**(1) GitHub Actions 的逾時、失敗與重跑**

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| job 預設逾時 | 未設定 `timeout-minutes` 時為 360 分鐘，到時由 GitHub 自動取消 | “The maximum number of minutes to let a job run before GitHub automatically cancels it. Default: 360” | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes ；原始檔 https://raw.githubusercontent.com/github/docs/main/content/actions/reference/workflows-and-actions/workflow-syntax.md | 已查證 |
| step 逾時 | 可對單一 step 設定，到時終止該 step 的程序；上限 360；必須是正整數 | “The maximum number of minutes to run the step before killing the process. Maximum: 360 for both GitHub-hosted and self-hosted runners.” “Fractional values are not supported. `timeout-minutes` must be a positive integer.” | 同上 `#jobsjob_idstepstimeout-minutes` | 已查證 |
| 不設逾時時的實際上限 | GitHub 託管執行器每個 job 最多 6 小時，到時終止並判為失敗 | “Each job in a workflow can run for up to 6 hours of execution time. If a job reaches this limit, the job is terminated and fails.” | https://docs.github.com/en/actions/reference/limits ；原始檔 https://raw.githubusercontent.com/github/docs/main/content/actions/reference/limits.md | 已查證 |
| `continue-on-error` | step 設為 true 時，該 step 失敗不使 job 失敗 | “Prevents a job from failing when a step fails. Set to `true` to allow a job to pass when this step fails.” | 同 workflow-syntax `#jobsjob_idstepscontinue-on-error` | 已查證 |
| 必要檢查需要的狀態 | 必要檢查必須為 successful、skipped 或 neutral 才能合併；因此逾時、取消、失敗都會擋下合併，進行中（pending）也會 | “Required status checks must have a `successful`, `skipped`, or `neutral` status before collaborators can make changes to a protected branch.” | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches ；原始檔同路徑 `.md` | 已查證 |
| check run 的結論值 | check run 完成時的結論包含 `timed_out`、`cancelled`、`failure` 等 | 結論清單含 “`timed_out`” | https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-checks ；原始檔 https://raw.githubusercontent.com/github/docs/main/content/rest/guides/using-the-rest-api-to-interact-with-checks.md | 已查證 |
| job 因 `timeout-minutes` 中止時，job 與必要檢查的結論是哪一個值 | 未讀到原文。不論是 `cancelled`、`timed_out` 或 `failure`，都不屬於上列三種可合併的狀態，所以都擋下合併（此點已查證）；確切的值與「重跑失敗的 job」是否包含它，在 DQ-15 決定後的 PR 實測 | — | — | **未查證** |
| 重跑 | 可在首次執行後 30 天內重跑整個執行、全部失敗的 job 或指定的 job；最多 50 次；重跑使用原事件的 `GITHUB_SHA`，所以不產生新 commit | “You can re-run a workflow run, all failed jobs in a workflow run, or specific jobs in a workflow run up to 30 days after its initial run.” “A workflow run can be re-run a maximum of 50 times.” “The workflow will also use the same `GITHUB_SHA` (commit SHA) and `GITHUB_REF` (git ref) of the original event” | https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs ；原始檔同路徑 `.md` | 已查證 |

**(2) 執行器的雲端與映像**

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| 標準 Linux 執行器跑在哪個雲端 | 標準 2、4 核 Linux 執行器使用多雲運算池，job 會被自動排到 AWS 或 Azure；GitHub Free 自動使用，沒有選擇雲端的設定 | “These jobs can run on either Amazon Web Services (AWS) or Microsoft Azure.” “Jobs are automatically scheduled across available cloud providers.” “Eligible runners on GitHub Free, GitHub Pro, and GitHub Team automatically use multi-cloud compute.” | https://docs.github.com/en/actions/concepts/runners/github-hosted-runners#cloud-hosts-used-by-github-hosted-runners ；原始檔 https://raw.githubusercontent.com/github/docs/main/content/actions/concepts/runners/github-hosted-runners.md | 已查證 |
| 可用的 Ubuntu 標籤 | `ubuntu-latest`、`ubuntu-24.04`、`ubuntu-22.04`、`ubuntu-26.04`（x64）；文件與 runner-images 首頁寫 `ubuntu-latest` 對應 Ubuntu 24.04 | runner-images 表格：“Ubuntu 24.04 … `ubuntu-latest` or `ubuntu-24.04`”、“Ubuntu 26.04 … `ubuntu-26.04`” | https://docs.github.com/en/actions/reference/runners/github-hosted-runners ；https://github.com/actions/runner-images （README） | 已查證 |
| `-latest` 標籤的移轉 | 移轉是漸進的，約 1～2 個月；期間使用 `-latest` 的工作流程可能看到作業系統版本改變；要避免時指定版本 | “The `-latest` migration process is gradual and happens over 1-2 months … any workflow using the `-latest` label, may see changes in the OS version … To avoid unwanted migration, users can specify a specific OS version in the yaml file” | https://github.com/actions/runner-images （README「Latest Migration Process」） | 已查證 |
| 本專案的 `ubuntu-latest` 實際是哪個映像 | 自 PR-1（2026-11-09）起，本版本庫所有讀到的 e2e 日誌都是 `Image: ubuntu-26.04`，與上列文件「ubuntu-latest＝24.04」不同，表示本版本庫已落在移轉的 26.04 一側 | 日誌開頭 “Image: ubuntu-26.04” | 執行 42588282323、42993416924、44249317277、44251453907 的 e2e job 日誌（`GET /repos/{owner}/{repo}/actions/jobs/{id}/logs`） | 實測 |
| 支援的映像數量 | 最多同時支援 2 個 GA 映像與 1 個 beta；新版 GA 後開始淘汰最舊的標籤。固定版本的標籤日後會被淘汰，需要再改 | “We support (at maximum) 2 GA images and 1 beta image at a time.” | 同上 | 已查證 |

**(3) 快取**

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| 容量與淘汰 | 每個版本庫預設 10 GB；超過 7 天未被存取的快取會被移除；超過 10 GB 的用量計費（C-1：不得超過） | “GitHub will remove any cache entries that have not been accessed in over 7 days. … By default, the limit is 10 GB per repository … Any usage beyond 10 GB is billed to your account.” | https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#usage-limits-and-eviction-policy ；原始檔同路徑 `.md` | 已查證 |
| PR 建立的快取能給誰用 | PR 執行建立的快取限定在該 PR 的合併 ref，只能由該 PR 的重跑使用；PR 可讀取預設分支與基底分支的快取。所以要讓 PR 用到快取，必須由 `push` 到 main 的執行建立 | “When a cache is created by a workflow run triggered on a pull request, the cache is created for the merge ref (`refs/pull/.../merge`). … It cannot be restored by the base branch or other pull requests targeting that base branch.” “Workflow runs can restore caches created in either the current branch or the default branch” | 同上 `#restrictions-for-accessing-a-cache` | 已查證 |
| Playwright 是否建議快取瀏覽器 | 不建議：還原快取的時間與下載相當；Linux 的作業系統相依套件（`--with-deps` 安裝的 apt 套件）**無法快取** | “Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable to the time it takes to download the binaries. Especially under Linux, operating system dependencies need to be installed, which are not cacheable.” | https://playwright.dev/docs/ci#caching-browsers ；原始檔 https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/docs/src/ci.md | 已查證 |
| 本專案目前的快取 | e2e job 已以 `actions/setup-node` 的 `cache: npm` 快取 npm 下載（ci.yml 第 71～74 行）；瀏覽器與 apt 套件沒有快取 | — | `.github/workflows/ci.yml`（main 79ce6b1） | 實測（讀檔） |
| 自行快取 apt 的 `.deb` 檔是否可行 | 技術上可把下載的套件檔放進 `actions/cache`，但需要 root 權限搬移、鍵值須含映像版本（映像每週更新）；未讀到 GitHub 或 Playwright 對此的官方做法，也未實測 | — | — | **未查證** |

**(4) 容器 job 與 Playwright 官方映像**

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| 容器 job 的語法 | `jobs.<job_id>.container`（`image`、`env`、`ports`、`volumes`、`options`、`credentials`）；設定後，該 job 中沒有自行指定容器的 step 都在此容器內執行；只指定映像時可省略 `image` 鍵 | “Use `jobs.<job_id>.container` to create a container to run any steps in a job that don't already specify a container.” | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idcontainer ；原始檔 https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/jobs/section-running-jobs-in-a-container.md | 已查證 |
| 容器 job 的限制 | GitHub 託管執行器必須是 Ubuntu；容器內 `run` 的預設 shell 是 `sh` 而不是 `bash`；`options` 不支援 `--network` 與 `--entrypoint` | “If you are using GitHub-hosted runners, you must use an Ubuntu runner.” “The default shell for `run` steps inside a container is `sh` instead of `bash`.” “The `--network` and `--entrypoint` options are not supported.” | 原始檔 `data/reusables/actions/docker-container-os-support.md`、`…/section-running-jobs-in-a-container.md`、`…/section-running-jobs-in-a-container-options.md`（同上目錄） | 已查證 |
| Playwright 的 GitHub Actions 容器範例 | `runs-on: ubuntu-latest`；`container: { image: mcr.microsoft.com/playwright:v<版本>-noble, options: --user 1001 }`；之後照常 `actions/checkout`、`actions/setup-node`、`npm ci`、`npx playwright test`，不需 `playwright install` | 範例 YAML（`image: mcr.microsoft.com/playwright:v%%VERSION%%-noble`、`options: --user 1001`） | https://playwright.dev/docs/ci#via-containers ；原始檔 https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/docs/src/ci.md | 已查證 |
| 映像標籤 | `:v<版本>`、`:v<版本>-noble`（Ubuntu 24.04）、`:v<版本>-jammy`（22.04）、`:v<版本>-resolute`（26.04）；建議固定版本；映像中的 Playwright 版本與專案不一致時找不到瀏覽器 | “It is recommended to always pin your Docker image to a specific version if possible. If the Playwright version in your Docker image does not match the version in your project/tests, Playwright will be unable to locate browser executables.” | https://playwright.dev/docs/docker#image-tags ；原始檔 https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/docs/src/docker.md ；發布腳本 https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/utils/docker/publish_docker.sh | 已查證（文件與發布腳本） |
| `v1.63.0-noble` 等標籤是否確實存在於 MCR | 以 v1.63.0 的發布腳本推定會發布；MCR 的標籤清單（`https://mcr.microsoft.com/v2/playwright/tags/list`）本工作階段無法連線 | — | — | **未查證** |
| 映像內容 | 以 `ubuntu:noble` 為基底；內含 Node.js 24、三種瀏覽器與其系統相依套件（`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`）、使用者 `pwuser`；不含 Playwright 套件本身（由專案 `npm ci` 安裝） | Dockerfile：“FROM … ubuntu:noble”、“ARG NODE_VERSION=24”、“ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright”、`playwright-core install-deps` 與三個瀏覽器的 `install`；docker.md：“The Playwright package/dependency is not included in the image” | https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/utils/docker/Dockerfile.noble ；docker.md 同上 | 已查證 |
| 建議的容器參數 | 建議 `--init`（避免 PID 1 的特殊處理造成殭屍程序）；使用 Chromium 時建議 `--ipc=host`（否則可能記憶體不足而當掉）；預設以 root 執行會停用 Chromium 沙箱 | “Using `--init` Docker flag is recommended …” “Using `--ipc=host` is recommended when using Chromium.” | docker.md 同上「Recommended Docker Configuration」 | 已查證 |
| 映像大小與在執行器上的拉取時間 | 未讀到官方數字；MCR 無法連線；本版本庫沒有容器 job 的執行紀錄 | — | — | **未查證**（須在探測或 PR 中量測） |
| 執行器的使用者 uid 是否為 1001（`--user 1001` 與工作目錄權限） | 範例使用 `--user 1001`，未讀到「託管執行器的 runner 使用者 uid 為 1001」的原文 | — | — | **未查證** |

**(5) 本版本庫的執行紀錄（2026-11-18 以 API 讀取 job 與日誌；實測）**

| 執行（run id） | job | 雲端／區域（日誌） | 映像版本 | apt 鏡像 | `--with-deps` 的套件 | 下載 | install step 時間 |
|---|---|---|---|---|---|---|---|
| 42588282323（2026-11-09，PR-1 合併後 push） | e2e (webkit) | Azure | ubuntu-26.04 | azure.archive.ubuntu.com | 185 個新安裝，139 MB | 10 s（14.5 MB/s） | — |
| 42993416924（2026-11-11，PR-1c 合併後 push） | e2e (webkit) | Azure | ubuntu-26.04 20261101.186.1 | azure.archive.ubuntu.com | 185 個，139 MB | 18 s（7.7 MB/s） | 49 s |
| 同上 | e2e (firefox) | Azure | 同上 | 同上 | 39 個，54.4 MB | 2 s | 18 s |
| 44249317277（2026-11-18 06:10Z，探測 PR B 前一個 head） | e2e (webkit) | Azure | ubuntu-26.04 20261111.196.1 | azure.archive.ubuntu.com | 185 個，139 MB | 55 s（2.5 MB/s） | 79 s |
| 44251453907 第 1 次（2026-11-18 06:27Z，head 9cd3381） | e2e (webkit) | **AWS us-west-2** | ubuntu-26.04 **20261111.82.6** | **us-east-2.ec2.archive.ubuntu.com** | 185 個（另升級 1 個），139 MB | 06:27:58 開始，至 06:38:23 只取得第 56 個套件；libavcodec62（10.2 MB）06:35:38→06:38:12 約 2.5 分鐘（約 66 KB/s） | 由統籌 agent 於 06:38:37 取消（job 結論 `cancelled`） |
| 同上 | e2e (chromium)、e2e (firefox) | Azure | 20261111.196.1 | azure.archive.ubuntu.com | chromium 9 個 21.9 MB；firefox 39 個 54.4 MB | 1 s；2 s | 18 s；13 s |
| 44251453907 第 2 次（06:38:52Z 起） | e2e (webkit) | 進行中，日誌未能讀取 | — | — | — | install step 06:39:09 開始，06:48 仍未完成 | 進行中 |
| 44258209548（2026-11-18 07:21Z，PR #6 探測 (g) 第 1 次，head e522f9e） | e2e (firefox) | **AWS us-west-2** | ubuntu-26.04 | （EC2 鏡像，同上） | 39 個，54.4 MB | **13 min 4 s（69.4 kB/s）** | — |
| 同上 | e2e (webkit) | **MacCloud**（westus） | macos-15-arm64 | 不使用 apt | `npx playwright install webkit`（不加 `--with-deps`） | — | 約 10 s（統籌 agent 紀錄） |
| PR #6 第 3～5 次（head 81376c4，run 44260684825 的 3 個 attempt） | e2e (webkit) | macOS | macos-15-arm64 20261104.0514.1 | — | 同上 | — | 約 11 s；job 33～39 s；排隊 2～3 s（統籌 agent 紀錄，PR #6 comment 6972345639） |

**由紀錄得到的推定（未證明）：** v0.7 補充：PR #6 第 1 次的 Firefox 同樣在 AWS（設計 agent 以日誌確認：`Cloud: AWS`、`Region: us-west-2`、“Fetched 54.4 MB in 13min 4s (69.4 kB/s)”），所以慢的鏡像影響所有留在 Ubuntu 的 job，不只 WebKit。以下為初次記錄時的推定：卡住的那一次是唯一一筆在 AWS 主機、使用 EC2 區域鏡像的紀錄；其餘 Azure 主機使用 Azure 鏡像，速度 2.5～14.5 MB/s。慢的來源推定為「多雲運算池排到 AWS 時的 Ubuntu 鏡像」，樣本只有一筆，第 2 次重跑的雲端未確認。WebKit 需要的套件（185 個、139 MB，含 ffmpeg 系列的影音函式庫）約為 Firefox 的 2.6 倍、Chromium 的 6 倍，同一個慢鏡像下最先超時。統籌 agent 轉述「2026-11-11 同一步驟 8 秒（17.7 MB/s）」與上表 42993416924 的 18 s（7.7 MB/s）不同，可能指不同的執行；不影響結論。

**(6) macOS 執行器（選項 (g)；v0.7 新增）**

| 問題 | 結論 | 官方原文（節錄） | 來源 | 查證 |
|---|---|---|---|---|
| 公開版本庫的標準執行器（含 macOS）是否免費 | 是 | “The use of standard GitHub-hosted runners is free: * In public repositories …” | https://docs.github.com/en/billing/concepts/product-billing/github-actions ；原始檔 https://raw.githubusercontent.com/github/docs/main/content/billing/concepts/product-billing/github-actions.md | 已查證（統籌 agent 查證，設計 agent 重讀原始檔確認） |
| 公開版本庫的 macOS 標準執行器標籤與規格 | arm64（M1）3 核、7 GB 記憶體、14 GB SSD；標籤 `macos-latest`（目前對應 macOS 26 arm64）、`macos-15`、`macos-26`；另有 Intel 的 `macos-15-intel`、`macos-26-intel`。統籌 agent 轉述含 `macos-14`；設計 agent 讀到的現行表格**沒有** `macos-14`，runner-images README 記載 macOS 14 映像已於 2026-11-02 退役。本設計使用 `macos-15`，不受影響 | 表格列：“3 (M1) \| 7 GB \| 14 GB \| arm64 \| macos-latest, macos-15, macos-26 …”；README：“All macOS 14 images retired from GitHub Actions on November 2, 2026.” | https://docs.github.com/en/actions/reference/runners/github-hosted-runners ；原始檔 https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/supported-github-runners.md ；https://github.com/actions/runner-images | 已查證 |
| macOS 執行器在哪裡執行 | 在 GitHub 自己的 macOS 雲端，不在 Linux 的 AWS／Azure 多雲排程內；PR #6 的日誌為 `Cloud: MacCloud` | “macOS runners are hosted in GitHub's own macOS cloud.” | 原始檔 https://raw.githubusercontent.com/github/docs/main/content/actions/reference/runners/github-hosted-runners.md ；PR #6 run 44258209548 的日誌 | 已查證；實測 |
| macOS 並行上限與排隊 | Free 方案標準執行器同時最多 20 個 job，其中 macOS 最多 5 個；需求高峰時 macOS job 可能較久才開始 | 表格列：“Standard GitHub-hosted runner \| Free \| 20 \| 5”；“During periods of high demand, jobs that run on macOS runners may take longer to start.” | https://docs.github.com/en/actions/reference/limits ；原始檔 https://raw.githubusercontent.com/github/docs/main/content/actions/reference/limits.md 、https://raw.githubusercontent.com/github/docs/main/data/reusables/actions/macos-runner-capacity.md | 已查證 |
| Playwright 1.63.0 支援的 macOS 版本 | macOS 14（Sonoma）以上；`macos-15` 符合 | “macOS 14 (Sonoma) or later.” | https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/docs/src/intro-js.md | 已查證 |
| macOS 上是否需要系統相依套件 | 不需要額外設定 | “For Windows or macOS agents, no additional configuration is required, just install Playwright and run your tests.” | https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/docs/src/ci.md | 已查證 |
| WebKit 在 macOS 與 Linux 的差異 | 平台相關功能（例如媒體解碼）因作業系統而異；最接近 Safari 的是在 Mac 上執行 WebKit | “for the closest-to-Safari experience you should run WebKit on mac” | https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/docs/src/browsers.md | 已查證 |
| `--with-deps` 在 macOS 上的行為 | 未讀到原文；設計在 macOS 上不加 `--with-deps`（PR #6 的做法） | — | — | **未查證** |
| macOS 排隊時間的長期分布 | PR #6 只有 5 次樣本（2～3 秒） | — | — | **未查證** |
| macOS 上 NFR-3 版面與 NFR-6 計時 | 相關驗收到 PR-4 才轉實測；PR #6 只執行了 3 個已實測的測試（其餘為骨架） | — | — | **未查證** |
| `timeout-minutes` 是否包含排隊時間 | 未讀到原文 | — | — | **未查證** |

**(7) 直接執行判斷與符號連結（D-macOS；v0.7 新增，設計 agent 實測）**

| 項目 | 方式 | 結果 | 查證 |
|---|---|---|---|
| 經符號連結執行時的 `process.argv[1]` 與 `import.meta.url` | Node.js 22.23.4，在暫存目錄建立 `real/` 與指向它的符號連結 `link/`，執行 `node link/m.mjs` | `process.argv[1]` 為 `…/link/m.mjs`，`import.meta.url` 為 `…/real/m.mjs`；`path.resolve(argv[1]) === fileURLToPath(url)` 為 **false**；`realpathSync` 兩邊比對為 true；`import.meta.main` 為 true | 實測 |
| 以實際路徑、在符號連結目錄中以相對路徑、`--preserve-symlinks-main` 執行 | 同上 | 舊判斷與 realpath 比對皆為 true（`--preserve-symlinks-main` 下 `import.meta.url` 也是連結路徑） | 實測 |
| 被另一個模組匯入時 | `import './m.mjs'` | realpath 比對為 false（不執行主程式），`import.meta.main` 為 false | 實測 |
| `import.meta.main` 的可用版本 | Node.js 文件 | “added: v22.18.0”、“Stability: 1.0 - Early development” | 已查證：https://raw.githubusercontent.com/nodejs/node/v22.23.4/doc/api/esm.md |
| `node --test` 的 glob 沒有對應任何檔案 | Node.js 22.23.4，`node --test 'nothing/**/*.test.mjs'` | 以 **0** 結束 | 實測 |
| macOS 的 `os.tmpdir()` 經符號連結 | 統籌 agent 於 PR #6 的診斷步驟確認（`/var` → `/private/var`） | 經連結路徑執行 `build.mjs` 時沒有產生 `dist/` | 實測（統籌 agent） |

**未查證、須在 DQ-15 決定後的 PR 實測：** job 因 `timeout-minutes` 中止時的結論值與「重跑失敗的 job」是否涵蓋它；`v1.63.0-noble` 在 MCR 的存在與拉取時間（採 (d) 時）；執行器 uid（採 (d) 時）；apt 在同一 job 內重試時是否沿用已下載的套件（採 (b) 時）；`timeout-minutes` 是否包含排隊時間；採 (g) 時 `--with-deps` 在 macOS 上的行為（設計不使用）、macOS 排隊的長期分布、macOS 上 NFR-3、NFR-6（PR-4）。

## 3. 結論摘要

| 編號 | 結論 | 建議 |
|---|---|---|
| Q4 | 可關閉：工具免費、授權允許、不隨網站散布 | 關閉 |
| Q6 | 可關閉：Actions 與 Pages 對公開版本庫免費；EQ-2 以傳統分支保護＋「Do not allow bypassing」達成；EQ-11 以 `issue_comment`／`pull_request_target` 觸發、commit status 回寫達成；EQ-12 與官方延遲上限相同、無餘裕 | 關閉。啟動例外已依 DQ-8 接受；EQ-12 的外部延遲處理已決定（DQ-9，2026-11-09；spec.md 12.5） |

v0.7：DQ-15 的未查證項目見 2.8 末段。

未查證、須在第一批變更實測的項目：`statuses: write` 權限鍵（v0.5：review-gate 尚未執行過，PR-1b 開啟時第一次實測）、rulesets 對管理員的預設行為（本設計不依賴）、瀏覽器與官方 action 的授權原文、「必要檢查只能選近期執行過的名稱」。

## 4. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | review-gate 觸發加入 `edited`；EQ-2 啟動例外、`review-record` 的兩段設定、EQ-12 外部延遲改列為待決問題 DQ-8、DQ-9 | design-review.md M-7 與「未列為待決的事項」第 2、3 點 |
| 0.4 | 2026-11-09 | DQ-8、DQ-9 改為已決定並寫明處理方式；依據改為需求 v1.1；查證內容未變更 | 產品負責人 2026-11-09 16:02 對 DQ-1～DQ-10 的決定；需求文件 v1.1 |
| 0.5 | 2026-11-09 | 2.3、2.5：`review-record` 的必要檢查與 AC-EQ-11 驗證由 PR-2 改到 PR-1b；新增 2.6 PR-1 合併後的平台狀態（API 讀取）與執行結果格式的實測；第 3 節未查證項目補註 | agent-dev-workflow 1.1 第 4.3 節「啟動例外以外不得再有不經檢查的合併」；PR-1 審查紀錄 N-2 |
| 0.5（第 3 輪審查修訂） | 2026-11-09 | 2.6 補斷言計數的實測（Playwright 自訂 reporter、node:test hook 與 diagnostic） | design-review.md 設計審查第 3 輪 M-1 |
| 0.6 | 2026-11-10 | 新增 2.7：PR-1b 合併後的平台狀態（review-gate 執行紀錄、分支保護、`body_html`）與 GFM 渲染、Unicode 性質的實測；GFM 規格原文與 `POST /markdown` 未能讀取，標為未查證並以 cmark-gfm 實測 | spec.md v0.6 DQ-14、12.6「v0.6 的順序」 |
| 0.6.1 | 2026-11-10 | 2.7 新增 node:test 子測試與並行的實測 | spec.md 12.2 第 9e 點 |
| 0.7 | 2026-11-18 | 新增 2.8：GitHub Actions 的逾時、必要檢查狀態、重跑、多雲執行器、`-latest` 移轉、快取限制、容器 job 語法與 Playwright 官方映像（讀官方原始檔；docs.github.com、playwright.dev、MCR 無法連線）；本版本庫 e2e 執行紀錄的雲端、鏡像與下載時間；未查證項目 | spec.md v0.7 DQ-15（探測 PR B 的 `e2e (webkit)` 卡在 `--with-deps`） |
| 0.7（選項 (g) 與 D-macOS） | 2026-11-18 | 2.8 (5) 補 PR #6 的紀錄（Firefox 在 AWS 上 13 分 4 秒、WebKit 在 MacCloud）；新增 (6) macOS 執行器（免費、標籤與規格、MacCloud、並行上限、Playwright 支援與 macOS 不需系統相依；`macos-14` 已不在表中）與 (7) 直接執行判斷與符號連結、`node --test` 無對應檔案時以 0 結束的實測；未查證項目補充 | 產品負責人 2026-11-18 15:20 指示實測 (g)；統籌 agent 的查證與 D-macOS 回報 |
