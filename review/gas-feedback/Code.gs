/** Review candidate only. Do not deploy before sandbox verification. */
var FEEDBACK_HEADERS_ = ['收到時間','回饋ID','頁面','類型','建議內容','補充','填寫時間','網站來源'];
var FEEDBACK_LEDGER_HEADERS_ = ['回饋ID','內容摘要','狀態','回饋列','更新時間','錯誤代碼'];
var FEEDBACK_PAGES_ = ['首頁','我的旅行','旅行總覽','購物清單','行程規劃','旅行錢包','旅行資訊','收藏庫','個人中心'];
var FEEDBACK_KINDS_ = ['改善建議','操作問題','畫面排版','功能需求','其他'];

function feedbackText_(value) { return ContentService.createTextOutput(value); }
function feedbackSafeCell_(value) {
  var text = String(value);
  return /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
}
function feedbackUrl_(value) {
  // Explicit parsing avoids depending on browser URL APIs in Apps Script.
  if (/[\u0000-\u0020\u007f]/.test(value)) return null;
  var match = /^https:\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?(\/[^\\\r\n]*)?$/i.exec(value);
  if (!match || (match[2] && (+match[2] < 1 || +match[2] > 65535))) return null;
  var origin = 'https://' + match[1].toLowerCase() + (match[2] && match[2] !== '443' ? ':' + match[2] : '');
  return { origin: origin, clean: origin + (match[3] || '/').split(/[?#]/)[0] };
}
function feedbackLimit_(props, key, fallback, maximum) {
  var raw = props.getProperty(key);
  if (raw === null || raw === '') return fallback;
  if (!/^[1-9][0-9]*$/.test(raw) || +raw > maximum) throw new Error('CONFIG');
  return +raw;
}
function feedbackFindRow_(sheet, column, id) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var found = sheet.getRange(2, column, last - 1, 1).createTextFinder(id)
    .matchEntireCell(true).matchCase(true).useRegularExpression(false).findNext();
  return found ? found.getRow() : 0;
}
function feedbackSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(headers); return sheet; }
  if (!sheet.getLastRow()) { sheet.appendRow(headers); return sheet; }
  var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (headers.some(function(value, index) { return actual[index] !== value; })) throw new Error('HEADERS');
  return sheet;
}
function feedbackState_(ledger, row, id, digest, state, feedbackRow, code) {
  ledger.getRange(row, 1, 1, 6).setValues([[id, digest, state, feedbackRow || '', new Date(), code || '']]);
  SpreadsheetApp.flush();
}
function feedbackAdmit_(props, minuteLimit, dayLimit) {
  var now = Date.now(), minute = Math.floor(now / 60000), day = Utilities.formatDate(new Date(now), 'UTC', 'yyyy-MM-dd');
  var raw = props.getProperty('TS_FEEDBACK_RATE_V2');
  var rate = raw ? JSON.parse(raw) : { minute: minute, minuteCount: 0, day: day, dayCount: 0 };
  if (!rate || !Number.isSafeInteger(rate.minuteCount) || rate.minuteCount < 0 ||
      !Number.isSafeInteger(rate.dayCount) || rate.dayCount < 0 ||
      !Number.isSafeInteger(rate.minute) || typeof rate.day !== 'string') throw new Error('RATE_STATE');
  if (rate.minute !== minute) { rate.minute = minute; rate.minuteCount = 0; }
  if (rate.day !== day) { rate.day = day; rate.dayCount = 0; }
  if (rate.minuteCount >= minuteLimit || rate.dayCount >= dayLimit) return false;
  rate.minuteCount++; rate.dayCount++;
  props.setProperty('TS_FEEDBACK_RATE_V2', JSON.stringify(rate));
  return true;
}

function doPost(e) {
  var lock, locked = false, ledger, ledgerRow = 0, digest = '', id = '', feedbackRow = 0, sending = false;
  try {
    var p = e && e.parameter || {};
    if (p.trap) return feedbackText_('OK');
    var allowed = ['id','page','kind','content','extra','createdAt','website','trap'];
    if (Object.keys(p).some(function(key) { return allowed.indexOf(key) < 0; })) return feedbackText_('INVALID');
    if (e && e.parameters && Object.keys(e.parameters).some(function(key) { return e.parameters[key].length !== 1; })) return feedbackText_('INVALID');
    if (e && e.postData) {
      if (e.postData.type && !/^application\/x-www-form-urlencoded(?:;|$)/i.test(e.postData.type)) return feedbackText_('INVALID');
      if (+e.postData.length > 65536 || String(e.postData.contents || '').length > 65536) return feedbackText_('INVALID');
    }
    id = String(p.id || '');
    var content = String(p.content || ''), extra = String(p.extra || '');
    var page = String(p.page || '').trim(), kind = String(p.kind || '').trim();
    var createdAt = String(p.createdAt || ''), website = String(p.website || '');
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(id) || !content.trim() || content.length > 3000 || extra.length > 200 ||
        FEEDBACK_PAGES_.indexOf(page) < 0 || FEEDBACK_KINDS_.indexOf(kind) < 0 || website.length > 300 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) || isNaN(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) return feedbackText_('INVALID');
    content = content.trim(); extra = extra.trim();
    var url = feedbackUrl_(website);
    if (!url) return feedbackText_('INVALID');
    var props = PropertiesService.getScriptProperties();
    var email = String(props.getProperty('NOTIFY_EMAIL') || '').trim();
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) return feedbackText_('CONFIG_ERROR');
    var origins = String(props.getProperty('ALLOWED_ORIGINS') || 'https://linay-lab.github.io,https://souvenir-reminder.vercel.app').split(/[,\n]/).map(function(value) {
      var parsed = feedbackUrl_(value.trim());
      if (!parsed || (parsed.clean !== parsed.origin + '/' && parsed.clean !== parsed.origin)) throw new Error('CONFIG');
      return parsed.origin;
    });
    if (origins.indexOf(url.origin) < 0) return feedbackText_('INVALID');
    var minuteLimit = feedbackLimit_(props, 'MAX_PER_MINUTE', 5, 100);
    var dayLimit = feedbackLimit_(props, 'MAX_PER_DAY', 50, 1000);
    digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify([page,kind,content,extra,createdAt,url.clean]), Utilities.Charset.UTF_8));

    lock = LockService.getScriptLock();
    locked = lock.tryLock(5000);
    if (!locked) return feedbackText_('BUSY');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return feedbackText_('CONFIG_ERROR');
    var sheet = feedbackSheet_(ss, '旅購回饋', FEEDBACK_HEADERS_);
    ledger = feedbackSheet_(ss, '旅購回饋狀態', FEEDBACK_LEDGER_HEADERS_);
    ledgerRow = feedbackFindRow_(ledger, 1, id);
    if (ledgerRow) {
      var previous = ledger.getRange(ledgerRow, 1, 1, 6).getValues()[0];
      // Never automatically retry an ambiguous or previously accepted mail attempt.
      return feedbackText_(previous[1] && previous[1] !== digest ? 'CONFLICT' : 'DUPLICATE');
    }
    var legacyRow = feedbackFindRow_(sheet, 2, id);
    if (legacyRow) {
      ledger.appendRow([id,'','LEGACY_RECORDED',legacyRow,new Date(),'']);
      SpreadsheetApp.flush();
      return feedbackText_('DUPLICATE');
    }
    if (!feedbackAdmit_(props, minuteLimit, dayLimit)) return feedbackText_('RATE_LIMIT');
    ledger.appendRow([id,digest,'RESERVED','',new Date(),'']);
    ledgerRow = ledger.getLastRow();
    SpreadsheetApp.flush();
    sheet.appendRow([new Date(),id,feedbackSafeCell_(page),feedbackSafeCell_(kind),feedbackSafeCell_(content),feedbackSafeCell_(extra),feedbackSafeCell_(createdAt),feedbackSafeCell_(url.clean)]);
    feedbackRow = feedbackFindRow_(sheet, 2, id);
    feedbackState_(ledger, ledgerRow, id, digest, 'RECORDED', feedbackRow, '');
    if (MailApp.getRemainingDailyQuota() < 1) {
      feedbackState_(ledger, ledgerRow, id, digest, 'QUOTA_BLOCKED', feedbackRow, 'QUOTA');
      return feedbackText_('RECORDED_NO_EMAIL');
    }
    feedbackState_(ledger, ledgerRow, id, digest, 'SENDING', feedbackRow, '');
    sending = true;
    MailApp.sendEmail({
      to: email,
      subject: '【旅購】新回饋｜' + kind + '｜' + page,
      body: ['收到新的旅購測試回饋','','頁面：'+page,'類型：'+kind,'內容：',content,'','補充：'+extra,'填寫時間：'+createdAt,'網站：'+url.clean].join('\n')
    });
    feedbackState_(ledger, ledgerRow, id, digest, 'SENT', feedbackRow, '');
    return feedbackText_('OK');
  } catch (error) {
    if (ledger && ledgerRow) {
      try { feedbackState_(ledger, ledgerRow, id, digest, sending ? 'SEND_UNCERTAIN' : feedbackRow ? 'RECORDED_NO_EMAIL' : 'WRITE_FAILED', feedbackRow, sending ? 'MAIL_OR_COMMIT' : feedbackRow ? 'CHECK_OR_WRITE' : 'WRITE'); } catch (ignored) {}
    }
    // Do not return or log form contents, recipient addresses, codes, or raw service errors.
    return feedbackText_('ERROR');
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** Run manually in the Apps Script editor. Reads setup only; sends no email. */
function feedbackReviewSetup() {
  var report = { recipientConfigured: false, boundSpreadsheet: false, headersCompatible: false,
    originConfigurationValid: false, rateConfigurationValid: false, mailQuotaAvailable: false, readError: false };
  try {
    var props = PropertiesService.getScriptProperties();
    report.recipientConfigured = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(props.getProperty('NOTIFY_EMAIL') || '').trim());
    var raw = String(props.getProperty('ALLOWED_ORIGINS') || 'https://linay-lab.github.io,https://souvenir-reminder.vercel.app');
    report.originConfigurationValid = raw.split(/[,\n]/).every(function(value) {
      var parsed = feedbackUrl_(value.trim()); return !!parsed && parsed.clean === parsed.origin + '/';
    });
    feedbackLimit_(props, 'MAX_PER_MINUTE', 5, 100);
    feedbackLimit_(props, 'MAX_PER_DAY', 50, 1000);
    report.rateConfigurationValid = true;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    report.boundSpreadsheet = !!ss;
    report.headersCompatible = !!ss && [{name:'旅購回饋',headers:FEEDBACK_HEADERS_}, {name:'旅購回饋狀態',headers:FEEDBACK_LEDGER_HEADERS_}].every(function(item) {
      var sheet = ss.getSheetByName(item.name);
      if (!sheet || !sheet.getLastRow()) return true;
      var actual = sheet.getRange(1,1,1,item.headers.length).getValues()[0];
      return item.headers.every(function(value,index) { return value === actual[index]; });
    });
    report.mailQuotaAvailable = MailApp.getRemainingDailyQuota() > 0;
  } catch (ignored) { report.readError = true; }
  // Boolean setup results only; no email address, form contents, or sheet IDs.
  console.log(JSON.stringify(report));
  return report;
}
