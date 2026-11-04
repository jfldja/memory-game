# 驗收測試骨架計畫

| 項目 | 內容 |
|---|---|
| 版本 | 0.2（依設計審查 design-review.md 修訂） |
| 日期 | 2026-11-04 |
| 依據 | agent-dev-workflow 第 4.3 節（驗收測試骨架）；需求 EQ-4、AC-EQ-4、第 10 節；spec.md v0.2 第 12、14 節 |
| 使用者 | 測試 agent（撰寫骨架與驗收測試）、審查 agent（R-6） |

---

## 1. 為什麼需要骨架

需求 EQ-4 要求每個含「自動」的驗收編號都有測試，EQ-2 要求 CI 全部通過才能合併。兩條同時存在時，逐項開發會被尚未有測試的編號擋下。因此 **PR-1（啟用 `acceptance-ids` 檢查的 PR）必須同時包含下表全部骨架**：名稱含編號、標記為略過。之後每個功能 PR 把對應骨架改為實際測試。略過的骨架可通過編號檢查，但**不算通過驗收**；PR-7 打開 `--no-skip` 後，任何略過都會讓 CI 失敗。

**轉實測的前提：** 某驗收在某 PR 轉為實測時，其 Given／When 用到的畫面與操作必須已存在（spec.md 第 14 節最後一欄）。若測試 agent 發現前提不成立，不得自行加入進入遊戲的捷徑，依 agent-dev-workflow 5.1 回報。

**多範圍編號：** 同一編號涵蓋多個畫面或範圍時（NFR-5、NFR-7），每個範圍各一個測試，名稱為「編號＋範圍」；尚未有畫面的範圍保持略過。這樣 `--no-skip` 能發現遺漏的範圍。

## 2. 必要編號清單（共 55 個）

從需求文件第 10.2 節逐一列出驗證方式含「自動」的驗收編號（51 個），加上 NFR-3、NFR-5、NFR-6、NFR-7（4 個）。`check-acceptance-ids.mjs` 從需求文件解析出的集合必須與本表相同；不同時表示解析或本表有誤，回報設計 agent。本表已以腳本對需求文件核對：缺 0、多 0（見 module-test-standards.md 第 3.3 節的核對方式）。

層次：**U**＝無瀏覽器層（`node --test`，`tests/acceptance/unit/`）；**E**＝端對端層（Playwright 三引擎，`tests/acceptance/e2e/`）。

「依 DQ-7」：找出同一對、讀取排列的方式依 spec.md 第 16 節 DQ-7 的決定；決定前骨架只寫名稱與略過標記，不寫依賴某一選項的輔助程式。

| # | 編號 | 驗證 | 層 | 骨架檔案 | 轉實測的 PR | 測試要點 |
|---|---|---|---|---|---|---|
| 1 | AC-GP-1 | 自動 | E | gameplay.spec.mjs | PR-4 | 12 張 `data-state=down`、`data-shown=back`；排列的讀取依 DQ-7 |
| 2 | AC-GP-2 | 自動 | U＋E | deal.test.mjs；gameplay.spec.mjs | PR-2（U）、PR-4（E） | U：60,000 次 `deal`＋反例；E：以「重玩本關」連續 20 次遊玩，相鄰不同（排列讀取依 DQ-7） |
| 3 | AC-GP-3 | 自動 | E | gameplay.spec.mjs | PR-4 | |
| 4 | AC-GP-4 | 自動 | E | gameplay.spec.mjs | PR-4 | 控制時鐘 `runFor(2000)`；找同一對依 DQ-7 |
| 5 | AC-GP-5 | 自動 | E | gameplay.spec.mjs | PR-4 | 第二張翻開後 `runFor(900)` 仍正面；再 `runFor(200)` 背面 |
| 6 | AC-GP-6 | 自動 | E | gameplay.spec.mjs | PR-4 | 0.5 秒時點第三張 |
| 7 | AC-GP-7 | 自動 | E | gameplay.spec.mjs | PR-4 | |
| 8 | AC-GP-8 | 自動 | E | gameplay.spec.mjs | PR-4 | 需要結果畫面（PR-4 提供） |
| 9 | AC-TM-1 | 自動 | E | timing.spec.mjs | PR-4 | |
| 10 | AC-TM-2 | 自動 | E | timing.spec.mjs | PR-4 | 第一張翻開後 `runFor(12380)` 讀 12.3；再 `runFor(20)` 讀 12.4；5.00 讀 5.0 |
| 11 | AC-TM-3 | 自動 | E | timing.spec.mjs | PR-4 | |
| 12 | AC-TM-4 | 自動 | E | timing.spec.mjs | PR-4 | |
| 13 | AC-TM-5 | 自動 | E | timing.spec.mjs | PR-5 | 需要紀錄顯示 |
| 14 | AC-LV-1 | 自動 | E | levels.spec.mjs | PR-4 | |
| 15 | AC-LV-2 | 自動＋人工 | U | card-attributes.test.mjs | PR-3 | 讀 docs/design/card-attributes.json；另檢查 `src/js/ui/faces.js` 與 `config.js` 的識別碼集合與表一致 |
| 16 | AC-LV-3 | 自動＋人工 | U | card-attributes.test.mjs | PR-3 | 同上 |
| 17 | AC-LV-4 | 自動＋人工 | U | card-attributes.test.mjs | PR-3 | 同上 |
| 18 | AC-LV-5 | 自動 | U | config.test.mjs | PR-2 | 讀 `LEVELS` |
| 19 | AC-LV-6 | 自動 | E | levels.spec.mjs | PR-4 | 89.96 秒：第一張翻開後 `runFor(89960)`；90.00：再 `runFor(40)` |
| 20 | AC-LV-7 | 自動 | E | levels.spec.mjs | PR-4 | 「沒有任何紀錄」在 PR-4 自然成立；PR-5 後仍以全新 context 執行 |
| 21 | AC-LV-8 | 自動 | E | levels.spec.mjs | PR-4 | |
| 22 | AC-LV-9 | 自動 | E | levels.spec.mjs | PR-4 | 讀 `document.body.innerText`；選單、三關遊戲、勝利、失敗 |
| 23 | AC-HT-1 | 自動 | E | hints.spec.mjs | PR-4 | 需要回到選單與重玩本關（PR-4 提供） |
| 24 | AC-HT-2 | 自動 | E | hints.spec.mjs | PR-4 | 讀 `data-hinted` |
| 25 | AC-HT-3 | 自動 | E | hints.spec.mjs | PR-4 | |
| 26 | AC-HT-4 | 自動 | E | hints.spec.mjs | PR-4 | 停用狀態以 `aria-disabled` 判斷 |
| 27 | AC-HT-5 | 自動 | E | hints.spec.mjs | PR-4 | |
| 28 | AC-HT-7 | 自動 | E | hints.spec.mjs | PR-4 | |
| 29 | AC-HT-8 | 自動 | E | hints.spec.mjs | PR-4 | |
| 30 | AC-HT-9 | 自動 | E | hints.spec.mjs | PR-4 | |
| 31 | AC-HT-10 | 自動 | E | hints.spec.mjs | PR-4 | |
| 32 | AC-PS-1 | 自動 | E | pause.spec.mjs | PR-4 | |
| 33 | AC-PS-2 | 自動 | E | pause.spec.mjs | PR-4 | |
| 34 | AC-PS-3 | 自動 | E | pause.spec.mjs | PR-4 | |
| 35 | AC-PS-4 | 自動 | E | pause.spec.mjs | PR-4 | 暫停中：`pause-mask` 可見，12 張 `data-shown=back`，牌面區內沒有可見的 `[data-role=face]`；繼續後依 `data-state` 恢復 `data-shown=face` |
| 36 | AC-PS-7 | 自動 | E | pause.spec.mjs | PR-5 | 需要紀錄顯示 |
| 37 | AC-PS-9 | 自動 | E | pause.spec.mjs | PR-4 | |
| 38 | AC-PS-10 | 自動 | E | pause.spec.mjs | PR-4 | `document.elementFromPoint(中心)` 為提示按鈕；以 `page.mouse.click` 點擊 |
| 39 | AC-RS-1 | 自動 | E | results.spec.mjs | PR-4 | |
| 40 | AC-RS-2 | 自動 | E | results.spec.mjs | PR-4 | |
| 41 | AC-RS-3 | 自動 | E | results.spec.mjs | PR-4 | |
| 42 | AC-RC-1 | 自動 | E | records.spec.mjs | PR-5 | 以 `addInitScript` 依 spec.md 9.1 格式預寫紀錄 |
| 43 | AC-RC-2 | 自動 | E | records.spec.mjs | PR-5 | |
| 44 | AC-RC-3 | 自動 | E | records.spec.mjs | PR-5 | 29.96／30.04 秒以控制時鐘精確安排最後一次配對的時刻 |
| 45 | AC-RC-4 | 自動 | E | records.spec.mjs | PR-5 | |
| 46 | AC-RC-5 | 自動 | E | records.spec.mjs | PR-5 | |
| 47 | AC-RC-6 | 自動 | E | records.spec.mjs | PR-5 | 同一 browser context 關閉頁面後開新頁 |
| 48 | AC-RC-7 | 自動 | E | records.spec.mjs | PR-5 | |
| 49 | AC-RC-8 | 自動 | E | records.spec.mjs | PR-5 | 監聽 `pageerror` 事件 |
| 50 | AC-EQ-4 | 自動 | U | acceptance-ids.test.mjs | PR-1 | 對真實需求文件解析結果等於本表 55 個；反例：測試資料中刪除 AC-GP-5 的測試後檢查失敗；略過判定涵蓋 spec.md 12.2 第 5 點的全部寫法 |
| 51 | AC-EQ-9 | 自動 | E | version.spec.mjs | PR-1 | 以 `BUILD_SHA` 建置，頁面版本號等於 `1.0.0+<BUILD_SHA 前 7 碼>`。需求的 Given 是「主分支最新 commit 的部署」，由 deploy.yml 中名為「AC-EQ-9（部署）與 EQ-12 證據」的 `smoke` 步驟對公開網址驗證；兩者合起來滿足 AC-EQ-9 |
| 52 | NFR-3 | 自動 | E | layout.spec.mjs | PR-4 | 五種尺寸；12 張牌的 bounding box 在視窗內；`documentElement.scrollWidth/scrollHeight` 等於 `clientWidth/clientHeight` |
| 53 | NFR-5 | 自動 | E | layout.spec.mjs | 分範圍（下列） | 360×640；每張牌與每個可見按鈕的 bounding box ≥ 44×44 |
| | 　NFR-5 遊戲畫面 | | | | PR-4 | 含暫停中 |
| | 　NFR-5 選單 | | | | PR-4 | PR-5 新增的清除紀錄按鈕自動納入（測試取全部可見按鈕） |
| | 　NFR-5 結果畫面 | | | | PR-4 | 勝利、失敗 |
| | 　NFR-5 清除紀錄對話框 | | | | PR-5 | |
| 54 | NFR-6 | 自動 | E | timing-real.spec.mjs | PR-4 | **不安裝時鐘**；10、60、89 秒各一次；`*-realtime` project、單一 worker（第 4 節） |
| 55 | NFR-7 | 自動 | E | privacy.spec.mjs | 分範圍（下列） | 記錄全部請求，網域皆為測試伺服器；`context.cookies()` 為空 |
| | 　NFR-7 首頁 | | | | PR-1 | PR-1 只有版本號頁面 |
| | 　NFR-7 選單 | | | | PR-4 | |
| | 　NFR-7 三關遊玩 | | | | PR-4 | |
| | 　NFR-7 結果畫面 | | | | PR-4 | |

小計：U 層 6 個編號（AC-GP-2、AC-LV-2～5、AC-EQ-4；AC-GP-2 另有 E 層），E 層 50 個編號；NFR-5、NFR-7 各拆為 4 個範圍測試。

NFR-1 不需要獨立測試（EQ-4 例外），由 playwright.config 的三個 projects 與 CI 矩陣滿足、AC-EQ-3 人工檢查。

## 3. 設計補充驗收（Should，依 DQ-10）

見 spec.md 第 15 節與 `supplementary-acceptance.json`。決定為本輪實作的項目，`enforced: true` 與骨架在**同一個 PR** 加入（設計簽核時已決定者為 PR-1）。

| 編號 | 層 | 骨架檔案 | 轉實測的 PR |
|---|---|---|---|
| AC-PS-5 | E | pause.spec.mjs | PR-6 |
| AC-PS-8 | E | pause.spec.mjs | PR-6 |
| AC-RS-4 | E | results.spec.mjs | PR-6 |
| AC-RS-5 | E | results.spec.mjs | PR-6 |
| AC-RC-9 | E | records.spec.mjs | PR-6 |
| NFR-4 | E | layout.spec.mjs | PR-4（版面已含側欄） |

## 4. 撰寫驗收測試的注意事項

1. **控制時鐘：** `await page.clock.install({ time: 0 }); await page.clock.pauseAt(1000);` 必須在 `page.goto` 之前。之後只用 `runFor(ms)` 推進。`install` 後若不 `pauseAt`，時間仍隨真實時間流動，檢查點會漂移（本次實測）。
2. **停用按鈕的點擊：** Playwright 視 `aria-disabled="true"` 為停用，`locator.click()` 會等到逾時（本次實測）。驗證「無法使用、點擊無效果」時，先以 `toHaveAttribute('aria-disabled', 'true')` 確認停用樣式，再以 `page.mouse.click(中心 x, 中心 y)` 點擊，最後檢查狀態未改變。
3. **配對操作：** 找出同一對、找兩張不同牌面的方式依 DQ-7 的決定；決定後由測試 agent 在 `tests/support/` 寫一個共用輔助函式，所有測試只透過它取得配置。
4. **預寫紀錄：** 依 spec.md 9.1 的格式，於 `page.addInitScript` 寫入 `localStorage['memory-game:records']`。
5. **NFR-6 的量測（不得比需求寬鬆）：**
   - 在 Node.js 端以 `performance.now()` 記錄：點擊第一張牌的指令送出前 t0a 與完成後 t0b；到時間後讀取顯示值的指令前 t1a 與後 t1b。實際經過時間介於 `lo = t1a − t0b` 與 `hi = t1b − t0a` 之間。
   - **有效量測：** 區間寬度 `hi − lo ≤ 0.05` 秒。不成立時該次量測無效，重量一次；重量仍不成立即判定失敗（無法以足夠精度量測不得視為通過）。
   - **判定：** 顯示值 d 必須同時滿足 `|d − lo| ≤ 0.2` 且 `|d − hi| ≤ 0.2`（區間內任何可能的實際值，誤差都在 ±0.2 秒內）。不得以「d 與區間的距離 ≤ 0.2」判定，那會放寬到 0.2 秒加上區間寬度。
   - 等待用真實的 `setTimeout`，期間不得暫停、不得配對完成（第 1 關 89 秒低於 90 秒上限）。
   - `test.setTimeout(120_000)`；放在 `timing-real.spec.mjs`，只由 `*-realtime` project 以單一 worker、在其他測試之後執行（spec.md 12.3），三個長度依序執行。
6. **主控台錯誤：** AC-RC-8、AC-RC-9 監聽 `page.on('pageerror')`，有任何未處理錯誤即失敗。
7. **測試命名：** `test('AC-GP-5 翻錯 1 秒後翻回：0.9 秒仍正面、1.1 秒已背面', …)`。編號放在名稱開頭，後接中文說明。多範圍編號為 `test('NFR-5 選單：…', …)`。

## 5. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | 轉實測的 PR 依 spec.md 第 14 節調整（AC-LV-1、AC-LV-7、AC-LV-9、AC-HT-1、AC-RS-1～3 移到 PR-4）並加入「轉實測的前提」；`data-face` 相關要點改為「依 DQ-7」；AC-PS-4 改用 `data-shown`／`data-role`；NFR-5、NFR-7 拆範圍；NFR-6 判定改為區間兩端皆在 ±0.2 秒內、區間寬度上限、逾時與獨立 project；AC-EQ-9 註明部署端的 smoke 步驟；補充驗收依 DQ-10 與同 PR 啟用規則 | design-review.md B-1、B-2、M-4、M-5、M-9、M-12、P-6 |
