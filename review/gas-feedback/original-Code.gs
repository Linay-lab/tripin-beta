/**
 * 旅購 Travel Studio 回饋接收端（Google Apps Script）
 * 1. 在綁定的 Google 試算表中：擴充功能 > Apps Script
 * 2. 將本檔貼入 Code.gs
 * 3. 在專案設定 > 指令碼屬性設定 NOTIFY_EMAIL = 你的接收信箱
 * 4. 部署 > 新增部署 > 網頁應用程式
 *    執行身分：我；存取權：所有人
 * 5. 複製 /exec URL 貼入 HTML 的 FEEDBACK_ENDPOINT
 */
const HEADERS=['收到時間','回饋ID','頁面','類型','建議內容','補充','填寫時間','網站來源'];
function doPost(e) {
  const p=(e&&e.parameter)||{};
  if(p.trap) return ContentService.createTextOutput('OK');
  const id=String(p.id||'').slice(0,100);
  const content=String(p.content||'').trim().slice(0,3000);
  const page=String(p.page||'').slice(0,100);
  const kind=String(p.kind||'').slice(0,80);
  const extra=String(p.extra||'').slice(0,200);
  const createdAt=String(p.createdAt||'').slice(0,80);
  const website=String(p.website||'').slice(0,300);
  if(!id||!content) return ContentService.createTextOutput('INVALID');
  const email=PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if(!email) throw new Error('尚未設定 NOTIFY_EMAIL');
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    if(!ss) throw new Error('請從 Google 試算表的擴充功能建立 Apps Script');
    let sh=ss.getSheetByName('旅購回饋');
    if(!sh){sh=ss.insertSheet('旅購回饋');sh.appendRow(HEADERS)}
    const cache=CacheService.getScriptCache();
    const cacheKey='feedback_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,id)).slice(0,45);
    if(cache.get(cacheKey)) return ContentService.createTextOutput('DUPLICATE');
    // 避免試算表公式注入
    const safe = v => ['=', '+', '-', '@'].includes(String(v).charAt(0)) ? "'" + v : v;
    sh.appendRow([new Date(),safe(id),safe(page),safe(kind),safe(content),safe(extra),safe(createdAt),safe(website)]);
    cache.put(cacheKey,'1',21600);
  } finally {lock.releaseLock()}
  MailApp.sendEmail({
    to:email,
    subject:'【旅購】新回饋｜'+kind+'｜'+page,
    body:['收到新的旅購測試回饋','', '頁面：'+page,'類型：'+kind,'內容：',content,'','補充：'+extra,'填寫時間：'+createdAt,'網站：'+website].join('\\n')
  });
  return ContentService.createTextOutput('OK');
}
