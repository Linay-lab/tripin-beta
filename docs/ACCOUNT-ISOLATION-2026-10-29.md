# 帳號隔離續查：2026-10-29

本輪目標是接續正式多人版準備，沒有把舊的單檔測試版結論套用到最新進度。

## 已確認

- 現有專案包括 Linay-lab/tripin-beta（獨立 Beta 與測試）、Linay-lab/souvenir-reminder（Next.js），不是只有舊 travel-studio-preview。
- 核准的獨立測試 Supabase 專案：xxzchaewtmctplhamwwi；正式專案 uridwummwjyjfgmkzatq 未被本輪修改。
- 測試專案 public 的 8 個業務資料表皆啟用 RLS，沒有 public views。
- 已核對真實 JWT REST 測試成功紀錄：[40721646699](https://github.com/Linay-lab/tripin-beta/actions/runs/40721646699)。該次 13 項成功，包括 Auth 驗證、A 自有讀取、B 不可讀／改／刪 A 旅行與商品、跨旅行新增拒絕、匿名不可讀。
- 此既有成功紀錄不代表今天已重新登入或全部資料表都通過 HTTP API 測試。本輪沒有取得、輸出、重設或提交使用者密碼、JWT、service_role key。

## 本輪新增執行的資料庫測試

`backend/tests/rls-expanded-rollback.sql` 在核准測試專案內，以真實 Postgres authenticated／anon 角色搭配模擬 JWT claims 驗證權限。

54 項涵蓋旅行、商品、收藏、每日行程、支出、預算、封面：本人讀取／更新、不可轉移 owner、另一人不可讀／改／刪、跨旅行商品拒絕、回饋只可寫、匿名不可讀，以及跨帳號收藏引用。

- 修正前：53／54 通過，失敗項為「A cannot reference B private collection」。它代表錯誤的跨帳號資料關聯可建立；沒有因此證明 B 的收藏內容可被讀取。
- 修正後：54／54 通過，0 個失敗。
- 全部測試 fixture 在 transaction 結束 ROLLBACK。另查核測試旅行與收藏的殘留筆數皆為 0。
- 這是 SQL 角色模擬測試，不是新的真實 JWT HTTP／Storage API 完整測試，也不是多人負載或滲透測試。

## 已修正（僅測試資料庫）

itinerary_stops 的 INSERT 與 UPDATE WITH CHECK 原本只確認 user_id 與 trip owner，沒有確認 source_collection_id 的所有權。

已加入：source_collection_id 為 NULL，或其指向的 saved_collections 必須屬於 auth.uid()。沒有使用 user_metadata、SECURITY DEFINER 或關閉 RLS。

SQL 記錄為 Supabase CLI `migration new` 產生的 `supabase/migrations/20261029141320_restrict_itinerary_collection_links.sql`。修正使用已連線 MCP 在測試專案執行；此檔為稽核紀錄，未自動對正式資料庫套用，亦未自動寫入遠端 migration history。不要對未知 schema 直接執行全部 migration。

## 照片隱私仍需完成：不是已修好

目前測試專案：

- trip-covers：private。
- collection-photos：public，現有物件數為 0。
- collection_photos_public_read 政策為 TO public，僅檢查 bucket_id。

公開 bucket 的圖片可以透過公開 URL 讀取；改成 private 後，過寬的 SELECT 政策也仍需修正。**只改其中一項不夠。**

本輪曾嘗試修正 Storage SELECT 政策，資料庫回覆 `must be owner of table objects`；交易已失敗回滾，沒有變更照片政策。沒有改動 storage.objects 的物件中繼資料、提升角色或使用未提供的秘密。

須在 Supabase Storage 的授權管理介面完成：

1. 將 collection-photos 的 public 設定關閉。
2. 將 collection_photos_public_read 替換為僅 authenticated 可 SELECT 的本人資料夾政策：

   `bucket_id = 'collection-photos' AND (storage.foldername(name))[1] = ((SELECT auth.uid())::text)`

3. 前端須以登入身分下載或使用短效 signed URL，不依賴 getPublicUrl。儲存路徑第一段應為使用者 UUID。
4. 用 A 上傳測試圖片：A 可以下載／簽署，B 和匿名及公開 URL 不可讀。最後清除測試圖片。

官方依據：[私有圖片與下載](https://supabase.com/docs/guides/storage/serving/downloads)。

## 已準備擴充真實 API 測試，但未執行

`backend/tests/rls-full-rest.cjs`：

- 限制只能指向核准的非正式測試專案，並要求隔離確認及兩個不同且未過期的真實登入 JWT。
- 先向該專案 Auth 驗證兩人，才新增 fixture；不使用 service_role。
- 擴充 7 類資料表、本人與跨帳號操作、owner 轉移、跨收藏／跨旅行關聯、照片下載及 signed URL 的正反案例。
- 匿名請求不使用把 publishable key 假裝成 JWT 的 Authorization 標頭。
- 權限拒絕須符合預期 HTTP／PostgREST code，HTTP 500 不會被當成安全檢查通過。
- 所有建立成功的測試資料會追蹤清除，即使意外通過了未授權新增，也會追蹤該 fixture；清除失敗將使測試失敗。
- 不新增普通使用者無法刪除的 beta_feedback fixture，也不寄信。

本機驗證：語法通過、4 項離線安全 guard 通過；缺少 secrets 時回傳 NOT RUN／exit 2，沒有發送請求。**尚未執行新版本的完整 HTTP／Storage 測試**，不能用離線 guard 的綠燈代表 RLS 或照片已安全。

使用者可在自己的受保護執行環境沿用 TRIPIN_TEST_* 四個秘密，刷新短效 JWT 後，明確確認非正式測試專案，再執行此檔。不要把 token 貼在聊天室或提交 GitHub。

## 其他待處理事項

- 測試與正式專案的洩漏密碼防護尚未開啟：[官方處理說明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。是否可開啟與方案權限有關，本輪未變更付費方案。
- 正式專案的 rls_auto_enable event-trigger 函式被 advisor 標示有較寬執行權限。本輪僅記錄，沒有修改正式函式或把 event trigger 誤當成可直接呼叫的一般 RPC。
- 測試專案有 7 項缺少外鍵索引的效能建議，後續需依實際查詢與量測處理，不把空資料表上的 advisor 訊息當作真實容量測試。

## 本輪不代表

正式網站已準備開放任意人數、所有資料一定不外洩、正式 Auth 設定及 Next.js 全流程已全部驗收、Apps Script 已審查、真正背景 GPS 已實作。

## WebKit 測試同步修正

另查到 main 的 40888724771 紀錄曾在 WebKit 多分頁測試失敗。原測試在另一分頁保存後立刻要求舊分頁拒絕寫入，沒有等待 WebKit 跨程序 localStorage 更新傳遞。修正測試為：確認另一分頁確實保存成功、回到原分頁、等待該分頁觀察到儲存更新，再維持「舊資料保存必須失敗且新資料仍保留」的原斷言。

這只驗證觀察到更新後的過期寫入防護，不能證明尚未傳遞的同時寫入有原子鎖；前端 localStorage 仍不是多人共享資料庫的交易保護。本輪沒有藉由移除原斷言把失敗掩蓋成通過。

## 最新補正：照片設定已修正（2026-10-29）

使用者已把 collection-photos 改為 private，查核 public=false。政策編輯同時改名仍失敗；保留原名稱 collection_photos_public_read，僅更新角色與 USING 後，執行成功。

已查核：角色 authenticated，僅允許指定 bucket 且路徑第一層等於 auth.uid()；沒有其他 SELECT／ALL 政策放行此桶。名稱雖有 public_read，實際權限已不是公開讀取。沒有更改表的擁有者、提升角色、關閉 RLS 或修改正式專案。

本節更新上方照片設定未完成的歷史狀態。設定已確認，但新的真實 JWT／Storage 圖片上傳、下載與 signed URL 正反案例仍未執行，不能宣稱完整圖片測試已通過。

## 2026-10-30 續查：真實 API 與照片測試已通過

已讀取 [40897931030](https://github.com/Linay-lab/tripin-beta/actions/runs/40897931030) 的實際 job 紀錄，commit 2a77aa3572d2b0e5dae2a129478ce857b2690495：78 項 PASS、0 項 FAIL。本節取代上文「完整 HTTP／Storage 測試尚未執行」的歷史狀態。

- 兩個真實 Auth 帳號；7 類資料的本人與跨帳號讀寫、owner 轉移與錯誤關聯檢查通過。
- 私人照片本人下載／簽署成功，另一帳號下載／簽署拒絕，公開 URL 拒絕。
- 測試照片與資料清理檢查通過。上一版刪除後立即讀取可能命中快取，已加物件列表中繼資料檢查與 cacheNonce 下載驗證；另以資料庫確認測試照片紀錄為 0。
- 同 commit 的瀏覽器 bot 40897773981 與離線安全檢查 40897774042 成功。
- 僅測試專案與獨立開發分支；沒有合併 main、部署正式網站或套用正式 DB 修正。

### 新增並行測試：等待實際執行

rls-full-rest.cjs 現在加入 2、5、10 個並行 worker 的短批次，每個 worker 建立獨立商品、讀回並驗證另一帳號不可讀。共 17 個額外商品，使用既有追蹤／清理流程；所有 worker 結束後才清理，避免失敗時與未完成寫入互相競爭。

輸出每批完成數、失敗數、總時間與 worker p50／p95（包含該 worker 的建立及兩次讀取）。這是兩個帳號的基本並行測試，不是 10 個不同使用者、長時間壓力測試、同一資料列衝突測試或正式容量承諾。

新的 HTTP 測試需刷新兩帳號短效 JWT，再於受保護的 tripin-test-database 環境手動執行開發分支。不可把舊版本的綠燈當成本次新並行檢查已通過。仍待正式 Next.js 全流程、GAS 防濫用、備份還原與容量驗收。


### 2026-10-30 並行測試已實際通過

[執行紀錄 41070428471](https://github.com/Linay-lab/tripin-beta/actions/runs/41070428471)，commit c36f01faa04f26d7457b8a022599ef039ff83cfb，job 124112750696：98 項 PASS，0 項 FAIL。本節更新上文「新並行測試等待執行」。

| 並行 worker | 帳號數 | 完成 | 失敗 | 批次總時間 | worker p95 |
| --- | --- | --- | --- | --- | --- |
| 2 | 2 | 2 | 0 | 884 ms | 884 ms |
| 5 | 2 | 5 | 0 | 1406 ms | 1405 ms |
| 10 | 2 | 10 | 0 | 1982 ms | 1981 ms |

每個 worker 依序新增一筆獨立商品、本人讀取、另一帳號讀取拒絕；p95 是三個請求合計的 worker 時間，並非單一 API 延遲。17 個額外商品的清理檢查全部通過，原有資料／照片權限和清理檢查亦通過。

結果支持這個測試專案在本次短批次中、兩個測試帳號的最多 10 個並行工作流程正確完成。不支持「10 個不同使用者」「長期負載」「任意人數正式上線」或「無任何安全漏洞」等結論。main、正式網站及正式資料庫未因本次執行被修改。
