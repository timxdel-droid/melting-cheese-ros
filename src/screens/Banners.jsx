import { useNavigate } from 'react-router-dom'

/* Screen: Promotions › Banners (Figma node 106-592)
   Banner table with platform/status, right rail with overview,
   platform distribution and top performers. */

const BANNERS = [
  { name: 'Cheesy Jollof Meal Deal', type: 'Image', platform: 'Mobile App', where: 'Dubai WTC-GITEX', status: 'Active', start: '15 Oct 2026', end: '30 Dec 2026', imp: '12,458', clicks: '1,245', ctr: '10.01%', tint: '#F5A623' },
  { name: 'Afroloud Special Menu', type: 'Image', platform: 'Mobile App', where: 'Dubai Bluewater - Afroloud', status: 'Active', start: '15 Nov 2026', end: '15 Nov 2026', imp: '9,476', clicks: '867', ctr: '10.05%', tint: '#16A34A' },
  { name: 'Free WiFi Connect Now', type: 'Image', platform: 'Kiosk', where: 'All Locations', status: 'Active', start: '01 Oct 2026', end: '31 Dec 2026', imp: '15,071', clicks: '2,241', ctr: '14.85%', tint: '#2563EB' },
  { name: 'Scan to Order', type: 'Image', platform: 'Table Tents', where: 'All Locations', status: 'Active', start: '01 Oct 2026', end: '31 Dec 2026', imp: '22,346', clicks: '3,210', ctr: '14.37%', tint: '#1C1C1E' },
  { name: 'Family Feast Combo', type: 'Image', platform: 'Website', where: 'All Locations', status: 'Scheduled', start: '23 Nov 2026', end: '14 Dec 2026', imp: '0', clicks: '0', ctr: '0%', tint: '#E5484D' },
  { name: 'Divas Conference Specials', type: 'Image', platform: 'Mobile App', where: 'Dubai Waterpark - Divas Conference', status: 'Scheduled', start: '28 Nov 2026', end: '30 Nov 2026', imp: '0', clicks: '0', ctr: '0%', tint: '#8B5CF6' },
  { name: 'Butterfly Carnival Treats', type: 'Image', platform: 'Ad Board', where: 'Dubai Amphitheatre - Butterfly Carnival', status: 'Scheduled', start: '07 Dec 2026', end: '08 Dec 2026', imp: '0', clicks: '0', ctr: '0%', tint: '#F472B6' },
  { name: 'Christmas Park Deals', type: 'Image', platform: 'Menu Board', where: 'Dubai Christmas Park', status: 'Scheduled', start: '18 Dec 2026', end: '28 Dec 2026', imp: '0', clicks: '0', ctr: '0%', tint: '#0EA5A5' },
]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }

export default function Banners() {
  const nav = useNavigate()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Banners</h2>
            <div style={muted}>Create, manage and display banners across websites, apps, kiosks, ad boards and menu boards.</div>
          </div>
          <div style={{ flex: 1 }} />
          <button style={{ ...selBtn, marginRight: 8 }}>⭳ Export</button>
          <button className="btn-primary" style={{ fontSize: 12.5 }} onClick={() => nav('/promotions/banners/edit')}>
            + Add New Banner
          </button>
        </div>

        <div className="card" style={card}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input placeholder="Search banners by title, location or type…" style={{
              flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', outline: 'none',
            }} />
            <select style={selBtn}><option>All Status</option></select>
            <select style={selBtn}><option>All Locations</option></select>
            <select style={selBtn}><option>All Platforms</option></select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Banner</th><th>Platform / Placement</th><th>Location / Event</th>
                <th>Status</th><th>Dates</th><th>Impr.</th><th>Clicks</th><th>CTR</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {BANNERS.map(b => (
                <tr key={b.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '9px 4px' }}>
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                      <div style={{
                        width: 52, height: 30, borderRadius: 6, background: b.tint, flexShrink: 0,
                        display: 'grid', placeItems: 'center', color: '#fff', fontSize: 8, fontWeight: 800,
                      }}>IMG</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{b.name}</div>
                        <div style={muted}>{b.type}</div>
                      </div>
                    </div>
                  </td>
                  <td>{b.platform}</td>
                  <td style={{ maxWidth: 130 }}>{b.where}</td>
                  <td><span className={'pill ' + (b.status === 'Active' ? 'green' : 'orange')}>{b.status}</span></td>
                  <td style={muted}>{b.start}<br />{b.end}</td>
                  <td>{b.imp}</td><td>{b.clicks}</td><td><b>{b.ctr}</b></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button title="Edit" onClick={() => nav('/promotions/banners/edit')}>✏️</button>
                    <button title="Duplicate">⟉</button>
                    <button title="Delete" style={{ color: 'var(--red)' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, ...muted }}>
            <span>Showing 1 to 8 of 8 banners</span>
            <span>‹ 1 ›&ensp;·&ensp;10 / page</span>
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="card" style={card}>
          <h3 style={h3}>Banner Overview <span style={muted}>(Today)</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Impressions', '58,350'], ['Clicks', '7,783'], ['Avg. CTR', '13.34%'], ['Active', '4'], ['Scheduled', '4'], ['Expired', '0']].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--surface-alt)', borderRadius: 9, padding: '9px 10px' }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{v}</div>
                <div style={muted}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={card}>
          <h3 style={h3}>Platform Distribution</h3>
          {[
            ['Mobile App', '43.7%', 'var(--mc-orange)'], ['QR', '21.3%', 'var(--blue)'],
            ['Website', '17.4%', 'var(--green)'], ['Ad Board', '10.9%', 'var(--purple)'], ['Kiosk', '6.7%', 'var(--teal)'],
          ].map(([p, pct, tone]) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
              <span style={{ width: 9, height: 9, borderRadius: 5, background: tone }} />
              <span style={{ flex: 1 }}>{p}</span><b>{pct}</b>
            </div>
          ))}
        </div>

        <div className="card" style={card}>
          <h3 style={h3}>Top Performing Banners <span style={muted}>(By CTR)</span></h3>
          {[['Scan to Order', '14.37%'], ['Free WiFi Connect Now', '14.85%'], ['Cheesy Jollof Meal Deal', '10.01%']].map(([b, ctr]) => (
            <div key={b} style={{ display: 'flex', padding: '7px 0', fontSize: 12, borderTop: '1px solid var(--line)' }}>
              <span style={{ flex: 1 }}>{b}</span><b style={{ color: 'var(--green)' }}>{ctr}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const selBtn = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
