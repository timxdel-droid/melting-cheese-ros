/* Connector registry + product sync for the ROS backend.
   Product connectors (website / mobile app source) point at a WordPress site;
   products are pulled live from the public WooCommerce Store API.
   Tool connectors (GitHub, Codemagic, Apple Dev) are saved quick-links. */

const CONNECTORS_KEY = 'mc-ros-connectors'
const PRODUCTS_KEY = 'mc-ros-synced-products'

export const DEFAULT_CONNECTORS = {
  website: { label: 'Website (WooCommerce)', url: 'https://dev2.meltingcheese.food', kind: 'products', ck: '', cs: '' },
  app: { label: 'Mobile App source (WooCommerce)', url: 'https://dev2.meltingcheese.food', kind: 'products', ck: '', cs: '' },
  github: { label: 'GitHub repo', url: 'https://github.com/timxdel-droid/melting-cheese-ios', kind: 'link' },
  codemagic: { label: 'Codemagic CI', url: 'https://codemagic.io/apps', kind: 'link' },
  appledev: { label: 'Apple Developer', url: 'https://appstoreconnect.apple.com', kind: 'link' },
}

export function loadConnectors() {
  try {
    const raw = localStorage.getItem(CONNECTORS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      const merged = {}
      for (const k of Object.keys(DEFAULT_CONNECTORS)) {
        merged[k] = { ...DEFAULT_CONNECTORS[k], ...(saved[k] || {}) }
      }
      return merged
    }
  } catch (e) { /* fall through to defaults */ }
  return JSON.parse(JSON.stringify(DEFAULT_CONNECTORS))
}

export function saveConnectors(connectors) {
  localStorage.setItem(CONNECTORS_KEY, JSON.stringify(connectors))
}

export function loadSyncedProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&#8217;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/<[^>]*>/g, '')
}

async function fetchStoreProducts(baseUrl) {
  const base = baseUrl.replace(/\/+$/, '')
  const res = await fetch(base + '/wp-json/wc/store/v1/products?per_page=100')
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  return data.map(p => ({
    id: p.id,
    name: decodeEntities(p.name),
    cat: decodeEntities(p.categories && p.categories[0] ? p.categories[0].name : 'Uncategorised'),
    price: p.prices && p.prices.price
      ? Number(p.prices.price) / Math.pow(10, Number(p.prices.currency_minor_unit || 2))
      : null,
    currency: p.prices ? p.prices.currency_code : 'AED',
    img: p.images && p.images[0] ? p.images[0].thumbnail : null,
    inStock: !!p.is_in_stock,
    qty: p.quantity_limits && p.quantity_limits.maximum != null
      ? Number(p.quantity_limits.maximum) : null,
    desc: decodeEntities(p.short_description),
  }))
}

/* Pull products from every configured product connector and merge them.
   Items found in more than one source are tagged with all of them. */
export async function syncProducts(connectors) {
  const sources = []
  if (connectors.website.url) sources.push(['Website', connectors.website.url])
  if (connectors.app.url) sources.push(['App', connectors.app.url])

  const merged = new Map()
  const errors = []

  for (const [label, url] of sources) {
    try {
      const items = await fetchStoreProducts(url)
      for (const it of items) {
        const key = url.replace(/\/+$/, '') + '#' + it.id
        // same store URL for both connectors -> same key -> item tagged with both
        const existingKey = [...merged.keys()].find(k => k.endsWith('#' + it.id) &&
          merged.get(k).name === it.name)
        const useKey = existingKey || key
        if (merged.has(useKey)) {
          merged.get(useKey).sources.push(label)
        } else {
          merged.set(useKey, { ...it, sources: [label] })
        }
      }
    } catch (e) {
      errors.push(label + ': ' + (e.message || 'failed'))
    }
  }

  const result = {
    items: [...merged.values()],
    errors,
    syncedAt: new Date().toISOString(),
  }
  if (result.items.length) localStorage.setItem(PRODUCTS_KEY, JSON.stringify(result))
  return result
}

/* Push edited fields back to every product connector that has write
   credentials (WooCommerce REST v3, key pair entered in the Sync panel).
   Both the website and the mobile app read from these backends, so a
   successful push updates both applications. */
export async function pushProduct(connectors, productId, changes) {
  const targets = []
  const seen = new Set()
  for (const key of ['website', 'app']) {
    const c = connectors[key]
    if (c && c.url && c.ck && c.cs) {
      const base = c.url.replace(/\/+$/, '')
      if (!seen.has(base)) { seen.add(base); targets.push({ key, base, ck: c.ck, cs: c.cs }) }
    }
  }
  if (!targets.length) return { ok: false, results: ['No write credentials — add a WooCommerce API key in the Sync panel'] }

  const body = {}
  if (changes.name != null) body.name = changes.name
  if (changes.price != null) body.regular_price = String(changes.price)
  if (changes.inStock != null) body.stock_status = changes.inStock ? 'instock' : 'outofstock'
  if (changes.qty != null) { body.manage_stock = true; body.stock_quantity = Number(changes.qty) }

  const results = []
  let ok = true
  for (const t of targets) {
    try {
      const res = await fetch(t.base + '/wp-json/wc/v3/products/' + productId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(t.ck + ':' + t.cs),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      results.push(t.key + ': updated')
    } catch (e) {
      ok = false
      results.push(t.key + ': ' + (e.message || 'failed'))
    }
  }
  return { ok, results }
}

export function hasWriteAccess(connectors) {
  return ['website', 'app'].some(k => connectors[k] && connectors[k].url && connectors[k].ck && connectors[k].cs)
}

/* ---- Events -------------------------------------------------------------
   An event is a named subset of the synced catalogue — the products that
   actually go on sale at that festival / activation. Membership is stored
   locally as a list of product ids per event. */

const EVENTS_KEY = 'mc-ros-events'

export const DEFAULT_EVENTS = [
  { id: 'aaf', name: 'All Africa Festival', venue: 'Dubai World Trade Centre', live: true, products: [] },
  { id: 'afroloud', name: 'Afro Loud', venue: 'Bluewaters Island', live: true, products: [] },
  { id: 'placeholder', name: 'Placeholder', venue: '', live: false, products: [] },
]

export function loadEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (Array.isArray(saved) && saved.length) return saved
    }
  } catch (e) { /* fall through */ }
  return JSON.parse(JSON.stringify(DEFAULT_EVENTS))
}

export function saveEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

/* ---- Crates -------------------------------------------------------------
   WooCommerce has no crate concept, so crate counts and crate size live
   in ROS only. Unit quantity and stock status still push to Woo. */

const CRATES_KEY = 'mc-ros-crates'
export const DEFAULT_CRATE_SIZE = 12

export function loadCrates() {
  try {
    const raw = localStorage.getItem(CRATES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return {}
}

export function saveCrates(crates) {
  localStorage.setItem(CRATES_KEY, JSON.stringify(crates))
}

/* ---- Food trucks --------------------------------------------------------
   A truck holds one deployment record per event: date, location and the
   equipment checklist for that outing. Stored locally like events/crates. */

const TRUCKS_KEY = 'mc-ros-trucks'

export const DEFAULT_EQUIPMENT = [
  'Griddle', 'Deep fryer', 'Gas cylinders', 'Generator',
  'Fridge / cold box', 'POS terminal', 'Canopy', 'Water tank',
  'Waste bins', 'Fire extinguisher',
]

export const DEFAULT_TRUCKS = [
  { id: 'truck-001', name: 'Food Truck-001', plate: '', deployments: {} },
]

export function loadTrucks() {
  try {
    const raw = localStorage.getItem(TRUCKS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (Array.isArray(saved)) return saved
    }
  } catch (e) { /* fall through */ }
  return JSON.parse(JSON.stringify(DEFAULT_TRUCKS))
}

export function saveTrucks(trucks) {
  localStorage.setItem(TRUCKS_KEY, JSON.stringify(trucks))
}

export function blankDeployment() {
  return { date: '', location: '', equipment: DEFAULT_EQUIPMENT.map(name => ({ name, on: false })) }
}

/* ---- Customer app content control ---------------------------------------
   Home layouts and banner packs are per-event. The application frame
   (welcome/sign-in, search, location selector, footer) is fixed and is
   never part of the reorderable content. */

const LAYOUTS_KEY = 'mc-ros-home-layouts'
const BANNERS_KEY = 'mc-ros-banner-packs'

/* Visible in the customer app preview but excluded from drag-and-drop. */
export const FIXED_FRAME = [
  { id: 'welcome', icon: '◎', title: 'Welcome & Sign in', note: 'Fixed app header · Always first; customer account entry' },
  { id: 'search', icon: '⌕', title: 'Menu search / top bar', note: 'Fixed utility · Always below the welcome header' },
  { id: 'location', icon: '✦', title: 'Select location or event', note: 'Required context · Changes menu, availability and page layout' },
  { id: 'footer', icon: '▤', title: 'App footer navigation', note: 'Fixed footer · Home, Menu, Search, My Order, Account' },
]

export const PLACEMENTS = [
  { id: 'header', badge: '1', name: 'Header Banner', note: 'After location selector · before Food Hall Categories', pinned: true },
  { id: 'midpage', badge: 'M', name: 'Mid-page Banner', note: 'Movable between event category aisles', pinned: false },
  { id: 'video', badge: 'V', name: 'Video Banner / Art', note: 'Movable media poster or video art', pinned: false },
]

/* Every pack carries the same three controlled variants. */
export const VARIANTS = [
  { id: 'cta', label: 'Text + CTA', note: 'Conversion placements' },
  { id: 'plain', label: 'Text · no button', note: 'Informational placements' },
  { id: 'image', label: 'Image only', note: 'Flexible responsive crop / overlay use' },
]

/* The four crops a pack can carry.

   These are genuinely different shapes, not four sizes of one picture — 2:1,
   4:5 portrait, 16:9 and 8:3 — so the server cannot derive them from a single
   upload without cropping the subject out of frame. Each one is art directed.

   Only `app` is required. Every other rendition falls back to it until
   somebody uploads a sharper crop, so a pack works from one file and is
   perfect from four, and nothing has to wait for a full set. */
export const RENDITIONS = [
  { id: 'app', label: 'App carousel', size: '1200×600', ratio: 2 / 1, required: true },
  { id: 'portrait', label: 'Mobile portrait', size: '1080×1350', ratio: 4 / 5, required: false },
  { id: 'tablet', label: 'Tablet', size: '1600×900', ratio: 16 / 9, required: false },
  { id: 'desktop', label: 'Desktop wide', size: '1920×720', ratio: 8 / 3, required: false },
]

/* Where a pack's artwork lives on the pack object:
     pack.art = { cta: { app, portrait, tablet, desktop }, plain: {…}, image: {…} }
   Missing keys are normal — see the fallback rule above. */
export function packArt(pack, variant, rendition) {
  const set = pack && pack.art && pack.art[variant]
  if (!set) return null
  return set[rendition] || set.app || null
}

/* A pack is only "complete" once every variant can actually be drawn, which
   means each one has at least its app crop. Counting uploaded files instead
   would call a pack complete when one variant is still empty. */
export function packComplete(pack) {
  return VARIANTS.every(v => !!packArt(pack, v.id, 'app'))
}

export const DEFAULT_BANNER_PACKS = [
  { id: 'bold-flavor', name: 'Bold Flavor. Big Energy.', purpose: 'Always-on brand hero', headline: 'BOLD FLAVOR. BIG ENERGY.', cta: 'View the menu', deepLink: 'app://menu?event=current', audience: 'All app users', status: 'live', placement: 'header', complete: true },
  { id: 'craving', name: 'Craving Something Delicious?', purpose: '20% first-order acquisition', headline: 'CRAVING SOMETHING DELICIOUS?', cta: 'Order now', deepLink: 'app://menu?promo=first20', audience: 'New customers', status: 'scheduled', placement: null, complete: true },
  { id: 'signature', name: 'Signature Combos. Serious Value.', purpose: 'Combo category campaign', headline: 'SIGNATURE COMBOS. SERIOUS VALUE.', cta: 'Order combos', deepLink: 'app://menu?cat=signature-food-combos', audience: 'All app users', status: 'live', placement: 'header', complete: true },
  { id: 'main-meals', name: 'Main Meals. Made Fresh.', purpose: 'Main meals campaign', headline: 'MAIN MEALS. MADE FRESH.', cta: 'See main meals', deepLink: 'app://menu?cat=main-meals', audience: 'All app users', status: 'live', placement: 'midpage', complete: true },
  { id: 'order-ahead', name: 'Order Ahead. Skip the Queue.', purpose: 'Collection promotion', headline: 'ORDER AHEAD. SKIP THE QUEUE.', cta: 'Start an order', deepLink: 'app://menu', audience: 'Returning customers', status: 'draft', placement: null, complete: false },
]

export function loadBannerPacks() {
  try {
    const raw = localStorage.getItem(BANNERS_KEY)
    if (raw) { const s = JSON.parse(raw); if (Array.isArray(s) && s.length) return s }
  } catch (e) { /* fall through */ }
  return JSON.parse(JSON.stringify(DEFAULT_BANNER_PACKS))
}

export function saveBannerPacks(packs) {
  localStorage.setItem(BANNERS_KEY, JSON.stringify(packs))
}

/* A layout is the ordered, per-event content below the fixed frame.
   Header Banner and Food Hall Categories are pinned in that order. */
export function blankLayout() {
  return {
    headerPack: 'signature',
    aisles: [],           // { cat, on }  - seeded from the synced catalogue
    midPack: 'main-meals',
    midAfter: 1,          // index of the aisle the mid-page banner follows
    videoPack: null,
    videoAfter: 3,
    changes: 0,
  }
}

export function loadLayouts() {
  try {
    const raw = localStorage.getItem(LAYOUTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return {}
}

export function saveLayouts(layouts) {
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts))
}

/* Age of the last sync in minutes, or null if never synced. */
export function syncAgeMinutes(iso) {
  if (!iso) return null
  return (Date.now() - new Date(iso).getTime()) / 60000
}

export function fmtSyncTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/* =========================================================================
   App Config — the bridge between ROS and the customer apps.

   ROS publishes the per-event home layout and banner packs to a WordPress
   endpoint on the same host the apps already read their menu from. Writes use
   a WordPress Application Password, which the operator generates in WP admin
   and can revoke per device. Reads are public and cached.
   ========================================================================= */

const APP_CONFIG_HOST = 'https://dev2.meltingcheese.food'
const APP_CONFIG_URL = APP_CONFIG_HOST + '/wp-json/mc/v1/app-config'
const WHOAMI_URL = APP_CONFIG_HOST + '/wp-json/mc/v1/whoami'
const TOKEN_KEY = 'mc-ros-api-token'
const PUBLISH_KEY = 'mc-ros-publish-state'

/* One credential for everything the console writes: the app layout, the media
   library and products. It is issued in WordPress under Users -> API Tokens
   and travels in X-MC-Token.

   Why a custom header rather than Authorization: this host runs PHP over CGI,
   which strips Authorization before PHP sees it. The server carries a shim to
   put it back, but a header nothing else touches removes the failure mode
   instead of patching around it. */

export function loadApiToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch (e) { return '' }
}

export function saveApiToken(token) {
  const clean = String(token || '').trim()
  if (clean) localStorage.setItem(TOKEN_KEY, clean)
  else localStorage.removeItem(TOKEN_KEY)
}

export function hasApiToken() {
  return loadApiToken().startsWith('mck_')
}

/* Kept under the old name so the publishing screens did not all have to
   change when the credential did. */
export const hasWpAuth = hasApiToken

function tokenHeaders(extra) {
  const h = Object.assign({}, extra || {})
  const t = loadApiToken()
  if (t) h['X-MC-Token'] = t
  return h
}

export function loadPublishState() {
  try {
    const raw = localStorage.getItem(PUBLISH_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

export function savePublishState(state) {
  localStorage.setItem(PUBLISH_KEY, JSON.stringify(state))
}

/* Confirms a token works before the operator relies on it. Distinguishes the
   three failures that look identical from the outside: plugin missing, token
   rejected, token accepted but underpowered. */
export async function testApiToken(token) {
  const value = String(token || '').trim()
  if (!value) return { ok: false, message: 'Paste the token issued in WordPress under Users -> API Tokens.' }
  if (!value.startsWith('mck_')) {
    return { ok: false, message: 'That does not look like a Melting Cheese token — they start with mck_.' }
  }
  try {
    const r = await fetch(WHOAMI_URL, { headers: { 'X-MC-Token': value }, cache: 'no-store' })
    if (r.status === 404) {
      return { ok: false, message: 'Endpoint not found — the App Config plugin is not installed on the server yet.' }
    }
    const j = await r.json().catch(() => ({}))
    if (r.status === 429) {
      return { ok: false, message: 'Too many failed attempts from this network. Wait fifteen minutes and try again.' }
    }
    if (!j.authenticated) {
      return { ok: false, message: (j && j.message) ? j.message : 'The server did not accept that token.' }
    }
    if (!j.can_publish) {
      return { ok: false, message: 'Token accepted as ' + j.user + ', but that account cannot publish content.' }
    }
    const scopes = (j.scopes || []).join(', ')
    return {
      ok: true,
      message: 'Connected as ' + j.user + (j.token_label ? ' using "' + j.token_label + '"' : '') +
        (scopes ? ' — scopes: ' + scopes : ''),
      scopes: j.scopes || [],
    }
  } catch (e) {
    return { ok: false, message: 'Could not reach the server: ' + e.message }
  }
}

/* Translates the ROS working state into the shape the apps consume.
   ROS keys are deliberately internal; this is the only place that maps them. */
export function buildAppConfig(layouts, packs, events, defaultEventId, releases) {
  /* Only events switched on in ROS reach the apps. An event that has finished,
     or has not started yet, should not appear in a customer's location picker. */
  const eventList = (events || []).map(ev => {
    if (ev.live === false) return null
    const layout = layouts[ev.id]
    if (!layout) return null
    return {
      id: ev.id,
      name: ev.name,
      venue: ev.venue || '',
      layout: {
        header_pack: layout.headerPack || null,
        categories: (layout.aisles || []).map(a => ({ name: a.cat, visible: !!a.on })),
        mid: layout.midPack ? { pack_id: layout.midPack, after: layout.midAfter || 0 } : null,
        video: layout.videoPack ? { pack_id: layout.videoPack, after: layout.videoAfter || 0 } : null,
      },
    }
  }).filter(Boolean)

  const defaultIsLive = eventList.some(e => e.id === defaultEventId)

  return {
    default_event: (defaultIsLive ? defaultEventId : null) || (eventList[0] && eventList[0].id) || null,
    // Build gating for the customer apps. Omitting it would clear whatever is
    // already published, so fall back to the stored values rather than blank.
    app: releasesForPublish(releases || loadReleases()),
    // The fleet lived only in this browser until now, which meant the server
    // could not put a truck on an order and a second laptop saw no trucks.
    fleet: fleetForPublish(loadTrucks()),
    events: eventList,
    banners: (packs || []).map(p => ({
      id: p.id,
      name: p.name,
      headline: p.headline,
      cta: p.cta,
      deep_link: p.deepLink,
      audience: p.audience,
      status: p.status,
      // Every rendition is resolved here rather than in the apps, so each
      // one arrives as a finished URL and neither app has to know the
      // fallback rule. An empty variant is sent as null so a half-finished
      // pack cannot publish a broken image tag.
      variants: Object.fromEntries(VARIANTS.map(v => [
        v.id,
        packArt(p, v.id, 'app')
          ? Object.fromEntries(RENDITIONS.map(r => [r.id, packArt(p, v.id, r.id)]))
          : null,
      ])),
    })),
  }
}

export async function publishAppConfig(payload) {
  if (!hasApiToken()) {
    return { ok: false, message: 'Add the API token in the Sync panel first.' }
  }
  if (!payload.events.length) {
    return { ok: false, message: 'No event layouts to publish yet. Open Home Builder and save a layout first.' }
  }

  try {
    const r = await fetch(APP_CONFIG_URL, {
      method: 'POST',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))

    if (!r.ok) {
      return { ok: false, message: (j && j.message) ? j.message : 'Publish failed (HTTP ' + r.status + ').' }
    }

    const state = {
      version: j.version,
      updatedAt: j.updated_at,
      updatedBy: j.updated_by,
      events: j.events,
      banners: j.banners,
      at: Date.now(),
    }
    savePublishState(state)
    return { ok: true, message: 'Published version ' + j.version + ' — ' + j.events + ' event layouts, ' + j.banners + ' banner packs.', state }
  } catch (e) {
    return { ok: false, message: 'Could not reach the server: ' + e.message }
  }
}

/* Reads back what the apps will actually see. */
export async function fetchAppConfig() {
  try {
    const r = await fetch(APP_CONFIG_URL, { cache: 'no-store' })
    if (!r.ok) return { ok: false, message: 'HTTP ' + r.status }
    return { ok: true, config: await r.json() }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}

export const APP_CONFIG_ENDPOINT = APP_CONFIG_URL

/* =========================================================================
   Product Editor — full product read/write.

   Everything here goes through our own mc/v1 endpoints rather than wc/v3 and
   wp/v2. Three reasons:

     1. One credential. The WooCommerce consumer key cannot touch the media
        library, so the old split needed a second credential just for images.
     2. The Store API strips meta_data, so ingredients needed a bespoke path
        regardless.
     3. The server can return exactly the shape this editor wants, instead of
        the console reshaping a large wc/v3 payload on every keystroke.

   The endpoints are thin wrappers. They call the same WooCommerce and
   WordPress functions the official routes do, under the same capability
   checks, so nothing is more permissive than it was.
   ========================================================================= */

const STORE_API = APP_CONFIG_HOST + '/wp-json/mc/v1'

/* Turns a failed response into something an operator can act on. */
async function storeError(res, fallback) {
  const j = await res.json().catch(() => ({}))
  if (res.status === 401) return 'The API token was rejected. Re-check it in the Sync panel.'
  if (res.status === 403) return (j && j.message) ? j.message : 'That token is not allowed to do this.'
  if (res.status === 429) return 'Too many failed attempts from this network. Wait fifteen minutes.'
  return (j && j.message) ? j.message : fallback + ' (HTTP ' + res.status + ').'
}

/* One product, in the shape the editor works with. */
export async function fetchProductForEdit(connectors, productId) {
  if (!hasApiToken()) return { ok: false, message: 'Add the API token in the Sync panel first.' }

  try {
    const res = await fetch(STORE_API + '/products/' + productId, { headers: tokenHeaders(), cache: 'no-store' })
    if (!res.ok) return { ok: false, message: await storeError(res, 'Could not load the product') }
    const p = await res.json()

    return {
      ok: true,
      product: {
        id: p.id,
        name: decodeEntities(p.name),
        description: stripTags(p.description),
        shortDescription: stripTags(p.short_description),
        price: p.regular_price || '',
        categoryId: p.categories && p.categories[0] ? p.categories[0].id : null,
        categoryName: p.categories && p.categories[0] ? decodeEntities(p.categories[0].name) : '',
        images: (p.images || []).map(i => ({ id: i.id, src: i.src, alt: i.alt || '' })),
        ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
        status: p.status,
      },
    }
  } catch (e) {
    return { ok: false, message: 'Could not reach the store: ' + e.message }
  }
}

function stripTags(html) {
  return String(html || '').replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

export async function fetchProductCategories(connectors) {
  if (!hasApiToken()) return []
  try {
    const res = await fetch(STORE_API + '/product-categories', { headers: tokenHeaders() })
    if (!res.ok) return []
    return (await res.json()).map(c => ({ id: c.id, name: decodeEntities(c.name), count: c.count }))
  } catch (e) {
    return []
  }
}

/* Uploads a file and returns its attachment id. The id — not the URL — is
   what WooCommerce wants when setting product images. */
export async function uploadMedia(connectors, file) {
  if (!hasApiToken()) {
    return { ok: false, message: 'Image upload needs the API token from the Sync panel.' }
  }

  try {
    const body = new FormData()
    body.append('file', file, file.name)
    // No Content-Type header: the browser must set the multipart boundary,
    // and overriding it produces an upload the server cannot parse.
    const res = await fetch(STORE_API + '/media', {
      method: 'POST',
      headers: tokenHeaders(),
      body,
    })
    if (!res.ok) return { ok: false, message: await storeError(res, 'Upload failed') }
    const j = await res.json()
    return { ok: true, image: { id: j.id, src: j.source_url, alt: '' } }
  } catch (e) {
    return { ok: false, message: 'Upload failed: ' + e.message }
  }
}

/* Writes the edited product back. Image order is meaningful — the first entry
   becomes the featured image, which is the one both apps show in aisle rows. */
export async function saveProduct(connectors, product) {
  if (!hasApiToken()) return { ok: false, message: 'Add the API token in the Sync panel first.' }

  const ingredients = product.ingredients
    .filter(r => r.name && r.name.trim())
    .map(r => ({ name: r.name.trim(), quantity: String(r.quantity || ''), unit: r.unit || '' }))

  const body = {
    name: product.name,
    description: product.description,
    short_description: product.shortDescription,
    regular_price: String(product.price || ''),
    images: product.images.map(img => ({ id: img.id })),
    ingredients,
  }
  if (product.categoryId) body.categories = [product.categoryId]

  try {
    const res = await fetch(STORE_API + '/products/' + product.id, {
      method: 'POST',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, message: await storeError(res, 'Save failed') }
    const j = await res.json()

    // The endpoint returns the product as re-read from the database, so these
    // counts are what was actually stored, not what we hoped to store.
    const savedImages = (j.images || []).length
    const savedIngredients = (j.ingredients || []).length
    return {
      ok: true,
      message: 'Saved. ' + savedImages + ' image' + (savedImages === 1 ? '' : 's') +
        ', ' + savedIngredients + ' ingredient' + (savedIngredients === 1 ? '' : 's') + ' written.',
      warnIngredients: savedIngredients === 0 && ingredients.length > 0,
    }
  } catch (e) {
    return { ok: false, message: 'Could not reach the store: ' + e.message }
  }
}

/* =========================================================================
   App releases — the build gate the customer apps read on launch.

   ROS is the control surface; it never updates itself. These values describe
   the Melting Cheese customer apps (food.meltingcheese.app on Android, the
   TestFlight build on iOS), which read them from mc/v1/app-config.
   ========================================================================= */

const RELEASES_KEY = 'mc-ros-app-releases'

export const BLANK_RELEASE = {
  minBuild: 0, latestBuild: 0, versionName: '', apkUrl: '', sha256: '', notes: '',
}

export function loadReleases() {
  try {
    const raw = localStorage.getItem(RELEASES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        android: { ...BLANK_RELEASE, ...(parsed.android || {}) },
        ios: { ...BLANK_RELEASE, ...(parsed.ios || {}) },
      }
    }
  } catch (e) { /* ignore */ }
  return { android: { ...BLANK_RELEASE }, ios: { ...BLANK_RELEASE } }
}

export function saveReleases(releases) {
  localStorage.setItem(RELEASES_KEY, JSON.stringify(releases))
}

/* Refuses the one combination that cannot be undone from the console: a
   minimum higher than anything published, which bricks every install. The
   server rejects it too — this exists so the operator finds out before
   pressing Publish rather than after. */
export function releaseProblems(releases) {
  const out = []
  for (const [platform, r] of Object.entries(releases)) {
    const label = platform === 'ios' ? 'iOS' : 'Android'
    if (r.minBuild > 0 && r.latestBuild > 0 && r.minBuild > r.latestBuild) {
      out.push(label + ': the required build (' + r.minBuild + ') is newer than the build on offer (' +
        r.latestBuild + '). Every user would be locked out.')
    }
    if (r.minBuild > 0 && !r.apkUrl && platform === 'android') {
      out.push('Android: forcing an update with no download link leaves users with nowhere to go.')
    }
    if (r.apkUrl && !r.sha256) {
      out.push(label + ': no checksum, so the app cannot verify what it downloads.')
    }
  }
  return out
}

export function releasesForPublish(releases) {
  const one = r => ({
    min_build: Number(r.minBuild) || 0,
    latest_build: Number(r.latestBuild) || 0,
    version_name: r.versionName || '',
    apk_url: r.apkUrl || '',
    sha256: r.sha256 || '',
    notes: r.notes || '',
  })
  return { android: one(releases.android), ios: one(releases.ios) }
}

/* Uploads an APK. The server verifies it really is an Android package and
   returns the SHA-256 of the bytes that landed on disk — hashing here in the
   browser would only describe what we meant to send. */
export async function uploadApk(file, build, onProgress) {
  if (!hasApiToken()) return { ok: false, message: 'Add the API token in the Sync panel first.' }
  if (!/\.apk$/i.test(file.name)) return { ok: false, message: 'That is not an .apk file.' }

  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    // XHR rather than fetch purely for upload progress — an APK is tens of
    // megabytes and a silent spinner for a minute looks like a hang.
    xhr.open('POST', STORE_API + '/release-apk?build=' + (Number(build) || 0))
    xhr.setRequestHeader('X-MC-Token', loadApiToken())
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let j = {}
      try { j = JSON.parse(xhr.responseText) } catch (e) { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, url: j.url, sha256: j.sha256, size: j.size, name: j.name })
      } else {
        resolve({ ok: false, message: j.message || 'Upload failed (HTTP ' + xhr.status + ').' })
      }
    }
    xhr.onerror = () => resolve({ ok: false, message: 'The upload could not reach the server.' })
    const body = new FormData()
    body.append('file', file, file.name)
    xhr.send(body)
  })
}

/* =========================================================================
   Live Orders — orders placed in the customer apps.

   These are real WooCommerce orders created by mc/v1/orders. Payment happens
   at the truck, so an order arrives on-hold and staff walk it forward:

       Received  ->  Preparing  ->  Collected

   Cancelled is a dead end from any state.
   ========================================================================= */

/* Which trucks exist and which events each is deployed to.

   The equipment checklist is deliberately left out: it is a packing aid for
   whoever loads the truck, and nothing outside this console needs it. */
export function fleetForPublish(trucks) {
  return (trucks || []).map(t => ({
    id: t.id,
    name: t.name || t.id,
    plate: t.plate || '',
    events: Object.keys(t.deployments || {}),
  }))
}

/** Trucks deployed to a given event, for the assignment dropdown. */
export function trucksAtEvent(eventId) {
  if (!eventId) return loadTrucks()
  return loadTrucks().filter(t => Object.keys(t.deployments || {}).includes(eventId))
}

export async function setOrderTruck(orderId, truckId) {
  if (!hasApiToken()) return { ok: false, message: 'Add the API token in the Sync panel first.' }
  try {
    const res = await fetch(STORE_API + '/orders/' + orderId + '/truck', {
      method: 'POST',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ truck: truckId || '' }),
    })
    if (!res.ok) return { ok: false, message: await storeError(res, 'Could not assign the truck') }
    return { ok: true, order: await res.json() }
  } catch (e) {
    return { ok: false, message: 'Could not reach the server: ' + e.message }
  }
}

export const ORDER_STATES = [
  { id: 'on-hold',    label: 'Received',  tone: 'amber' },
  { id: 'processing', label: 'Preparing', tone: 'blue'  },
  { id: 'completed',  label: 'Collected', tone: 'green' },
  { id: 'cancelled',  label: 'Cancelled', tone: 'red'   },
]

export function orderState(id) {
  return ORDER_STATES.find(s => s.id === id) || { id, label: id, tone: 'gray' }
}

/** The state a given order should move to next, or null at the end. */
export function nextOrderState(id) {
  const order = ['on-hold', 'processing', 'completed']
  const i = order.indexOf(id)
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null
}

export async function fetchOrders({ status, event, truck, perPage = 50 } = {}) {
  if (!hasApiToken()) return { ok: false, message: 'Add the API token in the Sync panel first.' }
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (event) qs.set('event', event)
  if (truck) qs.set('truck', truck)
  qs.set('per_page', String(perPage))

  try {
    const res = await fetch(STORE_API + '/orders?' + qs.toString(), {
      headers: tokenHeaders(), cache: 'no-store',
    })
    if (!res.ok) return { ok: false, message: await storeError(res, 'Could not load orders') }
    return { ok: true, orders: await res.json() }
  } catch (e) {
    return { ok: false, message: 'Could not reach the server: ' + e.message }
  }
}

export async function setOrderStatus(orderId, status) {
  if (!hasApiToken()) return { ok: false, message: 'Add the API token in the Sync panel first.' }
  try {
    const res = await fetch(STORE_API + '/orders/' + orderId + '/status', {
      method: 'POST',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return { ok: false, message: await storeError(res, 'Could not update the order') }
    return { ok: true, order: await res.json() }
  } catch (e) {
    return { ok: false, message: 'Could not reach the server: ' + e.message }
  }
}

export const INGREDIENT_UNITS = ['', 'g', 'kg', 'ml', 'l', 'pcs', 'portion', 'tbsp', 'tsp', 'slice', 'scoop']

/* Which app builds the device preview is drawn to match. Bump on each
   release so the console never claims to mirror a build that is not out. */
export const APP_BUILD = { ios: '16', android: 'dev' }
