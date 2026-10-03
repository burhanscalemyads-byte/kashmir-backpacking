# Glabol Kashmir: landing page

A static landing page for Google and Meta ads lead capture. There's no build step: open `index.html` or upload the folder anywhere.

```
index.html       the landing page
thank-you.html   shown after an enquiry: 3 qualifying questions, then "your trip is on its way"
styles.css       all styling; colours are the variables at the top
site.js          settings (sheet URL, phone, Meta Pixel / Google Ads IDs), sending, ad tracking
main.js          landing page: form, ad attribution, keyword headlines, altitude chart
thank-you.js     the qualifying questions and the Hot / Warm / Cold rule
images/          your photos
```

## 1. Content

The trip details come from the brochure **KASHMIR TRIP - GLABOL INDIA.pdf** (Oct 2026):
- the 8-day Delhi-to-Delhi itinerary;
- inclusions, exclusions and notes;
- the packing list, terms and cancellation policy;
- all 38 batch dates.

The price is ₹13,999 per person (triple/quad sharing, GST included).

| Item | Where |
|---|---|
| Price ₹13,999 | `<title>`, og:title, JSON-LD, hero facts bar, price box (`index.html`); budget question (`thank-you.html`) |
| Day-by-day plan | route section: the `data-stops` on the chart (one stop per day, with altitude) and the day cards |
| Batch dates | departures section: one `<li data-start="YYYY-MM-DD">` per batch. Past batches hide themselves and the hero's "next batch" date updates on its own. To add next season, copy a row and change its dates, month and batch number. |
| Inclusions, exclusions, terms, packing list | price section and FAQ |

**No phone numbers on the page, by choice.** Every enquiry goes through the form, so each lead is tracked and lands in the sheet. That's why there are no call or WhatsApp buttons either.

**Still placeholders:** the 4.8 rating and 1,240 Google reviews (hero rating line and reviews heading), and the three reviews with their names. Replace them with real ones; ad policies require them to be true before you run ads.

## 2. Photos

All photos are in place. Your own traveller photos are used for the form card, the hero rating line, the photo grid and the final section. Free-licensed Wikimedia Commons photos are used for the destinations. If an image is missing, its slot shows a green block labelled with the filename.

| File | Source | Used for |
|---|---|---|
| `hero.jpg` | Wikimedia Commons (Sonamarg) | Hero background |
| `hero-card.jpg` | Your group by the river | Top of the enquiry card |
| `avatar-1.jpg` … `avatar-3.jpg` | Faces cropped from the same group photo | Hero rating line |
| `dal-lake.jpg`, `shalimar-bagh.jpg`, `gulmarg.jpg`, `thajiwas-glacier.jpg`, `betaab-valley.jpg`, `pahalgam.jpg` | Wikimedia Commons | Itinerary days 1–7 |
| `group-farewell.jpg` | Glabol group photo from the brochure (page 6) | Itinerary day 8 |
| `mood-1.jpg` … `mood-6.jpg` | Your traveller photos | "Different camera roll" grid |
| `final.jpg` | Your snow group photo | Final section background |

**Credits are required.** The Commons photos are CC BY / CC BY-SA. They are free for commercial use, but only with the credit line that's in the page footer. Keep that line, or replace the photos with your own and delete it.

**Swapping a photo.** Keep the filename and use `tools/img.py`. It uses `sips`, which is built into macOS, to resize, crop and compress:

```bash
python3 tools/img.py ~/Desktop/new.jpg images/mood-3.jpg 760 58                 # resize to 760px wide, quality 58
python3 tools/img.py ~/Desktop/new.jpg images/mood-3.jpg 760 58 0 0.4 1 0.5     # also crop: x y w h as fractions
```

Aim for under 350 KB for `hero.jpg` and under 150 KB for the others.

**Changing the hero photo.** Replace `images/hero.jpg` (landscape, about 2000px wide). The page mirrors it, so the left side, where the headline sits, should be sky or calm scenery.

## 3. Leads go to a Google Sheet

Every enquiry becomes a row in the sheet straight away, and the sheet owner gets an email alert with a link to message the lead on WhatsApp. The thank-you page then asks 3 qualifying questions, and each answer is added to the same row. The sheet columns are:

| Timestamp | Name | Phone | Travel month | Travellers | Lead quality | Budget fit | Booking timeline | Best time to call | Source | Medium | Campaign ID | Adset ID | Ad ID | Keyword | GCLID | Landing page | Form | Lead ID |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **Setup:** follow the 5 steps at the top of [`tools/google-sheet-leads.gs`](tools/google-sheet-leads.gs), then put the web app URL in `FORM_ENDPOINT` at the top of `site.js`.
- **Updating the script:** paste the new version and click Save. Then go to Deploy → Manage deployments → pencil → Version: "New version" → Deploy. "New deployment" would give it a new URL. Columns added in an update appear on the right of an existing sheet, and you can drag them anywhere.
- **Your own columns:** add "Status" or "Notes" columns, or reorder them, anywhere in the sheet. Leads are matched to columns by header name. Hide a column you don't need rather than deleting it, or it comes back.
- **Junk filter:**
  - The script only accepts a name plus a valid Indian mobile number.
  - Answers are only accepted with the exact button values, and they never change the name or phone.
- **Email alerts:** sent the moment the enquiry arrives, before the questions, so nobody waits for a call. A free Gmail account can send about 100 a day. Leads are still saved after that.
- **CRM later:** set `CRM_WEBHOOK_URL` in the script and every lead is also forwarded there. The website doesn't need to change.

While `FORM_ENDPOINT` is empty, submitting logs the lead to the browser console and still goes to the thank-you page, so you can test the flow. Other services also work in `FORM_ENDPOINT`, for example Formspree, or Web3Forms with `FORM_EXTRA_FIELDS = { access_key: "YOUR_KEY" }`. Those services save the first form only, not the answers.

**Qualifying questions (thank-you page).** One question per screen, tap to answer, with Back and "Skip, just call me". Skipping loses nothing, because the lead is already saved.

1. **Budget fit:** "Yes, that fits" / "A bit high, but I'm open" / "I need something cheaper".
2. **Booking timeline:** "This week" / "In the next 2–4 weeks" / "Just exploring for now".
3. **Best time to call:** Morning / Afternoon / Evening / Anytime. The thank-you message then confirms the time they picked.

**Lead quality** (`leadQuality()` in `thank-you.js`):

| Lead quality | When |
|---|---|
| **Hot** | budget fits or "a bit high, but open", and booking this week or within 2–4 weeks. Call these first. |
| **Warm** | budget OK, but just exploring. |
| **Cold** | needs something cheaper. |
| **Partial** | answered the budget question only. |
| **Not answered** | skipped the questions or left the page. |

To change a question or an answer, edit its button in `thank-you.html`. Then add the same `value` to the `ANSWERS` list in the Apps Script, or the sheet ignores it, and update `leadQuality()` if the rule should change.

## 4. Ad tracking

**Google Ads final URL suffix.** Set it once for the whole account under Admin → Account settings → Tracking → Final URL suffix. You can also set it per campaign under Campaign settings → Additional settings → Campaign URL options.

```
utm_source=google&utm_medium=cpc&campaign_id={campaignid}&adset_id={adgroupid}&ad_id={creative}&kw={keyword}
```

Google fills in the `{…}` values on every click. "Adset ID" holds the Google Ads ad group ID.

**Meta (Facebook / Instagram) ads.** Put this in each ad's URL parameters:

```
utm_source=facebook&utm_medium=paid_social&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

**How the columns are filled:**
- **Source and Medium** come from `utm_source` and `utm_medium`. Without them, the page works them out:
  - a Google Ads click is `google / cpc`;
  - organic search is, for example, `google / organic`;
  - another website is `site / referral`;
  - no referrer is `(direct) / (none)`.
- **Campaign ID** falls back to `gad_campaignid`, which Google's auto-tagging adds. Google Ads leads therefore get a campaign ID even if the suffix is missing.
- **Values Google can't fill** are left blank. For example, Performance Max has no ad group or ad ID, and Demand Gen has no keyword.
- **Credit for the ad click:** attribution is saved when the visitor lands, so the lead is credited to the ad click even if they browse around or reload first.

**Meta Pixel** (`META_PIXEL_ID` in `site.js`, already set to `4126422144254829`). It sends:

| Event | When |
|---|---|
| `PageView` | every page |
| `Lead` | once per enquiry, when the thank-you page opens. The event ID is the lead ID, so a reload doesn't count twice. |
| `QualifiedLead` (custom event) | once, when a lead becomes **Hot** |

On the thank-you page the pixel also gets the lead's phone number for matching. The pixel hashes it in the browser before sending it.

**Making Meta optimise for quality:**
1. In Events Manager, create a Custom conversion from the `QualifiedLead` event.
2. Run ad sets on the Lead event until `QualifiedLead` reaches about 50 a week.
3. Then switch the ad sets' conversion event to the custom conversion. Meta then looks for people like your Hot leads, not just anyone who fills a form.

**Google Ads conversions.** In `site.js`, set `GOOGLE_ADS_ID` (`AW-…`). Then set `GOOGLE_ADS_LEAD_LABEL` and, optionally, `GOOGLE_ADS_QUALIFIED_LABEL`, which are the labels of a "Lead" and a "Qualified lead" conversion action. Both fire once per lead, with the lead ID as the transaction ID.

**Other tracking:**
- **Auto-tagging:** keep it on in Google Ads. The `GCLID` column lets you import offline conversions (leads that became bookings) later.
- **Keyword-matched line:** the `kw={keyword}` part of the suffix also picks the hero's supporting line (solo, budget, group, houseboat, Gulmarg/Sonamarg/Pahalgam, Delhi). Raw search text is never shown. Edit the list in `matchHeadline()` in `main.js`.
- **Google Tag Manager:** these events are pushed to `dataLayer`:
  - `lead_submit` on each enquiry;
  - `qualified_lead` when a lead becomes Hot.
- **Privacy line:** the footer says that Meta and Google ad tools measure the ads and may receive the phone number in hashed form. Keep it while the pixel is on.

## 5. Test and publish

```bash
cd ~/kashmir-backpacking && python3 -m http.server 8080
# open http://localhost:8080/?utm_source=google&utm_medium=cpc&campaign_id=111&adset_id=222&ad_id=333&kw=kashmir+solo+trip&gclid=test123
```

## 6. Hosting: kashmir.glabol.com

**Hostinger (upload a zip).** Build the upload package from the project folder:

```bash
cd ~/kashmir-backpacking && python3 tools/build-zip.py
```

The script stamps every CSS/JS link in the pages with a version tag (`styles.css?v=…`) and then makes `kashmir-live.zip`. Always build with it, so that after an upload every visitor's browser loads the new CSS/JS. Without the tags, a browser that still holds old cached files mixes them with the new page and the form stops working.

1. In hPanel → File Manager, open the subdomain's folder.
2. Upload `kashmir-live.zip` and extract it there. If asked, choose to replace the existing files. `index.html` must sit directly in that folder, not in a subfolder.
3. Once hPanel shows SSL as active for the subdomain, turn on Force HTTPS.
4. After any later change, rebuild the zip with the script and upload it again.

`.htaccess` adds security headers and caches images for a day. Pages, styles and scripts are re-checked on every visit, so edits show up straight away.

**Cloudflare Pages (connected to GitHub).** This is the alternative. Every push to `main` goes live in about a minute, and `_headers` and `_redirects` do the same job as `.htaccess`. A bad change can be undone under Deployments → "Rollback to this deployment".
