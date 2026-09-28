/* Console state — one copy on the server, a cache in the browser.

   Until now every section of the console (events, trucks, banner packs,
   layouts, the synced catalogue…) lived only in this browser's localStorage.
   A second operator opening the console on another device saw demo defaults,
   because from that browser's point of view nothing had ever been set up.

   This module puts the real copy on dev2 (mc/v1/console-state, see
   server/mu-plugins/mc-console.php) and keeps localStorage as a cache so
   the console still opens with no network.

   The rules:

   - load() / save() in connectors.js stay synchronous. They read and write
     the in-memory store here; nothing at a call site had to change.
   - The store is hydrated from the server ONCE, before the first render
     (main.jsx awaits hydrateConsoleState()). If the server is unreachable or
     there is no API token yet, it falls back to localStorage and says so.
   - Writes go to memory + localStorage immediately, and to the server on a
     short debounce, carrying the revision of each section they replace.
   - A 409 means another device wrote that section first. The server's copy
     wins; the local one is replaced and a 'conflict' event fires so the UI
     can tell the operator, rather than silently losing either side.
   - The API token is the one thing that never goes to the server — it is
     the credential that authorises the request. It stays in localStorage.
   - Product-connector keys (ck/cs) stay local as well; the server strips
     them if they are ever sent, and we do not send them. */

const HOST = 'https://dev2.meltingcheese.food'
const URL = HOST + '/wp-json/mc/v1/console-state'

/* Same key connectors.js uses. Read here directly rather than imported, so
   this module has no dependency on connectors.js (which depends on this one). */
const TOKEN_KEY = 'mc-ros-api-token'
function loadApiToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch (e) { return '' }
}

/* section name on the server  ->  localStorage key it used to live under.
   The localStorage keys are unchanged so an existing console keeps its data
   through the upgrade and can seed the server from it. */
export const SECTIONS = {
  connectors: 'mc-ros-connectors',
  synced_products: 'mc-ros-synced-products',
  events: 'mc-ros-events',
  crates: 'mc-ros-crates',
  trucks: 'mc-ros-trucks',
  banner_packs: 'mc-ros-banner-packs',
  home_layouts: 'mc-ros-home-layouts',
  publish_state: 'mc-ros-publish-state',
  app_releases: 'mc-ros-app-releases',
}

/* Keys removed from the connectors section before it leaves the browser.
   Mirrors the server's strip list for the fields the console actually has. */
const LOCAL_ONLY_CONNECTOR_FIELDS = ['ck', 'cs']

const PUSH_DEBOUNCE_MS = 800
const HYDRATE_TIMEOUT_MS = 4000
/* The server refuses bodies over 512 KB. Stay well under it so a large
   synced catalogue never blocks every other section from saving. */
const MAX_PUSH_BYTES = 400 * 1024

const mem = {}          // section -> value (undefined = never read)
let revisions = {}      // section -> int, as last confirmed by the server
let dirty = new Set()   // sections changed since the last successful push
let pushTimer = null
let pushing = false
let hydrated = false

/* 'booting' | 'server' | 'local' | 'no-token' | 'offline' | 'error' */
let status = 'booting'
let lastError = ''
let lastSavedAt = null
let lastSavedBy = null

const listeners = new Set()

function emit(type, detail) {
  for (const fn of listeners) {
    try { fn({ type, status, detail }) } catch (e) { /* a listener must not break saving */ }
  }
}

/* Subscribe to state changes: {type:'status'|'saved'|'conflict'|'error', status, detail}.
   Returns an unsubscribe function. */
export function onConsoleState(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function consoleStateStatus() {
  return { status, hydrated, lastError, lastSavedAt, lastSavedBy, pending: dirty.size }
}

function setStatus(next, err) {
  status = next
  lastError = err || ''
  emit('status')
}

/* ---- localStorage cache ------------------------------------------------ */

function cacheRead(section) {
  try {
    const raw = localStorage.getItem(SECTIONS[section])
    return raw ? JSON.parse(raw) : undefined
  } catch (e) { return undefined }
}

function cacheWrite(section, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(SECTIONS[section])
    else localStorage.setItem(SECTIONS[section], JSON.stringify(value))
  } catch (e) { /* quota or private mode - the server copy is the real one */ }
}

/* ---- the store the load and save functions talk to ---------------------- */

/* Returns the current value of a section, or undefined if nothing has ever
   been stored (the caller then supplies its defaults). Before hydration, or
   with no server, this is the localStorage value. */
export function readSection(section) {
  if (!(section in SECTIONS)) throw new Error('Unknown console section: ' + section)
  if (!(section in mem)) mem[section] = cacheRead(section)
  return mem[section]
}

export function writeSection(section, value) {
  if (!(section in SECTIONS)) throw new Error('Unknown console section: ' + section)
  mem[section] = value
  cacheWrite(section, value)
  dirty.add(section)
  schedulePush()
}

/* ---- server I/O -------------------------------------------------------- */

function headers(extra) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {})
  const t = loadApiToken()
  if (t) h['X-MC-Token'] = t
  return h
}

/* What we send for a section. Only the connectors section carries anything
   that must not leave the browser. */
function outbound(section, value) {
  if (section !== 'connectors' || !value || typeof value !== 'object') return value
  const clean = {}
  for (const [k, c] of Object.entries(value)) {
    if (!c || typeof c !== 'object') { clean[k] = c; continue }
    const copy = { ...c }
    for (const f of LOCAL_ONLY_CONNECTOR_FIELDS) delete copy[f]
    clean[k] = copy
  }
  return clean
}

/* What we keep from a server copy of a section: for connectors, put the
   locally held keys back so a device that entered them keeps them. */
function inbound(section, serverValue) {
  if (section !== 'connectors' || !serverValue || typeof serverValue !== 'object') return serverValue
  const local = cacheRead(section) || {}
  const merged = {}
  for (const [k, c] of Object.entries(serverValue)) {
    merged[k] = { ...(c || {}) }
    for (const f of LOCAL_ONLY_CONNECTOR_FIELDS) {
      if (local[k] && local[k][f]) merged[k][f] = local[k][f]
    }
  }
  return merged
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

/* Pull the server copy into memory. Called once at boot; safe to call again
   (e.g. after the operator pastes a token on the Sync screen). */
export async function hydrateConsoleState({ timeoutMs = HYDRATE_TIMEOUT_MS } = {}) {
  if (!loadApiToken()) {
    hydrated = false
    setStatus('no-token')
    return consoleStateStatus()
  }

  let res
  try {
    res = await withTimeout(fetch(URL, { headers: headers() }), timeoutMs)
  } catch (e) {
    hydrated = false
    setStatus('offline', e.message === 'timeout' ? 'The server did not answer in time.' : e.message)
    return consoleStateStatus()
  }

  if (res.status === 404) {
    // Plugin not deployed yet. Behave exactly as before this module existed.
    hydrated = false
    setStatus('local', 'mc-console.php is not on the server yet.')
    return consoleStateStatus()
  }
  if (res.status === 401 || res.status === 403) {
    hydrated = false
    setStatus('error', 'The API token was refused (' + res.status + ').')
    return consoleStateStatus()
  }
  if (!res.ok) {
    hydrated = false
    setStatus('error', 'Server answered ' + res.status + '.')
    return consoleStateStatus()
  }

  let body
  try { body = await res.json() } catch (e) {
    hydrated = false
    setStatus('error', 'The server sent something that was not JSON.')
    return consoleStateStatus()
  }

  revisions = Object.assign({}, body.revisions || {})
  lastSavedAt = body.updated_at || null
  lastSavedBy = body.updated_by || null

  if (body.empty) {
    /* First device to reach a blank server. Seed it from whatever this
       browser has, with revision 0 for each section, which the server
       accepts only if nobody else has seeded meanwhile. */
    for (const section of Object.keys(SECTIONS)) {
      const local = cacheRead(section)
      if (local !== undefined) { mem[section] = local; dirty.add(section) }
    }
    hydrated = true
    setStatus('server')
    if (dirty.size) await pushNow()
    return consoleStateStatus()
  }

  const sections = body.sections || {}
  for (const section of Object.keys(SECTIONS)) {
    if (section in sections) {
      mem[section] = inbound(section, sections[section])
      cacheWrite(section, mem[section])
    } else {
      /* Server has never seen this section. Keep the local value (if any)
         and queue it so the server learns it. */
      const local = cacheRead(section)
      if (local !== undefined) { mem[section] = local; dirty.add(section) }
    }
  }
  hydrated = true
  setStatus('server')
  if (dirty.size) schedulePush()
  return consoleStateStatus()
}

function schedulePush() {
  if (!hydrated) return                  // nothing to push to; localStorage has it
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushTimer = null; pushNow() }, PUSH_DEBOUNCE_MS)
}

/* Send every dirty section. Sections that conflict are replaced by the
   server's copy; the rest are confirmed. Resolves to the status object. */
export async function pushNow() {
  if (!hydrated || pushing || dirty.size === 0) return consoleStateStatus()
  pushing = true

  const batch = Array.from(dirty)
  const body = { sections: {}, revisions: {} }
  for (const s of batch) {
    body.sections[s] = outbound(s, mem[s])
    body.revisions[s] = revisions[s] || 0
  }

  let json = JSON.stringify(body)
  if (json.length > MAX_PUSH_BYTES && batch.includes('synced_products')) {
    /* The catalogue cache is the only section that can grow this far, and
       it is re-creatable with one Sync click. Drop it rather than lose the
       operator's events, trucks and layouts behind it. */
    delete body.sections.synced_products
    delete body.revisions.synced_products
    dirty.delete('synced_products')
    json = JSON.stringify(body)
    emit('error', 'The synced catalogue is too large to store on the server; it stays on this device only.')
  }

  let res
  try {
    res = await fetch(URL, { method: 'POST', headers: headers(), body: json })
  } catch (e) {
    pushing = false
    setStatus('offline', e.message)
    // dirty stays as it is; the next write re-schedules a push
    return consoleStateStatus()
  }

  let out = null
  try { out = await res.json() } catch (e) { /* handled below */ }

  if (res.status === 200 || res.status === 409) {
    if (out && out.revisions) revisions = Object.assign({}, revisions, out.revisions)
    lastSavedAt = (out && out.updated_at) || lastSavedAt
    lastSavedBy = (out && out.updated_by) || lastSavedBy
    for (const s of (out && out.written) || []) dirty.delete(s)

    if (res.status === 409 && out && out.conflict) {
      const lost = Object.keys(out.conflict)
      for (const s of lost) {
        if (out.sections && s in out.sections) {
          mem[s] = inbound(s, out.sections[s])
          cacheWrite(s, mem[s])
        }
        dirty.delete(s)
      }
      pushing = false
      setStatus('server')
      emit('conflict', { sections: lost, by: lastSavedBy, at: lastSavedAt })
      if (dirty.size) schedulePush()
      return consoleStateStatus()
    }

    if (out && out.secrets_not_stored && out.secrets_not_stored.length) {
      emit('error', 'Not stored on the server (kept on this device only): ' + out.secrets_not_stored.join(', '))
    }
    pushing = false
    setStatus('server')
    emit('saved', { sections: (out && out.written) || batch })
    if (dirty.size) schedulePush()
    return consoleStateStatus()
  }

  pushing = false
  if (res.status === 401 || res.status === 403) {
    setStatus('error', 'The API token was refused (' + res.status + '); changes are staying on this device.')
  } else if (res.status === 404) {
    hydrated = false
    setStatus('local', 'mc-console.php is not on the server yet.')
  } else {
    setStatus('error', (out && out.message) || ('Server answered ' + res.status + '.'))
  }
  return consoleStateStatus()
}

/* Flush before the tab goes away so a save made a moment before closing is
   not left in the debounce window. sendBeacon cannot carry our auth header,
   so this is best-effort with a keepalive fetch. */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (!hydrated || dirty.size === 0) return
    const body = { sections: {}, revisions: {} }
    for (const s of dirty) { body.sections[s] = outbound(s, mem[s]); body.revisions[s] = revisions[s] || 0 }
    try {
      fetch(URL, { method: 'POST', headers: headers(), body: JSON.stringify(body), keepalive: true })
    } catch (e) { /* nothing more we can do on the way out */ }
  })
}
