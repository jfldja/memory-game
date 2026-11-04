# 設計審查紀錄（M2）

| 項目 | 內容 |
|---|---|
| 審查對象 | docs/design/ 全部檔案（README.md、spec.md v0.1、module-test-standards.md v0.1、acceptance-test-plan.md v0.1、review-process.md v0.1、verification.md v0.1、cards.md v0.1、card-attributes.json、supplementary-acceptance.json、card-preview.html 與三張截圖）；.claude/skills/software-design-phase/SKILL.md（變更紀錄 1.0） |
| 審查者 | 審查 agent（新工作階段，以全新上下文啟動） |
| 作者 | 設計 agent（另一工作階段） |
| 獨立性 | **審查者與作者為同一模型（Claude）的不同工作階段**（docs/workflow.md W-1）。審查者只讀上列設計產出、需求文件、工作規範與 skill，未讀設計者的推理過程或交付對話 |
| 審查日期 | 2026-11-04 |
| 審查依據 | docs/requirements.md v1.0（已簽核，唯一判斷依據）；docs/workflow.md v0.1；agent-dev-workflow；requirements-spec 第 3.3、3.8 節 |
| 本紀錄的修改範圍 | 只新增本檔；未修改任何被審查的檔案；未 commit、未 push |

## 上工檢查結果

- [x] 角色：審查 agent。負責依清單審查並留下紀錄；不負責修改被審查內容、不審查自己是作者的產出（本次設計產出非本工作階段所寫）。
- [x] 階段：階段 2 設計（M2）；離開條件為產品負責人簽核（EQ-6）。本審查是簽核前的輸入。
- [x] 輸入：需求文件 v1.0 已簽核；設計產出為待簽核草稿（審查對象，不是工作依據）。
- [x] 已讀需求文件全文（第 1～14 節）。
- [x] 已讀 docs/workflow.md，知道 W-1～W-3 與第 4.4 節的調整。
- [x] 已載入／閱讀本階段適用的 skill（見下表）。

## 已載入 skill 的變更紀錄最新版本號

| skill | 版本 | 方式 |
|---|---|---|
| agent-dev-workflow | 1.0 | Skill 工具載入（與版本庫副本逐字相同，已 diff 確認） |
| requirements-spec | 無變更紀錄，無法填寫（即 DQ-6 所述問題） | 讀版本庫副本第 3.3、3.8 節 |
| software-design-phase | 1.0 | 作為審查對象閱讀；其第 9 節自我審查清單同時作為本審查的參考清單 |

---

## 總評

**目前不建議直接交產品負責人簽核。** 狀態機、計時、查證與 CI 設計的品質高，大部分可保留；但有 2 項阻擋型問題（PR 切分會讓 PR-4 的驗收測試無法執行；DA-4 屬產品決定卻以假設處理且牽動整個端對端測試介面），須先修正並把 DA-4 轉為待決問題，再連同修正型問題一併送簽。預估修正量小，不需重做架構。

問題數量：阻擋型 2、修正型 13、打磨型 12。

---

## 審查方法摘要

- 需求一致性：逐列比對 spec.md 5.4～5.7 與需求 6.9 兩張表、術語表、HT-7～HT-10、PS-4／PS-9／PS-10、LV-6、A-5、A-6、TM-1／TM-5、RC-3／RC-8。
- 狀態交互：依 requirements-spec 3.8 自行列出狀態 {S0、S1、S2、S3、H、P、W／L} × 操作 {點背面、點正面／已配對、提示、暫停／繼續、回到選單、重新開始、重新整理、切背景} 與 × 計時器 {已用時間、翻錯鎖定、提示標示、時間上限、畫面喚醒計時器}，並檢查同時到期、恰好在上限、暫停中到期、標示中翻牌、勝利當下的標示、連按。
- 可測性：以 Python 腳本解析需求 10.2 節標題（驗證方式含「自動」）與第 13 節矩陣（Must、自動、排除 NFR-1），得 51＋4＝55 個編號；與 acceptance-test-plan.md 第 2 節表格比對：**缺 0、多 0**。追溯：需求矩陣 Must 68 條（功能 62、非功能 6）與 module-test-standards.md 第 3 節比對：**缺 0、多 0**。
- 版面：依 spec.md 10.2 的符號重算五種尺寸與 844×390。
- 牌面：以腳本檢查 card-attributes.json（LV-2、LV-3、LV-4 皆成立；18 個 id 不重複；SVG 填色與屬性表一致）；以 grep 檢查 card-preview.html（無 `<link>`、`<script>`、`@import`、`url(`、`href=`、`src=`、`@font-face`；唯一出現的網址是 26 次 SVG 命名空間 `http://www.w3.org/2000/svg`，不會發出請求）；檢視 card-preview-min-size.png 與 card-preview-360.png。
- 設計 skill：grep 專案特有名詞，並對照 agent-dev-workflow 7.2。

---

## 阻擋型問題

### B-1 PR 切分：PR-4 的驗收測試依賴 PR-5 才提供的選單與結果畫面

- **位置：** spec.md 第 14 節 PR-4、PR-5 列；acceptance-test-plan.md 第 2 節「轉實測的 PR」欄。
- **問題：** PR-4 只含 game-view 與 app（遊戲部分），選單（menu-view）與結果畫面（result-view）在 PR-5。但排在 PR-4 轉實測的驗收需要它們：
  - AC-GP-1「Given 選單畫面 When 進入任一關」；其餘所有 E 層測試也都要從選單進入關卡，而 DOM 測試介面（spec.md 4.11）沒有其他進入遊戲的方式。
  - AC-GP-8「顯示勝利畫面」、AC-LV-6「顯示失敗畫面」需要 result-view。
  - AC-GP-2（E 層）的 20 次連續遊玩要用「重玩本關」或「回選單再進入」，前者在 result-view，後者需要選單與 PS-7。
  - NFR-3「以各尺寸開啟遊戲畫面」同樣要先進入遊戲。
- **後果：** PR-4 若照計畫把這些骨架轉實測，CI 必然失敗（違反 agent-dev-workflow 4.3「不讓主分支壞掉」）；若為了讓測試能進入遊戲，實作 agent 很可能自行加入規格沒有的入口（例如網址參數），正是 software-design-phase 第 8 節列出的錯誤寫法。實作會卡住。
- **依據：** agent-dev-workflow 4.3；EQ-2；AC-GP-1、AC-GP-2、AC-GP-8、AC-LV-6 原文。
- **建議：** 擇一，並在規格書寫明：
  1. （建議）把「選單的三個難度按鈕＋進入關卡」與「結果畫面的最小版本（勝利／失敗、重玩本關、回到選單）」移到 PR-4；PR-5 只做紀錄、清除、版本號、RS-1 數值等。
  2. 或把上述依賴選單／結果畫面的驗收全部改到 PR-5 轉實測。
  並在 software-design-phase 第 6 節新增檢查：「每個驗收在轉實測的 PR 中，其 Given／When 用到的畫面與操作都已存在」（見 M-13）。

### B-2 DA-4（DOM 帶 `data-face`）是產品決定，應列為待決問題並在簽核前關閉

- **位置：** spec.md 4.11 表格「牌」列與其後說明、第 17 節 DA-4；card-preview.html 的 `aria-label="L3-1"` 等（cards.md 2 節要求「原樣複製」到 faces.js）；`GameView.cards[].faceId`。
- **問題：**
  1. 讓玩家在背面朝上時即可由開發者工具（甚至螢幕閱讀器朗讀的 `aria-label`）取得全部答案，是需求沒有規定的產品行為。需求的精神明確重視「不讓玩家取得不該有的資訊」：Q8 因「第一張牌翻開前使用提示等於免費看答案」新增 HT-10；PS-4 由 Should 升為 Must 的理由是暫停中可記憶牌面（需求變更紀錄 v0.3、v0.4）。設計以「可接受」自行判斷，屬 requirements-spec 3.8 第 3 步「會不會讓使用者取得不該有的資訊」的組合，應交產品負責人決定。
  2. 以「假設」呈現，預設立場是「已接受」；但若產品負責人不同意，DOM 測試介面、AC-GP-1／AC-GP-2（E 層）、所有「找出同一對」的測試操作（acceptance-test-plan.md 第 4 節第 3 點）都要改，影響 PR-1 起的所有 E 層骨架，屬於簽核前必須確定的事項。
- **依據：** 需求 Q8、PS-4 升級理由；agent-dev-workflow 核心原則 2；software-design-phase 0.1「需求沒有規定的行為……列為待決問題」與 3.4「不要在規格書裡『先選一個』而不標示」。
- **建議：** 移為 DQ-7，標明「阻擋：PR-1（DOM 測試介面與 E 層骨架）」，至少列三個選項與代價：(a) 接受 `data-face`（現行）；(b) DA-4 的替代方案（`addInitScript` 替換 `getRandomValues`，在 Node 端以同一份 `deal` 重算配置）；(c) 只在牌翻開時才輸出 `data-face`，測試以翻牌取得資訊（AC-GP-1、AC-GP-2 需逐張翻開，較慢）。無論選哪一項，faces.js 的 SVG 都要移除 `aria-label="<牌面 id>"`（背面朝上的牌不得帶牌面 id 的可及性名稱），並明寫 `GameView.cards[].faceId` 只供畫面層在正面朝上時使用。

---

## 修正型問題

### M-1 不變式 I-2 與 T-11 互相矛盾

- **位置：** spec.md 5.2 I-2、I-5；5.4 T-11。
- **問題：** T-11 在翻錯鎖定中到達上限時「`lock=null`……牌維持當下的正反面」，於是 `phase=lost` 時有兩張 `up` 的牌，但它們既不是 `firstIndex` 也不在 `lock.indices`（I-5 要求 `lock=null`），違反 I-2。module-test-standards.md M5 要求「不變式 I-1～I-5 在每次操作後成立」，依標準寫的單元測試會失敗。
- **建議：** I-2 限定在 `phase` 為 `ready`／`playing` 時成立；或 T-11 一併清除 `firstIndex` 並明寫終止狀態下牌的正反面不受 I-2 約束。

### M-2 時間上限判定使用原始值，與「以顯示值判定」的等價說明不一致

- **位置：** spec.md 5.3 最後一點、5.4 T-11 守衛、6.3。
- **問題：** 5.3 稱「`toTenths(t) ≥ timeLimitSec×10` 與 `t ≥ limitMs` 等價（t 先四捨五入到微秒）」，但 T-11 守衛寫的是未四捨五入的 `playMs(now) ≥ limitMs`。當 `limitMs − 0.0005 ≤ t < limitMs` 時，顯示值已是 90.0 卻不判定失敗；若此刻配對最後一對，會以 90.0 勝利，違反 LV-6、A-5（顯示值達上限即失敗），紀錄驗證（9.2 `tenths < 上限×10`）也會把它判為無效資料。實務上機率極低，但規格自相矛盾。
- **依據：** 術語「顯示值」、LV-6、A-5。
- **建議：** T-11 守衛與 `advance` 的上限事件一律寫成 `toTenths(playMs(now)) ≥ timeLimitSec × 10`；M5 邊界加入 `limitMs − 0.0004` 的案例。

### M-3 版面計算沒有固定狀態列與按鈕列的實際高度，兩個必要尺寸的餘裕為 0～1 px

- **位置：** spec.md 10.2。
- **重算結果（與設計一致）：**

| 視窗 | s | 總高／視窗高 | 垂直餘裕 | 總寬／視窗寬 |
|---|---|---|---|---|
| 360×640 | 109 | 596／640 | 44 | 359／360 |
| 390×844 | 119 | 636／844 | 208 | 389／390 |
| 768×1024 | 216 | 1024／1024 | **0** | 696／768 |
| 1280×720 | 189 | 719／720 | **1** | 796／1280 |
| 1920×1080 | 240 | 872／1080 | 208 | 1000／1920 |
| 844×390（S） | 119 | 389／390 | 1 | 844 以內 |

  360×640 下牌 109×109、按鈕 80×44（4 個）或 109×44（3 個），NFR-3、NFR-5 成立。
- **問題：** Hs＝52 假設「兩行 16 px 文字＋上下 6 px」，等於行高 20 px（1.25），但規格沒有規定行高或固定高度。CJK 系統字型的 `line-height: normal` 常在 1.4～1.5，兩行即 45～48 px，狀態列約 57～60 px；768×1024 與 1280×720 會溢出 5～8 px，造成垂直捲動，NFR-3（Must）失敗。設計只寫「實作時須確認無 1 px 溢出；若有，s 改為 215」，不足以涵蓋。
- **依據：** NFR-3；software-design-phase 第 9 節「每個要求的視窗尺寸都有版面算式與結果」。
- **建議：** 擇一寫入規格：(a) 狀態列、按鈕列以 `height` 固定為 52 px，文字 `line-height: 20px`，並把 s 的算式改為從 F 再保留 ≥ 4 px 餘裕；或 (b) 以 CSS grid `auto 1fr auto` 讓牌面區取得實際剩餘高度，再以容器查詢單位計算 s，算式改為「剩餘高度」而非常數 F。另補上 844×390 側欄（寬 176 px）中狀態文字換行後的高度計算。

### M-4 AC-PS-4 無法依 DOM 測試介面判定「看不到牌面」

- **位置：** spec.md 4.11「牌」列（`data-state` 為邏輯狀態，暫停時不變）、10.3 遮蔽層；acceptance-test-plan.md #35。
- **問題：** 測試計畫寫「牌面區內沒有可見的牌面 SVG」，但介面表沒有定義如何分辨牌面 SVG 與牌背 SVG；`data-state` 暫停時仍為 `up`，測試只能依賴 SVG 內部結構，違反「端對端測試只依本表操作」。
- **建議：** 在介面表新增，例如每張牌的 `data-shown="face|back"`（實際渲染內容），或牌面 SVG 帶 `data-role="face"`、牌背帶 `data-role="back"`。AC-PS-4 的判定改為「遮蔽層可見，且 12 張牌 `data-shown=back`／沒有可見的 `[data-role=face]`」。

### M-5 NFR-6 的判定方式比需求寬鬆，且缺少逾時與執行隔離

- **位置：** acceptance-test-plan.md 第 4 節第 5 點、#54；spec.md 6.2。
- **問題：**
  1. 判定為「顯示值與 [t1a − t0b, t1b − t0a] 區間的**距離** ≤ 0.2 秒」，只要區間內任一點符合即通過；實際誤差可達 0.2 秒加上區間寬度。違反 requirements-spec 3.3「驗收不得比需求寬鬆」。
  2. 89 秒的測試超過 Playwright 預設每測試 30 秒逾時，未寫明 `test.setTimeout`。
  3. 「三個長度可平行執行」與其他端對端測試共用 CI 執行器時，CPU 負載會延後畫面更新計時器，增加誤差。
- **建議：** 判定改為「區間寬度 ≤ 0.05 秒（否則該次量測無效並重量一次，重量仍超過即失敗），且區間兩端與顯示值的差都在 ±0.2 秒內」；明寫 `test.setTimeout(120_000)`；NFR-6 放在獨立的 Playwright project 或 `serial` 模式，不與其他測試平行。

### M-6 CI 安全與競態：缺少注入防護與一致的並行群組

- **位置：** spec.md 12.1「共同設定」；review-process.md 第 4 節；verification.md 2.3。
- **問題：**
  1. `pull_request_target`／`issue_comment` 有 `statuses: write`。設計正確地不簽出 PR 程式碼，但沒有明文禁止在 `run:` 中以 `${{ github.event.comment.body }}`、`${{ github.event.pull_request.title/body }}`、`head.ref` 等使用者可控字串插值（GitHub 官方列為指令注入風險）。
  2. 審查紀錄被刪除／編輯與新增幾乎同時發生時，兩次執行若不序列化，較晚完成的舊執行可能以過時判定覆寫狀態（commit status 對同一 context 以最後寫入為準）。12.1 只寫「`concurrency` 以 PR 編號分組」，但 `pull_request_target` 與 `issue_comment` 取 PR 編號的欄位不同，`push` 事件沒有 PR 編號。
- **建議：** 在 review-process.md 第 4 節加入：「工作流程不得把事件內容插值到 `run:`；PR 編號以 `env:` 傳入，其餘一律由腳本經 API 讀取」「不使用 `actions/cache`、不執行 `npm install`（只用 Node.js 內建模組）」；並寫明群組鍵 `review-gate-${{ github.event.pull_request.number || github.event.issue.number }}`、`cancel-in-progress: false`（序列化，每次重讀最新狀態）。ci.yml 的群組鍵對 `push` 事件改用 `github.ref`。

### M-7 啟動程序：`review-record` 無法在步驟 6 被選為必要檢查；初始 commit 未處理

- **位置：** spec.md 12.6 步驟 4～8、第 14 節「PR-1 的特別處理」；verification.md 2.5。
- **問題：**
  1. verification.md 自己推定「必要檢查只能選最近執行過的檢查名稱」，而 `review-record` 在 PR-1 期間不會執行（工作流程尚未在預設分支），步驟 6 時選不到，EQ-2／EQ-11 的設定無法照步驟完成。
  2. 開 PR-1 之前主分支必須已有一個 commit，這個 commit 只能直接推送。這是 EQ-2「主分支應只能透過 Pull Request 變更」的例外，設計沒有寫出，也沒有交產品負責人確認。
- **建議：** 步驟改為：0）產品負責人直接推送只含 README（或空）的初始 commit，記為 EQ-2 啟動例外；6a）先設定除 `review-record` 外的必要檢查；開 PR-2 讓審查檢查寫入一次狀態後，6b）再加入 `review-record`（或以 REST API 直接指定 context 名稱與 GitHub Actions 的 app_id，不受 UI 限制）。兩個例外列入「需要產品負責人決定的事項」。

### M-8 審查清單沒有涵蓋「PR 修改自己的檢查」

- **位置：** review-process.md 第 3 節 R-1～R-13。
- **問題：** ci.yml、pr-body.yml 在 `pull_request` 事件下執行的是 PR 內的工作流程檔與腳本；PR 可以修改 `scripts/check-acceptance-ids.mjs`、`scripts/check-pr-body.mjs`、`.github/workflows/*`、`docs/design/supplementary-acceptance.json`（`enforced`）或 docs/requirements.md 的驗證方式欄，讓本 PR 的檢查放寬後通過。R-12 只檢查 skill 與規格書。
- **依據：** EQ-2、EQ-4；agent-dev-workflow 核心原則 2。
- **建議：** 新增 R-14「CI 與檢查規則變更」：凡修改上述檔案，PR 說明須列出理由與對應編號，審查者確認沒有降低任何檢查（例如移除必要 job、縮小掃描範圍、把 `enforced` 改為 false）；docs/requirements.md 的變更必須附產品負責人核准的版本。review-gate 的「R-1～R-13 每一列」同步改為 R-1～R-14。

### M-9 「部分實作」的驗收測試會繞過「沒有略過的測試」檢查

- **位置：** acceptance-test-plan.md #53 NFR-5（PR-4 遊戲、PR-5 其餘）、#55 NFR-7（PR-1 選單、PR-5 全部）。
- **問題：** 同一編號的測試在早期 PR 只檢查一部分卻已是「實際測試」，`--no-skip` 無法發現後續部分是否補上；且 PR-1 只有版本號頁面，尚無「選單」可檢查。
- **建議：** 每個範圍各一個名稱含編號的測試（例如「NFR-5 遊戲畫面」「NFR-5 選單」「NFR-5 結果畫面與對話框」「NFR-7 選單」「NFR-7 三關遊玩」「NFR-7 結果畫面」），尚未有畫面的部分保持骨架略過；PR-1 的 NFR-7 測試改為「NFR-7 首頁」。

### M-10 測試執行設定有缺口

- **位置：** spec.md 12.1 `unit` job、12.3；module-test-standards.md M10。
- **問題：**
  1. M10 允許實作 agent 把端對端 smoke 測試放在 `tests/unit/e2e/`，但 Playwright 的 `testDir` 是 `tests/acceptance/e2e`，`node --test` 也不會正確執行 Playwright 測試，這些測試不會被任何 CI job 執行。
  2. `node --test tests/unit tests/acceptance/unit`：Node.js 21 起位置參數視為 glob，傳入目錄的行為未在設計中實測。
- **建議：** smoke 測試改放 `tests/smoke/`，playwright.config 增一個 project（或刪除此選項）；`unit` job 改用明確 glob（例如 `'tests/unit/**/*.test.mjs' 'tests/acceptance/unit/**/*.test.mjs'`），並在 PR-1 實測。

### M-11 faces.js 的來源規則與其單元測試互相矛盾

- **位置：** cards.md 第 2 節最後一點；module-test-standards.md M9；review-process.md R-9。
- **問題：** cards.md 要求把預覽頁的 `<svg>`「原樣複製」並只移除 `id`；但 M9 規定 SVG 字串不得含 `http` 與 `id=`。原樣複製會保留 `xmlns="http://www.w3.org/2000/svg"`（含 `http`）與 `data-face-id="…"`（含子字串 `id=`），M9 測試必定失敗；R-9 以 `http` 搜尋 `src/` 也會誤報。另 `aria-label` 帶牌面 id（見 B-2）。
- **建議：** 明寫轉換規則：移除 `id`、`data-face-id`、`aria-label`、`xmlns`（以 innerHTML 插入 HTML 文件時不需要），加上 `aria-hidden="true"`；M9 的禁止清單改為正規表示式 `\bid=`、`https?://`（排除已移除的命名空間），或規定只允許 `http://www.w3.org/2000/svg`。

### M-12 設計補充驗收的啟用時點會讓 CI 失敗

- **位置：** spec.md 第 15 節；acceptance-test-plan.md 第 3 節；supplementary-acceptance.json。
- **問題：** 「簽核後將 `enforced` 改為 true」「骨架在 PR-6 開啟前加入」沒有指定在同一個 PR。若先改 `enforced` 而骨架未加入，`acceptance-ids` 失敗；若骨架先加入而未 enforced，則無妨但順序未寫。
- **建議：** 產品負責人在設計簽核時即決定 Should 範圍；PR-1 依決定設定 `enforced` 並同時加入對應骨架（agent-dev-workflow 4.3「啟用編號檢查的那個變更必須同時包含全部骨架」）。之後若改變範圍，`enforced` 與骨架在同一 PR 變更。

### M-13 設計 skill 應補上本次發現的通用規則

- **位置：** .claude/skills/software-design-phase/SKILL.md 第 3、5、6、8、9 節。
- **問題：** 依 agent-dev-workflow 7.3，下列問題在其他專案也會發生，skill 沒有提醒：
  1. PR 切分沒有檢查「驗收的 Given／When 所需畫面在該 PR 已存在」（B-1）。
  2. 第 8 節最後一列寫「若必須暴露資訊，列為假設請產品負責人確認」，等於鼓勵以假設處理產品決定（B-2）；應改為「列為待決問題」。
  3. 版面算式要寫出每個尺寸的餘裕，並固定算式中每個常數的實際 CSS（高度、行高），餘裕小於數 px 時視為不成立（M-3）。
  4. 工作流程的指令注入、並行群組與狀態覆寫順序（M-6）；只靠 commit status 的必要檢查的啟動程序與初始 commit（M-7）；PR 可修改自身檢查（M-8）。
  5. 真實時間量測的判定不得以區間距離放寬，並設定逾時與隔離（M-5）；部分實作的驗收測試要拆分（M-9）。
- **建議：** 依 skill 第 10 節修改，升版 1.1 並寫入變更紀錄；同步在第 9 節自我審查清單加入對應項目。

---

## 打磨型問題

| 編號 | 位置 | 問題 | 建議 |
|---|---|---|---|
| P-1 | card-preview.html | 第 3 關 6 張與牌背在「最小尺寸模擬」區重複出現，`id` 重複（L3-1～L3-6、card-back 各 2 次）；頁首又寫「每個 svg 的 id 即牌面識別碼」，以 id 擷取時可能取到兩份 | 模擬區的 svg 移除 `id`，或改用 `<use>` 以外的方式複製 |
| P-2 | card-attributes.json `detail` 鍵 | `lines-45` 描述為「＼」、`lines-135` 為「／」，與一般數學角度慣例（45° 為「／」）相反，容易在日後調整時弄錯 | 改用不依角度慣例的鍵名，例如 `lines-diag-down`／`lines-diag-up`，或在 description 註明「以 SVG y 軸向下計」 |
| P-3 | spec.md 10.2 | 360×640 下按鈕高恰為 44 px，沒有餘裕；瀏覽器縮放或子像素取整時 bounding box 可能為 43.99 | 按鈕高改 48（Hb 56；360×640 仍有 36 px 垂直餘裕） |
| P-4 | spec.md 10.4 | `viewport-fit=cover` 但未規定 `env(safe-area-inset-*)` 內距，瀏海機型橫向時側欄可能被遮 | 補上安全區內距，或不使用 `cover` |
| P-5 | .github/pull_request_template.md、review-process.md 第 2 節 | 範本只有一組「作者」欄位，但 PR 常同時有實作與測試兩位作者；check-pr-body 與 review-gate 解析多位作者的格式未定 | 範本改為可列多行「- 角色／工作階段」，並寫明解析規則 |
| P-6 | acceptance-test-plan.md #51 | AC-EQ-9 的 Given 是「主分支最新 commit 的部署」，名稱含編號的測試只驗本機建置；部署端由 `smoke` 驗證但不帶編號 | 把 `smoke` 的步驟名稱標為「AC-EQ-9（部署）」，在追溯表註明兩者合起來滿足 |
| P-7 | spec.md 第 14 節 | UAT 期間凍結主分支（EQ-14、M4）只靠約定 | 建議 UAT 期間在分支保護勾選「Lock branch」，結束後取消；寫入 12.6 |
| P-8 | spec.md 12.2 第 5 點 | 略過偵測只列 `test.skip`、`test.fixme`、`{ skip: true }` | 一併偵測 `test.describe.skip`、`describe.skip`、`it.skip`、`{ todo: true }`、`test.todo` |
| P-9 | spec.md 12.1 | `concurrency` 以 PR 編號分組，`push` 事件沒有 PR 編號 | 見 M-6 的群組鍵寫法 |
| P-10 | README.md | workflow.md 4.4 要求非 PR 產出在交付摘要開頭附上上工檢查與 skill 版本號；設計文件中沒有這兩段（審查者未讀到交付摘要，無法確認） | 在 README.md 開頭補上，便於產品負責人與 AC-EQ-6 查核 |
| P-11 | module-test-standards.md 3.3 | 寫「上表全部列出」，未說明以腳本核對（software-design-phase 0.3、第 9 節要求腳本核對） | 附上核對腳本或其輸出；本審查已以腳本確認 68／68、55／55 |
| P-12 | software-design-phase 第 8 節 | 「尚無紀錄時顯示新紀錄」一列取自本專案情境，未標示為範例 | 標為「範例」或改寫為通用情境（例如「需求只寫 A 時，自行加上 B 的情形」） |

---

## 設計文件未列為待決、但需要產品負責人決定的事項

1. **DA-4 是否接受（B-2）。** DOM 與可及性名稱暴露牌面，牽動整個端對端測試介面；須在簽核前決定。
2. **EQ-2 的啟動例外（M-7）。** 初始 commit 直接推送，以及 PR-1 在分支保護與審查檢查生效前合併（由產品負責人人工確認審查紀錄）。EQ-2 規定「應只能透過 Pull Request 變更，且套用於管理員」，例外須由產品負責人明確接受。
3. **EQ-12 沒有餘裕的外部風險。** verification.md 2.4 已寫明官方上限等於需求期限，建議產品負責人明確接受「GitHub 端延遲造成 AC-EQ-12 失敗屬外部因素」的處理方式（重試或回報），而不是只記錄。
4. **RC-8 整份視為無效時，下一次勝利會覆寫其他關卡的原始資料（DQ-4 的附帶效果）。** DQ-4 應把此效果寫出，讓產品負責人在「整份／逐項」之間知情選擇。
5. **Should 範圍與補充驗收是否在簽核時一併決定（M-12）。** 影響 PR-1 是否包含補充骨架。

---

## 對設計者待決問題與假設的意見

| 編號 | 意見 |
|---|---|
| DQ-1 | 同意建議（暫停中、尚未計時時皆可重新開始，效果同回選單再進入）；與 PS-7 在相同狀態下的可用性一致。 |
| DQ-2 | 同意維持暫停；與 PS-4 遮蔽一致，且避免玩家回前景時立即損失時間。 |
| DQ-3 | 同意列為待決；建議中的需求改寫應由統籌 agent 依 requirements-spec 修訂並升版，不宜由設計逕行假定。 |
| DQ-4 | 同意依字面（整份），但請補寫「下一次勝利會覆寫整份資料」的附帶效果（見上節第 4 點）。 |
| DQ-5 | 同意顯示記憶體中的結果並保留提示；RC-9 為 Should，阻擋範圍正確。 |
| DQ-6 | 同意；這是 requirements-spec 本身的缺漏，應依 agent-dev-workflow 7.4 第 5 點向產品負責人提出修改段落。在補上前，PR 範本建議註明「requirements-spec：無版本號」以免作者誤填。 |
| DA-1 | 同意；`statuses: write` 是 GITHUB_TOKEN 的既有權限鍵，風險低，PR-2 首次執行即可確認。 |
| DA-2 | 同意；fork 情境已由「不簽出 PR 程式碼」處理，前提是補上 M-6 的注入防護。 |
| DA-3 | 同意固定 1.0.0；理由（避免發布前改版本號觸發 EQ-14 重新 UAT）充分。 |
| DA-4 | 不同意以假設處理，應改為待決問題（B-2）。 |
| DA-5 | 同意；已有 `100vh` 後備，舊瀏覽器屬 UAT 範圍。 |

---

## 狀態交互檢查的其他結果（無問題的組合，供設計者確認保留）

| 組合 | 設計處理 | 判定 |
|---|---|---|
| 計時器到期與點擊同一時刻 | 每個方法先 `advance`；上限先判失敗、鎖定先結束 | 符合 A-5、GP-5 容差 |
| 恰好在上限配對最後一對 | 先 T-11，點擊無效 | 符合 A-5、AC-LV-6（但見 M-2 的次微秒差異） |
| 上限與翻錯鎖定同時到期 | T-6 後 T-11，失敗 | 符合 6.9 |
| 暫停中畫面計時器仍觸發 | 遊玩時鐘停止，`advance` 無事件；`nextWakeup=null` | 安全 |
| 提示標示中翻牌、配對被標示的牌 | 允許；標示照 2 秒結束 | 符合 A-4 |
| 勝利當下仍在提示標示中 | T-4 清除 `hint` | 符合 6.9 勝利列 |
| 提示標示中再按提示（連按） | T-9 無效果 | 符合 HT-8 |
| 只剩最後一對、一張已翻開時按提示 | T-9 | 符合 HT-7、AC-HT-7 |
| 第一張翻開前暫停／繼續 | 仍為 S0、0.0 | 符合 6.9 |
| 背景中（PS-5 未實作）到達上限 | 回前景第一次喚醒判定失敗 | 符合 LV-6 |
| 兩個分頁同時遊玩 | 勝利時重讀再合併 | 符合 RC-3 |
| 重新整理 | 一律回選單、不寫紀錄 | 符合 A-6、RC-2 |

---

## 優點（請保留）

1. **共用遊玩時鐘（5.3）**：已用時間、翻錯鎖定、提示標示以同一個扣除暫停的時鐘計算，PS-1／PS-3／PS-9 由結構保證，而非逐一保存剩餘時間。
2. **「每個方法先 `advance`」＋同時到期的處理順序（5.4）**，讓「計時器與操作同時發生」有確定答案且與 A-5 一致。
3. **以截止時間排程畫面更新（6.1）**，並有實測佐證；使容差邊界上的驗收在控制時鐘下可重現。
4. **轉移表與 6.9 逐格對照（5.4～5.7）**，每格都有轉移代號與需求編號，並列出不變式交給單元測試。
5. **查證紀錄（verification.md）** 逐項附官方原文、網址與「已查證／實測／未查證」標示，誠實列出未查證項目與殘餘風險；正確指出 `issue_comment` 的 SHA 是預設分支、評論不觸發 commit 檢查，並以 commit status 回寫最新 head SHA 解決 EQ-11。
6. **review-gate 的設計**：每次重讀最新 head SHA、只採計協作者評論、要求完整 40 碼 SHA、以最後一則為準、判定邏輯為純函式；`pull_request_target` 不簽出 PR 程式碼。
7. **驗收骨架計畫完整**：55 個編號與需求腳本解析結果完全一致；有 `--no-skip` 收尾；測試命名規則與 Playwright 的實測陷阱（`pauseAt`、`aria-disabled` 的點擊）都寫入。
8. **`aria-disabled` 而非 `disabled` 的理由（10.4）** 直接對應 PS-10 與術語「無法使用」，並告訴測試以座標點擊。
9. **紀錄以十分之一秒整數保存（9.1）** 與嚴格的格式驗證（9.2），避免浮點比較，直接支援 RC-3、RC-8。
10. **牌面**：屬性表機器可讀且符合 LV-2～LV-4；Okabe–Ito 色票、深色描邊、不用 `clipPath` 的理由清楚；第 3 關在 109×109 下的截圖中 6 種圖案（水平、垂直、兩種斜向、方格、斜方格）清楚可分，線寬約 5.8 px、間隙約 8.7 px 的計算可信；預覽頁不載入任何外部資源（C-4、C-5）。
11. **設計 skill** 符合 agent-dev-workflow 7.2 的五項要求（與專案無關、輸入產出、業界做法與縮減、自我審查清單、回饋機制與變更紀錄），專案特有內容大多已標為範例。

---

## 本審查對 skill 的修改建議

- **software-design-phase**：見 M-13（由設計 agent 修改並升版）。
- **agent-dev-workflow（產品負責人維護）**：建議在 4.3「驗收測試骨架」加一句：「每個骨架轉為實際測試的變更，必須已包含該驗收 Given／When 所需的全部畫面與操作；同一編號涵蓋多個範圍時，各範圍分開命名，未完成的範圍保持略過。」理由：本次 B-1、M-9 屬跨專案通用問題。
- **requirements-spec（產品負責人維護）**：同意 DQ-6，建議加上變更紀錄節。
