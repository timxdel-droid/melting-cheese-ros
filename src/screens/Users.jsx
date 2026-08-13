/* Screen: Full Customers page (Figma node 139-474)
   KPI chips, filter row, full-width customer table with contact & social,
   status/type, spend, order history and per-row View action. */

const STATS = [
  { icon: '👤', label: 'Total Customers', value: '4,892', sub: '↗ 18.6% vs yesterday', tone: 'var(--green)' },
  { icon: '🔓', label: 'Currently Logged In', value: '128', sub: '● Online now', tone: 'var(--green)' },
  { icon: '📶', label: 'WiFi Connected Now', value: '64', sub: 'Across 2 locations', tone: 'var(--ink-3)' },
  { icon: '📡', label: 'WiFi Connected Today', value: '538', sub: 'Across 2 locations', tone: 'var(--ink-3)' },
  { icon: '🆕', label: 'New Registered Today', value: '96', sub: '↗ 22.4% vs yesterday', tone: 'var(--green)' },
]

const CUSTOMERS = [
  { name: 'Tunde Adeola', email: 'tunde.a@gmail.com', phone: '+971 50 123 4567', social: ['📸', '📘', '𝕏'], loc: 'Dubai WTC-GITEX', live: true, status: 'Existing', spend: 'AED 245.90', orders: 5, last: '19:10', reg: '22 Oct 2026, 10:15' },
  { name: 'Bola Mensah', email: 'bola.m@gmail.com', phone: '+971 55 234 5678', social: ['📸', '📘', '𝕏', '👻'], loc: 'Dubai Bluewater - Afroloud', live: true, status: 'Existing', spend: 'AED 189.00', orders: 3, last: '18:55', reg: '22 Oct 2026, 11:02' },
  { name: 'Aisha Ibrahim', email: 'aisha.i@gmail.com', phone: '+971 56 345 6789', social: ['📸', '📘', '𝕏'], loc: 'Dubai WTC - GITEX', live: true, status: 'New', spend: 'AED 120.00', orders: 2, last: '18:40', reg: '22 Oct 2026, 14:22' },
  { name: 'Emeka Okafor', email: 'emeka.o@gmail.com', phone: '+971 52 456 7890', social: ['📸', '📘', '👻'], loc: 'Dubai Bluewater - Afroloud', live: true, status: 'Existing', spend: 'AED 310.00', orders: 6, last: '18:30', reg: '21 Oct 2026, 16:45' },
  { name: 'Grace Nwosu', email: 'grace.n@gmail.com', phone: '+971 56 567 8901', social: ['📸', '📘'], loc: 'Dubai WTC - GITEX', live: true, status: 'New', spend: 'AED 75.00', orders: 1, last: '17:53', reg: '22 Oct 2026, 17:50' },
  { name: 'Michael Johnson', email: 'michael.j@gmail.com', phone: '+971 50 678 9102', social: ['📸', '📘', '𝕏', '👻'], loc: 'Dubai Bluewater - Afroloud', live: true, status: 'Existing', spend: 'AED 420.00', orders: 7, last: '17:20', reg: '20 Oct 2026, 09:12' },
  { name: 'Fatima Al Mansoori', email: 'fatima.a@gmail.com', phone: '+971 54 789 0123', social: [], loc: 'Dubai WTC-GITEX', live: true, status: 'Existing', spend: 'AED 160.00', orders: 2, last: '16:45', reg: '19 Oct 2026, 13:33' },
  { name: 'David Lee', email: 'david.lee@gmail.com', phone: '+971 55 890 1234', social: [], loc: 'Dubai Bluewater - Afroloud', live: true, status: 'New', spend: 'AED 95.00', orders: 1, last: '16:30', reg: '22 Oct 2026, 16:10' },
  { name: 'Nkem Udo', email: 'nkem.u@gmail.com', phone: '+97150 8012345', social: [], loc: 'Dubai WTC - GITEX', live: true, status: 'Existing', spend: 'AED 275.00', orders: 4, last: '18:15', reg: '18 Oct 2026, 20:05' },
  { name: 'Samuel Brown', email: 'samuel.b@gmail.com', phone: '+971 52 012 3456', social: [], loc: 'Dubai Bluewater - Afroloud', live: true, status: 'Existing', spend: 'AED 130.00', orders: 2, last: '15:50', reg: '21 Oct 2026, 18:22' },
]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }

export default function Users() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Users</h2>
          <div style={muted}>Manage and view all customers across all locations and events.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ ...sel, marginRight: 8 }}>⭳ Export</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>+ Add Customer</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {STATS.map(s => (
          <div key={s.label} className="card" style={{ padding: 14, display: 'flex', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'var(--amber-chip)',
              display: 'grid', placeItems: 'center', fontSize: 17, flexShrink: 0,
            }}>{s.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={muted}>{s.label}</div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{s.value}</div>
              <div style={{ fontSize: 10.5, color: s.tone }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input placeholder="Search by name, email, phone or order ID…" style={{
            flex: 1, minWidth: 200, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', outline: 'none',
          }} />
          <select style={sel}><option>All Locations</option></select>
          <select style={sel}><option>All Status</option></select>
          <select style={sel}><option>New + Existing</option></select>
          <button style={sel}>⚑ Filters</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
              <th style={{ padding: '6px 4px' }}>Customer</th><th>Contact & Social</th><th>Location / Event</th>
              <th>Status</th><th>Total Spend</th><th>Orders</th><th>Last Order</th><th>Registered</th><th>Type</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {CUSTOMERS.map(c => (
              <tr key={c.email} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '9px 4px' }}>
                  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16, background: 'var(--amber-chip)', flexShrink: 0,
                      display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11, color: 'var(--mc-orange-deep)',
                    }}>{c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div style={muted}>{c.email}</div>
                      <div style={muted}>{c.phone}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 13, letterSpacing: 2 }}>{c.social.join('') || '—'}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.loc}</div>
                  {c.live && <div style={{ fontSize: 10.5, color: 'var(--green)', fontWeight: 700 }}>● Live Now</div>}
                </td>
                <td><span className={'pill ' + (c.status === 'New' ? 'green' : 'orange')}>{c.status}</span></td>
                <td><b>{c.spend}</b></td>
                <td style={{ textAlign: 'center' }}>{c.orders}</td>
                <td style={muted}>{c.last}</td>
                <td style={muted}>{c.reg}</td>
                <td style={muted}>{c.status}</td>
                <td>
                  <button style={{
                    border: '1px solid var(--mc-orange)', color: 'var(--mc-orange-deep)',
                    borderRadius: 7, padding: '4px 12px', fontSize: 11.5, fontWeight: 700,
                  }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center', ...muted }}>
          <span>Showing 1 to 10 of 4,892 customers</span>
          <span>‹ <b style={{ color: 'var(--mc-orange-deep)' }}>1</b> 2 3 4 5 … 490 ›&ensp;·&ensp;10/page</span>
        </div>
      </div>
    </div>
  )
}
