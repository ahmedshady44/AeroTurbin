/* AeroTurbine: app.js
   Plain JavaScript, no build step. Works from file:// (uses i18n/bundle.js as a fallback) and on any static host.
   ---------------------------------------------------------------------------------------------- */
(function () {
  'use strict';

  /* =============================================================================================
     1. LANGUAGE LIST
     To add a language: create i18n/<code>.json, then add ONE line here.
     dir is "rtl" or "ltr". name is how the language is written in its own language.
     ============================================================================================= */
  const LANGUAGES = [
    { code: 'en', name: 'English', dir: 'ltr' },
    { code: 'ar', name: 'العربية', dir: 'rtl' },
    { code: 'fr', name: 'Français', dir: 'ltr' },
    { code: 'es', name: 'Español', dir: 'ltr' }
  ];
  const DEFAULT_LANG = 'en';

  /* =============================================================================================
     2. HOTSPOT CONFIG (schematic image)
     x and y are PERCENTAGES of the image (0 = left/top, 100 = right/bottom).
     To nudge a dot: change x (left/right) or y (up/down) by a point or two and refresh.
     "zone" is which blueprint zone the part belongs to. "concept: true" marks design-concept parts.
     Names and explanations live in i18n/*.json under "hotspots.<id>".
     The list order is the legend number (1, 2, 3 ...).
     ============================================================================================= */
  const HOTSPOTS = [
    { id: 'valve',   zone: 1, x: 12.0, y: 27.0 },   // 1  spring-loaded bypass valve
    { id: 'venturi', zone: 1, x: 22.0, y: 36.0 },   // 2  Venturi nozzle
    { id: 'turbines',zone: 1, x: 29.5, y: 33.0 },   // 3  two gold micro-turbines
    { id: 'scr',     zone: 2, x: 38.0, y: 42.0, concept: true },  // 4  passive SCR catalyst
    { id: 'urea',    zone: 2, x: 48.5, y: 58.0, concept: true },  // 5  solid-urea micro-dosing channel
    { id: 'ptpd',    zone: 2, x: 46.5, y: 44.0, concept: true },  // 6  Pt/Pd oxidation catalyst
    { id: 'fins',    zone: 2, x: 58.5, y: 47.0 },   // 7  cooling fins
    { id: 'lime',    zone: 2, x: 70.0, y: 49.0 },   // 8  lime honeycomb cartridge
    { id: 'carbon',  zone: 2, x: 83.0, y: 52.0 },   // 9  activated carbon cartridge
    { id: 'ecu',     zone: 3, x: 78.0, y: 18.0 }    // 10 ECU and battery
  ];

  /* Gas-flow step-through: x is the position on the SVG (0 to 1000), hl lists the parts to highlight. */
  const FLOW = [
    { x: 60,  hl: ['g-valve'] },
    { x: 215, hl: ['g-venturi', 'g-turbines', 'g-teg'] },
    { x: 352, hl: ['g-cat'] },
    { x: 450, hl: ['g-fins'] },
    { x: 530, hl: ['g-l1'] },
    { x: 638, hl: ['g-l2'] },
    { x: 734, hl: ['g-l3'] },
    { x: 900, hl: ['g-sensors'] }
  ];

  const CONTACT_EMAIL = 'ahmedshadysaad12@gmail.com';
  const SVG_W = 1000;      // blueprint viewBox width, used to mirror labels in RTL

  /* Simulator constants. 50.6, 72.0 and 70 come from the design targets.
     The others are demo assumptions (see the "assumptions" note on the page). */
  const SIM = { turbineMax: 50.6, tegMax: 72.0, reductionMax: 70, tMin: 100, tSpan: 300, lifeHours: 600, heatLimit: 60, minHealth: 0.4 };

  /* ---------------------------------------------------------------------------------------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  /* =============================================================================================
     3. i18n
     ============================================================================================= */
  const dicts = {};
  let cur = DEFAULT_LANG;

  async function loadDict(code) {
    if (dicts[code]) return dicts[code];
    try {
      const r = await fetch('i18n/' + code + '.json');
      if (!r.ok) throw new Error('http ' + r.status);
      dicts[code] = await r.json();
    } catch (e) {
      // file:// or offline: fall back to the pre-built bundle (see README)
      if (window.AERO_I18N && window.AERO_I18N[code]) dicts[code] = window.AERO_I18N[code];
      else throw e;
    }
    return dicts[code];
  }
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function t(key, vars) {
    let v = getPath(dicts[cur], key);
    if (v === undefined && dicts[DEFAULT_LANG]) v = getPath(dicts[DEFAULT_LANG], key);
    if (v === undefined) return key;
    if (vars && typeof v === 'string') v = v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return v;
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* Keeps formulas, numbers and units readable inside right-to-left text:
     they are wrapped in an isolated left-to-right <bdi>, with subscripts for chemical formulas. */
  const RICH_RE = new RegExp([
    'Ca\\(OH\\)2 \\+ CO2 → CaCO3 \\+ H2O',
    'NOx \\+ NH3 → N2 \\+ H2O',
    'CO \\+ O2 → CO2',
    'HC \\+ O2 → CO2 \\+ H2O',
    'Team AeroTurbine',
    'Harvard VISION 2026',
    'PM2\\.5', 'CaSO4', 'CaCO3', 'LiFePO4', 'NO2', 'SO2', 'CO2', 'NOx', 'NH3', '70:20:10',
    '(?<![A-Za-z\\d.])\\+?\\d+(?:[.,]\\d+)?(?:–\\d+(?:[.,]\\d+)?)?(?:\\s?(?:µg\\/m³|°C|Wh|W|%|h|USD)(?![A-Za-z]))?'
  ].join('|'), 'g');
  function rich(text) {
    return esc(text).replace(RICH_RE, (m) => {
      const isChem = /^(?:Ca|NO|CO|HC|PM|SO|Li|NH)/.test(m);
      const inner = isChem ? m.replace(/(PM)(2\.5)/, '$1<sub>$2</sub>').replace(/([A-Za-z)])(\d)/g, '$1<sub>$2</sub>') : m;
      return '<bdi class="ltr" dir="ltr">' + inner + '</bdi>';
    });
  }

  function translate(root) {
    $$('[data-i18n]', root).forEach((el) => {
      const v = t(el.getAttribute('data-i18n'));
      if (el instanceof SVGElement) {
        el.textContent = v;
      } else if (el.classList.contains('f-authors') && v.includes(' | ')) {
        const parts = v.split(' | ');
        el.innerHTML = rich(parts[0]) + ' | <span class="f-co">' + rich(parts.slice(1).join(' | ')) + '</span>';
      } else {
        el.innerHTML = rich(v);
      }
    });
    $$('[data-i18n-attr]', root).forEach((el) => {
      el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
        const i = pair.indexOf(':');
        el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
      });
    });
  }

  const locale = () => cur + '-u-nu-latn';
  const fmt = (n, d) => new Intl.NumberFormat(locale(), { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(n);
  /* number + unit; Latin units stay left-to-right, native-script units follow the text direction */
  function vu(num, unit) {
    const s = num + ' ' + unit;
    return /^[A-Za-z%°µ]/.test(unit) ? '<bdi dir="ltr">' + esc(s) + '</bdi>' : esc(s);
  }
  const plain = (h) => h.replace(/<[^>]+>/g, '');

  /* =============================================================================================
     4. Language switching
     ============================================================================================= */
  function detectLang() {
    const saved = store.get('aero-lang');
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || DEFAULT_LANG];
    for (const p of prefs) {
      const c = String(p).toLowerCase().split('-')[0];
      if (LANGUAGES.some((l) => l.code === c)) return c;
    }
    return DEFAULT_LANG;
  }

  async function setLang(code, save) {
    if (!LANGUAGES.some((l) => l.code === code)) code = DEFAULT_LANG;
    if (code !== DEFAULT_LANG) { try { await loadDict(DEFAULT_LANG); } catch (e) { /* optional fallback */ } }
    await loadDict(code);
    cur = code;
    const L = LANGUAGES.find((l) => l.code === code);
    html.lang = code;
    html.dir = L.dir;
    if (save) store.set('aero-lang', code);
    if (code === 'ar') loadArabicFont();

    translate(document);
    document.title = t('meta.title');
    const md = $('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.description'));
    $('#lang-select').value = code;

    positionBlueprint();
    updateHotspotLabels();
    buildFormulas();
    flowRender();
    simRender();
    loopRender();
    themeLabel();
    renderPanel();
  }

  let fontLoaded = false;
  function loadArabicFont() {
    if (fontLoaded) return;
    fontLoaded = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800;900&display=swap';
    document.head.appendChild(l); // optional: if offline, the system Arabic font is used
  }

  /* =============================================================================================
     5. Theme and banner
     ============================================================================================= */
  function themeLabel() {
    const dark = html.getAttribute('data-theme') !== 'light';
    const b = $('#theme-toggle');
    const txt = t(dark ? 'theme.toLight' : 'theme.toDark');
    b.setAttribute('aria-label', txt);
    b.title = txt;
  }
  function initTheme() {
    $('#theme-toggle').addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      store.set('aero-theme', next);
      themeLabel();
    });
  }
  function initBanner() {
    // Dismissed only for this page view. It comes back on every load, on purpose.
    $('#banner-close').addEventListener('click', () => { $('#banner').hidden = true; });
  }

  /* =============================================================================================
     6. Blueprint (SVG), panel, flow
     ============================================================================================= */
  function positionBlueprint() {
    const rtl = html.dir === 'rtl';
    $('#bp-shapes').setAttribute('transform', rtl ? 'translate(' + SVG_W + ' 0) scale(-1 1)' : '');
    $$('#bp-labels text').forEach((tx) => {
      const x = +tx.dataset.x;
      tx.setAttribute('x', rtl ? SVG_W - x : x);
      tx.setAttribute('y', tx.dataset.y);
      if (tx.dataset.anchor === 'start') tx.style.textAnchor = rtl ? 'end' : 'start';
    });
  }

  const panel = () => $('#panel');
  let panelState = null;
  let lastTrigger = null;

  function el(tag, cls, inner) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (inner !== undefined) n.innerHTML = inner;
    return n;
  }
  function list(items) {
    const ul = el('ul');
    items.forEach((s) => ul.appendChild(el('li', '', rich(s))));
    return ul;
  }
  function stats(items) {
    const dl = el('dl', 'p-stats');
    items.forEach((s) => {
      const d = el('div');
      d.appendChild(el('dt', '', rich(s.l)));
      d.appendChild(el('dd', '', rich(s.v)));
      dl.appendChild(d);
    });
    return dl;
  }

  function renderPanel() {
    const body = $('#panel-body');
    const title = $('#panel-title');
    if (!panelState) return;
    body.textContent = '';
    if (panelState.type === 'zone') {
      const id = panelState.id;
      const z = 'zones.z' + id;
      title.textContent = t(z + '.title');
      body.appendChild(el('p', 'p-plain', rich(t(z + '.plain'))));
      body.appendChild(el('h3', 'p-h', esc(t('panel.components'))));
      body.appendChild(list(t(z + '.components')));
      if (id === 1) body.appendChild(el('p', 'note-box', rich(t('schematic.tegNote'))));
      if (id === 2) {
        const layers = t('zones.z2.layers');
        body.appendChild(el('h3', 'p-h', esc(t('panel.ratioTitle'))));
        body.appendChild(el('p', 'p-note', esc(t('panel.ratioOrder'))));
        const chips = el('div', 'flow-chips');
        layers.forEach((l, i) => {
          if (i) chips.appendChild(el('span', 'arr', '<svg class="dir-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'));
          chips.appendChild(el('span', 'c c' + (i + 1), rich((i + 1) + ' · ' + l.name + ' ' + l.pct)));
        });
        body.appendChild(chips);
        body.appendChild(el('div', 'ratio', '<i class="r1"></i><i class="r2"></i><i class="r3"></i>'));
        body.appendChild(el('p', 'p-note', rich(t('panel.ratioText'))));
        const ol = el('ul');
        layers.forEach((l) => ol.appendChild(el('li', '', '<strong>' + rich(l.n + ': ' + l.name + ' (' + l.pct + ')') + '</strong><br>' + rich(l.role))));
        body.appendChild(ol);
        body.appendChild(el('p', 'p-note', rich(t('panel.intent'))));
        const cat = el('div', 'cat-box');
        cat.appendChild(el('h3', '', rich(t('panel.catTitle'))));
        const cl = el('ul');
        ['scr', 'urea', 'ptpd'].forEach((k) => cl.appendChild(el('li', '', '<strong>' + rich(t('hotspots.' + k + '.name')) + '</strong>: ' + rich(t('hotspots.' + k + '.desc')))));
        cat.appendChild(cl);
        cat.appendChild(el('p', 'p-note', rich(t('panel.catNote'))));
        body.appendChild(cat);
      }
      const st = t(z + '.stats');
      if (st && st.length) {
        body.appendChild(el('h3', 'p-h', esc(t('panel.numbers')) + ' <span class="tag tag-target">' + esc(t('tag.target')) + '</span>'));
        body.appendChild(stats(st));
      }
      body.appendChild(el('p', 'p-note', rich(t(z + '.statsNote'))));
    } else {
      const h = HOTSPOTS.find((x) => x.id === panelState.id);
      const n = HOTSPOTS.indexOf(h) + 1;
      title.textContent = n + '. ' + t('hotspots.' + h.id + '.name');
      if (h.concept) body.appendChild(el('p', '', '<span class="tag tag-concept">' + esc(t('tag.concept')) + '</span>'));
      body.appendChild(el('p', 'p-plain', rich(t('hotspots.' + h.id + '.desc'))));
      const b = el('button', 'btn btn-ghost jump', esc(t('panel.partOf') + ' ' + t('zones.z' + h.zone + '.title')));
      b.type = 'button';
      b.addEventListener('click', () => openPanel({ type: 'zone', id: h.zone }));
      body.appendChild(b);
    }
    markActive();
  }

  function openPanel(state, trigger) {
    panelState = state;
    if (trigger) lastTrigger = trigger;
    renderPanel();
    panel().classList.add('open');
    $('#panel-body').scrollTop = 0;
    $('#panel-title').focus({ preventScroll: true });
  }
  function closePanel() {
    if (!panelState) return;
    panel().classList.remove('open');
    panelState = null;
    markActive();
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }
  function markActive() {
    const zone = panelState ? (panelState.type === 'zone' ? panelState.id : HOTSPOTS.find((h) => h.id === panelState.id).zone) : 0;
    $$('#bp .zone').forEach((z) => { const on = +z.dataset.zone === zone; z.classList.toggle('active', on); z.setAttribute('aria-pressed', String(on)); });
    $$('.chip-btn').forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.zone === zone)));
    $$('.hs').forEach((b) => b.classList.toggle('active', !!panelState && panelState.type === 'hotspot' && b.dataset.hs === panelState.id));
  }

  function initBlueprint() {
    $$('#bp .zone').forEach((z) => {
      const open = () => openPanel({ type: 'zone', id: +z.dataset.zone }, z);
      z.addEventListener('click', open);
      z.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      z.setAttribute('aria-label', '');
    });
    $$('.chip-btn').forEach((c) => c.addEventListener('click', () => openPanel({ type: 'zone', id: +c.dataset.zone }, c)));
    $('#panel-close').addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#lightbox').open) closePanel();
    });
    $('#flow-next').addEventListener('click', () => { flowStep((flowIdx + 1) % FLOW.length); });
    $('#flow-play').addEventListener('click', () => { flowTimer ? flowStop() : flowStart(); });
  }
  function zoneLabels() {
    $$('#bp .zone').forEach((z) => z.setAttribute('aria-label', t('zones.z' + z.dataset.zone + '.title')));
  }

  let flowIdx = 0;
  let flowTimer = null;
  function flowStep(i) { flowIdx = i; flowRender(); }
  function flowStart() { flowTimer = setInterval(() => flowStep((flowIdx + 1) % FLOW.length), 3200); flowRender(); }
  function flowStop() { clearInterval(flowTimer); flowTimer = null; flowRender(); }
  function flowRender() {
    zoneLabels();
    const s = FLOW[flowIdx];
    $('#flow-no').textContent = t('blueprint.stepOf', { n: flowIdx + 1, total: FLOW.length });
    $('#flow-text').innerHTML = rich(t('blueprint.steps.' + flowIdx));
    $('#flow-dot').style.transform = 'translate(' + s.x + 'px, 0px)';
    $$('#bp .hl').forEach((n) => n.classList.remove('hl'));
    s.hl.forEach((id) => { const n = document.getElementById(id); if (n) n.classList.add('hl'); });
    const pb = $('#flow-play');
    pb.textContent = t(flowTimer ? 'blueprint.pause' : 'blueprint.play');
    pb.setAttribute('aria-pressed', String(!!flowTimer));
  }

  /* =============================================================================================
     7. Schematic image: hotspots, legend, zoom, WebP
     ============================================================================================= */
  function initSchematic() {
    const box = $('#hotspots');
    const leg = $('#legend');
    HOTSPOTS.forEach((h, i) => {
      const b = el('button', 'hs' + (h.concept ? ' concept' : ''), String(i + 1));
      b.type = 'button';
      b.style.left = h.x + '%';   // physical left on purpose: the picture is never mirrored
      b.style.top = h.y + '%';
      b.dataset.hs = h.id;
      b.addEventListener('click', () => openPanel({ type: 'hotspot', id: h.id }, b));
      box.appendChild(b);

      const li = el('li');
      const lb = el('button', h.concept ? 'concept' : '');
      lb.type = 'button';
      lb.innerHTML = '<span class="num">' + (i + 1) + '</span><span><strong data-i18n="hotspots.' + h.id + '.name"></strong><span class="d" data-i18n="hotspots.' + h.id + '.desc"></span>' + (h.concept ? ' <span class="tag tag-concept" data-i18n="tag.concept"></span>' : '') + '</span>';
      lb.addEventListener('click', () => openPanel({ type: 'hotspot', id: h.id }, lb));
      li.appendChild(lb);
      leg.appendChild(li);
    });

    // Load WebP when the browser can use it and the file exists; otherwise the JPG.
    const pic = $('#schem-pic');
    const img = $('#schem-img');
    const loadImg = () => {
      const probe = new Image();
      probe.onload = () => {
        const s = document.createElement('source');
        s.type = 'image/webp';
        s.srcset = pic.dataset.webp;
        pic.insertBefore(s, img);
        img.src = img.dataset.src;
      };
      probe.onerror = () => { img.src = img.dataset.src; };
      probe.src = pic.dataset.webp;
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); loadImg(); } }, { rootMargin: '600px' });
      io.observe(pic);
    } else loadImg();

    $('#schem-zoom').addEventListener('click', () => openLightbox(img.currentSrc || img.src, t('schematic.alt'), t('schematic.caption')));
  }
  function updateHotspotLabels() {
    HOTSPOTS.forEach((h, i) => {
      const b = $('.hs[data-hs="' + h.id + '"]');
      const name = t('hotspots.' + h.id + '.name');
      b.setAttribute('aria-label', (i + 1) + '. ' + name + (h.concept ? ' (' + t('tag.concept') + ')' : ''));
      b.title = name;
    });
  }

  /* =============================================================================================
     8. Lightbox (schematic + sketches). Esc closes (native <dialog>).
     ============================================================================================= */
  function openLightbox(src, alt, cap) {
    const d = $('#lightbox');
    $('#lb-img').src = src;
    $('#lb-img').alt = alt || '';
    $('#lb-cap').textContent = cap || '';
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function initLightbox() {
    const d = $('#lightbox');
    $('#lb-close').addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }

  /* =============================================================================================
     9. Gallery
     ============================================================================================= */
  function initGallery() {
    $$('#gallery-grid .tile').forEach((b, i) => {
      const img = $('img', b);
      const src = $('source', b);
      if (src) {
        img.addEventListener('error', () => { if (src.parentNode) src.remove(); }, { once: true });
      }
      b.addEventListener('click', () => {
        openLightbox(img.currentSrc || img.src, t('gallery.alts.' + i), t('gallery.captions.' + i));
      });
    });
    const cl = $('#contact-email');
    if (cl) {
      cl.href = 'mailto:' + CONTACT_EMAIL;
      const sp = $('span', cl);
      if (sp) sp.textContent = CONTACT_EMAIL;
    }
  }

  /* =============================================================================================
     10. Simulator
     ============================================================================================= */
  const inputs = {};
  function simCalc() {
    const flow = clamp(+inputs.flow.value / 100, 0, 1);
    const hours = +inputs.hours.value;
    const texh = +inputs.texh.value;
    const tcart = +inputs.tcart.value;
    const days = +inputs.days.value;

    const turbine = SIM.turbineMax * Math.pow(flow, 1.5);
    const tempFactor = clamp((texh - SIM.tMin) / SIM.tSpan, 0, 1);
    const teg = SIM.tegMax * tempFactor * flow;
    const total = turbine + teg;
    const energy = total * hours;

    const load = clamp((days * hours) / SIM.lifeHours, 0, 1);
    const base = 1 - (1 - SIM.minHealth) * load * load;               // 1 -> 0.4 at saturation
    const heat = tcart <= SIM.heatLimit ? 1 : Math.max(SIM.minHealth, 1 - 0.6 * (tcart - SIM.heatLimit) / 40);
    const health = base * heat;
    const reduction = SIM.reductionMax * health;
    const hoursLeft = Math.max(0, SIM.lifeHours - days * hours);
    return { flow, hours, texh, tcart, days, turbine, teg, total, energy, load, health, reduction, hoursLeft };
  }

  function simRender() {
    if (!inputs.flow) return;
    const r = simCalc();
    const set = (id, h) => { const n = $('#' + id); n.innerHTML = h; return n; };
    const U = (k) => t('sim.' + k);

    const o = {
      flow: vu(fmt(+inputs.flow.value), U('unitPct')),
      hours: vu(fmt(r.hours), U('unitH')),
      texh: vu(fmt(r.texh), U('unitC')),
      tcart: vu(fmt(r.tcart), U('unitC')),
      days: vu(fmt(r.days), U('unitD'))
    };
    ['flow', 'hours', 'texh', 'tcart', 'days'].forEach((k) => {
      set('o-' + k, o[k]);
      inputs[k].setAttribute('aria-valuetext', plain(o[k]));
    });
    $('#o-tcart').classList.toggle('hot', r.tcart > SIM.heatLimit);

    set('r-total', vu(fmt(r.total, 1), U('unitW')));
    set('r-turbine', vu(fmt(r.turbine, 1), U('unitW')));
    set('r-teg', vu(fmt(r.teg, 1), U('unitW')));
    set('r-energy', vu(fmt(r.energy, 0), U('unitWh')));
    set('r-reduction', vu(fmt(r.reduction, 0), U('unitPct')));
    set('r-health', vu(fmt(r.health * 100, 0), U('unitPct')));
    const max = SIM.turbineMax + SIM.tegMax;
    $('#bar-turbine').style.inlineSize = (r.turbine / max * 100) + '%';
    $('#bar-teg').style.inlineSize = (r.teg / max * 100) + '%';

    const sw = $('#swap');
    const state = r.load >= 0.9 ? 'now' : r.load >= 0.6 ? 'soon' : 'ok';
    sw.className = 'swap ' + state + (r.tcart > SIM.heatLimit ? ' hot' : '');
    $('#swap-state').textContent = t('sim.swap' + state.charAt(0).toUpperCase() + state.slice(1));
    const dl = $('#swap-days');
    if (r.hours === 0) dl.textContent = t('sim.swapNoUse');
    else if (r.hoursLeft <= 0) dl.textContent = '';
    else dl.textContent = t('sim.swapDays', { d: fmt(Math.floor(r.hoursLeft / r.hours)) });
    $('#swap-heat').textContent = t(r.tcart > SIM.heatLimit ? 'sim.swapHot' : 'sim.swapCool');
  }
  function buildFormulas() {
    const ol = $('#formula-list');
    ol.textContent = '';
    (t('sim.formulaList') || []).forEach((s) => ol.appendChild(el('li', '', rich(s))));
  }
  function initSim() {
    ['flow', 'hours', 'texh', 'tcart', 'days'].forEach((k) => {
      inputs[k] = $('#s-' + k);
      inputs[k].addEventListener('input', simRender);
    });
  }

  /* =============================================================================================
     11. Circular loop pause/play
     ============================================================================================= */
  let loopPaused = reduced;
  function loopRender() {
    const svg = $('#loop-svg');
    try { loopPaused ? svg.pauseAnimations() : svg.unpauseAnimations(); } catch (e) { /* ignore */ }
    $('#loop-toggle').textContent = t(loopPaused ? 'economy.play' : 'economy.pause');
  }
  function initLoop() {
    $('#loop-toggle').addEventListener('click', () => { loopPaused = !loopPaused; loopRender(); });
  }

  /* =============================================================================================
     12. Header: language select + current section
     ============================================================================================= */
  function initHeader() {
    const sel = $('#lang-select');
    LANGUAGES.forEach((l) => {
      const o = document.createElement('option');
      o.value = l.code; o.textContent = l.name; o.lang = l.code;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => setLang(sel.value, true));
    if ('IntersectionObserver' in window) {
      const links = $$('.nav a');
      const io = new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (e.isIntersecting) links.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id));
        });
      }, { rootMargin: '-35% 0px -60% 0px' });
      $$('main section[id]').forEach((s) => io.observe(s));
    }
  }

  /* =============================================================================================
     Start
     ============================================================================================= */
  async function init() {
    initHeader(); initTheme(); initBanner(); initBlueprint(); initSchematic();
    initLightbox(); initGallery(); initSim(); initLoop();
    try {
      await setLang(detectLang(), false);
    } catch (e) {
      document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px;font:16px sans-serif">Could not load the translation files. Open the site through a web server, or run <code>node tools/build-i18n.mjs</code> (see README).</p>');
      throw e;
    }
    html.classList.add('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
