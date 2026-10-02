/**
 * Kashmir landing page → Google Sheet (+ email, + CRM later)
 *
 * Setup (5 minutes):
 *  1. Create a Google Sheet called "Kashmir leads".
 *  2. Extensions → Apps Script. Delete what's there and paste this whole file.
 *  3. Set NOTIFY_EMAIL below. Save.
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as: Me    Who has access: Anyone
 *     Approve the permissions prompt, then copy the Web app URL.
 *  5. Put that URL in FORM_ENDPOINT at the top of main.js.
 *
 * Changing this script later: Deploy → Manage deployments → edit (pencil) →
 * Version: "New version" → Deploy. That keeps the same URL.
 */

const NOTIFY_EMAIL = "you@example.com";   // where new-lead emails go ("" to turn off)
const CRM_WEBHOOK_URL = "";               // later: your CRM / Zapier / Make webhook

const COLUMNS = [
  "submitted_at", "name", "phone", "month", "group_size", "form_location",
  "gclid", "gbraid", "wbraid",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "landing_url",
];

function doPost(e) {
  const lead = {};
  COLUMNS.forEach((c) => { lead[c] = String((e.parameter || {})[c] || "").slice(0, 500); });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
    sheet.appendRow(COLUMNS.map((c) => asText(lead[c])));
  } finally {
    lock.releaseLock();
  }

  if (NOTIFY_EMAIL) {
    MailApp.sendEmail(
      NOTIFY_EMAIL,
      `New Kashmir lead: ${lead.name} (${lead.month})`,
      COLUMNS.map((c) => `${c}: ${lead[c]}`).join("\n")
    );
  }

  if (CRM_WEBHOOK_URL) {
    try {
      UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(lead),
        muteHttpExceptions: true,
      });
    } catch (err) {
      console.error("CRM forward failed", err);   // the lead is already safe in the Sheet
    }
  }

  return ContentService.createTextOutput("ok");
}

// Store everything as plain text: keeps "+91…" numbers intact and stops
// anyone from injecting a spreadsheet formula through the form.
function asText(value) {
  return value === "" ? "" : "'" + value;
}
