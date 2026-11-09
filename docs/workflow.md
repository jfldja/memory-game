# 翻牌記憶遊戲：專案工作規範

| 項目 | 內容 |
|---|---|
| 版本 | 0.2 |
| 日期 | 2026-11-04 |
| 狀態 | 產品負責人已確認（v0.1，2026-11-04） |
| 依據 | agent-dev-workflow skill 第 6 節 |
| 相關文件 | docs/requirements.md（需求文件 v1.1，已簽核） |

---

## 1. 本文件是什麼

**本文件不是翻牌記憶遊戲的需求，也不是完整的工作規範。** 完整規範是 agent-dev-workflow skill；本文件只記錄本專案對該 skill 的調整與補充。

- 開始工作前，先讀 agent-dev-workflow，再讀本文件。
- 衝突時的優先順序依 agent-dev-workflow 第 2 節。
- 本文件的內容不是產品功能：不寫進規格書、程式碼或測試，不在需求文件的追溯矩陣中建立編號。

## 2. 階段與需求文件里程碑的對應

| agent-dev-workflow 階段 | 需求文件里程碑 | 狀態 |
|---|---|---|
| 1 需求 | M1 需求 | 已完成（v1.0 2026-11-04、v1.1 2026-11-09 已簽核） |
| 2 設計 | M2 設計 | 已完成（v0.4 2026-11-09 16:12 已簽核） |
| 3 實作與測試 | M3 實作與測試（前半） | 進行中 |
| 4 系統測試 | M3 實作與測試（後半） | 待開始 |
| 5 使用者驗收 | M4 UAT | 待開始 |
| 6 發布 | M5 發布 | 待開始 |

需求文件的 M3 沒有區分系統測試。本專案以 agent-dev-workflow 第 4.4 節的系統測試離開條件，作為 M3 完成的額外條件；M3 在需求文件中的完成條件仍須同時滿足。

## 3. 對 agent-dev-workflow 的調整

| 編號 | 調整 | 理由 |
|---|---|---|
| W-1 | 所有 agent 都是同一個模型（Claude）在獨立工作階段中執行的子 agent。依 agent-dev-workflow 第 3.2 節維持獨立性：每個子 agent 以全新上下文啟動，只讀派工指令與文件，不讀其他 agent 的推理過程。審查紀錄須註明「審查者與作者為同一模型的不同工作階段」 | 本環境沒有不同模型或人類開發者可擔任審查者 |
| W-2 | 統籌 agent 是與產品負責人對話的 Claude，負責派出子 agent，並在每份派工指令中依第 4.1 節要求載入 skill | 確保子 agent 確實讀取 skill |
| W-3 | 版本庫內的 `.claude/skills/agent-dev-workflow/` 與 `.claude/skills/requirements-spec/` 是產品負責人維護之 skill 的快照副本。agent 不得修改，只能依 agent-dev-workflow 第 7.4 節第 5 點提出建議；產品負責人更新原始 skill 後，再以 Pull Request 同步副本 | 讓任何環境打開本專案都能取得 skill，同時保留產品負責人的維護權 |

## 4. 確保 agent 讀取 skill

skill 是否自動載入沒有保證，因此本專案疊用四層做法。

| 層 | 做法 | 位置 | 作用 |
|---|---|---|---|
| 4.1 派工指令 | 統籌 agent 派出每個子 agent 時，指令第一步寫明：「先用 Skill 工具載入 agent-dev-workflow 與本階段 skill，完成上工檢查，並把結果放在回覆開頭」 | 統籌 agent 的派工內容 | 讓 agent 讀取 |
| 4.2 常駐提醒 | 版本庫根目錄的 `CLAUDE.md` 與 `AGENTS.md` 寫明上工前先載入 skill，並列出底線規則 | `CLAUDE.md`、`AGENTS.md` | 讓 agent 讀取；skill 沒載入時底線仍在 |
| 4.3 子 agent 定義 | `.claude/agents/` 的子 agent 定義以 `skills` 欄位預先載入 skill。已知此欄位曾有未生效的回報，因此只作為額外一層 | `.claude/agents/*.md` | 讓 agent 讀取 |
| 4.4 可檢查的證明 | Pull Request 範本要求填寫上工檢查結果，以及已載入 skill 的變更紀錄最新版本號。版本號只寫在 skill 中，沒讀過就填不出來。審查 agent 以此為審查清單第一項；階段 3 的第一批變更加入 CI 檢查，確認 Pull Request 說明含這兩段 | `.github/pull_request_template.md`、審查清單、CI | 發現沒讀 |

`CLAUDE.md` 與 `AGENTS.md` 不得寫入任何 skill 的版本號，以免 4.4 的證明失效。

非 Pull Request 的產出（例如設計文件）在交付摘要開頭附上相同的兩段。

## 5. 本專案產出的可重用 skill

| 階段 | skill 名稱 | 存放位置 | 提交時點 |
|---|---|---|---|
| 設計 | software-design-phase | `.claude/skills/<名稱>/SKILL.md` | 隨設計文件交付產品負責人；版本庫建立後由第一批變更提交 |
| 實作 | implementation-phase | 同上 | M3 結束前 |
| 測試 | acceptance-testing | 同上 | 系統測試結束前 |

- 撰寫規則依 agent-dev-workflow 第 7.2 節。
- 新 skill 完成後，統籌 agent 更新 `.claude/agents/` 中對應子 agent 的 `skills` 欄位。
- 本專案資料夾即為未來的版本庫；版本庫建立前寫入資料夾的檔案，由第一批變更一併提交。

## 6. 文件存放位置

| 文件 | 位置 |
|---|---|
| 需求文件 | `docs/requirements.md` |
| 本文件 | `docs/workflow.md` |
| 設計文件（軟體規格書、模組測試標準、牌面屬性表與草稿） | `docs/design/` |
| 測試報告 | `docs/test-reports/` |
| UAT 紀錄 | `docs/uat/` |

## 7. 給產品負責人的已知事項

本規範整理時發現、但屬於需求文件範圍而未修改的事項：

| 事項 | 說明 |
|---|---|
| AC-EQ-5 的「兩者不同」 | 依 W-1，審查 agent 與作者 agent 是同一模型的不同工作階段。審查紀錄將分別標明兩個工作階段，並註明為同一模型；若產品負責人認為這不符合 AC-EQ-5，需修訂需求文件 |
| 需求文件 M3 未含系統測試 | 本文件第 2 節以對應方式處理，不修改需求文件 |

## 8. 完成條件

由產品負責人在發布後確認：

1. 設計、實作、測試三個 skill 都存放於 `.claude/skills/`，且符合 agent-dev-workflow 第 7.2 節。
2. 每個 skill 都有變更紀錄；開發過程中觸發的 skill 修改都已記錄，對產品負責人維護之 skill 的修改建議都已提出。
3. 每個合併的 Pull Request 都有第 4.4 節要求的兩段內容。

## 9. 變更紀錄

| 版本 | 日期 | 變更 | 理由 |
|---|---|---|---|
| 0.1 | 2026-11-04 | 初稿 | 依 agent-dev-workflow 第 6 節，記錄本專案的調整；取代先前停用的 workflow.md v0.1 |
| 0.2 | 2026-11-09 | 需求文件引用改為 v1.1；第 2 節更新階段狀態；第 5 節填入三個 skill 的名稱；`.claude/agents/` 的 skills 欄位加入各階段 skill | 測試 agent 回報引用過時；依第 5 節「新 skill 完成後更新子 agent 的 skills 欄位」 |
