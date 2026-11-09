# 設計文件（M2）

| 項目 | 內容 |
|---|---|
| 版本 | 0.4（依產品負責人對 DQ-1～DQ-10 的決定修訂） |
| 日期 | 2026-11-09 |
| 狀態 | 已簽核（2026-11-09 16:12，產品負責人，見第 5 節）。待決問題 DQ-1～DQ-10 已全部關閉 |
| 依據 | docs/requirements.md v1.1（已簽核）；docs/workflow.md v0.1；docs/design/design-review.md（設計審查紀錄）；產品負責人 2026-11-09 16:02 對 DQ-1～DQ-10 的決定 |
| 撰寫 | 設計 agent（agent-dev-workflow 第 3 節「設計 agent」） |

## 0. 上工檢查與已載入 skill（workflow.md 第 4.4 節）

**上工檢查（agent-dev-workflow 第 1 節）：**

- [x] 角色：設計 agent。負責規格書、模組劃分、模組測試標準與其他設計產出；不撰寫正式程式碼、不自行決定需求沒寫的行為、不修改需求文件與產品負責人維護的 skill。
- [x] 階段：階段 2 設計（M2）；離開條件為產品負責人簽核（EQ-6）。
- [x] 輸入：需求文件 v1.1 已簽核（2026-11-09 16:02，RS-4 依 DQ-3 修訂；commit 10e44a3）；workflow.md v0.1；設計審查紀錄 design-review.md；產品負責人對 DQ-1～DQ-10 的決定（v0.4 修訂的輸入）。
- [x] 已讀需求文件全文。
- [x] 已讀 workflow.md，知道 W-1～W-3 與第 4～6 節的調整。
- [x] 已載入本階段 skill：agent-dev-workflow、requirements-spec（第 3.8 節）、software-design-phase。

**已載入 skill 的變更紀錄最新版本號：**

| skill | 版本 |
|---|---|
| agent-dev-workflow | 1.0（版本庫副本；產品負責人將納入建議修改成為 1.1，副本由另一個 PR 同步，同步後改填版本號） |
| requirements-spec | 無版本號（版本庫副本尚無變更紀錄；產品負責人將加上變更紀錄成為 1.1，同步後改填版本號，DQ-6） |
| software-design-phase | 1.3（本次修訂） |

## 1. 文件清單

| 檔案 | 版本 | 內容 |
|---|---|---|
| verification.md | 0.4 | Q4（開發工具授權）、Q6（GitHub Actions／Pages、分支保護、EQ-11 可行性、部署延遲）查證紀錄，附官方網址 |
| spec.md | 0.4 | 軟體規格書：架構、檔案結構、模組介面、狀態機、計時、時鐘抽象、隨機排列、紀錄儲存、畫面與版面計算、版本號、CI／CD、PR 切分、Should 需求建議、待決問題、假設 |
| module-test-standards.md | 0.4 | 各模組測試標準、單元測試與驗收測試分界、Must 需求追溯（以腳本核對） |
| acceptance-test-plan.md | 0.4 | 驗收測試骨架計畫（55 個必要編號＋6 個已啟用的補充驗收、層次、轉實測的 PR、撰寫注意事項） |
| review-process.md | 0.4 | 審查紀錄格式、審查清單 R-1～R-14、審查檢查判定規則與工作流程安全設定 |
| supplementary-acceptance.json | 0.4 | Should 需求的設計補充驗收編號（DQ-10 決定全部啟用，`enforced: true`，隨 PR-1 生效） |
| cards.md | 0.4 | 牌面屬性表、繪製與轉換規則、第 3 關可分辨性的依據 |
| card-attributes.json | schemaVersion 1（內容 v0.2：細節鍵名改為方向文字） | 機器可讀牌面屬性表（AC-LV-2～4 讀取） |
| card-preview.html | v0.2 | 19 張原創內嵌 SVG 預覽頁（不載入外部資源；無重複 id；SVG 不帶可及性名稱） |
| card-preview.png、card-preview-min-size.png、card-preview-360.png | v0.2 | 預覽頁截圖（本機 Chromium；最小尺寸模擬為 108×108） |
| design-review.md | — | 設計審查紀錄（審查 agent 撰寫，設計 agent 不修改） |

可重用設計 skill：`.claude/skills/software-design-phase/SKILL.md`（1.3）。

版本號說明：v0.4 起設計文件組的受影響文件統一為 0.4（verification.md、review-process.md、cards.md、supplementary-acceptance.json 由 0.2 直接升為 0.4）。card-attributes.json、card-preview.html 與截圖內容未變更，維持 v0.2。

## 2. 需要產品負責人決定的事項

1. 簽核本設計（EQ-6），在第 5 節留下日期與版本。
2. 關閉 Q4、Q6（verification.md 第 3 節）。
3. 待決問題 DQ-1～DQ-10：已於 2026-11-09 16:02 決定（第 3 節），本版已寫入設計，不需再決定。
4. 牌面草稿的美觀度與第 3 關難度（cards.md 第 4 節）。
5. 假設 DA-1、DA-2、DA-3、DA-5（spec.md 第 17 節）。

## 3. 待決問題（已全部關閉）

產品負責人於 **2026-11-09 16:02** 決定：DQ-1～DQ-10 全部採用建議。詳細內容與寫入的章節見 spec.md 第 16 節「狀態與決定」欄。

| 編號 | 問題 | 決定（2026-11-09） | 寫入的設計 | 狀態 |
|---|---|---|---|---|
| DQ-1 | 暫停中、尚未計時時可否「重新開始」 | 可以；新遊玩為尚未開始計時、未暫停 | spec.md 5.5、5.7、4.11；AC-PS-8 | 已關閉 |
| DQ-2 | 背景自動暫停後回前景是否自動繼續 | 維持暫停，由玩家按「繼續」 | spec.md 5.6、5.7、6.4；AC-PS-5；M8 | 已關閉 |
| DQ-3 | 尚無紀錄時是否標示「新紀錄」 | 標示；統籌 agent 已把需求升為 v1.1（RS-4） | spec.md 4.6、4.11；AC-RS-4 補尚無紀錄的正例與反例；M6 | 已關閉 |
| DQ-4 | 紀錄格式不符時整份、逐項或整份＋備份作廢 | (a) 整份作廢；接受下次勝利覆寫整份、其他關卡原資料永久遺失 | spec.md 4.6、9.2、9.3；M6 | 已關閉 |
| DQ-5 | 儲存不可用時是否在選單顯示本次勝利 | 顯示（只存在記憶體），保留「紀錄無法保存」提示 | spec.md 9.3、9.4、10.3；AC-RC-9；M7、M10 | 已關閉 |
| DQ-6 | requirements-spec 沒有版本號 | 產品負責人為 requirements-spec 加變更紀錄（將為 1.1），並把建議修改納入 agent-dev-workflow（將為 1.1）；副本由另一個 PR 同步。同步前填「無版本號」，同步後改填版本號 | spec.md 12.4；review-process.md 第 2 節 | 已關閉（產品負責人的 skill 更新與副本同步尚待執行） |
| DQ-7 | 測試如何得知牌面配置（`data-face` 會洩漏答案） | (b)＋(c)：測試記錄亂數、以錨點與正式程式重放；`data-face` 只在實際渲染牌面時存在 | spec.md 4.3、4.5、4.11、第 8 節；acceptance-test-plan.md；M2、M3、M10 | 已關閉 |
| DQ-8 | EQ-2 的啟動例外 | 接受 (1) 初始 commit 直接推送、(2) PR-1 先於保護合併；設計文件隨 PR-1 合併，不發生 (3)；產品負責人在 UAT 紀錄或 release notes 註明 | spec.md 12.6「EQ-2 啟動例外的處理」；verification.md 2.2、2.3；review-process.md 第 5 節 | 已關閉 |
| DQ-9 | EQ-12 無餘裕，GitHub 延遲時如何處理 | `smoke` 失敗重跑一次並記錄；仍逾時記為外部觀察，由產品負責人判定，不改程式 | spec.md 12.5；verification.md 2.4 | 已關閉 |
| DQ-10 | Should 需求本輪範圍與補充驗收 | 全部本輪實作；補充驗收全部啟用，`enforced: true` 與骨架隨 PR-1 | spec.md 第 14、15 節；supplementary-acceptance.json；acceptance-test-plan.md 第 3 節 | 已關閉 |

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

## 5. 簽核紀錄（AC-EQ-6）

| 日期 | 簽核者 | 簽核的版本 | 待決問題的決定 | 備註 |
|---|---|---|---|---|
| 2026-11-09 16:12（Asia/Taipei） | 產品負責人 | 設計文件 v0.4（commit dfca62f）；需求文件 v1.1 | DQ-1～DQ-10 全部採用建議（2026-11-09 16:02） | 產品負責人於對話中回覆「簽核設計」，由統籌 agent 代為記錄 |

簽核日期必須早於第一個實作 PR 的建立日期。

## 6. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | 依設計審查修訂全部設計文件；新增上工檢查、待決問題摘要、修訂紀錄 | design-review.md |
| 0.3 | 2026-11-04 | 依第 2 輪回歸審查修訂 spec.md、acceptance-test-plan.md、module-test-standards.md、設計 skill；新增第 2 輪修訂紀錄 | design-review.md 回歸審查（第 2 輪） |
| 0.4 | 2026-11-09 | 依 DQ-1～DQ-10 的決定修訂 spec.md、acceptance-test-plan.md、module-test-standards.md、review-process.md、verification.md、cards.md、supplementary-acceptance.json；第 3 節改為已關閉；需求依據改為 v1.1；新增第 3 輪修訂紀錄；設計 skill 升為 1.3。簽核欄維持待簽核 | 產品負責人 2026-11-09 16:02 的決定；需求文件 v1.1 |
