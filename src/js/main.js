import { APP_VERSION } from './version.js';

// PR-1：最小可載入頁面，只顯示版本號（EQ-9；spec.md 第 11 節、4.11）。
for (const el of document.querySelectorAll('[data-testid="version"]')) {
  el.textContent = APP_VERSION;
}
