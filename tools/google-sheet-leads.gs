/** @OnlyCurrentDoc */
/*
 * Glabol Kashmir landing page → Google Sheet
 * Every enquiry becomes a row in the sheet, and you get an email alert for each one.
 * The thank-you page then asks 3 qualifying questions; the answers and a lead quality
 * (Hot / Warm / Cold) are added to the same row.
 *
 * ONE-TIME SETUP (about 5 minutes)
 *  1. Open sheets.new and name the sheet "Glabol Kashmir Leads".
 *  2. Extensions → Apps Script. Delete the sample code, paste this whole file, click Save.
 *  3. Pick "setup" in the function list at the top and click Run.
 *     Google asks for permission: Review permissions → your account → Advanced →
 *     "Go to Untitled project (unsafe)" → Allow. ("Unsafe" only means Google hasn't
 *     reviewed your own script.) The sheet gets its header row.
 *  4. Deploy → New deployment → gear icon → Web app.
 *       Execute as: Me        Who has access: Anyone
 *     Click Deploy and copy the Web app URL (it ends in /exec).
 *  5. That URL goes into FORM_ENDPOINT at the top of site.js.
 *
 * CHANGING THIS SCRIPT LATER: paste the new version, Save, then Deploy → Manage deployments →
 * pencil icon → Version: "New version" → Deploy. The web app URL stays the same.
 * (Don't use "New deployment": that makes a new URL.)
 */

const EMAIL_ALERTS = true;       // email the sheet owner about every new lead
const EXTRA_ALERT_EMAILS = "";   // more people to alert, comma-separated, e.g. "sales@glabol.com"
const CRM_WEBHOOK_URL = "";      // later: your CRM / Zapier / Make webhook; each lead is also sent there
const SHEET_NAME = "Leads";
const TIME_ZONE = "Asia/Kolkata";
const TIMESTAMP_FORMAT = "dd mmm yyyy, h:mm am/pm";

// Sheet header → field sent by the landing page. Rows are matched to headers by name, so you
// can reorder these columns or add your own (e.g. "Status", "Notes") in the sheet. Any of these
// that are missing are added on the right, so hide a column instead of deleting it.
const COLUMNS = [
  ["Timestamp", "timestamp"],
  ["Name", "name"],
  ["Phone", "phone"],
  ["Travel month", "month"],
  ["Travellers", "group_size"],
  ["Lead quality", "lead_quality"],     // Hot / Warm / Cold / Partial / Not answered
  ["Budget fit", "budget_fit"],
  ["Booking timeline", "booking_timeline"],
  ["Best time to call", "call_time"],
  ["Source", "source"],
  ["Medium", "medium"],
  ["Campaign ID", "campaign_id"],
  ["Adset ID", "adset_id"],             // Google Ads: the ad group ID
  ["Ad ID", "ad_id"],
  ["Keyword", "keyword"],
  ["GCLID", "gclid"],                   // for importing offline conversions into Google Ads later
  ["Landing page", "landing_url"],
  ["Form", "form_location"],            // hero = top form, final = bottom form
  ["Lead ID", "lead_id"],               // links the thank-you page answers to this row
];

// What the thank-you page can send, and the only values accepted for each.
// They must match the button values in thank-you.html.
const ANSWERS = {
  budget_fit: ["Fits", "A bit high, but open", "Too high"],
  booking_timeline: ["This week", "In 2-4 weeks", "Just exploring"],
  call_time: ["Morning", "Afternoon", "Evening", "Anytime"],
  lead_quality: ["Hot", "Warm", "Cold", "Partial"],
};
const LEAD_ID = /^[0-9a-f-]{32,36}$/i;

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.type === "qualify") return saveAnswers_(p);

  const lead = { timestamp: new Date() };
  COLUMNS.forEach(([, key]) => {
    if (key !== "timestamp" && !(key in ANSWERS)) lead[key] = String(p[key] || "").trim().slice(0, 500);
  });
  if (!LEAD_ID.test(lead.lead_id)) lead.lead_id = "";
  lead.lead_quality = "Not answered";   // filled in once they answer on the thank-you page

  // Only accept what the page sends: a name and a valid Indian mobile. Keeps bots and junk out.
  if (lead.name.length < 2 || !/^\+91[6-9]\d{9}$/.test(lead.phone)) return text_("rejected");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = leadSheet_();
    const headers = ensureColumns_(sheet);
    sheet.appendRow(headers.map((header) => cellValue_(lead, header)));
    const tsCol = headers.indexOf("Timestamp");
    if (tsCol >= 0) sheet.getRange(sheet.getLastRow(), tsCol + 1).setNumberFormat(TIMESTAMP_FORMAT);
  } finally {
    lock.releaseLock();
  }

  if (EMAIL_ALERTS) sendAlert_(lead);
  if (CRM_WEBHOOK_URL) forwardToCrm_(lead);
  return text_("ok");
}

// Thank-you page answers: update the lead's row. Only the answer and quality cells are
// written, never the name or phone, and only with the exact values in ANSWERS.
function saveAnswers_(p) {
  const id = String(p.lead_id || "");
  const seq = Number(p.seq);
  const answers = {};
  Object.keys(ANSWERS).forEach((key) => { if (ANSWERS[key].includes(p[key])) answers[key] = p[key]; });
  if (!LEAD_ID.test(id) || !(seq >= 1) || !Object.keys(answers).length) return text_("rejected");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // The page sends the answers after every tap; ignore one that arrives after a newer one
    const cache = CacheService.getScriptCache();
    if (Number(cache.get("seq:" + id) || 0) >= seq) return text_("stale");

    const sheet = leadSheet_();
    const headers = ensureColumns_(sheet);
    const rows = sheet.getLastRow() - 1;
    const found = rows > 0 && sheet.getRange(2, headers.indexOf("Lead ID") + 1, rows, 1)
      .createTextFinder(id).matchEntireCell(true).findNext();
    if (!found) return text_("not found");

    Object.keys(answers).forEach((key) => {
      sheet.getRange(found.getRow(), headers.indexOf(headerOf_(key)) + 1).setValue(answers[key]);
    });
    cache.put("seq:" + id, String(seq), 21600);
  } finally {
    lock.releaseLock();
  }
  return text_("ok");
}

// Opening the web app URL in a browser shows this, so you can check the URL is right.
function doGet() {
  return text_("Glabol lead form endpoint is running.");
}

// Run once from the editor (step 3): asks for permissions and prepares the sheet.
// Running it again on an existing sheet adds any new columns.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TIME_ZONE);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.setName(SHEET_NAME);
    else sheet = ss.insertSheet(SHEET_NAME);
  }
  ensureColumns_(sheet);
  MailApp.getRemainingDailyQuota();   // makes Google ask for the email permission now
  ss.toast("Sheet is ready. Next: Deploy → New deployment → Web app.", "Glabol leads", 10);
}

// Optional: run from the editor to add a sample row and send yourself a sample alert.
function testLead() {
  doPost({ parameter: {
    name: "Test lead (delete me)", phone: "+919876543210", month: "Nov 2026", group_size: "2",
    source: "google", medium: "cpc", campaign_id: "1234567890", adset_id: "2345678901", ad_id: "3456789012",
    keyword: "kashmir backpacking trip", form_location: "hero", landing_url: "https://kashmir.glabol.com/",
    lead_id: "00000000-0000-4000-8000-000000000000",
  } });
}

function leadSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

// The header row, after adding any of COLUMNS that are missing (e.g. new ones after an update)
function ensureColumns_(sheet) {
  if (sheet.getLastRow() === 0) {
    writeHeaders_(sheet);
    return COLUMNS.map(([name]) => name);
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = COLUMNS.map(([name]) => name).filter((name) => !headers.includes(name));
  if (missing.length) {
    styleHeader_(sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]));
    headers.push(...missing);
  }
  return headers;
}

function writeHeaders_(sheet) {
  const names = COLUMNS.map(([name]) => name);
  styleHeader_(sheet.getRange(1, 1, 1, names.length).setValues([names]));
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, names.length, 130);
  sheet.setColumnWidth(names.indexOf("Timestamp") + 1, 170);
  sheet.setColumnWidth(names.indexOf("Name") + 1, 170);
  sheet.setColumnWidth(names.indexOf("Landing page") + 1, 320);
}

function styleHeader_(range) {
  range.setFontWeight("bold").setBackground("#14251C").setFontColor("#FFFFFF");
}

function headerOf_(key) {
  return COLUMNS.find(([, k]) => k === key)[0];
}

function cellValue_(lead, header) {
  const column = COLUMNS.find(([name]) => name === header);
  if (!column) return "";                       // one of your own columns: left empty
  const value = lead[column[1]];
  if (value instanceof Date) return value;
  // Stored as plain text: keeps "+91…" intact and stops anyone injecting a formula
  return value ? "'" + value : "";
}

function text_(message) {
  return ContentService.createTextOutput(message);
}

function sendAlert_(lead) {
  try {
    const to = [Session.getEffectiveUser().getEmail(), EXTRA_ALERT_EMAILS].filter(Boolean).join(",");
    const when = Utilities.formatDate(lead.timestamp, TIME_ZONE, "d MMM yyyy, h:mm a");
    const body = [
      `Name: ${lead.name}`,
      `Phone: ${lead.phone}`,
      `WhatsApp: https://wa.me/${lead.phone.replace(/\D/g, "")}`,
      `Travel month: ${lead.month}`,
      `Travellers: ${lead.group_size}`,
      "",
      `Source / Medium: ${lead.source} / ${lead.medium}`,
      `Campaign ID: ${lead.campaign_id || "-"}`,
      `Adset ID: ${lead.adset_id || "-"}`,
      `Ad ID: ${lead.ad_id || "-"}`,
      `Keyword: ${lead.keyword || "-"}`,
      "",
      `Received: ${when}`,
      `Lead quality and answers appear in the sheet if they answer the questions on the thank-you page.`,
      `All leads: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`,
    ].join("\n");
    MailApp.sendEmail({ to, subject: `New Kashmir lead: ${lead.name} (${lead.month})`, body, name: "Glabol leads" });
  } catch (err) {
    // e.g. Gmail's daily limit (100 alerts a day on a free account). The lead is already saved.
    console.error("Email alert failed", err);
  }
}

function forwardToCrm_(lead) {
  try {
    UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ ...lead, timestamp: lead.timestamp.toISOString() }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error("CRM forward failed", err);   // the lead is already safe in the sheet
  }
}
