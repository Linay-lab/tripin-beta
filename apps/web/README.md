# 旅點新版 Next.js 移植（第二階段）

獨立 App Router 應用程式。唯一介面基準為儲存庫根目錄 `index.html`，基準提交 `f367f0e3c256ddb1b6898c89ce5adc73456c89c6`。原始 HTML 及第一階段 `data/` 未修改。

## 啟動

需要 Node.js 22 以上。從儲存庫根目錄執行：

```sh
cd apps/web
npm ci
npm run dev
```

開啟 http://localhost:3000 。正式建置驗證用 `npm run build`，本機啟動建置結果用 `npm start`。無須 Supabase 環境變數。不要把開發伺服器開放給公網。

## 已移植與保留

| 功能 | 本階段狀態 |
| --- | --- |
| 首頁、統計、最近收藏卡片展示 | React 元件；收藏內容操作交回 HTML |
| 桌機側欄、手機底部導覽 | React；尚未移植的目的頁開啟 HTML |
| 旅行列表、篩選、新增、編輯、刪除 | React；刪除旅行保留收藏、清除旅行附屬行程／費用／資訊 |
| 旅行總覽 | React；購物等後續操作交回 HTML 並保留旅行範圍 |
| 封面上傳、拖曳裁切、滾輪／雙指縮放、預覽、重設 | React；沿用原圖像壓縮及定位規則 |
| 本機資料讀寫 | 沿用根目錄第一階段資料介面、原儲存鍵及資料格式 |
| 收藏庫管理、購物清單、行程、錢包、旅行資訊、GPS、回饋、備份還原、個人中心 | 保留原始 HTML 實作，尚未移植 React |
| 真實登入、雲端同步 | 未接入；HTML 登入仍為原有離線 Beta 模擬 |

`predev` / `prebuild` 自動產生 `public/reference.html`（與原版完全相同）及 `public/legacy.html`（僅增加導覽銜接）。兩者為忽略追蹤的產物；不修改根目錄 HTML。React 沒有整頁 HTML 注入。原版 HTML 可獨立使用。

Next 路徑為 `/`、`/trips`、`/trips/[id]`。尚未移植功能採完整頁面切換到 `/legacy.html`，使用瀏覽器返回回到 React；返回時重新讀取本機資料。快速收藏不要求先建立旅行。Next 首次進入先顯示本機資料讀取狀態，不顯示原版模擬登入畫面。

本機資料以瀏覽器來源隔離：GitHub Pages、不同 localhost 連接埠及下載 HTML 的儲存空間各自獨立。跨來源搬移請使用原有 JSON 備份／還原；不自動搬移或合併私人資料。

## 驗證

從儲存庫根目錄：

```sh
npm ci
npx playwright install chromium
npm run test:data
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npm --prefix apps/web run test:port
```

`test:port` 啟動只綁定 loopback 的 3201 測試伺服器並自動結束。使用合成資料、同輪原版 HTML 截圖比較；桌機 1440×1000、手機 390×844。測試下載並驗證原 Open Huninn 字型 SHA-256；外部圖片使用固定替身，所有其他外部請求攔截，不寄信、不連 Supabase。可用 `TRIPIN_FONT_PATH` 指定已下載的相同字型、`CHROMIUM_EXECUTABLE_PATH` 指定 Chromium。截圖與結果在 `test-results/`；CI 以 artifact 提供。

詳細結果及限制見 [TEST-REPORT.md](TEST-REPORT.md)。
