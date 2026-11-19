#!/usr/bin/env node
/**
 * scripts/check-links.js
 * Crawls /index.html and /en/index.html, /ar/index.html, /fr/index.html, /es/index.html
 * and verifies every internal link, anchor target (#id), stylesheet, script, and image/srcset file,
 * plus rel="noopener" on external target="_blank" links.
 * Usage: node scripts/check-links.js
 */
const { readFileSync, existsSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const ROOT = join(__dirname, '..');
const PAGES = ['index.html', 'en/index.html', 'ar/index.html', 'fr/index.html', 'es/index.html'];

let checked = 0;
const errors = [];

function resolveLocal(fromDir, ref) {
  const clean = ref.split('?')[0].split('#')[0];
  if (!clean) return null;
  const full = clean.startsWith('/') ? join(ROOT, clean) : resolve(fromDir, clean);
  if (existsSync(full)) return full;
  if (existsSync(join(full, 'index.html'))) return join(full, 'index.html');
  return null;
}

for (const relPage of PAGES) {
  const pagePath = join(ROOT, relPage);
  if (!existsSync(pagePath)) {
    errors.push(`${relPage}: page file missing`);
    continue;
  }
  const html = readFileSync(pagePath, 'utf8');
  const dir = dirname(pagePath);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

  // Check <a href="...">
  for (const m of html.matchAll(/<a\b([^>]*?)href="([^"]+)"([^>]*)>/gi)) {
    const attrs = m[1] + ' ' + m[3];
    const href = m[2];
    checked++;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (/^https?:\/\//i.test(href)) {
      if (/\btarget="_blank"/i.test(attrs) && !/\brel="[^"]*noopener/i.test(attrs)) {
        errors.push(`${relPage}: external link ${href} missing rel="noopener"`);
      }
      continue;
    }
    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      if (targetId && !ids.has(targetId)) {
        errors.push(`${relPage}: broken anchor ${href}`);
      }
      continue;
    }
    const [pathPart, hashPart] = href.split('#');
    const resolved = resolveLocal(dir, pathPart);
    if (!resolved) {
      errors.push(`${relPage}: broken internal link ${href}`);
    } else if (hashPart) {
      const targetHtml = readFileSync(resolved, 'utf8');
      if (!new RegExp(`\\bid="${hashPart}"`).test(targetHtml)) {
        errors.push(`${relPage}: missing anchor #${hashPart} in ${href}`);
      }
    }
  }

  // Check <img src="...">, <script src="...">, <link rel="stylesheet" href="...">
  for (const m of html.matchAll(/<(?:img|script)\b[^>]*?\bsrc="([^"]+)"/gi)) {
    const src = m[1];
    checked++;
    if (src.startsWith('data:') || /^https?:\/\//i.test(src)) continue;
    if (!resolveLocal(dir, src)) errors.push(`${relPage}: missing asset ${src}`);
  }
  for (const m of html.matchAll(/<link\b[^>]*?\bhref="([^"]+)"[^>]*>/gi)) {
    const tag = m[0];
    const href = m[1];
    if (!/\brel="(?:stylesheet|icon)"/i.test(tag)) continue;
    checked++;
    if (href.startsWith('data:') || /^https?:\/\//i.test(href)) continue;
    if (!resolveLocal(dir, href)) errors.push(`${relPage}: missing linked file ${href}`);
  }

  // Check srcset="..."
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/gi)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (!url) continue;
      checked++;
      if (!resolveLocal(dir, url)) errors.push(`${relPage}: missing srcset image ${url}`);
    }
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} broken link(s) found across ${PAGES.length} pages:`);
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
} else {
  console.log(`PASS: Checked ${checked} links, anchors, and assets across ${PAGES.length} pages — 0 broken.`);
}
