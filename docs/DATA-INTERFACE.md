# 新版旅點：本機資料介面與未來雲端對應

基準：`b84ad10d67d31ea9a16aca5b59bb1d2f8435d5fc`。本階段不登入／連線 Supabase、不遷移資料、不改 DB。所有畫面與操作以新版單檔為準。

## 可替換介面

`data/tripin-data.cjs` 是無 DOM／網路／憑證依賴的共用資料模組；CJS 可由 Node/Next.js 載入，瀏覽器以同一內容的內嵌模組使用。TypeScript 宣告在 `data/tripin-data.d.cts`。`node scripts/embed-data.cjs --check` 驗證內嵌與模組完全相同；修改模組後以不帶 --check 的命令更新，無需安裝套件。

`createLocalRepository(storage)` 接受 getItem/setItem 介面，回傳同步的 load/save/parseBackup/exportBackup。資料來源可替換為記憶體或裝置儲存，並非綁定 window.localStorage。load 不寫入；save 必須帶上讀取到的原始字串 expectedRaw，避免觀察到別分頁修改後仍覆蓋。狀態碼明確區分損壞、過期、格式錯誤、讀取失敗及寫入失敗。呼叫端保留現有成功／失敗提示與編輯回滾。

未來遠端介面必須是明確的非同步合約，加上帳號世代、取消、權限、重試及競爭控制；不能把 Promise 硬塞進目前同步 save()，讓 UI 誤判已儲存。

### 相容性
- 主鍵仍為 `travel_studio_beta_v3`，不加版本封裝或改名、不自動重寫原有資料。
- 五組陣列 trips/items/expenses/plans/info；GPS shoppingPlaces/shoppingReminderRadius；既有封面與商品圖片皆保留原格式。
- `normalizeBackup`、safeImage、safeUrl 直接沿用基準實作，保留既有欄位與驗證規則。
- JSON 備份格式、檔名、確認後還原及既有回滾流程保留；損壞資料可匯出原文。讀取權限失敗、沒有可匯出的原文時，改為明確提示，避免產生無意義備份。
- GPS ledger 繼續使用 `travel-studio-gps-ledger-v1`，由獨立 record store 存取。與原版相同：它不在 JSON 備份中，GPS 店家／商品關聯與提醒距離則在備份中。匯入備份不視為移轉通知歷史。
- 回饋歷史與模擬登入的獨立儲存鍵不併入業務資料；原 feedback-script 原封保留，不改接收網址、不寄測試信。

## 邏輯資料對應（整合前契約，非可直接執行的 migration）

以下表名對照現有測試後端；正式後端結構不同，標為「待定」者不得默默丟棄或自行新增欄位。

| 本機 | 未來目標／規則 | 仍須決定 |
| --- | --- | --- |
| trips.id/name/start/end | trips UUID/name/start_date/end_date；owner_id 由已驗證登入者提供 | 本機短 ID 另存映射 |
| trips.country/city/notes | 保留國家、城市與備註，destination 可由國家城市組成 | 現有 schema 如何無損保留獨立欄位 |
| trips.budget | trip_budgets 的預算資料，依映射後 trip_id 及本人歸屬 | 幣別與日預算／總預算模型 |
| trips.cover/coverX/coverY/coverZoom | 私人 Storage + trip_covers，裁切狀態需完整保留 | 圖片路徑、裁切欄位、授權及清理 |
| items（收藏庫全部類型） | saved_collections；保存類型、國家城市、來源、照片、分類與對象 | 收藏與購物資料的連動／複製規則 |
| items（type=商品 且有 trip） | 可建立 shopping_items 草稿：qty→quantity、recipient→recipient、place→place_name、note→note、bought→bought；其餘 name/category/price/currency 對應同名欄位 | 商品仍在收藏庫呈現的關聯，避免兩份資料互相覆蓋 |
| items（非商品，或沒有 trip） | 不能自動轉為 shopping_items | 非商品要加入行程時需使用行程模型 |
| items.shoppingPlaceId、shoppingPlaces | 精確分店 ID／座標，不能只按同名店家合併 | 店家 schema、座標、place_id 與 UUID 對應 |
| plans.trip/date/time/name/place/note | itinerary_stops，trip 要用 UUID，保留日期時間及位置 | source_collection_id 與現有欄位的明確對應 |
| expenses.trip/name/amount/currency/payer/date | trip_expenses，trip 要用 UUID，金額與幣別不可遺失 | payer 與後端現有欄位對應；本階段不換匯 |
| info.trip/type/name/value/note | 獨立旅行資訊模型 | 目前測試 schema 沒有完整對應表，不能塞進購物商品 |
| shoppingReminderRadius | 帳號／裝置的提醒偏好 | 同步範圍與離線快照 |
| GPS ledger | 未來依 accountId/tripId/storeId 隔離的裝置通知狀態 | 不直接上傳既有共用 ledger |

## ID 與純草稿工具

`createCloudIdResolver` 只接受明確的 entity/localId→UUID 對應；缺少映射就失敗，同一實體內不允許兩個本機 ID 對到同一 UUID。即使本機 ID 碰巧是 UUID，也不得把它當成已存在的雲端列。

`shoppingItemDraft` 僅為可測試的欄位對應草稿，不會上傳資料。要求商品類型、旅行關聯、明確 owner UUID 與 ID resolver。對應既有購物欄位，另外回傳 pending，保留照片、來源、國家城市及店家關聯，避免以「已轉換」名義遺失未定欄位。pending 尚未處理前，不可把草稿當作完整遷移成功。

本機資料不包含已驗證帳號歸屬，不能從備份信任 owner。未來需確認登入者、RLS、資料庫實際欄位、授權與映射儲存，再設計明確同意的匯入、冪等與復原；本次未執行任何這類操作。

## 目前邊界

保留既有行為不等於完全消除既有資料模型限制。normalizeBackup 不完整驗證所有跨陣列外鍵，localStorage 的先讀後寫不是原子交易；保留 dangling reference 的歷史相容性，雲端前要另外做關聯預檢、錯誤清單及使用者確認，不能現在自動刪除舊資料。

本機儲存不具帳號隔離／加密能力；讀取／寫入錯誤狀態不代表雲端權限驗收。GPS 模擬及手機尺寸測試也不等於實體手機背景定位驗收。
