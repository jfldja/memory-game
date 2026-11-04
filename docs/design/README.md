# 設計文件（M2）

| 項目 | 內容 |
|---|---|
| 版本 | 0.1（設計草稿） |
| 日期 | 2026-11-04 |
| 狀態 | 待產品負責人簽核 |
| 依據 | docs/requirements.md v1.0（已簽核）；docs/workflow.md v0.1 |
| 撰寫 | 設計 agent（agent-dev-workflow 第 3 節「設計 agent」） |

## 文件清單

| 檔案 | 內容 |
|---|---|
| verification.md | Q4（開發工具授權）、Q6（GitHub Actions／Pages、分支保護、EQ-11 可行性、部署延遲）查證紀錄，附官方網址 |
| spec.md | 軟體規格書：架構、檔案結構、模組介面、狀態機、計時、時鐘抽象、隨機排列、紀錄儲存、畫面與版面計算、版本號、CI／CD、PR 切分、Should 需求建議、待決問題、假設 |
| module-test-standards.md | 各模組測試標準、單元測試與驗收測試分界、Must 需求追溯 |
| acceptance-test-plan.md | 驗收測試骨架計畫（55 個必要編號、層次、轉實測的 PR、撰寫注意事項） |
| review-process.md | 審查紀錄格式、審查清單 R-1～R-13、審查檢查判定規則 |
| supplementary-acceptance.json | Should 需求的設計補充驗收編號（簽核後啟用） |
| cards.md | 牌面屬性表與繪製說明、第 3 關可分辨性的依據 |
| card-attributes.json | 機器可讀牌面屬性表（AC-LV-2～4 讀取） |
| card-preview.html | 19 張原創內嵌 SVG 預覽頁（不載入外部資源，直接以瀏覽器開啟） |
| card-preview.png、card-preview-min-size.png、card-preview-360.png | 預覽頁截圖（本機 Chromium） |

可重用設計 skill：`.claude/skills/software-design-phase/SKILL.md`。

## 需要產品負責人決定的事項

1. 簽核本設計（EQ-6）。
2. 關閉 Q4、Q6（verification.md 第 3 節）。
3. 待決問題 DQ-1～DQ-6（spec.md 第 16 節）。
4. Should 需求本輪是否實作與其補充驗收（spec.md 第 15 節）。
5. 牌面草稿的美觀度與第 3 關難度（cards.md 第 4 節）。
6. 假設 DA-3（版本號固定 1.0.0）、DA-4（DOM 中的 `data-face`）（spec.md 第 17 節）。

## 簽核紀錄（AC-EQ-6）

| 日期 | 簽核者 | 簽核的版本 | 備註 |
|---|---|---|---|
| | 產品負責人 | | |

簽核日期必須早於第一個實作 PR 的建立日期。
