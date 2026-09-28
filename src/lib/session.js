/* Who is logged in.

   A login mints a session token on dev2 (server/mu-plugins/mc-login.php).
   That token is stored under the SAME localStorage key the pasted API token
   used, so every request the console already makes carries it without a
   single call site changing. The difference is that a session expires and
   Sign Out revokes it on the server.

   The pasted API token is now the fallback for machines and for the one
   day the login endpoint is unreachable - not the front door. */

import { loadApiToken, saveApiToken } from './connectors.js'
import { hydrateConsoleState } from './consoleState.js'

const HOST = 'https://dev2.meltingcheese.food'
const SESSION_KEY = 'mc-ros-session'

/* Everything the console needs to know about the person, minus the token. */
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (s && s.expires && new Date(s.expires).getTime() < Date.now()) return null
    return s
  } catch (e) { return null }
}

function saveSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch (e) { /* private mode - the token is what matters */ }
}

/* Logged in = a live session record AND a token to back it. A token alone
   (pasted the old way) also counts, so nobody is locked out of a console
   they could open yesterday; the header just cannot name them. */
export function isLoggedIn() {
  return !!loadApiToken() && (!!loadSession() || loadApiToken().startsWith('mck_'))
}

export async function login(username, password, remember) {
  let res
  try {
    res = await fetch(HOST + '/wp-json/mc/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, remember: !!remember }),
    })
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
  let body = null
  try { body = await res.json() } catch (e) { /* handled below */ }

  if (res.status === 404) {
    return { ok: false, error: 'Login is not available on the server yet (mc-login.php missing).' }
  }
  if (!res.ok || !body || !body.token) {
    return { ok: false, error: (body && body.message) || ('Login failed (' + res.status + ').') }
  }

  saveApiToken(body.token)
  const session = { user: body.user, expires: body.expires, kind: 'session', since: new Date().toISOString() }
  saveSession(session)
  // Pull the shared console state as this person before the screens mount.
  await hydrateConsoleState()
  return { ok: true, session }
}

/* Revokes on the server, then forgets everything local. Console state is
   cleared too: the next person on this device should hydrate from the
   server as themselves, not inherit a cache. */
export async function logout() {
  const token = loadApiToken()
  if (token) {
    try {
      await fetch(HOST + '/wp-json/mc/v1/logout', { method: 'POST', headers: { 'X-MC-Token': token } })
    } catch (e) { /* offline: the token still expires on its own */ }
  }
  saveApiToken('')
  saveSession(null)
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('mc-ros-')) localStorage.removeItem(k)
    }
  } catch (e) { /* ignore */ }
}

/* Asks the server who the token belongs to. Used by the shell to refresh
   the header and to notice a session that was revoked or expired elsewhere.
   Returns null when the token is no longer good. */
export async function refreshSession() {
  const token = loadApiToken()
  if (!token) return null
  let res
  try {
    res = await fetch(HOST + '/wp-json/mc/v1/me', { headers: { 'X-MC-Token': token } })
  } catch (e) {
    return loadSession()   // offline: keep what we have rather than log out
  }
  if (res.status === 401 || res.status === 403) return null
  if (res.status === 404) return loadSession()   // plugin not deployed yet
  if (!res.ok) return loadSession()
  let body = null
  try { body = await res.json() } catch (e) { return loadSession() }
  const session = { user: body.user, expires: body.expires, kind: body.kind, since: (loadSession() || {}).since || null }
  saveSession(session)
  return session
}
