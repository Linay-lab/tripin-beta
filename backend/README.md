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

## GitHub Actions 手動執行（不會自動觸發）

已提供 `.github/workflows/test-database-rls.yml`。請在 GitHub 儲存庫的 Settings → Environments 建立 `tripin-test-database`，**設定必要的審核者**，並在該 Environment 的 Variables 設定 `TRIPIN_TEST_ISOLATED_PROJECT=YES`。只在確認專案沒有正式資料後才設定 YES。

在同一 Environment 的 Secrets 設定上述四個 `TRIPIN_TEST_*` 變數（URL、anon key、兩個短期使用者 token）。這些值不應設定在一般 repository variables、原始碼或 GitHub Pages。完成後，到 Actions → **TRIPIN Test Database RLS Isolation** → Run workflow 手動啟動。

**重要：** Environment 的審核者、Secrets、Variables 尚未由此提交自動建立；未設定時 workflow 會安全失敗，不會嘗試連線。測試用 token 會過期，需要重新取得；測試完建議撤銷 token。這個 workflow 只做 RLS 驗證，沒有部署資料庫或修改 TRIPIN Beta 前端。


## 已存在的 souvenir-reminder 測試專案（2026-10 更新）

目前核准的非正式測試專案 ID 為 `xxzchaewtmctplhamwwi`。已存在 `trips`、`shopping_items` 等表與兩位測試使用者；**請勿對此專案套用 `001_tripin_test_schema.sql`，也不要使用舊版 `rls-two-users.cjs`**，因為舊版測試對應不同的 `tripin_*` 表。

正式 REST 測試檔案：`backend/tests/rls-existing-schema-rest.cjs`。GitHub Actions 手動工作流程 `test-database-rls.yml` 已改用此檔案。測試會先向目標 Supabase Auth 確認兩個 JWT，才建立短暫資料，並嘗試清除。

請只在受保護的 GitHub Environment `tripin-test-database` 中設定：
- Environment variable: `TRIPIN_TEST_ISOLATED_PROJECT=YES`
- Environment secrets: `TRIPIN_TEST_SUPABASE_URL`、`TRIPIN_TEST_SUPABASE_ANON_KEY`、`TRIPIN_TEST_USER_A_TOKEN`、`TRIPIN_TEST_USER_B_TOKEN`

專案 URL 必須是 `https://xxzchaewtmctplhamwwi.supabase.co`。兩個 JWT 必須由這個測試專案的不同 Auth 使用者登入取得，且尚未過期。公開 anon key 可在 Supabase Dashboard 的 Project Settings → API Keys 找到；它不是 service_role key。不要把密碼、JWT 或 service_role key 放在 GitHub Pages、提交進 Git、或貼到聊天室。

GitHub 儲存庫 → Settings → Environments → `tripin-test-database` 設定完畢後，進入 Actions → TRIPIN Test Database RLS Isolation → Run workflow。工作流程不會自動執行。若未設定完整，會在發送請求前安全中止。

已透過 SQL 模擬登入身分完成七項 RLS 隔離檢查，但**不等於真實 JWT API 測試已完成**；直到手動工作流程成功前，請保留此區別。
