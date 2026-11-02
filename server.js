const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 8080;

// API details
const authorizationToken = `Bearer ${process.env.SQUARE}`;
const squareVersion = '2024-08-21';
const apiEndpoint = 'https://connect.squareup.com/v2/catalog/list';

// The page template (public/menu.html) and the files it loads (fonts, logo).
const PUBLIC = path.join(__dirname, 'public');
const TEMPLATE = fs.readFileSync(path.join(PUBLIC, 'menu.html'), 'utf8');
const TYPES = { '.otf': 'font/otf', '.ttf': 'font/ttf', '.png': 'image/png' };
const STATIC = {};
for (const dir of ['fonts', 'assets']) {
  for (const file of fs.readdirSync(path.join(PUBLIC, dir))) {
    STATIC[`/${dir}/${file}`] = path.join(PUBLIC, dir, file);
  }
}

// Helper function to format price by rounding to nearest dollar (no dollar sign, no cents)
function formatPrice(amount) {
  return Math.round(amount / 100); // Rounds the price to the nearest dollar
}

// Fetch the whole Square catalog, following pagination cursors.
function fetchCatalog() {
  const get = cursor => new Promise((resolve, reject) => {
    const url = new URL(apiEndpoint);
    if (cursor) url.searchParams.set('cursor', cursor);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Square-Version': squareVersion,
        'Authorization': authorizationToken,
        'Content-Type': 'application/json',
      },
    }, apiRes => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        if (apiRes.statusCode !== 200) return reject(new Error(`Square responded ${apiRes.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Square request timed out')));
    req.end();
  });
  return (async () => {
    let objects = [], cursor;
    do {
      const page = await get(cursor);
      objects = objects.concat(page.objects || []);
      cursor = page.cursor;
    } while (cursor);
    return objects;
  })();
}

// How each Square item is shown, keyed by its Square name in lower case, without "(canned)".
// rank is the order within its section (2026 sales); cc is a wine's origin flag; size is shown
// small after the name; tag marks a best seller. Items not listed here still appear,
// after the listed ones, under their Square name.
const CURATION = {
  'daou reserve cabernet':  { rank: 1, cc: 'us', tag: 'Popular' },
  'house cabernet':         { rank: 2 },
  'house pinot noir':       { rank: 3 },
  'caymus cabernet 1l':     { rank: 4, cc: 'us', name: 'Caymus Cabernet', size: '1 L' },

  'freixenet pinot grigio': { rank: 1, cc: 'it', tag: 'Popular' },
  'house sauv blanc':       { rank: 2, name: 'House Sauvignon Blanc' },
  'stags leap sauv blanc':  { rank: 3, cc: 'us', name: 'Stags Leap Sauvignon Blanc' },
  'house chardonnay':       { rank: 4 },
  'campuget viognier':      { rank: 5, cc: 'fr' },

  'freixenet prosecco':     { rank: 1, cc: 'it', tag: 'Popular' },
  'gemma di luna moscato':  { rank: 2, cc: 'it', name: 'Gemma di Luna Moscato', size: '187 ml' },
  'sparkling rose':         { rank: 3, name: 'Sparkling Rosé' },

  'margarita':              { rank: 1, tag: 'Popular' },
  'espresso martini':       { rank: 2 },
  'mojito':                 { rank: 3 },
  'moscow mule':            { rank: 4 },

  'press hard seltzer':     { rank: 1, tag: 'Popular' },
  'spellbinder hazy ipa':   { rank: 2 },
  'modelo':                 { rank: 3 },
  'michelob ultra':         { rank: 4 },
  'pineapple cider':        { rank: 5 },

  'michelob 0':             { rank: 1 },
  'black tea / cold brew':  { rank: 2 },
  'celsius':                { rank: 3 },
  'pellegrino sparkling':   { rank: 4 },
  'fiji water':             { rank: 5 },
  'canned soda':            { rank: 6 },
};
const CANNED = /\s*\(canned\)\s*$/i;
const key = name => name.replace(CANNED, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Sections on the screen, in column order. Square categories map onto them in sectionFor().
const WINE = 'glass / bottle';
const LAYOUT = [
  [{ id: 'reds', title: 'Reds', legend: WINE },
   { id: 'whites', title: 'Whites', legend: WINE },
   { id: 'members', title: 'Members Only' }],
  [{ id: 'canned', title: 'Canned Cocktails' },
   { id: 'sparkling', title: 'Sparkling', legend: WINE },
   { id: 'champagne' }],
  [{ id: 'beer', title: 'Beer, Cider & Seltzer' },
   { id: 'zero', title: 'Zero Proof' }],
];

// Only these Square categories are on the bar menu; everything else in the catalog
// (snacks, retail, other bars' wines) is left off.
function sectionFor(category, name) {
  switch (category) {
    case 'Reds': return 'reds';
    case 'Whites': return 'whites';
    case 'Members Only': return 'members';
    case 'Sparkling': return /veuve/i.test(name) ? 'champagne' : 'sparkling';
    case 'Seltzer & More': return CANNED.test(name) ? 'canned' : 'beer';
    case 'Beer': return 'beer';
    case 'No Alcohol': return 'zero';
    default: return null;
  }
}

// Turn the Square catalog into the MENU structure public/menu.html renders.
function buildMenu(objects) {
  const categories = {};
  objects.filter(o => o.type === 'CATEGORY').forEach(c => { categories[c.id] = c.category_data.name; });

  const buckets = {};
  objects
    .filter(o => o.type === 'ITEM' && !o.item_data.is_archived)  // Exclude archived items
    .forEach(item => {
      const catId = item.item_data.categories && item.item_data.categories[0] && item.item_data.categories[0].id;
      if (!catId || !categories[catId]) return;
      const name = item.item_data.name.trim();
      const section = sectionFor(categories[catId], name);
      if (!section) return;
      // Non-member prices, in Square's variation order (glass, then bottle)
      const amounts = (item.item_data.variations || [])
        .filter(v => !v.item_variation_data.name.toLowerCase().includes('member'))
        .map(v => v.item_variation_data.price_money && v.item_variation_data.price_money.amount)
        .filter(a => typeof a === 'number');
      if (!amounts.length) return;
      const c = CURATION[key(name)] || {};
      const size = c.size || (/50th/i.test(name) ? 'per glass' : '');
      (buckets[section] ||= []).push({
        rank: c.rank || 100,
        low: Math.min(...amounts),
        row: [c.cc || '', c.name || name.replace(CANNED, ''), amounts.map(formatPrice).join(' / '), size || null, c.tag || null],
        name,
      });
    });

  const sorted = id => (buckets[id] || []).sort((a, b) => a.rank - b.rank || a.low - b.low);
  return LAYOUT.map(col => col.map(sec => {
    const entries = sorted(sec.id);
    if (!entries.length) return null;
    if (sec.id === 'champagne') {
      return {
        toast: true, flag: 'fr', kick: 'Champagne', title: 'Veuve Clicquot', sub: 'Yellow Label Brut',
        pours: entries.map(e => [/1\.5/.test(e.name) ? 'Magnum 1.5 L' : /750/.test(e.name) ? '750 ml' : e.row[1], e.row[2]]),
      };
    }
    const { id, ...rest } = sec;
    return { ...rest, items: entries.map(e => e.row) };
  }).filter(Boolean));
}

// One page per bar, all from the same catalog: the color theme and the bar's name shown in the frame.
const VENUES = {
  '/':       { theme: 'gold',   name: 'Capital Bar' },
  '/rose':   { theme: 'rose',   name: 'The Enchanted Piano' },
  '/louvre': { theme: 'louvre', name: 'The Louvre' },
};

function render(menu, venue) {
  const json = JSON.stringify(menu).replace(/</g, '\\u003c');
  return TEMPLATE.replace('__MENU__', json).replace('__THEME__', venue.theme).replace('__VENUE__', venue.name);
}

// Keep the last good catalog so a Square outage shows the previous menu, not an error.
let lastGood = null;

// Create an HTTP server
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (STATIC[url.pathname]) {
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(url.pathname)] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    });
    fs.createReadStream(STATIC[url.pathname]).pipe(res);
    return;
  }

  const venue = VENUES[url.pathname];
  if (venue) {
    let menu;
    try {
      menu = buildMenu(await fetchCatalog());
      lastGood = menu;
    } catch (e) {
      console.error(`Problem with request: ${e.message}`);
      menu = lastGood;
    }
    if (!menu) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(render(menu, venue));
    return;
  }

  // Handle 404 - Not Found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
