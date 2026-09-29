import { useState, useEffect } from 'react'
import { listTokens, issueDeviceToken, revokeToken, hasApiToken } from '../lib/connectors.js'

/* Screen: Kitchen Tablets

   Each kitchen tablet is paired once with its own token (orders scope only).
   This is where those tokens are made and, when a tablet is lost or retired,
   taken away. Sessions (people logged into this console) and machine tokens
   (Codemagic) are listed too, so the whole picture of "what can talk to the
   store" is on one page - but only devices can be minted here.

   The secret is shown exactly once, right after issuing. It is not stored
   anywhere in plaintext, so if the tablet was not paired before this page
   is left, the token is gone and a new one is issued. That is the design,
   not a limitation. */

const muted = { color: 'var(--ink-3)', fontSize: 11 }

const KIND = {
  device:  ['Tablet',  'var(--amber-chip)', 'var(--mc-orange-deep)'],
  session: ['Login',   'var(--blue-soft)',  'var(--blue)'],
  api:     ['Machine', 'var(--bg)',         'var(--ink-3)'],
}

export default function KitchenTablets() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [fresh, setFresh] = useState(null)     // { id, label, token } - shown once
  const [copied, setCopied] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const connected = hasApiToken()

  const load = async () => {
    if (!connected) { setLoading(false); return }
    setLoading(true)
    const r = await listTokens()
    setLoading(false)
    if (r.ok) { setTokens(r.tokens); setError('') } else setError(r.message)
  }
  useEffect(() => { load() }, [])

  const issue = async (e) => {
    e.preventDefault()
    if (!label.trim() || issuing) return
    setIssuing(true); setError('')
    const r = await issueDeviceToken(label.trim())
    setIssuing(false)
    if (!r.ok) { setError(r.message); return }
    setFresh(r.issued); setCopied(false); setLabel('')
    load()
  }

  const revoke = async (id) => {
    setConfirmId(null)
    const r = await revokeToken(id)
    if (!r.ok) { setError(r.message); return }
    if (fresh && fresh.id === id) setFresh(null)
    load()
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(fresh.token); setCopied(true) } catch (e) { /* select-by-hand fallback below */ }
  }

  const devices = tokens.filter(t => t.kind === 'device')
  const others = tokens.filter(t => t.kind !== 'device')

  return (
    <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 800 }}>Kitchen Tablets</h1>
        <div style={{ ...muted, marginTop: 4, lineHeight: 1.5, maxWidth: 640 }}>
          Every tablet running the kitchen app is paired once with its own token. A token
          can only read and move orders — nothing else. Lose a tablet, revoke its row here,
          and the other tablets carry on.
        </div>
      </div>

      {!connected && <Callout tone="amber">Log in to manage tablets.</Callout>}
      {error && <Callout tone="red">{error}</Callout>}

      {/* Issue */}
      <form onSubmit={issue} className="card" style={{ padding: 16, display: 'grid', gap: 10, maxWidth: 640 }}>
        <b style={{ fontSize: 13 }}>Pair a new tablet</b>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={label} onChange={e => setLabel(e.target.value)} maxLength={60}
            placeholder='Name it for where it lives, e.g. "Truck 1 — pass"'
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontSize: 13 }} />
          <button type="submit" disabled={!label.trim() || issuing || !connected} style={{
            background: 'var(--mc-orange)', color: '#fff', fontWeight: 700, fontSize: 12.5,
            borderRadius: 8, padding: '9px 14px', opacity: (!label.trim() || issuing || !connected) ? 0.5 : 1,
          }}>{issuing ? 'Issuing…' : 'Issue token'}</button>
        </div>
        <div style={muted}>Then on the tablet: open the kitchen app → Pair this tablet → type the token.</div>
      </form>

      {/* The one-time reveal */}
      {fresh && (
        <div className="card" style={{ padding: 16, border: '2px solid var(--mc-orange)', maxWidth: 640, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 13 }}>Token for “{fresh.label}”</b>
            <span className="pill orange">Shown once</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setFresh(null)} style={{ fontSize: 11, color: 'var(--ink-3)' }}>Done, hide it</button>
          </div>
          <code onClick={e => { const r = document.createRange(); r.selectNodeContents(e.currentTarget); const s = getSelection(); s.removeAllRanges(); s.addRange(r) }}
            style={{
              display: 'block', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px',
              fontSize: 13, wordBreak: 'break-all', userSelect: 'all', cursor: 'text',
            }}>{fresh.token}</code>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={copy} style={{
              border: '1px solid var(--line)', borderRadius: 8, padding: '6px 11px', fontSize: 11.5, background: '#fff', cursor: 'pointer',
            }}>{copied ? 'Copied' : 'Copy'}</button>
            <span style={{ ...muted, lineHeight: 1.4 }}>
              Type or paste it into the tablet now. Once you hide this, it cannot be shown again —
              you would revoke this row and issue a new one.
            </span>
          </div>
        </div>
      )}

      {/* Devices */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
          <b style={{ fontSize: 13 }}>Paired tablets</b>
          <span style={{ ...muted, marginLeft: 8 }}>{devices.length}</span>
          <div style={{ flex: 1 }} />
          <button onClick={load} style={{ fontSize: 11.5, border: '1px solid var(--line)', borderRadius: 8, padding: '5px 10px', background: '#fff', cursor: 'pointer' }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {devices.length === 0 && !loading && (
          <div style={{ padding: 22, textAlign: 'center', ...muted }}>No tablets paired yet.</div>
        )}
        {devices.map(t => <Row key={t.id} t={t} confirmId={confirmId} setConfirmId={setConfirmId} onRevoke={revoke} />)}
      </section>

      {/* Everything else, for the full picture */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <b style={{ fontSize: 13 }}>Logins and machines</b>
          <div style={{ ...muted, marginTop: 2 }}>
            Logins are people using this console (they expire on their own). Machines are
            Codemagic and the like, issued in WordPress. Revoking a login signs that device out.
          </div>
        </div>
        {others.map(t => <Row key={t.id} t={t} confirmId={confirmId} setConfirmId={setConfirmId} onRevoke={revoke} />)}
      </section>
    </div>
  )
}

function Row({ t, confirmId, setConfirmId, onRevoke }) {
  const [kindLabel, bg, fg] = KIND[t.kind] || KIND.api
  const fmt = iso => iso ? new Date(iso).toLocaleString() : '—'
  const label = String(t.label || '').replace(/^(Tablet|Session) · /, '')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
      <span style={{ background: bg, color: fg, borderRadius: 999, padding: '3px 9px', fontSize: 10.5, fontWeight: 700, minWidth: 58, textAlign: 'center' }}>{kindLabel}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label || '(unnamed)'} {t.current && <span className="pill green" style={{ marginLeft: 6 }}>this device</span>}
        </div>
        <div style={muted}>
          {t.user ? 'as ' + t.user + ' · ' : ''}{t.scopes.join(', ')} · issued {fmt(t.created)}
          {t.expires ? ' · expires ' + fmt(t.expires) : ''}
        </div>
      </div>
      <div style={{ ...muted, textAlign: 'right', minWidth: 150 }}>
        {t.last_used ? 'last seen ' + fmt(t.last_used) : 'never used'}
        {t.last_ip ? <div>{t.last_ip}</div> : null}
      </div>
      {!t.current && (confirmId === t.id ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button onClick={() => onRevoke(t.id)} style={{ fontSize: 11, color: '#fff', background: 'var(--red)', fontWeight: 700, borderRadius: 6, padding: '5px 9px' }}>Revoke now</button>
          <button onClick={() => setConfirmId(null)} style={{ fontSize: 11, color: 'var(--ink-2)', background: 'none' }}>Keep</button>
        </span>
      ) : (
        <button onClick={() => setConfirmId(t.id)} style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, background: 'none', cursor: 'pointer' }}>Revoke</button>
      ))}
    </div>
  )
}

function Callout({ tone, children }) {
  const map = { amber: ['var(--amber-chip)', 'var(--mc-orange-deep)'], red: ['var(--red-soft)', 'var(--red)'] }
  const [bg, fg] = map[tone] || map.amber
  return <div style={{ background: bg, color: fg, borderRadius: 8, padding: '10px 12px', fontSize: 11.5, lineHeight: 1.55, maxWidth: 640 }}>{children}</div>
}
