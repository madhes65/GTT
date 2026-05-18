/**
 * Gold Price Tracker — Shared Scraper Utilities (v3.0)
 *
 * Covers both 22K (916) and 24K (999) products.
 * findBrandCards() triggers on brand keywords, purity keywords,
 * or product-type keywords — whichever appears first.
 */

window._GPT = window._GPT || {};

// ─── All trigger keywords (22K + 24K + product types) ────────────────────────
const _ALL_KW = [
  // 22K variants
  '22k', '22 k', '22kt', '22 kt', '22karat', '22 karat', '916',
  // 24K variants
  '24k', '24 k', '24kt', '24 kt', '24karat', '24 karat', '999.9', '999 purity', '999 gold',
  // product types
  'gold coin', 'gold coins', 'gold bar', 'gold bars', 'gold wafer',
];

// ─── Price parser ─────────────────────────────────────────────────────────────
window._GPT.parsePrice = function (raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[₹,\sRs.]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) || val < 100 ? null : val;
};

// ─── Price from raw text block ────────────────────────────────────────────────
window._GPT.extractPriceFromText = function (text) {
  if (!text) return null;
  const m = String(text).match(/₹\s*([\d,]+(?:\.\d+)?)/);
  return m ? window._GPT.parsePrice(m[1]) : null;
};

// ─── Safe text reader (textContent preferred over innerText) ──────────────────
window._GPT.getText = function (el) {
  if (!el) return '';
  return (el.textContent || el.innerText || '').trim();
};

// ─── Weight extractor ─────────────────────────────────────────────────────────
window._GPT.extractWeight = function (text) {
  if (!text) return null;
  const t = String(text);
  const patterns = [
    { re: /(\d+(?:\.\d+)?)\s*[-–]?\s*(?:kg|kilo(?:gram)?s?)\b/i, mult: 1000 },
    { re: /(\d+(?:\.\d+)?)\s*[-–]?\s*g(?:rams?|m)?\b/i, mult: 1 },
  ];
  for (const { re, mult } of patterns) {
    const m = t.match(re);
    if (m) {
      const grams = parseFloat(m[1]) * mult;
      if (grams >= 0.5 && grams <= 500) return { grams, label: `${grams}g` };
    }
  }
  return null;
};

// ─── Purity detector — returns '22K', '24K', or '—' ─────────────────────────
window._GPT.detectPurity = function (text) {
  if (!text) return '—';
  const t = String(text).toLowerCase();
  const is24 = t.includes('24k') || t.includes('24 k') || t.includes('24kt') ||
               t.includes('24 kt') || t.includes('24karat') || t.includes('24 karat') ||
               t.includes('999.9') || t.includes('999 purity') || t.includes('999 gold');
  const is22 = t.includes('22k') || t.includes('22 k') || t.includes('22kt') ||
               t.includes('22 kt') || t.includes('22karat') || t.includes('22 karat') ||
               t.includes('916');
  if (is24) return '24K';
  if (is22) return '22K';
  return '—';
};

// ─── Brand matching ───────────────────────────────────────────────────────────
window._GPT.matchBrand = function (text) {
  const brands = window._GPT_BRANDS || [];
  if (!brands.length) return { id: 'unknown', name: '—' };
  const hay = String(text || '').toLowerCase();
  for (const brand of brands) {
    for (const kw of brand.keywords) {
      if (hay.includes(kw.toLowerCase())) return brand;
    }
  }
  return null;
};

// ─── UNIVERSAL CARD FINDER (v3.0) ────────────────────────────────────────────
// Triggers on brand keywords OR purity keywords OR product-type keywords.
window._GPT.findBrandCards = function () {
  const brands   = window._GPT_BRANDS || [];
  const brandKws = brands.flatMap(b => b.keywords).map(k => k.toLowerCase());

  const PRICE_RE  = /₹\s*[\d,]+/;
  const WEIGHT_RE = /\d+\s*[-–]?\s*g(?:rams?|m)?\b/i;

  const cardSet = new Set();
  const walker  = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

  let node;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || '').toLowerCase().trim();
    if (text.length < 2) continue;

    const hit = brandKws.some(kw => text.includes(kw)) ||
                _ALL_KW.some(kw => text.includes(kw));
    if (!hit) continue;

    let el = node.parentElement;
    for (let d = 0; d < 15 && el && el !== document.body; d++) {
      const full = el.textContent || '';
      if (full.length > 30 && full.length < 4000 &&
          PRICE_RE.test(full) && WEIGHT_RE.test(full) &&
          el.querySelectorAll('a[href]').length > 0) {
        // Skip if the card is about silver/platinum
        if (!_EXCLUDE_KW.some(kw => full.toLowerCase().includes(kw))) { cardSet.add(el); }
        break;
      }
      el = el.parentElement;
    }
  }

  const all = Array.from(cardSet);
  return all.filter(c => !all.some(o => o !== c && c.contains(o)));
};

// ─── Offer extractor ─────────────────────────────────────────────────────────
window._GPT.extractOffers = function (container, selectors) {
  const offers = [];
  for (const sel of (selectors || [])) {
    try { container.querySelectorAll(sel).forEach(el => {
      const t = window._GPT.getText(el);
      if (t.length > 2) offers.push(t);
    }); } catch (_) {}
  }
  if (!offers.length) {
    (container.textContent || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      if (/bank offer|coupon|cashback|off on|save|promo|hdfc|sbi|icici|axis|emi/i.test(line) && line.length < 120)
        offers.push(line);
    });
  }
  return [...new Set(offers)].slice(0, 5);
};

// ─── URL extractor ────────────────────────────────────────────────────────────
window._GPT.extractUrl = function (card, baseUrl) {
  const link = card.querySelector('a[href*="/dp/"], a[href*="/p/"], a[href*="/buy"], a[href*="/product"], a[href]');
  if (!link) return '';
  const href = link.href || link.getAttribute('href') || '';
  if (!href || href === '#') return '';
  return href.startsWith('http') ? href : (baseUrl || '') + href;
};

// ─── Image extractor ─────────────────────────────────────────────────────────
window._GPT.extractImage = function (card) {
  const img = card.querySelector('img[src*="http"], img[data-src]');
  return img ? (img.src || img.getAttribute('data-src') || '') : '';
};

// ─── Exclusion filter ─────────────────────────────────────────────────────────
// Returns true if the text is about silver, platinum or other non-gold metals.
// Call this BEFORE pushing any result — if true, skip the product.
const _EXCLUDE_KW = [
  'silver', 'platinum', 'palladium', 'rhodium',
  'silver coin', 'silver bar', 'silver wafer',
  'platinum coin', 'platinum bar',
];

window._GPT.isExcluded = function (text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return _EXCLUDE_KW.some(kw => t.includes(kw));
};

// ─── Allowed credit cards for offer-price calculation ────────────────────────
// Only discounts from these cards are applied to the effective price.
// Other bank offers are shown in the Offers column but ignored for pricing.
const _ALLOWED_CARDS = [
  { label: 'HDFC Infinia',         kw: ['hdfc infinia', 'infinia'] },
  { label: 'HDFC Marriott Bonvoy', kw: ['marriott bonvoy', 'hdfc marriott', 'bonvoy'] },
  { label: 'Axis Magnus',          kw: ['axis magnus', 'magnus'] },
  { label: 'Axis Atlas',           kw: ['axis atlas'] },
  { label: 'SBI Credit Card',      kw: ['sbi credit', 'sbi card', '\bsbi\b'] },
  { label: 'RBL Credit Card',      kw: ['rbl credit', 'rbl card', '\brbl\b'] },
  { label: 'ICICI Credit Card',    kw: ['icici credit', 'icici card', '\bicici\b'] },
  { label: 'Amex',                 kw: ['amex', 'american express'] },
];

// Returns the matched card label if the offer text mentions an allowed card, else null.
window._GPT.getAllowedCard = function (offerText) {
  const t = String(offerText).toLowerCase();
  for (const card of _ALLOWED_CARDS) {
    for (const kw of card.kw) {
      const re = new RegExp(kw, 'i');
      if (re.test(t)) return card.label;
    }
  }
  return null;
};

// ─── Offer-price extractor ────────────────────────────────────────────────────
// Only applies discounts from the 8 allowed credit cards.
// Handles: absolute price ("₹4,299 with HDFC Infinia"),
//          flat discount ("Flat ₹500 off"), percentage ("10% off").
window._GPT.extractBestPrice = function (offers, listedPrice) {
  if (!offers || !offers.length || !listedPrice) return listedPrice;

  let best = listedPrice;

  for (const offer of offers) {
    const t = String(offer);

    // Skip if no allowed card is mentioned in this offer
    if (!window._GPT.getAllowedCard(t)) continue;

    // Pattern 1: absolute offer price — "₹4,299 with Amex" / "at ₹4,099 for HDFC Infinia"
    const absRe = /(?:at|for|price\s*:?|effective\s+price\s*:?)?\s*₹\s*([\d,]+(?:\.\d+)?)/gi;
    let m;
    while ((m = absRe.exec(t)) !== null) {
      const candidate = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(candidate) && candidate < best && candidate > listedPrice * 0.5) {
        best = candidate;
      }
    }

    // Pattern 2: flat rupee discount — "Flat ₹500 off with SBI" / "Save ₹200 on RBL card"
    const flatRe = /(?:flat|save|get|extra|additional|instant)?\s*₹\s*([\d,]+)\s*(?:off|discount|cashback)/i;
    const fm = t.match(flatRe);
    if (fm) {
      const disc = parseFloat(fm[1].replace(/,/g, ''));
      if (!isNaN(disc) && disc > 0) {
        const candidate = listedPrice - disc;
        if (candidate > listedPrice * 0.5 && candidate < best) best = candidate;
      }
    }

    // Pattern 3: percentage discount — "10% off with ICICI" / "Extra 5% with Axis Magnus"
    const pctRe = /(?:extra|additional|instant|flat|upto|up\s+to)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:off|discount|cashback|instant)/i;
    const pm = t.match(pctRe);
    if (pm) {
      const pct = parseFloat(pm[1]);
      if (!isNaN(pct) && pct > 0 && pct <= 40) {
        const candidate = listedPrice * (1 - pct / 100);
        if (candidate > listedPrice * 0.5 && candidate < best) best = candidate;
      }
    }
  }

  return +best.toFixed(2);
};
