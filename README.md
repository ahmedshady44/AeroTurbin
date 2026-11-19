# AeroTurbine: project showcase site

A single-page, four-language (Arabic, English, French, Spanish) showcase for the AeroTurbine concept, deployed on Vercel at **https://aeroturbin.vercel.app**.
Plain HTML, CSS, and vanilla JavaScript. Pre-rendered static HTML per language (`/en/`, `/ar/`, `/fr/`, `/es/`) with zero runtime build step on Vercel, no tracking, and no cookies.

> AeroTurbine is **not** a finished product. The site is a demo of the filter concept and an engineering design blueprint. All power, efficiency, cost, and health numbers are design targets or simulation values.

## Files

```
index.html                      x-default language chooser + lightweight JS redirect
en/index.html                   pre-rendered English page (https://aeroturbin.vercel.app/en/)
ar/index.html                   pre-rendered Arabic RTL page (https://aeroturbin.vercel.app/ar/)
fr/index.html                   pre-rendered French page (https://aeroturbin.vercel.app/fr/)
es/index.html                   pre-rendered Spanish page (https://aeroturbin.vercel.app/es/)
styles.css                      design tokens (CSS variables), layout, light/dark themes
app.js                          interactivity (blueprint, hotspots, simulator, lightbox, language nav)
i18n/en.json  ar.json  fr.json  es.json    all translated copy, one file per language
i18n/bundle.js                  combined dictionary bundle (kept in sync by scripts/build-pages.js)
assets/schematic.jpg            3D cutaway illustration (JPG fallback)
assets/schematic-cutaway.webp   compressed WebP cutaway (+ schematic-cutaway-800.webp mobile srcset)
assets/og-image.jpg             1200×630 Open Graph / Twitter social preview card
assets/sketches/                4 stage sketches (stage1..stage3 .jpg fallbacks + sketch-stage-* .webp & -800.webp)
sitemap.xml                     XML sitemap with xhtml:link hreflang alternates for all 4 language URLs
robots.txt                      allows all crawlers and links to https://aeroturbin.vercel.app/sitemap.xml
llms.txt                        plain-language project summary (EN + AR) with design targets for AI crawlers
vercel.json                     Vercel cleanUrls, trailingSlash, canonical redirects, HSTS & immutable asset caching
scripts/build-pages.js          regenerates /en/, /ar/, /fr/, /es/, /index.html, and i18n/bundle.js from i18n/*.json
scripts/check-links.js          crawls all local HTML pages and checks internal links, #anchors, images, and srcsets
scripts/seo-audit.js            runs all 20 automated SEO, accessibility, and performance checks
```

## Run Locally

- Serve the folder with any static server, e.g. `npx serve .` or `python -m http.server 8080`, then open `http://localhost:8080/en/` (or `http://localhost:8080/`).
- You can also open `en/index.html`, `ar/index.html`, `fr/index.html`, or `es/index.html` directly from disk.

## Regenerate Pages After Editing Translations (`i18n/*.json`)

Because crawlers and social link previews (WhatsApp, LinkedIn, X) read raw HTML without running JavaScript, each language has a pre-rendered HTML file. Whenever you edit `i18n/en.json`, `ar.json`, `fr.json`, or `es.json`:

```bash
node scripts/build-pages.js
```

Then verify links and SEO before committing the generated files:

```bash
node scripts/check-links.js
node scripts/seo-audit.js
```

Commit both the updated `i18n/*.json` files and the regenerated `index.html`, `en/index.html`, `ar/index.html`, `fr/index.html`, `es/index.html`, and `i18n/bundle.js`.

## Deploy on Vercel

1. Push the repository to GitHub connected to your Vercel project (**https://aeroturbin.vercel.app**).
2. In Vercel Project Settings → **Build & Development Settings**:
   - **Framework Preset:** `Other`
   - **Build Command:** leave empty (all pages are pre-rendered and committed) or set to `node scripts/build-pages.js`
   - **Output Directory:** `.` (root)
3. `vercel.json` automatically configures HTTPS security headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`), 1-year `immutable` caching for `/assets/*`, `"cleanUrls": true`, `"trailingSlash": true`, and canonical redirects from `/*/index.html` to `/*/`.

## Google Search Console Setup (Vercel Subdomain)

Because `aeroturbin.vercel.app` is a shared `.vercel.app` subdomain (you do not control the root DNS zone for `vercel.app`), verify it with a **URL prefix** property and the HTML `<meta name="google-site-verification">` tag:

1. Open [Google Search Console](https://search.google.com/search-console) and click **Add property**.
2. Choose **URL prefix** (do **not** choose "Domain" / DNS verification) and enter:
   `https://aeroturbin.vercel.app/`
3. Under **Other verification methods**, expand **HTML tag** and copy only the `content="..."` token value from Google's snippet.
4. Open `scripts/build-pages.js`, replace `REPLACE_ME` in `<meta name="google-site-verification" content="REPLACE_ME">` with your token, run `node scripts/build-pages.js`, commit, and push to Vercel.
5. Wait for Vercel deployment to finish (~15 seconds), then click **Verify** in Google Search Console.
6. In the left sidebar, go to **Sitemaps**, enter `sitemap.xml` (full URL: `https://aeroturbin.vercel.app/sitemap.xml`), and click **Submit**.
7. Use the top **URL Inspection** bar to inspect and click **Request Indexing** for each of the 4 language URLs:
   - `https://aeroturbin.vercel.app/en/`
   - `https://aeroturbin.vercel.app/ar/`
   - `https://aeroturbin.vercel.app/fr/`
   - `https://aeroturbin.vercel.app/es/`
8. After 3 to 7 days, review the **Indexing → Pages** report and the **Experience → Core Web Vitals** report in Search Console.

## Replace or Add a Gallery Image and Caption

The Sketches Gallery (`#gallery-grid`) shows 4 chronological stage cards:
1. `assets/sketches/sketch-stage-1-layout.webp` (`-800.webp` + `stage1-layout.jpg` fallback)
2. `assets/sketches/sketch-stage-1-multiturbine.webp` (`-800.webp` + `stage1-multiturbine.jpg` fallback)
3. `assets/sketches/sketch-stage-2-digital.webp` (`-800.webp` + `stage2-digital.jpg` fallback)
4. `assets/sketches/sketch-stage-3-final.webp` (`-800.webp` + `stage3-final.jpg` fallback)

- **Edit captions or alt text:** update `gallery.captions` and `gallery.alts` (indexed `0` to `3`) in all four `i18n/*.json` files, then run `node scripts/build-pages.js`.
- **Replace or add an image:** place the `.webp` (and `-800.webp` mobile variant + `.jpg` fallback, under 200 KB) in `assets/sketches/`, update `GALLERY_ITEMS` in `scripts/build-pages.js` with the filename and `w`/`h` dimensions, and run `node scripts/build-pages.js`.

## Schematic Image and Hotspots

- Keep the cutaway at `assets/schematic.jpg` with `assets/schematic-cutaway.webp` and `assets/schematic-cutaway-800.webp` (max 1600 px wide, under 300 KB).
- **Nudge a hotspot:** edit `HOTSPOTS` in `app.js` and `scripts/build-pages.js` (`x` and `y` are percentages of the image width and height), then run `node scripts/build-pages.js`.
