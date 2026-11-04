# 翻牌記憶遊戲：給 AI agent 的常駐指示（CLAUDE.md）

> 本檔與 `AGENTS.md` 內容必須一致；修改其中一個時同步修改另一個。

## 開始任何工作之前

1. 用 Skill 工具載入 `agent-dev-workflow`，完成它第 1 節的上工檢查。
2. 讀 `docs/workflow.md`（本專案對 agent-dev-workflow 的調整）。
3. 讀 `docs/requirements.md`（已簽核的需求文件，產品行為的唯一依據）。
4. 載入本階段適用的其他 skill（位於 `.claude/skills/`）。
5. 在回覆、交付摘要或 Pull Request 說明的開頭，附上上工檢查結果，以及已載入 skill 的變更紀錄最新版本號（見 `docs/workflow.md` 第 4.4 節）。

## 底線規則（即使 skill 沒有載入也必須遵守）

- 只依據已簽核或已通過的文件工作。
- 需求文件沒寫的行為，不自行決定；停下來回報。
- 不為了讓工作通過而放寬驗收標準、修改驗收測試或刪減 skill 中的檢查。
- 撰寫程式碼的 agent 不撰寫驗收測試，也不審查自己的變更。
- 發現需求、設計、測試或程式有錯，回到負責的階段修正，不在下游補丁。
- `.claude/skills/agent-dev-workflow/` 與 `.claude/skills/requirements-spec/` 是產品負責人維護的 skill 副本，不得修改，只能提出建議。
- 無法判斷時，停下來回報產品負責人。

## 文件位置

| 文件 | 位置 |
|---|---|
| 需求文件 | `docs/requirements.md` |
| 專案工作規範 | `docs/workflow.md` |
| 設計文件 | `docs/design/` |
| 測試報告 | `docs/test-reports/` |
| UAT 紀錄 | `docs/uat/` |
| 可重用 skill | `.claude/skills/` |
