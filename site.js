/* =========================================================
   Glabol trip pages — shared by every page: settings, sending
   leads to the sheet, and the events Google Tag Manager listens for
   ========================================================= */

// ---- Settings: edit these -------------------------------------------------
// Where leads are sent. Leave empty to test the flow (logs the lead to the
// console and goes to the thank-you page). Works with a Google Apps Script
// web app URL, Web3Forms, Formspree, or any CRM / Zapier / Make webhook.
const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbwYnAfwqPfea57MW3LadpPw1Yg-5xLaTna93DhnYOvCp25B4wu8R7pwIYbnUkKYeakj/exec";
// Extra fields some services need, e.g. { access_key: "..." } for Web3Forms.
const FORM_EXTRA_FIELDS = {};
const THANK_YOU_URL = "thank-you.html";
// Glabol CRM: every lead is also posted here. Its CORS accepts *.glabol.com pages only.
const CRM_WEBHOOK_URL = "https://crm.glabol.com/api/webhooks/leads/intake?secret=xq6z371n9a";
const CRM_API_KEY = "xq6z371n9a";
const DESTINATION = "Kashmir";   // change per destination page

// ---------------------------------------------------------------------------

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function store(key, value) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
  } catch (e) { /* storage blocked: carry on without it */ }
  return null;
}

// The enquiry made in this tab: { id, firstName, phoneDigits, ... }, shared with the thank-you page
function readLead() {
  try { return JSON.parse(store("bk_lead") || "null"); } catch (e) { return null; }
}
function saveLead(lead) { store("bk_lead", JSON.stringify(lead)); }

async function postToSheet(payload) {
  if (!FORM_ENDPOINT) {
    console.info("[Glabol] FORM_ENDPOINT is empty. Not sent:", payload);
    return;
  }
  // URL-encoded: what Apps Script reads into e.parameter, and accepted by every form service.
  // keepalive lets the request finish even if the visitor leaves the page straight after.
  const body = new URLSearchParams({ ...FORM_EXTRA_FIELDS, ...payload });
  // Apps Script web apps don't return CORS headers, so the response can't be read
  if (FORM_ENDPOINT.includes("script.google.com")) {
    await fetch(FORM_ENDPOINT, { method: "POST", body, mode: "no-cors", keepalive: true });
    return;
  }
  const res = await fetch(FORM_ENDPOINT, { method: "POST", body, headers: { Accept: "application/json" }, keepalive: true });
  if (!res.ok) throw new Error("Lead endpoint returned " + res.status);
}

function crmSource(lead) {
  const source = (lead.source || "").toLowerCase(), medium = (lead.medium || "").toLowerCase();
  if (lead.gclid || lead.gbraid || lead.wbraid || (source === "google" && /cpc|ppc|paid/.test(medium))) return "Google Ads";
  if (/facebook|instagram|meta|^fb$|^ig$/.test(source)) return "Meta Ads";
  return "Website";
}

// Never throws and never takes longer than 5s, so the CRM can't hold up or lose a lead.
async function postLeadToCRM(lead) {
  if (!CRM_WEBHOOK_URL) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    await fetch(CRM_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CRM_API_KEY },
      body: JSON.stringify({
        name: lead.name,
        phone: lead.phone,
        email: "",
        destination: DESTINATION,
        message: `Interested in ${DESTINATION} package. Travel month: ${lead.month}. Travellers: ${lead.group_size}.`,
        host: window.location.hostname,
        source: crmSource(lead),
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    console.error("[Glabol] CRM post failed:", err);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Ad tracking: all tags (Google Ads, GA4, Meta Pixel) live in GTM; the page only pushes events (README: Ad tracking) ---------- */
window.dataLayer = window.dataLayer || [];

const track = {
  // Once per enquiry, on the thank-you page. user_data feeds GTM's "User Provided Data" variable.
  lead(lead) {
    window.dataLayer.push({ event: "lead_form_submit", lead_id: lead.id, user_data: { phone_number: "+91" + lead.phoneDigits } });
    window.dataLayer.push({ event: "thank_you_page_view", lead_id: lead.id, transaction_id: lead.id });
  },
  qualified(id, details) {
    window.dataLayer.push({ event: "qualified_lead", lead_id: id, ...details });
  },
  questionsComplete(id, quality, answers) {
    window.dataLayer.push({ event: "lead_questions_complete", lead_id: id, lead_quality: quality, ...answers });
  },
};
