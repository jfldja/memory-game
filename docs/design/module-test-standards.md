# 模組測試標準與需求追溯

| 項目 | 內容 |
|---|---|
| 版本 | 0.6（M12 標示 DQ-14 待決定的 review-gate 邊界；M13 的 AC-EQ-11 證據改在探測 PR B）；0.5.1（簽核後釐清：M12 邊界補偵測形式、結果檔交接、全域錯誤與只含骨架的檔案）；0.5（M12 的檢查腳本邊界依 spec.md v0.5 修訂；新增執行結果檢查） |
| 日期 | 2026-11-10 |
| 狀態 | v0.4 已簽核（2026-11-09 16:12）；v0.5 已簽核（2026-11-10 16:06）；v0.5.1 已確認（2026-11-10 16:47）（EQ-6）；v0.6 待產品負責人簽核 |
| 依據 | docs/requirements.md v1.1；spec.md v0.5.1；review-process.md v0.5.1；agent-dev-workflow 第 3.1 節（測試分工）；PR #1 審查紀錄 N-1、N-2 |

---

## 1. 測試分層與分工

| 層 | 位置 | 撰寫者 | 執行 | 內容 |
|---|---|---|---|---|
| 模組單元測試 | `tests/unit/**/*.test.mjs` | 實作 agent | `node --test`（glob），CI `unit` | 驗收標準以外、模組內部行為與邊界（本文件第 2 節「單元測試」欄） |
| 驗收測試：無瀏覽器層 | `tests/acceptance/unit/**/*.test.mjs` | 測試 agent | `node --test`（glob），CI `unit` | 直接對應驗收編號、可不經畫面驗證者（acceptance-test-plan.md 的 U 層） |
| 驗收測試：端對端層 | `tests/acceptance/e2e/` | 測試 agent | Playwright 三引擎，CI `e2e (*)` | 其餘驗收編號與 NFR |
| 編號覆蓋檢查 | `scripts/check-acceptance-ids.mjs` | 實作 agent（腳本）；測試 agent（AC-EQ-4 測試） | CI `acceptance-ids` | EQ-4；只採計 `tests/acceptance/`（spec.md 12.2 v0.5） |
| 執行結果檢查 | `scripts/check-acceptance-results.mjs`、`scripts/acceptance-reporter.mjs`、`scripts/acceptance-reporter-pw.mjs` | 實作 agent | CI `unit`、`e2e (*)` 的最後一步 | 驗收測試沒有非骨架的略過、預期失敗、未執行、沒有斷言或斷言被吞掉（spec.md 12.2.1）；PR-7 起沒有任何略過 |
| 斷言計數輔助 | `tests/support/assertions.mjs` | 測試 agent | 由無瀏覽器層驗收測試匯入 | 包裝 `node:assert/strict`、以 `t.diagnostic` 回報每個測試的斷言執行與失敗次數（spec.md 12.2.1 第 6 項） |

**分界原則：** 測試名稱含驗收或 NFR 編號、判定「是否符合需求」的，是驗收測試，只由測試 agent 撰寫與修改。實作 agent 的單元測試**不得**以驗收編號命名（避免讓編號覆蓋檢查誤以為驗收已存在），可在說明中引用設計編號（例如 `T-5`、`I-2`）。v0.5 起由檢查強制：`tests/unit/` 的測試名稱不採計為覆蓋，且含必要編號即讓 `acceptance-ids` 失敗（spec.md 12.2 第 3、5 點）。

**涵蓋原則（測試金字塔）：** 狀態機的組合與邊界以單元測試窮舉（快、確定）；端對端只驗證需求的觀察點與畫面整合。

---

## 2. 各模組的測試標準

### M1 core/config.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | 三關的 id、名稱、時間上限、牌面 id；`getLevel` 對不存在的 id 丟出錯誤；常數 3、1000、2000 |
| 邊界 | id 為 0、4、字串 |
| 對應 | LV-1、LV-5、LV-9、HT-1、GP-5、HT-2；AC-LV-5（驗收，U） |
| 單元測試 | `getLevel` 的錯誤處理；每關 faceIds 長度 6 且不重複 |
| 驗收測試 | AC-LV-5 讀設定值；AC-LV-2～4 比對 faceIds 與屬性表 |

### M2 core/random.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | `randomInt(n)` 回傳 0..n−1 的整數；拒絕取樣在 `x ≥ limit` 時重抽；每抽一次（含重抽）恰呼叫一次 `cryptoObj.getRandomValues`，參數為長度 1 的 `Uint32Array`（spec.md 4.3 的 DQ-7 契約） |
| 邊界 | n＝1（永遠 0）；n＝2³²；以假的 `cryptoObj` 依序回傳 `limit`、`limit−1`，確認第一個被拒絕 |
| 對應 | GP-2、術語「隨機排列」 |
| 單元測試 | 上述全部（注入假的 `cryptoObj`） |
| 驗收測試 | 經由 AC-GP-2 統計間接驗證 |

### M3 core/deal.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | 回傳 12 個元素、每個牌面恰 2 次；以固定序列的 `randomInt` 產生預期的 Fisher–Yates 結果；不修改輸入陣列；每次 `deal` 恰依序呼叫 `randomInt(12)`…`randomInt(2)` 共 11 次（spec.md 4.3，DQ-7 決定 (b)＋(c) 的契約） |
| 邊界 | `randomInt` 永遠回傳 0；永遠回傳最大值 |
| 對應 | GP-1、GP-2；AC-GP-1、AC-GP-2 |
| 單元測試 | 確定性序列下的排列；輸入不被修改 |
| 驗收測試 | AC-GP-2：60,000 次統計（72 格皆在 10,000±500）、反例（固定順序應失敗）；AC-GP-1 在 E 層 |

### M4 core/time.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | 無條件捨去；格式恰一位小數 |
| 邊界 | 0、99.999、100、12380、12399.999999999998（應為 124）、89960、90000、浮點相減結果 |
| 對應 | TM-2、術語「顯示值」、LV-6、RC-3；AC-TM-2 |
| 單元測試 | 全部邊界 |
| 驗收測試 | AC-TM-2（E 層） |

### M5 core/game.js（狀態機）

| 項目 | 內容 |
|---|---|
| 要測的行為 | spec.md 5.4 的 T-1～T-13 每一條：守衛成立時的效果、每個守衛不成立時無效果；不變式 I-1～I-5 在每次操作後成立（I-2 只在 `ready`／`playing` 檢查；終止狀態檢查 I-5）；`getView` 的 `canUseHint`、`canPause`、`canResume`；`nextWakeup` 的值 |
| 狀態 × 操作 | spec.md 5.5 每一格至少一個測試（S0、S1、S2、S3、H、P、W／L × 點背面、點正面／已配對、提示、暫停／繼續） |
| 狀態 × 計時器 | spec.md 5.6 每一列：暫停時三個計時一併停止並接續；上限在 S3、H 中到達；勝利時標示取消 |
| 邊界 | 時間上限前 1 ms 配對最後一對（勝利）；原始值 `limitMs − 0.0004`（顯示值已達上限）配對最後一對（失敗，T-11 以 `limitReached` 判定）；恰好在上限點擊（失敗）；翻錯鎖定中到達上限（失敗，兩張牌維持 `up`、`lock` 與 `firstIndex` 皆為 null）；鎖定結束同一時刻點擊（有效）；`elapsedTenths` 在 89960／90000；只剩最後一對時提示；剩餘 1 次提示用完後；連續點同一張；提示標示中配對被標示的牌、標示仍持續到 2000 ms；暫停 0 ms 後繼續；`ready` 中暫停再繼續 |
| 對應 | GP-1～8、TM-1、TM-3、TM-5、LV-6、HT-1～4、HT-7～10、PS-1～3、PS-9、PS-10（邏輯）、A-4、A-5 |
| 單元測試 | 以上全部，時間以數字傳入、亂數以固定序列注入 |
| 驗收測試 | 對應 AC 編號在 E 層驗證畫面觀察點（acceptance-test-plan.md） |

### M6 core/records.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | `parseRecords` 的 ok／empty／invalid 判定（spec.md 9.2 每條規則）；`invalid`、`empty` 時回傳 `emptyRecords()`，**只有一關的一項不符也整份作廢**（DQ-4 選項 (a)），不保留其他關卡的有效項目；`serializeRecords` 與 `parseRecords` 來回一致；`mergeWin` 的取代、不取代、相等不取代、兩項各自獨立、保存本次 hintsUsed；`newBestTime`／`newFewestMoves` 在該項被取代時為 true（既有為 null 或嚴格優於），相等或較差時為 false（RS-4 v1.1，DQ-3），且與 `records` 中該項是否改變一致 |
| 邊界 | 只有第 3 關 `tenths` 等於上限、其餘皆有效（整份作廢）；`bestTime` 為 null 而 `fewestMoves` 有值（逐項判定新紀錄）；非 JSON、`null`、陣列、`schemaVersion` 為 2、缺一關、`tenths` 為小數／負數／等於上限、`hintsUsed` 為 4、`moves` 為 5；相等值；既有為 null |
| 對應 | RC-1、RC-3、RC-4、RC-8、RS-4；AC-RC-1、AC-RC-3、AC-RC-8、AC-RS-4 |
| 單元測試 | 全部 |
| 驗收測試 | AC-RC-*（E 層） |

### M7 platform/storage.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | 讀寫刪除成功；`localStorage` 不存在、`getItem`／`setItem` 丟出例外時回傳 null／false 且不丟出 |
| 邊界 | 存取 `window.localStorage` 本身就丟出例外（部分瀏覽器的隱私模式） |
| 對應 | RC-6、RC-7、RC-8、RC-9 |
| 單元測試 | 以假的 storage 物件注入（模組接受可選參數，預設為 `globalThis.localStorage`） |
| 驗收測試 | AC-RC-6～8、AC-RC-9（E 層；儲存不可用時的記憶體紀錄屬 app.js，DQ-5） |

### M8 platform/clock.js、visibility.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | `setTimer` 在到期時呼叫一次；提早喚醒時重新排程；`cancel` 後不呼叫；`onHidden` 只在 hidden 時呼叫，回到 visible 時不呼叫任何回呼（DQ-2：回前景維持暫停） |
| 對應 | NFR-6、PS-5 |
| 單元測試 | 注入假的 `setTimeout` 與 `now` |
| 驗收測試 | NFR-6（真實時間）、AC-PS-5（PS-5 本輪實作，DQ-10） |

### M9 ui/faces.js

| 項目 | 內容 |
|---|---|
| 要測的行為 | 18 個牌面 id 與屬性表一致；每個 SVG 字串符合 cards.md 第 2 節轉換規則：不符合正規表示式 `https?://`、`<use`、`clipPath`、`\bid=`、`aria-label`、`<text`；帶 `aria-hidden="true"` 與 `data-role="face"`（牌背為 `data-role="back"`）；字串中不出現任何牌面識別碼（例如 `L3-1`） |
| 對應 | C-4、C-5、LV-2～4、NFR-7、DQ-7（SVG 不帶牌面識別碼；`data-face` 屬於 DOM 層，只在實際渲染牌面時輸出） |
| 單元測試 | 字串檢查 |
| 驗收測試 | AC-LV-2～4（比對 id 集合與關卡歸屬）；U-3、U-4 人工 |

### M10 ui 層（app、views、dialog）

| 項目 | 內容 |
|---|---|
| 要測的行為 | 畫面路由；DOM 測試介面（spec.md 4.11）的屬性與 GameView 一致（含 `data-shown`；`data-face` 只在 `data-shown=face` 時存在，DQ-7）；停用按鈕使用 `aria-disabled`；離開遊戲與重新開始時取消計時器（DQ-1）；勝利時保存紀錄一次；開始遊玩的處理器第一個消耗亂數的是 `deal`（spec.md 4.3）；儲存不可用時以記憶體紀錄為準（spec.md 9.4，DQ-5） |
| 對應 | 全部畫面相關需求 |
| 單元測試 | 不要求（需要 DOM）。實作 agent 不撰寫端對端測試；畫面行為由測試 agent 的 E 層驗收涵蓋（spec.md 12.3）。可測的純函式（例如由 GameView 計算屬性值）放在 ui 層的獨立模組，以 `node --test` 測試 |
| 驗收測試 | E 層全部 |

### M11 建置與版本（scripts/build.mjs、version.js）

| 項目 | 內容 |
|---|---|
| 要測的行為 | `BUILD_SHA` 取前 7 碼；無 `BUILD_SHA` 時的後備；輸出只含 `src/` 內容；版本號格式 `^\d+\.\d+\.\d+\+([0-9a-f]{7}|dev)$` |
| 對應 | EQ-9、C-2；AC-EQ-9 |
| 單元測試 | 把版本字串計算寫成純函式測試；建置到暫存目錄後檢查檔案清單 |
| 驗收測試 | AC-EQ-9（E 層）；部署後 `smoke` |

### M12 CI 腳本（check-acceptance-ids、check-acceptance-results、acceptance-reporter、acceptance-reporter-pw、check-pr-body、review-gate）

| 項目 | 內容 |
|---|---|
| 要測的行為 | 見 spec.md 12.2、12.2.1、12.4、review-process.md 第 4 節。每支腳本的判定邏輯為純函式 |
| 邊界 | check-acceptance-ids：`AC-GP-1` 與 `AC-GP-10` 不互相誤判；編號只在註解中出現不算；一個標題含多個編號。v0.5（spec.md 12.2）：只在 `tests/unit/` 出現的編號判為缺少；`tests/unit/` 名稱含必要編號時失敗、名稱含非必要編號（例 `NFR-1`、虛構編號）時不失敗；`tests/acceptance/` 下位置或副檔名不符的測試檔失敗；骨架宣告 `test.skip(名稱, 函式)` 計為略過且無 `--no-skip` 時通過；骨架宣告寫在 `describe` 內、第一個參數不是字串字面值時不算骨架；第 8 點每一種其他寫法（宣告變體、本體內呼叫、條件略過、選項物件、`annotation` 物件與陣列、`expectFailure`、計算屬性 `['skip']`、`.only`）各一個案例判定失敗；`assert.fail` 與字串資料中的 `test.skip(` 不誤判；`--no-skip` 時 `tests/unit/` 的略過仍失敗。第 3 輪：骨架本體非空時失敗；非骨架測試本體沒有 `expect…`／`assert…` 呼叫時失敗（含刪掉 `.skip` 的空本體），只在字串或註解中出現 `expect(` 不算；`tests/acceptance/unit/` 直接匯入 `node:assert`、`node:assert/strict`、`assert` 或未自 `tests/support/assertions.mjs` 匯入 `assert` 時失敗；同一檔案「外層路徑＋名稱」重複時失敗（不同 `describe` 下同名不失敗）；`tests/acceptance/e2e/x.test.ts`、`x.spec.js` 等任何副檔名的位置規則。check-acceptance-results（spec.md 12.2.1）：以本次實測的兩種結果格式為測試資料（node:test reporter 的 JSON 行、Playwright json）；通過；骨架略過（無 `--no-skip` 通過、有則失敗）；非骨架略過（node `skip`／`todo`、Playwright `expectedStatus: skipped`）失敗；Playwright `test.fail` 的 `expectedStatus: failed`／`status: expected` 失敗（不得只看 `stats`）；任一 `results[].status` 不是 `passed` 失敗；靜態有、結果沒有的測試失敗（含 node 略過區塊內的測試、整個檔案沒有結果）；樣板名稱以前綴比對；`describe` 名稱以外層路徑比對；e2e 兩個結果檔合併（realtime 專用檔只出現在其中一個）；`--no-skip` 時必要編號沒有通過結果即失敗。第 3 輪（12.2.1 第 6 項）：Playwright 斷言步驟 0 次（空本體、第一個斷言前 `return`）失敗；`try/catch` 吞掉的失敗斷言（計數 1、帶 `error` 1）失敗；`expect.soft`、`expect.poll`、巢狀於 `test.step` 內的斷言都計入；node:test 沒有 `acceptance-assertions` 訊息、次數 0、失敗次數大於 0 時失敗；訊息以 `file`＋`line`＋`column` 對應到測試（同檔兩個測試不混淆）；骨架略過不需要訊息。check-pr-body：未勾選、版本號不符、缺段落、skill 不存在、「無版本號」的過渡規則、多位作者。review-gate：無紀錄、SHA 為舊 commit、SHA 為短碼、非協作者評論、審查者工作階段等於任一位作者、缺 W-1 註明、清單缺 R-1～R-15 任一項（v0.5 起含 R-15）、含「不通過」卻寫 APPROVED、多則紀錄以最後一則為準。v0.5（review-process.md 第 4 節）：同一 R 編號兩列（先不通過後通過、先通過後不通過、兩列都通過）皆失敗「審查清單重複」；清單以外的列（例 R-15）為不通過時失敗；結果欄為三值以外（例「通過？」「OK」）時失敗；「不適用」說明空白時失敗；審查者 `IMPL-1` 對作者 `impl-1`、全形 `ｉｍｐｌ－１` 對 `impl-1`、前後空白不同時都判為相同；較晚一則合法紀錄可取代較早一則重複而無效的紀錄。第 3 輪（白名單，review-process.md 第 2 節、第 4 節第 5 步）：含 U+200B、U+FEFF、U+202E 時無效；`- 結果：` 兩行（先 APPROVED 後 CHANGES_REQUESTED，與反向）無效；另有 `**結果**：…` 一行也算重複；`\| **R-5** \| … \| 不通過 \|`、`\| Ｒ－５ \| … \|`、`\| R-5（補充） \| … \|`、全形 `｜` 開頭的列與正規 R-5 並存時無效；第二個表格無效；R-16 無效；缺 R-15 無效；結果寫在第 4 格時無效；審查者識別含 U+200B 或西里爾字母 `і` 時判「工作階段識別格式不符」；作者識別格式不符時失敗；較晚一則無效時不退回採用較早的有效紀錄；「針對 commit」欄位重複且其中一行含 head SHA 時仍視為候選並判為無效；`--dry-run` 不呼叫寫入狀態的 API。check-pr-body：作者工作階段含大寫或全形時正規化後通過、含零寬字元或相似字時失敗。v0.5.1（簽核後釐清；spec.md 12.2 第 9c 點、12.2.1「結果檔的交接」與第 7 項、review-process.md 第 4 節「偵測形式」）：review-gate：合法紀錄的 `- 結果：`、`- 針對 commit：`、`- 審查者：` 各被偵測為恰好一行（正例；v0.5 字面規則下為 0 行）；另有一行 `> - 結果：…`、`> 結果：…`、`## 結果：…`、`1. 結果：…`、`1) 結果：…`、`+ 結果：…` 時「欄位重複或格式不符」；唯一的一行寫在引用區塊或縮排中（`> - 結果：APPROVED`、`    - 結果：APPROVED`）時無效；引用區塊中的表格列（含只有一列）時「表格格式不符」；「針對 commit」寫在引用區塊且含 head SHA 時仍是候選並判為無效；`--dry-run` 對已關閉的 PR 仍試算並印出 PR 狀態、不呼叫寫入 API，寫入模式對已關閉的 PR 不寫入；沒有候選紀錄時 `targetUrl` 為 `prUrl`。check-acceptance-results：結果檔沒有結束標記、筆數不符、空檔、不存在、含無法辨識的行時結束代碼 2；`errors` 非空時失敗（第 7 項）；`staticFiles` 中沒有任何結果的檔案失敗（含沒有可辨識測試名稱的檔案）；`requiredIds` 只在 `--no-skip` 時使用。Playwright reporter：`onBegin` 清空輸出檔（上一次的內容不殘留）；`outputFile` 取自設定。check-acceptance-ids 第 9c 點：只含骨架宣告的 `tests/acceptance/unit/` 檔案未匯入 `assert` 時失敗（不豁免）。DQ-13 (b)（review-process.md 第 4 節「偵測形式」）：判定表的 20 種寫法各一個案例（19 種無效、「- R-5：不通過」維持有效）；第 2 節範本與 PR #2 實際紀錄格式（補 R-15）有效；巢狀標籤與巢狀連結（F2、F3 的不動點）；`<版本>` 佔位不視為標籤；`isCandidateFor` 與欄位重複使用同一個偵測形式。v0.6（**依 DQ-14 決定**；決定前不新增、不修改測試）：DQ-14 採 (a)～(d) 時，review-process.md 4.1 表的 30 個案例各一個案例判定無效，並以第 2 節範本、PR #1 與 PR #2 的實際紀錄（補 R-15）為有效的對照組；採 (b) 時另加 4.1 (b)「誤判」所列的每種寫法各一個無效案例（含 PR #3 的實際紀錄判為「含字元參照」、改寫為文字後有效），與「維持有效」所列的每種寫法各一個有效案例（`n < 3`、`` `<script>` ``、`` `Array<string>` ``、`12:30-13:00`）；採用附帶問題時，check-pr-body 的作者段落 `- 工作階段: x`、`**工作階段**：x`、`> 工作階段：x` 各判失敗，`- 工作階段：x` 與範本中只有註解的空白值維持現行判定 |
| 對應 | EQ-4、EQ-5、EQ-11、workflow.md 4.4；AC-EQ-4 |
| 單元測試 | check-pr-body、review-gate、check-acceptance-ids、check-acceptance-results、acceptance-reporter、acceptance-reporter-pw 的內部函式（實作 agent；reporter 以本次實測格式的事件序列為測試資料）。`tests/support/assertions.mjs` 由測試 agent 撰寫，其行為由 AC-EQ-4 測試或其自身的驗收測試涵蓋（以只含空本體、吞掉斷言的測試資料執行 CI 指令，確認結果檢查失敗） |
| 驗收測試 | AC-EQ-4（U 層，測試 agent）；AC-EQ-11、AC-EQ-2 由產品負責人人工驗收 |

### M13 工作流程與 GitHub 設定

| 項目 | 內容 |
|---|---|
| 要測的行為 | 三引擎矩陣、必要檢查名稱、權限宣告、部署後 smoke |
| 對應 | EQ-1、EQ-2、EQ-3、EQ-11、EQ-12、NFR-1 |
| 驗證 | 人工（AC-EQ-1、AC-EQ-2、AC-EQ-3、AC-EQ-11、AC-EQ-12），由產品負責人依 spec.md 12.6 步驟 8 執行；AC-EQ-11 與 AC-EQ-2 的合併被拒在 PR-1b 執行（v0.5；實際在探測 PR A 完成）。v0.6：AC-EQ-11 描述主分支版本的證據改在 PR-1c 合併後的探測 PR B（12.6 步驟 8b）；PR-1b 版不做步驟 8b |
| v0.5 補充 | e2e job 的 `BUILD_SHA` 為 job 層級，建置與兩個 Playwright 步驟都取得同一個值；`unit` 與 `e2e` job 含執行結果檢查步驟；job 名稱不變（spec.md 12.1）。PR-1 已有的工作流程單元測試（`tests/unit/workflows.test.mjs`）依此補充 |

---

## 3. 需求追溯：每個 Must 需求的設計與測試對應

模組代號同第 2 節。「層」：U＝無瀏覽器驗收、E＝端對端驗收、人＝人工、單＝模組單元測試。

### 3.1 功能需求（Must 62 條）

| 需求 | 設計 | 模組 | 驗收 | 層 |
|---|---|---|---|---|
| GP-1 | D 4.3、T-1 前置、10.3 | M3、M5、M10 | AC-GP-1 | E；單（M3） |
| GP-2 | 第 8 節 | M2、M3、M10 | AC-GP-2 | U＋E |
| GP-3 | T-1、T-2 | M5、M10 | AC-GP-3 | E；單 |
| GP-4 | T-3 | M5 | AC-GP-4 | E；單 |
| GP-5 | T-5、T-6、第 6.1 節 | M5、M8 | AC-GP-5 | E；單 |
| GP-6 | T-7 | M5 | AC-GP-6 | E；單 |
| GP-7 | T-7 | M5 | AC-GP-7 | E；單 |
| GP-8 | T-4 | M5、M10 | AC-GP-8 | E；單 |
| TM-1 | T-1、5.3 | M5 | AC-TM-1 | E；單 |
| TM-2 | 4.4、5.3、6.1 | M4、M10 | AC-TM-2 | E；單（M4） |
| TM-3 | T-3、T-5 | M5 | AC-TM-3 | E；單 |
| TM-4 | 10.3 | M10 | AC-TM-4 | E |
| TM-5 | T-4、T-11 | M5 | AC-TM-5 | E；單 |
| LV-1 | 4.1、10.3 | M1、M10 | AC-LV-1 | E |
| LV-2 | cards.md | M9、card-attributes.json | AC-LV-2、U-3 | U＋人 |
| LV-3 | cards.md | M9 | AC-LV-3、U-3 | U＋人 |
| LV-4 | cards.md 第 3 節 | M9 | AC-LV-4、U-3、U-4 | U＋人 |
| LV-5 | 4.1 | M1 | AC-LV-5 | U |
| LV-6 | T-11、5.3、6.3 | M4、M5 | AC-LV-6 | E；單 |
| LV-7 | 10.3 選單 | M10 | AC-LV-7 | E |
| LV-8 | 10.3 遊戲 | M10 | AC-LV-8 | E |
| LV-9 | 4.1、10.1 | M1、M10 | AC-LV-9 | E |
| HT-1 | 4.1、新遊玩建立新 game | M1、M5 | AC-HT-1 | E；單 |
| HT-2 | T-8、T-10 | M5、M10 | AC-HT-2 | E；單 |
| HT-3 | T-8 | M5 | AC-HT-3 | E；單 |
| HT-4 | T-9、10.4 | M5、M10 | AC-HT-4 | E；單 |
| HT-5 | 10.3 | M10 | AC-HT-5 | E |
| HT-7 | T-9 | M5 | AC-HT-7 | E；單 |
| HT-8 | T-9 | M5 | AC-HT-8 | E；單 |
| HT-9 | T-8 | M5 | AC-HT-9 | E；單 |
| HT-10 | T-9 | M5 | AC-HT-10 | E；單 |
| PS-1 | T-12、5.3 | M5 | AC-PS-1 | E；單 |
| PS-2 | T-7 | M5 | AC-PS-2 | E；單 |
| PS-3 | T-13 | M5 | AC-PS-3 | E；單 |
| PS-4 | 10.3 遮蔽層 | M10 | AC-PS-4 | E |
| PS-7 | T-14、10.3 | M10 | AC-PS-7 | E |
| PS-9 | 5.3 共用遊玩時鐘 | M5 | AC-PS-9 | E；單 |
| PS-10 | T-9、10.3、10.4 | M5、M10 | AC-PS-10 | E；單 |
| RS-1 | 10.3 勝利 | M10 | AC-RS-1 | E |
| RS-2 | 10.3、新遊玩 | M10 | AC-RS-2 | E |
| RS-3 | 10.3 | M10 | AC-RS-3 | E |
| RC-1 | 4.6、9.1 | M6 | AC-RC-1 | E；單 |
| RC-2 | 9.3、T-14 | M10 | AC-RC-2 | E |
| RC-3 | 4.6 | M6 | AC-RC-3 | E；單 |
| RC-4 | 4.6、10.3 | M6、M10 | AC-RC-4 | E；單 |
| RC-5 | 10.3 | M10 | AC-RC-5 | E |
| RC-6 | 9.3 | M7 | AC-RC-6 | E；單 |
| RC-7 | 9.3、10.4 | M7、M10 | AC-RC-7 | E；單 |
| RC-8 | 9.2 | M6、M7 | AC-RC-8 | E；單 |
| EQ-1 | 12.6 步驟 1 | M13 | AC-EQ-1 | 人 |
| EQ-2 | 12.6 步驟 6、verification.md 2.2 | M13 | AC-EQ-2 | 人 |
| EQ-3 | 12.1、12.3 | M13 | AC-EQ-3 | 人 |
| EQ-4 | 12.2、acceptance-test-plan.md | M12 | AC-EQ-4 | U |
| EQ-5 | 第 13 節、review-process.md | M12、審查 agent | AC-EQ-5 | 人 |
| EQ-6 | README.md 簽核欄 | 本文件群 | AC-EQ-6 | 人 |
| EQ-7 | 不在設計範圍；UAT 紀錄放 docs/uat/ | — | AC-EQ-7 | 人 |
| EQ-8 | 不在設計範圍；版本號格式 11 節支援 | — | AC-EQ-8 | 人 |
| EQ-9 | 第 11 節 | M11 | AC-EQ-9 | E＋部署 smoke |
| EQ-11 | 第 13 節、verification.md 2.3 | M12、M13 | AC-EQ-11 | 人 |
| EQ-12 | 12.5、verification.md 2.4 | M13 | AC-EQ-12 | 人＋部署 smoke |
| EQ-13 | 第 11 節（版本號＝1.0.0＋短碼） | — | AC-EQ-13 | 人 |
| EQ-14 | 第 11 節、14 節（UAT 凍結由產品負責人執行） | — | AC-EQ-14 | 人 |

### 3.2 非功能需求（Must 6 條）

| 需求 | 設計 | 驗收 | 層 |
|---|---|---|---|
| NFR-1 | 12.1 三引擎矩陣、12.3 projects | AC-EQ-3（EQ-4 例外） | 人（CI 紀錄） |
| NFR-2 | 10.4 iOS 對策、DA-5 | U-1～U-6 | 人 |
| NFR-3 | 10.2 | NFR-3 | E |
| NFR-5 | 10.2、10.3、10.4 | NFR-5 | E |
| NFR-6 | 第 6、7 節 | NFR-6 | E（真實時間） |
| NFR-7 | 第 1 節、12.2、R-9 | NFR-7 | E |

### 3.3 覆蓋檢查結果

- 需求第 13 節追溯矩陣中優先為 M 的功能需求 62 條、非功能需求 6 條，上表全部列出，每條都有設計章節與驗收方式。
- 核對方式（以腳本，不靠目測）：以正規表示式 `^\| ((?:GP|TM|LV|HT|PS|RS|RC|EQ|NFR)-\d+) \| M \|` 擷取需求文件第 13 節的 Must 編號，與本文件第 3 節表格第一欄的編號集合比較。2026-11-04 結果：需求 68、本表 68，缺 0、多 0。設計審查以獨立腳本得到相同結果。
- 51 個含「自動」的驗收編號與 4 個 NFR 編號，每個都在 acceptance-test-plan.md 有骨架檔案與轉實測的 PR。核對方式：擷取需求第 10.2 節 `^\*\*(AC-…(、AC-…)*)\*\*（含「自動」）` 的標題與第 13 節 Must、自動的 NFR（排除 NFR-1），與 acceptance-test-plan.md 第 2 節編號欄比較。2026-11-04 結果：55 對 55，缺 0、多 0。
- EQ-6、EQ-7、EQ-8、EQ-13、EQ-14 屬流程，由產品負責人執行；設計只提供支援（簽核欄、版本號格式）。

## 4. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 設計階段產出 |
| 0.2 | 2026-11-04 | 單元測試以 glob 執行；M3 加入亂數呼叫次數契約；M5 加入顯示值上限與鎖定中失敗的邊界、I-2 適用範圍；M9 依 cards.md 轉換規則改寫禁止清單；M10 移除實作 agent 的端對端 smoke 選項；M12 邊界補略過寫法、多位作者、R-14；3.3 寫明腳本核對方式與結果 | design-review.md M-1、M-2、M-10、M-11、P-11 |
| 0.3 | 2026-11-04 | M6 註明格式不符的處理範圍依 DQ-4、於 PR-5 實作 | design-review.md 回歸審查（第 2 輪）N-9 |
| 0.4 | 2026-11-09 | M2 加入每抽一次呼叫一次 `getRandomValues` 的契約；M3、M9、M10 改為 DQ-7 決定 (b)＋(c)；M6 改為整份作廢（DQ-4）並補 `newBestTime`／`newFewestMoves` 的尚無紀錄規則與邊界（DQ-3、需求 v1.1）；M7、M10 補記憶體紀錄（DQ-5）；M8 補回前景不呼叫（DQ-2）、AC-PS-5 改為本輪實作；M10 補重新開始時取消計時器（DQ-1）；依據改為需求 v1.1 | 產品負責人 2026-11-09 16:02 對 DQ-1～DQ-10 的決定；需求文件 v1.1 |
| 0.5 | 2026-11-09 | 第 1 節新增執行結果檢查一列、單元測試不得帶編號改為檢查強制；M12 依 spec.md 12.2、12.2.1 v0.5 與 review-process.md 第 4 節 v0.5 補邊界；M13 補 PR-1b 的人工驗證與 CI 變更 | PR-1 審查紀錄 N-1、N-2、N-6；實作與測試 agent 回報 |
| 0.5（第 3 輪審查修訂） | 2026-11-09 | 同一版本內依設計審查第 3 輪修訂：第 1 節補 Playwright reporter 與斷言計數輔助；M12 補斷言檢查、白名單式審查判定、作者識別格式的邊界，單元測試欄補列新腳本 | design-review.md 設計審查第 3 輪 M-1、M-2、P-5 |
| 0.5.1（簽核後釐清） | 2026-11-10 | M12 邊界補：review-gate 偵測形式的正例（合法欄位行恰好偵測一次）與反例（引用、標題、有序清單、縮排）、`--dry-run` 對已關閉 PR 的行為、`prUrl`；check-acceptance-results 的結束標記、結束代碼 2、全域錯誤、`staticFiles`；reporter 清空輸出檔；第 9c 點不豁免只含骨架的檔案 | 實作 agent 依 agent-dev-workflow 5.1 回報；spec.md、review-process.md v0.5.1 |
| 0.5.1（DQ-13 (b) 寫入正文） | 2026-11-10 | M12 的 review-gate 邊界加入 DQ-13 (b)：review-process.md 第 4 節判定表的 20 種寫法各一個案例（19 種無效、「- R-5：不通過」有效），第 2 節範本與 PR #2 實際紀錄格式（補 R-15）為合法對照組；F2、F3 重複到不動點（巢狀標籤、巢狀連結）；`<版本>` 佔位不視為標籤 | DQ-13 採 (b)（2026-11-10 16:47） |
| 0.6 | 2026-11-10 | M12 的 review-gate 邊界新增「依 DQ-14 決定」的案例範圍（review-process.md 4.1 的 30 個案例、(b) 的誤判與維持有效案例、作者段落）；M13 的 AC-EQ-11 證據改在探測 PR B；M12「邊界」一列中程式碼內的直線改為 `\|` 跳脫（原本使 GFM 把該列切成 12 格，渲染錯位；文字內容不變）。追溯表與 Must 集合不變 | spec.md v0.6 DQ-14、12.6「v0.6 的順序」 |
