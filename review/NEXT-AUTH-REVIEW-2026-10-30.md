# Next.js 登入流程檢查：2026-10-30

來源 Linay-lab/souvenir-reminder main：670066736712746a25f3daf11a4cec2c8f0f4700。已閱讀 AGENTS.md 與安裝版本 Next.js 16.3.4 的 useRouter／NextResponse 文件，以及 Supabase SSR Auth 文件和 changelog。

## 修正

1. 原登出處理呼叫 setUser(null)，可能讓仍在畫面中的雲端商品進入訪客 localStorage 保存流程。現在維持原帳號狀態直到 SIGNED_OUT 事件觸發整頁導向 /login，並等待初始身份驗證完成才讀寫訪客商品。登入 client 以 useMemo 穩定化。包含另一分頁發出 SIGNED_OUT 的事件監聽；本輪未另外執行跨分頁測試。
2. 原忘記密碼 redirectTo 寫死 localhost:3000；改用目前 window.location.origin 的 /auth/callback?next=/reset-password。註冊確認也使用目前 origin 的 callback。部署時仍須確認該 origin 在 Supabase Redirect URLs allowlist；本輪未修改 Auth 設定。

## 本機驗證

- npm ci 依既有 lockfile 安裝；沒有改動 package.json／package-lock.json。
- next typegen 後 tsc --noEmit 成功。
- npm run build 成功（隔離假 Supabase origin/key，沒有真實認證或資料）。
- app/login/page.tsx 與新增 Node 測試檔的 ESLint 成功。
- Chromium 1440×900 與 390×844：以攔截的假 Auth／REST 回應完成登入、讀取雲端商品、登出、重新造訪首頁；訪客清單原值保留、私人雲端商品不殘留、忘記密碼 redirectTo 正確、無橫向溢出。
- 所有非本機請求皆攔截；沒有寄信、變更真實密碼或對正式資料寫入。瀏覽器為本機 Chromium，不代表實體 iOS／Android 或 WebKit 驗收。
- 完整專案 lint 仍失敗。以原 main 的 app/page.tsx 透過同一 ESLint 設定驗證，已有 14 errors／4 warnings（hooks 宣告順序、effect 同步 setState 等）；本次沒有移除規則掩蓋既有錯誤。仍須處理。

## 交付方式

修補檔：[next-auth-isolation.patch](next-auth-isolation.patch)，含兩個來源檔及 tests/auth-isolation.cjs。本機獨立分支 fix/auth-session-isolation 已提交 0cda1da；修補檔保存在 tripin-beta 的獨立 security/extended-account-isolation 分支。

沒有推送 souvenir-reminder 分支、建立其 PR 或觸發 Vercel 部署，也沒有合併 tripin-beta main。套用前先核對來源 commit，使用 git apply --check；若程式已變動，須重新比對。

重跑瀏覽器回歸：安裝 playwright@1.62.1 的測試依賴及 Chromium，以 NEXT_PUBLIC_SUPABASE_URL=https://isolated-test.supabase.co、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fake_test_only 在 127.0.0.1:3100 啟動 Next.js，執行 node tests/auth-isolation.cjs。不得改成正式 URL，測試攔截只允許假 Supabase hostname。

## 待完成

這是兩項登入／登出問題的修正，不是整個 Next.js 功能全驗收。商品儲存錯誤提示、零列更新處理、同資料列多裝置衝突、Auth 過期與換帳號、真實收信 callback／密碼重設、GAS 防濫用、備份還原與持續負載仍待驗證。舊 Beta 的 GPS／收藏／行程等功能尚未全部存在於此 Next.js main，不能宣稱已完成搬移。


## 商品操作續修（2026-10-30）

本機分支新增 commit 7b4d102，累積修補已更新到同一 patch：

- 更新購買狀態、編輯、刪除現在要求 select("id").single() 回傳正確 id；HTTP 成功但沒有修改資料，不再更新畫面。RLS 仍由伺服器執行，前端回傳檢查不替代權限控制。
- 失敗時顯示一般使用者可理解的提示，不輸出伺服器錯誤細節到介面；編輯輸入與原商品保留。讀取旅行失敗的載入狀態仍待另行處理。
- 以同步 ref 鎖阻擋重複送出，finally 釋放；儲存期間停用商品編輯表單，避免關閉／重開表單造成後續輸入被舊請求清空。
- 空商品名稱、不合理數量、負數／非有限單價會在發請求前顯示提示。未登入的雲端商品操作顯示登入提示。
- Chromium 1440px 與 390px 實測：空更新結果不標記已購買、成功重試才更新；403 編輯拒絕保留輸入、重試成功才改標題；雙擊新增只送出一個 POST；503 刪除及空刪除結果保留商品、重試成功才移除。原登入／登出與訪客資料隔離測試亦通過。
- TypeScript、選定檔案 ESLint、production build 通過。完整 app/page.tsx ESLint 仍有 14 個既有 errors／3 warnings，未關閉規則。
- 所有瀏覽器 Auth／REST 回應為攔截的合成資料，沒有實際寫入 Supabase 或寄信。既有 98 項真實 API 測試是另一套已完成驗證，不把兩者混為同一次測試。

這輪沒有實作同一商品的跨裝置樂觀鎖，仍不能防止兩個裝置最後寫入覆蓋。也尚未完成真實收信與重設密碼、連線中斷後不確定是否寫入的自動去重、持續負載及備份還原驗收。修補仍未套用正式網站。


## 讀取失敗與載入狀態續修（2026-10-30）

本機獨立分支 commit e29cd25，累積 patch 已更新。

- Auth getUser 失敗（正常未登入的 AuthSessionMissingError 除外）、旅行查詢／首次建立失敗、商品查詢失敗或讀取例外，都會顯示一般化錯誤和「重新載入／前往登入」。沒有把驗證服務錯誤當作正常訪客啟用商品本機寫入。
- 商品讀取成功前保持載入畫面，runItemAction 也檢查 itemsReady 與 loadError；不再讓尚未載入雲端商品的畫面接受商品寫入。
- 讀取 effect 取消後不再套用晚到的結果；這只防止前端失效結果，不能取消已發生的後端首次旅行建立，也不是跨裝置交易鎖。
- Chromium 1440px、390px 全部通過：旅行 503、商品 503、Auth 400，錯誤頁不顯示舊商品或商品新增操作、不改訪客清單；重試恢復成功。以受控 Promise 延遲商品回應，確認完成前沒有新增或標記購買按鈕。原有登出隱私、商品失敗／重試與雙擊新增檢查亦通過。
- TypeScript 與 production build 通過。app/page.tsx 原有 lint 仍為 14 errors，warnings 目前為 2；尚非 lint 全綠。
- 沒有另外加全域網路逾時；測試覆蓋服務回傳錯誤與讀取例外，永久無回應／斷線回復時序、真實 Auth 工作階段過期、跨分頁換帳號仍待驗證。
- 未推送 souvenir-reminder、未部署正式網站、未修改正式 Supabase／GAS。


## 跨分頁工作階段續修（2026-10-30）

本機分支 commit 62dc08f，累積 patch 含 tests/session-switch.cjs。

- 原頁面只在初次載入驗證 user；另一分頁直接登入不同帳號時，可能保留前一帳號畫面。現在追蹤已驗證的 user id，收到不同帳號 SIGNED_IN／TOKEN_REFRESHED 時立即停用已登入畫面並整頁重載，重新由 Auth 驗證後才讀取新帳號資料。
- SIGNED_OUT 同樣先隱藏舊畫面再導向登入。商品操作也同步檢查 sessionChanging 與已驗證 user id，不等待 React 下一次 render 才阻擋舊帳號操作。
- 同一帳號的 SIGNED_IN 不重載，避免其他分頁重新登入或 session 事件清掉本頁未儲存草稿；onAuthStateChange callback 沒有呼叫其他非同步 Auth API。
- Chromium 1440px、390px 各通過：A 分頁登入、B 分頁直接登入 B 後兩頁只顯示 B 商品；請求中的 owner／trip 必須與 token 帳號一致；B 重新登入不清掉 A 分頁中屬於 B 的未儲存草稿；B 登出時兩頁皆返回登入；Auth /user 回傳合成 401 時不顯示私人商品或新增入口；訪客清單保持原值。
- 原 tests/auth-isolation.cjs 的全部桌機／手機回歸也再次通過；新測試檔 ESLint 與 production build 通過。
- 合成 401 驗證的是服務拒絕工作階段後的前端行為，不是等待真實 JWT 自然過期或實測 refresh-token 撤銷。跨實體裝置、WebKit、長時間斷線和同資料列編輯衝突仍待驗證。
- 本輪沒有變更正式部署、正式資料庫或 GAS。


## Auth callback 續查（2026-10-30）

本機分支 commit 4f2e92c，累積 patch 加入 tests/auth-callback.cjs。

- callback 原本用 origin + next 字串拼接成功登入的目的地。已改成 URL 解析，只接受以單一 / 開頭、不含反斜線或控制字元、且解析後 origin 與本站一致的相對路徑，其餘回首頁；避免 next 參數造成站外返回。
- 缺少 code、不成功的 exchangeCodeForSession、Auth adapter／交換碼發生例外，皆返回 /login?error=auth_callback_error，不把驗證碼或內部錯誤細節放進返回 URL。
- 所有 callback redirect 回應加上 Cache-Control: private, no-store、Pragma: no-cache、Expires: 0，降低帶工作階段回應被共享快取的風險。未自行設定 CDN 平台規則，因此不宣稱已驗證正式 CDN 快取行為。
- 15 個本機案例通過：預設首頁、重設密碼相對路徑與 query/fragment、站外絕對 URL、協定相對 URL、特殊字元／無效路徑、缺碼、Auth 回報錯誤及丟出例外。
- 測試實際轉譯 route.ts handler，只替換 NextResponse.redirect 和 Auth adapter，完全不連網；不代表真實寄信 callback、PKCE cookie 交換或過期碼已完成正式端到端測試。
- TypeScript、callback／測試檔 ESLint 和 production build 通過。未變更正式部署、正式 Supabase 或 GAS。

重跑：node tests/auth-callback.cjs（使用專案既有 TypeScript devDependency）。


## 重設密碼與依賴鎖定續修（2026-10-30）

本機 commits b26da4e、afbdadf，累積 patch 已更新。

- 重設密碼以同步 ref 鎖阻擋重複送出，finally 恢復操作；處理回傳錯誤及例外。錯誤不直接輸出 Auth 內部訊息，無法確認寫入結果時也不宣稱一定沒有更新。
- 成功更新後清空並隱藏密碼欄位，再嘗試登出；若登出失敗，明確說明不能確認登出完整完成，提供前往登入頁。沒有再次送出密碼更新，也不承諾所有裝置既有 JWT 已立即失效。
- 已查閱安裝版本 Auth SDK：signOut 在部分伺服器錯誤時也會先清除本機 session，因此簡單重試 signOut 可能不會再發出伺服器撤銷請求。測試不把本機 session 消失當作全域登出已完成。
- 新 tests/password-reset.cjs 在 1440px、390px 通過：短密碼／兩次不一致不送出請求，422 更新拒絕保留輸入且不洩漏合成內部訊息，連按只送出一個 PUT，更新成功但登出 500 的提示與返回登入，正常更新後登出並導向登入。

### 依賴驗證補正與完整重跑

安裝額外瀏覽器工具時，npm install --no-save 曾把本機 Supabase 套件更新到 supabase-js/auth-js 2.118.0、ssr 0.12.7；package.json／lockfile 沒有變更。先前本機測試在那些版本執行，不能只用最初 npm ci 推定所有後續測試均使用 lockfile 版本。

本輪已重新 npm ci 還原，明確核對 supabase-js/auth-js 2.115.0、ssr 0.12.6 與 lockfile 相符，瀏覽器工具移到專案外，接著完整重跑：

- callback handler 15 案例 PASS。
- password-reset、session-switch、auth-isolation 三套瀏覽器測試各在 1440px、390px PASS。
- 整合入口 tests/run-auth-review.cjs 亦實際執行成功：PASS full isolated Auth review using locked application dependencies。
- 鎖定依賴下的 TypeScript、重設密碼與新測試檔 ESLint、production build PASS。完整專案既有 lint 問題沒有因此被當作已完成。
- 未進行真實寄信、密碼變更、正式 Supabase 寫入或正式部署。

整合入口會先核對核心依賴與 lockfile，拒絕已占用的本機 3100 port，強制假 Supabase URL／key，只啟動 loopback Next.js server，順序跑四套 Auth 檢查，結束關閉 server。各瀏覽器測試攔截所有外部請求。

重跑方式：在應用程式執行 npm ci；在另一個工具目錄安裝 playwright@1.62.1 及瀏覽器，再以 NODE_PATH 指向該工具目錄的 node_modules 執行 node tests/run-auth-review.cjs。不要在應用程式直接 npm install --no-save 測試工具，以免改變實際已安裝依賴。這些測試是合成服務回應的回歸驗證；真實收信／PKCE／自然過期及正式 CDN 行為仍未驗收。


## 同一商品版本衝突續修（2026-10-30）

本機 Next 分支 commit 9c385a6，累積 patch 已更新。僅測試 Supabase xxzchaewtmctplhamwwi 已套用版本欄位；正式資料庫未修改。

### 機制

原 shopping_items 有 updated_at，但沒有更新 trigger。新增 revision bigint，由 BEFORE INSERT OR UPDATE trigger 在新增時固定為 0、更新時取 OLD.revision+1，並更新 updated_at。使用 SECURITY INVOKER、固定空 search_path、撤銷公開呼叫權限；RLS 保持開啟。沒有 SECURITY DEFINER 或伺服器秘密。

CLI migration new 產生 supabase/migrations/20261030151053_shopping_item_revision.sql。已由 execute_sql 在核准測試專案執行，migration 檔為稽核記錄，沒有自動寫入遠端 migration history。正式端須先審查並套用 schema，才能套用 Next 修補；不可直接對未知正式 schema 執行全部 migration。

新版 Next 對標記購買、編輯、刪除加上 id 與 revision 條件。更新回傳必須包含 revision+1，才改動畫面。沒有有效 revision 時拒絕送出。編輯保留開啟表單時的版本；衝突失敗保留輸入並提示重新整理。這是採用版本條件的客戶端保護，舊版／自行呼叫 API 若不帶 revision 條件，仍可依既有 RLS 更新自己的資料，不能宣稱所有舊客戶端都已防覆蓋。

### 已執行

- backend/tests/revision-rollback.sql：以 authenticated 角色和測試使用者 claims 執行，7／7 通過，包括初始版本強制為 0、版本遞增、舊版本更新／刪除零列、新資料保留、無法重設 revision、目前版本刪除成功。全部 ROLLBACK，另查測試旅行殘留 0。
- 既有 SQL RLS 回歸 54／54 通過。確認 RLS=true、trigger 啟用、函式不是 SECURITY DEFINER。
- 鎖定應用依賴的完整 run-auth-review.cjs 通過，含 Chromium 1440px／390px。新增模擬另一裝置先提交較新版：舊編輯被擋、輸入保留、伺服器新值不被覆蓋；重新讀取後以新版本成功儲存。
- TypeScript、測試檔 ESLint、production build 通過。
- security advisor 沒有新增警告；既有洩漏密碼防護仍未啟用：[官方處理說明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。效能 advisor 的缺少外鍵索引建議仍待查詢量測。

### 尚待執行

rls-full-rest.cjs 已加入真實 API 競爭測試：同一帳號兩個並行 PATCH 搶改相同商品版本，預期一個成功、一個零列，接著用舊版本 DELETE 不能刪掉獲勝資料。語法檢查通過，但需更新短效 A／B JWT 並手動執行開發分支 workflow；目前沒有新的實際 HTTP race 成功紀錄，不沿用之前 98 項綠燈。

SQL 測試驗證條件更新語意，瀏覽器測試使用合成回應；兩者不能代替真實並行 API／跨實體裝置驗收。未部署正式網站，也未改 GAS。


## 最新實測補正：真實 API 版本競爭已通過（2026-10-30）

[Workflow 41080683171](https://github.com/Linay-lab/tripin-beta/actions/runs/41080683171)，commit 47e9fa6ab9ca3034f99f60715096d63e3e19bf45，job 124148673697：103 項 PASS、0 項 FAIL。本節取代上文「真實 API race 尚待執行」。

- 同一帳號對同一商品的相同 revision 發出兩個並行 PATCH：恰一個成功、一個回傳零列。
- 獲勝修改的伺服器 revision 增加 1。
- 用舊 revision DELETE 回傳零列，重新讀取確認獲勝商品仍存在且內容相符。
- 2／5／10 worker 短批次均 0 failures，worker p95 分別 1354／1935／1866 ms；每個 worker 包含新增、本人讀取及另一帳號不可讀三個請求。
- 原有兩帳號資料權限、私人照片讀取／簽署、公用 URL 拒絕及全部 fixture 清理檢查也通過。
- 同版本瀏覽器 bot 41079615246 與離線安全檢查 41079615281 success。

這證明核准測試專案本次真實 API 的條件寫入競爭行為；不是跨實體手機、長時間壓力、任意人數正式容量或全面安全認證。新版 Next 修補仍未套用正式網站，正式 schema 未修改，GAS 未變更。正式上線仍需處理既有 lint、真實寄信／PKCE、GAS 防濫用、持續負載、備份還原及正式設定驗收。


## 持續讀取負載：已準備、尚待真實執行（2026-10-30）

backend/tests/bounded-read-soak.cjs 以固定 1／3／5 worker 各 20 秒進行只讀短測試。每個 worker 每次請求後至少暫停 1 秒，測試總請求不超過 200；累積 3 次失敗停止新請求，總計 90 秒後不再啟動請求。已發出的請求仍受原 API helper 15 秒 timeout 限制。這不是長時間 soak、單位時間容量承諾或極限壓力測試。

rls-full-rest.cjs 在既有 fixture 建立後使用 A 讀自己的旅行、B 讀不到 A 旅行的 GET 操作；不寄信、不上傳壓測照片、不對正式 project 請求。記錄每階段請求數、失敗數、p50／p95 API 請求耗時，失敗會使整體測試失敗，finally 仍清理既有 fixture。1 worker 階段只用 A，其餘階段用兩個帳號。

JWT 初始檢查要求至少剩餘 10 分鐘，避免短效憑證在加長的測試和清理期間過期。workflow 仍使用已受保護的 tripin-test-database 環境，沒有更換秘密、增加權限或自動核准。

tests/soak-safety.cjs 的本機離線限制檢查已通過：並行上限、請求數上限、錯誤停止、只接受明確 true、時間截止。已加入離線 CI。語法檢查通過；截至本節寫入時，沒有實際 API 持續負載結果。不能把此前 103 項成功當成本次新增測試已通過。


## 最新實測補正：持續讀取短測試已通過（2026-10-30）

[Workflow 41081617510](https://github.com/Linay-lab/tripin-beta/actions/runs/41081617510)，commit a0d76bd04b75b5885fce0d33bc11d09faf3fede8，job 124151942240：104 項 PASS、0 項 FAIL。本節取代上文「持續讀取尚待真實執行」。

本次 boundedReadSoak 完成全部階段，共 149 次 GET，0 failures，總計 60,718 ms：

| 並行 worker | 帳號數 | 請求 | 失敗 | API p50 | API p95 |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 16 | 0 | 307 ms | 434 ms |
| 3 | 2 | 49 | 0 | 307 ms | 339 ms |
| 5 | 2 | 84 | 0 | 302 ms | 345 ms |

請求同時驗證 A 本人可讀、B 不可讀 A 的旅行。照片權限、同商品版本競爭、原資料隔離及全部 fixture 清理檢查亦通過。同 commit 瀏覽器 bot 41081535250 和安全 guard 41081535249 success。

此為測試專案、固定低請求速率、兩帳號的約一分鐘只讀負載觀察。未涵蓋大量不同使用者、持續寫入、尖峰容量、數小時 soak 或正式環境。結果不能保證任意人數使用不會當機，亦不代表正式網站已部署修正。真實收信／PKCE、GAS 防濫用、備份還原、既有 lint 及正式設定仍待處理。


## 最新補正：既有 lint 已清除（2026-10-30）

本機分支 commit 755feea，累積 patch 更新。本節取代上文多處「14 個既有 errors 尚未完成」。

- 所有 useState 宣告集中在 component 開頭，解決 effect 引用尚未宣告 setter／值的檢查錯誤。
- 將訪客商品／旅行／幣別的初始讀取整合到非同步 Auth 驗證完成流程，只有確定未登入才讀取訪客資料；登入帳號不讀訪客資料。移除重疊的同步 effect 初始化，沒有關閉 React hooks 檢查或用無意義的延遲掩蓋規則。
- 首次雲端旅行建立使用固定初始預設，不從訪客旅行狀態挪用名稱／地點等內容；effect 依賴改為穩定的 Auth user 與 client。內部登入入口使用 Next Link。
- 訪客 JSON／欄位格式不合法時顯示錯誤並保留原 localStorage，不以空預設覆寫損壞資料。
- 完整 npm run lint PASS，0 errors／0 warnings；TypeScript 與 production build PASS。
- 鎖定依賴的四套 Auth review 回歸 PASS；新增損壞商品 JSON 與物件型 tripName 案例後，另重跑 auth-isolation，在 1440px／390px 都確認原資料保留、修復資料後可重試恢復。既有帳號隔離、版本衝突及操作失敗測試亦通過。

所有驗證仍在本機隔離假 Auth／REST 服務或已核准測試專案；沒有把 Next 修補推送到 Vercel 連接的儲存庫，也沒有部署正式站。真實寄信／PKCE、GAS 防濫用、備份還原及正式設定驗收仍待完成；此輪 lint 全綠不能代替這些驗收。


## Google Apps Script 回饋續查（2026-10-30）

已查閱 travel-studio-preview、tripin-beta、souvenir-reminder 的現有檔案；可見回饋前端，但沒有 Apps Script Code.gs／doPost 後端來源。因此無法確認寄信端的輸入驗證、收件者限制、伺服器限流、重送去重、寄信配額及日誌隱私。

### 已完成的前端修補

tripin-beta 開發分支 index.html 新增獨立 feedback-submit-guard，原 feedback-script 本體與 GAS /exec 端點不變，原碼 SHA-256 仍為 775bfbb84c24791fb347930c0d0d11ee5198ffa99de0b929b9dbea8e86be8d74。

- 在 JavaScript 再檢查非空內容、3000 字元內容／200 字元補充上限，避免直接呼叫事件函式繞過 HTML maxlength。
- 送出中以同步旗標拒絕另一筆提交，並停用按鈕；finally 恢復。原本機保存、HTML 跳脫、匯出、刪除及失敗保存流程保留。
- 成功完成 fetch 仍只標記 submitted_unverified，不宣稱已寄信；no-cors 無法驗證後端寄信結果。
- tests/feedback-guard.cjs 本機 Chromium 1440px／390px 通過：超長／空白輸入不發請求，pending 期間只留一筆記錄／一個 POST，網路失敗保留記錄且按鈕可再操作，HTML 跳脫與原碼 hash 保留。
- 所有外部請求皆攔截，沒有寄出真實 Email；GAS 後端與正式端點未變更。測試已加入 Chromium／WebKit CI，此節寫入時新 CI 尚在等待，不能宣稱 WebKit 新測試已通過。

### 後端審查仍缺必要來源

需要目前已測試成功之 Apps Script 專案的 Code.gs（及 doPost 引用的其他程式檔），先移除金鑰、私人收件資訊或其他秘密，再提供。不要提供密碼、JWT 或 service_role key。

審查時需確認：收件者固定在伺服器端、欄位白名單及大小限制、寄信內容／標頭安全、request id 去重與同時請求鎖、伺服器端濫用限制、寄信配額與失敗記錄、回應不洩漏內部資訊。前端 pending 旗標、maxlength 或 honeypot 都可被直接 HTTP 請求繞過，不是伺服器防濫用驗收。

在取得來源前不改正式 GAS，不向正式端點做壓力測試，也不宣稱「回饋防垃圾信已完成」。


## 最新補正：回饋跨瀏覽器 CI 已完成（2026-10-30）

[Workflow 41083958337](https://github.com/Linay-lab/tripin-beta/actions/runs/41083958337)，commit 26177981ee80521e0c6316caf10156de4cfb46af：desktop-chromium（job 124160418852）、mobile-chromium（124160419345）、mobile-webkit（124160419365）全部 success，各 job 的 Verify feedback submission guards without sending email 步驟皆 success。本節取代上文「新回饋 CI 等待中」。全程攔截 GAS 請求，沒有寄信；後端防濫用仍缺 Code.gs，未驗收。

備份與還原計畫已另存 [BACKUP-RESTORE-PLAN.md](BACKUP-RESTORE-PLAN.md)。僅唯讀確認核准測試 project 的 8 個業務表 RLS 全開，collection-photos／trip-covers 為 private，兩桶目前皆 0 個物件。這不是備份檔驗證，更不是照片還原演練。

未取得目前可用備份清單、照片的獨立檔案備份或隔離還原目標，故沒有實際 restore、沒有開新付費 project，也沒有動正式資料。依官方文件確認 DB 備份不含 Storage 實體檔案，完整復原須分開規劃。

下階段必要資料：現行成功 GAS Code.gs（移除秘密）；Supabase Database → Backups 的備份狀態／日期，以及獨立還原目標。請勿在目前正式／共用測試 project 直接按 Restore。


## GAS 原始碼已取得並完成候選審查（2026-10-31）

使用者已提供現行 Code.gs；本節取代上文「缺 Code.gs，無法審查」狀態。原版與候選版、39 項模擬測試、型別檢查及操作說明已保存於 [gas-feedback](gas-feedback/README.md)。

候選保留既有前端參數、固定收件者 Script Property 及回饋表前 8 欄，新增持久化狀態表查重、全域流量預算、寄信配額檢查、輸入白名單／長度、公式跳脫與 URL query／fragment 移除。寄信或提交結果不明不自動重寄，不宣稱 exactly-once 投遞。原版風險由原碼確認；本輪模擬的是候選對應的失敗處理，不是舊部署實測。

本機 39／39 模擬測試與 Apps Script API 宣告型別檢查通過；依賴公告檢查未發現漏洞。新增 CI 只使用模擬 Google 服務，不連線、不寄信、不寫入試算表或部署。實際 Google 執行環境、OAuth 授權、配額、真實收信仍未驗收。

提供 feedbackReviewSetup 手動唯讀設定檢查，輸出布林值，不寄信、不建表、不改計數。下一步應在獨立 Google 測試專案驗證，正式版本維持不變。

匿名來源／honeypot 可被偽造，基本全域限制也可能被濫用耗盡；候選不是完整 DoS 防護。原 no-cors 前端仍無法讀取後端狀態，submitted_unverified 不能當作接收或寄信成功。完整範圍與測試前置見 README。
