import { useNavigate } from 'react-router-dom'

/* Screen: Banner Group Detail (Figma node 148-18)
   Group header + meta, KPI chips, tabs, banners-in-group table,
   rail with live preview, schedule and top performer. */

const BANNERS = [
  { n: 1, name: 'Carnival Main Banner', link: '/promotions/carnival' },
  { n: 2, name: 'Jollof Rice Combo', link: '/combo/jollof-rice' },
  { n: 3, name: 'Burger & Fries Combo', link: '/combo/burger-fries' },
  { n: 4, name: 'Turkey Wings Combo', link: '/combo/turkey-wings' },
  { n: 5, name: 'Shawarma Combo', link: '/combo/shawarma' },
  { n: 6, name: 'Fusion Cup Special', link: '/combo/fusion-cup' },
]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const btn = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 12, background: '#fff' }

export default function BannerGroupDetail() {
  const nav = useNavigate()
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...muted, cursor: 'pointer' }} onClick={() => nav('/promotions/banner-groups')}>
        Menu Management › Banner Groups › <b style={{ color: 'var(--ink)' }}>Festival Carnival 2026</b>
      </div>

      {/* Group header */}
      <div className="card" style={{ ...card, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          width: 120, height: 74, borderRadius: 10, background: 'var(--mc-cheese)', flexShrink: 0,
          display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 13, textAlign: 'center',
        }}>FESTIVAL<br />CARNIVAL</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Festival Carnival 2026</h2>
            <span className="pill green">Active</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0' }}>
            Festival & Carnival Campaign 2026 — Celebrate with bold flavors and exciting combos.
          </div>
          <div style={muted}>
            Group Code: FG-001 · Created On 18 Oct 2026, 09:15 AM by <b>Super Admin</b> · Updated On 20 Oct 2026, 04:15 PM by <b>Super Admin</b>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn}>View on Website</button>
          <button style={btn}>Export Report</button>
          <button style={btn}>Duplicate Group</button>
          <button className="btn-primary" style={{ fontSize: 12.5 }}>Edit Group</button>
        </div>
      </div>

      {/* KPI chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          ['Total Banners', '6', 'Across this group'],
          ['Total Impressions', '128,540', 'Last 30 days'],
          ['Total Clicks', '3,245', 'Last 30 days'],
          ['CTR', '2.52%', 'Last 30 days'],
        ].map(([l, v, s]) => (
          <div key={l} className="card" style={{ padding: 14 }}>
            <div style={muted}>{l}</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{v}</div>
            <div style={muted}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--line)', marginBottom: 12, fontSize: 12.5 }}>
            {['Banners', 'Performance', 'Devices & Locations', 'Schedule History'].map((t, i) => (
              <span key={t} style={{
                padding: '4px 2px 9px', fontWeight: i === 0 ? 700 : 500, cursor: 'pointer',
                color: i === 0 ? 'var(--mc-orange-deep)' : 'var(--ink-2)',
                borderBottom: i === 0 ? '2px solid var(--mc-orange)' : '2px solid transparent',
              }}>{t}</span>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <b style={{ fontSize: 13.5 }}>Banners in this Group (6)</b>
              <div style={muted}>Manage banners, order and visibility.</div>
            </div>
            <div style={{ flex: 1 }} />
            <button style={{ ...btn, marginRight: 8 }}>Reorder</button>
            <button className="btn-primary" style={{ fontSize: 12 }}>Add New Banner</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>#</th><th>Banner Preview</th><th>Banner Name</th>
                <th>Link Type</th><th>Link/Target</th><th>Locations</th><th>Devices</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {BANNERS.map(b => (
                <tr key={b.n} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '9px 4px' }}>{b.n}</td>
                  <td>
                    <div style={{
                      width: 56, height: 30, borderRadius: 6, background: 'var(--mc-cheese)',
                      display: 'grid', placeItems: 'center', fontSize: 7, fontWeight: 800, textAlign: 'center',
                    }}>{b.name.split(' ')[0].toUpperCase()}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{b.name}</td>
                  <td><span className="pill blue">Image</span></td>
                  <td style={{ ...muted, fontFamily: 'monospace' }}>{b.link}</td>
                  <td>All Locations</td>
                  <td style={muted}>All Devices</td>
                  <td><span className="pill green">Active</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button title="Edit" onClick={() => nav('/promotions/banners/edit')}>✏️</button>
                    <button title="Preview">👁</button>
                    <button title="Delete" style={{ color: 'var(--red)' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, ...muted }}>
            <span>Showing 1 to 6 of 6 banners</span>
            <span>‹ 1 ›&ensp;·&ensp;10 per page</span>
          </div>
        </div>

        {/* Rail */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>Preview</h3>
            <div style={{
              borderRadius: 10, background: 'var(--mc-cheese)', padding: '24px 12px',
              textAlign: 'center', fontWeight: 900, fontSize: 16,
            }}>FESTIVAL<br />CARNIVAL<div style={{ fontSize: 8, fontWeight: 700, marginTop: 4, letterSpacing: 1 }}>STREET FOOD · REAL FLAVOR. REAL BUSINESS.</div></div>
            <div style={{ ...muted, textAlign: 'center', margin: '8px 0' }}>This is how the banner will appear on your website.</div>
            <button style={{
              width: '100%', background: 'var(--amber-chip)', color: 'var(--mc-orange-deep)',
              fontWeight: 700, fontSize: 12, borderRadius: 8, padding: '9px 0',
            }}>View Full Screen</button>
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Schedule</h3>
            {[
              ['Start Date', '20 Oct 2026, 12:00 AM'], ['End Date', '05 Nov 2026, 11:59 PM'],
              ['Repeat', 'No'], ['Time Zone', 'Asia/Dubai (GMT +04:00)'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-2)' }}>{k}</span><b style={{ textAlign: 'right' }}>{v}</b>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <div style={{ display: 'flex' }}>
              <h3 style={h3}>Top Performing Banner</h3>
              <div style={{ flex: 1 }} />
              <span style={{ ...muted, cursor: 'pointer', color: 'var(--mc-orange-deep)' }}>View Report</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{
                width: 52, height: 30, borderRadius: 6, background: 'var(--mc-cheese)', flexShrink: 0,
                display: 'grid', placeItems: 'center', fontSize: 7, fontWeight: 800,
              }}>CARNIVAL</div>
              <div>
                <b style={{ fontSize: 12.5 }}>Carnival Main Banner</b>
                <div><span className="pill green" style={{ fontSize: 9 }}>Active</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['Impressions', '52,430'], ['Clicks', '1,682'], ['CTR', '3.21%']].map(([l, v]) => (
                <div key={l} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '8px 4px' }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5 }}>{v}</div>
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
