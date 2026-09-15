import { useState } from 'react'

/* Screen: Operations › Staff & Roles
   Two tabs — Staff Members (filterable, paginated table) and
   Roles & Permissions (role cards + permission matrix). */

const ROLES = [
  { key: 'Super Admin', icon: '👑', tone: 'purple', color: 'var(--purple)', soft: 'var(--purple-soft)',
    desc: 'Full access to all modules and system settings.', count: 2 },
  { key: 'Operations Manager', icon: '⭐', tone: 'blue', color: 'var(--blue)', soft: 'var(--blue-soft)',
    desc: 'Manage operations, orders, inventory, staff and locations.', count: 3 },
  { key: 'Store Manager', icon: '🏪', tone: 'green', color: 'var(--green)', soft: 'var(--green-soft)',
    desc: 'Manage assigned store, staff, orders and inventory.', count: 5 },
  { key: 'Cashier', icon: '🧾', tone: 'orange', color: 'var(--mc-orange-deep)', soft: 'var(--amber-chip)',
    desc: 'Process orders, payments and view basic customer data.', count: 8 },
  { key: 'Kitchen Staff', icon: '👨‍🍳', tone: 'red', color: 'var(--red)', soft: 'var(--red-soft)',
    desc: 'View and update kitchen orders and preparation status.', count: 12 },
  { key: 'Viewer', icon: '👁', tone: 'gray', color: 'var(--ink-2)', soft: '#F0F0F3',
    desc: 'Read-only access to permitted modules.', count: 4 },
]

const STAFF = [
  { n: 1, name: 'Michael Okafor', email: 'michael.okafor@meltingcheese.com', role: 'Super Admin', loc: 'Head Office', active: true, last: 'Today, 13:35' },
  { n: 2, name: 'Sarah Johnson', email: 'sarah.johnson@meltingcheese.com', role: 'Operations Manager', loc: 'Multiple', active: true, last: 'Today, 11:20' },
  { n: 3, name: 'David Williams', email: 'david.williams@meltingcheese.com', role: 'Store Manager', loc: 'Dubai Marina', active: true, last: 'Yesterday, 18:45' },
  { n: 4, name: 'Aisha Khan', email: 'aisha.khan@meltingcheese.com', role: 'Cashier', loc: 'JLT', active: true, last: 'Today, 10:15' },
  { n: 5, name: 'James Brown', email: 'james.brown@meltingcheese.com', role: 'Kitchen Staff', loc: 'Dubai Marina', active: true, last: 'Today, 12:05' },
  { n: 6, name: 'Fatima Ali', email: 'fatima.ali@meltingcheese.com', role: 'Inventory Staff', loc: 'Al Barsha', active: false, last: '2 Days ago' },
  { n: 7, name: 'Omar Haddad', email: 'omar.haddad@meltingcheese.com', role: 'Cashier', loc: 'Head Office', active: true, last: 'Today, 09:48' },
  { n: 8, name: 'Chloe Martin', email: 'chloe.martin@meltingcheese.com', role: 'Viewer', loc: 'JLT', active: true, last: 'Today, 08:30' },
  { n: 9, name: 'Yusuf Bello', email: 'yusuf.bello@meltingcheese.com', role: 'Kitchen Staff', loc: 'Al Barsha', active: true, last: 'Yesterday, 21:10' },
  { n: 10, name: 'Lina Farah', email: 'lina.farah@meltingcheese.com', role: 'Store Manager', loc: 'JLT', active: false, last: '5 Days ago' },
]

const LOCATIONS = ['All Locations', 'Head Office', 'Dubai Marina', 'JLT', 'Al Barsha', 'Multiple']

const MODULES = ['Dashboard', 'Live Orders', 'Menu', 'Inventory', 'Staff', 'Customers', 'Analytics', 'Finance', 'Settings']
/* v = view, e = edit, f = full, — = none */
const MATRIX = {
  'Super Admin': ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f'],
  'Operations Manager': ['f', 'f', 'f', 'f', 'e', 'f', 'f', 'v', 'v'],
  'Store Manager': ['v', 'f', 'e', 'f', 'e', 'v', 'v', '—', '—'],
  'Cashier': ['v', 'e', 'v', 'v', '—', 'v', '—', '—', '—'],
  'Kitchen Staff': ['—', 'e', 'v', 'v', '—', '—', '—', '—', '—'],
  'Viewer': ['v', 'v', 'v', 'v', '—', 'v', 'v', '—', '—'],
}
const CELL = {
  f: { label: 'Full', cls: 'green' },
  e: { label: 'Edit', cls: 'blue' },
  v: { label: 'View', cls: 'gray' },
  '—': { label: '—', cls: null },
}

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const iconBtn = {
  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--line)',
  background: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, cursor: 'pointer',
}

function roleOf(name) { return ROLES.find(r => r.key === name) }

function RolePill({ role }) {
  const r = roleOf(role)
  return (
    <span className="pill" style={{
      background: r ? r.soft : '#F0F0F3',
      color: r ? r.color : 'var(--ink-2)',
    }}>{role}</span>
  )
}

export default function Staff() {
  const [tab, setTab] = useState('members')
  const [loc, setLoc] = useState('All Locations')
  const [status, setStatus] = useState('All Status')
  const [matrix, setMatrix] = useState(false)

  const rows = STAFF.filter(s =>
    (loc === 'All Locations' || s.loc === loc) &&
    (status === 'All Status' || (status === 'Active') === s.active))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Staff &amp; Roles</h2>
        <div style={muted}>Manage staff accounts, roles and system permissions.</div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)' }}>
        {[['members', '👥 Staff Members'], ['roles', '🛡 Roles & Permissions']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 700, background: 'none', cursor: 'pointer',
            color: tab === k ? 'var(--mc-orange-deep)' : 'var(--ink-3)',
            borderBottom: '2px solid ' + (tab === k ? 'var(--mc-orange)' : 'transparent'), marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'members' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
            <div>
              <b style={{ fontSize: 13.5 }}>Staff Members</b>
              <div style={muted}>Manage all staff accounts and their access.</div>
            </div>
            <div style={{ flex: 1 }} />
            <select style={sel} value={loc} onChange={e => setLoc(e.target.value)}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
            <select style={sel} value={status} onChange={e => setStatus(e.target.value)}>
              {['All Status', 'Active', 'Inactive'].map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn-primary" style={{ fontSize: 12.5 }}>+ Add Staff</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px', width: 30 }}>#</th><th>Name</th><th>Email</th>
                <th>Role</th><th>Location</th><th>Status</th><th>Last Active</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.email} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 4px', ...muted }}>{s.n}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 15, background: 'var(--amber-chip)', flexShrink: 0,
                        display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 10.5, color: 'var(--mc-orange-deep)',
                      }}>{s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                      <b>{s.name}</b>
                    </div>
                  </td>
                  <td style={muted}>{s.email}</td>
                  <td><RolePill role={s.role} /></td>
                  <td>{s.loc}</td>
                  <td>
                    <span style={{ color: s.active ? 'var(--green)' : 'var(--mc-orange-deep)', fontWeight: 600 }}>
                      ● {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={muted}>{s.last}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button style={iconBtn} title="View">👁</button>
                      <button style={iconBtn} title="Edit">✎</button>
                      <button style={iconBtn} title="More">⋮</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center', ...muted }}>
            <span>Showing 1 to {rows.length} of 24 staff members</span>
            <span>‹ <b style={{ color: 'var(--mc-orange-deep)' }}>1</b> 2 3 4 ›&ensp;·&ensp;10/page</span>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
            <div>
              <b style={{ fontSize: 13.5 }}>Roles &amp; Permissions</b>
              <div style={muted}>Manage roles and their system permissions.</div>
            </div>
            <div style={{ flex: 1 }} />
            <button style={sel} onClick={() => setMatrix(m => !m)}>
              ▦ {matrix ? 'Hide' : 'View'} Permission Matrix
            </button>
            <button className="btn-primary" style={{ fontSize: 12.5 }}>+ Add Role</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
            {ROLES.map(r => (
              <div key={r.key} style={{
                border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 20, background: r.soft,
                  display: 'grid', placeItems: 'center', fontSize: 18,
                }}>{r.icon}</div>
                <b style={{ fontSize: 13.5 }}>{r.key}</b>
                <div style={{ ...muted, lineHeight: 1.45, flex: 1 }}>{r.desc}</div>
                <div style={{ ...muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                  👥 {r.count} staff members
                </div>
                <button style={{
                  border: '1px solid ' + r.color, color: r.color, background: r.soft,
                  borderRadius: 8, padding: '7px 10px', fontSize: 11.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                }}>Edit Permissions <span>→</span></button>
              </div>
            ))}
          </div>

          {matrix && (
            <div style={{ marginTop: 18, overflowX: 'auto' }}>
              <b style={{ fontSize: 13 }}>Permission Matrix</b>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 8 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                    <th style={{ padding: '6px 4px' }}>Role</th>
                    {MODULES.map(m => <th key={m} style={{ padding: '6px 4px' }}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map(r => (
                    <tr key={r.key} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 4px' }}><RolePill role={r.key} /></td>
                      {MATRIX[r.key].map((c, i) => (
                        <td key={i} style={{ padding: '8px 4px' }}>
                          {CELL[c].cls
                            ? <span className={'pill ' + CELL[c].cls}>{CELL[c].label}</span>
                            : <span style={muted}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ ...muted, marginTop: 8 }}>
                Full = view, create, edit and delete · Edit = view and update · View = read-only
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
