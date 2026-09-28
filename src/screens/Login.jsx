import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { login, isLoggedIn } from '../lib/session.js'

/* Screen: Admin Login (Figma node 101-2489)
   Three-panel layout inside a cheese-drip frame:
   brand / login form / secured-area notice. */

const panel = {
  background: 'var(--surface)', borderRadius: 16, padding: 26,
  boxShadow: 'var(--shadow)', border: '1px solid var(--line)',
}

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const dest = (loc.state && loc.state.from && loc.state.from !== '/login') ? loc.state.from : '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Already signed in on this device - no need to ask again.
  useEffect(() => { if (isLoggedIn()) nav(dest, { replace: true }) }, [])

  async function submit(e) {
    if (e) e.preventDefault()
    if (busy) return
    setError('')
    if (!email.trim() || !password) { setError('Enter your username or email, and your password.'); return }
    setBusy(true)
    const res = await login(email.trim(), password, remember)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    nav(dest, { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div className="drip" />
      <div style={{
        flex: 1, display: 'grid', gap: 20, padding: '28px 4vw',
        gridTemplateColumns: 'minmax(220px, 1fr) minmax(300px, 1.25fr) minmax(220px, 1fr)',
        alignItems: 'stretch', maxWidth: 1180, width: '100%', margin: '0 auto',
      }}>
        {/* Brand panel */}
        <section style={panel}>
          <div style={{ fontWeight: 800, fontSize: 26, lineHeight: 1, color: 'var(--mc-orange)' }}>
            melting<br />cheese
          </div>
          <div style={{ letterSpacing: 3, fontSize: 11, fontWeight: 700, marginTop: 6 }}>OPERATIONS</div>

          <h1 style={{ fontSize: 24, margin: '30px 0 10px' }}>Welcome Back!</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.55 }}>
            Login to your operations account and monitor performance,
            manage orders and grow your business.
          </p>
          <div style={{ fontSize: 84, textAlign: 'center', marginTop: 18 }}>🍔</div>
        </section>

        {/* Login form */}
        <form onSubmit={submit} style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 30 }}>🧀</span>
            <div style={{ fontWeight: 800, fontSize: 22 }}>
              melting cheese <span className="pill orange">OPS</span>
            </div>
            <h2 style={{ margin: '14px 0 2px', fontSize: 20 }}>Login</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Log in with your Melting Cheese account.</div>
          </div>

          <label style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 18 }}>Username or email:</label>
          <div style={inputWrap}>
            <span>👤</span>
            <input style={inputStyle} placeholder="you@meltingcheese.food"
              autoComplete="username" autoFocus
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <label style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 12 }}>Password:</label>
          <div style={inputWrap}>
            <span>🔒</span>
            <input style={inputStyle} type={showPw ? 'text' : 'password'} placeholder="••••••••••"
              autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)} />
            <span title={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw(!showPw)}
              style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>{showPw ? '🙈' : '👁'}</span>
          </div>

          {error && (
            <div role="alert" style={{
              marginTop: 12, fontSize: 12, lineHeight: 1.45, borderRadius: 8, padding: '8px 10px',
              background: 'var(--red-soft)', color: 'var(--red)', fontWeight: 600,
            }}>{error}</div>
          )}

          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, margin: '14px 0' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            Remember me on this device (30 days)
          </label>

          <button type="submit" disabled={busy} style={{
            background: 'var(--blue)', color: '#fff', fontWeight: 800, fontSize: 14,
            borderRadius: 8, padding: '12px 0', letterSpacing: 0.4, opacity: busy ? 0.7 : 1,
          }}>{busy ? 'LOGGING IN…' : 'LOG IN'}</button>

          <div style={{ textAlign: 'center', fontSize: 12, marginTop: 16, color: 'var(--ink-2)' }}>
            Forgot your password?{' '}
            <a href="https://dev2.meltingcheese.food/wp-login.php?action=lostpassword"
              target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>Reset it by email</a>
            <br />
            Without "remember me", you stay logged in for 12 hours.
          </div>
        </form>

        {/* Secured-area notice */}
        <section style={{ ...panel, fontSize: 11, lineHeight: 1.6 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 27, background: 'var(--amber-chip)',
            display: 'grid', placeItems: 'center', fontSize: 24, margin: '0 auto 14px',
          }}>🛡</div>
          <p style={{ fontWeight: 700, fontSize: 10.5 }}>
            MELTING CHEESE OPERATIONS CONSOLE
          </p>
          <p>
            This console runs the Melting Cheese menu, app content, events, trucks and
            live orders. It is for authorised staff only.
          </p>
          <p>
            Your login is your Melting Cheese staff account. Accounts are created by an
            administrator; there is no self-registration. If you cannot log in, ask the
            person who runs the business, not the internet.
          </p>
          <p>
            Every change you make is recorded against your account, and other people
            using the console at the same time will see it.
          </p>
        </section>
      </div>
      <div className="drip flip" />
    </div>
  )
}

const inputWrap = {
  display: 'flex', alignItems: 'center', gap: 8,
  border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', marginTop: 5,
}
const inputStyle = { border: 'none', outline: 'none', flex: 1, fontSize: 13 }
