# 查證紀錄：Q4、Q6

| 項目 | 內容 |
|---|---|
| 版本 | 0.4（依產品負責人對 DQ-8、DQ-9 的決定修訂；版本號與設計文件組對齊，跳過 0.3） |
| 日期 | 2026-11-09（查證日期仍為 2026-11-04） |
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
2. **啟動順序限制（重要）：** `issue_comment` 與 `pull_request_target` 只執行預設分支上的工作流程檔，所以審查檢查在「加入它的 PR 合併之後」才生效。第一個 PR 無法由它把關：產品負責人須人工確認第一個 PR 有審查紀錄後合併，再啟用分支保護。又因必要檢查名稱須執行過才選得到（推定），`review-record` 要等 PR-2 寫入過一次狀態後、PR-2 合併前才加入必要檢查（spec.md 12.6 步驟 6a、6b）。AC-EQ-11 的人工驗收在 PR-2 執行。以上例外經產品負責人依 spec.md DQ-8 接受（2026-11-09）。
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
| 分支保護的必要檢查清單只能選「最近有執行過」的檢查名稱（推定，未查證） | 第一個 PR 合併前無法選到檢查；`review-record` 在 PR-1 期間不執行，PR-1 合併後仍選不到 | PR-1 合併後先設定其餘必要檢查（步驟 6a）；PR-2 寫入過 `review-record` 後、合併前再加入（步驟 6b）。若產品負責人偏好一次設定，可改用 REST API 直接指定 context 名稱（未查證，PR-1 時實測） |
| 勾選「Require branches to be up to date」後，每次更新分支都產生新 commit，必須重新審查 | 審查次數增加 | 本專案 PR 依序進行，影響小；接受 |

---

## 3. 結論摘要

| 編號 | 結論 | 建議 |
|---|---|---|
| Q4 | 可關閉：工具免費、授權允許、不隨網站散布 | 關閉 |
| Q6 | 可關閉：Actions 與 Pages 對公開版本庫免費；EQ-2 以傳統分支保護＋「Do not allow bypassing」達成；EQ-11 以 `issue_comment`／`pull_request_target` 觸發、commit status 回寫達成；EQ-12 與官方延遲上限相同、無餘裕 | 關閉。啟動例外已依 DQ-8 接受；EQ-12 的外部延遲處理已決定（DQ-9，2026-11-09；spec.md 12.5） |

未查證、須在第一批變更實測的項目：`statuses: write` 權限鍵、rulesets 對管理員的預設行為（本設計不依賴）、瀏覽器與官方 action 的授權原文、「必要檢查只能選近期執行過的名稱」。

## 4. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | review-gate 觸發加入 `edited`；EQ-2 啟動例外、`review-record` 的兩段設定、EQ-12 外部延遲改列為待決問題 DQ-8、DQ-9 | design-review.md M-7 與「未列為待決的事項」第 2、3 點 |
| 0.4 | 2026-11-09 | DQ-8、DQ-9 改為已決定並寫明處理方式；依據改為需求 v1.1；查證內容未變更 | 產品負責人 2026-11-09 16:02 對 DQ-1～DQ-10 的決定；需求文件 v1.1 |
