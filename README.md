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

## 3. Choose where leads go

Open `main.js` and set `FORM_ENDPOINT` at the top. Each lead sends these fields: `name, phone, month, group_size, form_location, submitted_at, gclid, gbraid, wbraid, utm_*, landing_url`.

- **Google Sheet (in use):** follow the setup steps at the top of [`tools/google-sheet-leads.gs`](tools/google-sheet-leads.gs). The script:
  - adds each lead to the Sheet;
  - emails `NOTIFY_EMAIL`;
  - forwards the lead to `CRM_WEBHOOK_URL` once you set it, so connecting a CRM later needs no website change.
- **Web3Forms:** `FORM_ENDPOINT = "https://api.web3forms.com/submit"` and `FORM_EXTRA_FIELDS = { access_key: "YOUR_KEY" }`.
- **Formspree:** `FORM_ENDPOINT = "https://formspree.io/f/YOUR_ID"`.
- **CRM, Zapier or Make:** paste the webhook URL.

While `FORM_ENDPOINT` is empty, submitting logs the lead to the browser console and still goes to the thank-you page, so you can test the flow.

## 4. Google Ads tracking

- **Conversion:** uncomment the block in the `<head>` of `thank-you.html` and fill in your `AW-` ID and conversion label.
- **Auto-tagging:** keep it on in Google Ads. The page stores `gclid` with every lead, so you can import offline conversions (leads that became bookings) later.
- **Keyword-matched headline:** add `{keyword}` to your final URL suffix, e.g. `kw={keyword}`. The headline stays "Kashmir Backpacking Trip"; the line under it switches to one of a few pre-written versions (solo, budget, group, Gulmarg/Sonamarg/Pahalgam). Raw search text is never shown. Edit the list in `matchHeadline()` in `main.js`.
- **Google Tag Manager:** a `lead_submit` event is pushed to `dataLayer` on each successful enquiry, and a `whatsapp_click` event on each WhatsApp tap. Its `link_location` says which button was tapped: `hero-form`, `faq`, `final-form` or `sticky-bar`. You can import it as a secondary conversion.

## 5. Test and publish

```bash
cd ~/kashmir-backpacking && python3 -m http.server 8080
# open http://localhost:8080/?kw=kashmir+solo+trip&gclid=test123&utm_source=google
```

## 6. Hosting: kashmir.glabol.com

The page is hosted on **Cloudflare Pages** and connected to a private GitHub repo. Every push to `main` goes live in about a minute.

- **Preview first:** push to a `preview` branch. Cloudflare gives it its own URL to check before merging.
- **Undo a bad change:** Cloudflare dashboard → Workers & Pages → the project → Deployments → "Rollback to this deployment".
- **`_headers`:** security headers, and 1-day caching for images.
- **`_redirects`:** hides `tools/` and this README on the live site.
