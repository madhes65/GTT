/**
 * Gold Scan Engine — Final v12
 *
 * Matching rule (simplified): brand + purity + price
 *   • Brand keyword match (Kalyan / Malabar / MMTC-PAMP / Bangalore Refinery / Joyalukkas)
 *   • Purity keyword: 24K | 24KT | 24 k | 24 kt | 999 | 999.9 | 99.9
 *   • Price ≥ ₹500
 *   • NOT 22K / 22KT / 916 (hard rejected)
 *   • Weight — extracted when available, NOT required (design names etc. ignored)
 *
 * No item-count cap — show all matching results.
 * All 5 portals scanned in PARALLEL (no Railway timeout).
 *
 * Setup: Railway Variables → SCRAPER_API_KEY = <free key from scraperapi.com>
 */

const express = require('express');
const cheerio = require('cheerio');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname)));

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';
const HAS_PROXY       = !!SCRAPER_API_KEY;

// ─── Brands ───────────────────────────────────────────────────────────────────
const BRANDS = [
  { id:'kalyan',            name:'Kalyan Jewellers',  kw:['kalyan'] },
  { id:'malabar',           name:'Malabar Gold',       kw:['malabar'] },
  { id:'mmtcpamp',          name:'MMTC-PAMP',          kw:['mmtc','mmtc-pamp','mmtcpamp','pamp'] },
  { id:'bangalorerefinery', name:'Bangalore Refinery', kw:['bangalore refinery','bangalore ref','bgr gold'] },
  { id:'joyalukkas',        name:'Joyalukkas',         kw:['joyalukkas'] },
];

const EXCLUDE_KW = ['silver','platinum','palladium','rhodium'];

// ─── Purity detection ─────────────────────────────────────────────────────────
// Accepts: 24K, 24KT, 24 K, 24 KT, 24 k, 24kt, 24karat, 999, 999.9, 99.9
const PURITY_RE = /\b24\s*k(?:t|arat)?\b|\b24\s*kt\b|\b999(?:\.9)?\b|\b99\.9\b/i;

// ─── Portal URLs ──────────────────────────────────────────────────────────────
const PORTALS = [
  { id:'amazon',   name:'Amazon India',    color:'#FF9900', renderJs:true,
    urls:[
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&crid=3K9CTAMISGN2R&qid=1779125852&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&ref=sr_nr_p_123_6&ds=v1%3AM4C68F5U%2BW4k4V74xqyyCWRenTsbNKgJcsOY65BOTPw',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=2&crid=3K9CTAMISGN2R&qid=1779125889&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_2',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=3&crid=3K9CTAMISGN2R&qid=1779125899&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_3',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=4&crid=3K9CTAMISGN2R&qid=1779125923&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_4',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=5&crid=3K9CTAMISGN2R&qid=1779125940&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_5',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=6&crid=3K9CTAMISGN2R&qid=1779125940&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_6',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=7&crid=3K9CTAMISGN2R&qid=1779125940&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_7',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=8&crid=3K9CTAMISGN2R&qid=1779125940&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_8',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=9&crid=3K9CTAMISGN2R&qid=1779125940&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_9',
      'https://www.amazon.in/s?k=gold+coin+bar&rh=p_123%3A358856%257C434730%257C4754335%257C484217%257C484790%257C6408233&dc&page=10&crid=3K9CTAMISGN2R&qid=1779125940&rnid=91049095031&sprefix=gold+coin+bar%2Caps%2C267&xpid=NL90bC5GAthnF&ref=sr_pg_10',
    ]},
  { id:'flipkart', name:'Flipkart',        color:'#2874F0', renderJs:true,
    urls:[
      'https://www.flipkart.com/search?q=gold+coin&otracker=search&otracker1=search&marketplace=FLIPKART&as-show=on&as=off&p%5B%5D=facets.brand%255B%255D%3DBangalore%2BRefinery&p%5B%5D=facets.brand%255B%255D%3DMMTC-PAMP%2BIndia%2BPvt%2BLtd&p%5B%5D=facets.brand%255B%255D%3DJoyalukkas',
      'https://www.flipkart.com/search?q=gold+coin&otracker=search&otracker1=search&marketplace=FLIPKART&as-show=on&as=off&p%5B%5D=facets.brand%255B%255D%3DBangalore%2BRefinery&p%5B%5D=facets.brand%255B%255D%3DMMTC-PAMP%2BIndia%2BPvt%2BLtd&p%5B%5D=facets.brand%255B%255D%3DJoyalukkas&page=2',
      'https://www.flipkart.com/search?q=gold+coin&otracker=search&otracker1=search&marketplace=FLIPKART&as-show=on&as=off&p%5B%5D=facets.brand%255B%255D%3DBangalore%2BRefinery&p%5B%5D=facets.brand%255B%255D%3DMMTC-PAMP%2BIndia%2BPvt%2BLtd&p%5B%5D=facets.brand%255B%255D%3DJoyalukkas&page=3',
    ]},
  { id:'tatacliq', name:'Tata CLiQ Luxury',color:'#E40046', renderJs:true,
    urls:[
      'https://www.tatacliq.com/search/?q=gold+bar+coin%3Aprice-desc%3AinStockFlag%3Atrue%3Abrand%3AMBH19B11294%3Abrand%3AMBH19B10320%3Abrand%3AMBH19B26926%3Abrand%3AMBH19B27833%3Abrand%3AMBH19B10147%3Abrand%3AMBH19B14000',
      'https://www.tatacliq.com/search/?q=gold+bar+coin%3Aprice-desc%3AinStockFlag%3Atrue%3Abrand%3AMBH19B11294%3Abrand%3AMBH19B10320%3Abrand%3AMBH19B26926%3Abrand%3AMBH19B27833%3Abrand%3AMBH19B10147%3Abrand%3AMBH19B14000&pageNumber=2',
      'https://www.tatacliq.com/search/?q=gold+bar+coin%3Aprice-desc%3AinStockFlag%3Atrue%3Abrand%3AMBH19B11294%3Abrand%3AMBH19B10320%3Abrand%3AMBH19B26926%3Abrand%3AMBH19B27833%3Abrand%3AMBH19B10147%3Abrand%3AMBH19B14000&pageNumber=3',
      'https://www.tatacliq.com/search/?q=gold+bar+coin%3Aprice-desc%3AinStockFlag%3Atrue%3Abrand%3AMBH19B11294%3Abrand%3AMBH19B10320%3Abrand%3AMBH19B26926%3Abrand%3AMBH19B27833%3Abrand%3AMBH19B10147%3Abrand%3AMBH19B14000&pageNumber=4',
      'https://www.tatacliq.com/search/?q=gold+bar+coin%3Aprice-desc%3AinStockFlag%3Atrue%3Abrand%3AMBH19B11294%3Abrand%3AMBH19B10320%3Abrand%3AMBH19B26926%3Abrand%3AMBH19B27833%3Abrand%3AMBH19B10147%3Abrand%3AMBH19B14000&pageNumber=5',
      'https://www.tatacliq.com/search/?q=gold+bar+coin%3Aprice-desc%3AinStockFlag%3Atrue%3Abrand%3AMBH19B11294%3Abrand%3AMBH19B10320%3Abrand%3AMBH19B26926%3Abrand%3AMBH19B27833%3Abrand%3AMBH19B10147%3Abrand%3AMBH19B14000&pageNumber=6',
    ]},
  { id:'ajio',    name:'Ajio',            color:'#E31837', renderJs:true,
    urls:[
      'https://www.ajio.com/s/precious-jewellery-4294-56661?query=%3Arelevance%3Al1l3nestedcategory%3AWomen%20-%20Bars%20%26%20Coins%3Abrand%3AMuthoot%20PAPPACHAN%3Abrand%3AJoyalukkas%3Abrand%3ABangalore%20Refinery%3Abrand%3AMalabar%20Gold%20%26%20Diamonds%3Abrand%3AMmtc%20Pamp&classifier=intent&curated=true&curatedid=precious-jewellery-4294-56661&customerType=Existing&gridColumns=3&segmentIds=&customertype=Existing&start=0&nrlt=45',
      'https://www.ajio.com/s/precious-jewellery-4294-56661?query=%3Arelevance%3Al1l3nestedcategory%3AWomen%20-%20Bars%20%26%20Coins%3Abrand%3AMuthoot%20PAPPACHAN%3Abrand%3AJoyalukkas%3Abrand%3ABangalore%20Refinery%3Abrand%3AMalabar%20Gold%20%26%20Diamonds%3Abrand%3AMmtc%20Pamp&classifier=intent&curated=true&curatedid=precious-jewellery-4294-56661&customerType=Existing&gridColumns=3&segmentIds=&customertype=Existing&start=45&nrlt=45',
      'https://www.ajio.com/s/precious-jewellery-4294-56661?query=%3Arelevance%3Al1l3nestedcategory%3AWomen%20-%20Bars%20%26%20Coins%3Abrand%3AMuthoot%20PAPPACHAN%3Abrand%3AJoyalukkas%3Abrand%3ABangalore%20Refinery%3Abrand%3AMalabar%20Gold%20%26%20Diamonds%3Abrand%3AMmtc%20Pamp&classifier=intent&curated=true&curatedid=precious-jewellery-4294-56661&customerType=Existing&gridColumns=3&segmentIds=&customertype=Existing&start=90&nrlt=45',
      'https://www.ajio.com/s/precious-jewellery-4294-56661?query=%3Arelevance%3Al1l3nestedcategory%3AWomen%20-%20Bars%20%26%20Coins%3Abrand%3AMuthoot%20PAPPACHAN%3Abrand%3AJoyalukkas%3Abrand%3ABangalore%20Refinery%3Abrand%3AMalabar%20Gold%20%26%20Diamonds%3Abrand%3AMmtc%20Pamp&classifier=intent&curated=true&curatedid=precious-jewellery-4294-56661&customerType=Existing&gridColumns=3&segmentIds=&customertype=Existing&start=135&nrlt=45',
    ]},
];

console.log(`\n🪙  Gold Scan Engine v12`);
console.log(`    Match rule : brand + purity(24K/999/999.9) + price — no weight required`);
console.log(`    Proxy      : ${HAS_PROXY ? '✓ ScraperAPI' : '✗ not set — add SCRAPER_API_KEY in Railway Variables'}`);
console.log(`    Port       : ${PORT}\n`);

// ─── HTTP headers ─────────────────────────────────────────────────────────────
const INDIA_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ─── fetchHtml ────────────────────────────────────────────────────────────────
async function fetchHtml(url, renderJs = true, wait = 0) {
  let fetchUrl, headers;
  if (HAS_PROXY) {
    fetchUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}` +
               `&url=${encodeURIComponent(url)}&country_code=in` +
               `&render=${renderJs}&device_type=desktop` +
               (wait > 0 ? `&wait=${wait}` : '');
    headers  = {};
  } else {
    fetchUrl = url;
    headers  = { ...INDIA_HEADERS };
  }
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(fetchUrl, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally { clearTimeout(timer); }
}

// ─── Core utilities ───────────────────────────────────────────────────────────
function matchBrand(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  return BRANDS.find(b => b.kw.some(kw => t.includes(kw))) || null;
}

function parsePrice(raw) {
  const n = parseFloat(String(raw||'').replace(/[₹,\s]/g,''));
  return isNaN(n) || n < 500 ? null : n;
}

function extractWeight(text) {
  if (!text) return null;
  const t = String(text);
  const kg = t.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kg) { const g=parseFloat(kg[1])*1000; if(g>=0.5&&g<=500) return {grams:g,label:`${g}g`}; }
  const gm = t.match(/(\d+(?:\.\d+)?)\s*[-–]?\s*g(?:rams?|m)?\b/i);
  if (gm) { const v=parseFloat(gm[1]); if(v>=0.5&&v<=500) return {grams:v,label:`${v}g`}; }
  return null;
}

// ─── Core matchers ────────────────────────────────────────────────────────────
// Inclusion rule: text contains "gold" AND separately contains "coin/bar"
// Words need not be adjacent — "24K Gold Hallmark Coin" still matches.
const isGoldProduct = t => {
  const s = String(t||'').toLowerCase();
  return /\bgold\b/.test(s) && /\b(?:coin|coins|bar|bars)\b/.test(s);
};
// Hard reject anything explicitly saying 22K / 22KT / 916
const is22K         = t => /\b22\s*k(?:t|arat)?\b|\b916\b/i.test(String(t||''));
const isExcluded    = t => EXCLUDE_KW.some(kw => String(t||'').toLowerCase().includes(kw));
const PRICE_RE      = /₹\s*[\d,]+/;


// ─── Offer extraction ─────────────────────────────────────────────────────────
// These cards earn card-based discounts — same list as the Chrome extension.
const CARD_OFFERS_RE = /hdfc infinia|infinia|marriott bonvoy|bonvoy|axis magnus|magnus|axis atlas|\bsbi\b|\brbl\b|\bicici\b|amex|american express/i;

function extractOffers($c, cheerio) {
  const $ = cheerio;
  const seen = new Set();
  const offers = [];

  // Selector-based extraction
  const offerSels = [
    '[class*="offer"],[class*="Offer"]',
    '[class*="coupon"],[class*="Coupon"]',
    '[class*="bank"],[class*="Bank"]',
    '[class*="cashback"],[class*="Cashback"]',
    '[class*="badge"],[class*="Badge"]',
    '[class*="promo"],[class*="Promo"]',
    '[class*="discount"],[class*="Discount"]',
  ];
  for (const sel of offerSels) {
    try {
      $c.find(sel).each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 3 && t.length < 150 && !seen.has(t)) {
          seen.add(t); offers.push(t);
        }
      });
    } catch (_) {}
  }

  // Text-line scan for offer patterns
  const lines = ($c.text() || '').split('\n');
  for (const line of lines) {
    const l = line.trim();
    if (l.length < 4 || l.length > 150 || seen.has(l)) continue;
    if (/bank offer|coupon|cashback|off on|save|promo|hdfc|sbi|icici|axis|kotak|emi|credit card|debit card|flat.*off|\d+%.*off/i.test(l)) {
      seen.add(l); offers.push(l);
    }
  }

  return offers.slice(0, 6);
}

// Computes the best effective price after applying credit card offers.
// Only discounts from the 8 premium cards are applied to the price.
function extractBestPrice(offers, listedPrice) {
  if (!offers || !offers.length || !listedPrice) return listedPrice;
  let best = listedPrice;

  for (const offer of offers) {
    const t = String(offer);
    if (!CARD_OFFERS_RE.test(t)) continue; // only apply allowed card discounts

    // Absolute offer price — "₹4,299 with HDFC Infinia"
    const absRe = /₹\s*([\d,]+(?:\.\d+)?)/g;
    let m;
    while ((m = absRe.exec(t)) !== null) {
      const candidate = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(candidate) && candidate < best && candidate > listedPrice * 0.5)
        best = candidate;
    }

    // Flat discount — "Flat ₹500 off"
    const flatM = t.match(/(?:flat|save|extra|instant|additional)?\s*₹\s*([\d,]+)\s*(?:off|discount|cashback)/i);
    if (flatM) {
      const disc = parseFloat(flatM[1].replace(/,/g, ''));
      if (!isNaN(disc) && disc > 0) {
        const candidate = listedPrice - disc;
        if (candidate > listedPrice * 0.5 && candidate < best) best = candidate;
      }
    }

    // Percentage — "5% off with Axis Magnus"
    const pctM = t.match(/(?:extra|flat|upto|up to)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:off|cashback|discount)/i);
    if (pctM) {
      const pct = parseFloat(pctM[1]);
      if (!isNaN(pct) && pct > 0 && pct <= 40) {
        const candidate = listedPrice * (1 - pct / 100);
        if (candidate > listedPrice * 0.5 && candidate < best) best = candidate;
      }
    }
  }

  return +best.toFixed(2);
}

// ─── makeItem ─────────────────────────────────────────────────────────────────
// Accept: "Gold Coin" or "Gold Bar" in text + price ≥ ₹500 + not 22K/silver
// Brand is extracted for display but NOT required — any gold coin/bar is shown.
function makeItem(title, full, matched, price, mrp, url, image, weight, offers) {
  const combined = title + ' ' + full;
  if (is22K(combined))          return null;  // reject explicitly 22K/916
  if (isExcluded(combined))     return null;  // reject silver/platinum
  const brand = matched || { id:'other', name:'Other' };
  const w = weight || extractWeight(title) || extractWeight(full) || null;
  return {
    title,
    brand:         brand.name,
    brandId:       brand.id,
    purity:        '24K',
    weight:        w ? w.grams : null,
    weightLabel:   w ? w.label : '—',
    price,
    mrp:           mrp || null,
    effectivePrice:price,
    pricePerGram:  w ? +(price/w.grams).toFixed(2) : null,
    url,
    image:         image || '',
    offers:        [],
  };
}

// Dedup key — brand + price + portal (weight not reliable enough to use)
function dedupKey(item, portalId) {
  // Use title-based slug + price so different products at the same price
  // are not collapsed (brandId is often "other" for unknown brands)
  const slug = String(item.title || item.brand || '').toLowerCase()
               .replace(/[^a-z0-9]/g, '').slice(0, 30);
  return `${portalId}::${slug}::${Math.round(item.price)}`;
}

// ─── Amazon parser ────────────────────────────────────────────────────────────
function parseAmazon($) {
  const results=[], seen=new Set();
  $('[data-component-type="s-search-result"]').each((_,card)=>{
    try{
      const $c=$(card), full=$c.text()||'';
      const title=$c.find('h2 span, h2 a span').first().text().trim();
      if(!title) return;
      const matched=matchBrand(title)||matchBrand(full); // optional — null → "Other"
      let price=parsePrice($c.find('.a-price .a-offscreen').first().text());
      if(!price){ const w=$c.find('.a-price-whole').first().text().replace(/\D/g,''); const f=$c.find('.a-price-fraction').first().text().replace(/\D/g,''); if(w) price=parsePrice(w+(f?'.'+f:'')); }
      if(!price) return;
      const mrp=parsePrice($c.find('.a-text-price .a-offscreen').first().text());
      let url=$c.find('h2 a, a[href*="/dp/"]').first().attr('href')||'';
      if(url&&!url.startsWith('http')) url='https://www.amazon.in'+url;
      const offers=$c.text().split('\n').map(l=>l.trim()).filter(l=>
        l.length>4&&l.length<150&&
        /bank offer|coupon|cashback|off on|save|hdfc|sbi|icici|axis|kotak|emi|credit card|\d+%.*off|flat.*off/i.test(l)
      ).slice(0,4);
      const item=makeItem(title,full,matched,price,mrp,url,$c.find('img.s-image').first().attr('src')||'',null,offers);
      if(!item) return;
      results.push({...item,portal:'amazon',portalName:'Amazon India',portalColor:'#FF9900'});
    }catch(_){}
  });
  return results;
}

// ─── Generic card parser — used by all other portals ─────────────────────────
// Finds any element that contains: brand keyword + purity keyword + price.
// Weight NOT required — design names/descriptions are ignored.
// ─── Price-anchor card detector ──────────────────────────────────────────────
// Anchor on the smallest element containing ₹XXXX, walk UP to find the product
// card container (the element that has exactly 1-4 prices + a product link).
// Works on any portal regardless of CSS class obfuscation.
function findProductCards($) {
  const PRICE_TEST = /₹\s*[\d,]+/;

  // Step 1: find leaf price nodes — elements with a price but no children with a price
  const leafPrices = $('*').toArray().filter(el => {
    const txt = $(el).text().trim();
    if (!PRICE_TEST.test(txt) || txt.length > 200) return false;
    return !$(el).children().toArray().some(c => PRICE_TEST.test($(c).text()));
  });

  const leafSet   = new Set(leafPrices);
  const cardsSeen = new Set();
  const cards     = [];

  // Step 2: for each leaf price, walk UP until we find a container with 1-4 prices + a link
  for (const priceEl of leafPrices) {
    let el = priceEl.parent;
    for (let d = 0; d < 25 && el && el.type === 'tag'; d++) {
      const $el   = $(el);
      const text  = $el.text() || '';
      if (text.length < 10 || text.length > 20000 || $el.find('a[href]').length === 0) {
        el = el.parent; continue;
      }
      // Count leaf prices that are descendants of this element
      const innerCount = $el.find('*').toArray().filter(e => leafSet.has(e)).length;
      if (innerCount >= 1 && innerCount <= 4) {
        // 1-4 prices = one product (price + MRP + maybe offer/instalment price)
        if (!cardsSeen.has(el)) { cardsSeen.add(el); cards.push(el); }
        break;
      }
      el = el.parent; // >4 prices = multi-product container, keep walking up
    }
  }

  console.log(`    leafPrices=${leafPrices.length} → cards=${cards.length}`);
  return cards;
}

// ─── Generic portal parser — used by ALL non-Amazon portals ──────────────────
// extraSels: comma-separated CSS selectors for known portal-specific card elements.
// These are merged with price-anchor detection to maximise card coverage.
function parseCards($, portalId, portalName, portalColor, baseUrl, extraSels) {
  const results = [];

  // Combine price-anchor cards + any explicitly matched cards
  const anchorCards = findProductCards($);
  const extraCards  = extraSels ? $(extraSels).toArray() : [];

  // Merge and deduplicate by DOM node reference
  const allCards = [...new Set([...anchorCards, ...extraCards])];
  console.log(`  [${portalId}] anchor:${anchorCards.length} extra:${extraCards.length} total:${allCards.length} cards`);
  const cards = allCards;

  for (const card of cards) {
    try {
      const $c   = $(card);
      const full = $c.text() || '';
      if (is22K(full) || isExcluded(full)) continue;

      const matched  = matchBrand(full);
      const titleEl  = $c.find('h2,h3,h4,[class*="title"],[class*="Title"],[class*="name"],[class*="Name"],[class*="desc"],[class*="product"]').first();
      const title    = titleEl.text().trim() || full.split('\n').map(l=>l.trim()).find(l=>l.length>5) || '';

      const priceEl  = $c.find('[class*="price"],[class*="Price"],[class*="rate"],[class*="amount"]').first();
      let price      = parsePrice(priceEl.text());
      if (!price) { const m=full.match(/₹\s*([\d,]+(?:\.\d+)?)/); if(m) price=parseFloat(m[1].replace(/,/g,'')); }
      if (!price) continue;

      const mrp      = parsePrice($c.find('s,del,[class*="mrp"],[class*="original"],[class*="strike"],[class*="through"]').first().text());
      const linkEl   = $c.find('a[href]').first();
      let url        = linkEl.attr('href') || '';
      if (url && !url.startsWith('http')) url = baseUrl + url;
      const image    = $c.find('img[src]').first().attr('src') || '';

      const offers = full.split('\n').map(l=>l.trim()).filter(l=>
        l.length>4&&l.length<150&&
        /bank offer|coupon|cashback|off on|save|hdfc|sbi|icici|axis|kotak|emi|credit card|\d+%.*off|flat.*off/i.test(l)
      ).slice(0,4);
      const item = makeItem(title, full, matched, price, mrp, url, image, null, offers);
      if (!item) continue;
      results.push({...item, portal:portalId, portalName, portalColor});
    } catch(_) {}
  }

  console.log(`  [${portalId}] → ${results.length} items`);
  return results;
}

function parseFlipkart($) {
  // Flipkart product card selectors (stable across renders):
  // data-id       — every grid item has a product ID attribute
  // a[href*="/p/"] parent chain — product link containers
  // class*="productBaseWrapper" / "productCard" / "col3-8-24" — grid cells
  const extraSels = [
    '[data-id]',
    '[class*="productBaseWrapper"]',
    '[class*="productCard"]',
    '[class*="productTuple"]',
    '[class*="col3-8-24"]',
    '[class*="_1AtVbE"]',
    '[class*="CXW8mj"]',
  ].join(',');
  return parseCards($,'flipkart','Flipkart','#2874F0','https://www.flipkart.com', extraSels);
}
function parseTataCliq($) {
  // Tata CLiQ product card selectors (Next.js / React):
  // ProductCard / product-card / plp-product — standard card class patterns
  // productTile / product-tile / ProductTile — tile variants
  // [class*="ProductsList"] li              — list items inside product grid
  // [data-id] / [data-product-id]           — products with ID attributes
  const extraSels = [
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    '[class*="productCard"]',
    '[class*="product-tile"]',
    '[class*="ProductTile"]',
    '[class*="plp-product"]',
    '[class*="ProductsList"] li',
    '[class*="product-list"] li',
    '[class*="productBase"]',
    '[data-id]',
    '[data-product-id]',
  ].join(',');
  return parseCards($,'tatacliq','Tata CLiQ Luxury','#E40046','https://www.tatacliq.com', extraSels);
}
function parseAjio($) {
  // Ajio product card selectors:
  // item-box / plp-card / rilrtl-item — standard Ajio grid cards
  // product-tile / plp-product        — alternate class patterns
  // [data-prodid]                      — products have a data-prodid attribute
  // li inside the product grid
  const extraSels = [
    '[class*="item-box"]',
    '[class*="plp-card"]',
    '[class*="rilrtl-item"]',
    '[class*="product-tile"]',
    '[class*="plp-product"]',
    '[class*="productcard"]',
    '[class*="product-item"]',
    '[data-prodid]',
    '[data-product-id]',
    'li[class*="item"]',
    'li[class*="product"]',
  ].join(',');
  return parseCards($,'ajio','Ajio','#E31837','https://www.ajio.com', extraSels);
}

function parseHtml(portalId,$) {
  switch(portalId){
    case 'amazon':   return parseAmazon($);
    case 'flipkart': return parseFlipkart($);
    case 'tatacliq': return parseTataCliq($);
    case 'ajio':     return parseAjio($);
    default:         return [];
  }
}


// ─── Extra wait per portal (React SPAs need time to render) ──────────────────
const PORTAL_WAIT = { flipkart:5000, tatacliq:8000, ajio:8000 }; // tatacliq/ajio use lazy-loading

// ─── Scrape one URL ───────────────────────────────────────────────────────────
async function scrapeUrl(portal, url) {
  const renderJs = portal.renderJs !== false;
  const wait     = PORTAL_WAIT[portal.id] || 0;
  const html     = await fetchHtml(url, renderJs, wait);
  const $        = cheerio.load(html);
  const title    = $('title').text();
  const priceHits= (html.match(/₹/g)||[]).length;
  const bodyLen  = html.length;
  console.log(`  [${portal.name}] "${title.slice(0,50)}" | ₹×${priceHits} | ${bodyLen}b`);
  if(priceHits === 0)
    console.warn(`  ⚠  [${portal.name}] ZERO ₹ prices found — page may be blocked/empty`);
  if(/captcha|robot|verify|unusual traffic/i.test(title))
    throw new Error(`Blocked: "${title.slice(0,40)}"`);
  return parseHtml(portal.id, $);
}

// ─── Scrape portal (all URLs, no cap) ────────────────────────────────────────
async function scrapePortal(portal) {
  const seen=new Set(), results=[];
  for(const url of portal.urls){
    try{
      const items=await scrapeUrl(portal,url);
      results.push(...items);
    }catch(err){ console.warn(`  [${portal.name}] ${err.message}`); }
  }
  console.log(`[scan] ${portal.name} → ${results.length} items\n`);
  return results;
}

// ─── SSE /api/scan — ALL portals in parallel ──────────────────────────────────
app.get('/api/scan', async(req,res)=>{
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.flushHeaders();
  const send=(t,d)=>{try{res.write(`data: ${JSON.stringify({type:t,...d})}\n\n`);}catch(_){}};
  const ping=setInterval(()=>{try{res.write(': ping\n\n');}catch(_){}},15000);
  try{
    if(!HAS_PROXY) send('warning',{message:'No SCRAPER_API_KEY — visit /setup'});
    PORTALS.forEach((p,i)=>send('progress',{portal:p.name,portalId:p.id,portalColor:p.color,progress:i/PORTALS.length,message:`Scanning ${p.name}…`}));
    await Promise.allSettled(PORTALS.map(async portal=>{
      try{
        const items=await scrapePortal(portal);
        send('portal_done',{portalId:portal.id,portalName:portal.name,portalColor:portal.color,count:items.length,items});
      }catch(err){
        send('portal_error',{portalId:portal.id,portalName:portal.name,portalColor:portal.color,error:err.message});
      }
    }));
    send('done',{proxy:HAS_PROXY});
  }catch(err){send('error',{message:err.message});}
  finally{clearInterval(ping);res.end();}
});

// ─── /api/test ────────────────────────────────────────────────────────────────
app.get('/api/test', async(req,res)=>{
  const url='https://www.amazon.in/s?k=MMTC+PAMP+24K+gold+coin&i=jewelry';
  try{
    const html=await fetchHtml(url,false);
    const $=cheerio.load(html);
    const items=parseAmazon($);
    res.json({ok:true,title:$('title').text(),itemCount:items.length,htmlBytes:html.length,proxy:HAS_PROXY});
  }catch(err){ res.json({ok:false,error:err.message,proxy:HAS_PROXY}); }
});

app.get('/setup',(_, res)=>res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup</title>
<style>body{font-family:-apple-system,sans-serif;background:#111;color:#eee;padding:20px;max-width:540px;margin:0 auto}
h1{color:#D4AA2A}.card{background:#1F2937;border-radius:12px;padding:20px;margin-bottom:16px}
h2{color:#D4AA2A;font-size:15px;margin-bottom:12px}.step{margin-bottom:14px;line-height:1.9;font-size:14px}
code{background:#374151;padding:2px 8px;border-radius:4px}a{color:#93C5FD}
.ok{background:#064E3B;color:#6EE7B7;padding:12px;border-radius:8px;margin-bottom:16px}
.warn{background:#7F1D1D;color:#FCA5A5;padding:12px;border-radius:8px;margin-bottom:16px}</style>
</head><body>
<h1>🪙 Setup</h1>
<div class="${HAS_PROXY?'ok':'warn'}">${HAS_PROXY?'✓ SCRAPER_API_KEY set — you\'re ready!':'✗ SCRAPER_API_KEY not set.'}</div>
<div class="card"><h2>3 steps (free)</h2>
<div class="step">1. Sign up at <a href="https://www.scraperapi.com" target="_blank">scraperapi.com</a> — no credit card</div>
<div class="step">2. Copy your API key</div>
<div class="step">3. Railway → Variables → <code>SCRAPER_API_KEY</code> = your key → redeploy</div>
</div>
<p><a href="/">← App</a> &nbsp;|&nbsp; <a href="/api/test">Test</a></p>
</body></html>`));

app.get('/health',(_, res)=>res.json({ok:true,proxy:HAS_PROXY}));
app.listen(PORT,'0.0.0.0',()=>console.log(`🪙  Gold Scan Engine → http://localhost:${PORT}\n`));
