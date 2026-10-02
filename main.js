/* =========================================================
   Glabol Kashmir — landing page behaviour
   ========================================================= */

// ---- Settings: edit these -------------------------------------------------
// Where leads are sent. Leave empty to test the flow (logs the lead to the
// console and goes to the thank-you page). Works with a Google Apps Script
// web app URL, Web3Forms, Formspree, or any CRM / Zapier / Make webhook.
const FORM_ENDPOINT = "";
// Extra fields some services need, e.g. { access_key: "..." } for Web3Forms.
const FORM_EXTRA_FIELDS = {};
const THANK_YOU_URL = "thank-you.html";
const SUPPORT_PHONE = "+91 98765 43210";
// ---------------------------------------------------------------------------

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function store(key, value) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
  } catch (e) { /* storage blocked: carry on without it */ }
  return null;
}

/* ---------- Ad attribution (gclid / UTM) ---------- */
const ATTR_KEYS = ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const params = new URLSearchParams(location.search);

const attribution = (() => {
  let saved = {};
  try { saved = JSON.parse(store("bk_attr") || "{}"); } catch (e) { saved = {}; }
  const fresh = {};
  ATTR_KEYS.forEach((k) => { if (params.get(k)) fresh[k] = params.get(k).slice(0, 200); });
  // A new ad click replaces the old attribution as a whole
  const result = Object.keys(fresh).length ? fresh : saved;
  if (!result.landing_url) result.landing_url = location.href.split("#")[0].slice(0, 500);
  store("bk_attr", JSON.stringify(result));
  return result;
})();

/* ---------- Keyword-matched supporting line ---------- */
// The headline stays "Kashmir Backpacking Trip". The search term picks one of
// these whitelisted lines underneath it; raw search text is never shown.
(function matchHeadline() {
  const term = (params.get("kw") || params.get("utm_term") || "").toLowerCase();
  if (!term) return;
  const rules = [
    [/solo|alone|single/, "Going solo? Join a group of 12–18 travellers for seven days. From ₹18,999."],
    [/budget|cheap|low cost|affordable|under/, "Stays, meals and transport for seven days, all included. From ₹18,999."],
    [/group|friends|college/, "Seven days with a group of 12–18 travellers and a local trip captain. From ₹18,999."],
    [/gulmarg|sonamarg|pahalgam/, "Gulmarg, Sonamarg and Pahalgam in one week, with a small group. From ₹18,999."],
  ];
  const match = rules.find(([re]) => re.test(term));
  const sub = document.getElementById("hero-sub");
  if (match && sub) sub.textContent = match[1];
})();

/* ---------- Travel month options ---------- */
(function fillMonths() {
  const fmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });
  const now = new Date();
  const months = [];
  for (let i = 0; i < 9; i++) {
    months.push(fmt.format(new Date(now.getFullYear(), now.getMonth() + i, 1)).replace("Sept", "Sep"));
  }
  document.querySelectorAll("[data-month-select]").forEach((select) => {
    select.add(new Option("Not sure yet", "Not sure yet"));
    months.forEach((m) => select.add(new Option(m, m)));
    select.selectedIndex = 1;
  });
})();

function setMonth(month) {
  document.querySelectorAll("[data-month-select]").forEach((select) => {
    if (![...select.options].some((o) => o.value === month)) select.add(new Option(month, month));
    select.value = month;
  });
}

/* ---------- Every enquiry link lands on the form, ready to type ---------- */
function goToForm(event) {
  const card = document.getElementById("enquire");
  if (!card) return;
  event.preventDefault();
  card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  const first = card.querySelector("input");
  if (first) first.focus({ preventScroll: true });
}
document.querySelectorAll("[data-focus-form]").forEach((a) => a.addEventListener("click", goToForm));
document.querySelectorAll(".dep-hold").forEach((a) => a.addEventListener("click", (e) => {
  setMonth(a.dataset.month);
  goToForm(e);
}));

/* ---------- Forms ---------- */
function cleanPhone(raw) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function showError(input, message) {
  const field = input.closest(".field");
  field.classList.toggle("has-error", Boolean(message));
  field.querySelector(".field-error").textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validate(form) {
  const name = form.elements.name;
  const phone = form.elements.phone;
  let firstBad = null;

  if (name.value.trim().length < 2) {
    showError(name, "Please tell us your name.");
    firstBad = firstBad || name;
  } else showError(name, "");

  if (!/^[6-9]\d{9}$/.test(cleanPhone(phone.value))) {
    showError(phone, "Enter a 10-digit Indian mobile number, like 98765 43210.");
    firstBad = firstBad || phone;
  } else showError(phone, "");

  if (firstBad) firstBad.focus();
  return !firstBad;
}

async function sendLead(payload) {
  if (!FORM_ENDPOINT) {
    console.info("[Glabol] FORM_ENDPOINT is empty. Lead not sent:", payload);
    return;
  }
  const body = new FormData();
  Object.entries({ ...FORM_EXTRA_FIELDS, ...payload }).forEach(([k, v]) => body.append(k, v));

  // Apps Script web apps don't return CORS headers, so the response can't be read
  if (FORM_ENDPOINT.includes("script.google.com")) {
    await fetch(FORM_ENDPOINT, { method: "POST", body, mode: "no-cors" });
    return;
  }
  const res = await fetch(FORM_ENDPOINT, { method: "POST", body, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Lead endpoint returned " + res.status);
}

document.querySelectorAll(".lead-form").forEach((form) => {
  const button = form.querySelector("button[type=submit]");
  const label = button.querySelector(".btn-label");
  const status = form.querySelector(".form-status");
  let sending = false;

  // Clear an error as soon as the visitor fixes it
  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid") === "true") showError(e.target, "");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending || !validate(form)) return;

    sending = true;
    button.disabled = true;
    label.textContent = "Sending…";
    status.textContent = "";

    const payload = {
      name: form.elements.name.value.trim(),
      phone: "+91" + cleanPhone(form.elements.phone.value),
      month: form.elements.month.value,
      group_size: form.elements.group_size.value,
      form_location: form.closest("#enquire") ? "hero" : "final",
      submitted_at: new Date().toISOString(),
      ...attribution,
    };

    try {
      await sendLead(payload);
      store("bk_lead_name", payload.name.split(" ")[0]);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "lead_submit", form_location: payload.form_location });
      location.href = THANK_YOU_URL;
    } catch (err) {
      console.error(err);
      status.textContent = `We couldn't send that. Please try again, or WhatsApp us on ${SUPPORT_PHONE}.`;
      label.textContent = "Send my enquiry";
      button.disabled = false;
      sending = false;
    }
  });
});

/* ---------- Altitude profile ---------- */
(function drawProfile() {
  const svg = document.getElementById("profile");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const stops = JSON.parse(svg.dataset.stops);

  const W = 1000, TOP = 80, BOTTOM = 312, LEFT = 96, RIGHT = 930;
  const MIN = 1000, MAX = 4200;
  const x = (i) => LEFT + (i * (RIGHT - LEFT)) / (stops.length - 1);
  const y = (alt) => TOP + (1 - (alt - MIN) / (MAX - MIN)) * (BOTTOM - TOP);
  const el = (tag, attrs, parent = svg) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    parent.appendChild(node);
    return node;
  };

  const defs = el("defs", {});
  const grad = el("linearGradient", { id: "profile-fill", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: "0", "stop-color": "#C6E14B", "stop-opacity": ".45" }, grad);
  el("stop", { offset: "1", "stop-color": "#C6E14B", "stop-opacity": "0" }, grad);

  [2000, 3000, 4000].forEach((alt) => {
    el("line", { class: "p-grid", x1: 0, x2: W, y1: y(alt), y2: y(alt) });
    el("text", { class: "p-grid-label", x: 0, y: y(alt) - 6 }).textContent = alt.toLocaleString("en-IN") + " m";
  });

  const pts = stops.map(([, alt], i) => [x(i), y(alt)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mid = (x1 - x0) / 2;
    d += ` C${x0 + mid},${y0} ${x1 - mid},${y1} ${x1},${y1}`;
  }
  el("path", { class: "p-area", d: `${d} L${pts[pts.length - 1][0]},${BOTTOM + 20} L${pts[0][0]},${BOTTOM + 20} Z` });
  el("path", { class: "p-line", d, pathLength: 1 });

  stops.forEach(([name, alt], i) => {
    const [cx, cy] = pts[i];
    const g = el("g", { class: "p-stop", style: `--i:${i}` });
    el("circle", { class: "p-dot", cx, cy, r: 8 }, g);
    el("text", { class: "p-day", x: cx, y: cy - 56, "text-anchor": "middle" }, g).textContent = `Day ${i + 1}`;
    el("text", { class: "p-name", x: cx, y: cy - 36, "text-anchor": "middle" }, g).textContent = name;
    el("text", { class: "p-alt", x: cx, y: cy - 18, "text-anchor": "middle" }, g).textContent = alt.toLocaleString("en-IN") + " m";
  });

  if (reducedMotion || !("IntersectionObserver" in window)) return;
  svg.classList.add("will-draw");
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add("is-drawn")));
  }, { threshold: 0.35 });
  io.observe(svg);
})();

/* ---------- Mobile sticky bar: hidden while a form is on screen ---------- */
(function stickyBar() {
  const bar = document.getElementById("sticky-bar");
  const forms = document.querySelectorAll(".form-card");
  if (!bar || !("IntersectionObserver" in window)) return;
  const visible = new Set();
  const update = () => bar.classList.toggle("is-visible", visible.size === 0 && window.scrollY > 300);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target)));
    update();
  });
  forms.forEach((f) => io.observe(f));
  window.addEventListener("scroll", update, { passive: true });
})();
