# GAS 回饋接收端審查與候選修正

2026-10-31。原始碼由專案擁有者提供，已保存於 `original-Code.gs`；候選為 `Code.gs`。尚未更新正式 GAS、試算表或部署，也未寄出真實 Email。

## 原版發現

- 以最多 6 小時的 CacheService 記錄回饋 ID，沒有在舊回饋列查重；快取不再存在時，同 ID 仍可再次寫入／寄信。
- 原版先儲存回饋並寫入去重快取，再呼叫 MailApp。若寄信失敗，同 ID 會被當作重複，卻沒有持久的寄信失敗狀態供查核。
- 沒有寄信剩餘配額、全域流量預算、頁面／類型白名單及重複參數驗證；原公式跳脫只看第一個字元。
- `.join('\\n')` 產生的是反斜線文字，候選改為真正換行。

## 候選行為

- 保留目前 URLSearchParams 欄位與原「旅購回饋」前 8 欄，以及由 `NOTIFY_EMAIL` 指定的固定收件者。前端端點不變。
- 增加「旅購回饋狀態」表作持久化去重與狀態紀錄；舊回饋 ID 只接管紀錄，不重新寄信。相同 ID、不同內容回覆 CONFLICT。
- 驗證長度、欄位、日期、頁面／類型及 HTTPS 來源；來源 URL 移除 query／fragment，減少把網址憑證記入信件與試算表。來源欄位可被偽造，這不是身分驗證。
- 全域上限預設每分鐘 5 筆、每日 50 筆新回饋，透過 ScriptProperties 與 ScriptLock 協調。日預算是本程式的 UTC 日，不推定 Google 寄信配額同時重置。每次寄信另查 MailApp 剩餘配額。
- 持有同一 script lock 時完成儲存與寄信嘗試。寄信或最後狀態儲存結果不明時不自動重寄，避免重複通知。
- 錯誤只回覆一般代碼，不回傳或記錄原始服務錯誤、收件信箱或回饋內容。

## 設定

| Script Property | 用途 |
| --- | --- |
| NOTIFY_EMAIL | 必填，單一固定收件信箱；沿用現有設定 |
| ALLOWED_ORIGINS | 可選，逗號或換行分隔的 HTTPS origin。預設 `https://linay-lab.github.io`、`https://souvenir-reminder.vercel.app`；自訂正式網域須先補入 |
| MAX_PER_MINUTE | 可選，預設 5，範圍 1–100 |
| MAX_PER_DAY | 可選，預設 50，範圍 1–1000，仍受實際 MailApp 配額限制 |
| TS_FEEDBACK_RATE_V2 | 程式維護的固定大小流量計數；不要手動清除以繞過預算 |

程式不會替不相容的既有標題列改名。若「旅購回饋」或「旅購回饋狀態」標題不符，會停止而不覆寫。

## 狀態解讀

| 狀態 | 意義 |
| --- | --- |
| RESERVED / RECORDED | 已預約 ID／已儲存回饋，尚未完成寄信 |
| SENDING | 準備進行寄信嘗試；中斷後不可直接推定未寄出 |
| SENT | MailApp 正常返回，仍不保證信件實際投遞或進入收件匣 |
| SEND_UNCERTAIN | 寄信或最後提交結果不明，不自動重寄 |
| QUOTA_BLOCKED / RECORDED_NO_EMAIL | 已記錄，但未能完成寄信檢查或無配額 |
| WRITE_FAILED | 儲存階段失敗，需查本機備份與執行紀錄 |
| LEGACY_RECORDED | 舊 ID 已存在，過去寄信狀態未知，不重寄 |

Google 寄信與 Sheets 寫入不是同一筆資料庫交易；本方案優先避免重複寄信嘗試，不能承諾 exactly-once 投遞。已進入狀態表的 ID 不自動重試，即使配額恢復；需由管理者確認處理方式。不要盲目刪除狀態列或一鍵重寄 SEND_UNCERTAIN。

## 驗證

本目錄執行 `npm ci --ignore-scripts`、`npm test`、`npm run typecheck`。使用固定的 TypeScript 與 Apps Script API 型別宣告，依賴附 lockfile。

- 39 項 Node 模擬測試通過：正常欄位／收件者、持久化重複、ID 衝突、舊列、寄信前後例外、提交失敗、配額、流量限制、鎖競爭、公式注入、URL 憑證移除、輸入拒絕、錯誤不洩漏及設定唯讀檢查。
- API 型別檢查通過；本次 npm audit 沒有發現套件公告漏洞。
- 全部 Google 服務是記憶體替身，沒有真的寄信或寫入 Google。官方參考頁擷取未成功，型別宣告也不是 Google 執行環境的替代；仍須在獨立測試專案驗證實際行為。

## 下一階段：獨立 Google 測試專案

1. 先保留現有正式程式與部署版本。建立新的測試試算表及綁定 Apps Script；只使用合成回饋與自己的測試收件信箱。
2. 只放候選 `Code.gs`；**不要把歸檔 `original-Code.gs` 一起貼入同一專案**，避免兩個 doPost 互相覆蓋。
3. 設定 NOTIFY_EMAIL、確認測試站 origin，再在編輯器執行 `feedbackReviewSetup`。它只讀取設定、標題與剩餘寄信配額，輸出布林值；不建表、不寄信、不寫入計數。
4. 設定檢查通過後，另行安排一封明確授權的真實收信驗證與重複 ID 測試，確認試算表與狀態表。本輪沒有執行。
5. 正式替換前確認自訂網域、表標題、試算表分享權限、配額及復原步驟；沒有直接更新原部署。

## 尚未解決的邊界

公開匿名端點的網站來源／honeypot 可被偽造，攻擊者仍可能消耗全域流量預算或平台執行配額。此候選是基本防濫用與寄信可靠性補強，不是全面 DoS 防護；更強控制需要可驗證的登入／人機驗證或前置服務。

原前端使用 no-cors，讀不到 RATE_LIMIT、INVALID 或寄信狀態；仍只可顯示 submitted_unverified 並保留本機內容。不能把 HTTP 請求完成當成已接收／已寄信。可靠的畫面回執需另外設計可驗證的服務介面。

資料保存期限、狀態表保留與人工處理流程、真實收信及權限設定仍需驗收。

API 參考：[Cache](https://developers.google.com/apps-script/reference/cache/cache)、[MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)、[Lock](https://developers.google.com/apps-script/reference/lock/lock)、[服務配額](https://developers.google.com/apps-script/guides/services/quotas)。
