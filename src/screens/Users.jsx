/* Screen: Customers / Users (Figma node 106-2)
   Stat strip, searchable user table, selected-user profile rail. */

const STATS = [
  { icon: '🧑‍🤝‍🧑', label: 'Total Customers', value: '4,892', delta: '+13.5% vs yesterday' },
  { icon: '🆕', label: 'New This Week', value: '128', delta: '+8% vs last week' },
  { icon: '🟢', label: 'Active Now', value: '64' },
  { icon: '📶', label: 'WiFi Signups', value: '538' },
  { icon: '⭐', label: 'VIP Members', value: '96' },
]

const USERS = [
  { name: 'Tunde Adeola', joined: 'GITEX 2026', email: 'tunde@gmail.com', tier: 'VIP', orders: 12, spend: 'AED 1,240', last: '2 min ago' },
  { name: 'Dola Martins', joined: 'App Signup', email: 'dola.m@outlook.com', tier: 'Gold', orders: 9, spend: 'AED 860', last: '1 hr ago' },
  { name: 'Aisha Bello', joined: 'WiFi Portal', email: 'aisha.b@gmail.com', tier: 'New', orders: 2, spend: 'AED 145', last: 'Today' },
  { name: 'Emeka Obi', joined: 'QR Menu', email: 'emeka.o@yahoo.com', tier: 'Silver', orders: 6, spend: 'AED 520', last: 'Yesterday' },
  { name: 'Grace Gomez', joined: 'Kiosk', email: 'grace.g@gmail.com', tier: 'New', orders: 1, spend: 'AED 78', last: 'Today' },
  { name: 'Femi Adeyemi', joined: 'GITEX 2026', email: 'femi.a@gmail.com', tier: 'Gold', orders: 8, spend: 'AED 780', last: '3 days ago' },
  { name: 'Mariam Khan', joined: 'App Signup', email: 'mariam.k@gmail.com', tier: 'Silver', orders: 5, spend: 'AED 430', last: 'This week' },
  { name: 'Samuel West', joined: 'WiFi Portal', email: 'sam.west@gmail.com', tier: 'New', orders: 1, spend: 'AED 62', last: 'Today' },
]

const tierTone = { VIP: 'orange', Gold: 'orange', Silver: 'gray', New: 'green' }
const muted = { color: 'var(--ink-3)', fontSize: 11 }

export default function Users() {
  const sel = USERS[0]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Users</h2>
          <div style={muted}>Manage and view all customers across all locations and events.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {STATS.map(s => (
            <div key={s.label} className="card" style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{s.value}</div>
              <div style={muted}>{s.label}</div>
              {s.delta && <div style={{ fontSize: 10, color: 'var(--green)' }}>{s.delta}</div>}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input placeholder="Search name, email, phone…" style={{
              flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', outline: 'none',
            }} />
            <select style={sel2}><option>All Locations</option></select>
            <select style={sel2}><option>All Status</option></select>
            <select style={sel2}><option>Sort: Recent</option></select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Customer</th><th>Source</th><th>Tier</th>
                <th>Orders</th><th>Total Spend</th><th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {USERS.map(u => (
                <tr key={u.email} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '9px 4px' }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 15, background: 'var(--amber-chip)',
                        display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11, color: 'var(--mc-orange-deep)',
                      }}>{u.name.split(' ').map(w => w[0]).join('')}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{u.name}</div>
                        <div style={muted}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.joined}</td>
                  <td><span className={'pill ' + tierTone[u.tier]}>{u.tier}</span></td>
                  <td style={{ textAlign: 'center' }}>{u.orders}</td>
                  <td><b>{u.spend}</b></td>
                  <td style={muted}>{u.last}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, ...muted }}>
            <span>Showing 1 to 8 of 4,892 customers</span>
            <span>‹ 1 2 3 … 612 ›</span>
          </div>
        </div>
      </div>

      {/* Profile rail */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 62, height: 62, borderRadius: 31, background: 'var(--amber-chip)', margin: '0 auto',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 20, color: 'var(--mc-orange-deep)',
          }}>TA</div>
          <div style={{ fontWeight: 800, marginTop: 8 }}>{sel.name}</div>
          <div style={muted}>{sel.email}</div>
          <div style={{ marginTop: 6 }}><span className="pill orange">VIP Member</span></div>
        </div>

        <h4 style={h4}>Systems Details</h4>
        {[['First seen', 'GITEX 2026'], ['Device', 'iPhone 14 Pro'], ['Marketing opt-in', 'Yes'], ['Language', 'English']].map(([k, v]) => (
          <div key={k} style={row}><span style={{ color: 'var(--ink-2)' }}>{k}</span><b>{v}</b></div>
        ))}

        <h4 style={h4}>Activity Summary (Today)</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={statBox}><b>1</b><div style={muted}>Orders</div></div>
          <div style={statBox}><b>AED 145.00</b><div style={muted}>Spend</div></div>
        </div>

        <h4 style={h4}>Recent Orders</h4>
        {[['MC-1025 · 3 items', 'AED 145.00'], ['MC-0987 · 2 items', 'AED 98.00'], ['MC-0901 · 4 items', 'AED 176.00']].map(([o, v]) => (
          <div key={o} style={row}><span style={{ color: 'var(--ink-2)' }}>{o}</span><b>{v}</b></div>
        ))}

        <button className="btn-primary" style={{ width: '100%', marginTop: 14, fontSize: 12.5 }}>View Full Profile</button>
      </div>
    </div>
  )
}

const sel2 = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const h4 = { fontSize: 11, letterSpacing: 0.6, color: 'var(--ink-3)', margin: '18px 0 8px', textTransform: 'uppercase' }
const row = { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--line)' }
const statBox = { flex: 1, background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 8px', textAlign: 'center', fontSize: 13 }
