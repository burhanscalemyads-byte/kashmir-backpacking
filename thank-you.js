/* =========================================================
   Glabol Kashmir — thank-you page: 3 qualifying questions.
   Answers are added to the enquiry's row in the sheet, and
   "Hot" leads are reported to Meta as QualifiedLead.
   ========================================================= */

// Who the sales team calls first. "Hot" (budget OK, booking within a month) is also
// the QualifiedLead event that Meta learns to find more of.
function leadQuality(answers) {
  if (answers.budget_fit === "Too high") return "Cold";
  if (!answers.budget_fit || !answers.booking_timeline) return "Partial";
  return answers.booking_timeline === "Just exploring" ? "Warm" : "Hot";
}

const CALL_TIMES = {
  Morning: "in the morning, between 9am and 12pm",
  Afternoon: "in the afternoon, between 12 and 5pm",
  Evening: "in the evening, between 5 and 9pm",
};

(function thankYou() {
  const lead = readLead();
  const qualify = document.getElementById("qualify");
  const done = document.getElementById("thanks-done");
  const title = document.getElementById("thanks-title");
  const steps = [...qualify.querySelectorAll(".qualify-step")];
  const count = qualify.querySelector(".qualify-count");
  const bar = qualify.querySelector(".qualify-bar span");
  const back = qualify.querySelector(".qualify-back");
  let current = 0;
  let advancing = false;

  function showDone() {
    qualify.hidden = true;
    done.hidden = false;
    if (!lead) return;
    if (lead.firstName) title.textContent = `Thanks, ${lead.firstName}. Your Kashmir trip is on its way.`;
    const when = lead.answers && CALL_TIMES[lead.answers.call_time];
    if (when) {
      document.getElementById("thanks-call").textContent =
        `A trip captain will call you ${when}, as you asked. Keep your phone close.`;
    }
  }

  // Direct visit, or the page opened in a new tab: no enquiry here, so no questions and no conversions
  if (!lead || !lead.id) return showDone();

  // One conversion per enquiry, however often the page is reloaded
  if (!lead.tracked) {
    track.lead(lead.id);
    lead.tracked = true;
    saveLead(lead);
  }
  if (lead.finished) return showDone();

  lead.answers = lead.answers || {};
  lead.seq = lead.seq || 0;
  if (lead.firstName) {
    document.getElementById("qualify-title").textContent =
      `Thanks, ${lead.firstName}. 3 quick questions so your trip captain can plan your call.`;
  }

  function show(i, moveFocus) {
    current = i;
    steps.forEach((step, j) => { step.hidden = j !== i; });
    count.textContent = `Question ${i + 1} of ${steps.length}`;
    bar.style.width = `${((i + 1) / steps.length) * 100}%`;
    back.hidden = i === 0;
    const key = steps[i].dataset.key;
    steps[i].querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(lead.answers[key] === b.value)));
    if (moveFocus) steps[i].querySelector("h2").focus();
  }

  function finish() {
    lead.finished = true;
    saveLead(lead);
    showDone();
    title.tabIndex = -1;
    title.focus();
  }

  function answer(step, button) {
    if (advancing) return;
    advancing = true;
    lead.answers[step.dataset.key] = button.value;
    lead.quality = leadQuality(lead.answers);
    lead.seq += 1;   // lets the sheet ignore an older answer that arrives late
    step.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));

    postToSheet({ type: "qualify", lead_id: lead.id, seq: lead.seq, lead_quality: lead.quality, ...lead.answers })
      .catch((err) => console.error(err));
    if (lead.quality === "Hot" && !lead.qualifiedTracked) {
      track.qualified(lead.id, { budget_fit: lead.answers.budget_fit, booking_timeline: lead.answers.booking_timeline });
      lead.qualifiedTracked = true;
    }
    lead.step = current + 1;
    saveLead(lead);

    setTimeout(() => {
      advancing = false;
      if (lead.step < steps.length) show(lead.step, true);
      else finish();
    }, reducedMotion ? 0 : 250);
  }

  steps.forEach((step) => step.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => answer(step, b))));
  back.addEventListener("click", () => {
    if (current === 0 || advancing) return;
    lead.step = current - 1;
    saveLead(lead);
    show(lead.step, true);
  });
  qualify.querySelector(".qualify-skip").addEventListener("click", finish);

  done.hidden = true;
  qualify.hidden = false;
  show(Math.min(lead.step || 0, steps.length - 1), false);
})();
