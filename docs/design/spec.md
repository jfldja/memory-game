# 翻牌記憶遊戲：軟體規格書

| 項目 | 內容 |
|---|---|
| 版本 | 0.6.3（設計缺陷修正：review-gate 的欄位與表格偵測取 PR-1b 版與 PR-1c 版的聯集；第 13、14 節對應；不改決定）；0.6.2（簽核後釐清：12.6 PR #2 試算的預期、12.2 第 9d 點與 12.2.1 第 4 項寫明實作的加嚴；不改決定）；0.6.1（DQ-14 採 (b) 寫入正文；PR #3 審查第 3、4(b) 點併入 PR-1c：12.2 第 9d、9e 點、12.2.1 第 4 項）；0.6（PR-1b 合併後：新增 DQ-14（review-gate 仍可被繞過的寫法）、12.6 與第 14 節的順序改為 PR-1c 後只開一次探測 PR B）；0.5.1（簽核後釐清：12.2 第 9c 點的適用範圍、12.2.1 結果檔交接與 `evaluateResults` 簽名、新增 DQ-13）；0.5（PR-1 審查 N-1～N-6 與實作、測試 agent 回報的修正；新增 PR-1b；含設計審查第 3 輪修訂） |
| 日期 | 2026-11-10 |
| 狀態 | v0.4 已簽核（2026-11-09 16:12）；v0.5 已簽核（2026-11-10 16:06，DQ-11、DQ-12 已決定）；v0.5.1 已確認（2026-11-10 16:47（Asia/Taipei））。DQ-13 已決定採 (b)（2026-11-10 16:47（Asia/Taipei））。v0.6 已簽核（2026-11-10 22:12（Asia/Taipei），DQ-14 採 (b)）；v0.6.1 依該次決定展開，不需另行簽核。簽核紀錄見 docs/design/README.md |
| 撰寫 | 設計 agent |
| 依據 | docs/requirements.md v1.1（已簽核；v1.1 依 DQ-3 修訂 RS-4）；docs/workflow.md v0.2；產品負責人 2026-11-09 16:02 對 DQ-1～DQ-10 的決定；PR #1 審查紀錄（2026-11-09 08:41，N-1～N-6）與實作、測試 agent 的回報；PR #3 審查紀錄（2026-11-10 09:17Z）「發現的問題」第 1、2 點；產品負責人 2026-11-10 21:37 同意統籌 agent 的建議（DQ-14、順序調整）；產品負責人 2026-11-10 22:12（Asia/Taipei） 的決定（DQ-14 採 (b)；第 3、4(b) 點放進 PR-1c；簽核 v0.6） |
| 相關文件 | verification.md（Q4、Q6 查證）、module-test-standards.md（模組測試標準與需求追溯）、acceptance-test-plan.md（驗收測試骨架計畫）、review-process.md（審查紀錄格式與審查清單）、card-attributes.json、card-preview.html |

本文件描述「怎麼做」。產品行為以需求文件為準；本文件與需求文件衝突時，以需求文件為準並回報設計 agent 修正本文件。需求沒有規定、設計時發現的空白，列在第 16 節「待決問題」，不在本文件中自行決定。

編號慣例：轉移以 `T-`、不變式以 `I-`、待決問題以 `DQ-`、假設以 `DA-`、審查清單以 `R-` 開頭，供 PR 與審查紀錄引用。需求編號（GP-1、AC-GP-1 等）沿用需求文件。

第 16 節的 DQ-1～DQ-12 已全部關閉（DQ-1～DQ-10：2026-11-09 16:02；DQ-11、DQ-12：2026-11-10 16:06）；DQ-13 為 v0.5.1 新增，2026-11-10 16:47 決定採 (b)，規則寫在 review-process.md 第 4 節「偵測形式」。DQ-14 為 v0.6 新增，2026-11-10 22:12（Asia/Taipei） 決定採 (b)，規則寫在 review-process.md 4.1。各章節引用「DQ-n」之處，是指向該問題的決定紀錄，內容已是決定後的設計；之後若再發現需求空白，仍依同一規則新增待決問題，標示「依 DQ-n 決定」，決定前不得實作任何一個選項。

---

## 1. 設計目標與限制摘要

| 目標或限制 | 來源 | 設計對應 |
|---|---|---|
| 純靜態、原生 HTML／CSS／JS，執行時不載入第三方函式庫 | C-2、C-3 | 原生 ES 模組，不打包；建置只複製檔案並注入版本號（第 11 節） |
| 原創圖像、不載入網路字型 | C-4、C-5 | 內嵌 SVG（card-preview.html）；字型堆疊只列系統字型 |
| 遊戲邏輯可在無瀏覽器環境單元測試 | 8.3 候選方案、AC-GP-2 | `src/js/core/` 不碰 DOM、不讀時鐘、不呼叫計時器；時間與亂數由參數注入（第 4、7、8 節） |
| 驗收測試可控制時鐘，NFR-6 又必須用真實時間 | 10.1 | 時間只從注入的 `now()` 取得；計時器以「下一個截止時間」排程（第 6、7 節） |
| 預算 0 | C-1 | 只用 Node.js 內建測試執行器與 Playwright；CI 用公開版本庫免費的標準執行器（verification.md） |

---

## 2. 架構總覽

```
┌──────────────────────── 瀏覽器 ────────────────────────┐
│ index.html ── main.js（啟動、組裝相依）                   │
│                                                         │
│  ui/app.js（畫面路由與控制器）                             │
│    ├─ ui/menu-view.js   選單、清除紀錄確認                  │
│    ├─ ui/game-view.js   狀態列、牌面區、按鈕列、遮蔽層        │
│    ├─ ui/result-view.js 勝利／失敗                         │
│    └─ ui/faces.js       18 種牌面＋牌背 SVG                 │
│         │ 呼叫                         ▲ 讀取 GameView     │
│         ▼                              │                  │
│  core/（純邏輯，可在 Node.js 執行）                         │
│    game.js 狀態機 ─ deal.js 發牌 ─ random.js 亂數介面       │
│    time.js 顯示值 ─ records.js 紀錄比較與驗證 ─ config.js    │
│         ▲ 注入 now()、randomInt()、setTimer()               │
│  platform/（瀏覽器 API 的薄包裝）                           │
│    clock.js（performance.now、setTimeout）                 │
│    storage.js（localStorage，處理例外）                     │
│    visibility.js（visibilitychange，PS-5）                 │
└─────────────────────────────────────────────────────────┘
```

**相依方向：** `ui → core`、`ui → platform`、`main → 全部`。`core` 不依賴任何其他層；`platform` 不依賴 `core`。審查清單 R-8 檢查此方向。

**資料流（單向）：** 玩家操作 → `app.js` 取得 `now` → 呼叫 `game` 的方法 → `game.getView(now)` → 各 view 依 GameView 更新 DOM → `app.js` 依 `game.nextWakeup(now)` 排一個計時器 → 計時器到期時重複「advance → render → 排程」。

---

## 3. 檔案結構

```
/
├─ src/                          發布到 GitHub Pages 的唯一來源
│  ├─ index.html
│  ├─ css/style.css
│  └─ js/
│     ├─ main.js
│     ├─ version.js              建置時產生（第 11 節）；版本庫內為開發用預設值
│     ├─ core/  config.js random.js deal.js time.js game.js records.js
│     ├─ platform/  clock.js storage.js visibility.js
│     └─ ui/  app.js menu-view.js game-view.js result-view.js dialog.js faces.js dom.js
├─ tests/
│  ├─ unit/                      模組單元測試（實作 agent）
│  ├─ acceptance/
│  │  ├─ unit/                   驗收測試：無瀏覽器層（測試 agent）
│  │  └─ e2e/                    驗收測試：端對端層（測試 agent）；timing-real.spec.mjs 為 NFR-6 專用
│  └─ support/                   驗收測試共用工具（測試 agent）
├─ scripts/
│  ├─ build.mjs                  src → dist，注入版本號
│  ├─ serve.mjs                  本機靜態伺服器（Node.js 內建 http，無相依）
│  ├─ check-acceptance-ids.mjs   EQ-4 編號覆蓋檢查（靜態，12.2）
│  ├─ check-acceptance-results.mjs  驗收測試執行結果檢查（12.2.1）
│  ├─ acceptance-reporter.mjs    node:test 自訂 reporter，輸出驗收測試執行結果與斷言計數（12.2.1）
│  ├─ acceptance-reporter-pw.mjs Playwright 自訂 reporter，同上（12.2.1）
│  ├─ check-pr-body.mjs          PR 說明檢查（workflow.md 4.4）
│  └─ review-gate.mjs            EQ-11 審查紀錄判定
├─ .github/
│  ├─ workflows/ ci.yml pr-body.yml review-gate.yml deploy.yml
│  └─ pull_request_template.md   （已存在）
├─ docs/  requirements.md workflow.md design/ test-reports/ uat/
├─ .claude/skills/  agent-dev-workflow/ requirements-spec/ software-design-phase/
├─ playwright.config.mjs
├─ package.json                  只有 devDependencies：@playwright/test
└─ README.md                     EQ-10（Should）
```

- `tests/acceptance/` 與 `tests/support/` 只由測試 agent 修改；`tests/unit/` 與 `src/` 只由實作 agent 修改。審查清單 R-3 檢查。
- `dist/`、`node_modules/`、`test-results/`、`playwright-report/` 列入 `.gitignore`。

---

## 4. 模組與介面

所有時間參數的單位是毫秒（ms），來源是同一個單調時鐘（正式環境為 `performance.now()`）。`core` 的函式**不得**讀取 `Date`、`performance`、`Math.random`、`crypto`、`setTimeout`、`localStorage`、`document`。

### 4.1 core/config.js

```js
/** @typedef {{ id: 1|2|3, name: '簡單'|'普通'|'困難', timeLimitSec: number, faceIds: string[] }} LevelConfig */
export const LEVELS;            // 長度 3，依 id 排序（LV-1）
export function getLevel(id);   // 不存在時丟出錯誤
export const HINTS_PER_PLAY = 3;   // HT-1
export const MISMATCH_LOCK_MS = 1000; // GP-5
export const HINT_MARK_MS = 2000;     // HT-2
```

| 關卡 | name（LV-9） | timeLimitSec（LV-5） | faceIds（card-attributes.json） |
|---|---|---|---|
| 1 | 簡單 | 90 | L1-1～L1-6 |
| 2 | 普通 | 75 | L2-1～L2-6 |
| 3 | 困難 | 60 | L3-1～L3-6 |

### 4.2 core/random.js

```js
/** randomInt(n): 回傳 0..n-1 的均勻整數；n 為 1..2^32 的整數 */
export function createCryptoRandomInt(cryptoObj = globalThis.crypto); // 正式環境與 AC-GP-2 統計使用
```

實作規則：以 `cryptoObj.getRandomValues(new Uint32Array(1))` 取 32 位元整數，用**拒絕取樣**消除取模偏差：`limit = 2^32 − (2^32 mod n)`，取到 `x ≥ limit` 時重抽，回傳 `x mod n`。Node.js 22 的 `globalThis.crypto` 有 `getRandomValues`，所以同一份程式碼可在無瀏覽器環境執行。

### 4.3 core/deal.js

```js
/** 回傳長度 12 的牌面識別碼陣列，索引 0..11 對應牌面區由左至右、由上至下的 DOM 順序 */
export function deal(faceIds /* string[6] */, randomInt) /* : string[12] */;
```

做法：建立 `[f1,f1,f2,f2,…,f6,f6]`，以 Fisher–Yates 洗牌（`for i = 11..1: j = randomInt(i+1); swap(i, j)`）。每次 `deal` 恰好依序呼叫 `randomInt(12)`、`randomInt(11)`、…、`randomInt(2)` 共 11 次，且每次遊玩開始只呼叫一次 `deal`、在任何提示之前；由單元測試固定。依 DQ-7 的決定（(b)＋(c)），這個呼叫順序與下列兩點是端對端測試重算牌面配置的介面契約（第 8 節）：`randomInt` 每抽一次呼叫一次 `cryptoObj.getRandomValues(new Uint32Array(1))`（4.2）；`app.js` 在「開始一次遊玩」的操作處理器中同步呼叫 `deal`，在此之前不呼叫任何其他亂數。正確性與 AC-GP-2 的關係見第 8 節。

### 4.4 core/time.js

```js
export function toTenths(ms);      // 無條件捨去到 0.1 秒，回傳整數（例 12380 → 123）
export function formatTenths(t);   // 123 → "12.3"；50 → "5.0"；0 → "0.0"（AC-TM-2）
```

`toTenths(ms) = Math.floor(Math.round(ms * 1000) / 100000)`：先四捨五入到微秒，消除 `performance.now()` 相減產生的浮點誤差（例如 12399.999999999998 應視為 12400），再無條件捨去到 0.1 秒。

### 4.5 core/game.js（狀態機，第 5 節）

```js
export function createGame({ level /* LevelConfig */, faces /* string[12]，來自 deal() */, randomInt });
// 回傳的物件方法：每個方法第一步都呼叫 advance(now)
game.flip(index, now)   // → 'ignored' | 'first' | 'match' | 'mismatch' | 'won'
game.useHint(now)       // → true（已使用）| false（無效果）
game.pause(now)         // → true | false
game.resume(now)        // → true | false
game.advance(now)       // 處理到期的翻錯鎖定、提示標示、時間上限
game.getView(now)       // → GameView（唯讀快照）
game.nextWakeup(now)    // → 下一次畫面需要更新的時間（同一時鐘的絕對 ms）；不需要時為 null
```

```js
/** @typedef {{
 *  level: 1|2|3, phase: 'ready'|'playing'|'won'|'lost', paused: boolean,
 *  elapsedTenths: number, timeLimitSec: number, moves: number,
 *  hintsLeft: number, hintsUsed: number,
 *  cards: Array<{ index: number, faceId: string, state: 'down'|'up'|'matched', hinted: boolean }>,
 *  canUseHint: boolean, canPause: boolean, canResume: boolean,
 *  result: null | { kind: 'won'|'lost', elapsedTenths: number, moves: number, hintsUsed: number }
 * }} GameView */
```

`GameView.cards[].faceId` 只供畫面層在牌為 `up`／`matched` 且未暫停時決定要畫哪張牌面；背面朝上時，畫面層不得把牌面輸出為可見的圖像、可朗讀的名稱或任何 DOM 屬性。依 DQ-7 的決定，`data-face` 屬性**只在該牌實際渲染牌面時**（`data-shown=face`：`up`／`matched` 且未暫停）輸出；其他時候移除該屬性。

`createGame` 不讀時鐘；遊戲在 `ready` 狀態下不需要時間。第一張牌翻開時以該次 `flip` 的 `now` 作為計時起點（TM-1）。

### 4.6 core/records.js

```js
/** @typedef {{ tenths: number, hintsUsed: number }} TimeRecord
 *  @typedef {{ moves: number, hintsUsed: number }} MovesRecord
 *  @typedef {{ bestTime: TimeRecord|null, fewestMoves: MovesRecord|null }} LevelRecords
 *  @typedef {{ 1: LevelRecords, 2: LevelRecords, 3: LevelRecords }} Records */
export function emptyRecords();                       // 三關六項皆為 null
export function parseRecords(text /* string|null */);  // → { records, status: 'ok'|'empty'|'invalid' }；empty、invalid 時 records 為 emptyRecords()（整份作廢，DQ-4）
export function serializeRecords(records);           // → string（第 9 節格式）
export function mergeWin(records, { level, tenths, moves, hintsUsed });
// → { records, newBestTime: boolean, newFewestMoves: boolean }（RC-1、RC-3、RC-4）
```

`mergeWin` 規則：某項為 null，或本次數值**嚴格小於**既有數值時取代，並以本次的 `hintsUsed` 一起保存；相等不取代（RC-3、「優於」）。時間比較用 `tenths`（顯示值）。`newBestTime`／`newFewestMoves` 在該項被取代時為 true，也就是「該項既有紀錄為 null，或本次嚴格優於既有紀錄」（RS-4 v1.1；DQ-3）；相等或較差時為 false。標示條件與取代條件相同，因此結果畫面的「新紀錄」與選單上紀錄是否更新一致。

### 4.7 platform/clock.js

```js
export const now = () => performance.now();
export function setTimer(atMs, callback);  // 在 now() >= atMs 時呼叫一次；回傳 cancel()
```

`setTimer` 以 `setTimeout(callback, Math.max(0, atMs - now()))` 實作。回呼執行時若 `now() < atMs`（瀏覽器提早喚醒），重新排程，不得提早處理。

### 4.8 platform/storage.js

```js
export const RECORDS_KEY = 'memory-game:records';
export function probeStorage();   // → boolean：寫入並刪除一個測試鍵是否成功
export function readRecordsText(); // → string|null；讀取失敗回傳 null 並標記不可用
export function writeRecordsText(text); // → boolean
export function removeRecords();  // → boolean
```

所有 `localStorage` 存取包在 `try/catch` 中；任何例外都不得往上丟出（RC-8、RC-9）。

### 4.9 platform/visibility.js

```js
export function onHidden(callback); // document.visibilitychange 且 document.visibilityState === 'hidden'
```

### 4.10 ui 層

| 模組 | 職責 |
|---|---|
| `app.js` | 畫面路由（menu／game／result）；持有目前的 `game`；把 DOM 事件轉為 `game` 呼叫；advance → render → 排程迴圈；勝利時讀取、合併、保存紀錄 |
| `menu-view.js` | 選單畫面與紀錄顯示（RC-5）、清除紀錄（RC-7）、版本號（EQ-9）、儲存不可用提示（RC-9） |
| `game-view.js` | 狀態列、牌面區、按鈕列、暫停遮蔽層；只依 GameView 畫，不保存遊戲狀態 |
| `result-view.js` | 勝利與失敗畫面 |
| `dialog.js` | 頁內確認對話框（不用 `window.confirm`，理由見第 10.4 節） |
| `faces.js` | `FACE_SVGS: Record<faceId, string>`、`CARD_BACK_SVG`；內容取自 card-preview.html 第 1～3 節中同 id 的 svg，依 cards.md 第 2 節的轉換規則處理（移除 `id`、`xmlns`，加上 `aria-hidden="true"`、`data-role`），不帶任何含牌面識別碼的屬性 |
| `dom.js` | 建立元素、設定 `data-*` 屬性的小工具 |

### 4.11 UI 測試介面（端對端測試依賴的 DOM 契約）

端對端驗收測試只依下表的選擇器與屬性操作畫面；實作改動這些名稱屬於介面變更，需同步修改本表並經審查。

| 元素 | 選擇器 | 屬性／文字 |
|---|---|---|
| 選單畫面 | `[data-testid="menu"]` | 顯示時可見 |
| 難度按鈕 | `[data-testid="level-1"]`、`level-2`、`level-3` | 文字含「簡單」「普通」「困難」 |
| 紀錄 | `[data-testid="record-<關>-time"]`、`record-<關>-moves` | 無紀錄時文字為「—」；有紀錄時含數值與 `[data-testid="record-<關>-time-hints"]`（提示次數數字） |
| 清除紀錄 | `[data-testid="clear-records"]`；對話框 `confirm-dialog`、`confirm-ok`、`confirm-cancel` | |
| 版本號 | `[data-testid="version"]` | 文字為完整版本號（第 11 節格式） |
| 儲存不可用提示 | `[data-testid="storage-warning"]` | RC-9 |
| 遊戲畫面 | `[data-testid="game"]`，屬性 `data-level`、`data-phase`、`data-paused` | |
| 難度名稱、時間上限 | `level-name`、`time-limit` | `time-limit` 文字只含秒數整數，例「60」 |
| 已用時間、步數、剩餘提示 | `elapsed`、`moves`、`hints-left` | 文字只含數值，例「12.3」「3」「2」；單位放在相鄰元素 |
| 牌 | `[data-testid="card"]`，共 12 個，DOM 順序即索引 0..11 | `data-index`；`data-state`（`down`／`up`／`matched`，為邏輯狀態，暫停時不變）；`data-shown`（`face`／`back`，為實際渲染的內容：暫停中或背面朝上時為 `back`）；`data-hinted`（`true`／`false`）；`data-face`（牌面識別碼，例 `L1-3`）**只在 `data-shown=face` 時存在**，`data-shown=back` 時（背面朝上、暫停中）不存在此屬性（DQ-7 選項 (c)） |
| 牌內圖像 | 牌面 SVG 帶 `data-role="face"`，牌背 SVG 帶 `data-role="back"` | 兩者皆 `aria-hidden="true"`，不帶牌面識別碼 |
| 按鈕 | `btn-hint`、`btn-pause`（暫停中文字改為「繼續」）、`btn-restart`（PS-8；遊戲畫面中一律可用，DQ-1）、`btn-menu` | 無法使用時 `aria-disabled="true"`，不使用 `disabled` 屬性（第 10.4 節） |
| 暫停遮蔽層 | `pause-mask` | 暫停時可見 |
| 結果畫面 | `[data-testid="result"]`，屬性 `data-kind`（`won`／`lost`） | |
| 結果數值 | `result-time`、`result-moves`、`result-hints`、`result-level-name` | 只含數值或難度名稱 |
| 新紀錄標示 | `new-record-time`、`new-record-moves` | RS-4；只在對應的 `newBestTime`／`newFewestMoves` 為 true 時存在（4.6） |
| 結果按鈕 | `btn-replay`、`btn-next-level`（RS-5）、`btn-result-menu` | |

端對端測試如何得知牌面配置（找出同一對、驗證 AC-GP-1／AC-GP-2 的排列）：依 DQ-7 的決定採 (b)＋(c)，做法見第 8 節「端對端測試取得牌面配置」。牌內 SVG 不帶牌面識別碼的可及性名稱；背面朝上或暫停中的牌不以任何可見、可朗讀或 DOM 屬性的方式透露牌面；正式程式不含任何測試專用入口。

---

## 5. 遊戲狀態機

### 5.1 狀態變數

| 變數 | 型別 | 說明 |
|---|---|---|
| `phase` | `ready`／`playing`／`won`／`lost` | `ready`＝尚未開始計時；`won`、`lost` 為終止狀態 |
| `paused` | boolean | 與 `phase` 正交；只在 `ready`、`playing` 時可為 true |
| `cards[12]` | `{ faceId, state }` | `state`：`down`／`up`／`matched` |
| `firstIndex` | number 或 null | 「已翻開一張」的那張牌 |
| `lock` | `{ indices: [a, b], endsAt }` 或 null | 翻錯鎖定；`endsAt` 以遊玩時鐘計（ms） |
| `hint` | `{ indices: [a, b], endsAt }` 或 null | 提示標示；`endsAt` 以遊玩時鐘計 |
| `moves` | 整數 | 步數 |
| `hintsLeft`、`hintsUsed` | 整數 | `hintsLeft + hintsUsed = 3` |
| `accumulatedMs`、`segmentStart` | number | 遊玩時鐘（5.3） |
| `finalPlayMs` | number 或 null | 終止時凍結的遊玩時間 |

### 5.2 狀態（對應需求 6.9 的列）

由狀態變數推得，名稱與需求 6.9 一致：

| 代號 | 狀態（6.9） | 條件 |
|---|---|---|
| S0 | 尚未開始計時 | `phase=ready`、`!paused` |
| S1 | 計時中、無正面未配對的牌 | `phase=playing`、`!paused`、`firstIndex=null`、`lock=null` |
| S2 | 已翻開一張 | `phase=playing`、`!paused`、`firstIndex≠null` |
| S3 | 翻錯鎖定 | `phase=playing`、`!paused`、`lock≠null` |
| H | 提示標示中（與 S1、S2、S3 並存） | `hint≠null` |
| P | 暫停中 | `paused`（可來自 S0、S1、S2、S3，H 可並存） |
| W／L | 勝利／失敗 | `phase=won`／`lost` |

不變式（單元測試必須涵蓋）：

- I-1：`firstIndex≠null` 與 `lock≠null` 不同時成立。
- I-2：`phase` 為 `ready` 或 `playing` 時，`state=up` 的牌恰為 `firstIndex` 或 `lock.indices` 中的牌。終止狀態（`won`／`lost`）下牌的正反面凍結於終止當下，不受 I-2 約束（T-11 取消鎖定時兩張翻錯的牌仍為 `up`）。
- I-3：`hint≠null` 時，`hint.indices` 兩張牌的 `faceId` 相同，且在使用提示當下皆為 `down`。
- I-4：`phase=ready` 時 `moves=0`、`hintsLeft=3`、全部牌 `down`、`hint=null`、`lock=null`。
- I-5：`phase` 為 `won`／`lost` 時 `lock=null`、`hint=null`、`firstIndex=null`、`paused=false`。

### 5.3 遊玩時鐘

- `running = (phase = playing) 且 !paused`。
- `playMs(now) = finalPlayMs ?? (accumulatedMs + (running ? now − segmentStart : 0))`。
- 已用時間、翻錯鎖定、提示標示**共用同一個遊玩時鐘**。暫停時遊玩時鐘停止，三者的剩餘時間自然一併暫停並接續（PS-1、PS-3、PS-9），不需要個別保存剩餘時間。
- `elapsedTenths = toTenths(playMs(now))`（TM-2、術語「顯示值」）。
- `limitMs = timeLimitSec × 1000`。時間上限**一律以顯示值判定**：`limitReached(t) = toTenths(t) ≥ timeLimitSec × 10`（LV-6、A-5）。轉移守衛與 `advance` 都使用 `limitReached`，不直接比較原始值 `t ≥ limitMs`（兩者在 `limitMs − 0.0005 ≤ t < limitMs` 時不同）。排程喚醒時刻仍用 `limitMs`，到期時以 `limitReached` 判定。
- 同理，翻錯鎖定與提示標示的到期判定為 `t ≥ endsAt`（原始值）；兩者沒有顯示值，容差 ±0.1 秒遠大於微秒差異。

### 5.4 轉移

每個方法先呼叫 `advance(now)`，再檢查守衛。守衛不成立時不改變任何狀態（「無效果」）。

| 代號 | 觸發 | 守衛（全部成立才執行） | 效果 | 需求 |
|---|---|---|---|---|
| T-1 | `flip(i)` | `phase=ready`、`!paused`、`cards[i].state=down` | `phase=playing`；`segmentStart=now`、`accumulatedMs=0`；`cards[i]=up`；`firstIndex=i`；回傳 `first` | GP-3、TM-1 |
| T-2 | `flip(i)` | `phase=playing`、`!paused`、`lock=null`、`firstIndex=null`、`cards[i]=down` | `cards[i]=up`；`firstIndex=i`；回傳 `first` | GP-3 |
| T-3 | `flip(i)` | `phase=playing`、`!paused`、`firstIndex≠null`、`cards[i]=down`、同牌面 | `moves+1`；兩張 `matched`；`firstIndex=null`；回傳 `match`。若全部 12 張 `matched` 接 T-4 | GP-4、TM-3 |
| T-4 | T-3 後全部配對 | （隨 T-3） | `finalPlayMs=playMs(now)`；`phase=won`；`hint=null`；回傳 `won` | GP-8、TM-5、6.9 勝利列 |
| T-5 | `flip(i)` | `phase=playing`、`!paused`、`firstIndex≠null`、`cards[i]=down`、不同牌面 | `moves+1`；`cards[i]=up`；`lock={indices:[firstIndex,i], endsAt: playMs(now)+1000}`；`firstIndex=null`；回傳 `mismatch` | GP-5、TM-3 |
| T-6 | `advance` | `lock≠null` 且 `playMs(now) ≥ lock.endsAt` | 兩張牌 `down`；`lock=null` | GP-5 |
| T-7 | `flip(i)` 其他情況 | — | 無效果，回傳 `ignored`：`paused`（PS-2）；`lock≠null`（GP-6）；`cards[i]` 為 `up`／`matched`（GP-7）；`phase` 為 `won`／`lost` | GP-6、GP-7、PS-2 |
| T-8 | `useHint()` | `phase=playing`、`!paused`、`firstIndex=null`、`lock=null`、`hint=null`、`hintsLeft>0` | 從尚未配對的牌面中以 `randomInt` 均勻選一種，標示該牌面的兩張；`hint={indices, endsAt: playMs(now)+2000}`；`hintsLeft−1`、`hintsUsed+1`；不改變任何牌的 `state` 與 `moves` | HT-2、HT-3、HT-9、A-4 |
| T-9 | `useHint()` 其他情況 | — | 無效果：`ready`（HT-10）；`paused`（PS-10）；有正面未配對的牌（HT-7）；標示中（HT-8）；`hintsLeft=0`（HT-4） | 同左 |
| T-10 | `advance` | `hint≠null` 且 `playMs(now) ≥ hint.endsAt` | `hint=null`。標示期間翻牌、配對都不提前結束標示 | HT-2、A-4 |
| T-11 | `advance` | `phase=playing` 且 `limitReached(playMs(now))` | `finalPlayMs=limitMs`；`phase=lost`；`lock=null`、`hint=null`、`firstIndex=null`（取消；牌維持當下的正反面，見 I-2） | LV-6、A-5、TM-5、6.9 |
| T-12 | `pause()` | `phase` 為 `ready` 或 `playing`、`!paused` | `playing` 時 `accumulatedMs += now − segmentStart`；`paused=true` | PS-1、PS-9 |
| T-13 | `resume()` | `paused` | `paused=false`；`playing` 時 `segmentStart=now` | PS-3、PS-9 |
| T-14 | 回到選單、重新開始、重新整理、關閉頁面 | — | `app.js` 丟棄目前的 `game`（不呼叫紀錄保存）；`game` 本身沒有「離開」轉移 | PS-7、PS-8、RC-2、A-6 |

`advance(now)` 的處理順序：計算 `t=playMs(now)`；把 `lock.endsAt ≤ t`、`hint.endsAt ≤ t`、`limitReached(t)` 成立的事件依時間先後處理（上限事件的時刻視為 `limitMs`）；同時到期時依 T-6、T-10、T-11 的順序。T-11 執行後不再處理其他事件。因為 `flip`、`useHint` 都先 `advance`，所以：

- 點擊時刻恰好等於時間上限：先判定失敗，點擊無效（A-5「達到上限之前配對成功才是勝利」）。
- 點擊時刻恰好等於翻錯鎖定結束：鎖定先結束，點擊有效（落在 GP-5 容差內）。

### 5.5 狀態 × 操作（對照需求 6.9）

| 狀態 | 點背面的牌 | 點正面或已配對的牌 | 提示 | 暫停 | 回到選單 | 重新開始（PS-8，S） |
|---|---|---|---|---|---|---|
| S0 尚未開始計時 | T-1：翻開並開始計時（GP-3、TM-1） | 不適用（全部背面） | T-9 無效果（HT-10） | T-12（6.9「可用」） | T-14（PS-7） | 可用：T-14 後以同一關開始新的遊玩（DQ-1） |
| S1 | T-2（GP-3） | T-7（GP-7） | `hintsLeft>0` 時 T-8，否則 T-9（HT-4） | T-12 | T-14 | T-14＋新遊玩 |
| S2 已翻開一張 | T-3／T-5（TM-3） | T-7（GP-7） | T-9（HT-7） | T-12 | T-14 | T-14＋新遊玩 |
| S3 翻錯鎖定 | T-7（GP-6） | T-7（GP-6） | T-9（HT-7） | T-12，鎖定倒數隨遊玩時鐘暫停（PS-9） | T-14 | T-14＋新遊玩 |
| H 提示標示中 | 依並存的 S1／S2／S3 | 依並存的狀態 | T-9（HT-8） | T-12，標示倒數暫停（PS-9） | T-14 | T-14＋新遊玩 |
| P 暫停中 | T-7（PS-2） | T-7（PS-2） | T-9，按鈕可見且不被遮蔽（PS-10） | 按鈕改為「繼續」，T-13（PS-3） | T-14（PS-7） | 可用：T-14＋新遊玩，新遊玩為 S0、未暫停（DQ-1） |
| W／L | 不適用（結果畫面覆蓋） | 不適用 | 不適用 | 不適用 | 結果畫面「回到選單」（RS-3） | 結果畫面「重玩本關」（RS-2） |

### 5.6 狀態 × 計時器（對照需求 6.9）

| 情況 | 已用時間 | 翻錯鎖定倒數 | 提示標示倒數 | 設計 |
|---|---|---|---|---|
| S0 | 0，不累計 | 不存在 | 不存在 | `running=false` |
| S1／S2／S3／H | 累計 | 累計 | 累計 | 共用遊玩時鐘 |
| 暫停中 | 停止（PS-1） | 暫停（PS-9） | 暫停（PS-9） | `running=false` |
| 時間上限在 S3 或 H 中到達 | 停止於上限，判定失敗 | 取消 | 取消 | T-11 |
| 勝利 | 停止（TM-5） | 不適用（I-1：勝利的那次點擊是配對） | 取消 | T-4 |
| 回到選單、重新整理、關閉 | 該次遊玩結束 | 取消 | 取消 | T-14；`app.js` 同時取消 `setTimer` |
| 頁面切到背景 | 同暫停（PS-5 本輪實作，DQ-10）；回到前景維持暫停（DQ-2） | 同左 | 同左 | 第 6.4 節 |

### 5.7 狀態交互檢查（依 requirements-spec 3.8）

除上兩表外，逐項檢查邊界與連續操作：

| 組合 | 結果 | 依據 |
|---|---|---|
| 同一張牌快速點兩次（S1→S2 後再點同張） | 第二次 T-7，步數不變，下一張仍視為第二張 | GP-7、AC-GP-7 |
| 提示標示中再按提示 | T-9 | HT-8 |
| 只剩最後一對、其中一張已翻開時按提示 | T-9（S2） | HT-7、AC-HT-7 |
| 只剩最後一對、沒有正面未配對的牌時按提示 | T-8，必然標示最後一對 | AC-HT-2 |
| 提示標示中翻開被標示的兩張而配對 | T-3；標示仍持續到 2 秒（標示中的牌已配對） | A-4 |
| 提示標示中完成最後一對 | T-4，標示取消 | 6.9 勝利列 |
| 第一張牌翻開前暫停、繼續 | T-12、T-13，仍為 S0，已用時間 0.0 | 6.9 |
| 翻錯鎖定中暫停 3 秒 | 遊玩時鐘停止，鎖定剩餘時間接續 | PS-9、AC-PS-9 |
| 時間上限與翻錯鎖定結束同時到達 | T-6 後 T-11，結果失敗 | A-5 |
| 點擊與時間上限同一時刻 | 先 T-11，點擊無效 | A-5 |
| 已用時間原始值比上限少不到 0.5 微秒（顯示值已達上限）時配對最後一對 | `limitReached` 成立，先 T-11，判定失敗 | LV-6、A-5、術語「顯示值」 |
| 翻錯鎖定中到達上限後，結果畫面下層的牌 | 兩張翻錯的牌維持 `up`，`firstIndex`、`lock` 皆清除（I-2 只約束進行中狀態） | 6.9、I-2、I-5 |
| 暫停中時間上限 | 不可能到達（遊玩時鐘停止） | PS-1 |
| 結果畫面出現後點擊原牌的位置 | 被結果畫面覆蓋；即使事件到達，`phase` 為終止狀態，T-7 | AC-LV-6「牌無法再點擊」 |
| 勝利畫面出現後等待 | `finalPlayMs` 凍結，`nextWakeup=null` | AC-TM-5 |
| 用完 3 次提示後重玩 | 新的 `game`，`hintsLeft=3` | HT-1、AC-HT-1 |
| 計時中切到背景再回來 | 切到背景時 T-12；回到前景仍為 P，遮蔽層顯示、已用時間不變，玩家按「繼續」才 T-13 | PS-5、DQ-2 |
| 暫停中切到背景再回來 | 維持暫停（`canPause` 為 false，不重複暫停） | PS-5、DQ-2 |
| S0 切到背景再回來 | T-12（6.9 S0 可暫停）；回到前景仍為 P，已用時間 0.0 | PS-5、DQ-2 |
| 背景中未收到 `visibilitychange`（例如頁面被直接凍結）而時間上限到達 | 回到前景時 `advance` 判定失敗，已用時間停在上限 | LV-6、6.9（防禦性處理；PS-5 正常運作時不會發生） |
| 暫停中、尚未開始計時時按「重新開始」 | 新遊玩：重新 `deal`、S0、未暫停，已用時間 0.0、步數 0、剩餘提示 3 | PS-8、DQ-1 |
| 翻錯鎖定或提示標示中按「重新開始」 | T-14 取消 `setTimer`；新遊玩不帶入舊的鎖定或標示 | PS-8、T-14 |
| 兩個分頁同時遊玩同一瀏覽器 | 各自獨立；勝利時重新讀取儲存的紀錄再合併，不覆蓋另一分頁剛寫入的較佳紀錄 | RC-3（以保存時的既有紀錄比較） |
| 重新整理後 | 一律顯示選單 | A-6 |

需求沒有規定、經產品負責人決定的組合見第 16 節 DQ-1～DQ-5（已關閉）。

---

## 6. 計時設計

### 6.1 畫面更新：以截止時間排程，不用固定間隔

`game.nextWakeup(now)` 回傳下列時間中最早的一個（換算為同一時鐘的絕對時間）：下一個 0.1 秒的顯示值邊界、`lock.endsAt`、`hint.endsAt`、`limitMs`。`app.js` 以 `setTimer` 在該時間喚醒，執行 `advance → render → 再排程`。暫停、`ready`、終止狀態時回傳 null，不排程。

理由：

- 顯示值在邊界時刻就會更新，不會因為畫面更新頻率而晚一個影格（以固定 16 ms 影格更新時，在 12.40 秒讀到的可能仍是 12.3，AC-TM-2 會失敗）。
- 翻錯鎖定在 1.000 秒、提示標示在 2.000 秒準時結束，驗收的 0.9／1.1 秒檢查點與控制時鐘下的測試結果是確定的。
- 本次已實測：Playwright 時鐘暫停後以 `runFor` 推進，`setTimeout` 在到期的那一毫秒觸發（999 ms 未觸發，1000 ms 觸發，回呼中 `performance.now()` 差值為 1000）。

### 6.2 NFR-6（±0.2 秒）

已用時間由 `performance.now()` 相減取得，不累加計時器間隔，所以沒有累積誤差。誤差來源與上限估計：

| 來源 | 上限 |
|---|---|
| 無條件捨去 | < 0.1 秒（顯示值永遠小於或等於實際值） |
| 計時器延遲（前景分頁的 `setTimeout` 通常數毫秒；在邊界到期後才更新） | 約 0.005～0.02 秒 |
| 測試讀取畫面的往返延遲 | 由測試量測方式決定（見 acceptance-test-plan.md 的 NFR-6 說明） |

合計低於 0.2 秒。顯示值、時間上限判定、結果畫面與紀錄都使用同一個 `elapsedTenths`（術語「顯示值」）。

### 6.3 時間上限

在 `limitMs` 時刻排程喚醒，T-11 判定失敗。最後一對在顯示值達到上限之前（`limitReached` 尚未成立）配對即為勝利（A-5、AC-LV-6）。

### 6.4 背景分頁（PS-5，Should）

**本輪實作**（DQ-10）。做法：`visibility.js` 的 `onHidden` 觸發時，若目前畫面是遊戲且 `canPause`，呼叫 `game.pause(now)` 並重繪（遮蔽層顯示、取消排程）。回到前景時**維持暫停**，不自動繼續，由玩家按「繼續」（DQ-2）。`visibility.js` 不提供「回到前景」的回呼，`app.js` 也不監聽它。選單與結果畫面不受影響。

防禦性處理：若瀏覽器未派送 `visibilitychange`（例如直接凍結頁面），遊玩時鐘照常累計（`performance.now()` 在背景仍前進），回到前景的第一次喚醒會補做所有到期事件，已用時間仍正確。

---

## 7. 時鐘抽象：同時滿足「測試控制時鐘」與「NFR-6 用真實時間」

| 層 | 時鐘來源 | 用途 |
|---|---|---|
| `core` 單元測試與無瀏覽器驗收測試 | 測試直接傳入數字 `now`，例如 `game.flip(0, 1000)` | 狀態機邏輯，完全確定 |
| 端對端驗收測試（NFR-6 以外） | Playwright Clock：在 `page.goto` 前 `clock.install({ time: 0 })`，接著 `clock.pauseAt(…)` 凍結時間，再以 `clock.runFor(ms)` 推進 | 檢查點落在容差邊界（10.1） |
| 端對端 NFR-6 | **不安裝**時鐘，使用真實時間；放在獨立的 `*-realtime` project，以單一 worker 在其他測試之後執行（12.3） | 量測計時準確度 |

正式程式只透過 `platform/clock.js` 的 `now()` 與 `setTimer()` 取得時間。Playwright Clock 會替換 `performance`、`Date`、`setTimeout`、`requestAnimationFrame`（官方 API 文件 https://playwright.dev/docs/api/class-clock ；本次實測確認 `performance.now()` 與 `setTimeout` 都被替換）。因此計時相關的端對端測試不需要任何測試專用的程式入口；牌面配置的取得方式也不需要（第 8 節，DQ-7）。

**已知陷阱（寫入測試計畫與設計 skill）：** `clock.install()` 之後時間仍隨真實時間流動；不先 `pauseAt` 就讀取，檢查點會漂移。

---

## 8. 隨機排列

- 正確性：Fisher–Yates 在 `randomInt` 均勻時，產生 12 個位置的每一種排列機率相同（12! 種）。每種可區分的牌面排列恰對應 2⁶ 種位置排列，所以 7,484,400 種牌面排列機率相同；任一位置為某牌面的機率為 2／12＝1／6（術語「隨機排列」）。
- 拒絕取樣保證 `randomInt` 沒有取模偏差（4.2）。
- 與前一次無關：每次 `deal` 都向 `crypto.getRandomValues` 取新亂數，不保存種子或上次結果。
- 每次遊玩開始（進入關卡、重玩、重新開始）都呼叫一次 `deal`（GP-2）。

**AC-GP-2 的可測介面：**

- 統計部分（60,000 次）在 Node.js 執行：`deal(getLevel(1).faceIds, createCryptoRandomInt())` 呼叫 60,000 次，統計 72 格。與正式程式走完全相同的程式碼路徑。
- 反例：測試以固定回傳 0 的 `randomInt` 呼叫 `deal`，檢查同一個統計函式判定失敗；20 次相鄰比較也應判定失敗。
- 20 次連續遊玩部分在端對端測試執行，排列以下述「端對端測試取得牌面配置」取得。
- 提示選牌（T-8）同樣使用注入的 `randomInt`。

**端對端測試取得牌面配置（DQ-7 決定：(b)＋(c)）：**

1. **記錄（測試端）：** 測試在 `page.goto` 前以 `page.addInitScript` 包裝頁面的 `crypto.getRandomValues`：呼叫原函式後，把回傳陣列的每個值依序附加到一個由測試注入的記錄陣列。正式程式不變、不讀取這個陣列。
2. **錨點：** 測試在每個「開始一次遊玩」的操作（進入關卡、重玩本關、重新開始、挑戰下一個難度）**之前**讀取記錄長度 k。依 4.3 的契約，該操作的處理器第一個消耗亂數的是 `deal`，所以本次遊玩的 `deal` 從第 k 個值開始取。先前遊玩中提示（T-8）消耗的亂數都在 k 之前；`deal` 內拒絕取樣的重抽由步驟 3 的重放自然處理。因此不需要假設每局固定取幾個值，也不需要重放提示選牌。
3. **重算（測試端，Node.js）：** 以 `src/js/core/random.js` 的 `createCryptoRandomInt`，搭配一個從第 k 個值起依序回放的假 `cryptoObj`，呼叫 `src/js/core/deal.js` 的 `deal(getLevel(關).faceIds, randomInt)` 得到 12 個位置的牌面。重放時假 `cryptoObj` 的值用完即視為測試錯誤（記錄不足），不得自行補值。
4. **以畫面驗證（選項 (c)）：** 牌翻到正面時才帶 `data-face`（4.11）。測試翻開牌後比對 `data-face` 與重算結果；AC-GP-1 依重算結果逐對翻開全部 6 對，確認每張翻開的牌 `data-face` 都與重算一致、6 對全部配對成功，證明畫面上的配置確為 6 種各 2 張。重算與畫面不一致時，視為產品或契約錯誤，不得改用其他方式繞過。
5. **不洩漏：** 背面朝上與暫停中的牌沒有 `data-face`；AC-GP-1、AC-PS-4 的測試同時檢查這一點（反例）。

測試 agent 把步驟 1～3 寫成 `tests/support/` 的單一共用輔助函式，所有端對端測試只透過它取得配置。

---

## 9. 紀錄儲存

### 9.1 格式（localStorage 鍵 `memory-game:records`）

```json
{
  "schemaVersion": 1,
  "levels": {
    "1": { "bestTime": { "tenths": 250, "hintsUsed": 2 }, "fewestMoves": { "moves": 18, "hintsUsed": 1 } },
    "2": { "bestTime": null, "fewestMoves": null },
    "3": { "bestTime": null, "fewestMoves": null }
  }
}
```

- 時間以「十分之一秒」整數保存（顯示值），避免浮點比較（RC-3）。
- `schemaVersion` 供日後遷移；本輪只接受 1。
- 測試 agent 可依此格式在 `page.addInitScript` 中預先寫入紀錄（AC-RC-1、AC-RC-3 等）。本格式屬介面，變更需同步修改測試。

### 9.2 驗證（`parseRecords`）

符合下列**全部**條件才為 `ok`；`text` 為 null 為 `empty`；其他一律為 `invalid`：

1. `JSON.parse` 成功，結果為物件。
2. `schemaVersion === 1`。
3. `levels` 為物件，含 `"1"`、`"2"`、`"3"` 三個鍵，各為物件，各有 `bestTime`、`fewestMoves` 兩個鍵。
4. `bestTime` 為 null，或 `{ tenths, hintsUsed }`：`tenths` 為整數且 `0 ≤ tenths < 該關 timeLimitSec × 10`；`hintsUsed` 為 0～3 的整數。
5. `fewestMoves` 為 null，或 `{ moves, hintsUsed }`：`moves` 為整數且 `6 ≤ moves ≤ 100000`；`hintsUsed` 為 0～3 的整數。
6. 多出的欄位忽略。

**格式不符時整份作廢（DQ-4 選項 (a)）：** 任一條件不成立（包括只有某一關的某一項不符），`parseRecords` 回傳 `{ records: emptyRecords(), status: 'invalid' }`，三關六項全部視為無紀錄（RC-8）。載入時不改寫儲存內容；**下一次勝利保存時以新資料覆寫整份，原資料中其他關卡的內容永久遺失**，這是產品負責人接受的連帶影響。不做逐項保留，也不另存備份。主控台不得出現未處理的錯誤（AC-RC-8）。

### 9.3 讀寫流程

| 時點 | 動作 |
|---|---|
| 頁面載入 | `probeStorage()` 決定是否顯示「紀錄無法保存」；`readRecordsText()` → `parseRecords` → 選單顯示 |
| 勝利（儲存可用） | **重新讀取** → `parseRecords`（`invalid` 時以 `emptyRecords()` 為合併基礎，DQ-4）→ `mergeWin` → `writeRecordsText`。`newBestTime`／`newFewestMoves` 提供給結果畫面（RS-4）。寫入失敗時轉為「儲存不可用」（9.4），本次合併結果保留在記憶體 |
| 勝利（儲存不可用） | 不重新讀取；以記憶體中的紀錄 `mergeWin`，結果保留在記憶體並供選單顯示（9.4，DQ-5）；仍嘗試寫入一次，失敗不報錯 |
| 失敗、回到選單、重新開始、重新整理 | 不讀不寫（RC-2） |
| 清除紀錄並確認 | `removeRecords()`，記憶體中的紀錄同時設為 `emptyRecords()`；取消時不動作（RC-7） |

### 9.4 儲存不可用（RC-9，Should）

`probeStorage()` 失敗或任何寫入失敗時，`app.js` 把本次開啟標記為「儲存不可用」，直到頁面關閉或重新整理：

- 遊戲照常進行；選單顯示「紀錄無法保存」提示（`storage-warning`），之後一直顯示。
- **本次開啟期間的勝利保留在記憶體並在選單顯示（DQ-5）**：載入時若能讀取，以 `parseRecords` 的結果作為記憶體紀錄的初值，否則為 `emptyRecords()`；之後以記憶體紀錄為準，不再重新讀取儲存。關閉或重新整理頁面後記憶體紀錄消失。
- 結果畫面的「新紀錄」以記憶體紀錄判定（4.6），與選單一致。
- 任何讀寫例外都不往上丟出（4.8）。

---

## 10. 畫面

### 10.1 共通

- 字型：`system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif`，不載入網路字型（C-5）。
- 顏色以 CSS 自訂屬性定義在 `:root`；牌面顏色見 card-attributes.json（Okabe–Ito 色票，避免只靠紅綠區分）。
- 介面文字只用難度名稱，任何畫面都不出現「第 N 關」（LV-9）。

### 10.2 版面與尺寸計算（NFR-3、NFR-5、NFR-4）

**固定尺寸（實作必須照此寫 CSS，不得依賴字型的預設行高）：**

| 元素 | CSS | 高度 |
|---|---|---|
| 狀態列 | `height: 52px; box-sizing: border-box; padding: 6px 8px;` 兩行，每行 `font-size: 16px; line-height: 20px; white-space: nowrap;` | Hs＝52 |
| 按鈕 | `height: 48px; min-width: 48px; font-size: 16px; line-height: 20px; white-space: nowrap;` | 48 |
| 按鈕列 | `height: 56px; padding: 4px 0;` | Hb＝56 |
| 外距、區塊間距、牌間距 | 8 px | m＝g＝8 |

**餘裕規則：** 每個要求的視窗尺寸，垂直與水平都至少保留 4 px 餘裕（吸收子像素取整與瀏覽器差異）。算式中的「−4」即此餘裕。牌為正方形，邊長 s 取整數（無條件捨去）；s ≤ 240。

**直向（W ≤ H）：3 欄 × 4 列，狀態列在上、按鈕列在下**

- 垂直固定佔用 F＝m＋Hs＋8＋8＋Hb＋m＝8＋52＋8＋8＋56＋8＝140
- s＝floor(min((W − 2m − 2g − 4)／3, (H − F − 3g − 4)／4))

**橫向且 H ≥ 500：4 欄 × 3 列，狀態列在上、按鈕列在下**

- s＝floor(min((W − 2m − 3g − 4)／4, (H − F − 2g − 4)／3))

**橫向且 H < 500（手機橫向，NFR-4）：4 欄 × 3 列，狀態與按鈕放左側欄**

- 側欄寬 P＝176，內容由上而下：狀態區 5 行（難度、限時、時間、步數、提示）× 20＋上下 6＝112；間距 8；4 個按鈕直排 4×48＋3×8＝216。側欄總高 336。
- s＝floor(min((W − 2m − P − 8 − 3g − 4)／4, (H − 2m − 2g − 4)／3))

| 視窗 | 版面 | 寬度限制 | 高度限制 | s | 使用高度（餘裕） | 使用寬度（餘裕） |
|---|---|---|---|---|---|---|
| 360×640 | 直向 3×4 | (360−32−4)／3＝108 | (640−140−24−4)／4＝118 | **108** | 140＋432＋24＝596（44） | 16＋324＋16＝356（4） |
| 390×844 | 直向 3×4 | (390−36)／3＝118 | (844−168)／4＝169 | 118 | 140＋472＋24＝636（208） | 16＋354＋16＝386（4） |
| 768×1024 | 直向 3×4 | (768−36)／3＝244 | (1024−168)／4＝214 | 214 | 140＋856＋24＝1020（4） | 16＋642＋16＝674（94） |
| 1280×720 | 橫向 4×3 | (1280−44)／4＝309 | (720−160)／3＝186.7 | 186 | 140＋558＋16＝714（6） | 24＋744＋16＝784（496） |
| 1920×1080 | 橫向 4×3 | 469 | (1080−160)／3＝306.7 | 240（上限） | 140＋720＋16＝876（204） | 1000（920） |
| 844×390（S） | 側欄 4×3 | (844−16−176−8−24−4)／4＝154 | (390−16−16−4)／3＝118 | 118 | 16＋354＋16＝386（4）；側欄 8＋336＋8＝352（38） | 8＋176＋8＋472＋24＋8＝696（148） |

**360×640 的按鈕（NFR-5）：** 按鈕列寬 360−16＝344。4 個按鈕（提示、暫停、重新開始、回到選單）：(344−3×8)／4＝80，每個 80×48。PS-8 本輪實作（DQ-10），在 PR-6 加入；PR-4、PR-5 期間為 3 個按鈕，各 (344−16)／3＝109×48。兩種按鈕數都滿足 NFR-5，PR-6 加入按鈕後 PR-4 已實測的 NFR-5 遊戲畫面與 NFR-3 仍須通過。「回到選單」四個字以 16 px 約 64 px 寬，放得下。牌 108×108。兩者都 ≥ 44×44，且高度有 4 px 以上餘裕。

**狀態列文字寬度（360×640）：** 第 1 行「困難　限時 60 秒」約 9 個全形字寬 144 px；第 2 行「時間 89.9　步數 99　提示 3」約 15 個字寬 240 px；皆 ≤ 344，不換行。

**實作規則：**

- 用 CSS `min()` 與 `100dvh`（後備 `100vh`）計算 s；依 `@media (orientation: portrait)`、`(orientation: landscape) and (min-height: 500px)`、`(orientation: landscape) and (max-height: 499.98px)` 切換版面。
- 狀態列、按鈕列、側欄的高度以上表的固定值設定，文字一律 `white-space: nowrap`。
- **不得用 `overflow: hidden` 掩蓋溢出**；版面必須真的放得下，NFR-3 的測試才有意義。
- 牌面區的 DOM 順序固定為索引 0..11，不同版面只改變 CSS grid 的欄數。

### 10.3 各畫面元素

**選單（`menu`）**

| 元素 | 內容 | 需求 |
|---|---|---|
| 標題 | 「翻牌記憶」 | — |
| 三個難度區塊（由上而下） | 按鈕「簡單／普通／困難」＋「限時 90／75／60 秒」；其下兩行紀錄：「最佳時間 25.0 秒（提示 2 次）」「最少步數 16 步（提示 0 次）」，無紀錄顯示「—」 | LV-1、LV-7、LV-9、RC-4、RC-5 |
| 清除紀錄按鈕 | 開啟頁內確認對話框：「清除三個難度的全部紀錄？」〔取消〕〔清除〕 | RC-7 |
| 說明文字 | 「紀錄只存在此瀏覽器」 | 需求第 9 節風險對策（設計決定顯示） |
| 儲存不可用提示 | 「紀錄無法保存」，只在不可用時顯示；不可用期間選單仍顯示本次開啟期間的紀錄（9.4） | RC-9、DQ-5 |
| 版本號 | 頁尾「版本 1.0.0+abc1234」 | EQ-9 |

360×640 高度估算（按鈕高 48、文字行高 20）：標題 48＋3×(48＋2×20＋16)＝312＋清除按鈕 48＋說明與版本 2×20＋間距 6×8＝48＋外距 16＝512 ≤ 636（保留 4 px 餘裕）；儲存不可用時多一行提示與一個間距（20＋8），為 540 ≤ 636。選單文字一律 `white-space: nowrap`；紀錄行「最佳時間 89.9 秒（提示 3 次）」約 17 個字寬 272 px ≤ 344。

**遊戲（`game`）**

| 區域 | 元素 | 需求 |
|---|---|---|
| 狀態列第 1 行 | 難度名稱、「限時 60 秒」 | LV-8、LV-9 |
| 狀態列第 2 行 | 「時間 12.3」「步數 3」「提示 2」 | TM-2、TM-4、HT-5 |
| 牌面區 | 12 張牌；背面顯示牌背 SVG；正面與已配對顯示牌面 SVG；已配對的牌降低不透明度並加細框；提示標示為 4 px 黃色外框＋2 px 深色內框（不只靠顏色） | GP-1、GP-3、GP-4、HT-2 |
| 暫停遮蔽層 | **只覆蓋牌面區**的不透明面板，顯示「已暫停」；同時牌面區不渲染任何牌面 SVG（全部以牌背呈現，12 張 `data-shown=back`），雙重保證 | PS-4 |
| 按鈕列 | 提示、暫停／繼續、重新開始（PS-8）、回到選單。遮蔽層不覆蓋按鈕列，所以暫停時提示按鈕可見、最上層元素是它本身 | HT-4、HT-7、HT-8、HT-10、PS-7、PS-10 |

**勝利（`result`，`data-kind="won"`）：** 以覆蓋整個視窗的面板呈現（牌面區仍在下層 DOM 中，但點擊會落在面板上）。內容：難度名稱＋「完成」；時間 42.3 秒、步數 14、使用提示 1 次（RS-1）；項目旁「新紀錄」（RS-4）；按鈕〔重玩本關〕（RS-2）、〔挑戰下一個難度〕（只在簡單、普通，RS-5）、〔回到選單〕（RS-3）。RS-4、RS-5 本輪實作（DQ-10），在 PR-6 加入。360×640 高度估算：標題 48＋三行數值 3×20＋三個按鈕 3×48＋間距 6×8＋外距 16＝316 ≤ 636。

**失敗（`data-kind="lost"`）：** 難度名稱＋「時間到」；按鈕〔重玩本關〕、〔回到選單〕。不另外顯示需求沒要求的統計。

### 10.4 互動細節

- **無法使用的按鈕**用 `aria-disabled="true"`＋停用樣式，事件處理器忽略點擊；**不使用 `disabled` 屬性**。理由：需求「無法使用」要求點擊後沒有效果且按鈕仍是最上層元素（AC-PS-10）；`disabled` 會讓部分瀏覽器不派送事件，測試無法區分「被蓋住」與「被停用」。另本次實測：Playwright 對 `aria-disabled="true"` 與 `disabled` 的元素，`locator.click()` 都會等待到逾時，測試須以 `page.mouse.click(x, y)` 在中心點點擊（acceptance-test-plan.md 第 4 節）。
- **確認對話框**用頁內元素，不用 `window.confirm`：可控制按鈕尺寸（NFR-5）並以 DOM 測試。
- **iOS 雙擊縮放與點擊延遲：** `<meta name="viewport" content="width=device-width, initial-scale=1">`（不使用 `viewport-fit=cover`，讓瀏覽器自動避開瀏海與圓角安全區，側欄版面不會被遮住）；`html { touch-action: manipulation; }`（停用雙擊縮放並移除點擊延遲）；牌與按鈕 `-webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;`；懸停樣式放在 `@media (hover: hover)`；只監聽 `click`，不同時監聽 `touchstart`，避免同一次觸控觸發兩次。不使用 `user-scalable=no`（iOS 會忽略，且影響可及性）。U-6 由產品負責人實機確認。
- 每張牌是 `<button type="button">`，點擊區域即整張牌（NFR-5）。

---

## 11. 建置與版本號（EQ-9）

- **格式：** `<package.json 的 version>+<commit 短碼 7 碼>`，例 `1.0.0+3f9c2ab`。`package.json` 的 `version` 本輪固定為 `1.0.0`（本輪只發布 v1.0.0；UAT 記錄的版本號與 v1.0.0 標籤指向同一 commit，對應 EQ-13）。
- **注入方式：** `scripts/build.mjs` 把 `src/` 複製到 `dist/`，並覆寫 `dist/js/version.js` 為 `export const APP_VERSION = '1.0.0+3f9c2ab';`。短碼取自環境變數 `BUILD_SHA` 的前 7 碼；沒有時用 `git rev-parse --short=7 HEAD`；再沒有時為 `dev`。版本庫中的 `src/js/version.js` 內容為 `'1.0.0+dev'`。
- **commit 的選擇：** 部署工作流程用 `GITHUB_SHA`（推送主分支的 commit）。PR 的 CI 用 `github.event.pull_request.head.sha`，**不用** `GITHUB_SHA`（`pull_request` 事件的 `GITHUB_SHA` 是合併 commit，不是 PR 的 commit）。
- **建置與驗證取得同一個值（v0.5，PR-1 審查 N-6）：** ci.yml 的 e2e job 在 **job 層級**的 `env:` 設定 `BUILD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}`，建置步驟與兩個 Playwright 步驟都讀同一個值。PR-1 只在建置步驟設定，測試步驟沒有 `BUILD_SHA`，AC-EQ-9 第二個測試在 CI 只能檢查格式，CI 中沒有任何檢查確認「受測的 dist/ 顯示 PR head commit」；第一個測試以 `git rev-parse HEAD` 自行建置，在 `pull_request` 事件下 HEAD 是合併 commit，只證明建置指令本身正確。因此**需要修正**。修正後 AC-EQ-9 第二個測試在 CI 中（`CI` 環境變數存在時）必須取得 `BUILD_SHA`，缺少即失敗，不得退回只檢查格式（acceptance-test-plan.md #51）。
- **受測內容與版本號的關係：** e2e 簽出的是合併 commit，版本號顯示 PR head。分支保護要求分支為最新（12.6 步驟 6a），PR head 已包含 main 最新 commit 時，合併 commit 的檔案樹與 PR head 相同，因此兩者描述同一份內容。
- 不使用任何第三方工具；執行時只是一個常數模組（C-2）。
- 本機開發：`node scripts/serve.mjs src` 直接提供 `src/`（版本顯示 `1.0.0+dev`）；`node scripts/build.mjs && node scripts/serve.mjs dist` 提供建置結果。ES 模組不能從 `file://` 載入，所以 README 必須寫明用本機伺服器。

---

## 12. CI／CD

### 12.1 工作流程清單

| 檔案 | job（必要檢查名稱） | 觸發 | 內容 | 需求 |
|---|---|---|---|---|
| ci.yml | `unit` | `pull_request`（opened、synchronize、reopened）、`push` 到 main | 步驟 1：`node --test 'tests/unit/**/*.test.mjs'`。步驟 2：`node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=./scripts/acceptance-reporter.mjs --test-reporter-destination=acceptance-results/unit.jsonl 'tests/acceptance/unit/**/*.test.mjs'`（先 `mkdir -p acceptance-results`）。步驟 3：`node scripts/check-acceptance-results.mjs --layer unit acceptance-results/unit.jsonl`（12.2.1「結果檔的交接」）。以引號傳 glob（本次實測 Node.js 22 傳入**目錄**會以「Cannot find module」失敗，傳 glob 可正確執行）。v0.5 起兩類測試分兩次執行，是為了取得只含驗收測試的結果檔；執行的測試集合不變 | EQ-3、EQ-4、M3 離開條件 |
| ci.yml | `acceptance-ids` | 同上 | `node scripts/check-acceptance-ids.mjs` | EQ-4 |
| ci.yml | `e2e (chromium)`、`e2e (firefox)`、`e2e (webkit)` | 同上 | 矩陣三引擎；job 層級 `env: BUILD_SHA=<PR head sha>`（第 11 節）；建置；`npx playwright install --with-deps <引擎>`；第一步 `npx playwright test --project=<引擎>`；第二步 `npx playwright test --project=<引擎>-realtime --workers=1`（NFR-6，見 12.3）；兩步各以自訂 reporter `scripts/acceptance-reporter-pw.mjs` 另外輸出結果檔（步驟層級 `env: ACCEPTANCE_RESULTS_FILE` 分別為 `acceptance-results/e2e.jsonl`、`acceptance-results/e2e-realtime.jsonl`）；第三步 `node scripts/check-acceptance-results.mjs --layer e2e acceptance-results/e2e.jsonl acceptance-results/e2e-realtime.jsonl`（12.2.1「結果檔的交接」） | EQ-3、NFR-1、EQ-9、M3 離開條件 |
| pr-body.yml | `pr-body` | `pull_request`（opened、edited、synchronize、reopened） | `node scripts/check-pr-body.mjs`（12.4） | workflow.md 4.4 |
| review-gate.yml | （寫入 commit status `review-record`） | `pull_request_target`（opened、synchronize、reopened、edited；edited 讓 PR 說明的作者工作階段變更時重新判定）、`issue_comment`（created、edited、deleted） | `node scripts/review-gate.mjs`（第 13 節、review-process.md 第 4 節） | EQ-5、EQ-11 |
| deploy.yml | `deploy`、`smoke` | `push` 到 main | 建置 → upload-pages-artifact → deploy-pages；`smoke` 輪詢公開網址版本號 | EQ-9、EQ-12 |

**共同設定：**

- **必要檢查名稱不變。** v0.5 在既有 job 內新增步驟，不新增或改名 job；分支保護的必要檢查清單（12.6 步驟 6a）不需變更。
- `runs-on: ubuntu-latest`（標準執行器，免費）；`actions/setup-node` 指定 Node.js 22；每個工作流程以 `permissions` 宣告最小權限。
- **並行群組：**
  - ci.yml、pr-body.yml：`group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`；PR 事件 `cancel-in-progress: true`（新 commit 取代舊執行），`push` 事件 `false`。
  - review-gate.yml：`group: review-gate-${{ github.event.pull_request.number || github.event.issue.number }}`、`cancel-in-progress: false`（序列化；每次執行都重新讀取最新狀態，最後完成的執行就是依最新狀態寫入的那次）。
  - deploy.yml：`group: pages`、`cancel-in-progress: false`。
- **指令注入防護（全部工作流程）：** 不得在 `run:` 中以 `${{ }}` 插值任何使用者可控的事件內容（評論內容、PR 標題與說明、分支名稱 `head.ref` 等）。需要的值以 `env:` 傳入數字型欄位（PR 編號、`github.sha`），其餘由腳本經 API 或事件檔（`GITHUB_EVENT_PATH`）讀取。
- review-gate.yml 與 pr-body.yml 不執行 `npm install`、不使用 `actions/cache`；腳本只用 Node.js 內建模組。

### 12.2 編號覆蓋檢查（`check-acceptance-ids.mjs`，EQ-4）

v0.5 修訂（PR-1 審查 N-2 與實作、測試 agent 回報）：掃描範圍限定為驗收測試目錄；單元測試不得帶驗收編號；驗收測試只允許一種略過寫法（骨架宣告）；靜態偵測無法涵蓋的寫法改由 12.2.1 的執行結果檢查判定。

點號對照（程式與測試的註解、測試名稱引用舊點號者，在 PR-1b 一併更新）：v0.4 第 1、2 點＝v0.5 第 1、2 點；v0.4 第 3 點（收集名稱）→ 第 6 點；第 4 點（完整編號比對）→ 第 7 點；第 5 點（略過判定、`--no-skip`）→ 第 8～10 點；第 6 點（AC-EQ-4）→ 第 11 點；第 7 點（多範圍）→ 第 12 點。第 3～5、8、9 點為新增。

1. 從 `docs/requirements.md` 解析必要編號：
   - 第 10.2 節以 `**AC-…**（自動）` 或 `**AC-…**（自動＋人工）` 開頭的段落標題；一個標題可含多個以「、」分隔的編號（AC-LV-2、AC-LV-3、AC-LV-4）。
   - 第 13 節追溯矩陣中優先為 M、驗證為「自動」的 NFR，排除 NFR-1（EQ-4 例外）。
2. 讀取 `docs/design/supplementary-acceptance.json` 中 `enforced: true` 的設計補充驗收編號（Should 需求，第 15 節）。
3. **掃描範圍（v0.5）：** 採計覆蓋的測試**只來自** `tests/acceptance/`。`tests/unit/`（實作 agent 的模組單元測試）的測試名稱**一律不採計**為覆蓋，不論是否含編號。理由：EQ-4 要求的是驗收測試（agent-dev-workflow 3.1），單元測試由實作 agent 撰寫；若採計，實作 agent 可以用單元測試「冒充」驗收，等於放寬 EQ-4，也違反「寫程式的人不判定自己合格」。
4. **驗收測試檔的位置（v0.5）：** `tests/acceptance/` 下的測試檔只能是 `tests/acceptance/unit/**/*.test.mjs`（由 `unit` job 的 glob 執行）或 `tests/acceptance/e2e/**/*.spec.mjs`（由 Playwright `testDir` 執行）。其他位置或副檔名的測試檔，一律判定失敗並列出檔名：判定對象是 `tests/acceptance/` 下檔名符合 `*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` 的**任何**檔案（第 3 輪審查 P-3：Playwright 預設 `testMatch` 也會執行 `*.spec.js`、`*.test.ts` 等），例如 `tests/acceptance/x.test.mjs`、`tests/acceptance/unit/x.spec.mjs`、`tests/acceptance/e2e/x.test.ts`。前兩者會被靜態掃描看到、卻不會被執行；後者會被 Playwright 執行、卻不在靜態掃描中。12.3 同時把 Playwright 一般 project 的 `testMatch` 限定為 `*.spec.mjs`，讓執行範圍與本點一致。
5. **單元測試不得帶驗收編號（v0.5）：** 掃描 `tests/unit/**/*.test.mjs` 的測試名稱（同第 6 點的收集規則），任一名稱以完整編號比對含有第 1、2 點的必要編號時失敗，列出檔名、行號與編號。這把 module-test-standards.md 第 1 節「單元測試不得以驗收編號命名」改為檢查強制；與第 3 點並用：第 3 點讓冒充無效，本點讓冒充與誤命名在 PR 中就被發現。只比對必要編號（例如 `NFR-1` 不是必要編號，不受限）。
6. 收集測試名稱：靜態掃描上述檔案中 `test(`、`it(`、`describe(`、`test.describe(` 及其 `.skip`、`.fixme`、`.todo`、`.only` 變體的第一個字串參數。不採計註解與字串資料中的內容。
7. 每個必要編號至少出現在 `tests/acceptance/` 的一個測試名稱中（以完整編號比對，`AC-GP-1` 不得被 `AC-GP-10` 誤判），否則列出缺少的編號並以非零狀態結束。
8. **驗收測試的略過寫法（v0.5）：** `tests/acceptance/` 中**唯一允許**的略過寫法是骨架宣告：在檔案最上層（不在任何 `describe` 內）呼叫 `test.skip(<名稱字串>, <函式>)`，第一個參數是字串字面值、第二個參數是**本體為空**的函式（`() => {}` 或 `async () => {}`，可帶參數，本體不得有任何敘述；第 3 輪審查 M-1）。本點只掃描測試檔（第 4 點的檔案）；`tests/support/` 的輔助模組不做靜態掃描，由 12.2.1 的執行結果涵蓋。下列寫法在 `tests/acceptance/` 中**一律判定失敗**（不論是否有 `--no-skip`），列出檔名與行號：
   - 宣告形式的其他變體：`test.fixme(名稱, …)`、`test.fail(名稱, …)`、`test.todo(…)`、`it.skip`、`it.todo`、`describe.skip`、`describe.todo`、`suite.skip`、`test.describe.skip`、`test.describe.fixme`、`test.step.skip`，以及任何 `.only`。
   - 測試本體或 `describe` 本體中的執行期呼叫：`test.skip()`、`test.skip(條件)`、`test.skip(條件, 說明)`、`test.fixme(…)`、`test.fail(…)`；node:test 的 `t.skip()`、`t.todo()`；Playwright 的 `testInfo.skip()`、`testInfo.fixme()`、`testInfo.fail()`。
   - 選項物件：`{ skip: … }`、`{ todo: … }`、`{ annotation: { type: 'skip'|'fixme'|'fail' } }`（含陣列形式）、`{ expectFailure: … }`。
   - 偵測規則（不逐一列舉也要涵蓋）：在 `tests/acceptance/` 的程式碼中（不含註解與字串資料），名稱為 `skip`、`fixme`、`fail`、`todo`、`only`、`expectFailure` 的**屬性存取**（`.skip`）、**計算屬性**（`['skip']`）與**物件鍵**（`skip:`），以及值為 `'skip'`、`'fixme'`、`'fail'` 的 `type` 鍵，除了上述骨架宣告之外都判定失敗。唯一例外是 `assert.fail(…)`（node:assert 的斷言，會讓測試失敗而不是改變預期結果）：接收者為 `assert` 的 `.fail` 不受限。
   - 註：`test.describe.serial.skip` 在本專案使用的 Playwright 1.63 不存在（本次實測：載入時 `TypeError: test.describe.serial.skip is not a function`，該檔全部測試不執行），但依上一點的屬性規則同樣被判定失敗；即使未被判定，12.2.1 也會因該檔沒有任何執行結果而失敗。
9. **靜態偵測的界限：** 別名（`const s = test.skip; s(…)`）、動態組字（`test['sk' + 'ip']`）、由輔助模組間接呼叫等寫法，靜態掃描無法保證涵蓋。因此第 8 點只是快速、可指出行號的第一道檢查，**是否略過、是否預期失敗、是否實際執行，一律以 12.2.1 的執行結果為準**。
9a. **非骨架測試至少有一個斷言呼叫（第 3 輪審查 M-1）：** `tests/acceptance/` 中骨架以外的每個 `test(…)`，其本體（不含註解與字串資料）至少有一個呼叫，其被呼叫者的第一個識別字以 `expect` 或 `assert` 開頭（例：`expect(…)`、`expect.soft(…)`、`expect.poll(…)`、`assert.equal(…)`，或 `tests/support/` 中以 `expect`／`assert` 開頭命名的斷言輔助函式），否則判定失敗並列出檔名、行號與名稱。這讓「刪掉 `.skip` 留下空本體」的骨架直接失敗；它擋不住 `expect(true).toBe(true)` 這類刻意的空斷言，也擋不住斷言寫在永遠不會執行的分支中，這兩者由 12.2.1 第 6 項與審查清單 R-15 處理。
9b. **同一檔案的測試名稱不得重複（第 3 輪審查 P-2）：** `tests/acceptance/` 同一檔案中，「外層 `describe` 名稱路徑＋測試名稱」相同的測試超過一個時判定失敗。理由：12.2.1 以檔案與名稱把執行結果對應到靜態掃描（骨架的豁免、未執行的判定），名稱重複時，非骨架測試可以借用骨架的名稱得到豁免。Playwright 本身已禁止同名，node:test 沒有禁止。
9c. **node:test 驗收測試的斷言來源（第 3 輪審查 M-1）：** `tests/acceptance/unit/` 的測試檔必須自 `tests/support/assertions.mjs` 匯入 `assert`，且不得匯入 `node:assert`、`node:assert/strict`、`assert`、`assert/strict`；否則判定失敗。理由見 12.2.1 第 6 項（node:test 沒有內建的斷言計數）。**本點適用於該目錄下的每個測試檔，包括只含骨架宣告的檔案**（v0.5.1 簽核後釐清，實作 agent 依 agent-dev-workflow 5.1 詢問）。理由：(1) 規則以檔案為單位、不依檔案內容分支，靜態檢查最單純；(2) 骨架轉實測的 PR 不必另外記得加匯入；(3) 豁免與不豁免的嚴格程度相同：檔案中只要有一個非骨架測試就不再是「只含骨架」，本點立即適用，12.2.1 第 6 項也會在執行時判定，所以豁免不會讓任何測試逃過斷言計數。既然沒有安全差異，選較單純、不需例外的規則。匯入後骨架不執行 hook（12.2.1 實測），沒有副作用。acceptance-test-plan.md 第 1 節「無瀏覽器層一律自 `tests/support/assertions.mjs` 匯入 `assert`」即此意。Playwright 驗收測試不受此限，以 `@playwright/test` 的 `expect` 斷言（其他斷言方式不會被計數，12.2.1 第 6 項會判定為沒有斷言）。
9d. **樣板字面值的測試名稱（v0.6.1；PR #3 審查紀錄「發現的問題」第 3 點）：** `tests/acceptance/` 中 `test(`、`it(`、`describe(`、`test.describe(`，以及它們的修飾變體（`.skip`、`.only`、`.fixme`、`.todo`、`.serial` 等；v0.6.2 寫明，實作已如此檢查）的第一個參數為含 `${` 的樣板字面值時：(1) 第一個 `${` 之前的固定文字（前綴）去除前後空白後必須非空，否則失敗「樣板名稱的固定前綴為空」；(2) 同一檔案中，任一樣板前綴不得是另一個測試名稱（字串字面值或不含 `${` 的樣板）或另一個樣板前綴的前綴（含相等），否則失敗「樣板名稱前綴不唯一」。兩者都列出檔名與行號。理由：12.2.1 第 4 項以前綴比對樣板名稱的執行結果；前綴為空時與同檔任何結果相符，前綴互為前綴時一筆結果可同時滿足兩個靜態測試，沒有執行的測試因而不被發現。骨架宣告的名稱本來就必須是字串字面值（第 8 點），不受影響；目前 `tests/acceptance/` 沒有以樣板字面值命名的測試（樣板只出現在字串資料與斷言訊息中）。
9e. **node:test 驗收測試不得使用子測試與並行（v0.6.1；PR #3 審查紀錄「發現的問題」第 4(b) 點）：** `tests/acceptance/unit/` 的程式碼中（不含註解與字串資料）：(1) 在 `test(…)`、`it(…)` 的本體函式內（任何深度，含其中的箭頭函式），呼叫 `test`、`it`、`describe`、`suite`，或呼叫它們的任何屬性（例：`test.skip(…)`）→ 失敗「驗收測試不得使用子測試」；(2) 測試本體函式的第一個參數（測試情境，例 `t`）的 `.test` 屬性存取或計算屬性 `['test']` → 同上；(3) 名稱為 `concurrency` 的物件鍵、屬性存取或計算屬性 → 失敗「驗收測試不得設定 concurrency」。都列出檔名與行號。理由：`tests/support/assertions.mjs` 以模組層級的計數器搭配 `beforeEach`／`afterEach` 回報每個測試的斷言次數（12.2.1 第 6 項），子測試的斷言會與父測試的計數重疊，並行時多個測試共用同一個計數器，計數無法對應到測試。本機實測（Node.js 22.23.4）：在測試本體內呼叫最上層的 `test()`、`it()` 與 `t.test()` 都會建立子測試；`describe(…, { concurrency: 2 })` 被接受。範圍只含 `tests/acceptance/unit/`：Playwright 的斷言計數由 reporter 依測試分別收集，不受影響。`describe` 本體中的 `test`、`it`（套件成員，不是子測試）與 RegExp 的 `.test(…)` 不受限。別名與輔助模組中的呼叫屬第 9 點的靜態偵測界限，由 R-15 審查；`package.json`、ci.yml 的 node:test 指令加入 `--test-concurrency`、`--test-isolation` 等改變並行或隔離的參數時，由 R-14 審查（現行指令都沒有）。
10. 另外列出名稱含必要編號、以骨架宣告略過的測試數。參數 `--no-skip` 時：`tests/acceptance/` 有任何骨架即失敗；`tests/unit/` 中以 v0.4 的略過清單（`.skip`、`.fixme`、`.todo` 變體、`{ skip }`、`{ todo }`、略過區塊內的測試）判定的略過也仍然失敗（維持 PR-1 實作的嚴格程度，不因掃描範圍調整而放寬）。M3 離開條件（agent-dev-workflow 4.3「沒有略過的測試」）由 PR-7 對本檢查與 12.2.1 同時打開 `--no-skip`。
11. 解析結果的編號數量印在輸出中；`tests/acceptance/unit/` 中的 AC-EQ-4 測試以固定的需求文件片段驗證解析，並以測試資料確認下列情況會失敗（AC-EQ-4 反例）：刪除含 AC-GP-5 的測試；AC-GP-5 只出現在 `tests/unit/` 的測試名稱中；AC-GP-5 的測試位於不會被執行的位置（第 4 點）；AC-GP-5 的測試為「刪掉 `.skip` 的空本體」（第 9a 點）。v0.6.1 另加：名稱為前綴空白的樣板字面值（例：以 `${` 開頭）、兩個樣板前綴互為前綴（第 9d 點）；測試本體內 `t.test(…)`、`test(…)`、`it(…)`，以及 `{ concurrency: 2 }`（第 9e 點）各一個反例判定失敗；`describe` 本體中的 `test(…)` 與測試本體中 RegExp 的 `.test(…)` 為不誤判的對照組。
12. 同一編號涵蓋多個範圍時（NFR-5、NFR-7），每個範圍各自命名（acceptance-test-plan.md 第 2 節），未完成範圍保持略過（骨架宣告）；`--no-skip` 因而能發現遺漏的範圍。

### 12.2.1 驗收測試執行結果檢查（`check-acceptance-results.mjs`，v0.5 新增）

**目的：** 以測試執行器實際回報的結果判定「略過」「預期失敗」與「沒有執行」，補足靜態偵測無法涵蓋的寫法（12.2 第 9 點）。本檢查只處理 `tests/acceptance/` 的測試。

**結果來源（本次實測，Node.js 22.23.4、Playwright 1.63.0）：**

| 執行器 | 取得方式 | 實測到的行為 |
|---|---|---|
| node:test | 自訂 reporter `scripts/acceptance-reporter.mjs`（`--test-reporter` 可指定模組，與 `spec` reporter 並用、各自指定輸出）：對每個 `test:pass`／`test:fail` 事件輸出一行 JSON：`file`、`line`、`column`、`name`、外層 `describe` 名稱路徑、`skip`、`todo`、`details.type`（`test`／`suite`）、通過或失敗；並把同一 `file`＋`line`＋`column` 的 `test:diagnostic` 訊息 `acceptance-assertions <執行次數> <失敗次數>` 併入該筆（第 6 項） | 本體內 `t.skip()`、`t.todo()`、`{ skip }`、`test.todo`、以別名呼叫的 `test.skip` 都回報 `skip` 或 `todo`；`describe(…, { skip: true })` 只回報**區塊本身**為略過，**區塊內的測試完全不出現在結果中**；內建 JUnit reporter 沒有檔名，不採用。第 3 輪實測：在 `tests/support/` 模組最上層以 `beforeEach`／`afterEach` 註冊的 hook 會套用到匯入它的測試檔的每個測試，`afterEach` 中 `t.diagnostic(…)` 的事件帶有該測試的 `file`、`line`、`column`，可與 `test:pass` 對應；略過的測試不執行 hook。以包裝 `test` 的方式計數則**不可行**：事件的 `file`、`line` 會變成包裝模組的位置 |
| Playwright | 自訂 reporter `scripts/acceptance-reporter-pw.mjs`（與 `list` 並用；第 3 輪起取代 v0.5 初稿的 `json` reporter，因為 `json` 輸出不含斷言步驟）。`onTestEnd` 輸出每個測試的 project、檔名、含 `describe` 的標題路徑、`expectedStatus`、`status`、每次結果的 `status`、`annotations`；`onStepEnd` 計數 `category === 'expect'` 的步驟與其中帶 `error` 者（含巢狀於 `test.step` 內的），併入該測試 | 本體內 `test.skip()`、`test.skip(條件, 說明)`、`test.fixme()`、`testInfo.skip()`、`{ annotation: { type: 'skip' } }`、別名呼叫、略過區塊內的測試都回報 `expectedStatus: skipped`；`test.fail()` 與 `test.fail(名稱, …)` 回報 `expectedStatus: failed`、`status: expected`，在 `stats` 中被算在 **expected**（不是 skipped），所以**不能只看 `stats.skipped`**。第 3 輪實測：`json` reporter 的 `steps` 只含 `test.step`，不含 `expect`；自訂 reporter 的 `onStepEnd` 可取得 `category: 'expect'`：空本體 0 次、提前 `return` 0 次、`expect.soft` 1 次、`expect.poll` 2 次、被 `try/catch` 吞掉的失敗斷言 1 次且帶 `error`、測試狀態仍為 `passed` |

**結果檔的交接（v0.5.1 簽核後釐清；v0.5 沒有規定，實作的選擇經設計判斷後採用）：**

- **位置：** `unit` job 為 `acceptance-results/unit.jsonl`；每個 `e2e (<引擎>)` job 為 `acceptance-results/e2e.jsonl`（一般）與 `acceptance-results/e2e-realtime.jsonl`（realtime）。`acceptance-results/` 列在 `.gitignore`，不提交。**不放在 Playwright 的 `outputDir`**（預設 `test-results/`）：每次執行開始時該目錄會被清空，一般與 realtime 兩次執行的結果會互相刪除。node:test 的 `--test-reporter-destination` 不建立目錄，CI 先 `mkdir -p acceptance-results`。
- **格式與結束標記：** JSON Lines。每個結果一行 `{"type":"result", …}`（欄位見上表；Playwright 的整體結果欄名為 `outcome`，取自 `TestCase.outcome()`，即下文第 1 項的「`status`」）；Playwright 的全域錯誤各一行 `{"type":"error","message":…}`；**最後一行必須是結束標記 `{"type":"end","count":<result 行數>}`**。檔案不存在、空檔、沒有結束標記、筆數不符、有不是 JSON 或無法辨識的行時，`check-acceptance-results` 以結束代碼 **2** 失敗（輸入錯誤；判定失敗為 1）。理由：reporter 中途中止（執行器當掉、job 逾時被取消）時檔案只有部分結果，沒有結束標記才能分辨「不完整」與「完整但測試較少」——後者在第 4 項之外沒有其他檢查能發現。Playwright reporter 另在 `onBegin` 先清空輸出檔，上一次執行的完整結果不會被誤讀為本次的結果；node:test reporter 在全部事件收齊後才輸出（診斷事件晚於結果事件）。
- **兩次 Playwright 執行的檔名：** 以環境變數 `ACCEPTANCE_RESULTS_FILE` 指定，`playwright.config.mjs` 讀取後傳給 reporter 的 `outputFile`；未設定時為 `acceptance-results/playwright.jsonl`（本機使用）。CI 的兩個步驟各以步驟層級 `env:` 設定固定字串（不插值事件內容，12.1）。若 CI 的設定被移除，兩次執行寫入同一個預設檔，而檢查步驟讀取的兩個檔名不存在，以結束代碼 2 失敗，不會靜默只檢查其中一次執行。
- 驗收測試程式碼在同一 job 中可以寫入這些檔案，屬本節「殘餘風險」與 R-14 的範圍，本段不改變。

**判定（純函式 `evaluateResults({ layer, staticTests, staticFiles, results, errors, noSkip, requiredIds })`）：** 輸入為同一 job 的結果檔與同一份原始碼的 12.2 靜態掃描結果（只取該層目錄：`unit` 層為 `tests/acceptance/unit/`，`e2e` 層為 `tests/acceptance/e2e/`）。v0.5.1 簽核後釐清：v0.5 的簽名只有 `layer`、`staticTests`、`results`、`noSkip`，但判定規則還需要三個輸入，實作已補上，設計採用：`staticFiles` 是該層目錄的測試檔清單（第 4 項「該層目錄的每個測試檔至少有一筆結果」：檔案中若沒有任何能被靜態掃描辨識的測試名稱，只看 `staticTests` 無法發現它沒有執行）；`requiredIds` 是 12.2 第 1、2 點的必要編號（第 5 項）；`errors` 是結果檔中的全域錯誤（第 7 項，預設空陣列）。下列任一項成立即失敗，並列出檔名與名稱：

1. **預期失敗或失敗：** Playwright 的 `expectedStatus` 不是 `passed`、`status` 不是 `expected`，或任何一次 `results[].status` 不是 `passed`；node:test 的 `test:fail`。不論是否 `--no-skip`。
2. **非骨架的略過：** 結果為略過（Playwright `expectedStatus: skipped`；node:test 的 `skip` 或 `todo`），但同一檔案中沒有同名的骨架宣告（12.2 第 8 點）。不論是否 `--no-skip`。`todo` 一律視為非骨架。
3. **骨架略過（只在 `--no-skip`）：** 任何略過。
4. **沒有執行：** 靜態掃描到的每個測試（`describe` 以外），在同一檔案的結果中至少有一筆名稱相符的結果（名稱為不含 `${` 的字面值時須完全相同；樣板字面值以第一個 `${` 之前的固定文字為前綴比對。v0.6.1：前綴去除前後空白後為空時，不以前綴比對任何結果，該測試判定為沒有執行；12.2 第 9d 點在靜態檢查就拒絕這種寫法，本項是第二道。v0.6.2 寫明：同一規則也套用於以樣板命名的 `describe` 與結果的外層名稱路徑比對（空前綴不與任何路徑相符，該 `describe` 判定為沒有執行）；實作已如此判定，屬只增加失敗條件的加嚴。同一檔案的樣板前綴互不為前綴由第 9d 點保證，所以每筆結果最多對應一個樣板測試）。靜態掃描到的 `describe` 名稱，須出現在至少一筆結果的外層名稱路徑中。該層目錄的每個測試檔至少有一筆結果。
5. **編號沒有通過的執行結果（只在 `--no-skip`）：** 該層靜態掃描到的每個必要編號，至少有一筆依第 1 點判定為通過的結果，其「外層名稱路徑＋名稱」含該編號（完整編號比對）。
6. **沒有執行任何斷言，或有斷言失敗卻被吞掉（第 3 輪審查 M-1）：** 每筆非略過且通過的結果，斷言執行次數至少 1、失敗次數為 0；缺少計數資料（例：node:test 驗收測試沒有經 `tests/support/assertions.mjs` 斷言，沒有 `acceptance-assertions` 訊息）也判定失敗。不論是否 `--no-skip`。計數來源：Playwright 為 reporter 的 `expect` 步驟；node:test 為 `tests/support/assertions.mjs`：匯出包裝 `node:assert/strict` 的 `assert`（每次呼叫斷言方法計為執行一次，丟出例外時計為失敗一次再重新丟出），並在模組最上層註冊 `beforeEach` 歸零、`afterEach` 以 `t.diagnostic('acceptance-assertions <執行> <失敗>')` 回報。這能機械地抓到：空本體、在第一個斷言之前提前 `return`（含依引擎或環境的條件 `return`，在該引擎的 job 中為 0 次）、以 `try/catch` 吞掉失敗的斷言。
7. **執行器回報全域錯誤（v0.5.1 簽核後釐清；實作已有、設計採用）：** 結果檔中有任何一行 `error`（Playwright 的 `onError`，例：測試檔載入失敗、設定錯誤）即失敗，不論是否 `--no-skip`。這類錯誤通常也會讓第 4 項失敗（該檔沒有結果），本項讓原因直接顯示；正常的執行不會產生全域錯誤，所以不會誤判。本項只增加失敗條件。

**執行位置：** `unit` job 判定 `unit` 層；每個 `e2e (<引擎>)` job 以一般與 `-realtime` 兩次執行的結果檔合併判定 `e2e` 層（`timing-real.spec.mjs` 只出現在 realtime 的結果中）。所以每個引擎都要各自通過，與 NFR-1 一致；某引擎以條件略過（例如 `test.skip(browserName === 'webkit')`）會讓該引擎的 job 失敗。

**啟用時點：** PR-1b 加入並啟用第 1、2、4、6、7 項（骨架以外的略過、預期失敗、沒有執行、沒有斷言或吞掉斷言、全域錯誤，自 PR-1b 起任何時候都不允許；PR-1b 時已轉實測的 10 個驗收測試須符合第 6 項）；第 3、5 項由 PR-7 以 `--no-skip` 打開。

**判定以執行結果為準的理由：** 靜態偵測無法證明涵蓋所有寫法（12.2 第 9 點），而且看不到「寫了但沒有被執行」的測試（檔案位置不符、略過區塊、`.only`、執行器的名稱過濾參數）。執行結果直接反映執行器實際做了什麼，與寫法無關。靜態檢查保留，因為它能在執行前指出行號，並負責 EQ-4 的編號覆蓋。

**殘餘風險：只能靠審查把關的部分（第 3 輪審查 M-1、P-4）。** 執行結果與斷言計數只能證明「測試有執行、至少執行一個斷言、沒有斷言失敗被吞掉、執行器回報通過」，不能證明「測試驗證了驗收標準」。下列情況機械檢查抓不到，由審查清單 R-15（review-process.md 第 3 節）與測試 agent 的變異檢查（acceptance-testing skill 4.3）把關：
- 斷言內容空洞（`expect(true).toBe(true)`、比對與產品無關的值、以測試自己算出的值比對自己）。
- 只驗證了 Then 的一部分觀察點；或先執行一個斷言後，依引擎、環境或條件提前 `return` 跳過其餘 Then（斷言次數已大於 0）。
- Given／When 沒有照驗收標準建立（例如以注入取代驗收要求的操作），或檢查點不在容差邊界上。
- 驗收測試在執行中改寫 `scripts/`、結果檔或 reporter 的輸出（測試與檢查在同一 job，測試程式碼有檔案系統權限；與「PR 可修改自己的檢查」同類，R-14 檢查）。

不採用自動化變異測試工具的理由：端對端層在三引擎各執行一次已是 CI 的主要時間，對每個變異重跑會使 CI 時間成倍增加；而且需要引入新的開發相依並另行查證授權（Q4 只查證了目前的工具）。改以測試 agent 對每個轉實測的測試做變異檢查並寫入 commit 訊息、審查者重做至少一個（R-15）。

### 12.3 端對端測試設定（playwright.config.mjs）

- `testDir: tests/acceptance/e2e`。
- `projects`：
  - `chromium`、`firefox`、`webkit`：`testMatch: /\.spec\.mjs$/`（第 3 輪審查 P-3：與 12.2 第 4 點一致）、`testIgnore: /timing-real\.spec\.mjs/`。
  - `chromium-realtime`、`firefox-realtime`、`webkit-realtime`：`testMatch: /timing-real\.spec\.mjs/`，CI 以 `--workers=1` 在一般測試**之後**單獨執行，避免與其他測試平行時 CPU 負載延後計時器（NFR-6）。
- `webServer`：`node scripts/serve.mjs dist`；測試前必須先 `node scripts/build.mjs`。
- `retries: 0`（重試會掩蓋計時問題）。
- `reporter`：`list`（給人看）加上自訂 reporter `scripts/acceptance-reporter-pw.mjs`（輸出到檔案，供 12.2.1；含斷言步驟計數）；一般與 realtime 兩次執行輸出到不同檔名。`forbidOnly` 在 CI 為 true（PR-1 已實作，維持）。
- NFR-6 測試以 `test.setTimeout(120_000)` 覆寫預設逾時（89 秒量測超過預設 30 秒）。
- 實作 agent 不撰寫端對端測試；畫面層的行為由測試 agent 的驗收測試涵蓋（module-test-standards.md M10）。

### 12.4 PR 說明檢查（`check-pr-body.mjs`，workflow.md 4.4）

從事件檔讀取 PR 說明（不以 `${{ }}` 插值），下列任一項不成立即失敗：

1. 含以「## 上工檢查」開頭的段落，其下所有核取方塊皆為 `- [x]`。
2. 含「## 已載入的 skill」段落與表格，至少一列為 `agent-dev-workflow`。
3. 表格中每一列的 skill 名稱對應 `.claude/skills/<名稱>/SKILL.md`（簽出 PR 的 commit 讀取），且填寫的版本號等於該檔案「變更紀錄」表格最後一列的版本號。該 skill 沒有變更紀錄時，版本號欄必須填「無版本號」，檢查記為警告而不失敗（DQ-6 的過渡規則）。
   - **過渡規則已結束（DQ-6；v0.5 更新，PR-1 審查 N-3）：** 原設計預定由「另一個同步 PR」更新版本庫內的 skill 副本；實際上副本同步已**隨 PR-1 合併**（commit 40725e0，PR-1 審查紀錄確認副本與產品負責人安裝的原始 skill 逐位元組相同）。因此自 PR-1 合併（7707e9f）起，版本庫內的 agent-dev-workflow 與 requirements-spec 都有變更紀錄（皆為 1.1），PR 說明一律填版本號；填「無版本號」即失敗（本規則以版本庫內檔案判定，不需修改程式）。「無版本號」的警告分支只在 skill 確實沒有變更紀錄時適用。
4. 含「## 作者」段落，至少一行符合 `工作階段：<非空白>`。多位作者時重複「- 角色：…」「- 工作階段：…」兩行一組（review-process.md 第 2 節），全部工作階段識別都會被 review-gate 採計。第 3 輪審查 M-2 起：每個工作階段識別經去除前後空白、NFKC 正規化、轉小寫後必須符合 `^[a-z0-9-]+$`，且原文不得含零寬或其他不可見格式字元（Unicode 類別 Cf），否則失敗；規則與 review-process.md 第 4 節第 2 步相同，讓格式錯誤在 `pr-body` 就被發現。
   - **v0.6.1（DQ-14 (b) 附帶問題，PR-1c 實作）：** 作者段落中偵測形式（review-process.md 第 4 節 F1～F9）以「工作階段:」開頭的行，原文都必須符合 `^\s*(?:[-*]\s+)?工作階段：(.*)$`，否則失敗「作者段落格式不符：第 n 行」；段落（移除 HTML 註解後）含不可見字元或字元參照時失敗「作者段落含不可見字元或字元參照」。例：`- 工作階段: x`、`**工作階段**：x`、`> 工作階段：x`、`- 工作阶段：x` 都失敗。以 `validateAuthorSection` 實作，review-gate 使用同一函式（review-process.md 4.1「作者段落」）。PR-1b 版以前，這些行不被採計為作者、也不使本檢查失敗（PR #3 審查紀錄「發現的問題」第 2 點）。

PR-1 已更新 `.github/pull_request_template.md`：作者段落示範兩組（實作、測試）；因 skill 副本已隨 PR-1 同步，範本的版本號欄已留空，由作者依載入的 skill 填寫（DQ-6；v0.5 更新描述，PR-1 審查 N-3）。PR 包含多個角色的產出（例如設計文件與程式碼）時，「## 作者」列出每個角色的工作階段（PR-1 審查 N-4(a)）。

### 12.5 部署（deploy.yml）

```yaml
# 示意，非完整檔案
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  deploy:
    environment: { name: github-pages, url: ${{ steps.d.outputs.page_url }} }
    steps: checkout → setup-node → BUILD_SHA=${{ github.sha }} node scripts/build.mjs
           → actions/configure-pages → actions/upload-pages-artifact (path: dist) → actions/deploy-pages (id: d)
  smoke:
    needs: deploy
    steps:
      - name: AC-EQ-9（部署）與 EQ-12 證據
        # 每 15 秒以 Node.js fetch 讀取 <page_url>js/version.js，直到含 github.sha 前 7 碼；
        # 自 workflow 開始 9 分鐘未出現即失敗
```

部署不等待端對端測試：PR 階段已全部通過，且分支保護要求分支為最新（12.6），合併後的內容即為 PR 測試過的內容。

**`smoke` 失敗與 EQ-12 逾時的處理（DQ-9 決定）：**

1. `smoke` 失敗時，由發現者（測試 agent 或產品負責人）重新執行該次 deploy 工作流程**一次**，記錄兩次執行的開始時間、版本號出現時間（或失敗時間）與執行連結。不修改程式、不放寬 9 分鐘門檻。
2. 重跑仍失敗，或 AC-EQ-12 人工驗收時超過 10 分鐘：記為「外部因素造成的觀察」，附上 GitHub Status（https://www.githubstatus.com/ ）當時的狀態，回報產品負責人，**由產品負責人判定**是否視為通過。設計與測試 agent 不自行判定通過。
3. 紀錄寫入測試報告（`docs/test-reports/`）；AC-EQ-12 的判定結果寫入 UAT 紀錄。

### 12.6 分支保護與網頁設定（產品負責人手動）

依下列順序執行。標示「手動」者 agent 無法代做。步驟 0 與步驟 4 是 EQ-2 的啟動例外，產品負責人已依 DQ-8 明確接受（2026-11-09 16:02）。

**EQ-2 啟動例外的處理（DQ-8 決定）：**

- 接受的例外只有兩項：(1) 初始 commit 直接推送（步驟 0）；(2) PR-1 在分支保護與審查檢查生效前合併（步驟 4）。
- 設計文件**不單獨合併**：PR-1 以 branch `design/initial` 為基礎，設計文件與設計 skill 隨 PR-1 合併，因此不會出現第三項例外。若之後需要在 PR-1 前單獨合併設計文件，屬未接受的例外，停下來回報產品負責人。
- PR-1 合併前，產品負責人確認：CI 全部通過；PR-1 有一則符合 review-process.md 格式、針對 PR-1 最新 commit 的審查紀錄。
- 兩項例外由產品負責人在 UAT 紀錄或 release notes 註明（建議文字：「EQ-2 啟動例外：初始 commit f409a7a 直接推送；PR-1 於分支保護生效前合併，審查紀錄經產品負責人人工確認。其後所有變更皆經 PR、CI 與審查檢查。」）。
- `review-record` 的必要檢查分兩段設定（步驟 6a、6b），不屬例外。**v0.5 起 6b 改在 PR-1b 執行**（原為 PR-2）：PR-1 合併後的第一個 PR 就是 PR-1b，agent-dev-workflow 4.3「啟動例外以外，不得再有不經檢查的合併」要求 `review-record` 在 PR-1 之後第一個 PR 合併前就成為必要檢查，不能等到 PR-2。
- **PR-1b 會觸發 review-gate（v0.5 已確認）：** 以 API 讀取，main（7707e9f）含 `.github/workflows/review-gate.yml`，工作流程狀態為 active；目前沒有任何執行紀錄（PR-1 的審查評論留在合併前，當時工作流程尚未在預設分支）。因此 PR-1b 開啟（`pull_request_target` opened）時，review-gate 會以 main 上的版本**第一次**執行並寫入 `review-record` 狀態。第一次執行若無法寫入狀態，見 DQ-11。
- **PR-1b 由舊版判定（已知限制）：** `pull_request_target`／`issue_comment` 執行的是 main 上的 `review-gate.mjs`，所以 PR-1b 對 review-gate 的修正（review-process.md 第 4 節 v0.5）要在 PR-1b 合併後才生效，PR-1b 本身由 PR-1 的版本判定。PR-1b 合併前以兩道確認補足新舊版本的差異（第 3 輪審查 M-3）：
  1. **以新版試算（機械）：** 在 PR-1b 分支上執行 `node scripts/review-gate.mjs --dry-run`（實作 agent 在 PR-1b 加入：以 API 讀取 PR-1b 的說明、評論與 head SHA，呼叫新版 `evaluate`，只印出判定與原因，不寫入任何狀態；權杖只需讀取權限）。結果必須為 `success`，輸出（含 head SHA）貼在 PR-1b 對話區。這也是新版判定第一次以真實資料執行。
  2. **人工確認清單（產品負責人，逐項勾選並貼在 PR-1b 對話區）：** 針對 PR-1b 最後一則審查紀錄：(i) 第一行為標記、只有一個逐項結果表、表中每一列第一格恰為 `R-<數字>`（半形、無粗體或其他文字），R-1～R-15 各恰好一列；(ii) 每列結果恰為「通過」「不通過」「不適用」之一，沒有「不通過」，「不適用」的說明欄都有理由；(iii) 「結果」「針對 commit」「審查者」三行各恰好出現一次，結果為 `APPROVED`，commit 為最新 head 的完整 40 碼；(iv) 審查者與每位作者的工作階段識別只含半形小寫英數字與連字號，且彼此不同（不只是大小寫或全半形不同）；(v) 紀錄含「同一模型」與「不同工作階段」；(vi) 第 1 道的試算結果為 `success`，且試算的 head SHA 等於合併時的 head。
  這是以既有檢查加上新版試算與人工確認處理，不是不經檢查的合併。
- **新版 review-gate 在平台上的第一次執行（第 3 輪審查 M-3；v0.6 改寫）：** 修改 review-gate 的 PR 合併後，main 上換成新版；新版在平台上的第一次執行是之後的第一個 PR。v0.6 起：PR-1b 版**不做**步驟 8b（見下方「v0.6 的順序」）；PR-1c 合併後以探測 PR B 做**一次**步驟 8b，作為描述主分支上版本的 AC-EQ-11 證據。之後任何修改 `review-gate.mjs`、`review-gate.yml` 或 review-gate 匯入的模組（`check-pr-body.mjs`；v0.6.1 起另有 `detection.mjs`）的 PR 合併後，在下一個 PR 重做步驟 8b 並記錄（AC-EQ-11 的證據須描述主分支目前的版本；agent-dev-workflow 4.4）。連續修改 review-gate、且其間沒有其他會合併的 PR 時，可以只對最後一個版本做一次步驟 8b（v0.6 的做法）；但每個修改 PR 本身都是前一個版本在平台上的第一次執行，前一個版本無法寫入狀態時，依 DQ-11 (a) 處理該修改 PR。
- **v0.6 的順序（產品負責人 2026-11-10 21:37 同意統籌 agent 的建議）：**
  1. PR-1b 已於 2026-11-10 13:34:43Z 合併（merge commit fa05bbb；人工確認清單在 PR #3 對話區）。main 上的 review-gate 為 PR-1b 版（白名單、DQ-13 (b) 的偵測形式）。
  2. **不做 PR-1b 版的步驟 8b。** PR-1b 的審查紀錄指出 PR-1b 版仍可被繞過（review-process.md 4.1），列為 DQ-14。PR-1b 版將由 PR-1c 取代，且 PR-1c 合併前沒有其他會合併的 PR，所以不另開探測 PR 觀察 PR-1b 版。
  3. 產品負責人決定 DQ-14 並簽核 v0.6（docs/design/README.md 第 5 節；**已完成，2026-11-10 22:12（Asia/Taipei），採 (b)**）。設計 agent 在決定紀錄之後的第一個 commit，把採用的選項展開為 review-process.md 第 4 節的正文（software-design-phase 3.4.1 第 1a 點）；實作 agent 在該 commit 之後才開始 PR-1c 的程式。
  4. 開 PR-1c（branch `pr-1c/review-gate-hardening`，內容見第 14 節）。**PR-1c 開啟時是 PR-1b 版在平台上的第一次執行**：2026-11-10 以 `GET /repos/{owner}/{repo}/actions/workflows/review-gate.yml/runs` 讀取，review-gate 的 10 次執行全部在 main 7707e9f 上執行（最後一次 13:34:28Z，在 PR-1b 合併的 13:34:43Z 之前），fa05bbb 上沒有任何執行。`review-record` 已是必要檢查（6b 已完成），所以 PR-1b 版若無法寫入狀態，PR-1c 無法合併：依 DQ-11 (a) 處理，只限 PR-1c（產品負責人暫時移除 `review-record`、人工確認、合併、立即加回，並在 UAT 紀錄或 release notes 註明）。這是 v0.6 不先開探測 PR 的代價（DQ-11 (d) 原本把第一次執行移到不合併的 PR）；DQ-11 的決定本身不變，(a) 原本就是確實無法寫入時的唯一處理。
  5. PR-1c 由 PR-1b 版判定，合併前完成下方「PR-1c 由 PR-1b 版判定」的兩道確認。
  6. PR-1c 合併後、PR-2 開啟前，開**一次**探測 PR B 做步驟 8b，以 main 上的 PR-1c 版觀察 AC-EQ-11 三步。這也是 PR-1c 版在平台上的第一次執行；無法寫入狀態時依 DQ-11 (a) 處理修正它的 PR。
  7. 探測 PR B 關閉後開始 PR-2。PR-2 沒有修改 review-gate，不需重做步驟 8b。
  8. （v0.6 的「DQ-14 採 (e) 時不需 PR-1c」已不適用：DQ-14 採 (b)。）
- **PR-1c 由 PR-1b 版判定（已知限制，同 PR-1b）：** PR-1c 對 review-gate 的修改在合併後才生效。合併前兩道確認：
  1. **以新版試算（機械）：** 在 PR-1c 分支上執行 `node scripts/review-gate.mjs --dry-run`（`PR_NUMBER` 為 PR-1c），結果必須為 `success`，輸出（含 head SHA）貼在 PR-1c 對話區。另以同一指令對 PR #2、PR #3 試算並貼出結果，作為真實資料的回歸紀錄（不要求 success。PR #2：head 為 e042cbd，唯一的審查紀錄針對較早的 060a570，唯一含 e042cbd 的評論（驗證紀錄 5）沒有標記行，所以 head 沒有候選紀錄，PR-1b 版與 PR-1c 版都預期為 failure「沒有針對 e042cbd 的審查紀錄」（v0.6.2 改寫：v0.6 寫成「只有 R-1～R-14」是錯的，設計 agent 已以兩版的 `evaluate` 與 API 資料確認）。PR #3：PR-1c 版預期為「含字元參照」，見 review-process.md 4.1「誤判與維持有效」）。
  2. **人工確認清單（產品負責人，逐項勾選並貼在 PR-1c 對話區）：** PR-1b 清單的 (i)～(vi)（(vi) 的「第 1 道」指本段的第 1 道），再加上 PR-1c 版相對 PR-1b 版的**每一個差異**各一項（DQ-14 採 (b)，review-process.md 4.1）：(vii) 沒有字元參照（X5）；(viii) 沒有 Default_Ignorable_Code_Point、結合符號、U+2800（X2～X4；肉眼無法辨認，以下列指令為準）；(ix) 第 1 行以外沒有 `<!`、`<?`，也沒有跨行的 HTML 標籤（X6、X7）；(x) 逐項表最後一列的下一行是空行，全文只有逐項表一個分隔列（T3、T4），沒有簡體字的欄位名稱（F9）；(xi) PR-1c 說明「## 作者」段落中看似「工作階段」的每一行都是 `- 工作階段：<識別>`（全形冒號），段落沒有字元參照；(xii) 紀錄中所有含 head SHA 的評論裡，最後一則就是被確認的這一則（v0.6.1 的候選改為「原文含 head SHA」）。(vii)、(viii) 的指令：`gh api repos/{owner}/{repo}/issues/comments/<評論 id> --jq .body | node -e "const s=require('fs').readFileSync(0,'utf8');console.log(/[\p{Default_Ignorable_Code_Point}\p{M}\u2800]/u.test(s), /&(?:#[0-9]+|#[xX][0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/.test(s))"`，輸出必須是 `false false`。12.2 第 9d、9e 點與 12.2.1 第 4 項的修改在 `pull_request` 事件以 PR-1c 自己的版本執行，不受「由舊版判定」影響，只經 R-14 審查。
  PR-1c 的審查紀錄同時要在 PR-1b 版（寫入狀態）與 PR-1c 版（試算）下有效。審查 agent 描述 DQ-14 的繞過寫法時，不得在紀錄中照寫採用的選項會拒絕的構造（字元參照、HTML 註解、可忽略字元等，review-process.md 4.1；以文字描述，例：「『結』字的十六進位字元參照」），否則第 1 道的試算為 failure，須重留紀錄。探測 PR B 的審查紀錄同理。
  這是以既有檢查加上新版試算與人工確認處理，不是不經檢查的合併。
- **已記錄的設定（v0.5）：** 步驟 6a 已由產品負責人完成（統籌 agent 2026-11-09 回報；設計 agent 以 `GET /repos/{owner}/{repo}/branches/main/protection` 讀取確認：必要檢查為 `unit`、`acceptance-ids`、`e2e (chromium)`、`e2e (firefox)`、`e2e (webkit)`、`pr-body`，來源 app_id 15368（GitHub Actions），`strict: true`，`enforce_admins: true`，不允許強制推送與刪除）。AC-EQ-2 的「本機對主分支直接 push 被拒」已由產品負責人驗證（統籌 agent 回報）；「CI 失敗的 PR 以管理員身分合併被拒」在 PR-1b 驗證（步驟 8，DQ-12）。v0.6：6b 已於 2026-11-10 16:18（Asia/Taipei）完成（探測 PR A，PR #2 對話區「驗證紀錄 2」）；設計 agent 2026-11-10 以同一 API 再讀取，必要檢查為上述 6 項加 `review-record`，皆 app_id 15368，`strict: true`，`enforce_admins: true`。步驟 8 與 DQ-12 (a)、(b) 已在探測 PR A 完成（同上「驗證紀錄 3、4」）。

| 步驟 | 時點 | 設定 | 執行者 |
|---|---|---|---|
| 0 | 已發生 | 初始 commit（f409a7a，docs: 初始化專案文件與 agent 工作設定）已直接推送到 main。開 PR 必須有基底分支，這是唯一不經 PR 的變更（EQ-2 啟動例外之一，DQ-8 已接受） | 記錄 |
| 1 | PR-1 開啟前 | 版本庫設為 Public（EQ-1） | 手動 |
| 2 | PR-1 開啟前 | Settings → Pages → Build and deployment → Source：**GitHub Actions** | 手動 |
| 3 | PR-1 開啟前 | Settings → Actions → General → Workflow permissions：Read repository contents（預設唯讀；各工作流程自行宣告所需權限） | 手動 |
| 4 | PR-1 的 CI 全部通過、審查紀錄由產品負責人人工確認後 | 合併 PR-1。此時分支保護與審查檢查尚未生效（EQ-2 啟動例外之二，DQ-8 已接受） | 手動 |
| 5 | PR-1 合併後 | Settings → Environments → github-pages → Deployment branches：只允許 `main` | 手動 |
| 6a | PR-1 合併後、下一個 PR 開啟前（**已完成**，見上方「已記錄的設定」） | Settings → Branches → Add classic branch protection rule，Branch name pattern `main`：<br>☑ Require a pull request before merging（不勾 Require approvals：單一帳號無法核准自己的 PR）<br>☑ Require status checks to pass before merging；☑ Require branches to be up to date before merging；必要檢查：`unit`、`acceptance-ids`、`e2e (chromium)`、`e2e (firefox)`、`e2e (webkit)`、`pr-body`（這些在 PR-1 已執行過，選得到）<br>☑ **Do not allow bypassing the above settings**（套用於管理員，EQ-2）<br>☐ Allow force pushes；☐ Allow deletions | 手動 |
| 6b | **驗證 PR**（DQ-11 採 (d) 時為探測 PR A，否則為 PR-1b）開啟、`review-record` 狀態寫入過一次後，**PR-1b 合併前**（v0.5：原為 PR-2） | 在同一條規則加入必要檢查 `review-record`（來源選 GitHub Actions）。**6b 完成前，審查 agent 不在驗證 PR 留審查紀錄**，以便步驟 8 能看到 AC-EQ-11 第一步「沒有審查紀錄 → 無法合併」。`review-record` 在 PR-1 期間不會執行（工作流程尚未在預設分支），所以 6a 時選不到。驗證 PR 開啟後若 `review-record` 一直沒有出現，停止並依 DQ-11 處理，**不得在沒有 `review-record` 必要檢查的情況下合併 PR-1b** | 手動 |
| 7 | 6a 後 | Settings → General → Pull Requests：只允許 Squash merging（選用，讓主分支每個 commit 對應一個 PR） | 手動 |
| 8 | 6b 後、PR-1b 合併前（v0.5：原為 PR-2） | 在驗證 PR 依序執行並記錄每一步的時間、head SHA 與 `review-record` 狀態（連結）：<br>(1) **AC-EQ-11 第一步、AC-EQ-2：** 驗證 PR 其他檢查全部通過、沒有審查紀錄時，`review-record` 為 failure；以產品負責人（管理員）身分嘗試合併，確認被拒（DQ-12）。<br>(2) **AC-EQ-11 第二步：** 審查 agent 針對最新 head 留下審查紀錄，`review-record` 變為 success。<br>(3) **AC-EQ-11 第三步：** 實作 agent 推送一個新 commit（建議為空 commit：`git commit --allow-empty -m "chore: AC-EQ-11 驗證（spec.md 12.6 步驟 8）"`，不改變內容；Squash 合併後不留痕跡），確認 `review-record` 對新 head 為 failure、無法合併。<br>(4) 驗證 PR 為 PR-1b 時：審查 agent 針對新 head 重新審查並留下紀錄，`review-record` 為 success；依上方「PR-1b 由舊版判定」完成新版試算與人工確認清單後，產品負責人合併。驗證 PR 為探測 PR A 時：驗證後關閉、不合併、刪除分支；PR-1b 開啟時已受 `review-record` 把關，依一般流程審查，合併前同樣完成新版試算與人工確認清單。<br>結果記入驗證 PR 的對話區，AC-EQ-11、AC-EQ-2 的人工驗收紀錄引用該處（舊版的證據） | 手動 |
| 8b | **PR-1c 合併後、PR-2 開啟前，一次**（v0.6；原為「PR-1b 合併後的第一個 PR」，PR-1b 版不做，見「v0.6 的順序」）；之後每次 review-gate 變更合併後的下一個 PR | 開探測 PR B（branch `probe/review-gate-b`，只含一個空 commit，PR 說明含必要段落並寫明「不合併」），以 main 上的 PR-1c 版重新觀察 AC-EQ-11 三步：開啟時（無紀錄）failure → 審查 agent 針對最新 head 留下紀錄後 success → 推送一個空 commit 後 failure；記錄每一步的時間、head SHA、`review-record` 狀態連結與當時 main 的 commit。建議在留合法紀錄之前，先留一則含 review-process.md 4.1 表中一種寫法（例：A1）的紀錄，確認為 failure，作為新規則在平台上生效的證據。完成後關閉、不合併、刪除分支。AC-EQ-11 的人工驗收紀錄以這份為主、步驟 8 的為補充。之後的 review-gate 變更：下一個 PR 的一般流程自然包含這三步（推送新 commit 可以是審查後的修正 commit；沒有修正時以空 commit 代替）。新版無法寫入狀態時依 DQ-11 (a) | 手動（觀察與記錄） |
| 9 | M4 UAT 開始時 | 在分支保護規則勾選 **Lock branch**（主分支唯讀），UAT 結束且發布後取消（EQ-14、M4 凍結主分支） | 手動 |

---

## 13. 審查紀錄與審查檢查（EQ-5、EQ-11）

審查紀錄格式、審查清單（R-1～R-15）與 `review-gate.mjs` 的判定規則見 **review-process.md**。摘要：

- 審查 agent 在 PR 的對話區留一則評論，第一行為 `<!-- review-record v1 -->`，含結果（`APPROVED`／`CHANGES_REQUESTED`）、針對的完整 40 碼 commit SHA、審查者與作者的工作階段識別、「同一模型不同工作階段」註明、逐項結果表。
- 判斷「看似某欄位的行」用的偵測形式（v0.5.1 簽核後釐清）：NFKC、去除強調符號與空白，並去除行首的引用、清單、有序清單與標題符號；合法與否仍以原文逐字比對。v0.5 的寫法偵測不到合法的 `- 結果：` 行本身。DQ-13 採 (b) 後擴大為欄位偵測 F1～F8（含去除 HTML 標籤與註解分隔符號、連結、跳脫、核取方塊、行首所有非字母字元）與表格列偵測 T1、T2，見 review-process.md 第 4 節「偵測形式」。
- `review-gate.mjs` 對 PR 最新 head SHA 寫入 `review-record` 狀態；只採計協作者的評論、SHA 必須等於最新 head、審查者工作階段不得等於 PR 說明中任何作者的工作階段（v0.5：去除前後空白、NFKC 正規化並轉小寫後比對）、以針對該 SHA 的最後一則紀錄為準。
- v0.5（PR-1 審查 N-1；第 3 輪審查 M-2 改為白名單式）：紀錄的格式只要有任何一處不符合 review-process.md 第 2 節的白名單，整則紀錄無效；包括：含零寬或其他不可見格式字元；「結果」「針對 commit」「審查者」任一欄位不是恰好一行；任何表格列不是規定格式的 R 列（例：`**R-5**`、`Ｒ－５`、`R-5（補充）`）；同一 R 編號兩列以上；結果欄不是三個值之一；工作階段識別正規化後不符合 `^[a-z0-9-]+$`。審查清單擴為 R-1～R-15（新增 R-15「驗收測試確實驗證」，第 3 輪審查 M-1）。
- 審查清單 R-14：PR 若修改 CI、檢查腳本、`supplementary-acceptance.json` 或需求文件，審查者確認沒有降低任何檢查。
- v0.6：PR-1b 版的偵測形式仍有 30 種寫法判為有效、但渲染後讀者看到不同內容（緊接逐項表、沒有前導直線的列；字元參照；Default_Ignorable_Code_Point 與結合符號；HTML 註解等），以 cmark-gfm 實測，見 review-process.md 4.1。DQ-14 採 (b)（2026-11-10 22:12（Asia/Taipei））：PR-1c 加入拒絕規則 X1～X7、偵測修改 F2′、F9、表格邊界 T3、T4、候選改為原文含 head SHA、作者段落規則（review-process.md 4.1）。v0.6.3：欄位行與表格列的偵測取 PR-1b 版與 PR-1c 版的聯集（「相容偵測」），以構造保證「PR-1c 有效 ⇒ PR-1b 有效」（PR #4 審查紀錄指出 v0.6.1 的論證有缺口）。PR-1c 合併前，main 上的 PR-1b 版仍依現行規則判定。

---

## 14. 實作切分（PR 順序）

每個 PR 由實作 agent 與測試 agent 共同或先後提交，由不是任何一位作者的審查 agent 審查。驗收骨架在 PR-1 全部建立；之後每個 PR 把對應骨架改為實際測試。

**PR-1b（v0.5 新增）：** 位於 PR-1 與 PR-2 之間，實作 PR-1 審查 N-1～N-6 與實作、測試 agent 回報的修正，並在合併前完成 12.6 步驟 6b 與 8（`review-record` 設為必要檢查、AC-EQ-11 驗證）。PR-1b 之後的每個 PR 都受 `review-record` 把關。

**PR-1c（v0.6 新增；v0.6.1 依 DQ-14 (b) 與產品負責人 2026-11-10 22:12（Asia/Taipei） 的決定確定內容）：** 位於 PR-1b 與 PR-2 之間：依 DQ-14 (b) 修改 review-gate 與 pr-body 檢查（PR #3 審查紀錄「發現的問題」第 1、2 點），並修改編號檢查與結果檢查（同上第 3、4(b) 點；12.2 第 9d、9e 點、12.2.1 第 4 項）。PR-1c 由 main 上的 PR-1b 版判定，開啟時也是 PR-1b 版在平台上的第一次執行；合併前完成 12.6「PR-1c 由 PR-1b 版判定」的新版試算與人工確認清單；合併後開一次探測 PR B（12.6 步驟 8b），之後才開始 PR-2。工作清單見 docs/design/README.md 第 2 節。

**切分規則：** 驗收在某 PR 轉為實測時，其 Given／When 用到的每個畫面與操作都必須已在該 PR（或更早）存在。早期 PR 已轉實測的驗收，在後續改寫同一畫面的 PR 中仍須成立（例如 PR-4 以選單取代 PR-1 的首頁時保留版本號）。下表最後一欄列出這項檢查的依據。

| PR | 內容 | 需求編號 | 驗收（骨架轉實測） | Given／When 所需畫面與操作 |
|---|---|---|---|---|
| PR-1 基礎 | 以 branch `design/initial` 為基礎（包含其中設計文件與設計 skill 的 commit；設計文件不另外單獨合併，見 DQ-8）；目錄結構、package.json、playwright.config、scripts 全部（build、serve、check-acceptance-ids、check-pr-body、review-gate）、四個工作流程、最小可載入的 `index.html`（只顯示 `version` 元素）、PR 範本更新（12.4）、全部驗收骨架（含設計補充驗收 AC-PS-5、AC-PS-8、AC-RS-4、AC-RS-5、AC-RC-9、NFR-4 的骨架；DQ-10 決定全部啟用，`supplementary-acceptance.json` 的 `enforced: true` 隨本 PR 生效，與骨架同一 PR）、設計文件與設計 skill（docs/design/、.claude/skills/software-design-phase/）、.gitignore | EQ-1、EQ-2（設定步驟）、EQ-3、EQ-4、EQ-5、EQ-9、EQ-11、EQ-12、NFR-1 | AC-EQ-4、AC-EQ-9、NFR-7 首頁 | 首頁與版本號元素（PR-1 提供）。補充驗收骨架為略過，不需畫面 |
| PR-1b 合併前修正（v0.5 新增） | 本設計 v0.5 文件（docs/design/、.claude/skills/software-design-phase/ 1.5；隨本 PR 合併，不單獨合併）。實作 agent：`check-acceptance-ids.mjs` 依 12.2 v0.5（掃描範圍、檔案位置、單元測試不得帶編號、略過寫法）；新增 `check-acceptance-results.mjs`、`acceptance-reporter.mjs`、`acceptance-reporter-pw.mjs`（12.2.1，啟用第 1、2、4、6 項）；`check-acceptance-ids.mjs` 加 12.2 第 9a～9c 點與第 4 點的副檔名範圍；ci.yml 的 `unit` 分兩次執行並檢查結果、`e2e` 以 job 層級 `BUILD_SHA` 並檢查結果（12.1、第 11 節）；playwright.config 加自訂 reporter、一般 project 的 `testMatch`（12.3）；`review-gate.mjs` 依 review-process.md 第 4 節 v0.5（白名單式判定、R-1～R-15、工作階段比對）並加 `--dry-run`（12.6）；`check-pr-body.mjs` 的作者工作階段格式（12.4）；對應的模組單元測試（module-test-standards.md M12）。測試 agent：`tests/support/assertions.mjs`（12.2.1 第 6 項）；已實測的 node:test 驗收測試改由它匯入 `assert`；AC-EQ-4 測試補 12.2 第 11 點的反例與略過寫法的判定；AC-EQ-9 第二個測試在 CI 中必須取得 `BUILD_SHA`（acceptance-test-plan.md #51）。不改任何產品程式（`src/`） | EQ-2、EQ-4、EQ-5、EQ-9、EQ-11；M3 離開條件 | AC-EQ-4、AC-EQ-9（加強，維持通過）；NFR-7 首頁（維持）；AC-EQ-11、AC-EQ-2（人工，12.6 步驟 8；新版的 AC-EQ-11 證據在下一個 PR，步驟 8b。v0.6：PR-1b 版不做步驟 8b，改在 PR-1c 合併後以探測 PR B 觀察最終版本） | 只涉及 CI、檢查腳本與 PR-1 的首頁；不需新畫面。AC-EQ-11 的 Given（其他檢查都通過、沒有審查紀錄的 PR）由 PR-1b 本身提供，前提是 review-gate 在 main 上（已確認）與 6b 已完成 |
| PR-1c 審查檢查收緊（v0.6 新增；v0.6.1 確定） | 本設計 v0.6、v0.6.1 文件（docs/design/、.claude/skills/software-design-phase/ 1.8；隨本 PR 合併，不單獨合併）。實作 agent：新增 `scripts/detection.mjs`（F1～F9、F2′ 文法、X1～X5；v0.6.3 另含自 fa05bbb 逐字複製的 `legacyFieldForm`、`legacyIsTableLine`）；`scripts/review-gate.mjs` 依 review-process.md 4.1（X1～X7、T3、T4、檢查順序、`isCandidateFor` 改為原文含 head SHA、v0.6.3 的相容偵測）；`scripts/check-pr-body.mjs` 的 `validateAuthorSection`（12.4 第 4 點，review-gate 使用同一函式）；`scripts/check-acceptance-ids.mjs` 的 12.2 第 9d、9e 點；`scripts/check-acceptance-results.mjs` 的 12.2.1 第 4 項（空前綴）；對應的模組單元測試（module-test-standards.md M12）。測試 agent：AC-EQ-4 測試（`tests/acceptance/unit/acceptance-ids.test.mjs`）補 12.2 第 11 點的 v0.6.1 反例與對照組；確認既有驗收測試沒有 9d、9e 禁止的寫法。不改 `src/`、工作流程檔、reporter 與 `tests/support/`。合併前完成 12.6「PR-1c 由 PR-1b 版判定」；合併後步驟 8b（探測 PR B） | EQ-4、EQ-5、EQ-11；EQ-2（維持） | 沒有骨架轉實測；AC-EQ-4（加強，維持通過）、AC-EQ-9、NFR-7 首頁維持通過；AC-EQ-11（人工）以合併後的探測 PR B 為主要證據（步驟 8b） | 只涉及 CI 檢查腳本與 PR 說明，不需畫面。AC-EQ-4 的反例以測試資料建立；AC-EQ-11 的 Given（其他檢查都通過、沒有審查紀錄的 PR）由探測 PR B 提供 |
| PR-2 遊戲邏輯 | core 中 `records.js` 以外的模組（config、random、deal、time、game）＋單元測試（含 4.3 的亂數呼叫契約）；`records.js` 歸 PR-5 | GP-1～8、TM-1～5、LV-1、LV-5、LV-6、HT-1～10、PS-1～3、PS-9 的邏輯 | AC-GP-2（統計）、AC-LV-5 | 無畫面（U 層） |
| PR-3 牌面 | faces.js、config 的 faceIds | LV-2～LV-4 | AC-LV-2、AC-LV-3、AC-LV-4 | 無畫面（U 層） |
| PR-4 遊戲、選單與結果畫面 | game-view；menu-view 的難度按鈕與進入關卡（不含紀錄、清除）＋選單頁尾的版本號（`version` 元素，維持 PR-1 已實測的 AC-EQ-9 與「NFR-7 首頁」）；result-view（勝利／失敗、難度名稱、時間、步數、提示次數、重玩本關、回到選單；不含新紀錄與挑戰下一個難度）；遊戲中回到選單；app 路由；clock；版面與 iOS 對策；測試 agent 的端對端牌面配置輔助函式（第 8 節，DQ-7；依賴 PR-2 的 `random.js`、`deal.js`，因此不早於本 PR） | GP-1～8、TM-1～4、LV-1、LV-6～LV-9、HT-1～10、PS-1～4、PS-7（不含紀錄部分）、PS-9、PS-10、RS-1～3、NFR-3、NFR-5、NFR-6、NFR-7、EQ-9（保留） | AC-GP-1～8（AC-GP-2 的 E 層）、AC-TM-1～4、AC-LV-1、AC-LV-6、AC-LV-7、AC-LV-8、AC-LV-9、AC-HT-1～5、AC-HT-7～10、AC-PS-1～4、AC-PS-9、AC-PS-10、AC-RS-1～3、NFR-3、NFR-4（側欄版面）、NFR-5 遊戲畫面、NFR-5 選單、NFR-5 結果畫面、NFR-6、NFR-7 選單、NFR-7 三關遊玩、NFR-7 結果畫面；AC-EQ-9、NFR-7 首頁（PR-1 已實測，本 PR 須維持通過） | 選單進入關卡、遊戲畫面、結果畫面、重玩本關、回到選單（皆在本 PR）；AC-LV-7「沒有任何紀錄」在無紀錄功能時自然成立 |
| PR-5 紀錄 | core/records.js（格式不符整份作廢，DQ-4；`newBestTime`／`newFewestMoves` 依 4.6，DQ-3）、storage、選單的紀錄顯示、清除紀錄與確認對話框、勝利時保存（儲存可用的流程，9.3） | RC-1～8、TM-5（紀錄部分）、PS-7（紀錄不變） | AC-TM-5、AC-PS-7、AC-RC-1～8、NFR-5 清除紀錄對話框 | 選單紀錄顯示、對話框（本 PR）；其餘在 PR-4 |
| PR-6 Should 需求 | 全部本輪實作（DQ-10）：visibility.js 與背景自動暫停、回前景維持暫停（PS-5，DQ-2）；遊戲畫面「重新開始」，任何進行中狀態可用（PS-8，DQ-1）；勝利畫面「新紀錄」（RS-4 v1.1，DQ-3）與「挑戰下一個難度」（RS-5）；儲存不可用提示與記憶體紀錄（RC-9，DQ-5）；README 五節（EQ-10） | PS-5、PS-8、RS-4、RS-5、RC-9、EQ-10 | AC-PS-5、AC-PS-8、AC-RS-4、AC-RS-5、AC-RC-9；NFR-5 遊戲畫面（加入第 4 個按鈕）、NFR-5 結果畫面（加入挑戰下一個難度）、NFR-3、NFR-4 須維持通過 | 遊戲畫面、暫停（PR-4）；紀錄、選單紀錄顯示（PR-5）；重新開始按鈕、新紀錄標示、挑戰下一個難度、儲存不可用提示（本 PR）。AC-EQ-10 為人工，系統測試時執行 |
| PR-7 M3 收尾 | CI 的 `acceptance-ids` 與每個 job 的 `check-acceptance-results` 都加上 `--no-skip`（12.2 第 10 點、12.2.1 第 3、5 項） | M3 離開條件 | 全部 | — |

PR-1、PR-1b、PR-1c 的特別處理見 12.6 步驟 4、6b、8、8b、「EQ-2 啟動例外的處理」與「v0.6 的順序」（DQ-8、DQ-11、DQ-12、DQ-14）。

---

## 15. Should 需求的處理建議與設計補充驗收

需求追溯矩陣把 PS-5、PS-8、RS-4、RS-5、RC-9、EQ-10 的驗收標為「設計階段補」。產品負責人已決定（DQ-10，2026-11-09 16:02）：**下列 Should 需求全部本輪實作，補充驗收全部啟用。**

**啟用規則：** `supplementary-acceptance.json` 中 6 個項目皆為 `enforced: true`，隨 PR-1 生效，PR-1 同時加入對應骨架（略過），PR-6（NFR-4 為 PR-4）轉為實測。之後若改變範圍，`enforced` 與骨架必須在同一 PR 變更，並經 R-14 審查。

| 需求 | 決定 | 補充驗收（皆為自動，AC-EQ-10 除外） |
|---|---|---|
| PS-5 | 本輪實作 | **AC-PS-5**：Given 遊戲中計時累計 When 觸發頁面隱藏（測試以 `document.visibilityState` 覆寫並派送 `visibilitychange`）Then 進入暫停、遮蔽牌面、已用時間停止；When 恢復可見並推進 3 秒 Then 仍為暫停、遮蔽層仍顯示、已用時間不變（DQ-2）；When 點擊「繼續」Then 已用時間恢復累計。反例：Given 選單畫面 When 觸發頁面隱藏再恢復 Then 仍為選單、沒有錯誤 |
| PS-8 | 本輪實作 | **AC-PS-8**：Given 遊戲中（含翻錯鎖定中），已用時間大於 0、步數大於 0、剩餘提示 2 When 點擊「重新開始」Then 同一關新的一次遊玩：已用時間 0.0、步數 0、剩餘提示 3、12 張背面、未暫停，且該關紀錄不變。Given 暫停中 When 點擊「重新開始」Then 同上，且遮蔽層消失、新遊玩未暫停（DQ-1）。Given 尚未開始計時 When 點擊「重新開始」Then 同一關新的一次遊玩，已用時間 0.0（DQ-1）。Given 新遊玩開始後 When 推進 1.1 秒 Then 12 張牌仍全部背面、`data-hinted` 皆為 false（舊遊玩的翻錯鎖定與提示標示沒有作用於新遊玩） |
| RS-4 | 本輪實作（v1.1 條文） | **AC-RS-4**：Given 第 1 關最佳時間 30.0、最少步數 18 When 以 29.9 秒、20 步勝利 Then 時間旁標示「新紀錄」，步數旁不標示。相等時不標示：When 以實際 30.04 秒（顯示 30.0）、18 步勝利 Then 兩項都不標示（與 AC-RC-3 一致）。**尚無紀錄（v1.1）正例：** Given 第 2 關無紀錄 When 以任意結果勝利 Then 時間與步數旁都標示「新紀錄」。Given 第 1 關最佳時間 30.0、最少步數為無紀錄（依 9.1 格式預寫 `fewestMoves: null`）When 以 31.0 秒、20 步勝利 Then 步數旁標示，時間旁不標示（逐項判定）。Given 保存的紀錄資料無法解析（整份作廢，DQ-4）When 以任意結果勝利 Then 兩項都標示。**尚無紀錄反例：** Given 第 1 關兩項都有紀錄（30.0、18）、第 2 關無紀錄 When 在第 1 關以 31.0 秒、20 步勝利 Then 兩項都不標示（「尚無紀錄」以同一關同一項判定，不受其他關卡影響）。Given 第 3 關無紀錄 When 第一次勝利後以較差的結果再勝利 Then 第二次勝利兩項都不標示（第一次勝利已產生紀錄） |
| RS-5 | 本輪實作 | **AC-RS-5**：Given 簡單的勝利畫面 When 點擊「挑戰下一個難度」Then 開始普通的新遊玩；普通→困難同理；困難的勝利畫面沒有此按鈕 |
| RC-9 | 本輪實作 | **AC-RC-9**：Given 以 `addInitScript` 讓 `localStorage.setItem` 丟出例外 When 開啟頁面 Then 選單顯示「紀錄無法保存」，可進入任一關並勝利，主控台沒有未處理的錯誤；When 勝利後回到選單 Then 該關顯示本次勝利的紀錄，且仍顯示「紀錄無法保存」（DQ-5）；When 重新整理頁面 Then 該關顯示「—」（只存在記憶體）。反例：Given 儲存可用 When 開啟頁面 Then 不顯示「紀錄無法保存」 |
| NFR-4 | 本輪實作（版面已涵蓋） | 依需求量測方法，測試名稱含 NFR-4 |
| EQ-10 | 本輪實作 | **AC-EQ-10**（人工）：README 含五節；在乾淨的 clone 依步驟執行可開啟遊戲並通過測試。由測試 agent 在系統測試時執行並記錄 |
| NFR-8、NFR-9 | 系統測試時量測並記錄（人工） | 依需求量測方法 |

---

## 16. 待決問題（DQ-1～DQ-14 已全部關閉）

**產品負責人於 2026-11-09 16:02 決定：DQ-1～DQ-10 全部採用下表「選項與建議」欄的建議。** DQ-11、DQ-12 為 v0.5 新增，產品負責人於 2026-11-10 16:06 決定（見表）。DQ-13 為 v0.5.1（簽核後釐清）新增，產品負責人於 2026-11-10 16:47 決定採 (b)。DQ-14 為 v0.6 新增，產品負責人於 2026-11-10 22:12（Asia/Taipei） 決定採 (b)，附帶問題一併處理。「決定與設計對應」欄列出決定寫入的章節；「阻擋」欄保留原本的阻擋範圍供追溯，已不再阻擋。DQ-3 需修改需求，統籌 agent 已把需求文件升為 v1.1（RS-4）。

| 編號 | 問題 | 發現情境 | 選項與建議 | 阻擋 | 狀態與決定 |
|---|---|---|---|---|---|
| DQ-1 | PS-8「重新開始本關」在暫停中、尚未開始計時時是否可用？需求 6.9 沒有「重新開始」欄 | 依 3.8 列操作時發現 6.9 只列了 Must 操作 | 建議兩者皆可用，效果同「回到選單後再進入同一關」（與 PS-7 在相同狀態下可用一致） | PR-6（PS-8） | 已關閉（2026-11-09）：採建議，暫停中與尚未開始計時時「重新開始」皆可用。對應 5.5、5.7、4.11、第 15 節 AC-PS-8 |
| DQ-2 | PS-5 自動暫停後回到前景時，自動繼續還是維持暫停？ | PS-5 只規定進入背景的行為 | 建議維持暫停，由玩家按「繼續」；自動繼續會讓剛切回來、尚未看清畫面的玩家損失時間 | PR-6（PS-5） | 已關閉（2026-11-09）：採建議，回到前景維持暫停。對應 5.6、5.7、6.4、第 15 節 AC-PS-5 |
| DQ-3 | RS-4「新紀錄」在該關**尚無紀錄**時是否標示？需求只寫「優於既有紀錄時」 | 寫 `mergeWin` 回傳值時發現 | 建議標示。若採用，由統籌 agent 依 requirements-spec 修訂 RS-4（例如「優於既有紀錄或該項尚無紀錄時」）並升版需求文件；設計不逕行假定 | PR-6（RS-4） | 已關閉（2026-11-09）：採建議，尚無紀錄時標示；需求 v1.1 已修訂 RS-4。對應 4.6、4.11、第 15 節 AC-RS-4 |
| DQ-4 | RC-8「格式不符」是整份資料視為無紀錄，還是只把不符的那一項視為無紀錄？ | 設計驗證規則時發現 | 選項 (a) 整份（字面）：實作簡單；**連帶影響：下一次勝利保存時會以新資料覆寫整份，其他關卡原本可能仍有效的紀錄永久遺失**。(b) 逐項：只捨棄不符的項目，其餘保留；驗證與合併較複雜，需另定「部分有效」時是否改寫其他項目。(c) 整份視為無紀錄，但覆寫前把原始字串另存備份鍵：保留復原可能，但需求沒有復原功能，備份不會被使用。建議 (a)，因為格式不符只會在資料被外部改寫或版本不相容時發生；若產品負責人重視保留紀錄，選 (b) | PR-5（`records.js` 與 RC-8）；決定前不實作任何選項 | 已關閉（2026-11-09）：採 (a) 整份作廢，接受下次勝利覆寫整份的連帶影響。對應 4.6、9.2、9.3、module-test-standards.md M6 |
| DQ-5 | RC-9 儲存不可用時，本次開啟期間的勝利是否在選單顯示（只存在記憶體）？ | 設計 RC-9 時發現 | 建議顯示，並保留「紀錄無法保存」提示；關閉頁面後消失 | PR-6（RC-9） | 已關閉（2026-11-09）：採建議，記憶體紀錄在選單顯示並保留提示。對應 9.3、9.4、10.3、第 15 節 AC-RC-9 |
| DQ-6 | `requirements-spec` 沒有變更紀錄，PR 說明無法填寫其版本號，workflow.md 4.4 的證明對它無效 | 上工檢查時發現 | 建議產品負責人為 requirements-spec 加上變更紀錄。在此之前採 12.4 第 3 點的過渡規則（填「無版本號」，檢查記為警告） | PR-1（`check-pr-body` 的規則） | 已關閉（2026-11-09）：採建議。產品負責人為 requirements-spec 加變更紀錄（將為 1.1），並納入 agent-dev-workflow 的建議修改（將為 1.1）；版本庫副本由另一個 PR 同步。同步前填「無版本號」，同步後改填版本號。對應 12.4、review-process.md 第 2 節。v0.5 註記：副本同步實際隨 PR-1 合併（commit 40725e0），過渡規則已結束（12.4） |
| DQ-7 | 端對端測試如何得知牌面配置？`data-face` 讓背面朝上的牌在 DOM 中帶有牌面識別碼，玩家用開發者工具即可看到全部答案；需求以 Q8、PS-4 的決定顯示重視「不讓玩家取得不該有的資訊」 | 設計 DOM 測試介面時發現（設計審查 B-2 指出原以假設處理不當） | (a) **保留 `data-face`（所有牌皆帶）並接受**：成本最低，測試最簡單；影響：任何玩家可由開發者工具得知答案。(b) **測試控制亂數**：DOM 不帶牌面識別碼；測試以 `page.addInitScript` 包裝 `crypto.getRandomValues`，可指定或記錄亂數，並在 Node.js 以同一份 `deal` 重算配置；正式程式不變。成本：中，測試依賴「每次 `deal` 恰呼叫 11 次 `randomInt`」這項介面契約（4.3，由單元測試固定）。**重算方式：** 測試記錄 `getRandomValues` 的**全部**輸出（依呼叫順序），在 Node.js 以 `src/js/core/random.js` 的 `createCryptoRandomInt` 搭配一個依序回放這些輸出的假 `cryptoObj`，再呼叫 `deal.js` 重放；不得假設「每局固定取 11 個值」，因為拒絕取樣偶爾會多取（機率約 n／2³²），提示選牌（T-8）也會消耗亂數。(c) **只在正面朝上時輸出 `data-face`**（只透露畫面上已看得到的資訊）：DOM 不洩漏；測試要找同一對須先翻牌探索，AC-GP-1、AC-GP-2（E 層）需逐對翻開全部牌，測試輔助較複雜、執行較久（控制時鐘下仍快）。(d) **測試專用建置**（建置參數開啟除錯掛鉤）：成本低，但端對端測的不是發布的檔案，違反「測試受測的版本」，不建議。**建議 (b)＋(c) 併用**：正面朝上的牌帶 `data-face`（驗證顯示內容），配置由 (b) 取得；不洩漏答案，正式程式不需測試入口 | **PR-1**（DOM 測試介面與 E 層骨架的寫法） | 已關閉（2026-11-09）：採 (b)＋(c)。對應 4.3、4.5、4.11、第 8 節「端對端測試取得牌面配置」、acceptance-test-plan.md |
| DQ-8 | EQ-2「主分支只能透過 PR 變更，套用於管理員」的啟動例外是否接受：(1) 初始 commit 已直接推送；(2) PR-1 在分支保護與審查檢查生效前合併（審查紀錄由產品負責人人工確認）；(3) 設計文件目前在 branch `design/initial`（commit `c41913a`、`49aa1eb`、`cadf291` 及之後的修訂）：設計規定以它為 PR-1 的基礎、不單獨合併；若產品負責人選擇先以獨立 PR 合併設計文件，該合併同樣不受審查檢查與分支保護約束，屬第三個例外。另 `review-record` 須在 PR-2 寫入過一次才能加為必要檢查（12.6 步驟 6b） | 設計啟動程序時發現（設計審查 M-7） | 建議接受 (1)、(2)，並讓設計文件隨 PR-1 合併以避免 (3)；在 UAT 紀錄或 release notes 註明。技術上沒有不經例外的啟動方式（開 PR 需要基底分支；`issue_comment` 工作流程只在預設分支生效） | **PR-1** | 已關閉（2026-11-09）：接受 (1)、(2)；設計文件隨 PR-1 合併，不發生 (3)；由產品負責人在 UAT 紀錄或 release notes 註明。對應 12.6「EQ-2 啟動例外的處理」、verification.md。v0.5 註記：6b 由 PR-2 改到 PR-1b（PR-1 之後第一個 PR），理由見 12.6；不新增例外 |
| DQ-9 | EQ-12「10 分鐘內」與官方「最多可能需要 10 分鐘」相同，沒有餘裕。GitHub 端延遲造成 `smoke` 或 AC-EQ-12 失敗時如何處理？ | 查證 Q6 時發現 | 建議：`smoke` 失敗時重新執行該工作流程一次並記錄兩次的時間；若 AC-EQ-12 人工驗收時超過 10 分鐘，記為外部因素造成的觀察，連同 GitHub Status 當時狀態回報產品負責人，由產品負責人判定是否視為通過，不修改程式 | PR-1（`smoke` 的失敗處理） | 已關閉（2026-11-09）：採建議。對應 12.5「smoke 失敗與 EQ-12 逾時的處理」、verification.md 2.4 |
| DQ-10 | Should 需求（PS-5、PS-8、RS-4、RS-5、RC-9、NFR-4、EQ-10）本輪是否實作，以及第 15 節的設計補充驗收是否採用 | 追溯矩陣把 PS-5、PS-8、RS-4、RS-5、RC-9、EQ-10 的驗收標為「設計階段補」；NFR-4 為 Should 的非功能需求（矩陣中驗收為「量測方法」） | 建議全部本輪實作，並在設計簽核時一併決定，讓 PR-1 依決定設定 `enforced` 並加入骨架 | **PR-1**（骨架與 `enforced`） | 已關閉（2026-11-09）：Should 需求全部本輪實作，補充驗收全部啟用（`enforced: true`，隨 PR-1 生效）。對應第 14、15 節、supplementary-acceptance.json、acceptance-test-plan.md 第 3 節 |
| DQ-11 | **main 上的 review-gate 無法寫入 `review-record` 狀態時**（第 3 輪審查 M-3 擴大範圍：不限 PR-1b 第一次執行，也包括 PR-1b 合併後新版第一次執行、以及之後任何 review-gate 變更合併後），修正它的那一個 PR 由無法運作的版本判定，必然在沒有 `review-record` 把關下合併；`review-record` 已是必要檢查時，該 PR 甚至無法合併 | v0.5 依 agent-dev-workflow 4.3 把 6b 改到 PR-1b 時發現：review-gate 在 main 上從未執行過（12.6）；第 3 輪審查指出新版在 PR-1b 合併後才第一次在平台執行，形成同樣的情況 | (a) **接受為啟動例外，只限修正它的那一個 PR**：CI 其餘必要檢查仍須通過；若 `review-record` 已是必要檢查，產品負責人暫時移除它、合併修正 PR、立即加回；審查紀錄由產品負責人人工確認（同 DQ-8 (2)），並以修正後的版本做 12.6 的 `--dry-run` 試算；合併後下一個 PR 重做步驟 8b；在 UAT 紀錄或 release notes 註明。(b) **PR-1b 開啟前以 API 先加入必要檢查**：若平台接受未執行過的 context，PR-1b 從開啟起就受把關；但 review-gate 若不能運作，PR-1b 永遠無法合併，最後仍要退回 (a)；能否指定未執行過的 context 未查證（verification.md 2.5）。(c) 停止並重新設計（例如改為 `pull_request` 事件的檢查），成本高且失去「評論後自動更新」。(d) **先開不合併的探測 PR**：PR-1b 開啟前，開探測 PR A（branch `probe/review-gate-a`，只含一個空 commit，PR 說明含必要段落），觸發舊版第一次執行；寫入狀態後完成 6b 與步驟 8（AC-EQ-11、AC-EQ-2），關閉不合併。PR-1b 開啟時即受 `review-record` 把關，驗證用的 commit 不混入 PR-1b。PR-1b 合併後再開探測 PR B 做步驟 8b，在 PR-2 之前確認新版能運作。探測 PR 不合併，不構成未經檢查的合併。代價：兩個 PR 與兩輪 CI。**建議 (d)，並以 (a) 作為「確實無法寫入狀態」時的唯一處理**：(d) 把「第一次執行」移到不需要合併的 PR 上，失敗時不卡住任何內容，也能乾淨地做 DQ-12 (b)；(a) 只在 (d) 或之後的執行實際發現無法寫入時才適用 | PR-1b 開啟前決定；(a) 只在發生時阻擋修正 PR 的合併 | 已關閉（2026-11-10 16:06）：採 (d)，以 (a) 為確實無法寫入狀態時的唯一處理。v0.6 註記：依產品負責人 2026-11-10 21:37 同意的順序，PR-1b 版不另開探測 PR，PR-1c 開啟時即為 PR-1b 版的第一次執行，無法寫入時 (a) 適用於 PR-1c；探測 PR B 在 PR-1c 合併後觀察最終版本（12.6「v0.6 的順序」）。決定本身不變 |
| DQ-12 | AC-EQ-2 第一步「CI 失敗的 PR 以管理員身分合併被拒」以什麼驗證？ | 6a 已生效、直接推送已驗證被拒，但「CI 失敗時合併被拒」尚未有紀錄；步驟 8 (1) 的驗證 PR 自然出現一個必要檢查失敗、其他檢查通過的 PR | (a) **以 `review-record` 失敗驗證**：EQ-11 規定審查檢查是 CI 的一部分（「CI 應檢查…沒有時檢查失敗，依 EQ-2 無法合併」）；`enforce_admins` 作用於整條保護規則，不分檢查類型。不需額外 commit。(b) **另外以 `unit` 失敗驗證**：在驗證 PR 推送一個讓 `unit` 失敗的 commit，確認管理員合併被拒，再推送還原；較貼近字面，並實際觀察 check run 類的必要檢查擋下管理員。代價：兩個 commit 與一輪 CI。**建議：採 DQ-11 (d) 時兩者都做（(b) 在探測 PR 上執行，不污染 PR-1b，成本很低）；未採 (d) 時採 (a)** | 步驟 8 | 已關閉（2026-11-10 16:06）：採 (a)＋(b)，都在探測 PR A 上執行 |
| DQ-13 | 審查紀錄的偵測形式（review-process.md 第 4 節）是否進一步收緊，涵蓋目前仍被判為有效的「看似欄位或 R 列」的寫法 | v0.5.1：實作 agent 回報 v0.5 的偵測規則偵測不到合法的 `- 結果：` 行；設計 agent 修正為去除行首區塊標記後，以 PR-1b 的 `validateRecord` 實測 20 種寫法：引用、標題、有序清單、縮排中的第二個欄位與引用區塊中的表格都判為無效；NFKC 不轉換的項目符號（`•`、`・`、`–`）、工作清單、HTML 標籤與註解、反斜線跳脫、中文或括號編號、連結、以清單符號開頭的表格列、HTML 表格、條列中的「R-5：不通過」仍判為有效（review-gate 讀合法行的值）。這些在已簽核的 v0.5 字面規則下同樣不被偵測，所以不是 v0.5.1 新開的繞過，但收緊會改變審查紀錄的合法範圍並需修改 review-gate | (a) **維持 v0.5.1 規則**，殘餘風險寫在 review-process.md 第 4 節，由審查 agent 依格式撰寫、產品負責人抽查（AC-EQ-5）補足；不改程式。(b) **擴大偵測形式**：先移除 HTML 註解與標籤、反斜線跳脫、工作清單核取方塊，連結 `[文字](網址)` 只留文字，再去除行首**所有**非字母數字字元（Unicode 類別 L、N 以外）與編號（數字後接非字母數字字元、括號包住的數字）後比對標籤；表格列的偵測同樣先去除行首 `|` 以外的符號。條列中的「R-5：不通過」不在 (b) 的範圍（「發現的問題」本來就可以用條列描述某項的問題，判為無效會誤判合法紀錄），維持由審查與抽查處理。只增加無效的情況，第 2 節的合法格式不受影響。成本：`review-gate.mjs` 與單元測試小幅修改；依 12.6，修改 review-gate 需新版 `--dry-run` 試算並在下一個 PR 重做步驟 8b。(c) **(b)＋標記行以外不得有任何 HTML 標籤或註解**：最嚴；但說明欄引用程式碼（例：寫到 `<script>`）的合法紀錄也會無效，審查者需改寫後重留。**建議 (b)**：(a) 保留的是「讀者與 review-gate 讀到不同內容」的情況，正是白名單要消除的；(b) 成本低、沒有合法紀錄被誤判；(c) 的誤判會讓審查者反覆重留紀錄，而 HTML 註解不會被讀者看到，不構成讀者與檢查之間的不一致 | PR-1b 合併前決定（PR-1b 本身修改 review-gate，採 (b) 或 (c) 時在 PR-1b 一併實作，可共用同一次試算與步驟 8b；PR-1b 合併後才決定則需另一個修改 review-gate 的 PR，並再做一次試算與步驟 8b）。決定前不實作 (b)、(c) | 已關閉（2026-11-10 16:47（Asia/Taipei））：採 (b)。完整規則（F1～F8、T1、T2、20 種寫法的判定表、回歸檢查）寫在 review-process.md 第 4 節「偵測形式」；本列「選項與建議」欄只是決定前的摘要，以正文為準 |
| DQ-14 | review-gate 的 PR-1b 版（DQ-13 (b)）仍有讀者與 review-gate 看到不同內容的寫法，是否收緊、採哪個做法？附帶問題：PR 說明「## 作者」段落中以半形冒號寫的「工作階段: x」不被採計為作者、`pr-body` 也不失敗（review-gate 的「審查者不等於作者」可因此被繞過），是否一併處理 | PR #3 審查紀錄（2026-11-10 09:17Z）「發現的問題」第 1 點（中）、第 2 點（低）：沒有前導直線的表格列、字元參照、以 U+3164 開頭的行被判為有效；PR-1 版同樣有效，所以 PR-1b 沒有放寬。設計 agent 以 cmark-gfm 實測並全面檢查同類問題，共 30 個案例（另含單欄表格、Default_Ignorable_Code_Point 與結合符號插在欄位名稱中、HTML 註解與處理指令、引號中含 `>` 的屬性、跨行標籤、簡體欄位名、把合法行或逐項表整段藏在註解中），見 review-process.md 4.1 | 選項的完整規則、誤判、成本與殘餘風險見 review-process.md 4.1。摘要：(a) **依 GFM 模擬渲染重寫偵測**（解碼字元參照、刪除可忽略字元、依 GFM 判定表格範圍）：誤判最低、成本高、模擬不完整處成為新繞過。(b) **正規化前先拒絕**字元參照、Default_Ignorable_Code_Point、結合符號、U+2800、第 1 行以外的 `<!`／`<?`、跨行標籤，標籤改用 CommonMark 文法、欄位名稱對應簡體字，並加兩條表格邊界規則（逐項表後必須是空行；全文只能有一個分隔列）：30 個案例全部無效、成本低；誤判為寫到字元參照（含程式碼中；PR #3 的實際紀錄因此無效）、emoji 變體選擇符、散文中的 `a<b`、HTML 註解、表後沒有空行。(c) **限定極小語法子集**：殘餘風險最低，但三則實際紀錄全部無效，審查者的寫法要改。(d) **以 GitHub 的 `body_html` 判定**：誤判低、成本中高，依賴 GitHub 未承諾的 HTML 格式。(e) **不修改**，列為殘餘風險：不需 PR-1c。**建議 (b)，附帶問題一併採用**（作者段落中看似「工作階段」的行都必須逐字合法） | PR-1c（決定前不開始實作）；PR-2 在 PR-1c 合併與探測 PR B 之後開始。期限：PR-1c 實作開始前 | 已關閉（2026-11-10 22:12（Asia/Taipei））：採 (b)，附帶問題一併處理；同時決定 PR #3 審查第 3、4(b) 點放進 PR-1c。完整規則寫在 review-process.md 4.1（v0.6.1）；寫入本文件 12.2 第 9d、9e 點、12.2.1 第 4 項、12.4 第 4 點、12.6、第 13、14 節，module-test-standards.md M12。本列「選項與建議」欄是決定前的摘要，以正文為準 |

---

## 17. 假設

| 編號 | 假設 | 若不成立 |
|---|---|---|
| DA-1 | `statuses: write` 權限可讓 `GITHUB_TOKEN` 寫入 commit status（未查證原文） | 改用 check run（`checks: write`），判定邏輯不變 |
| DA-2 | 產品負責人只用一個 GitHub 帳號，沒有 fork PR | review-gate 已處理 fork（不執行 PR 程式碼、不插值事件內容），不影響 |
| DA-3 | `package.json` 的 `version` 本輪固定為 1.0.0 | 若產品負責人希望 UAT 前使用預發布版本號（例如 1.0.0-rc），發布前需再一個 PR 改版本號，該 PR 會觸發 EQ-14 的重新 UAT；因此建議維持 1.0.0 |
| DA-4 | （v0.2 移為待決問題 DQ-7） | — |
| DA-5 | 目標瀏覽器支援 `dvh`、ES 模組、CSS `min()`（Safari 15.4+、Chrome 108+、Firefox 101+） | 加上 `100vh` 後備（已在 10.2 規定）；更舊瀏覽器不支援，屬 NFR-2 的 UAT 範圍 |

---

## 18. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 依需求文件 v1.0 進行設計 |
| 0.2 | 2026-11-04 | 依設計審查修訂：PR 切分（第 14 節，選單與結果畫面移入 PR-4，新增 Given／When 檢查欄）；DA-4 移為 DQ-7，DOM 介面受影響處標「依 DQ-7 決定」，新增 `data-shown`、`data-role`；I-2、I-5、T-11 修正；時間上限一律以顯示值判定（5.3、5.4）；版面固定高度、按鈕 48 px、4 px 餘裕並重算（10.2）；移除 `viewport-fit=cover`（10.4）；CI 並行群組、注入防護、`node --test` 改用 glob、NFR-6 獨立 project（12.1、12.3）；略過偵測擴充（12.2）；多位作者解析與 requirements-spec 過渡規則（12.4）；啟動程序 0、6a、6b、9（12.6）；補充驗收啟用規則（15）；新增 DQ-7～DQ-10，DQ-4 補連帶影響、DQ-3 改由統籌 agent 修訂需求 | design-review.md B-1、B-2、M-1～M-12、P-3、P-4、P-5、P-7、P-8、P-9 |
| 0.3 | 2026-11-04 | 4.5 不再預先排除 DQ-7 選項 (a)；6.3 改以顯示值描述勝利；`records.js` 移到 PR-5，9.2、9.3、DQ-4 不預設任一選項；PR-4 保留版本號元素並列 EQ-9；切分規則補「已實測的驗收在後續 PR 仍須成立」；12.6 步驟 6b 前審查 agent 不留 PR-2 紀錄；PR-1 以 `design/initial` 為基礎，DQ-8 加入例外 (3)；DQ-7 選項 (b) 補重算方式；DQ-10 修正發現情境 | design-review.md 回歸審查（第 2 輪）N-1、N-2、N-4～N-7、N-9、N-10 |
| 0.4 | 2026-11-09 | 依產品負責人對 DQ-1～DQ-10 的決定，把「依 DQ-n 決定」全部替換為決定後的設計：重新開始在 S0 與暫停中可用（5.5、5.7、DQ-1）；背景自動暫停、回前景維持暫停（5.6、5.7、6.4、DQ-2）；`newBestTime`／`newFewestMoves` 改為「該項被取代時」、AC-RS-4 補尚無紀錄的正例與反例（4.6、4.11、第 15 節、DQ-3）；格式不符整份作廢及其連帶影響（4.6、9.2、9.3、DQ-4）；儲存不可用時的記憶體紀錄（9.3、9.4、10.3、DQ-5）；過渡規則的適用期間與同步後改填版本號（12.4、DQ-6）；`data-face` 只在實際渲染牌面時輸出，測試以記錄亂數＋錨點＋正式程式重放取得配置（4.3、4.5、4.11、第 8 節、DQ-7）；EQ-2 啟動例外的處理（12.6、DQ-8）；smoke 失敗與 EQ-12 逾時的處理（12.5、DQ-9）；Should 全部實作、補充驗收全部啟用，PR-1、PR-4、PR-5、PR-6 切分表更新（第 14、15 節、DQ-10）；第 16 節改為已關閉；需求依據改為 v1.1；選單與結果畫面高度補算 | 產品負責人 2026-11-09 16:02 的決定；需求文件 v1.1 |
| 0.5 | 2026-11-09 | (1) 12.2 改寫：採計覆蓋的掃描範圍限定為 `tests/acceptance/`，`tests/unit/` 名稱不採計並禁止含必要編號，驗收測試檔位置限定，驗收測試只允許骨架宣告一種略過寫法、其餘寫法（含本體內 `test.skip()`／`test.fixme()`／`test.fail()`／`t.skip()`、條件略過、`annotation`、`expectFailure`）一律失敗，寫明靜態偵測的界限；`--no-skip` 對 `tests/unit/` 維持原嚴格程度。(2) 新增 12.2.1 執行結果檢查（node:test 自訂 reporter、Playwright json；略過、預期失敗、沒有執行的判定；啟用時點）；12.1、12.3、第 3 節對應更新，job 名稱不變。(3) 第 11 節、12.1：e2e 的 `BUILD_SHA` 改為 job 層級，判斷需要修正並寫明理由。(4) 第 13 節：重複 R 列整則無效、結果值限定、任一列不通過即失敗、工作階段忽略大小寫比對。(5) 12.4：DQ-6 過渡規則改為已隨 PR-1 結束，PR 範本描述更新；多角色 PR 列出全部作者。(6) 12.6：6b 與步驟 8（AC-EQ-11、AC-EQ-2 合併被拒）改到 PR-1b；記錄 6a 已完成（以 API 讀取確認）；確認 review-gate 在 main 上、PR-1b 會觸發；PR-1b 由舊版 review-gate 判定的限制與人工確認。(7) 第 14 節新增 PR-1b，PR-7 的 `--no-skip` 擴及執行結果檢查。(8) 新增 DQ-11、DQ-12；DQ-6、DQ-8 加 v0.5 註記；依據改為 workflow.md v0.2 | PR-1 審查紀錄（PR #1，2026-11-09 08:41）N-1（重複 R 列與大小寫）、N-2（略過偵測不完整、掃描範圍含 `tests/unit/`）、N-3（同步 PR 描述過時）、N-4(a)（作者段落）、N-6（e2e 未傳 `BUILD_SHA`）；實作與測試 agent 回報（同上問題）；agent-dev-workflow 1.1 第 4.3 節「啟動例外以外不得再有不經檢查的合併」 |
| 0.5（第 3 輪審查修訂） | 2026-11-09 | 同一版本內依設計審查第 3 輪修訂：(M-1) 12.2 骨架本體須為空、新增第 9a 點（非骨架測試至少一個斷言呼叫）、第 9c 點（node:test 驗收測試自 `tests/support/assertions.mjs` 匯入 `assert`）；12.2.1 新增第 6 項（斷言執行至少一次、沒有被吞掉的失敗斷言；Playwright 改用自訂 reporter 計數 `expect` 步驟，node:test 以 hook＋`t.diagnostic` 回報）與「殘餘風險」（只能靠審查的部分、不採用自動化變異測試的理由）；新增審查清單 R-15。(M-2) 第 13 節與 12.4：審查紀錄白名單式判定、作者與審查者識別的字元集。(M-3) 12.6：PR-1b 合併前以新版 `--dry-run` 試算＋完整人工確認清單；新增步驟 8b（新版第一次在平台執行的 AC-EQ-11 證據，及之後每次 review-gate 變更）；6b、8 改以「驗證 PR」描述；DQ-11 擴大範圍並新增選項 (d) 探測 PR、建議改為 (d)＋(a)；DQ-12 建議依 DQ-11 調整。(P-1) 第 16 節表格空行。(P-2) 12.2 第 9b 點測試名稱不得重複。(P-3) 12.2 第 4 點涵蓋任何副檔名、12.3 一般 project 的 `testMatch`、第 8 點寫明掃描範圍。(P-4) 殘餘風險與 R-14。(P-5) 第 16 節多餘空格。第 3、14 節、12.1、12.3 對應更新 | design-review.md 設計審查第 3 輪（commit f4ab877）M-1～M-3、P-1～P-5 |
| 0.5.1（簽核後釐清） | 2026-11-10 | 實作 agent 依 agent-dev-workflow 5.1 回報的 4 項：(1) 第 13 節與 review-process.md 第 4 節：偵測形式去除行首區塊標記（v0.5 偵測不到合法行，設計錯誤；實作的做法正確並採用），列出殘餘寫法，新增 DQ-13；(2) 12.2.1 `evaluateResults` 簽名補 `staticFiles`、`requiredIds`、`errors`（設計遺漏），新增第 7 項全域錯誤；(3) 12.2.1 新增「結果檔的交接」（位置、結束標記、`ACCEPTANCE_RESULTS_FILE`）、12.1 寫出結果檔名；review-process.md 寫明 `--dry-run` 在 PR 已關閉時仍試算（設計遺漏，採用實作的做法）；(4) 12.2 第 9c 點寫明適用於只含骨架的檔案（不豁免；設計原意，寫得不夠明確）。另修正表頭與第 16 節標題在 v0.5 簽核後仍寫「待簽核／待決定」 | 實作 agent 回報（PR-1b，commit 0009cee～ad5067d）；設計 agent 閱讀 `scripts/review-gate.mjs`、`scripts/check-acceptance-results.mjs`、兩個 reporter、`playwright.config.mjs`、ci.yml 與對應單元測試後判斷 |
| 0.5.1（DQ-13 (b) 寫入正文） | 2026-11-10 | 開頭說明、第 13 節摘要、第 16 節標題與說明、DQ-13 狀態欄改為已決定 (b)，並指向 review-process.md 第 4 節的完整規則；不改變已確認的決定 | 產品負責人 2026-11-10 16:47 確認 v0.5.1、DQ-13 採 (b)；實作 agent 回報正文與狀態未改寫 |
| 0.6 | 2026-11-10 | (1) 新增 DQ-14：PR-1b 版 review-gate 仍可被繞過的寫法（以 cmark-gfm 實測 30 個案例，review-process.md 4.1）與附帶問題（作者段落的半形冒號），列出 (a)～(e) 五個選項、建議 (b)；第 13 節、12.4 第 4 點標示「依 DQ-14 決定」。(2) 12.6：依產品負責人同意的順序，PR-1b 版不做步驟 8b；新增「v0.6 的順序」（DQ-14 決定與 v0.6 簽核 → PR-1c → 一次探測 PR B → PR-2；PR-1c 開啟即為 PR-1b 版的第一次平台執行，無法寫入時依 DQ-11 (a)）、「PR-1c 由 PR-1b 版判定」（新版試算＋人工確認清單 (i)～(xi)）；步驟 8b 改為 PR-1c 合併後的探測 PR B；「新版 review-gate 在平台上的第一次執行」補連續修改時只對最後一版做一次、`check-pr-body.mjs` 的變更也算；「已記錄的設定」補 6b 與步驟 8 已在探測 PR A 完成。(3) 第 14 節新增 PR-1c 的說明與切分列；PR-1b 列補註。(4) 第 16 節標題與說明、DQ-11 補 v0.6 註記（決定不變）。(5) 表頭、開頭說明與依據 | PR #3 審查紀錄（2026-11-10 09:17Z）「發現的問題」第 1、2 點；產品負責人 2026-11-10 21:37 同意統籌 agent 的建議；設計 agent 以 API 讀取 review-gate 的執行紀錄與分支保護（2026-11-10） |
| 0.6.1 | 2026-11-10 | 依產品負責人 2026-11-10 22:12（Asia/Taipei） 的決定：(1) DQ-14 採 (b) 寫入正文（review-process.md 4.1；本文件第 13 節、12.4 第 4 點作者段落規則、12.6 人工確認清單改為確定的 (vii)～(xii)，刪除 (e) 的分支與「採其他選項時」）；寫入時發現沿用偵測形式判定候選會與「只增加無效」矛盾，改為原文含 head SHA 即為候選。(2) PR #3 審查第 3 點：12.2 新增第 9d 點（樣板名稱的前綴非空且同檔互不為前綴）、12.2.1 第 4 項空前綴不比對。(3) 同上第 4(b) 點：12.2 新增第 9e 點（`tests/acceptance/unit/` 禁止子測試與 concurrency；本機實測 node:test 的三種子測試寫法）。(4) 第 11 點補 AC-EQ-4 反例；第 14 節 PR-1c 列改為確定的內容（含測試 agent 的工作）；第 16 節 DQ-14 關閉；表頭與開頭說明。範圍擴大屬產品負責人此次明確同意，不需另行簽核 | 產品負責人 2026-11-10 22:12（Asia/Taipei） 於對話中回覆「DQ-14 選 b。第 3、4(b) 點放進 PR-1c。簽核設計 v0.6」（統籌 agent 轉達）；software-design-phase 3.4.1 第 1a 點 |
| 0.6.2 | 2026-11-10 | 簽核後釐清（不改產品負責人的決定）：12.6 PR #2 試算的預期改為實際原因（head 沒有候選紀錄，兩版皆「沒有針對 e042cbd 的審查紀錄」）；12.2 第 9d 點寫明涵蓋修飾變體與 `describe`；12.2.1 第 4 項寫明空前綴也套用於樣板 `describe` 的外層路徑 | 實作 agent 依 agent-dev-workflow 5.1 回報的 6 點（branch `pr-1c-impl`，head 2cc1fa4；統籌 agent 轉達） |
| 0.6.3 | 2026-11-11 | 設計缺陷修正：review-process.md 4.1 新增相容偵測（欄位行與表格列的偵測取 PR-1b 版與 PR-1c 版的聯集），撤回 v0.6.1 的錯誤論證；第 13 節摘要、第 14 節 PR-1c 列對應更新。恢復 DQ-14 (b) 已決定的「只增加無效」性質，不改產品負責人的決定，不需另行簽核 | PR #4 審查紀錄（comment 6790734907）：審查結論「需修改」，R-14 不通過 |
