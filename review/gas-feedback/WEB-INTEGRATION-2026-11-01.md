# Feedback integration review — 2026-11-01

## Actual Google sandbox evidence supplied by the tester
- Apps Script setup booleans passed, readError false.
- Editor submission: OK; repeated same payload: DUPLICATE. Tester confirmed email received and one data row with SENT.
- Independent native HTML HTTP form: response OK; a second distinct data row is visible; both ledger rows SENT, blank error codes. Tester confirmed email received.
- These establish actual test-endpoint/Sheets/mail delivery for those submissions, not the production endpoint or all runtime failures.

## Original-form isolated copy
Run `node review/gas-feedback/build-web-sandbox.cjs` from the repo root. Output is `review/gas-feedback/web-sandbox.html` (downloadable local review artifact, no hosting deployed).
- Reads current index.html; does not overwrite it.
- Changes endpoint to the explicitly provided Google test deployment.
- Replaces travel-studio local storage namespace with gas-review-sandbox for isolation.
- Uses a fixed synthetic website value to support opening the HTML from disk; this field does not authenticate an origin.
- Shows a review notice and retains original form, input guard, export/history and no-cors unverified-delivery wording.
- Only synthetic feedback should be entered. Clicking submit sends a real notification to the configured test recipient.

## Automated browser evidence
`tests/feedback-sandbox.cjs`: PASS on desktop Chromium 1440x900 and mobile-sized Chromium 390x844. All external requests intercepted; no mail sent.
Verified test endpoint and parameter website/page/trap, URL-encoded POST, blank/length limits, pending submission lock, local retention, unverified delivery status, failed-network indication and HTML escaping.
Command in this environment: `NODE_PATH=/tmp/tripin-browser-tools/node_modules:$CODEX_PRIMARY_RUNTIME_NODE_MODULES USE_BUNDLED_CHROMIUM=1 CHROMIUM_PATH=/tmp/chromium node tests/feedback-sandbox.cjs`.
Browser: Chromium 143 supplied by @sparticuz/chromium 143.0.4; Playwright provided by runtime. Standard Playwright browser download failed with a truncated zip; fallback executable passed both viewport suites.

## Remaining limits
Mobile-sized Chromium is not actual iOS/WebKit hardware. The tester subsequently opened the generated isolated copy, submitted “原網站表單整合測試” using the original feedback UI and confirmed receiving its email on 2026-11-01. This is a manual desktop delivery confirmation; no subsequent Sheet screenshot or real mobile delivery evidence was supplied. no-cors cannot expose endpoint status, including INVALID/RATE_LIMIT; users must verify via Sheets/mail. No load or hostile-input traffic was sent to the public Google endpoint. This is not an assurance of unlimited concurrency or absence of vulnerabilities.

Main and production endpoint were not modified; no production database changes or website deployment performed.

## Follow-up regression run
2026-11-01 local original Beta checkout: tests/full-site.cjs passed all 18 groups on desktop Chromium and all 18 on mobile Chromium. Covers simulated Auth, collection/search, shopping states, itinerary/wallet, images/covers, import/export validation, injection cases, quota rollback, stale tabs, corrupt storage preservation and feedback retention. GPS suite from travel-studio-preview/tests/gps-reminders.cjs was executed against tripin-beta/index.html by changing only the input file path in a temporary runner: desktop and mobile Chromium passed all listed GPS checks, including grouped unpurchased items, distance, accuracy, stale fixes, cooldown, exit/re-entry, purchase updates, permission denial and emulated coordinates. All network requests intercepted. Mobile WebKit NOT RUN (binary unavailable). These checks do not prove actual phone GPS accuracy, locked-screen delivery, live database authorization or production capacity. Main and production remain unchanged.
