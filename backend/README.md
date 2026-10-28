# TRIPIN 真實雙帳號 RLS 測試操作說明

目前只提交測試程式，**尚未建立任何雲端資料庫，也未執行跨帳號測試**。

## 安全前提

1. 在 Supabase 新建一個**完全獨立、沒有正式資料**的測試專案；不得使用現有生產環境。
2. 在該專案的 SQL Editor 審閱並執行 `backend/migrations/001_tripin_test_schema.sql`。第一次建立新資料庫時使用；此 migration 不是可無限重跑的 idempotent script。
3. 在測試專案的 Authentication 建立兩個**不同**的測試使用者，分別登入取得短期 access token。不得用 service_role key 代替使用者 token。
4. 只在本機環境變數設定測試專案 URL、公開 anon key 與兩個使用者 access token；不要上傳到 GitHub、提交到原始碼、貼到聊天室或瀏覽器公開頁面。
5. 確認目標是獨立測試專案後，設定 `TRIPIN_TEST_ISOLATED_PROJECT=YES`，再執行 `node backend/tests/rls-two-users.cjs`。
6. 測試會建立以 `rls-` 開頭的旅行、商店及商品，測完嘗試刪除；如測試中斷，請在測試資料庫檢查殘留測試資料。

## 需要的環境變數

- `TRIPIN_TEST_SUPABASE_URL`：`https://<test-project>.supabase.co`
- `TRIPIN_TEST_SUPABASE_ANON_KEY`：測試專案的 anon key
- `TRIPIN_TEST_USER_A_TOKEN`：測試使用者 A 的 access token
- `TRIPIN_TEST_USER_B_TOKEN`：測試使用者 B 的 access token
- `TRIPIN_TEST_ISOLATED_PROJECT=YES`：人工確認測試專案

## 驗證內容

A 可以新增、讀取自己的旅行；B 無法讀取、修改或刪除 A 的旅行；B 無法讀取 A 的商店及商品；B 無法把 A 的旅行與商店關聯到自己的商品；匿名存取受到拒絕。

注意：測試通過也只代表這些 API 情境通過，**不代表已完成滲透測試、備份驗證或多人負載測試**。目前 Beta 前端沒有接上這個資料庫。
