# 設計文件（M2）

| 項目 | 內容 |
|---|---|
| 版本 | 0.5.1（v0.5 簽核後釐清：實作 agent 依 agent-dev-workflow 5.1 回報的 4 項設計問題）；0.5（PR-1 審查 N-1～N-6 與實作、測試 agent 回報的修正；新增 PR-1b；含設計審查第 3 輪修訂） |
| 日期 | 2026-11-10 |
| 狀態 | v0.5 已簽核（2026-11-10 16:06（Asia/Taipei），產品負責人，見第 5 節）；**v0.5.1 待產品負責人確認**；v0.4 已簽核（2026-11-09 16:12）。DQ-1～DQ-12 已全部關閉；DQ-13（v0.5.1 新增）待決定 |
| 依據 | docs/requirements.md v1.1（已簽核）；docs/workflow.md v0.2；docs/design/design-review.md（設計審查紀錄）；產品負責人 2026-11-09 16:02 對 DQ-1～DQ-10 的決定；PR #1 審查紀錄（N-1～N-6）與實作、測試 agent 的回報 |
| 撰寫 | 設計 agent（agent-dev-workflow 第 3 節「設計 agent」） |

## 0. 上工檢查與已載入 skill（workflow.md 第 4.4 節）

**v0.5.1 簽核後釐清（設計 agent，工作階段 designer-pr1b-20261110，branch `pr-1b/pre-pr2-fixes`，基於 ad5067d）：**

- [x] 角色：設計 agent。只修訂設計文件與設計 skill；不撰寫程式碼與測試、不修改需求文件與產品負責人維護的 skill。
- [x] 階段：階段 3（M3）進行中，PR-1b 實作期間；依 agent-dev-workflow 5.1 回到設計階段處理實作 agent 回報的設計問題，離開條件為產品負責人確認 v0.5.1（並決定 DQ-13）。
- [x] 輸入：需求文件 v1.1（已簽核）；workflow.md v0.2；設計文件 v0.5（已簽核 2026-11-10 16:06）；統籌 agent 轉述的實作 agent 回報 4 項；實作 agent 的 commit 0009cee～ad5067d（已讀 `scripts/review-gate.mjs`、`check-acceptance-results.mjs`、`acceptance-reporter.mjs`、`acceptance-reporter-pw.mjs`、`check-acceptance-ids.mjs` 第 9c 點部分、`playwright.config.mjs`、`.github/workflows/ci.yml`、`.gitignore`，及 `tests/unit/` 的 review-gate、check-acceptance-results、check-acceptance-ids、workflows 測試）。
- [x] 已讀需求文件（EQ 相關需求與驗收、第 10 節、追溯矩陣）、workflow.md、docs/design/ 中受影響的文件。
- [x] 已載入 skill：agent-dev-workflow、software-design-phase、requirements-spec。

| skill | 載入時版本 | 本次修訂後 |
|---|---|---|
| agent-dev-workflow | 1.1 | 1.1（未修改；產品負責人維護） |
| requirements-spec | 1.1 | 1.1（未修改；產品負責人維護） |
| software-design-phase | 1.5 | 1.6（本次修訂，見其變更紀錄） |

**v0.5 修訂（設計 agent，工作階段 designer-pr1b-20261109，branch `pr-1b/pre-pr2-fixes`，基於 main 7707e9f）：**

- [x] 角色：設計 agent。只修訂設計文件與設計 skill；不撰寫程式碼與測試、不修改需求文件與產品負責人維護的 skill（agent-dev-workflow、requirements-spec）。
- [x] 階段：階段 3（M3）進行中，PR-2 之前；依 agent-dev-workflow 5.1 回到設計階段修正 PR-1 發現的設計問題，離開條件為產品負責人簽核 v0.5。
- [x] 輸入：需求文件 v1.1（已簽核）；workflow.md v0.2；設計文件 v0.4（已簽核 2026-11-09 16:12）；PR #1 審查紀錄（`gh api …/issues/1/comments`，2026-11-09 08:41）；統籌 agent 轉述的實作與測試 agent 回報；main 7707e9f 的程式碼與工作流程。
- [x] 已讀需求文件全文、workflow.md、docs/design/ 全部。
- [x] 已載入 skill：agent-dev-workflow、software-design-phase、requirements-spec（第 3.8 節）。

| skill | 載入時版本 | 本次修訂後 |
|---|---|---|
| agent-dev-workflow | 1.1 | 1.1（未修改；產品負責人維護） |
| requirements-spec | 1.1 | 1.1（未修改；產品負責人維護） |
| software-design-phase | 1.3 | 1.5（本次修訂：1.4 依 PR-1 回報，1.5 依設計審查第 3 輪；見其變更紀錄） |

v0.4 的上工檢查紀錄見 git 歷史（commit dfca62f 的本節）。

## 1. 文件清單

| 檔案 | 版本 | 內容 |
|---|---|---|
| verification.md | 0.5 | Q4（開發工具授權）、Q6（GitHub Actions／Pages、分支保護、EQ-11 可行性、部署延遲）查證紀錄，附官方網址 |
| spec.md | 0.5.1 | 軟體規格書：架構、檔案結構、模組介面、狀態機、計時、時鐘抽象、隨機排列、紀錄儲存、畫面與版面計算、版本號、CI／CD、PR 切分、Should 需求建議、待決問題、假設 |
| module-test-standards.md | 0.5.1 | 各模組測試標準、單元測試與驗收測試分界、Must 需求追溯（以腳本核對） |
| acceptance-test-plan.md | 0.5.1 | 驗收測試骨架計畫（55 個必要編號＋6 個已啟用的補充驗收、層次、轉實測的 PR、撰寫注意事項） |
| review-process.md | 0.5.1 | 審查紀錄格式、審查清單 R-1～R-15、審查檢查判定規則與工作流程安全設定 |
| supplementary-acceptance.json | 0.4 | Should 需求的設計補充驗收編號（DQ-10 決定全部啟用，`enforced: true`，隨 PR-1 生效） |
| cards.md | 0.4 | 牌面屬性表、繪製與轉換規則、第 3 關可分辨性的依據 |
| card-attributes.json | schemaVersion 1（內容 v0.2：細節鍵名改為方向文字） | 機器可讀牌面屬性表（AC-LV-2～4 讀取） |
| card-preview.html | v0.2 | 19 張原創內嵌 SVG 預覽頁（不載入外部資源；無重複 id；SVG 不帶可及性名稱） |
| card-preview.png、card-preview-min-size.png、card-preview-360.png | v0.2 | 預覽頁截圖（本機 Chromium；最小尺寸模擬為 108×108） |
| design-review.md | — | 設計審查紀錄（審查 agent 撰寫，設計 agent 不修改） |

可重用設計 skill：`.claude/skills/software-design-phase/SKILL.md`（1.6）。

版本號說明：v0.4 起設計文件組的受影響文件統一為 0.4（verification.md、review-process.md、cards.md、supplementary-acceptance.json 由 0.2 直接升為 0.4）。v0.5 只升受影響的文件（本文件、spec.md、module-test-standards.md、acceptance-test-plan.md、review-process.md、verification.md）；cards.md、supplementary-acceptance.json 維持 0.4，card-attributes.json、card-preview.html 與截圖維持 v0.2。v0.5.1 只升本文件、spec.md、module-test-standards.md、acceptance-test-plan.md、review-process.md；verification.md 維持 0.5。

## 2. 需要產品負責人決定的事項

**v0.5.1（簽核後釐清，PR-1b 合併前）：**

1. 確認 v0.5.1（第 5 節「v0.5.1 待產品負責人確認」一列）。v0.5.1 沒有改變已簽核的產品行為；對 CI 與審查檢查只有兩處增加失敗條件，請一併確認：review-gate 偵測形式去除行首區塊標記（v0.5 的寫法偵測不到合法行，這是修正）、`check-acceptance-results` 第 7 項（執行器全域錯誤即失敗）。其餘為補寫實作已採用、設計沒寫的做法（結果檔交接、`evaluateResults` 簽名、`--dry-run` 對已關閉 PR 的行為、第 9c 點不豁免只含骨架的檔案）。
2. 決定 **DQ-13**（spec.md 第 16 節）：審查紀錄的偵測形式是否再收緊，涵蓋仍判為有效的看似欄位的寫法。建議 (b)。須在 PR-1b 合併前決定；決定前不實作 (b)、(c)。

**v0.5.1 給實作與測試 agent 的工作（依 v0.5.1；DQ-13 決定前）：**

| 對象 | 工作 | 依據 |
|---|---|---|
| 實作 agent | 程式不需修改（4 項的做法都正確，設計已採用）。補單元測試：偵測形式的正例（合法欄位行恰好偵測一次）與反例 `1. 結果：…`、`1) 結果：…`、`+ 結果：…`、`> 結果：…`、唯一一行寫在引用區塊或縮排中、「針對 commit」寫在引用區塊；`--dry-run` 印出 PR 狀態；沒有候選紀錄時 `targetUrl` 為 `prUrl`（已有者不重複）。`tests/unit/check-acceptance-ids.test.mjs` 中「設計 12.2 第 9c 點未區分」的測試名稱可改為引用 v0.5.1 | module-test-standards.md M12（v0.5.1）；review-process.md 第 4 節 |
| 實作 agent（DQ-13 採 (b) 或 (c) 時） | 依決定修改 `scripts/review-gate.mjs` 的偵測形式與表格列偵測，並補對應單元測試（以 review-process.md 第 4 節「仍不涵蓋的寫法」逐一為反例） | spec.md 第 16 節 DQ-13 |
| 測試 agent | 建立 `tests/support/assertions.mjs`（spec.md 12.2.1 第 6 項）；`tests/acceptance/unit/` 的**全部** 4 個檔案自它匯入 `assert`，包括只含骨架的 `config.test.mjs`、`card-attributes.test.mjs`、`deal.test.mjs`；`acceptance-ids.test.mjs` 改用它而不匯入 `node:assert/strict`（v0.5 已規定，v0.5.1 釐清不豁免）。依 spec.md 12.2.1「結果檔的交接」確認 AC-EQ-4 測試的反例資料沿用 `acceptance-results/` 的檔名與結束標記 | spec.md 12.2 第 9c 點；acceptance-test-plan.md 第 4 節第 9 點 |
| 審查 agent | PR-1b 的 R-14 對照 v0.5.1：結果檔交接、第 7 項、偵測形式屬設計已採用的做法，不屬放寬 | review-process.md R-14 |

**v0.5（PR-1b 開啟前；已完成，2026-11-10 16:06 簽核）：**

1. 簽核 v0.5（EQ-6），在第 5 節「v0.5 待簽核」一列填入日期。PR-1b 的實作與測試 commit 須在簽核之後。
2. 決定 DQ-11（main 上的 review-gate 無法寫入狀態時的處理，含 PR-1b 合併後的新版；建議 (d) 先開不合併的探測 PR，並以 (a) 作為確實無法寫入時的唯一處理）、DQ-12（AC-EQ-2「CI 失敗不能合併」的驗證方式；採 DQ-11 (d) 時建議 (a)＋(b) 都做，否則 (a)）。
3. 確認 spec.md 12.6 的程序：6b 與步驟 8 在「驗證 PR」（採 DQ-11 (d) 時為探測 PR A，否則為 PR-1b）執行；PR-1b 合併前完成新版 `--dry-run` 試算（結果須為 success）與人工確認清單 (i)～(vi)（PR-1b 由舊版 review-gate 判定）；PR-1b 合併後的第一個 PR 執行步驟 8b（新版的 AC-EQ-11 證據）。

**v0.4（已完成）：**

1. 簽核本設計（EQ-6），在第 5 節留下日期與版本。
2. 關閉 Q4、Q6（verification.md 第 3 節）。
3. 待決問題 DQ-1～DQ-10：已於 2026-11-09 16:02 決定（第 3 節），本版已寫入設計，不需再決定。
4. 牌面草稿的美觀度與第 3 關難度（cards.md 第 4 節）。
5. 假設 DA-1、DA-2、DA-3、DA-5（spec.md 第 17 節）。

## 3. 待決問題（DQ-1～DQ-12 已關閉；DQ-13 待決定）

產品負責人於 **2026-11-09 16:02** 決定：DQ-1～DQ-10 全部採用建議。DQ-11、DQ-12 為 v0.5 新增。各項的選項、決定與寫入的章節見 spec.md 第 16 節。

| 編號 | 問題 | 決定（2026-11-09） | 寫入的設計 | 狀態 |
|---|---|---|---|---|
| DQ-1 | 暫停中、尚未計時時可否「重新開始」 | 可以；新遊玩為尚未開始計時、未暫停 | spec.md 5.5、5.7、4.11；AC-PS-8 | 已關閉 |
| DQ-2 | 背景自動暫停後回前景是否自動繼續 | 維持暫停，由玩家按「繼續」 | spec.md 5.6、5.7、6.4；AC-PS-5；M8 | 已關閉 |
| DQ-3 | 尚無紀錄時是否標示「新紀錄」 | 標示；統籌 agent 已把需求升為 v1.1（RS-4） | spec.md 4.6、4.11；AC-RS-4 補尚無紀錄的正例與反例；M6 | 已關閉 |
| DQ-4 | 紀錄格式不符時整份、逐項或整份＋備份作廢 | (a) 整份作廢；接受下次勝利覆寫整份、其他關卡原資料永久遺失 | spec.md 4.6、9.2、9.3；M6 | 已關閉 |
| DQ-5 | 儲存不可用時是否在選單顯示本次勝利 | 顯示（只存在記憶體），保留「紀錄無法保存」提示 | spec.md 9.3、9.4、10.3；AC-RC-9；M7、M10 | 已關閉 |
| DQ-6 | requirements-spec 沒有版本號 | 產品負責人為 requirements-spec 加變更紀錄（將為 1.1），並把建議修改納入 agent-dev-workflow（將為 1.1）；副本由另一個 PR 同步。同步前填「無版本號」，同步後改填版本號 | spec.md 12.4；review-process.md 第 2 節 | 已關閉；副本同步實際已隨 PR-1 合併（commit 40725e0），兩個 skill 皆為 1.1，過渡規則已結束（v0.5 更新） |
| DQ-7 | 測試如何得知牌面配置（`data-face` 會洩漏答案） | (b)＋(c)：測試記錄亂數、以錨點與正式程式重放；`data-face` 只在實際渲染牌面時存在 | spec.md 4.3、4.5、4.11、第 8 節；acceptance-test-plan.md；M2、M3、M10 | 已關閉 |
| DQ-8 | EQ-2 的啟動例外 | 接受 (1) 初始 commit 直接推送、(2) PR-1 先於保護合併；設計文件隨 PR-1 合併，不發生 (3)；產品負責人在 UAT 紀錄或 release notes 註明 | spec.md 12.6「EQ-2 啟動例外的處理」；verification.md 2.2、2.3；review-process.md 第 5 節 | 已關閉 |
| DQ-9 | EQ-12 無餘裕，GitHub 延遲時如何處理 | `smoke` 失敗重跑一次並記錄；仍逾時記為外部觀察，由產品負責人判定，不改程式 | spec.md 12.5；verification.md 2.4 | 已關閉 |
| DQ-10 | Should 需求本輪範圍與補充驗收 | 全部本輪實作；補充驗收全部啟用，`enforced: true` 與骨架隨 PR-1 | spec.md 第 14、15 節；supplementary-acceptance.json；acceptance-test-plan.md 第 3 節 | 已關閉 |
| DQ-11 | main 上的 review-gate 無法寫入 `review-record` 時如何處理（PR-1b 時的第一次執行、PR-1b 合併後新版的第一次執行，及之後的版本；修正 PR 必然不經它把關） | **採 (d)，以 (a) 為唯一的失敗處理**（2026-11-10 16:06）。原建議 (d) 先開不合併的探測 PR A／B，把第一次執行移到不需合併的 PR；(a) 只限修正它的那一個 PR 接受為啟動例外，作為確實無法寫入時的唯一處理 | spec.md 第 16 節、12.6 步驟 6b、8、8b | 已關閉 |
| DQ-12 | AC-EQ-2「CI 失敗的 PR 合併被拒」以什麼驗證 | **採 (a)＋(b)，都在探測 PR A 上執行**（2026-11-10 16:06）。原選項：(a) 以 `review-record` 失敗驗證（EQ-11 規定審查檢查屬 CI）；(b) 另以 `unit` 失敗驗證。建議：採 DQ-11 (d) 時兩者都在探測 PR 上做，否則 (a) | spec.md 第 16 節、12.6 步驟 8 | 已關閉 |
| DQ-13 | 審查紀錄的偵測形式是否再收緊（v0.5.1 新增） | **待決定。** 選項：(a) 維持 v0.5.1、殘餘風險由審查與抽查補足；(b) 擴大偵測：移除 HTML、跳脫、核取方塊、連結語法後，去除行首所有非字母數字字元與編號；(c) (b)＋標記行以外不得有 HTML。建議 (b)。PR-1b 合併前決定 | spec.md 第 16 節；review-process.md 第 4 節「偵測形式」 | 待決定 |

## 4. 修訂紀錄

### 第 1 輪（v0.1 → v0.2，對應 design-review.md）

| 審查編號 | 處理 | 修改的檔案與章節 |
|---|---|---|
| B-1 | 已處理（採審查建議 1）。選單的難度按鈕、結果畫面（勝利／失敗、數值、重玩、回選單）、遊戲中回選單移入 PR-4；PR-5 只做紀錄。PR 切分表新增「Given／When 所需畫面與操作」欄，並規定測試 agent 不得自行加入捷徑 | spec.md 第 14 節；acceptance-test-plan.md 第 1、2 節 |
| B-2 | 已處理。DA-4 移為 DQ-7（四個選項的影響與成本、建議），標示阻擋 PR-1；DOM 介面中 `data-face`、排列讀取、找同一對等處改為「依 DQ-7 決定」；SVG 一律移除 `aria-label`；寫明 `GameView.cards[].faceId` 只供畫面層在正面朝上時使用 | spec.md 4.5、4.10、4.11、第 7、8、16、17 節；acceptance-test-plan.md 第 2、4 節；cards.md 第 2 節；card-preview.html |
| M-1 | 已處理。I-2 限定 `ready`／`playing`；I-5 與 T-11 一併清除 `firstIndex`；5.7 新增對應組合 | spec.md 5.2、5.4、5.7；module-test-standards.md M5 |
| M-2 | 已處理。新增 `limitReached(t)＝toTenths(t) ≥ 上限×10`，T-11 守衛與 `advance` 一律使用；M5 邊界加入 `limitMs − 0.0004` | spec.md 5.3、5.4、5.7；module-test-standards.md M5 |
| M-3 | 已處理（採選項 a）。狀態列、按鈕、按鈕列、側欄以固定 CSS 寫入規格（含 `line-height: 20px`、`nowrap`）；每個尺寸保留至少 4 px 餘裕並重算（360×640 牌改為 108）；補側欄高度與狀態文字寬度計算；選單高度重算 | spec.md 10.2、10.3；cards.md 第 3 節；card-preview.html 最小尺寸模擬 |
| M-4 | 已處理。新增 `data-shown`（實際渲染內容）與 SVG 的 `data-role`；AC-PS-4 改用之 | spec.md 4.11、10.3；acceptance-test-plan.md #1、#35 |
| M-5 | 已處理。判定改為區間兩端皆在 ±0.2 秒內、區間寬度 ≤ 0.05 秒（否則重量一次）；`test.setTimeout(120_000)`；獨立 `*-realtime` project、單一 worker、在其他測試之後執行 | acceptance-test-plan.md 第 4 節第 5 點、#54；spec.md 第 7 節、12.1、12.3 |
| M-6 | 已處理。禁止在 `run:` 插值事件內容、PR 編號以 `env:` 傳入；review-gate 群組鍵與 `cancel-in-progress: false`；ci／pr-body 群組鍵對 `push` 改用 `github.ref`；review-gate 不 `npm install`、不用快取 | spec.md 12.1、12.4；review-process.md 第 4 節 |
| M-7 | 已處理。新增步驟 0（初始 commit 已直接推送）、6a／6b（`review-record` 於 PR-2 寫入後、合併前加入）；兩個啟動例外列為 DQ-8；AC-EQ-11 改在 PR-2 驗證 | spec.md 12.6、第 14、16 節；verification.md 2.2、2.3、2.5；review-process.md 第 5 節 |
| M-8 | 已處理。新增 R-14（CI 與檢查規則變更）；判定清單改為 R-1～R-14 | review-process.md 第 3、4 節；spec.md 第 13 節 |
| M-9 | 已處理。NFR-5、NFR-7 拆為各自命名的範圍測試；PR-1 的 NFR-7 改為「NFR-7 首頁」 | acceptance-test-plan.md 第 1、2 節；spec.md 12.2 第 7 點、第 14 節 |
| M-10 | 已處理。刪除實作 agent 的端對端 smoke 選項；`unit` job 改用 glob（本機實測：Node.js 22 傳目錄失敗、傳 glob 成功） | module-test-standards.md 第 1 節、M10；spec.md 12.1、12.3 |
| M-11 | 已處理。新增預覽頁到 faces.js 的轉換規則（移除 `id`、`xmlns`，加 `aria-hidden`、`data-role`）；M9 禁止清單改為正規表示式；R-9 改用 `https?://` | cards.md 第 2 節；module-test-standards.md M9；review-process.md R-9 |
| M-12 | 已處理。Should 範圍列為 DQ-10、建議簽核時決定；`enforced` 與骨架必須同一 PR | spec.md 第 15、16 節；acceptance-test-plan.md 第 3 節；supplementary-acceptance.json |
| M-13 | 已處理。設計 skill 升為 1.1（詳見其變更紀錄） | .claude/skills/software-design-phase/SKILL.md |
| P-1 | 已處理。最小尺寸模擬區的 svg 不帶 id | card-preview.html；cards.md 第 2 節 |
| P-2 | 已處理。細節鍵名改為 `lines-horizontal`、`lines-vertical`、`lines-diag-down`、`lines-diag-up`、`grid-straight`、`grid-diagonal` | card-attributes.json；cards.md 第 1 節 |
| P-3 | 已處理。按鈕高 48、按鈕列 56 | spec.md 10.2 |
| P-4 | 已處理。不使用 `viewport-fit=cover`，由瀏覽器避開安全區 | spec.md 10.4 |
| P-5 | 已處理。多位作者以「角色／工作階段」兩行一組重複，解析規則寫明；PR-1 更新 PR 範本 | spec.md 12.4；review-process.md 第 2、4 節 |
| P-6 | 已處理。`smoke` 步驟命名為「AC-EQ-9（部署）與 EQ-12 證據」，註明兩者合起來滿足 AC-EQ-9 | spec.md 12.5；acceptance-test-plan.md #51 |
| P-7 | 已處理。UAT 期間勾選 Lock branch | spec.md 12.6 步驟 9 |
| P-8 | 已處理。略過偵測擴充至全部寫法與略過區塊內的測試 | spec.md 12.2 第 3、5 點；module-test-standards.md M12 |
| P-9 | 已處理（併 M-6） | spec.md 12.1 |
| P-10 | 已處理。本文件第 0 節 | README.md |
| P-11 | 已處理。寫明核對用的正規表示式與結果（68／68、55／55） | module-test-standards.md 3.3；acceptance-test-plan.md 第 2 節 |
| P-12 | 已處理。改寫為通用情境，標示範例 | .claude/skills/software-design-phase/SKILL.md 第 8 節 |
| 未列為待決的事項 1～5 | 已處理：DA-4→DQ-7；EQ-2 啟動例外→DQ-8；EQ-12 無餘裕→DQ-9；DQ-4 補連帶影響與選項；Should 範圍→DQ-10 | spec.md 第 16 節 |
| 對 DQ-3、DQ-6 的意見 | 已處理：DQ-3 改為由統籌 agent 修訂需求；DQ-6 加過渡規則（PR 填「無版本號」、檢查記警告）並在 PR 範本預填 | spec.md 12.4、第 16 節 |
| 其他（審查未列） | spec.md 開頭的「`D-` 編號慣例」與實際不符，改為 T-／I-／DQ-／DA-／R- | spec.md 開頭 |

**回歸檢查（requirements-spec 3.8 與 software-design-phase 第 9 節）：** 修訂後重新檢查 spec.md 5.5、5.6 每一格，以及 5.7 的邊界，結果不變（新增兩列）。另外確認以下各點，沒有發現新矛盾：
- `limitReached` 與勝利判定（T-4 一定在 `advance` 之後，上限已到時不會勝利）、紀錄驗證（`tenths < 上限×10`）、排程喚醒（仍為 `limitMs`）三者一致。
- PR-4 新增的選單與結果畫面，使 AC-LV-7 的「沒有任何紀錄」在無紀錄功能時自然成立；AC-PS-7、AC-TM-5 因需要紀錄顯示，仍留在 PR-5。
- 版面改為 108 px 後，NFR-5 仍成立，第 3 關細節的線寬 5.76 px、間隙 8.64 px 仍高於下限。
- DQ-7 的選項 (b) 依賴 `deal` 的亂數呼叫次數，已寫入 spec.md 4.3 與 module-test-standards.md M3。
- 腳本重新核對：必要編號 55 對 55，Must 追溯 68 對 68，牌面屬性表 LV-2～4 成立。

### 第 2 輪（v0.2 → v0.3，對應 design-review.md「回歸審查（第 2 輪）」）

| 審查編號 | 處理 | 修改的檔案與章節 |
|---|---|---|
| N-1 | 已處理。改為「不得輸出為可見圖像或可朗讀名稱；是否以 `data-face` 屬性輸出依 DQ-7 決定」，不再排除選項 (a) | spec.md 4.5 |
| N-2 | 已處理。PR-4 加入選單頁尾的版本號元素、需求欄加 EQ-9、驗收欄註明須維持 AC-EQ-9 與「NFR-7 首頁」；切分規則補「已實測的驗收在後續 PR 仍須成立」 | spec.md 第 14 節；skill 第 6 節 |
| N-3 | 已處理。刪除區間寬度上限，改為診斷輸出；建議以座標點擊與單一 evaluate 縮短區間 | acceptance-test-plan.md 第 4 節第 5 點；skill 第 4、8 節 |
| N-4 | 已處理。改為「顯示值達到上限之前（`limitReached` 尚未成立）配對即為勝利」 | spec.md 6.3 |
| N-5 | 已處理。DQ-7 選項 (b) 寫明記錄 `getRandomValues` 全部輸出，以 `random.js`＋假 `cryptoObj` 與 `deal.js` 重放，不假設固定個數 | spec.md 第 16 節 DQ-7 |
| N-6 | 已處理。步驟 6b 完成前審查 agent 不留 PR-2 的審查紀錄 | spec.md 12.6 步驟 6b |
| N-7 | 已處理。PR-1 以 `design/initial` 為基礎、設計文件不單獨合併；DQ-8 加入例外 (3) | spec.md 第 14 節 PR-1、第 16 節 DQ-8 |
| N-8 | 已處理。第 4 節改為通用說法、4 px 標為範例；skill 升為 1.2 | .claude/skills/software-design-phase/SKILL.md 第 4、6、8、9、11 節 |
| N-9 | 已處理。`records.js` 由 PR-2 移到 PR-5；9.2、9.3、`parseRecords` 介面、DQ-4、M6 都改為「依 DQ-4 決定」，刪除「未決定前依字面 (a) 設計」 | spec.md 4.6、9.2、9.3、第 14、16 節；module-test-standards.md M6 |
| N-10 | 已處理。發現情境改為「PS-5、PS-8、RS-4、RS-5、RC-9、EQ-10 標為設計階段補；NFR-4 為 Should 的非功能需求」 | spec.md 第 16 節 DQ-10 |

**回歸檢查：** `records.js` 移到 PR-5 後，PR-2 的驗收（AC-GP-2 統計、AC-LV-5）不依賴它。PR-5 的驗收原本就在 PR-5。PR-4 保留版本號後，AC-EQ-9 與「NFR-7 首頁」在 PR-4 之後仍可執行。6.3 與 5.3、T-4、T-11 的描述一致。DQ-7 的四個選項都沒有在規格中被預先排除或採用。腳本重新核對：必要編號 55 對 55、Must 追溯 68 對 68。

### 第 3 輪（v0.3 → v0.4，對應產品負責人 2026-11-09 16:02 的決定）

| 決定 | 處理 | 修改的檔案與章節 |
|---|---|---|
| DQ-1 | 「重新開始」在任何進行中狀態可用；暫停中與尚未開始計時時的結果寫入狀態表與邊界表；AC-PS-8 補兩種情況與「舊鎖定／標示不作用於新遊玩」 | spec.md 4.11、5.5、5.7、第 15 節；module-test-standards.md M10；acceptance-test-plan.md 第 3 節 |
| DQ-2 | 背景自動暫停、回前景維持暫停；`visibility.js` 不提供回前景回呼；AC-PS-5 補「回前景 3 秒仍暫停」與選單反例 | spec.md 5.6、5.7、6.4、第 15 節；module-test-standards.md M8 |
| DQ-3 | `newBestTime`／`newFewestMoves` 改為「該項被取代時」；AC-RS-4 補尚無紀錄的正例（無紀錄關卡、單項為空、整份作廢後）與反例（他關無紀錄、第二次勝利） | spec.md 4.6、4.11、第 15 節；module-test-standards.md M6；acceptance-test-plan.md 第 3 節 |
| DQ-4 | 整份作廢寫入 9.2（含「只有一項不符也整份作廢」與覆寫的連帶影響），9.3 合併基礎為 `emptyRecords()` | spec.md 4.6、9.2、9.3、PR-5；module-test-standards.md M6 |
| DQ-5 | 「儲存不可用」狀態：記憶體紀錄的初值、合併、顯示、清除；勝利時寫入失敗即轉入此狀態 | spec.md 9.3、9.4、10.3；module-test-standards.md M7、M10；AC-RC-9 |
| DQ-6 | 過渡規則寫明結束事件（副本同步 PR 合併）、結束後的行為（填版本號，「無版本號」即失敗）與 PR 範本的處理 | spec.md 12.4；review-process.md 第 2 節；本文件第 0 節 |
| DQ-7 | `data-face` 只在 `data-shown=face` 時存在；第 8 節新增「端對端測試取得牌面配置」（記錄、錨點、以正式程式重放、以 `data-face` 驗證、不洩漏反例）；4.3 寫明亂數呼叫契約 | spec.md 4.3、4.5、4.11、第 7、8 節；acceptance-test-plan.md #1、#2、#4、#35、第 4 節；module-test-standards.md M2、M3、M9、M10；cards.md 第 2 節 |
| DQ-8 | 12.6 新增「EQ-2 啟動例外的處理」：只接受兩項、不單獨合併設計文件、PR-1 合併前的人工確認、建議註明文字 | spec.md 12.6；verification.md 2.2、2.3；review-process.md 第 5 節 |
| DQ-9 | 12.5 新增「smoke 失敗與 EQ-12 逾時的處理」 | spec.md 12.5；verification.md 2.4、第 3 節 |
| DQ-10 | 6 個補充驗收 `enforced: true`、隨 PR-1 生效；PR-4 加入 NFR-4；PR-6 寫明內容、驗收與須維持的已實測驗收；10.2、10.3 寫明按鈕數變化與結果畫面高度 | spec.md 10.2、10.3、第 14、15 節；supplementary-acceptance.json；acceptance-test-plan.md 第 3 節 |
| 需求 v1.1 | 全部設計文件的依據改為需求文件 v1.1 | 各文件表頭 |
| 修訂中發現 | 端對端配置輔助原寫在 PR-1，但它引用 PR-2 才有的 `random.js`、`deal.js`，改到 PR-4 | spec.md 第 14 節 |

**回歸檢查（requirements-spec 3.8 與 software-design-phase 第 9 節、3.4.1）：**

- **標示：** 以 `grep "依 DQ"` 搜尋 docs/design/（design-review.md 除外），只剩變更紀錄與修訂紀錄中的歷史描述。
- **狀態表：** 重新逐格檢查 spec.md 5.5（「重新開始」欄六列）、5.6（背景列）與 5.7（新增 5 列），與需求 6.9 的對照不變；S0 與暫停中「重新開始」只走 T-14＋新 `game`，沒有新的狀態轉移，I-1～I-5 不受影響。
- **決定之間的交互：** DQ-4×DQ-3：整份作廢後第一次勝利兩項都標示「新紀錄」並覆寫整份，與 AC-RC-8「新紀錄正常保存並顯示」一致。DQ-5×DQ-3：儲存不可用時以記憶體紀錄判定標示，與選單一致。DQ-5×DQ-4：不可用時只在載入時讀一次，格式不符則記憶體初值為空。DQ-1×DQ-7：「重新開始」屬於開始遊玩的操作，測試在點擊前取錨點。DQ-1×DQ-2：背景自動暫停後按「重新開始」，新遊玩未暫停（玩家的明確操作）。DQ-7×AC-LV-9：`data-face` 是屬性，不出現在 `innerText`。DQ-7×NFR-7：亂數記錄只在測試注入的頁面記憶體中，沒有網路請求。DQ-10×DQ-8：PR-1 不受分支保護把關，但其 CI 的 `acceptance-ids` 仍會以 61 個編號執行。
- **與 Must 驗收的關係：** AC-RC-3「30.04 秒不標示新紀錄」與 RS-4 v1.1 一致（相等不取代、不標示）。AC-GP-1、AC-PS-4 補上不洩漏檢查，沒有放寬原驗收。AC-RC-8 在整份作廢下成立。
- **PR 切分：** PR-6 的 Given／When 所需畫面（遊戲、暫停、紀錄）在 PR-4、PR-5 已存在；PR-6 加入第 4 個按鈕與「挑戰下一個難度」後，NFR-3、NFR-4、NFR-5 遊戲畫面與結果畫面仍成立（10.2：80×48；10.3：結果畫面 316 ≤ 636、選單含提示 540 ≤ 636）。配置輔助移到 PR-4 後，PR-1 不再引用不存在的模組。
- **腳本重新核對（對需求文件 v1.1）：** 必要編號 55 對 55（51 個含「自動」的驗收＋NFR-3、5、6、7），缺 0、多 0；Must 追溯 68 對 68，缺 0、多 0；`supplementary-acceptance.json` 6 項皆 `enforced: true`。

### 第 4 輪（v0.4 → v0.5，對應 PR-1 審查紀錄與實作、測試 agent 回報）

| 來源 | 處理 | 修改的檔案與章節 |
|---|---|---|
| 掃描範圍含 `tests/unit/`（PR-1 說明已知問題 2、審查 N-2） | 採計覆蓋的範圍限定為 `tests/acceptance/`；單元測試名稱含必要編號即失敗（兩者並用）；驗收測試檔位置限定；`--no-skip` 對 `tests/unit/` 的略過檢查維持 | spec.md 12.2 第 3～5、10 點；module-test-standards.md 第 1 節、M12；acceptance-test-plan.md 第 1 節、#50；review-process.md R-6、R-14 |
| 略過偵測不完整（PR-1 說明已知問題 1、審查 N-2） | 驗收測試只允許骨架宣告；其他寫法（本體內 `test.skip()`／`test.fixme()`／`test.fail()`／`t.skip()`、條件略過、`annotation`、`expectFailure`、計算屬性、`.only`）由靜態檢查一律判定失敗；寫明靜態偵測的界限；新增 12.2.1 以執行結果判定略過、預期失敗與沒有執行（本機實測兩種執行器的結果格式），PR-1b 啟用、PR-7 加 `--no-skip` | spec.md 12.1、12.2 第 8、9 點、12.2.1、12.3、第 3、14 節；verification.md 2.6；module-test-standards.md M12；acceptance-test-plan.md 第 1、4 節 |
| N-1（重複 R 列、大小寫） | 同一 R 編號重複時整則無效；結果欄只接受三值，「不適用」須有說明；任一列不通過即失敗；工作階段識別去除空白、NFKC、小寫後比對，建議一律小寫 | review-process.md 第 2、4 節；spec.md 第 13 節；module-test-standards.md M12 |
| N-6、已知問題 3（e2e 未傳 `BUILD_SHA`） | 判斷需要修正：測試步驟沒有 `BUILD_SHA` 時，CI 中沒有任何檢查確認受測建置顯示 PR head。改為 job 層級 `env`；AC-EQ-9 在 CI 缺少 `BUILD_SHA` 即失敗 | spec.md 第 11 節、12.1；acceptance-test-plan.md #51 |
| N-3（同步 PR 描述過時） | 改為副本已隨 PR-1 合併（commit 40725e0）、過渡規則已結束 | spec.md 12.4、DQ-6 註記；review-process.md 第 2 節；本文件第 3 節 DQ-6 |
| N-6、已知問題 4（第 3 節表頭重複） | 刪除重複的表頭列 | acceptance-test-plan.md 第 3 節 |
| N-4(a)（作者段落） | 多角色 PR 列出每個角色的工作階段；R-1 檢查 | spec.md 12.4；review-process.md 第 1 節、R-1 |
| agent-dev-workflow 1.1 第 4.3 節 | 新增 PR-1b；6b 與步驟 8（AC-EQ-11、AC-EQ-2 合併被拒）改到 PR-1b；記錄 6a 已完成（API 讀取）；確認 review-gate 在 main、PR-1b 會觸發；寫明 PR-1b 由舊版 review-gate 判定與人工確認；新增 DQ-11、DQ-12 | spec.md 12.6、第 14、16 節；review-process.md 第 5 節；verification.md 2.3、2.5、2.6 |
| 不屬設計範圍（未修改） | N-4(b) workflow.md 狀態欄、N-4(c) 需求文件日期、N-5 PR 說明的 skill 列：屬統籌 agent 與產品負責人維護的文件或 PR 說明 | — |

**回歸檢查（requirements-spec 3.8、6.2 與 software-design-phase 第 9 節、3.4.1）：**

- **產品行為：** 本輪只改 CI、檢查腳本、審查流程與 PR 順序，沒有改動狀態機、畫面、DOM 測試介面或儲存格式；spec.md 第 4～10 節、5.5、5.6、5.7 逐格不受影響。
- **驗收沒有放寬：** 採計範圍限定只排除單元測試，驗收測試目錄完整掃描；`--no-skip` 對 `tests/unit/` 維持；新增的靜態規則與執行結果檢查只增加失敗條件；AC-EQ-9 由「CI 只檢查格式」改為「CI 必須比對 commit」。R-14 的「縮小掃描範圍」已註明本次調整不屬於放寬。
- **既有骨架與規則的相容性：** 以 `grep` 確認 `tests/acceptance/` 現有 77 個測試呼叫皆為 `test(`（10 個）或最上層 `test.skip(名稱, 函式)`（67 個），符合唯一允許的骨架寫法；`tests/unit/` 的測試名稱只含非必要編號（`NFR-1`、虛構的 `AC-ZZ-*`），不觸發第 5 點。AC-EQ-4 測試中「略過寫法可通過編號檢查」的案例需由測試 agent 依 v0.5 改寫（非骨架寫法改為失敗），這是設計變更造成的驗收測試修改，理由與編號寫在 PR-1b。
- **審查判定與既有紀錄：** PR-1 的審查紀錄（每列一次、結果皆為「通過」或「不適用」且附說明、工作階段皆小寫）在 v0.5 的重複、結果值與大小寫規則下仍判定 success。（第 5 輪補充：以第 3 輪的白名單再檢查，該紀錄沒有不可見字元、三個欄位各一行、只有一個表格且每列為 `R-<數字>`；只因缺少 v0.5 新增的 R-15 而不符合現行格式，這是清單擴充的預期結果，不影響已合併的 PR-1。）
- **PR 切分：** PR-1b 不需要新畫面；AC-EQ-11 的 Given 由 PR-1b 本身提供，前提（review-gate 在 main、6b 完成）已確認或排入程序；PR-2～PR-7 的內容與 Given／When 不變，PR-7 的 `--no-skip` 擴及執行結果檢查。job 名稱不變，6a 的必要檢查不需重設。
- **決定之間的交互：** DQ-8（只接受兩個啟動例外）× v0.5（6b 移到 PR-1b）：沒有新增例外，除非 DQ-11 的失敗情況發生；DQ-10（61 個編號）× 掃描範圍限定：61 個編號的骨架都在 `tests/acceptance/`，數量不變；DQ-7（配置輔助在 `tests/support/`）× 檔案位置規則：`tests/support/` 不是測試檔，不受影響。
- **標示：** 以 `grep -rnE "依 DQ-[0-9]+ ?決定" docs/design/`（design-review.md 除外）確認只剩修訂紀錄與變更紀錄中的歷史描述；DQ-11、DQ-12 的引用都指向待決定的項目（spec.md 12.6、第 16 節；本文件第 2、3 節）；以 `grep -rn "另一個同步 PR\|另一個 PR\|PR-2 寫入\|在 PR-2 驗證" docs/design/` 確認只剩變更紀錄、修訂紀錄與 DQ 原始問題的歷史描述。
- **腳本重新核對（需求文件 v1.1）：** 必要編號 55 對 55，Must 追溯 68 對 68；`supplementary-acceptance.json` 6 項皆 `enforced: true`。

### 第 5 輪（v0.5 同一版本內，對應 design-review.md「設計審查（第 3 輪，v0.5）」，commit f4ab877）

| 審查編號 | 處理 | 修改的檔案與章節 |
|---|---|---|
| M-1 | 已處理。可機械檢查的部分：骨架本體必須為空（12.2 第 8 點）；非骨架測試至少一個 `expect…`／`assert…` 呼叫（靜態，12.2 第 9a 點）；執行時每個通過的測試至少執行一個斷言、沒有被吞掉的失敗斷言（12.2.1 第 6 項：Playwright 以自訂 reporter 計數 `expect` 步驟；node:test 以 `tests/support/assertions.mjs` 的 hook＋`t.diagnostic` 回報，12.2 第 9c 點強制匯入；兩者都已本機實測）。只能靠審查的部分（空洞斷言、只驗部分 Then、部分斷言後 `return`、測試改寫檢查檔案）寫成「殘餘風險」，新增審查清單 R-15（逐測試檢查＋審查者重做至少一個變異檢查；PR-7 逐一確認 61 個編號）；寫明不採用自動化變異測試的理由。條件略過的說明限定為「以略過 API 處理時」 | spec.md 12.2 第 8、9a、9c、11 點、12.2.1、第 13 節；review-process.md R-15、第 5 節；acceptance-test-plan.md 第 1 節、#50、第 4 節；module-test-standards.md 第 1 節、M12；verification.md 2.6 |
| M-2 | 已處理。審查紀錄改為白名單：不可見字元、三個欄位各恰好一行、只有一個表格、R 列第一格逐字 `R-<數字>`、R-1～R-15 各一列且無清單以外的項目、結果三值、看似 R 列卻不符格式的列與結果寫錯欄都整則無效；最後一則無效時不退回較早紀錄；「針對 commit」重複時仍視為候選；作者與審查者識別正規化後須符合 `^[a-z0-9-]+$`（pr-body 也檢查） | review-process.md 第 2 節、第 4 節第 3～5 步；spec.md 12.4、第 13 節；module-test-standards.md M12 |
| M-3 | 已處理。(1) PR-1b 合併前以新版 `review-gate.mjs --dry-run` 試算（只讀）並補完整的人工確認清單 (i)～(vi)；(2) DQ-11 範圍改為「main 上的 review-gate 無法寫入狀態時修正它的那一個 PR」，新增選項 (d) 探測 PR，建議改為 (d)＋(a)；DQ-12 建議依 DQ-11 調整；(3) 新增步驟 8b：PR-1b 合併後第一個 PR 以新版重新觀察 AC-EQ-11，之後每次 review-gate 變更都重做；6b、8 以「驗證 PR」描述 | spec.md 12.6、第 14、16 節；review-process.md 第 4、5 節；本文件第 2、3 節 |
| M-4 | 已處理。skill 升為 1.5：第 6 節新增「有執行不等於有驗證」；5.3 改為白名單並限定識別碼字元集；5.2 一列補新版試算、合併後重新觀察、探測 PR；第 9 節刪除矛盾項並新增、修改檢查項 | .claude/skills/software-design-phase/SKILL.md |
| P-1 | 已處理。DQ-11、DQ-12 併入表格，DQ-12 與 `---` 之間加空行 | spec.md 第 16 節 |
| P-2 | 已處理。同一檔案「外層路徑＋名稱」不得重複 | spec.md 12.2 第 9b 點；module-test-standards.md M12 |
| P-3 | 已處理。第 4 點涵蓋任何副檔名；一般 project 的 `testMatch` 限定 `*.spec.mjs`；第 8 點寫明只掃描測試檔、輔助模組由 12.2.1 涵蓋 | spec.md 12.2 第 4、8 點、12.3 |
| P-4 | 已處理。殘餘風險加入「測試改寫同一 job 中的檢查檔案」；R-14 檢查方式補「驗收測試與 `tests/support/` 沒有寫入檢查會讀取的檔案」 | spec.md 12.2.1；review-process.md R-14 |
| P-5 | 已處理。M12 單元測試欄補列新腳本；本文件第 3 節重複句合併；spec.md 第 16 節多餘空格刪除 | module-test-standards.md M12；本文件第 3 節；spec.md 第 16 節 |
| P-6 | 已處理。改為「『不允許略過』模式以靜態清單偵測…」 | .claude/skills/software-design-phase/SKILL.md 第 8 節 |

**回歸檢查（requirements-spec 3.8、6.2 與 software-design-phase 第 9 節）：**

- **產品行為：** 仍只改 CI、檢查腳本、測試輔助與審查流程，spec.md 第 4～10 節不受影響。
- **沒有放寬：** 新增的都是失敗條件（骨架本體、斷言呼叫、斷言計數、名稱重複、副檔名範圍、白名單格式、識別碼字元集）；12.3 的 `testMatch` 只把一般 project 限定到 12.2 第 4 點允許的檔案，第 4 點同時讓其他副檔名的測試檔失敗，所以不會有驗收測試因此被靜默排除。
- **既有測試的相容性：** 67 個骨架本體都是 `() => {}` 或 `async () => {}`（以 `grep` 核對 `test.skip('…', (async )?() => {});` 涵蓋全部 67 個），符合第 8 點；10 個實際測試中，無瀏覽器層（`acceptance-ids.test.mjs`）須在 PR-1b 改由 `tests/support/assertions.mjs` 匯入 `assert`，端對端層（版本號、NFR-7 首頁）已使用 `expect`。這些修改屬設計變更造成的測試調整，已列入 PR-1b 的測試 agent 工作。
- **審查清單擴為 R-1～R-15 的交互：** PR-1b 由舊版 review-gate（只要求 R-1～R-14）判定，多一列 R-15 不影響舊版；新版要求 R-15，PR-1b 的審查紀錄依 v0.5 第 2 節撰寫（含 R-15），所以 `--dry-run` 試算與人工確認清單 (i) 都要求 R-15。
- **DQ-11 (d) × 6b × 步驟 8／8b：** 採 (d) 時，6b 在探測 PR A 完成，PR-1b 開啟即受把關，步驟 8 (4) 的 PR-1b 分支改為「依一般流程審查＋試算＋確認清單」；不採 (d) 時程序與第 4 輪相同。兩種情況下 PR-1b 都不會在沒有 `review-record` 必要檢查時合併。
- **腳本重新核對：** 必要編號 55 對 55，Must 追溯 68 對 68；`supplementary-acceptance.json` 6 項皆 `enforced: true`；`grep -rnE "依 DQ-[0-9]+ ?決定"` 只剩歷史紀錄；`grep -rn "R-1～R-14"` 只剩變更紀錄與修訂紀錄。

### 第 6 輪（v0.5 → v0.5.1，簽核後釐清；對應實作 agent 依 agent-dev-workflow 5.1 的回報）

| 回報 | 判定 | 處理 | 修改的檔案與章節 |
|---|---|---|---|
| 1. 白名單的欄位偵測只去除空白，偵測不到合法的 `- 結果：`；實作另去除行首清單、引用、標題符號 | **設計錯誤**；實作的做法正確並採用，不開新繞過 | v0.5 的偵測形式為 `-結果:…`，不以「結果:」開頭，依字面實作每則紀錄都無效。新增「偵測形式」：NFKC、去除強調符號與空白、去除行首引用 `>`、清單 `-` `+`、有序清單 `<數字>.` `<數字>)`、標題 `#`，合法與否仍以原文逐字比對；表格列偵測也去除行首引用符號。以 PR-1b 的 `validateRecord` 實測 20 種寫法：把 `CHANGES_REQUESTED` 或含「不通過」的表格藏在引用區塊、標題、有序清單、縮排中都判為無效（擴大偵測只增加無效）；NFKC 不轉換的項目符號、工作清單、HTML、跳脫、中文編號、連結、清單開頭的表格列、HTML 表格仍判為有效，這些在 v0.5 字面規則下同樣不被偵測，列為殘餘風險與 **DQ-13** | review-process.md 第 2 節、第 4 節「偵測形式」、第 3 步、第 5 步第 1 項；spec.md 第 13、16 節；module-test-standards.md M12 |
| 2. `evaluateResults` 需要 `requiredIds` 與 `staticFiles` | **設計遺漏**；實作正確並採用 | 簽名改為 `evaluateResults({ layer, staticTests, staticFiles, results, errors, noSkip, requiredIds })`，寫明每個輸入對應的判定項目；實作另有的 `errors`（Playwright 全域錯誤即失敗）寫為第 7 項，只增加失敗條件；`review-gate` 的 `evaluate` 簽名同樣補上實作已有的 `prUrl` | spec.md 12.2.1；review-process.md 第 4 節 |
| 3. 結果檔位置、結束標記、`ACCEPTANCE_RESULTS_FILE`、`--dry-run` 在 PR 已關閉時仍試算 | **設計遺漏**；實作正確並採用 | 新增 12.2.1「結果檔的交接」：`acceptance-results/{unit,e2e,e2e-realtime}.jsonl`（不在 Playwright 會清空的 `test-results/`、不提交）、結束標記 `{"type":"end","count":n}`（缺少或不符以結束代碼 2 失敗，分辨中途中止）、`onBegin` 先清空、兩次執行以 `ACCEPTANCE_RESULTS_FILE` 指定（缺少時檢查步驟讀不到檔案而失敗）；12.1 寫出檔名。`--dry-run` 不寫入，對已關閉 PR 試算沒有副作用，可事後核對探測 PR 與 PR-1b；權杖可省略 | spec.md 12.1、12.2.1；review-process.md 第 4 節 |
| 4. 第 9c 點是否豁免只有骨架的檔案 | **不豁免**；設計原意（「測試檔必須」「一律」），寫得不夠明確；實作正確 | 豁免與不豁免的嚴格程度相同（檔案一有非骨架測試即適用，執行時第 6 項也判定），選不需例外的規則；寫明理由。測試 agent 須在 PR-1b 為 3 個只含骨架的檔案加匯入並建立 `tests/support/assertions.mjs` | spec.md 12.2 第 9c 點；acceptance-test-plan.md 第 4 節第 9 點 |
| 修訂中發現 | 文書錯誤 | v0.5 簽核 commit（3a1687f）後 spec.md 表頭仍寫「v0.5 待產品負責人簽核」、第 16 節標題與說明仍寫 DQ-11、DQ-12「待決定」；其他文件表頭仍寫「v0.5 待簽核」。改為已簽核 | spec.md 表頭、開頭說明、第 16 節；module-test-standards.md、review-process.md、acceptance-test-plan.md 表頭 |
| skill | agent-dev-workflow 7.3：4 項在其他專案也可能發生，skill 沒有提醒 | software-design-phase 升為 1.6 | .claude/skills/software-design-phase/SKILL.md 第 4、5.3、6、8、9、11 節 |

**回歸檢查（software-design-phase 第 9 節，含 1.6 新增的 4 項）：**

- **產品行為：** 只改 CI 檢查與審查判定的描述，spec.md 第 4～10 節與狀態表不受影響。
- **沒有放寬：** 偵測形式只增加被算進的行；第 7 項與結束標記只增加失敗條件；第 9c 點維持不豁免；`--dry-run` 不寫入任何狀態。R-14 的檢查範圍不變。
- **已簽核行為的變更：** 收緊偵測形式至 (b)、(c) 會改變合法紀錄的範圍與 review-gate 程式，列為 DQ-13，不在 v0.5.1 決定。
- **合法範本逐行驗證（1.6 新增）：** 以 review-process.md 第 2 節範本（補齊 R-1～R-15）跑 PR-1b 的 `validateRecord`：三個欄位行各偵測一次、判定有效；20 種變體的結果寫在第 6 輪第 1 列與 review-process.md 第 4 節。
- **純函式簽名對照規則（1.6 新增）：** `evaluateResults` 第 1～7 項、`evaluate` 第 2～7 步所需的輸入都在簽名中。
- **與 DQ-11、DQ-12 的交互：** v0.5.1 不改 review-gate 程式，PR-1b 的新版試算與步驟 8b 範圍不變；DQ-13 若採 (b)／(c) 在 PR-1b 實作，仍由同一次試算與步驟 8b 涵蓋。
- **既有紀錄：** PR-1 的審查紀錄（欄位行為 `- 結果：`、`- 針對 commit：`、`- 審查者：`）在偵測形式下各偵測一次，結論與第 4 輪補充相同（只因缺 R-15 不符現行格式）。
- **標示：** DQ-13 只影響 review-gate 的偵測形式；review-process.md 第 4 節「偵測形式」寫明「決定前維持本段規則，不實作任何收緊選項」，沒有其他章節先選一個選項。`grep -rn "待產品負責人簽核\|DQ-11、DQ-12 待決定" docs/design/`（design-review.md 除外）只剩變更紀錄與修訂紀錄中的歷史描述。

## 5. 簽核紀錄（AC-EQ-6）

| 日期 | 簽核者 | 簽核的版本 | 待決問題的決定 | 備註 |
|---|---|---|---|---|
| 2026-11-09 16:12（Asia/Taipei） | 產品負責人 | 設計文件 v0.4（commit dfca62f）；需求文件 v1.1 | DQ-1～DQ-10 全部採用建議（2026-11-09 16:02） | 產品負責人於對話中回覆「簽核設計」，由統籌 agent 代為記錄 |
| 2026-11-10 16:06（Asia/Taipei） | 產品負責人 | 設計文件 v0.5（branch `pr-1b/pre-pr2-fixes`，commit 951e154，含設計審查第 3 輪修訂）；需求文件 v1.1 | DQ-11 採 (d)，以 (a) 為確實無法寫入狀態時的唯一處理；DQ-12 採 (a)＋(b)，都在探測 PR 上執行 | 產品負責人於對話中回覆「簽核設計 v0.5。DQ-11、DQ-12 採用建議」，由統籌 agent 代為記錄。PR-1b 的實作與測試 commit 須在本列之後 |
| v0.5.1 待產品負責人確認 | 產品負責人 | 設計文件 v0.5.1（branch `pr-1b/pre-pr2-fixes`，v0.5 簽核後釐清；本列之前的 commit）；需求文件 v1.1 | DQ-13 待決定 | 簽核後釐清：判定與處理見第 4 節第 6 輪；確認事項見第 2 節。確認前，PR-1b 依 v0.5 已簽核的內容與第 2 節的工作清單繼續，不實作 DQ-13 的 (b)、(c) |

簽核日期必須早於第一個實作 PR 的建立日期。

## 6. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | 依設計審查修訂全部設計文件；新增上工檢查、待決問題摘要、修訂紀錄 | design-review.md |
| 0.3 | 2026-11-04 | 依第 2 輪回歸審查修訂 spec.md、acceptance-test-plan.md、module-test-standards.md、設計 skill；新增第 2 輪修訂紀錄 | design-review.md 回歸審查（第 2 輪） |
| 0.4 | 2026-11-09 | 依 DQ-1～DQ-10 的決定修訂 spec.md、acceptance-test-plan.md、module-test-standards.md、review-process.md、verification.md、cards.md、supplementary-acceptance.json；第 3 節改為已關閉；需求依據改為 v1.1；新增第 3 輪修訂紀錄；設計 skill 升為 1.3。簽核欄維持待簽核 | 產品負責人 2026-11-09 16:02 的決定；需求文件 v1.1 |
| 0.5 | 2026-11-09 | 依 PR-1 審查紀錄與實作、測試 agent 回報修訂 spec.md、review-process.md、acceptance-test-plan.md、module-test-standards.md、verification.md；新增 PR-1b、DQ-11、DQ-12；第 0 節改為 v0.5 的上工檢查；第 2、3 節加入 v0.5 待決定事項；新增第 4 輪修訂紀錄；第 5 節新增「v0.5 待簽核」一列（v0.4 簽核紀錄不變）；設計 skill 升為 1.4 | PR-1 審查紀錄 N-1～N-6；實作與測試 agent 回報；agent-dev-workflow 1.1 第 4.3 節 |
| 0.5（第 3 輪審查修訂） | 2026-11-09 | 同一版本內依設計審查第 3 輪修訂 spec.md、review-process.md、acceptance-test-plan.md、module-test-standards.md、verification.md；新增第 5 輪修訂紀錄；第 2、3 節更新 DQ-11、DQ-12；第 0 節 skill 版本改為 1.5；簽核欄維持「v0.5 待簽核」 | design-review.md 設計審查第 3 輪 M-1～M-4、P-1～P-6 |
| 0.5（簽核） | 2026-11-10 | 記錄產品負責人簽核 v0.5 與 DQ-11、DQ-12 的決定；第 3 節改為全部關閉 | 產品負責人於對話中決定，統籌 agent 代為記錄（同 v0.4 的做法） |
| 0.5.1（簽核後釐清） | 2026-11-10 | 第 0 節新增 v0.5.1 上工檢查；第 1 節更新版本；第 2 節新增 v0.5.1 確認事項與工作清單；第 3 節新增 DQ-13；新增第 6 輪修訂紀錄；第 5 節新增「v0.5.1 待產品負責人確認」一列（既有簽核列不變）；設計 skill 升為 1.6 | 實作 agent 依 agent-dev-workflow 5.1 回報的 4 項設計問題 |
