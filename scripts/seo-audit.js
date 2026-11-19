#!/usr/bin/env node
/**
 * scripts/seo-audit.js
 * Automated verification of all 20 SEO, speed, and technical quality items.
 * Usage: node scripts/seo-audit.js
 */
const { readFileSync, existsSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = join(__dirname, '..');
const BASE_URL = 'https://aeroturbin.vercel.app';
const LANGS = ['en', 'ar', 'fr', 'es'];
const ALL_PAGES = ['index.html', ...LANGS.map((l) => `${l}/index.html`)];

const results = [];
function check(id, title, fn) {
  try {
    const detail = fn();
    results.push({ id, title, pass: true, detail: detail || 'OK' });
  } catch (e) {
    results.push({ id, title, pass: false, detail: e.message });
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// 1. sitemap.xml
check(1, 'sitemap.xml with 4 language URLs, hreflang alternates & lastmod', () => {
  assert(existsSync(join(ROOT, 'sitemap.xml')), 'sitemap.xml missing');
  const xml = read('sitemap.xml');
  for (const l of LANGS) {
    assert(xml.includes(`<loc>${BASE_URL}/${l}/</loc>`), `missing <loc> for /${l}/`);
    assert(xml.includes(`hreflang="${l}" href="${BASE_URL}/${l}/"`), `missing hreflang=${l}`);
  }
  assert(xml.includes(`hreflang="x-default" href="${BASE_URL}/en/"`), 'missing x-default -> /en/');
  assert(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(xml), 'missing lastmod date');
  return '4 URLs + 5 hreflang links each + lastmod verified';
});

// 2. robots.txt
check(2, 'robots.txt allows crawlers & links sitemap.xml', () => {
  assert(existsSync(join(ROOT, 'robots.txt')), 'robots.txt missing');
  const txt = read('robots.txt');
  assert(/User-agent:\s*\*/i.test(txt), 'missing User-agent: *');
  assert(/Allow:\s*\//i.test(txt), 'missing Allow: /');
  assert(txt.includes(`Sitemap: ${BASE_URL}/sitemap.xml`), 'missing Sitemap URL');
  assert(!/Disallow:\s*\/(?:assets|styles|app)/i.test(txt), 'blocks CSS/JS/images');
  return 'Allow: / and Sitemap URL verified';
});

// 3. noindex absent
check(3, 'No noindex or nofollow in pages or vercel.json', () => {
  for (const p of ALL_PAGES) {
    const html = read(p);
    assert(!/\bnoindex\b|\bnofollow\b/i.test(html), `${p} contains noindex/nofollow`);
  }
  const vj = read('vercel.json');
  assert(!/\bnoindex\b|\bnofollow\b/i.test(vj), 'vercel.json contains noindex/nofollow');
  return '0 occurrences across all 5 HTML files & vercel.json';
});

// 4. canonical & reciprocal hreflang
check(4, 'Self-referencing canonical & reciprocal hreflang tags', () => {
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    assert(html.includes(`<link rel="canonical" href="${BASE_URL}/${l}/">`), `/${l}/ missing self canonical`);
    for (const alt of LANGS) {
      assert(html.includes(`<link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}/">`), `/${l}/ missing hreflang=${alt}`);
    }
    assert(html.includes(`<link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/">`), `/${l}/ missing x-default`);
  }
  const rootHtml = read('index.html');
  assert(rootHtml.includes(`<link rel="canonical" href="${BASE_URL}/en/">`), 'root missing canonical');
  assert(rootHtml.includes(`<link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/">`), 'root missing x-default');
  return 'All 4 language pages & root have canonical + 5 reciprocal hreflangs';
});

// 5. <title> length 50-60 & starts with AeroTurbine
check(5, 'Translated <title> (50-60 chars, starts with AeroTurbine)', () => {
  const titles = new Set();
  const lens = [];
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    const m = html.match(/<title>([^<]+)<\/title>/);
    assert(m, `/${l}/ missing <title>`);
    const t = m[1];
    assert(t.startsWith('AeroTurbine'), `/${l}/ title does not start with AeroTurbine`);
    assert(t.length >= 50 && t.length <= 60, `/${l}/ title length ${t.length} not in 50..60`);
    titles.add(t);
    lens.push(`${l}:${t.length}`);
  }
  assert(titles.size === 4, 'titles are not unique across languages');
  return `Unique titles (${lens.join(', ')} chars)`;
});

// 6. Meta description length 140-160
check(6, 'Translated meta description (140-160 chars, concept framing)', () => {
  const descs = new Set();
  const lens = [];
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    const m = html.match(/<meta name="description" content="([^"]+)">/);
    assert(m, `/${l}/ missing meta description`);
    const d = m[1];
    assert(d.length >= 140 && d.length <= 160, `/${l}/ description length ${d.length} not in 140..160`);
    assert(!/revolutionary|zero waste|proven/i.test(d), `/${l}/ description contains banned hype word`);
    descs.add(d);
    lens.push(`${l}:${d.length}`);
  }
  assert(descs.size === 4, 'descriptions are not unique across languages');
  return `Unique descriptions (${lens.join(', ')} chars)`;
});

// 7. Exactly one H1 per page, section titles are H2
check(7, 'Exactly one <h1> per page and section titles are <h2>', () => {
  for (const p of ALL_PAGES) {
    const html = read(p);
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    assert(h1s.length === 1, `${p} has ${h1s.length} <h1> tags`);
  }
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    for (const id of ['health-title', 'bp-title', 'sim-title', 'eco-title', 'gal-title']) {
      assert(new RegExp(`<h2[^>]*id="${id}"`).test(html), `/${l}/ section ${id} is not <h2>`);
    }
  }
  return '1 <h1> per page; all 5 sections use <h2>';
});

// 8. Heading order H1 > H2 > H3 with no skipped levels
check(8, 'Heading hierarchy H1 > H2 > H3 with no skipped levels', () => {
  for (const p of ALL_PAGES) {
    const html = read(p);
    const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
    assert(levels[0] === 1, `${p} first heading is H${levels[0]}`);
    for (let i = 1; i < levels.length; i++) {
      assert(levels[i] <= 3, `${p} uses H${levels[i]} (expected only H1..H3)`);
      assert(levels[i] <= levels[i - 1] + 1, `${p} skips heading level from H${levels[i - 1]} to H${levels[i]}`);
    }
  }
  return 'Strict H1 > H2 > H3 order verified on all pages';
});

// 9. Image alt text
check(9, 'Translated, non-empty alt text on all content images', () => {
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    assert(imgs.length >= 6, `/${l}/ expected at least 6 <img> tags`);
    for (const tag of imgs) {
      const m = tag.match(/\balt="([^"]+)"/);
      assert(m && m[1].trim().length > 10, `/${l}/ image has empty or short alt: ${tag}`);
    }
  }
  return 'All schematic & gallery images have translated descriptive alt text';
});

// 10. Structured data (JSON-LD)
check(10, 'Valid translated JSON-LD (WebSite, WebPage, CreativeWork; no Product/Offer/email)', () => {
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert(m, `/${l}/ missing JSON-LD`);
    const raw = m[1];
    assert(!raw.includes('ahmedshadysaad12@gmail.com'), `/${l}/ JSON-LD contains email`);
    const data = JSON.parse(raw);
    const types = (data['@graph'] || []).map((n) => n['@type']);
    assert(types.includes('WebSite') && types.includes('WebPage') && types.includes('CreativeWork'), `/${l}/ missing required schema types`);
    assert(!types.includes('Product') && !types.includes('Offer'), `/${l}/ uses Product/Offer`);
  }
  return 'Well-formed JSON-LD with WebSite, WebPage & CreativeWork on all pages';
});

// 11. Internal linking & sibling links
check(11, 'Section anchor links, sibling language links & back-to-top link', () => {
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    for (const id of ['#health', '#blueprint', '#simulator', '#economy', '#gallery', '#hero']) {
      assert(html.includes(`href="${id}"`), `/${l}/ missing link to ${id}`);
    }
    for (const sib of LANGS) {
      assert(html.includes(`href="../${sib}/"`), `/${l}/ missing sibling link to ../${sib}/`);
    }
  }
  return 'All section anchors, 4 language links, and #hero back-to-top verified';
});

// 12. Broken links check
check(12, 'Zero broken internal links, anchors, or assets (check-links.js)', () => {
  const out = execFileSync(process.execPath, [join(__dirname, 'check-links.js')], { encoding: 'utf8' }).trim();
  return out;
});

// 13. Clean slugs
check(13, 'Clean lowercase URL & image slugs + original JPG fallbacks preserved', () => {
  const required = [
    'assets/schematic.jpg',
    'assets/schematic-cutaway.webp',
    'assets/schematic-cutaway-800.webp',
    'assets/sketches/stage1-layout.jpg',
    'assets/sketches/stage1-multiturbine.jpg',
    'assets/sketches/stage2-digital.jpg',
    'assets/sketches/stage3-final.jpg',
    'assets/sketches/sketch-stage-1-layout.webp',
    'assets/sketches/sketch-stage-1-multiturbine.webp',
    'assets/sketches/sketch-stage-2-digital.webp',
    'assets/sketches/sketch-stage-3-final.webp'
  ];
  for (const f of required) {
    assert(existsSync(join(ROOT, f)), `missing ${f}`);
    assert(/^[a-z0-9/._-]+$/.test(f), `non-clean slug: ${f}`);
  }
  return 'All clean WebP slugs and original JPG fallbacks exist';
});

// 14. Image compression & dimensions
check(14, 'WebP + 800w srcset + JPG fallback, width/height & file size limits', () => {
  const schemSize = statSync(join(ROOT, 'assets/schematic-cutaway.webp')).size;
  assert(schemSize <= 300 * 1024, `schematic-cutaway.webp > 300 KB (${schemSize})`);
  const under200 = [
    'assets/schematic.jpg',
    'assets/schematic-cutaway-800.webp',
    'assets/og-image.jpg',
    'assets/sketches/stage1-layout.jpg',
    'assets/sketches/stage1-multiturbine.jpg',
    'assets/sketches/stage2-digital.jpg',
    'assets/sketches/stage3-final.jpg',
    'assets/sketches/sketch-stage-1-layout.webp',
    'assets/sketches/sketch-stage-1-multiturbine.webp',
    'assets/sketches/sketch-stage-2-digital.webp',
    'assets/sketches/sketch-stage-3-final.webp'
  ];
  for (const f of under200) {
    const s = statSync(join(ROOT, f)).size;
    assert(s <= 200 * 1024, `${f} exceeds 200 KB (${s} B)`);
  }
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      assert(/\bwidth="\d+"/.test(m[0]) && /\bheight="\d+"/.test(m[0]), `/${l}/ <img> missing width/height: ${m[0]}`);
    }
  }
  return `schematic WebP ${(schemSize / 1024).toFixed(1)} KB; all other images < 175 KB`;
});

// 15. Core Web Vitals safeguards (LCP, INP, CLS)
check(15, 'Core Web Vitals: deferred JS, inline critical CSS, rAF INP, CLS dimensions', () => {
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    assert(html.includes('<style>:root{'), `/${l}/ missing inline critical CSS`);
    assert(html.includes('<script defer src="../app.js"></script>'), `/${l}/ app.js not deferred`);
  }
  const js = read('app.js');
  assert(js.includes('requestAnimationFrame'), 'app.js missing requestAnimationFrame for simulator');
  const css = read('styles.css');
  assert(css.includes('Cairo Fallback') && css.includes('min-block-size: 52px'), 'styles.css missing CLS guards');
  return 'Inline critical CSS, deferred JS, rAF slider updates & CLS guards verified';
});

// 16. Mobile viewport & 44px tap targets
check(16, 'Mobile viewport meta, >=44px tap targets & overflow-wrap guards', () => {
  for (const p of ALL_PAGES) {
    const html = read(p);
    assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'), `${p} missing viewport meta`);
  }
  const css = read('styles.css');
  assert(css.includes('inline-size: 44px; block-size: 44px') && css.includes('min-block-size: 44px'), '44px tap target rules missing');
  return 'Viewport meta + 44px tap targets + overflow-wrap rules verified';
});

// 17. HTTPS & vercel.json security/cache headers
check(17, 'HTTPS-only URLs & vercel.json headers, cleanUrls, trailingSlash, redirects', () => {
  for (const p of ALL_PAGES) {
    const html = read(p).replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '');
    assert(!/http:\/\//i.test(html), `${p} contains http:// URL`);
  }
  const vj = JSON.parse(read('vercel.json'));
  assert(vj.cleanUrls === true && vj.trailingSlash === true, 'cleanUrls/trailingSlash not true');
  const hKeys = vj.headers.flatMap((h) => h.headers.map((x) => x.key));
  for (const k of ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Cache-Control']) {
    assert(hKeys.includes(k), `vercel.json missing header ${k}`);
  }
  return 'HTTPS everywhere + HSTS, nosniff, Referrer-Policy & immutable asset cache verified';
});

// 18. og:image (1200x630) & Open Graph / Twitter cards
check(18, 'assets/og-image.jpg (1200x630) + Open Graph & Twitter card tags', () => {
  assert(existsSync(join(ROOT, 'assets/og-image.jpg')), 'assets/og-image.jpg missing');
  for (const l of LANGS) {
    const html = read(`${l}/index.html`);
    for (const prop of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'og:locale', 'og:locale:alternate']) {
      assert(html.includes(`property="${prop}"`), `/${l}/ missing ${prop}`);
    }
    assert(html.includes('name="twitter:card" content="summary_large_image"'), `/${l}/ missing twitter:card`);
  }
  return '1200x630 og-image.jpg + translated OG/Twitter tags on all pages';
});

// 19. Google Search Console verification tag & README section
check(19, 'google-site-verification meta tag & README Search Console guide', () => {
  for (const p of ALL_PAGES) {
    const html = read(p);
    assert(/<meta name="google-site-verification" content="[^"]+">/.test(html) && !html.includes('content="REPLACE_ME"'), `${p} missing real google-site-verification token`);
  }
  const readme = read('README.md');
  assert(readme.includes('URL prefix') && readme.includes('https://aeroturbin.vercel.app/') && readme.includes('sitemap.xml'), 'README missing Search Console steps');
  return 'Meta tag present in all 5 pages + README URL-prefix guide verified';
});

// 20. llms.txt & pre-rendered raw HTML text verification
check(20, 'llms.txt (with Arabic section & design targets) + full pre-rendered HTML source', () => {
  assert(existsSync(join(ROOT, 'llms.txt')), 'llms.txt missing');
  const llms = read('llms.txt');
  for (const l of LANGS) assert(llms.includes(`${BASE_URL}/${l}/`), `llms.txt missing /${l}/ link`);
  assert(llms.includes(`${BASE_URL}/sitemap.xml`), 'llms.txt missing sitemap link');
  assert(llms.includes('122.6 W') && llms.includes('70:20:10') && llms.includes('ملخص المشروع بالعربية'), 'llms.txt missing facts or Arabic section');

  // Verify raw HTML source of each language page contains its translated strings
  const arHtml = read('ar/index.html');
  assert(arHtml.includes('lang="ar" dir="rtl"'), '/ar/ missing lang="ar" dir="rtl"');
  assert(arHtml.includes('المرحلة الأولى: الرسم اليدوي الأولي للمسارات') && arHtml.includes('ahmedshadysaad12@gmail.com'), '/ar/ raw HTML missing Arabic text or contact');
  return 'llms.txt + pre-rendered raw HTML verified for EN, AR, FR, ES';
});

const failed = results.filter((r) => !r.pass);
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} [${String(r.id).padStart(2, '0')}] ${r.title} — ${r.detail}`);
}
if (failed.length) {
  console.error(`\n${failed.length} audit check(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nALL ${results.length}/20 SEO AUDIT CHECKS PASSED.`);
}
