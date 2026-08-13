import { useNavigate } from 'react-router-dom'

/* Screen: Edit Banner (Figma node 106-1132)
   Left: banner content, links, display settings, schedule, advanced.
   Right: live phone preview, performance, status. */

const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const muted = { color: 'var(--ink-3)', fontSize: 11 }
const field = { border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, width: '100%', outline: 'none' }
const label = { fontSize: 11, color: 'var(--ink-2)', display: 'block', margin: '10px 0 4px' }

const PLATFORMS = ['Mobile App', 'eMenu (QR)', 'Website', 'Kiosk', 'Display Board', 'Menu Board']

/* Small visual toggle per the refined design (Figma 132-11). */
function Toggle({ on, label }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
      <span style={{
        width: 34, height: 19, borderRadius: 10, position: 'relative', flexShrink: 0,
        background: on ? 'var(--mc-orange)' : 'var(--line)', transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15,
          borderRadius: 8, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'left .15s',
        }} />
      </span>
      {label}
    </label>
  )
}

export default function BannerEdit() {
  const nav = useNavigate()
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Edit Banner</h2>
        <span className="pill green">Active</span>
        <div style={{ flex: 1 }} />
        <button style={btn} onClick={() => nav('/promotions/banners')}>← Back to Banners</button>
        <button style={btn}>👁 Preview</button>
        <button style={btn}>⧉ Duplicate</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>Save Changes</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {/* 1. Banner content */}
          <div className="card" style={card}>
            <h3 style={h3}>1. Banner Content</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
              <div>
                <div style={{
                  height: 120, borderRadius: 10, background: 'var(--mc-cheese)',
                  display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 15,
                  color: 'var(--ink)', textAlign: 'center', padding: 10,
                }}>CHEESY JOLLOF<br />MEAL DEAL</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={btn}>⬆ Change Image</button>
                  <button style={{ ...btn, color: 'var(--red)' }}>Remove</button>
                </div>
                <div style={{ ...muted, marginTop: 6 }}>Recommended size: 1600 × 640px · JPG, PNG or WebP</div>
              </div>
              <div>
                <label style={label}>Title *</label>
                <input style={field} defaultValue="Cheesy Jollof Meal Deal" />
                <label style={label}>Subtitle</label>
                <input style={field} defaultValue="Meal + Drink" />
                <label style={label}>Alt Text</label>
                <input style={field} defaultValue="Cheesy Jollof Meal Deal – Limited Time Offer" />
              </div>
            </div>
          </div>

          {/* 2. Links & actions */}
          <div className="card" style={card}>
            <h3 style={h3}>2. Links & Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={label}>Link Type</label>
                <select style={field}><option>Custom URL</option><option>Menu Item</option><option>Category</option></select>
              </div>
              <div>
                <label style={label}>Destination URL</label>
                <input style={field} defaultValue="https://meltingcheese.com/menu/jollof-deal" />
              </div>
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 9 }}>
                <input type="checkbox" defaultChecked /> Open in New Tab
              </label>
            </div>
            <label style={label}>Button Text</label>
            <input style={{ ...field, maxWidth: 220 }} defaultValue="Order Now" />
          </div>

          {/* 3. Display settings */}
          <div className="card" style={card}>
            <h3 style={h3}>3. Display Settings</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {PLATFORMS.map((p, i) => (
                <span key={p} style={{
                  position: 'relative', display: 'flex', gap: 7, alignItems: 'center', fontSize: 12,
                  border: '1px solid ' + (i !== 3 ? 'var(--mc-orange)' : 'var(--line)'),
                  background: i !== 3 ? 'var(--amber-chip)' : '#fff',
                  borderRadius: 9, padding: '9px 13px', fontWeight: 600, cursor: 'pointer',
                }}>
                  {p}
                  {i !== 3 && <span style={{
                    position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: 8,
                    background: 'var(--mc-orange)', color: '#fff', fontSize: 10, fontWeight: 800,
                    display: 'grid', placeItems: 'center',
                  }}>✓</span>}
                </span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div><label style={label}>Locations</label><select style={field}><option>All Locations (6)</option></select></div>
              <div><label style={label}>Devices</label><select style={field}><option>All Devices</option></select></div>
              <div><label style={label}>Banner Position</label><select style={field}><option>Home Slider</option></select></div>
              <div><label style={label}>Display Priority</label><select style={field}><option>1 (highest)</option></select></div>
            </div>
          </div>

          {/* 4. Schedule */}
          <div className="card" style={card}>
            <h3 style={h3}>4. Schedule</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 10 }}>
              <div><label style={label}>Start Date & Time</label><input style={field} defaultValue="20 Oct 2026, 00:00" /></div>
              <div><label style={label}>End Date & Time</label><input style={field} defaultValue="30 Dec 2026, 23:59" /></div>
              <div><label style={label}>Timezone</label><select style={field}><option>(GMT+04:00) Dubai, UAE</option></select></div>
            </div>
          </div>

          {/* 5. Advanced */}
          <div className="card" style={card}>
            <h3 style={h3}>5. Advanced Options</h3>
            <div style={{ display: 'flex', gap: 22, fontSize: 12, flexWrap: 'wrap' }}>
              <Toggle on={false} label="Show to first-time visitors only" />
              <Toggle on={true} label="Show to existing users" />
              <Toggle on={false} label="Show shop-per-location" />
              <Toggle on={true} label="Enable analytics tracking" />
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={{ ...h3, marginBottom: 8 }}>Live Preview</h3>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="pill orange" style={{ background: 'var(--mc-orange)', color: '#fff' }}>Mobile App</span>
              <span className="pill gray">eMenu (QR)</span>
              <span className="pill gray">Website</span>
              <span className="pill gray">Display Board</span>
            </div>
            <div style={{
              width: 168, margin: '0 auto', border: '7px solid #1C1C1E', borderRadius: 24,
              background: '#fff', overflow: 'hidden',
            }}>
              <div style={{ background: 'var(--mc-cheese)', padding: '26px 10px', textAlign: 'center', fontWeight: 900, fontSize: 13 }}>
                CHEESY<br />JOLLOF<br />MEAL DEAL
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 6 }}>Popular Deals</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, height: 44, borderRadius: 7, background: 'var(--amber-chip)' }} />
                  <div style={{ flex: 1, height: 44, borderRadius: 7, background: 'var(--amber-chip)' }} />
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, ...muted }}>● ○ ○ ○</div>
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Banner Performance <span style={muted}>(Last 7 Days)</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Impressions', '12,458'], ['Clicks', '1,245'], ['CTR', '10.01%'], ['Conversions', '342']].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--surface-alt)', borderRadius: 9, padding: '9px 10px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5 }}>{v}</div>
                  <div style={muted}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Banner Status</h3>
            {[['Status', 'Active'], ['Created By', 'Super Admin'], ['Created At', '19 Oct 2026, 04:33'], ['Last Updated', '21 Oct 2026, 11:06']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-2)' }}>{k}</span><b>{v}</b>
              </div>
            ))}
            <button style={{ ...btn, width: '100%', color: 'var(--red)', marginTop: 12 }}>🗑 Delete Banner</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const btn = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 12, background: '#fff' }
