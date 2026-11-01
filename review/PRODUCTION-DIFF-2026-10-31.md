# 正式環境唯讀差異查核

日期：2026-10-31（台灣時間）。本輪只查 metadata、policy 與 security advisor，沒有讀取使用者內容、執行業務寫入、修改正式 schema／RLS／Auth 設定或部署。

## 查核結論

正式 project uridwummwjyjfgmkzatq 與測試 project xxzchaewtmctplhamwwi 的 schema 不相同。測試專案 104 項 API 綠燈不能直接當作正式資料庫的驗收結果。

| 項目 | 測試 | 正式 | 結果 |
| --- | --- | --- | --- |
| public 業務表 RLS | 8 表均開啟 | 8 表均開啟 | 結構檢查通過，仍需驗證 policy 語意 |
| 商品 revision | bigint 欄位與遞增 trigger | 都沒有 | 套用新版 Next 商品寫入前的必要前置尚缺 |
| 收藏／行程／支出 | saved_collections、itinerary_stops、trip_expenses、beta_feedback | 沒有這些表 | 不可直接套用依賴這些表的測試 migration |
| 正式特有表 | 無 | profiles、trip_members、item_images、shopping_item_photos | 需獨立驗證資料與權限 |
| 照片 bucket | collection-photos、trip-covers，均 private | item-images、shopping-item-photos、trip-covers，均 private | 路徑和 policy 測試需依各環境調整 |

正式 shopping_items 另外有 place_id、source_url、source_type；不得因遷移到簡化測試 schema 而刪除它們。正式 trip_members 有角色欄位，目前讀到的 policy 以 trip owner 為基準；這不能推定成員已可共同編輯。

## 已執行的唯讀前置檢查

[production-preflight.sql](production-preflight.sql) 在正式 project 以 BEGIN READ ONLY 執行，結束 ROLLBACK：

- private_photo_buckets：PASS。
- public_table_rls：PASS。
- shopping_revision_column：BLOCKED。
- shopping_revision_trigger：BLOCKED。
- public_security_definer_execute：REVIEW。

腳本只做 metadata 檢查，不會自行修正或部署。它不是完整 policy／登入／照片驗收，也不會取代人員審查。

## 正式安全 advisor 待辦

- public.rls_auto_enable 為 SECURITY DEFINER，anon 與 authenticated 都有 EXECUTE。實際 return type 是 event_trigger；沒有嘗試透過 RPC 呼叫，不把 advisor 的一般描述當成已驗證的 RPC 漏洞。應審查是否可撤銷不必要的公開 execute，並先在符合正式 schema 的隔離環境驗證事件觸發器正常。未更改其 owner、security mode 或正式授權。
- 洩漏密碼防護未啟用，仍需確認方案能力與 Auth 設定；沒有升級付費方案。

官方處理說明：
- [公開 SECURITY DEFINER 執行權限](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [登入使用者 SECURITY DEFINER 執行權限](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [洩漏密碼防護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## 安全套用順序（未執行）

1. 先確認實際 DB 與照片備份，以及獨立還原目標；完成還原演練。
2. 在隔離環境重建「正式 schema／policy」，保留其額外表、欄位和照片路徑，再移植必要的 revision 機制。測試專案既有 migrations 不可整包盲套。
3. 針對 owner、另一個無關帳號及成員角色分別定義預期權限，跑直接 API、照片、同商品版本競爭與登入／PKCE 測試。
4. 準備精確且經備份的正式 migration 與回滾／復原步驟；核對版本欄位／trigger 就緒後，才安排新版 Next 前端。
5. 正式修改與部署仍需使用者另行決定。本輪沒有執行上述操作。

## 其他尚缺

現行 GAS Code.gs／引用程式仍未提供，回饋後端防濫用不可驗收。真實收信、正式 Auth redirect 設定與完整備份還原仍沒有成功證據。請勿將這份唯讀差異報告當作正式上線許可。
