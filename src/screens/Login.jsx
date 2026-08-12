import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* Screen: Admin Login (Figma node 101-2489)
   Three-panel layout inside a cheese-drip frame:
   brand / login form / secured-area notice. */

const panel = {
  background: 'var(--surface)', borderRadius: 16, padding: 26,
  boxShadow: 'var(--shadow)', border: '1px solid var(--line)',
}

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [remember, setRemember] = useState(false)

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
        <section style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 30 }}>🧀</span>
            <div style={{ fontWeight: 800, fontSize: 22 }}>
              melting cheese <span className="pill orange">OPS</span>
            </div>
            <h2 style={{ margin: '14px 0 2px', fontSize: 20 }}>Login</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Hello! Log in with your email.</div>
          </div>

          <label style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 18 }}>Email address:</label>
          <div style={inputWrap}>
            <span>👤</span>
            <input style={inputStyle} placeholder="admin@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <label style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 12 }}>Password:</label>
          <div style={inputWrap}>
            <span>🔒</span>
            <input style={inputStyle} type="password" placeholder="••••••••••" />
            <span style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>👁</span>
          </div>

          <label style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 12 }}>Language</label>
          <div style={inputWrap}>
            <span>🌐</span>
            <select style={{ ...inputStyle, background: 'transparent' }}>
              <option>English</option>
              <option>العربية</option>
            </select>
          </div>

          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, margin: '14px 0' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            Remember me
          </label>

          <button onClick={() => nav('/dashboard')} style={{
            background: 'var(--blue)', color: '#fff', fontWeight: 800, fontSize: 14,
            borderRadius: 8, padding: '12px 0', letterSpacing: 0.4,
          }}>LOG IN</button>

          <div style={{ textAlign: 'center', fontSize: 12, marginTop: 16, color: 'var(--ink-2)' }}>
            Your IP Address: <span style={{ color: 'var(--blue)' }}>—</span><br />
            City / Country: <span style={{ color: 'var(--blue)' }}>Dubai, United Arab Emirates</span>
          </div>
        </section>

        {/* Secured-area notice */}
        <section style={{ ...panel, fontSize: 11, lineHeight: 1.6 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 27, background: 'var(--amber-chip)',
            display: 'grid', placeItems: 'center', fontSize: 24, margin: '0 auto 14px',
          }}>🛡</div>
          <p style={{ fontWeight: 700, fontSize: 10.5 }}>
            YOU ARE NOW BROWSING A SECURED AREA!
            PLEASE ENTER YOUR AUTHORISED ID CODE TO RESET YOUR PASSWORD
          </p>
          <p style={{ color: 'var(--red)', fontWeight: 800, fontSize: 13 }}>WARNING:</p>
          <p>
            You have accessed a Secured Computer system managed by IntelliHive Technologies.
            You are required to have authorization from IntelliHive Solutions before you proceed
            and you are strictly limited to the use set out within that authorization.
          </p>
          <p>
            Unauthorized access to or misuse of this system is prohibited and constitutes an
            offence under the Computer Misuse Act 1990.
            For any support inquiries contact <span style={{ color: 'var(--blue)' }}>Admin@intellihiveops.com</span>
          </p>
          <p>For Systems Support, call +971 10522 921188</p>
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
