# 設計文件（M2）

| 項目 | 內容 |
|---|---|
| 版本 | 0.2（依設計審查 design-review.md 修訂） |
| 日期 | 2026-11-04 |
| 狀態 | 待產品負責人簽核。簽核前須決定第 3 節標為「阻擋 PR-1」的待決問題 |
| 依據 | docs/requirements.md v1.0（已簽核）；docs/workflow.md v0.1；docs/design/design-review.md（設計審查紀錄） |
| 撰寫 | 設計 agent（agent-dev-workflow 第 3 節「設計 agent」） |

## 0. 上工檢查與已載入 skill（workflow.md 第 4.4 節）

**上工檢查（agent-dev-workflow 第 1 節）：**

- [x] 角色：設計 agent。負責規格書、模組劃分、模組測試標準與其他設計產出；不撰寫正式程式碼、不自行決定需求沒寫的行為、不修改需求文件與產品負責人維護的 skill。
- [x] 階段：階段 2 設計（M2）；離開條件為產品負責人簽核（EQ-6）。
- [x] 輸入：需求文件 v1.0 已簽核；workflow.md v0.1；設計審查紀錄 design-review.md（v0.2 修訂的輸入）。
- [x] 已讀需求文件全文。
- [x] 已讀 workflow.md，知道 W-1～W-3 與第 4～6 節的調整。
- [x] 已載入本階段 skill：agent-dev-workflow、requirements-spec（第 3.8 節）、software-design-phase。

**已載入 skill 的變更紀錄最新版本號：**

| skill | 版本 |
|---|---|
| agent-dev-workflow | 1.0 |
| requirements-spec | 無版本號（該 skill 沒有變更紀錄，見 DQ-6） |
| software-design-phase | 1.1（本次修訂） |

## 1. 文件清單

| 檔案 | 版本 | 內容 |
|---|---|---|
| verification.md | 0.2 | Q4（開發工具授權）、Q6（GitHub Actions／Pages、分支保護、EQ-11 可行性、部署延遲）查證紀錄，附官方網址 |
| spec.md | 0.2 | 軟體規格書：架構、檔案結構、模組介面、狀態機、計時、時鐘抽象、隨機排列、紀錄儲存、畫面與版面計算、版本號、CI／CD、PR 切分、Should 需求建議、待決問題、假設 |
| module-test-standards.md | 0.2 | 各模組測試標準、單元測試與驗收測試分界、Must 需求追溯（以腳本核對） |
| acceptance-test-plan.md | 0.2 | 驗收測試骨架計畫（55 個必要編號、層次、轉實測的 PR、撰寫注意事項） |
| review-process.md | 0.2 | 審查紀錄格式、審查清單 R-1～R-14、審查檢查判定規則與工作流程安全設定 |
| supplementary-acceptance.json | 0.2 | Should 需求的設計補充驗收編號（依 DQ-10 啟用） |
| cards.md | 0.2 | 牌面屬性表、繪製與轉換規則、第 3 關可分辨性的依據 |
| card-attributes.json | schemaVersion 1（內容 v0.2：細節鍵名改為方向文字） | 機器可讀牌面屬性表（AC-LV-2～4 讀取） |
| card-preview.html | v0.2 | 19 張原創內嵌 SVG 預覽頁（不載入外部資源；無重複 id；SVG 不帶可及性名稱） |
| card-preview.png、card-preview-min-size.png、card-preview-360.png | v0.2 | 預覽頁截圖（本機 Chromium；最小尺寸模擬為 108×108） |
| design-review.md | — | 設計審查紀錄（審查 agent 撰寫，設計 agent 不修改） |

可重用設計 skill：`.claude/skills/software-design-phase/SKILL.md`（1.1）。

## 2. 需要產品負責人決定的事項

1. 簽核本設計（EQ-6）。
2. 關閉 Q4、Q6（verification.md 第 3 節）。
3. 待決問題 DQ-1～DQ-10（spec.md 第 16 節）。**阻擋 PR-1、須在簽核時決定：** DQ-6、DQ-7、DQ-8、DQ-9、DQ-10。DQ-4 須在 PR-5 前決定；DQ-1、DQ-2、DQ-3、DQ-5 須在 PR-6 前決定。
4. 牌面草稿的美觀度與第 3 關難度（cards.md 第 4 節）。
5. 假設 DA-1、DA-2、DA-3、DA-5（spec.md 第 17 節）。

## 3. 待決問題摘要

| 編號 | 問題 | 建議 | 阻擋 |
|---|---|---|---|
| DQ-1 | 暫停中、尚未計時時可否「重新開始」 | 可以 | PR-6 |
| DQ-2 | 背景自動暫停後回前景是否自動繼續 | 維持暫停 | PR-6 |
| DQ-3 | 尚無紀錄時是否標示「新紀錄」 | 標示，由統籌 agent 修訂 RS-4 | PR-6 |
| DQ-4 | 紀錄格式不符時整份或逐項作廢（整份會在下次勝利時覆寫其他關卡資料） | 整份（字面） | PR-5 |
| DQ-5 | 儲存不可用時是否在選單顯示本次勝利 | 顯示 | PR-6 |
| DQ-6 | requirements-spec 沒有版本號 | 補變更紀錄；過渡期 PR 填「無版本號」 | PR-1 |
| DQ-7 | 測試如何得知牌面配置（`data-face` 會洩漏答案） | 測試控制亂數＋只在正面朝上時帶 `data-face` | PR-1 |
| DQ-8 | EQ-2 的啟動例外（初始 commit、PR-1 先於保護合併、`review-record` 分段設定） | 接受並註明 | PR-1 |
| DQ-9 | EQ-12 無餘裕，GitHub 延遲時如何處理 | 重跑一次並記錄，由產品負責人判定 | PR-1 |
| DQ-10 | Should 需求本輪範圍與補充驗收 | 全部實作，簽核時決定 | PR-1 |

## 4. 修訂紀錄（v0.1 → v0.2，對應 design-review.md）

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

## 5. 簽核紀錄（AC-EQ-6）

| 日期 | 簽核者 | 簽核的版本 | 待決問題的決定 | 備註 |
|---|---|---|---|---|
| | 產品負責人 | | | |

簽核日期必須早於第一個實作 PR 的建立日期。

## 6. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | 依設計審查修訂全部設計文件；新增上工檢查、待決問題摘要、修訂紀錄 | design-review.md |
