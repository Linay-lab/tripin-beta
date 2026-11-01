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
Mobile-sized Chromium is not actual iOS/WebKit hardware. This run does not establish original website form to real Google deployment delivery; that manual isolated-copy step is pending. no-cors cannot expose endpoint status, including INVALID/RATE_LIMIT; users must verify via Sheets/mail. No load or hostile-input traffic was sent to the public Google endpoint. This is not an assurance of unlimited concurrency or absence of vulnerabilities.

Main and production endpoint were not modified; no production database changes or website deployment performed.
