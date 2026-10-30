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
