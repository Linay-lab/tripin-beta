// Generate a review-only copy; never overwrite index.html or deploy it.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const old="https://script.google.com/macros/s/AKfycbygoHggwPaGyQQ-EwlzgG_Y1KxkeeFqhj3zR34I2z25NHtdlBW6vObMvpu3b9zSClRD/exec";
assert.equal(source.split(old).length,2);
const html=source.replace(old,'https://script.google.com/macros/s/AKfycbw54QHXrG6OzQgkiHnVnlXwmP-tx0O2ZqcV0MV0UrXZ4XHz3QeQkz7Pylxjajz0gMkq/exec')
.replaceAll('travel-studio','gas-review-sandbox')
.replace('website:location.href',"website:'https://linay-lab.github.io/tripin-beta/'")
.replace('<body>','<body><aside style="padding:12px;background:#fff0c2;color:#382900">獨立回饋測試版：送出回饋會寄到測試信箱。本機資料使用獨立空間；網站來源為合成測試值。請勿輸入真實個資。</aside>');
assert(!html.includes(old));
fs.writeFileSync(path.join(__dirname,'web-sandbox.html'),html);
console.log('Generated review/gas-feedback/web-sandbox.html');
