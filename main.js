/* =========================================================
   Glabol Kashmir — landing page behaviour
   ========================================================= */

// Settings (endpoint, phone, tracking IDs) and the shared helpers are in site.js.

/* ---------- Ad attribution ----------
   Read when the visitor lands and kept for the visit, so a lead is credited to the ad
   they clicked even if they browse around first. A new ad click replaces it.
   URL parameters (set in the ad platform, see README):
     utm_source, utm_medium, campaign_id, adset_id, ad_id, kw
   Fallbacks: utm_id or Google's auto-added gad_campaignid for the campaign, adgroupid /
   creative for Google Ads, and a source/medium worked out from gclid, fbclid or the referrer. */
const params = new URLSearchParams(location.search);
function param(...names) {
  for (const name of names) {
    const value = (params.get(name) || "").trim();
    // skip placeholders the ad platform didn't fill in, like "{keyword}" or "{{ad.id}}"
    if (value && !/^\{.*\}$/.test(value)) return value.slice(0, 200);
  }
  return "";
}

function trafficSource(click) {
  if (click.utm_source) return { source: click.utm_source, medium: click.utm_medium };
  if (click.gclid || click.gbraid || click.wbraid) return { source: "google", medium: "cpc" };
  if (click.fbclid) return { source: "facebook", medium: "social" };
  let host = "";
  try { host = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch (e) { /* no referrer */ }
  if (!host || host === location.hostname.replace(/^www\./, "")) return { source: "(direct)", medium: "(none)" };
  const engine = host.match(/(?:^|\.)(google|bing|yahoo|duckduckgo|ecosia)\./);
  return engine ? { source: engine[1], medium: "organic" } : { source: host, medium: "referral" };
}

const attribution = (() => {
  const click = {
    utm_source: param("utm_source"),
    utm_medium: param("utm_medium"),
    campaign_id: param("campaign_id", "utm_id", "gad_campaignid", "campaignid"),
    adset_id: param("adset_id", "adgroup_id", "adgroupid"),
    ad_id: param("ad_id", "creative"),
    keyword: param("kw", "utm_term"),
    gclid: param("gclid"),
    gbraid: param("gbraid"),
    wbraid: param("wbraid"),
    fbclid: param("fbclid"),
  };
  let saved = null;
  try { saved = JSON.parse(store("bk_attr") || "null"); } catch (e) { saved = null; }
  const isNewClick = Object.values(click).some(Boolean);
  if (saved && saved.source && !isNewClick) return saved;

  const { fbclid, utm_source, utm_medium, ...ids } = click;
  const result = { ...trafficSource(click), ...ids, landing_url: location.href.split("#")[0].slice(0, 500) };
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
    [/solo|alone|single/, "Going solo? Join a group of 18–35 year olds for five nights in Kashmir."],
    [/budget|cheap|low cost|affordable|under/, "Stays, breakfasts, dinners and GST included. Add the Delhi bus for ₹3,000."],
    [/group|friends|college/, "Five nights in Kashmir with a group of 18–35 year olds and a tour captain."],
    [/houseboat|dal lake/, "A night on a houseboat, then Gulmarg, Sonamarg and Pahalgam."],
    [/gulmarg|sonamarg|sonmarg|pahalgam|betaab|betab|\baru\b/, "Gulmarg, Sonamarg and Pahalgam, plus a night on a houseboat in Srinagar."],
    [/delhi/, "Eight days from Delhi, with the bus both ways, stays and meals included."],
    [/jammu|srinagar/, "Join in Jammu or Srinagar: five nights in Kashmir with a group of 18–35s."],
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

/* ---------- Batch dates: drop batches that have left, show the next few ----------
   Every batch from the brochure is in the HTML (li data-start="YYYY-MM-DD"). */
(function batchDates() {
  const list = document.getElementById("dep-list");
  if (!list) return;
  const SHOW = 6;
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // India time
  const upcoming = [];
  list.querySelectorAll("li[data-start]").forEach((li) => {
    if (li.dataset.start <= today) li.remove();
    else upcoming.push(li);
  });

  const next = document.getElementById("next-batch");
  if (!upcoming.length) {
    if (next) next.textContent = "Soon";
    list.insertAdjacentHTML("beforeend", "<li><span class=\"dep-note\">New batches are coming soon. Send an enquiry and we'll share the dates first.</span></li>");
    return;
  }
  const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  if (next) next.textContent = fmt.format(new Date(upcoming[0].dataset.start + "T00:00:00Z")).replace("Sept", "Sep");
  const pill = upcoming[0].querySelector(".dep-seats");
  pill.textContent = "Next batch";
  pill.classList.add("dep-next");

  const more = document.getElementById("dep-more");
  if (!more || upcoming.length <= SHOW) return;
  upcoming.slice(SHOW).forEach((li) => { li.hidden = true; });
  more.textContent = `Show all ${upcoming.length} batch dates`;
  more.hidden = false;
  more.addEventListener("click", () => {
    upcoming.forEach((li) => { li.hidden = false; });
    more.hidden = true;
    upcoming[SHOW].querySelector(".dep-hold").focus({ preventScroll: true });
  });
})();

/* ---------- Route chart on phones: fade the cut-off edge until it's scrolled to the end ---------- */
(function chartScrollHint() {
  const box = document.querySelector(".profile-scroll");
  if (!box) return;
  const update = () => box.classList.toggle("at-end", box.scrollLeft + box.clientWidth >= box.scrollWidth - 4);
  box.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();

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
    showError(phone, "Enter your 10-digit Indian mobile number.");
    firstBad = firstBad || phone;
  } else showError(phone, "");

  if (firstBad) firstBad.focus();
  return !firstBad;
}

// Random ID that ties the thank-you page's answers to this lead's row in the sheet
function newLeadId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
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
      lead_id: newLeadId(),
      name: form.elements.name.value.trim(),
      phone: "+91" + cleanPhone(form.elements.phone.value),
      month: form.elements.month.value,
      group_size: form.elements.group_size.value,
      form_location: form.closest("#enquire") ? "hero" : "final",
      ...attribution,
    };

    try {
      await Promise.all([postToSheet(payload), postLeadToCRM(payload)]);
      saveLead({ id: payload.lead_id, firstName: payload.name.split(" ")[0], phoneDigits: payload.phone.slice(3) });
      location.href = THANK_YOU_URL;
    } catch (err) {
      console.error(err);
      status.textContent = "We couldn't send that. Please check your connection and try again.";
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
  // Sea level to a little above the highest stop, with a grid line every 1,000 m
  const MIN = 0, MAX = Math.ceil(Math.max(...stops.map(([, alt]) => alt)) / 1000) * 1000 + 300;
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
  el("stop", { offset: "0", class: "p-fill-top" }, grad);
  el("stop", { offset: "1", class: "p-fill-bottom" }, grad);

  for (let alt = 1000; alt < MAX; alt += 1000) {
    el("line", { class: "p-grid", x1: 0, x2: W, y1: y(alt), y2: y(alt) });
    el("text", { class: "p-grid-label", x: 0, y: y(alt) - 6 }).textContent = alt.toLocaleString("en-IN") + " m";
  }

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
