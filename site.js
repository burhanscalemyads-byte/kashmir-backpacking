/* =========================================================
   Glabol Kashmir — shared by every page: settings, sending
   leads to the sheet, and ad tracking (Meta Pixel, Google Ads)
   ========================================================= */

// ---- Settings: edit these -------------------------------------------------
// Where leads are sent. Leave empty to test the flow (logs the lead to the
// console and goes to the thank-you page). Works with a Google Apps Script
// web app URL, Web3Forms, Formspree, or any CRM / Zapier / Make webhook.
const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbwYnAfwqPfea57MW3LadpPw1Yg-5xLaTna93DhnYOvCp25B4wu8R7pwIYbnUkKYeakj/exec";
// Extra fields some services need, e.g. { access_key: "..." } for Web3Forms.
const FORM_EXTRA_FIELDS = {};
const THANK_YOU_URL = "thank-you.html";

// Ad tracking. Leave a value empty to switch that tag off.
const META_PIXEL_ID = "4126422144254829";
const GOOGLE_ADS_ID = "";               // e.g. "AW-123456789"
const GOOGLE_ADS_LEAD_LABEL = "";       // label of the "Lead" conversion action
const GOOGLE_ADS_QUALIFIED_LABEL = "";  // label of the "Qualified lead" conversion action
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

/* ---------- Ad tracking ---------- */
window.dataLayer = window.dataLayer || [];

if (META_PIXEL_ID) {
  /* Meta Pixel base code */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  // On the thank-you page, give Meta the lead's phone (the pixel hashes it before sending)
  // so the Lead and QualifiedLead events match the right person: better targeting.
  const lead = document.documentElement.dataset.page === "thank-you" ? readLead() : null;
  if (lead && lead.id) fbq("init", META_PIXEL_ID, { ph: "91" + lead.phoneDigits, external_id: lead.id });
  else fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
}

if (GOOGLE_ADS_ID) {
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://www.googletagmanager.com/gtag/js?id=" + GOOGLE_ADS_ID;
  document.head.appendChild(tag);
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GOOGLE_ADS_ID);
}

const track = {
  // The lead ID doubles as the event ID / transaction ID, so a reload can't count twice
  lead(id) {
    if (window.fbq) fbq("track", "Lead", {}, { eventID: id });
    if (window.gtag && GOOGLE_ADS_LEAD_LABEL) {
      gtag("event", "conversion", { send_to: GOOGLE_ADS_ID + "/" + GOOGLE_ADS_LEAD_LABEL, transaction_id: id });
    }
  },
  qualified(id, details) {
    if (window.fbq) fbq("trackCustom", "QualifiedLead", details, { eventID: id + "-q" });
    if (window.gtag && GOOGLE_ADS_QUALIFIED_LABEL) {
      gtag("event", "conversion", { send_to: GOOGLE_ADS_ID + "/" + GOOGLE_ADS_QUALIFIED_LABEL, transaction_id: id + "-q" });
    }
    window.dataLayer.push({ event: "qualified_lead", ...details });
  },
};
