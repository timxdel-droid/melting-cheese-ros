/* Screen: Operations Dashboard (Figma node 101-4244)
   KPI strip, live orders, location status, wifi customers, CCTV,
   inventory, payments, engagement, social, partner sales.
   All data is mock for now — wiring comes in a later phase. */

const KPIS = [
  { icon: '🧾', tint: 'var(--amber-chip)', label: 'Orders Today', value: '571', delta: '+13.5% vs yesterday', up: true },
  { icon: '💰', tint: 'var(--green-soft)', label: 'Revenue Today', value: 'AED 85,240', delta: '+22.4% vs yesterday', up: true },
  { icon: '⏱', tint: 'var(--amber-chip)', label: 'Avg. Prep Time', value: '18 min', delta: '-4 min vs yesterday', up: true },
  { icon: '📍', tint: 'var(--purple-soft)', label: 'Active Locations', value: '2 Active · 4 Scheduled', small: true },
  { icon: '🖥', tint: 'var(--blue-soft)', label: 'Kitchen Screens', value: '12', sub: 'Online' },
  { icon: '🛎', tint: 'var(--red-soft)', label: 'Pending Orders', value: '24', sub: 'Needs attention', alert: true },
]

const ORDERS = [
  { id: 'MC-1025', src: 'Kiosk', srcTone: 'orange', loc: 'Dubai WTC - GITEX', when: '17-23 Oct', cust: 'Tunde A.', items: 3, time: '2 min ago', status: 'New' },
  { id: 'MC-1024', src: 'App', srcTone: 'blue', loc: 'Dubai Blue Water - Afroloud', when: '25 Nov 26', cust: 'Dola M.', items: 2, time: '3 min ago', status: 'New' },
  { id: 'MC-1023', src: 'QR', srcTone: 'green', loc: 'Dubai WTC - GITEX', when: '17-23 Oct', cust: 'Aisha B.', items: 4, time: '5 min ago', status: 'New' },
  { id: 'MC-1022', src: 'Web', srcTone: 'gray', loc: 'Dubai Blue Water - Afroloud', when: '25 Nov 26', cust: 'Emeka O.', items: 2, time: '6 min ago', status: 'New' },
  { id: 'MC-1021', src: 'Kiosk', srcTone: 'orange', loc: 'Dubai WTC - GITEX', when: '17-23 Oct', cust: 'Grace G.', items: 1, time: '7 min ago', status: 'New' },
]

const LOCATIONS = [
  { name: 'Dubai WTC - GITEX', when: '17 - 23 Oct 26', state: 'Active', orders: 8 },
  { name: 'Dubai Blue Water - Afroloud', when: '25 Nov 26', state: 'Fast Track', orders: 6 },
  { name: 'Dubai Burj Park - All Africa Festival', when: '23 - 24 Nov 26', state: 'Active', orders: 0 },
  { name: 'Dubai Waterpark - Diya Conference', when: '30 Nov 26', state: 'Scheduled', orders: 4 },
  { name: 'Dubai Amphitheatre - Butterfly Carnival', when: '7 Dec 26', state: 'Scheduled', orders: 0 },
  { name: 'Dubai Christmas Park', when: '20 Dec 26', state: 'Scheduled', orders: 10 },
]

const INVENTORY = [
  { item: 'Jollof Rice (kg)', open: 480, used: 380, closing: 100, level: 21, tone: 'var(--red)' },
  { item: 'Cheesy Burger', open: 320, used: 230, closing: 90, level: 28, tone: 'var(--mc-orange)' },
  { item: 'Suya Beef (kg)', open: 150, used: 100, closing: 50, level: 33, tone: 'var(--mc-orange)' },
  { item: 'Chicken Wings (kg)', open: 190, used: 160, closing: 30, level: 16, tone: 'var(--red)' },
  { item: 'Cheese Sauce (L)', open: 88, used: 48, closing: 40, level: 45, tone: 'var(--green)' },
  { item: 'Soft Drinks (Cans)', open: 700, used: 430, closing: 270, level: 39, tone: 'var(--green)' },
]

const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const muted = { color: 'var(--ink-3)', fontSize: 11 }

export default function Dashboard() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {KPIS.map(k => (
          <div key={k.label} className="card" style={{ ...card, display: 'flex', gap: 11 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: k.tint,
              display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0,
            }}>{k.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={muted}>{k.label}</div>
              <div style={{ fontWeight: 800, fontSize: k.small ? 12.5 : 18 }}>{k.value}</div>
              {k.delta && <div style={{ fontSize: 10.5, color: 'var(--green)' }}>{k.delta}</div>}
              {k.sub && <div style={{ fontSize: 10.5, color: k.alert ? 'var(--red)' : 'var(--green)' }}>{k.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3 style={h3}>Live Orders Overview</h3>
            <div style={{ flex: 1 }} />
            <span style={{ ...muted, cursor: 'pointer' }}>View All Orders →</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <span className="pill orange">New Orders 12</span>
            <span className="pill gray">Preparing 13</span>
            <span className="pill gray">Completed 46</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Order ID</th><th>Source</th><th>Location</th>
                <th>Customer</th><th>Items</th><th>Time</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ORDERS.map(o => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 700 }}>{o.id}</td>
                  <td><span className={'pill ' + o.srcTone}>{o.src}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.loc}</div>
                    <div style={muted}>{o.when}</div>
                  </td>
                  <td>{o.cust}</td>
                  <td style={{ textAlign: 'center' }}>{o.items}</td>
                  <td style={muted}>{o.time}</td>
                  <td><span className="pill orange">{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={card}>
          <div style={{ display: 'flex' }}>
            <h3 style={h3}>Location Status</h3>
            <div style={{ flex: 1 }} />
            <span style={{ ...muted, cursor: 'pointer' }}>View All →</span>
          </div>
          {LOCATIONS.map(l => (
            <div key={l.name} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0',
              borderTop: '1px solid var(--line)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                background: l.state === 'Active' ? 'var(--green)' : l.state === 'Fast Track' ? 'var(--mc-orange)' : 'var(--ink-3)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                <div style={muted}>{l.when}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{l.orders}</div>
                <div style={muted}>Active Orders</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>WiFi Customers <span style={muted}>(Dubai WTC-GITEX)</span></h3>
            <div style={{ display: 'flex', gap: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--green)' }}>64</div>
                <div style={muted}>Connected Now</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--purple)' }}>538</div>
                <div style={muted}>Total Today</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={muted}>Capacity Used — 31.2%</div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 4 }}>
                <div style={{ width: '31.2%', height: '100%', borderRadius: 3, background: 'var(--green)' }} />
              </div>
            </div>
          </div>

          <div className="card" style={card}>
            <div style={{ display: 'flex' }}>
              <h3 style={h3}>CCTV Feed</h3>
              <div style={{ flex: 1 }} />
              <span className="pill red">● Live</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['Inside Truck', 'Front of Truck', 'Serving Window', 'Queue'].map(cam => (
                <div key={cam} style={{
                  aspectRatio: '16/10', borderRadius: 8, background: '#26262B', color: '#9A9AA2',
                  display: 'grid', placeItems: 'center', fontSize: 10.5,
                }}>{cam}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <h3 style={h3}>Inventory Overview — Dubai WTC - GITEX <span style={muted}>(Food Truck 1)</span></h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Menu Item</th><th>Opening</th><th>Used</th>
                <th>Closing</th><th style={{ width: '26%' }}>Stock Level</th>
              </tr>
            </thead>
            <tbody>
              {INVENTORY.map(i => (
                <tr key={i.item} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>{i.item}</td>
                  <td>{i.open}</td><td>{i.used}</td><td>{i.closing}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--line)' }}>
                        <div style={{ width: i.level + '%', height: '100%', borderRadius: 3, background: i.tone }} />
                      </div>
                      <span style={{ fontSize: 10.5, color: i.tone, fontWeight: 700 }}>{i.level}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={card}>
          <h3 style={h3}>Payments Summary <span style={muted}>(Today)</span></h3>
          {[
            ['Dubai WTC - GITEX', 'AED 47,820'],
            ['Dubai Blue Water - Afroloud', 'AED 37,420'],
          ].map(([loc, amt]) => (
            <div key={loc} style={{ display: 'flex', padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ flex: 1 }}>{loc}</span><b>{amt}</b>
            </div>
          ))}
          <div style={{ display: 'flex', padding: '9px 0', borderTop: '2px solid var(--ink)', fontSize: 13 }}>
            <b style={{ flex: 1 }}>TOTAL</b><b>AED 85,240</b>
          </div>

          <h3 style={{ ...h3, marginTop: 16 }}>Payment Methods <span style={muted}>(Overall)</span></h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['Cash', '8.6%'], ['POS Card', '28.4%'], ['Online', '63.0%']].map(([m, p]) => (
              <div key={m} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{p}</div>
                <div style={muted}>{m}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>Customers & Engagement <span style={muted}>(Today)</span></h3>
            {[
              ['🧑‍🤝‍🧑 New Customers', '128'], ['🔁 Repeat Customers', '236'],
              ['💬 WhatsApp Registrations', '184'], ['✉️ Email Registrations', '96'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', padding: '6px 0', fontSize: 12, borderTop: '1px solid var(--line)' }}>
                <span style={{ flex: 1 }}>{l}</span><b>{v}</b>
              </div>
            ))}
          </div>
          <div className="card" style={card}>
            <h3 style={h3}>Social & Reviews <span style={muted}>(Today)</span></h3>
            {[
              ['📣 New Social Followers', '126'], ['⭐ Google Reviews', '18 · 4.8 avg'], ['📝 Reviews Responded', '9'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', padding: '6px 0', fontSize: 12, borderTop: '1px solid var(--line)' }}>
                <span style={{ flex: 1 }}>{l}</span><b>{v}</b>
              </div>
            ))}
          </div>
          <div className="card" style={card}>
            <h3 style={h3}>Sales via Partners & Vouchers <span style={muted}>(Today)</span></h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['Careem', 'AED 2,640'], ['Talabat', 'AED 3,820'], ['Vouchers', 'AED 1,450']].map(([p, v]) => (
                <div key={p} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5 }}>{v}</div>
                  <div style={muted}>{p}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
