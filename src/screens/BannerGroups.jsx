import { useNavigate } from 'react-router-dom'

/* Screen: Promotions › Banner Groups (Figma node 106-1514)
   Stats strip, groups table, right rail with group details and top banner. */

const GROUPS = [
  { id: 'FG-001', name: 'Festival Carnival 2026', banners: 6, status: 'Active', where: 'All Locations', devices: 'All Devices', start: '20 Oct 2026', end: '05 Nov 2026' },
  { id: 'FG-002', name: 'Street Heat Series', banners: 4, status: 'Active', where: 'All Locations', devices: 'All Devices', start: '01 Oct 2026', end: '31 Oct 2026' },
  { id: 'FG-003', name: 'Burger Bonanza', banners: 5, status: 'Active', where: 'Main Outlet, Food Trucks', devices: 'All Devices', start: '19 Oct 2026', end: '15 Nov 2026' },
  { id: 'FG-004', name: 'New Arrivals', banners: 3, status: 'Active', where: 'All Locations', devices: 'All Devices', start: '18 Oct 2026', end: '18 Nov 2026' },
  { id: 'FG-005', name: 'Weekend Special', banners: 3, status: 'Active', where: 'All Locations', devices: 'Mobile, Kiosk', start: 'Every Fri', end: 'Every Sun' },
  { id: 'FG-006', name: 'Add-on Promos', banners: 4, status: 'Active', where: 'All Locations', devices: 'All Devices', start: '01 Oct 2026', end: '31 Oct 2026' },
  { id: 'FG-007', name: 'Combo Offers', banners: 3, status: 'Inactive', where: 'All Locations', devices: 'All Devices', start: '01 Sep 2026', end: '30 Sep 2026' },
  { id: 'FG-008', name: 'Member Exclusive', banners: 3, status: 'Inactive', where: 'Main Outlet', devices: 'Mobile', start: '01 Sep 2026', end: '30 Sep 2026' },
]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }

export default function BannerGroups() {
  const nav = useNavigate()
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Banner Groups</h2>
          <div style={muted}>Organize banners into groups for better management and display.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ ...sel, marginRight: 8 }}>Export Report</button>
        <button style={{ ...sel, marginRight: 8 }}>Import Groups</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>+ Add New Group</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          ['Total Groups', '18', 'All banner groups'],
          ['Active Groups', '15', '83.3% of total'],
          ['Inactive Groups', '3', '16.7% of total'],
          ['Total Banners', '56', 'Across all groups'],
          ['Total Impressions', '245,680', 'Last 30 days'],
        ].map(([l, v, s]) => (
          <div key={l} className="card" style={{ padding: 14 }}>
            <div style={muted}>{l}</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{v}</div>
            <div style={muted}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input placeholder="Search groups…" style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', outline: 'none' }} />
            <select style={sel}><option>All Status</option></select>
            <select style={sel}><option>All Locations</option></select>
            <select style={sel}><option>All Devices</option></select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Group Name</th><th>Banners</th><th>Status</th>
                <th>Locations</th><th>Devices</th><th>Start Date</th><th>End Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(g => (
                <tr key={g.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '9px 4px', cursor: 'pointer' }} onClick={() => nav('/promotions/banner-groups/detail')}>
                    <div style={{ fontWeight: 700, color: 'var(--mc-orange-deep)' }}>{g.name}</div>
                    <div style={muted}>{g.id}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{g.banners}</td>
                  <td><span className={'pill ' + (g.status === 'Active' ? 'green' : 'gray')}>{g.status}</span></td>
                  <td>{g.where}</td>
                  <td>{g.devices}</td>
                  <td style={muted}>{g.start}</td>
                  <td style={muted}>{g.end}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button title="Edit" onClick={() => nav('/promotions/banners/edit')}>✏️</button>
                    <button title="Duplicate">⧉</button>
                    <button title="Delete" style={{ color: 'var(--red)' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, ...muted }}>
            <span>Showing 1 to 8 of 18 groups</span>
            <span>‹ 1 2 3 ›&ensp;·&ensp;10 per page</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <div style={{ display: 'flex' }}>
              <h3 style={h3}>Group Details</h3>
              <div style={{ flex: 1 }} />
              <span style={{ ...muted, cursor: 'pointer', color: 'var(--mc-orange-deep)' }}
                onClick={() => nav('/promotions/banner-groups/detail')}>View Full Details</span>
            </div>
            <div style={{
              borderRadius: 10, background: 'var(--mc-cheese)', padding: '18px 12px',
              textAlign: 'center', fontWeight: 900, fontSize: 15, marginBottom: 10,
            }}>FESTIVAL<br />CARNIVAL</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: 13 }}>Festival Carnival 2026</b>
              <div style={{ flex: 1 }} />
              <span className="pill green">Active</span>
            </div>
            {[
              ['Description', 'Festival campaign 2026'], ['Banners', '6 banners'], ['Locations', 'All Locations'],
              ['Devices', 'All Devices'], ['Start Date', '20 Oct 2026'], ['End Date', '05 Nov 2026'],
              ['Created By', 'Super Admin'], ['Updated On', '20 Oct 2026, 04:15 PM'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-2)' }}>{k}</span><b style={{ textAlign: 'right' }}>{v}</b>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <div style={{ display: 'flex' }}>
              <h3 style={h3}>Top Performing Banner <span style={muted}>(This Month)</span></h3>
              <div style={{ flex: 1 }} />
              <span style={{ ...muted, cursor: 'pointer' }}>View Report</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['Impressions', '58,920'], ['Clicks', '2,450'], ['CTR', '4.15%']].map(([l, v]) => (
                <div key={l} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{v}</div>
                  <div style={muted}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
