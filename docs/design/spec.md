# 翻牌記憶遊戲：軟體規格書

| 項目 | 內容 |
|---|---|
| 版本 | 0.1（設計草稿） |
| 日期 | 2026-11-04 |
| 狀態 | 待產品負責人簽核（EQ-6）。簽核紀錄見 docs/design/README.md |
| 撰寫 | 設計 agent |
| 依據 | docs/requirements.md v1.0（已簽核）；docs/workflow.md v0.1 |
| 相關文件 | verification.md（Q4、Q6 查證）、module-test-standards.md（模組測試標準與需求追溯）、acceptance-test-plan.md（驗收測試骨架計畫）、review-process.md（審查紀錄格式與審查清單）、card-attributes.json、card-preview.html |

本文件描述「怎麼做」。產品行為以需求文件為準；本文件與需求文件衝突時，以需求文件為準並回報設計 agent 修正本文件。需求沒有規定、設計時發現的空白，列在第 16 節「待決問題」，不在本文件中自行決定。

編號慣例：本文件的設計項目以 `D-` 開頭（例如 D-SM-3），供 PR 與審查紀錄引用。需求編號（GP-1、AC-GP-1 等）沿用需求文件。

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
│  │  └─ e2e/                    驗收測試：端對端層（測試 agent）
│  └─ support/                   驗收測試共用工具（測試 agent）
├─ scripts/
│  ├─ build.mjs                  src → dist，注入版本號
│  ├─ serve.mjs                  本機靜態伺服器（Node.js 內建 http，無相依）
│  ├─ check-acceptance-ids.mjs   EQ-4 編號覆蓋檢查
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

做法：建立 `[f1,f1,f2,f2,…,f6,f6]`，以 Fisher–Yates 洗牌（`for i = 11..1: j = randomInt(i+1); swap(i, j)`）。正確性與 AC-GP-2 的關係見第 8 節。

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

`createGame` 不讀時鐘；遊戲在 `ready` 狀態下不需要時間。第一張牌翻開時以該次 `flip` 的 `now` 作為計時起點（TM-1）。

### 4.6 core/records.js

```js
/** @typedef {{ tenths: number, hintsUsed: number }} TimeRecord
 *  @typedef {{ moves: number, hintsUsed: number }} MovesRecord
 *  @typedef {{ bestTime: TimeRecord|null, fewestMoves: MovesRecord|null }} LevelRecords
 *  @typedef {{ 1: LevelRecords, 2: LevelRecords, 3: LevelRecords }} Records */
export function emptyRecords();                       // 三關六項皆為 null
export function parseRecords(text /* string|null */);  // → { records, status: 'ok'|'empty'|'invalid' }
export function serializeRecords(records);           // → string（第 9 節格式）
export function mergeWin(records, { level, tenths, moves, hintsUsed });
// → { records, newBestTime: boolean, newFewestMoves: boolean }（RC-1、RC-3、RC-4）
```

`mergeWin` 規則：某項為 null，或本次數值**嚴格小於**既有數值時取代，並以本次的 `hintsUsed` 一起保存；相等不取代（RC-3、「優於」）。時間比較用 `tenths`（顯示值）。`newBestTime`／`newFewestMoves` 只在「既有紀錄存在且本次優於」時為 true；既有紀錄為 null 時的值見第 16 節 DQ-3。

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
| `faces.js` | `FACE_SVGS: Record<faceId, string>`、`CARD_BACK_SVG`；內容取自 card-preview.html 中同 id 的 svg |
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
| 牌 | `[data-testid="card"]`，共 12 個，DOM 順序即索引 0..11 | `data-index`、`data-face`（牌面識別碼）、`data-state`（`down`／`up`／`matched`，為邏輯狀態，暫停時不變）、`data-hinted`（`true`／`false`） |
| 按鈕 | `btn-hint`、`btn-pause`（暫停中文字改為「繼續」）、`btn-restart`（PS-8）、`btn-menu` | 無法使用時 `aria-disabled="true"`，不使用 `disabled` 屬性（第 10.4 節） |
| 暫停遮蔽層 | `pause-mask` | 暫停時可見 |
| 結果畫面 | `[data-testid="result"]`，屬性 `data-kind`（`won`／`lost`） | |
| 結果數值 | `result-time`、`result-moves`、`result-hints`、`result-level-name` | 只含數值或難度名稱 |
| 新紀錄標示 | `new-record-time`、`new-record-moves` | RS-4 |
| 結果按鈕 | `btn-replay`、`btn-next-level`（RS-5）、`btn-result-menu` | |

`data-face` 讓端對端測試能直接知道牌面配置，代價是玩家用瀏覽器開發者工具可讀出答案。本產品沒有排行榜、紀錄存在玩家本機（玩家本來就能改寫），設計判斷可接受；列為假設 DA-4，產品負責人不同意時改用替代方案（見第 17 節）。

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
- I-2：`state=up` 的牌恰為 `firstIndex` 或 `lock.indices` 中的牌。
- I-3：`hint≠null` 時，`hint.indices` 兩張牌的 `faceId` 相同，且在使用提示當下皆為 `down`。
- I-4：`phase=ready` 時 `moves=0`、`hintsLeft=3`、全部牌 `down`、`hint=null`、`lock=null`。
- I-5：`phase` 為 `won`／`lost` 時 `lock=null`、`hint=null`、`paused=false`。

### 5.3 遊玩時鐘

- `running = (phase = playing) 且 !paused`。
- `playMs(now) = finalPlayMs ?? (accumulatedMs + (running ? now − segmentStart : 0))`。
- 已用時間、翻錯鎖定、提示標示**共用同一個遊玩時鐘**。暫停時遊玩時鐘停止，三者的剩餘時間自然一併暫停並接續（PS-1、PS-3、PS-9），不需要個別保存剩餘時間。
- `elapsedTenths = toTenths(playMs(now))`（TM-2、術語「顯示值」）。
- `limitMs = timeLimitSec × 1000`。`toTenths(t) ≥ timeLimitSec × 10` 與 `t ≥ limitMs` 等價（t 先四捨五入到微秒），所以以顯示值判定時間上限（LV-6）。

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
| T-11 | `advance` | `phase=playing` 且 `playMs(now) ≥ limitMs` | `finalPlayMs=limitMs`；`phase=lost`；`lock=null`、`hint=null`（取消，牌維持當下的正反面） | LV-6、A-5、TM-5、6.9 |
| T-12 | `pause()` | `phase` 為 `ready` 或 `playing`、`!paused` | `playing` 時 `accumulatedMs += now − segmentStart`；`paused=true` | PS-1、PS-9 |
| T-13 | `resume()` | `paused` | `paused=false`；`playing` 時 `segmentStart=now` | PS-3、PS-9 |
| T-14 | 回到選單、重新開始、重新整理、關閉頁面 | — | `app.js` 丟棄目前的 `game`（不呼叫紀錄保存）；`game` 本身沒有「離開」轉移 | PS-7、PS-8、RC-2、A-6 |

`advance(now)` 的處理順序：計算 `t=playMs(now)`；把 `lock.endsAt`、`hint.endsAt`、`limitMs` 中 `≤ t` 的事件依時間先後處理；同時到期時依 T-6、T-10、T-11 的順序。T-11 執行後不再處理其他事件。因為 `flip`、`useHint` 都先 `advance`，所以：

- 點擊時刻恰好等於時間上限：先判定失敗，點擊無效（A-5「達到上限之前配對成功才是勝利」）。
- 點擊時刻恰好等於翻錯鎖定結束：鎖定先結束，點擊有效（落在 GP-5 容差內）。

### 5.5 狀態 × 操作（對照需求 6.9）

| 狀態 | 點背面的牌 | 點正面或已配對的牌 | 提示 | 暫停 | 回到選單 | 重新開始（PS-8，S） |
|---|---|---|---|---|---|---|
| S0 尚未開始計時 | T-1：翻開並開始計時（GP-3、TM-1） | 不適用（全部背面） | T-9 無效果（HT-10） | T-12（6.9「可用」） | T-14（PS-7） | T-14（DQ-1） |
| S1 | T-2（GP-3） | T-7（GP-7） | `hintsLeft>0` 時 T-8，否則 T-9（HT-4） | T-12 | T-14 | T-14 |
| S2 已翻開一張 | T-3／T-5（TM-3） | T-7（GP-7） | T-9（HT-7） | T-12 | T-14 | T-14 |
| S3 翻錯鎖定 | T-7（GP-6） | T-7（GP-6） | T-9（HT-7） | T-12，鎖定倒數隨遊玩時鐘暫停（PS-9） | T-14 | T-14 |
| H 提示標示中 | 依並存的 S1／S2／S3 | 依並存的狀態 | T-9（HT-8） | T-12，標示倒數暫停（PS-9） | T-14 | T-14 |
| P 暫停中 | T-7（PS-2） | T-7（PS-2） | T-9，按鈕可見且不被遮蔽（PS-10） | 按鈕改為「繼續」，T-13（PS-3） | T-14（PS-7） | T-14（DQ-1） |
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
| 頁面切到背景 | PS-5 實作時同暫停；未實作時繼續累計 | 同左 | 同左 | 第 6.4 節 |

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
| 暫停中時間上限 | 不可能到達（遊玩時鐘停止） | PS-1 |
| 結果畫面出現後點擊原牌的位置 | 被結果畫面覆蓋；即使事件到達，`phase` 為終止狀態，T-7 | AC-LV-6「牌無法再點擊」 |
| 勝利畫面出現後等待 | `finalPlayMs` 凍結，`nextWakeup=null` | AC-TM-5 |
| 用完 3 次提示後重玩 | 新的 `game`，`hintsLeft=3` | HT-1、AC-HT-1 |
| 暫停中切到背景再回來 | 維持暫停 | PS-5（實作時）、DQ-2 |
| 背景中（PS-5 未實作）時間上限到達 | 回到前景時 `advance` 判定失敗，已用時間停在上限 | LV-6、6.9 |
| 兩個分頁同時遊玩同一瀏覽器 | 各自獨立；勝利時重新讀取儲存的紀錄再合併，不覆蓋另一分頁剛寫入的較佳紀錄 | RC-3（以保存時的既有紀錄比較） |
| 重新整理後 | 一律顯示選單 | A-6 |

需求沒有規定、需要產品負責人決定的組合列在第 16 節（DQ-1～DQ-5）。

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

在 `limitMs` 時刻排程喚醒，T-11 判定失敗。最後一對在 `limitMs` 之前任一時刻配對即為勝利（A-5、AC-LV-6）。

### 6.4 背景分頁（PS-5，Should）

**建議本輪實作**（成本低，且可消除需求第 9 節「背景降頻造成誤差」的風險）。做法：`visibility.js` 的 `onHidden` 觸發時，若目前畫面是遊戲且 `canPause`，呼叫 `game.pause(now)`。回到前景時**維持暫停**，由玩家按「繼續」（DQ-2，待產品負責人確認）。

若產品負責人決定本輪不做 PS-5：背景中遊玩時鐘照常累計（`performance.now()` 在背景仍前進），瀏覽器降頻只會延後畫面更新，回到前景的第一次喚醒會補做所有到期事件，已用時間仍正確。

---

## 7. 時鐘抽象：同時滿足「測試控制時鐘」與「NFR-6 用真實時間」

| 層 | 時鐘來源 | 用途 |
|---|---|---|
| `core` 單元測試與無瀏覽器驗收測試 | 測試直接傳入數字 `now`，例如 `game.flip(0, 1000)` | 狀態機邏輯，完全確定 |
| 端對端驗收測試（NFR-6 以外） | Playwright Clock：在 `page.goto` 前 `clock.install({ time: 0 })`，接著 `clock.pauseAt(…)` 凍結時間，再以 `clock.runFor(ms)` 推進 | 檢查點落在容差邊界（10.1） |
| 端對端 NFR-6 | **不安裝**時鐘，使用真實時間 | 量測計時準確度 |

正式程式只透過 `platform/clock.js` 的 `now()` 與 `setTimer()` 取得時間。Playwright Clock 會替換 `performance`、`Date`、`setTimeout`、`requestAnimationFrame`（官方 API 文件 https://playwright.dev/docs/api/class-clock ；本次實測確認 `performance.now()` 與 `setTimeout` 都被替換）。因此端對端測試不需要任何測試專用的程式入口。

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
- 20 次連續遊玩部分在端對端測試執行，透過 `data-face` 讀取排列。
- 提示選牌（T-8）同樣使用注入的 `randomInt`。

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

`invalid` 時，依 RC-8 字面「視為無紀錄」：**三關全部**視為無紀錄（DQ-4 詢問是否改為逐項）。主控台不得出現未處理的錯誤（AC-RC-8）。下一次勝利保存時以新資料覆寫。

### 9.3 讀寫流程

| 時點 | 動作 |
|---|---|
| 頁面載入 | `probeStorage()` 決定是否顯示「紀錄無法保存」；`readRecordsText()` → `parseRecords` → 選單顯示 |
| 勝利 | **重新讀取** → `parseRecords`（`invalid` 時以 `emptyRecords()` 為基礎）→ `mergeWin` → `writeRecordsText`。`newBestTime`／`newFewestMoves` 提供給結果畫面（RS-4） |
| 失敗、回到選單、重新開始、重新整理 | 不讀不寫（RC-2） |
| 清除紀錄並確認 | `removeRecords()`；取消時不動作（RC-7） |

### 9.4 儲存不可用（RC-9，Should）

`probeStorage()` 失敗或任何寫入失敗時：遊戲照常進行；選單顯示「紀錄無法保存」提示（`storage-warning`）。不可用期間紀錄是否保留在記憶體中（本次開啟期間可見），列為 DQ-5。

---

## 10. 畫面

### 10.1 共通

- 字型：`system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif`，不載入網路字型（C-5）。
- 顏色以 CSS 自訂屬性定義在 `:root`；牌面顏色見 card-attributes.json（Okabe–Ito 色票，避免只靠紅綠區分）。
- 介面文字只用難度名稱，任何畫面都不出現「第 N 關」（LV-9）。

### 10.2 版面與尺寸計算（NFR-3、NFR-5、NFR-4）

符號：W、H 為視窗寬高（CSS px）；外距 m＝8；牌間距 g＝8；狀態列高 Hs＝52（兩行 16 px 文字＋上下 6 px）；按鈕列高 Hb＝52（按鈕 44＋上下 4）；區塊間距 8。牌為正方形，邊長 s 取整數（無條件捨去，避免子像素溢出）。

**直向（W ≤ H）：3 欄 × 4 列，狀態列在上、按鈕列在下**

- 垂直固定佔用 F＝m＋Hs＋8＋8＋Hb＋m＝8＋52＋8＋8＋52＋8＝136
- s＝floor(min((W − 2m − 2g)／3, (H − F − 3g)／4))

**橫向且 H ≥ 500：4 欄 × 3 列，狀態列在上、按鈕列在下**

- s＝floor(min((W − 2m − 3g)／4, (H − F − 2g)／3))

**橫向且 H < 500（手機橫向，NFR-4）：4 欄 × 3 列，狀態與按鈕放左側欄，寬 P＝176**

- s＝floor(min((W − 2m − P − 8 − 3g)／4, (H − 2m − 2g)／3))

**上限：** s ≤ 240（大螢幕不必過大）。

| 視窗 | 版面 | 寬度限制 | 高度限制 | s | 總高 | 結果 |
|---|---|---|---|---|---|---|
| 360×640 | 直向 3×4 | (360−16−16)／3＝109.3 | (640−136−24)／4＝120 | **109** | 136＋4×109＋24＝596 ≤ 640 | 牌 109×109 ≥ 44×44；總寬 16＋3×109＋16＝359 ≤ 360；無捲動 |
| 390×844 | 直向 3×4 | (390−32)／3＝119.3 | (844−160)／4＝171 | 119 | 136＋476＋24＝636 | 通過 |
| 768×1024 | 直向 3×4 | (768−32)／3＝245.3 | (1024−160)／4＝216 | 216 | 136＋864＋24＝1024 ≤ 1024 | 通過（剛好等高，實作時須確認無 1 px 溢出；若有，s 改為 215） |
| 1280×720 | 橫向 4×3 | (1280−40)／4＝310 | (720−152)／3＝189.3 | 189 | 136＋567＋16＝719 | 通過 |
| 1920×1080 | 橫向 4×3 | 470 | (1080−152)／3＝309.3 | 240（上限） | 136＋720＋16＝872 | 通過 |
| 844×390（S） | 側欄 4×3 | (844−16−176−8−24)／4＝155 | (390−16−16)／3＝119.3 | 119 | 16＋357＋16＝389 | 通過 |

**360×640 的按鈕：** 按鈕列寬 360−16＝344。4 個按鈕（提示、暫停、重新開始、回到選單）：(344−3×8)／4＝80，每個 80×44 ≥ 44×44（NFR-5）。若本輪不做 PS-8，3 個按鈕各 (344−16)／3＝109×44。「回到選單」四個字以 16 px 約 64 px 寬，放得下。

**實作規則：**

- 用 CSS `min()` 與 `100dvh`（後備 `100vh`）計算 s；依 `@media (orientation: portrait)`、`(orientation: landscape) and (min-height: 500px)`、`(orientation: landscape) and (max-height: 499.98px)` 切換版面。
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
| 儲存不可用提示 | 「紀錄無法保存」，只在不可用時顯示 | RC-9 |
| 版本號 | 頁尾「版本 1.0.0+abc1234」 | EQ-9 |

360×640 高度估算：標題 48＋3×(44＋2×20＋16)＝300＋清除按鈕 44＋說明與版本 2×20＋間距 6×8＝48＋外距 16＝496 ≤ 640。

**遊戲（`game`）**

| 區域 | 元素 | 需求 |
|---|---|---|
| 狀態列第 1 行 | 難度名稱、「限時 60 秒」 | LV-8、LV-9 |
| 狀態列第 2 行 | 「時間 12.3」「步數 3」「提示 2」 | TM-2、TM-4、HT-5 |
| 牌面區 | 12 張牌；背面顯示牌背 SVG；正面與已配對顯示牌面 SVG；已配對的牌降低不透明度並加細框；提示標示為 4 px 黃色外框＋2 px 深色內框（不只靠顏色） | GP-1、GP-3、GP-4、HT-2 |
| 暫停遮蔽層 | **只覆蓋牌面區**的不透明面板，顯示「已暫停」；同時牌面區不渲染任何牌面 SVG（全部以牌背呈現），雙重保證 | PS-4 |
| 按鈕列 | 提示、暫停／繼續、重新開始（PS-8）、回到選單。遮蔽層不覆蓋按鈕列，所以暫停時提示按鈕可見、最上層元素是它本身 | HT-4、HT-7、HT-8、HT-10、PS-7、PS-10 |

**勝利（`result`，`data-kind="won"`）：** 以覆蓋整個視窗的面板呈現（牌面區仍在下層 DOM 中，但點擊會落在面板上）。內容：難度名稱＋「完成」；時間 42.3 秒、步數 14、使用提示 1 次（RS-1）；項目旁「新紀錄」（RS-4）；按鈕〔重玩本關〕（RS-2）、〔挑戰下一個難度〕（只在簡單、普通，RS-5）、〔回到選單〕（RS-3）。

**失敗（`data-kind="lost"`）：** 難度名稱＋「時間到」；按鈕〔重玩本關〕、〔回到選單〕。不另外顯示需求沒要求的統計。

### 10.4 互動細節

- **無法使用的按鈕**用 `aria-disabled="true"`＋停用樣式，事件處理器忽略點擊；**不使用 `disabled` 屬性**。理由：需求「無法使用」要求點擊後沒有效果且按鈕仍是最上層元素（AC-PS-10）；`disabled` 會讓部分瀏覽器不派送事件，測試無法區分「被蓋住」與「被停用」。另本次實測：Playwright 對 `aria-disabled="true"` 與 `disabled` 的元素，`locator.click()` 都會等待到逾時，測試須以 `page.mouse.click(x, y)` 在中心點點擊（acceptance-test-plan.md 第 4 節）。
- **確認對話框**用頁內元素，不用 `window.confirm`：可控制按鈕尺寸（NFR-5）並以 DOM 測試。
- **iOS 雙擊縮放與點擊延遲：** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`；`html { touch-action: manipulation; }`（停用雙擊縮放並移除點擊延遲）；牌與按鈕 `-webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;`；懸停樣式放在 `@media (hover: hover)`；只監聽 `click`，不同時監聽 `touchstart`，避免同一次觸控觸發兩次。不使用 `user-scalable=no`（iOS 會忽略，且影響可及性）。U-6 由產品負責人實機確認。
- 每張牌是 `<button type="button">`，點擊區域即整張牌（NFR-5）。

---

## 11. 建置與版本號（EQ-9）

- **格式：** `<package.json 的 version>+<commit 短碼 7 碼>`，例 `1.0.0+3f9c2ab`。`package.json` 的 `version` 本輪固定為 `1.0.0`（本輪只發布 v1.0.0；UAT 記錄的版本號與 v1.0.0 標籤指向同一 commit，對應 EQ-13）。
- **注入方式：** `scripts/build.mjs` 把 `src/` 複製到 `dist/`，並覆寫 `dist/js/version.js` 為 `export const APP_VERSION = '1.0.0+3f9c2ab';`。短碼取自環境變數 `BUILD_SHA` 的前 7 碼；沒有時用 `git rev-parse --short=7 HEAD`；再沒有時為 `dev`。版本庫中的 `src/js/version.js` 內容為 `'1.0.0+dev'`。
- **commit 的選擇：** 部署工作流程用 `GITHUB_SHA`（推送主分支的 commit）。PR 的 CI 用 `github.event.pull_request.head.sha`，**不用** `GITHUB_SHA`（`pull_request` 事件的 `GITHUB_SHA` 是合併 commit，不是 PR 的 commit）。
- 不使用任何第三方工具；執行時只是一個常數模組（C-2）。
- 本機開發：`node scripts/serve.mjs src` 直接提供 `src/`（版本顯示 `1.0.0+dev`）；`node scripts/build.mjs && node scripts/serve.mjs dist` 提供建置結果。ES 模組不能從 `file://` 載入，所以 README 必須寫明用本機伺服器。

---

## 12. CI／CD

### 12.1 工作流程清單

| 檔案 | job（必要檢查名稱） | 觸發 | 內容 | 需求 |
|---|---|---|---|---|
| ci.yml | `unit` | `pull_request`（opened、synchronize、reopened）、`push` 到 main | `node --test tests/unit tests/acceptance/unit` | EQ-3 |
| ci.yml | `acceptance-ids` | 同上 | `node scripts/check-acceptance-ids.mjs` | EQ-4 |
| ci.yml | `e2e (chromium)`、`e2e (firefox)`、`e2e (webkit)` | 同上 | 矩陣三引擎；`BUILD_SHA=<PR head sha>` 建置；`npx playwright install --with-deps <引擎>`；`npx playwright test --project=<引擎>` | EQ-3、NFR-1 |
| pr-body.yml | `pr-body` | `pull_request`（opened、edited、synchronize、reopened） | `node scripts/check-pr-body.mjs`（12.4） | workflow.md 4.4 |
| review-gate.yml | （寫入 commit status `review-record`） | `pull_request_target`（opened、synchronize、reopened、edited；edited 讓 PR 說明的作者工作階段變更時重新判定）、`issue_comment`（created、edited、deleted） | `node scripts/review-gate.mjs`（第 13 節） | EQ-5、EQ-11 |
| deploy.yml | `deploy`、`smoke` | `push` 到 main | 建置 → upload-pages-artifact → deploy-pages；`smoke` 輪詢公開網址版本號 | EQ-9、EQ-12 |

共同設定：`runs-on: ubuntu-latest`（標準執行器，免費）；`actions/setup-node` 指定 Node.js 22；每個工作流程以 `permissions` 宣告最小權限；`concurrency` 以 PR 編號分組。

### 12.2 編號覆蓋檢查（`check-acceptance-ids.mjs`，EQ-4）

1. 從 `docs/requirements.md` 解析必要編號：
   - 第 10.2 節以 `**AC-…**（自動）` 或 `**AC-…**（自動＋人工）` 開頭的段落標題；一個標題可含多個以「、」分隔的編號（AC-LV-2、AC-LV-3、AC-LV-4）。
   - 第 13 節追溯矩陣中優先為 M、驗證為「自動」的 NFR，排除 NFR-1（EQ-4 例外）。
2. 讀取 `docs/design/supplementary-acceptance.json` 中 `enforced: true` 的設計補充驗收編號（Should 需求，第 15 節）。
3. 收集測試名稱：靜態掃描 `tests/**/*.{test,spec}.mjs` 中 `test(`、`test.skip(`、`test.fixme(`、`it(`、`describe(`、`test.describe(` 的第一個字串參數。不採計註解中的編號。
4. 每個必要編號至少出現在一個測試名稱中（以完整編號比對，`AC-GP-1` 不得被 `AC-GP-10` 誤判），否則列出缺少的編號並以非零狀態結束。
5. 另外列出名稱含必要編號、但被標記為略過（`test.skip`、`test.fixme`、`{ skip: true }`）的測試數。參數 `--no-skip` 時有任何略過即失敗：M3 離開條件（agent-dev-workflow 4.3「沒有略過的測試」）達成前由最後一個 PR 打開。
6. 解析結果的編號數量印在輸出中；`tests/acceptance/unit/` 中的 AC-EQ-4 測試以固定的需求文件片段驗證解析、並以「刪除含 AC-GP-5 的測試」的測試資料確認會失敗（AC-EQ-4 反例）。

### 12.3 端對端測試設定（playwright.config.mjs）

- `projects`：chromium、firefox、webkit（裝置描述用桌面預設，視窗尺寸由各測試指定）。
- `webServer`：`node scripts/serve.mjs dist`；測試前必須先 `node scripts/build.mjs`。
- `retries: 0`（重試會掩蓋計時問題）；`workers` 依 CI 預設。
- `testDir: tests/acceptance/e2e`。

### 12.4 PR 說明檢查（`check-pr-body.mjs`，workflow.md 4.4）

從事件內容讀取 PR 說明，下列任一項不成立即失敗：

1. 含「## 上工檢查」段落，其下所有核取方塊皆為 `- [x]`。
2. 含「## 已載入的 skill」段落與表格，至少一列為 `agent-dev-workflow`。
3. 表格中每一列的 skill 名稱對應 `.claude/skills/<名稱>/SKILL.md`（簽出 PR 的 commit 讀取），且填寫的版本號等於該檔案「變更紀錄」表格最後一列的版本號。
4. 含「## 作者」段落，工作階段欄位非空白（第 13 節判定獨立性用）。

已知問題：`requirements-spec` 目前沒有變更紀錄（見交付摘要的 skill 修改建議），在產品負責人補上之前，本檢查對沒有變更紀錄的 skill 回報「無法驗證版本號」並失敗；PR 作者不應在表格中列出無版本號的 skill，改在「skill 修改或建議」段落註明。此規則待產品負責人確認（DQ-6）。

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
    steps: 每 15 秒以 Node.js fetch 讀取 <page_url>js/version.js，直到含 github.sha 前 7 碼；
           自 workflow 開始 9 分鐘未出現即失敗
```

部署不等待端對端測試：PR 階段已全部通過，且分支保護要求分支為最新（12.6），合併後的內容即為 PR 測試過的內容。

### 12.6 分支保護與網頁設定（產品負責人手動）

依下列順序執行。標示「手動」者 agent 無法代做。

| 步驟 | 時點 | 設定 | 執行者 |
|---|---|---|---|
| 1 | 第一個 PR 開啟前 | 版本庫設為 Public（EQ-1） | 手動 |
| 2 | 第一個 PR 開啟前 | Settings → Pages → Build and deployment → Source：**GitHub Actions** | 手動 |
| 3 | 第一個 PR 開啟前 | Settings → Actions → General → Workflow permissions：Read repository contents（預設唯讀；各工作流程自行宣告所需權限） | 手動 |
| 4 | 第一個 PR 的 CI 執行過、審查紀錄已人工確認後 | 合併第一個 PR | 手動 |
| 5 | 第一個 PR 合併後 | Settings → Environments → github-pages → Deployment branches：只允許 `main` | 手動 |
| 6 | 第一個 PR 合併後 | Settings → Branches → Add classic branch protection rule，Branch name pattern `main`：<br>☑ Require a pull request before merging（不勾 Require approvals：單一帳號無法核准自己的 PR）<br>☑ Require status checks to pass before merging；☑ Require branches to be up to date before merging；必要檢查：`unit`、`acceptance-ids`、`e2e (chromium)`、`e2e (firefox)`、`e2e (webkit)`、`pr-body`、`review-record`（來源選 GitHub Actions）<br>☑ **Do not allow bypassing the above settings**（套用於管理員，EQ-2）<br>☐ Allow force pushes；☐ Allow deletions | 手動 |
| 7 | 步驟 6 後 | Settings → General → Pull Requests：只允許 Squash merging（選用，讓主分支每個 commit 對應一個 PR） | 手動 |
| 8 | 步驟 6 後 | 依 AC-EQ-2 嘗試直接 push 與合併失敗的 PR，確認被拒絕；依 AC-EQ-11 在第二個 PR 驗證審查檢查 | 手動 |

---

## 13. 審查紀錄與審查檢查（EQ-5、EQ-11）

審查紀錄格式、審查清單與 `review-gate.mjs` 的判定規則見 **review-process.md**。摘要：

- 審查 agent 在 PR 的對話區留一則評論，第一行為 `<!-- review-record v1 -->`，含結果（`APPROVED`／`CHANGES_REQUESTED`）、針對的完整 40 碼 commit SHA、審查者與作者的工作階段識別、「同一模型不同工作階段」註明、逐項結果表。
- `review-gate.mjs` 對 PR 最新 head SHA 寫入 `review-record` 狀態；只採計協作者的評論、SHA 必須等於最新 head、審查者工作階段不得等於 PR 說明中任何作者的工作階段、以針對該 SHA 的最後一則紀錄為準。

---

## 14. 實作切分（PR 順序）

每個 PR 由實作 agent 與測試 agent 共同或先後提交，由不是任何一位作者的審查 agent 審查。驗收骨架在 PR-1 全部建立；之後每個 PR 把對應骨架改為實際測試。

| PR | 內容 | 需求編號 | 驗收（骨架轉實測） |
|---|---|---|---|
| PR-1 基礎 | 目錄結構、package.json、playwright.config、scripts 全部（build、serve、check-acceptance-ids、check-pr-body、review-gate）、四個工作流程、最小可載入的 `index.html`（只顯示版本號）、全部驗收骨架、設計文件與設計 skill（docs/design/、.claude/skills/software-design-phase/）、.gitignore | EQ-1、EQ-2（設定步驟）、EQ-3、EQ-4、EQ-5、EQ-9、EQ-11、EQ-12、NFR-1、NFR-7（部分） | AC-EQ-4、AC-EQ-9 |
| PR-2 遊戲邏輯 | core 全部模組＋單元測試 | GP-1～8、TM-1～5、LV-1、LV-5、LV-6、HT-1～10、PS-1～3、PS-9 的邏輯 | AC-GP-2（統計）、AC-LV-5 |
| PR-3 牌面 | faces.js、config 的 faceIds | LV-2～LV-4 | AC-LV-2、AC-LV-3、AC-LV-4 |
| PR-4 遊戲畫面 | game-view、app（遊戲部分）、clock、版面與 iOS 對策 | GP、TM、HT、PS、LV-6、LV-8 的畫面；NFR-3、NFR-5、NFR-6 | AC-GP-1～8、AC-TM-1～4、AC-HT-*、AC-PS-1～4、AC-PS-9、AC-PS-10、AC-LV-6、AC-LV-8、NFR-3、NFR-5、NFR-6 |
| PR-5 選單、結果與紀錄 | menu-view、result-view、dialog、records、storage | LV-1、LV-7、LV-9、PS-7、RS-1～3、RC-1～8、EQ-9 | AC-LV-1、AC-LV-7、AC-LV-9、AC-TM-5、AC-PS-7、AC-RS-*、AC-RC-*、NFR-7 |
| PR-6 Should 需求 | 依產品負責人對第 15 節的決定 | PS-5、PS-8、RS-4、RS-5、RC-9、NFR-4、EQ-10 | 設計補充驗收 |
| PR-7 M3 收尾 | CI 的 `acceptance-ids` 加上 `--no-skip` | M3 離開條件 | 全部 |

PR-1 的特別處理：PR-1 合併前審查檢查尚未生效（verification.md 2.3），產品負責人人工確認審查紀錄後合併，再執行 12.6 步驟 5～8。

---

## 15. Should 需求的處理建議與設計補充驗收

需求追溯矩陣把 PS-5、PS-8、RS-4、RS-5、RC-9、EQ-10 的驗收標為「設計階段補」。以下是建議與補充驗收草案，**須經產品負責人簽核**；簽核為本輪實作者，編號列入 `supplementary-acceptance.json` 並設 `enforced: true`，由 CI 一併檢查。

| 需求 | 建議 | 補充驗收（草案，皆為自動） |
|---|---|---|
| PS-5 | 本輪實作 | **AC-PS-5**：Given 遊戲中計時累計 When 觸發頁面隱藏（測試以 `document.visibilityState` 覆寫並派送 `visibilitychange`）Then 進入暫停、遮蔽牌面、已用時間停止；When 恢復可見 Then 仍為暫停（依 DQ-2 決定） |
| PS-8 | 本輪實作 | **AC-PS-8**：Given 遊戲中（含暫停中、翻錯鎖定中），已用時間大於 0、步數大於 0、剩餘提示 2 When 點擊「重新開始」Then 同一關新的一次遊玩：已用時間 0.0、步數 0、剩餘提示 3、12 張背面，且該關紀錄不變 |
| RS-4 | 本輪實作 | **AC-RS-4**：Given 第 1 關最佳時間 30.0、最少步數 18 When 以 29.9 秒、20 步勝利 Then 時間旁標示「新紀錄」，步數旁不標示；相等時不標示（與 AC-RC-3 一致）；無既有紀錄時依 DQ-3 |
| RS-5 | 本輪實作 | **AC-RS-5**：Given 簡單的勝利畫面 When 點擊「挑戰下一個難度」Then 開始普通的新遊玩；普通→困難同理；困難的勝利畫面沒有此按鈕 |
| RC-9 | 本輪實作 | **AC-RC-9**：Given 以 `addInitScript` 讓 `localStorage.setItem` 丟出例外 When 開啟頁面 Then 選單顯示「紀錄無法保存」，可進入任一關並勝利，主控台沒有未處理的錯誤 |
| NFR-4 | 本輪實作（版面已涵蓋） | 依需求量測方法，測試名稱含 NFR-4 |
| EQ-10 | 本輪實作 | **AC-EQ-10**（人工）：README 含五節；在乾淨的 clone 依步驟執行可開啟遊戲並通過測試。由測試 agent 在系統測試時執行並記錄 |
| NFR-8、NFR-9 | 系統測試時量測並記錄（人工） | 依需求量測方法 |

---

## 16. 待決問題（需產品負責人決定）

| 編號 | 問題 | 發現情境 | 建議 | 阻擋 |
|---|---|---|---|---|
| DQ-1 | PS-8「重新開始本關」在暫停中、尚未開始計時時是否可用？需求 6.9 沒有「重新開始」欄 | 依 3.8 列操作時發現 6.9 只列了 Must 操作 | 兩者皆可用，效果同「回到選單後再進入同一關」 | PS-8 實作（PR-6） |
| DQ-2 | PS-5 自動暫停後回到前景時，自動繼續還是維持暫停？ | PS-5 只規定進入背景的行為 | 維持暫停，由玩家按「繼續」；自動繼續會讓剛切回來、尚未看清畫面的玩家損失時間 | PS-5 實作（PR-6） |
| DQ-3 | RS-4「新紀錄」在該關**尚無紀錄**時是否標示？需求只寫「優於既有紀錄時」 | 寫 `mergeWin` 回傳值時發現 | 標示（第一次勝利即建立紀錄，對玩家是正向回饋）。若採用，需求 RS-4 應改寫為「優於既有紀錄或該項尚無紀錄時」 | RS-4 實作（PR-6） |
| DQ-4 | RC-8「格式不符」是整份資料視為無紀錄，還是只把不符的那一項視為無紀錄？ | 設計驗證規則時發現 | 維持字面（整份），實作簡單、AC-RC-8 已涵蓋；本設計目前依字面 | 無（不決定則依字面） |
| DQ-5 | RC-9 儲存不可用時，本次開啟期間的勝利是否在選單顯示（只存在記憶體）？ | 設計 RC-9 時發現 | 顯示，並保留「紀錄無法保存」提示；關閉頁面後消失 | RC-9 實作（PR-6） |
| DQ-6 | `requirements-spec` 沒有變更紀錄，PR 說明無法填寫其版本號，workflow.md 4.4 的證明對它無效 | 上工檢查時發現 | 產品負責人為 requirements-spec 加上變更紀錄（見交付摘要建議段落）；在此之前 `check-pr-body` 只檢查有變更紀錄的 skill | PR-1 的 `check-pr-body` |

---

## 17. 假設

| 編號 | 假設 | 若不成立 |
|---|---|---|
| DA-1 | `statuses: write` 權限可讓 `GITHUB_TOKEN` 寫入 commit status（未查證原文） | 改用 check run（`checks: write`），判定邏輯不變 |
| DA-2 | 產品負責人只用一個 GitHub 帳號，沒有 fork PR | review-gate 已處理 fork（不執行 PR 程式碼），不影響 |
| DA-3 | `package.json` 的 `version` 本輪固定為 1.0.0 | 若產品負責人希望 UAT 前使用預發布版本號（例如 1.0.0-rc），發布前需再一個 PR 改版本號，該 PR 會觸發 EQ-14 的重新 UAT；因此建議維持 1.0.0 |
| DA-4 | 端對端測試透過 `data-face` 取得牌面配置，玩家可用開發者工具看到答案，可接受 | 替代方案：測試以 `page.addInitScript` 替換 `crypto.getRandomValues` 為可重現的產生器，並在 Node.js 以同一份 `deal` 計算配置；`data-face` 移除。代價是測試依賴亂數呼叫順序 |
| DA-5 | 目標瀏覽器支援 `dvh`、ES 模組、CSS `min()`（Safari 15.4+、Chrome 108+、Firefox 101+） | 加上 `100vh` 後備（已在 10.2 規定）；更舊瀏覽器不支援，屬 NFR-2 的 UAT 範圍 |

---

## 18. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 依需求文件 v1.0 進行設計 |
