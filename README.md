# Glabol Kashmir: landing page

A static landing page for Google Ads lead capture. There's no build step: open `index.html` or upload the folder anywhere.

```
index.html       the landing page
thank-you.html   shown after a successful enquiry (put the Google Ads conversion tag here)
styles.css       all styling; colours are the variables at the top
main.js          form, ad attribution, keyword headlines, altitude chart
images/          your photos
```

## 1. Replace the placeholder content

Everything below is a realistic placeholder. Search `index.html` and `thank-you.html` for each item and replace it:

| Placeholder | Where |
|---|---|
| ~~Brand and logo~~ Done: Glabol logo in the header and footer | — |
| `+91 98765 43210` / `919876543210` | header, footer, WhatsApp links, `SUPPORT_PHONE` in `main.js` |
| `hello@example.com`, Srinagar address | footer |
| ₹18,999 / ₹21,499 / ₹5,000 deposit, next departure date | hero facts bar, price section, JSON-LD in `<head>` |
| 4.8 rating, 1,240 reviews, 6,500+ travellers | hero rating line, proof strip, reviews |
| Itinerary, inclusions, departures, seats left | the route, price and departures sections |
| Reviews and mosaic quotes | use real ones from real travellers |
| FAQ answers, especially cancellation terms | FAQ section |

Ads policy: the ratings, review counts and seat counts must be true before you run ads.

## 2. Photos

All photos are in place. Your own traveller photos are used for the form card, the hero rating line, the photo grid and the final section. Free-licensed Wikimedia Commons photos are used for the destinations. If an image is missing, its slot shows a green block labelled with the filename.

| File | Source | Used for |
|---|---|---|
| `hero.jpg` | Wikimedia Commons (Sonamarg) | Hero background |
| `hero-card.jpg` | Your group by the river | Top of the enquiry card |
| `avatar-1.jpg` … `avatar-3.jpg` | Faces cropped from the same group photo | Hero rating line |
| `day-1-srinagar.jpg` … `day-7-srinagar.jpg` | Wikimedia Commons | Itinerary days |
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

Every enquiry becomes a row in the sheet, and the sheet owner gets an email alert with a WhatsApp link to the lead. The sheet columns are:

| Timestamp | Name | Phone | Travel month | Travellers | Source | Medium | Campaign ID | Adset ID | Ad ID | Keyword | GCLID | Landing page | Form |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **Setup:** follow the 5 steps at the top of [`tools/google-sheet-leads.gs`](tools/google-sheet-leads.gs), then put the web app URL in `FORM_ENDPOINT` at the top of `main.js`.
- **Your own columns:** add "Status" or "Notes" columns, or reorder them, anywhere in the sheet. Leads are matched to columns by header name.
- **Junk filter:** the script only accepts a name plus a valid Indian mobile number. A hidden field also catches form-filling bots, which are dropped without counting as an Ads conversion.
- **Email alerts:** a free Gmail account can send about 100 a day. Leads are still saved after that.
- **CRM later:** set `CRM_WEBHOOK_URL` in the script and every lead is also forwarded there. The website doesn't need to change.

While `FORM_ENDPOINT` is empty, submitting logs the lead to the browser console and still goes to the thank-you page, so you can test the flow. Other services also work in `FORM_ENDPOINT`, for example Formspree, or Web3Forms with `FORM_EXTRA_FIELDS = { access_key: "YOUR_KEY" }`.

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

**Other tracking:**
- **Conversion:** uncomment the block in the `<head>` of `thank-you.html` and fill in your `AW-` ID and conversion label.
- **Auto-tagging:** keep it on in Google Ads. The `GCLID` column lets you import offline conversions (leads that became bookings) later.
- **Keyword-matched line:** the `kw={keyword}` part of the suffix also picks the hero's supporting line (solo, budget, group, Gulmarg/Sonamarg/Pahalgam). Raw search text is never shown. Edit the list in `matchHeadline()` in `main.js`.
- **Google Tag Manager:** a `lead_submit` event is pushed to `dataLayer` on each enquiry, and a `whatsapp_click` event on each WhatsApp tap. Its `link_location` is one of `hero-form`, `faq`, `final-form` or `sticky-bar`. You can import it as a secondary conversion.

## 5. Test and publish

```bash
cd ~/kashmir-backpacking && python3 -m http.server 8080
# open http://localhost:8080/?utm_source=google&utm_medium=cpc&campaign_id=111&adset_id=222&ad_id=333&kw=kashmir+solo+trip&gclid=test123
```

## 6. Hosting: kashmir.glabol.com

**Hostinger (upload a zip).** Build the upload package from the project folder:

```bash
cd ~/kashmir-backpacking && rm -f kashmir-live.zip && zip -q -r -X kashmir-live.zip index.html thank-you.html styles.css main.js .htaccess images -x "*.DS_Store"
```

1. In hPanel → File Manager, open the subdomain's folder.
2. Upload `kashmir-live.zip` and extract it there. `index.html` must sit directly in that folder, not in a subfolder.
3. Once hPanel shows SSL as active for the subdomain, turn on Force HTTPS.
4. After any later change, rebuild the zip and upload again. Overwriting the old files is fine.

`.htaccess` adds security headers and caches images for a day. Pages, styles and scripts are re-checked on every visit, so edits show up straight away.

**Cloudflare Pages (connected to GitHub).** This is the alternative. Every push to `main` goes live in about a minute, and `_headers` and `_redirects` do the same job as `.htaccess`. A bad change can be undone under Deployments → "Rollback to this deployment".
