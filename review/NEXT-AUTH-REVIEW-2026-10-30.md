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
