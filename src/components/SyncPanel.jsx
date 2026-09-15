import { useState, useEffect, useRef } from 'react'
import { loadConnectors, saveConnectors, syncProducts, fmtSyncTime, syncAgeMinutes,
  loadApiToken, saveApiToken, testApiToken } from '../lib/connectors.js'

/* Sync button + connectors modal shared by Items and Inventory.
   Product connectors feed the live sync; tool connectors are quick links. */

const field = { border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, width: '100%', outline: 'none', fontFamily: 'monospace' }
const muted = { color: 'var(--ink-3)', fontSize: 11 }

/* Products are considered fresh for this long; past it the screen
   re-syncs on its own so the operator never has to press the button. */
const STALE_AFTER_MIN = 10

export default function SyncPanel({ onSynced, lastSync, autoSync = true }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [conns, setConns] = useState(loadConnectors)
  const [auto, setAuto] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const ranAuto = useRef(false)

  const set = (key, field, value) => setConns(c => ({ ...c, [key]: { ...c[key], [field]: value } }))

  /* One key pair drives both product sources — they point at the same store. */
  const setKeys = (field, value) => setConns(c => {
    const apply = field === 'clear' ? { ck: '', cs: '' } : { [field]: value }
    return { ...c, website: { ...c.website, ...apply }, app: { ...c.app, ...apply } }
  })
  const keysSet = !!(conns.website.ck && conns.website.cs)

  const [token, setToken] = useState(loadApiToken)
  const [wpTest, setWpTest] = useState(null)
  const [testing, setTesting] = useState(false)
  const wpSet = token.startsWith('mck_')

  const updateToken = value => {
    const next = value.trim()
    setToken(next); saveApiToken(next); setWpTest(null)
  }

  const runWpTest = async () => {
    setTesting(true)
    setWpTest(await testApiToken(token))
    setTesting(false)
  }

  /* Automatic sync: fires once on mount when the cache is missing or stale,
     then on a timer while the screen stays open. Silent — no modal. */
  useEffect(() => {
    if (!autoSync) return
    const c = loadConnectors()
    if (!c.website.url && !c.app.url) return

    const run = async (force) => {
      const age = syncAgeMinutes(lastSync)
      if (!force && age != null && age < STALE_AFTER_MIN) return
      setAuto(true)
      const result = await syncProducts(c)
      setAuto(false)
      if (result.items.length) onSynced && onSynced(result)
    }

    if (!ranAuto.current) { ranAuto.current = true; run(false) }
    const t = setInterval(() => run(true), STALE_AFTER_MIN * 60000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync])

  const runSync = async () => {
    setBusy(true)
    setStatus(null)
    saveConnectors(conns)
    const result = await syncProducts(conns)
    setBusy(false)
    if (result.items.length) {
      setStatus('Synced ' + result.items.length + ' products' + (result.errors.length ? ' · ' + result.errors.join(' · ') : ''))
      onSynced && onSynced(result)
      setOpen(false)
    } else {
      setStatus('Sync failed — ' + (result.errors.join(' · ') || 'no products returned'))
    }
  }

  return (
    <>
      <span style={{ ...muted, marginRight: 10 }}>
        {auto
          ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>⟳ Auto-syncing…</span>
          : lastSync
            ? <>Auto-synced {fmtSyncTime(lastSync)}</>
            : null}
      </span>
      <button className="btn-primary" style={{ fontSize: 12.5, marginRight: 8 }}
        onClick={() => setOpen(true)}>⟳ Sync</button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,20,30,.45)',
          display: 'grid', placeItems: 'center', padding: 16,
        }} onClick={() => !busy && setOpen(false)}>
          <div className="card" style={{
            width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
            padding: 20, background: 'var(--surface)', textAlign: 'left', cursor: 'default',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Sync Products — Connectors</h3>
              <div style={{ flex: 1 }} />
              <button style={{ fontSize: 16 }} onClick={() => setOpen(false)}>✕</button>
            </div>
            <div style={{ ...muted, marginBottom: 14 }}>
              Enter the backend URL for each system. Product connectors are pulled live
              from the WooCommerce Store API; the rest are saved as quick links.
            </div>

            {/* ---- API keys: own block, top of the panel, applied to both sources ---- */}
            <div style={{
              border: '1px solid var(--mc-orange)', background: 'var(--amber-chip)',
              borderRadius: 10, padding: 14, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                <b style={{ fontSize: 13 }}>WooCommerce API key</b>
                <div style={{ flex: 1 }} />
                <span className={'pill ' + (keysSet ? 'green' : 'gray')}>
                  {keysSet ? 'Push enabled' : 'Not set — read only'}
                </span>
              </div>
              <div style={{ ...muted, marginBottom: 9, color: 'var(--ink-2)' }}>
                Required to push prices, stock and quantities back out to the website
                and the mobile app. Without it ROS can read products but not change them.
              </div>

              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                Consumer key
              </label>
              <input style={{ ...field, marginBottom: 8 }} value={conns.website.ck || ''}
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off" spellCheck="false"
                onChange={e => setKeys('ck', e.target.value.trim())} />

              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                Consumer secret
              </label>
              <input style={field} type={showSecret ? 'text' : 'password'} value={conns.website.cs || ''}
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off" spellCheck="false"
                onChange={e => setKeys('cs', e.target.value.trim())} />

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, gap: 10 }}>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showSecret}
                    onChange={e => setShowSecret(e.target.checked)} />
                  Show secret
                </label>
                <div style={{ flex: 1 }} />
                {keysSet && (
                  <button style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => setKeys('clear')}>Clear keys</button>
                )}
              </div>

              <div style={{ ...muted, marginTop: 9, lineHeight: 1.5 }}>
                Get one from WordPress admin › <b>WooCommerce › Settings › Advanced ›
                REST API › Add key</b> — set Permissions to <b>Read/Write</b>.
                The pair is applied to both product sources and is stored only in this browser,
                never sent anywhere except your own store.
              </div>
            </div>

            {/* ---- App publishing credential: separate from the store keys ---- */}
            <div style={{
              border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                <b style={{ fontSize: 13 }}>App publishing</b>
                <div style={{ flex: 1 }} />
                <span className={'pill ' + (wpSet ? 'green' : 'gray')}>
                  {wpSet ? 'Publish enabled' : 'Not set'}
                </span>
              </div>
              <div style={{ ...muted, marginBottom: 9, color: 'var(--ink-2)' }}>
                One token covers publishing the app home layout, uploading images and
                saving products. It acts as the WordPress account that issued it, so it
                can never do more than that person can.
              </div>

              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 3 }}>
                API token
              </label>
              <input style={field} type={showSecret ? 'text' : 'password'} value={token}
                placeholder="mck_..."
                autoComplete="off" spellCheck="false"
                onChange={e => updateToken(e.target.value)} />

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 9, gap: 8 }}>
                <button style={{
                  border: '1px solid var(--line)', borderRadius: 8, padding: '6px 11px',
                  fontSize: 11.5, background: '#fff', cursor: 'pointer',
                }} disabled={!wpSet || testing} onClick={runWpTest}>
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
                <div style={{ flex: 1 }} />
                {wpSet && (
                  <button style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => { setToken(''); saveApiToken(''); setWpTest(null) }}>
                    Clear
                  </button>
                )}
              </div>

              {wpTest && (
                <div style={{
                  marginTop: 9, fontSize: 11.5, lineHeight: 1.5, borderRadius: 8, padding: '8px 10px',
                  background: wpTest.ok ? 'var(--green-soft)' : 'var(--red-soft)',
                  color: wpTest.ok ? 'var(--green)' : 'var(--red)',
                }}>
                  {wpTest.message}
                </div>
              )}

              <div style={{ ...muted, marginTop: 9, lineHeight: 1.5 }}>
                Issue one in WordPress admin › <b>Users › API Tokens</b>. It is shown once,
                can be revoked there at any time, and is stored only in this browser.
              </div>
            </div>

            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-3)', margin: '10px 0 6px' }}>PRODUCT SOURCES</div>
            {['website', 'app'].map(k => (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 3 }}>{conns[k].label}</div>
                <input style={field} value={conns[k].url} placeholder="https://…"
                  onChange={e => set(k, 'url', e.target.value)} />
              </div>
            ))}

            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: 'var(--ink-3)', margin: '14px 0 6px' }}>TOOL CONNECTORS (OPTIONAL)</div>
            {['github', 'codemagic', 'appledev'].map(k => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>{conns[k].label}</span>
                  <div style={{ flex: 1 }} />
                  {conns[k].url && <a href={conns[k].url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10.5, color: 'var(--mc-orange-deep)', fontWeight: 700 }}>Open ↗</a>}
                </div>
                <input style={field} value={conns[k].url} placeholder="https://…"
                  onChange={e => set(k, 'url', e.target.value)} />
              </div>
            ))}

            {status && <div style={{
              fontSize: 11.5, padding: '8px 10px', borderRadius: 8, margin: '8px 0',
              background: /failed/.test(status) ? 'var(--red-soft)' : 'var(--green-soft)',
              color: /failed/.test(status) ? 'var(--red)' : 'var(--green)', fontWeight: 600,
            }}>{status}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-primary" style={{ fontSize: 12.5, opacity: busy ? .6 : 1 }}
                disabled={busy} onClick={runSync}>{busy ? 'Syncing…' : '⟳ Sync now'}</button>
              <button style={{
                border: '1px solid var(--line)', borderRadius: 8, padding: '8px 14px', fontSize: 12,
              }} onClick={() => { saveConnectors(conns); setOpen(false) }}>Save & close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function SourcePills({ sources }) {
  if (!sources || !sources.length) return <span className="pill gray">Demo</span>
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {sources.includes('Website') && <span className="pill blue">Website</span>}
      {sources.includes('App') && <span className="pill orange">App</span>}
    </span>
  )
}
