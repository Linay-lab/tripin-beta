# 正式 schema 本機相容性沙盒

僅載入 2026-10-31 的正式資料庫 metadata，使用記憶體中的 PGlite PostgreSQL、兩個合成 UUID 及模擬 Auth claims。沒有使用者資料、真實登入、網路 API、照片檔案或正式資料庫連線。

執行：在本目錄先 `npm ci --ignore-scripts`，再 `npm test`。套件固定為 `@electric-sql/pglite@0.3.14` 並附 lockfile。安裝可能需要下載套件，測試本身只在本機執行；不能把這個沙盒當作完整 Supabase 備份或實際還原。

## 三種結果必須分開閱讀

1. **baseline**：重建 8 表、38 約束、30 條 policy、現有一般 trigger 與所擷取 grants。35 個檢查預期 31 通過、4 個待處理：profiles／trip_members／item_images 的本人新增被目前 grants 拒絕；商品建立者歸屬可被改成另一帳號。
2. **policyOnlyWithSyntheticCrudGrants**：只在本機額外授予 authenticated CRUD，讓原 policy 能單獨驗證，預期 34／35；此人工授權不是正式修正建議，不代表正式目前可操作上述三表。
3. **candidatePolicyOnly**：保留第二階段的人工 CRUD，再於本機套用候選商品建立者 WITH CHECK，預期 35／35。這證明候選 policy 在合成場景可修正歸屬問題；不代表正式已修正或應直接開放三個資料表。

CI 綠燈只表示上述預期結果穩定、候選沙盒檢查通過。程式會核對 baseline 仍明確列出四個問題，不把目前正式狀態當成全數通過。

## 已確認的權限差異

唯讀查詢正式 `has_table_privilege` 與 `has_any_column_privilege`，profiles／trip_members／item_images 對 authenticated 的 SELECT／INSERT／UPDATE 都為 false，也無表級 DELETE。只存在 policy 不代表 Data API 已獲授權。這可能是未啟用的功能，不能直接判定所有使用中的功能已故障；未自動替它們開權限。

現有 shopping_items UPDATE policy 只要求操作後的旅行仍屬本人，沒有保證 created_by 歸屬。沙盒實際允許 A 將本人旅行商品的 created_by 改為 B；B 仍讀不到 A 的商品，沒有證明跨帳號內容可讀。這是歸屬完整性問題。

候選 `candidate-policy-fixes.sql` 只增加 created_by = auth.uid()，未套用正式。若未來成員可新增商品、或既有資料的建立者與旅行擁有者不同，此條件可能不符合產品規則；正式套用前需檢查資料與協作權限設計，也可評估以不可修改建立者的授權方式替代。

## 邊界

- Auth 的 users 表只有合成 id，auth.uid() 是測試用 claims adapter；不模擬真實 JWT、PKCE、刷新或撤銷。
- 沒有 Storage bytes、Storage RLS、Auth 新使用者 trigger、DDL event trigger、Edge Functions、配額或正式 PostgreSQL 設定。
- PGlite 與託管 Postgres 可能有版本／擴充差異。此測試不能代替正式 schema 的獨立 Supabase staging、真實 API 或實體手機驗收。
- 擷取的 grants 包含部分 TRUNCATE／TRIGGER／REFERENCES，仍應作最小權限審查。沒有嘗試正式破壞性操作，也沒有把 SQL 權限推定成匿名 HTTP API 可執行 TRUNCATE。
- 所有修正都只在本機，正式資料庫未變更。GAS Code.gs、實際備份與隔離還原目標仍待提供。
