/* Screen: Operations Dashboard (Figma nodes 101-4244 / 106-3989)
   All data is mock — wiring comes in a later phase. */

const KPIS = [
  { icon: '🧾', tint: 'var(--amber-chip)', label: 'Orders Today', value: '571', delta: '+18.6% vs yesterday' },
  { icon: '💰', tint: 'var(--green-soft)', label: 'Revenue Today', value: 'AED 85,240', delta: '+22.4% vs yesterday' },
  { icon: '⏱', tint: 'var(--amber-chip)', label: 'Avg. Prep Time', value: '18 min', delta: '-4 min vs yesterday' },
  { icon: '📍', tint: 'var(--purple-soft)', label: 'Active Locations', value: '2 Active · 4 Scheduled', small: true },
  { icon: '🖥', tint: 'var(--blue-soft)', label: 'Kitchen Screens', value: '12', sub: 'Online' },
  { icon: '🛎', tint: 'var(--red-soft)', label: 'Pending Orders', value: '24', sub: 'Needs attention', alert: true },
]

const ORDERS = [
  { id: 'MC-1025', src: 'Kiosk', srcTone: 'orange', loc: 'Dubai WTC - GITEX', when: '17-23 Oct', cust: 'Tunde A.', items: 3, time: '2 min ago' },
  { id: 'MC-1024', src: 'App', srcTone: 'blue', loc: 'Dubai Blue Water - Afroloud', when: '25 Nov 26', cust: 'Dola M.', items: 2, time: '3 min ago' },
  { id: 'MC-1023', src: 'eMenu', srcTone: 'green', loc: 'Dubai WTC - GITEX', when: '17-23 Oct', cust: 'Aisha B.', items: 4, time: '5 min ago' },
  { id: 'MC-1022', src: 'Web', srcTone: 'gray', loc: 'Dubai Blue Water - Afroloud', when: '25 Nov 26', cust: 'Emeka O.', items: 2, time: '6 min ago' },
  { id: 'MC-1021', src: 'Kiosk', srcTone: 'orange', loc: 'Dubai WTC - GITEX', when: '17-23 Oct', cust: 'Grace G.', items: 1, time: '7 min ago' },
]

const LOCATIONS = [
  { name: 'Dubai WTC - GITEX', when: '17 - 23 Oct 26', tag: 'Food Truck 1', tagTone: 'green', live: true, orders: 8 },
  { name: 'Dubai Blue Water - Afroloud', when: '25 Nov 26', tag: 'Food Truck 2', tagTone: 'green', live: true, orders: 6 },
  { name: 'Dubai Burj Park - All Africa Festival', when: '23 - 24 Nov 26', tag: 'Scheduled', tagTone: 'orange', orders: 0 },
  { name: 'Dubai Waterpark - Divas Conference', when: '30 Nov 26', tag: 'Scheduled', tagTone: 'orange', orders: 4 },
  { name: 'Dubai Amphitheatre - Butterfly Carnival', when: '7 Dec 26', tag: 'Scheduled', tagTone: 'orange', orders: 0 },
  { name: 'Dubai Christmas Park', when: '10 - 26 Dec 26', tag: 'Scheduled', tagTone: 'orange', orders: 10 },
]

const INVENTORY = [
  { emoji: '🍛', item: 'Jollof & Jerk Meal', alloc: 400, cooked: 350, sold: 295, prep: 50, remaining: 55, pct: 84, status: 'On Track', tone: 'green' },
  { emoji: '🍔', item: 'Cheesy Burger', alloc: 320, cooked: 260, sold: 230, prep: 40, remaining: 30, pct: 88, status: 'Low Stock', tone: 'orange' },
  { emoji: '🥩', item: 'Suya Beef & Jollof', alloc: 150, cooked: 120, sold: 100, prep: 20, remaining: 20, pct: 83, status: 'On Track', tone: 'green' },
  { emoji: '🍟', item: 'Loaded Fries', alloc: 250, cooked: 200, sold: 150, prep: 30, remaining: 50, pct: 75, status: 'On Track', tone: 'green' },
  { emoji: '🍗', item: 'Chicken Wings (8pc)', alloc: 190, cooked: 160, sold: 140, prep: 20, remaining: 20, pct: 88, status: 'Low Stock', tone: 'orange' },
  { emoji: '🌯', item: 'Chicken Wrap', alloc: 200, cooked: 150, sold: 110, prep: 25, remaining: 40, pct: 73, status: 'On Track', tone: 'green' },
  { emoji: '🍌', item: 'Plantain & Beef Bowl', alloc: 120, cooked: 95, sold: 78, prep: 12, remaining: 17, pct: 82, status: 'On Track', tone: 'green' },
]

const PAY_ROWS = [
  ['Dubai WTC - GITEX', 'AED 4,320', 'AED 12,490', 'AED 28,730', 'AED 45,500'],
  ['Dubai Blue Water - Afroloud', 'AED 2,150', 'AED 8,880', 'AED 18,670', 'AED 29,740'],
]

const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const muted = { color: 'var(--ink-3)', fontSize: 11 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, background: '#fff' }
const link = { ...muted, cursor: 'pointer', color: 'var(--mc-orange-deep)', fontWeight: 600 }

export default function Dashboard() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* KPI strip */}
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
        {/* Live orders */}
        <div className="card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3 style={h3}>Live Orders Overview</h3>
            <div style={{ flex: 1 }} />
            <span style={link}>View All Orders →</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={sel}><option>All Locations</option></select>
            <span className="pill orange">New Orders 12</span>
            <span className="pill gray">Preparing 18</span>
            <span className="pill gray">Completed 7</span>
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
                  <td><span className="pill orange">New</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', marginTop: 10, alignItems: 'center' }}>
            <span style={muted}>Showing 1 to 5 of 12 orders</span>
            <div style={{ flex: 1 }} />
            <span style={link}>View All →</span>
          </div>
        </div>

        {/* Location status */}
        <div className="card" style={card}>
          <div style={{ display: 'flex' }}>
            <h3 style={h3}>Location Status</h3>
            <div style={{ flex: 1 }} />
            <span style={link}>View All Locations →</span>
          </div>
          {LOCATIONS.map(l => (
            <div key={l.name} style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0',
              borderTop: '1px solid var(--line)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 4,
                background: l.live ? 'var(--green)' : 'var(--mc-orange)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{l.name}</span>
                  <span className={'pill ' + l.tagTone} style={{ fontSize: 9 }}>{l.tag}</span>
                </div>
                <div style={muted}>{l.when}{l.live && <span style={{ color: 'var(--green)', fontWeight: 700 }}> · ● Live Now</span>}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{l.orders}</div>
                <div style={muted}>Active Orders</div>
              </div>
            </div>
          ))}
        </div>

        {/* WiFi + CCTV column */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>WiFi Customers <span style={muted}>(Dubai WTC-GITEX)</span></h3>
            <div style={{ display: 'flex', gap: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--green)' }}>👥 64</div>
                <div style={muted}>Currently Connected</div>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--purple)' }}>👥 538</div>
                <div style={muted}>Connected Today</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={muted}>Capture Rate (Today) — <b style={{ color: 'var(--ink)' }}>31.2%</b> vs connections</div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 4 }}>
                <div style={{ width: '31.2%', height: '100%', borderRadius: 3, background: 'var(--green)' }} />
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}><span style={link}>View Details →</span></div>
            </div>
          </div>

          <div className="card" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ ...h3, margin: 0 }}>CCTV Feed</h3>
              <div style={{ flex: 1 }} />
              <select style={{ ...sel, fontSize: 10.5, padding: '4px 7px' }}><option>Dubai WTC - GITEX</option></select>
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '10px 0 8px', flexWrap: 'wrap' }}>
              <span className="pill orange" style={{ background: 'var(--mc-orange)', color: '#fff' }}>Inside Truck</span>
              <span className="pill gray">Front of Truck</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['Inside Truck', 'Front of Truck', 'Serving Window', 'Queue'].map(cam => (
                <div key={cam} style={{
                  position: 'relative', aspectRatio: '16/10', borderRadius: 8,
                  background: 'linear-gradient(135deg, #2E2E34, #1C1C1F)', color: '#9A9AA2',
                  display: 'grid', placeItems: 'center', fontSize: 10.5,
                }}>
                  {cam}
                  <span style={{
                    position: 'absolute', top: 5, right: 6, background: 'var(--red)', color: '#fff',
                    fontSize: 8, fontWeight: 800, borderRadius: 4, padding: '1px 5px',
                  }}>LIVE</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right', marginTop: 8 }}><span style={link}>View All Cameras →</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Inventory */}
        <div className="card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <h3 style={{ ...h3, margin: 0 }}>Inventory Overview — Dubai WTC - GITEX <span style={muted}>(Food Truck 1)</span></h3>
            <div style={{ flex: 1 }} />
            <span style={{ ...muted, fontWeight: 600 }}>Event ends in: <b style={{ color: 'var(--red)' }}>2h 40m</b> (Ends 22:00)</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Menu Item</th><th>Allocated</th><th>Cooked</th>
                <th>Sold</th><th>Preparing</th><th>Remaining</th><th style={{ width: '20%' }}>Sold Out %</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {INVENTORY.map(i => (
                <tr key={i.item} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>{i.emoji} {i.item}</td>
                  <td>{i.alloc}</td><td>{i.cooked}</td><td><b>{i.sold}</b></td><td>{i.prep}</td><td>{i.remaining}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--line)' }}>
                        <div style={{ width: i.pct + '%', height: '100%', borderRadius: 3, background: i.tone === 'green' ? 'var(--mc-orange)' : 'var(--red)' }} />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{i.pct}%</span>
                    </div>
                  </td>
                  <td><span className={'pill ' + i.tone}>{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payments */}
        <div className="card" style={card}>
          <h3 style={h3}>Payments Summary <span style={muted}>(Today)</span></h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10 }}>
                <th style={{ padding: '5px 3px' }}>Location</th><th>Cash</th><th>POS</th><th>Online</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {PAY_ROWS.map(([loc, cash, pos, online, total]) => (
                <tr key={loc} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '7px 3px', fontWeight: 600 }}>{loc}</td>
                  <td>{cash}</td><td>{pos}</td><td>{online}</td><td><b>{total}</b></td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--ink)' }}>
                <td style={{ padding: '7px 3px' }}><b>TOTAL</b></td>
                <td><b>AED 6,470</b></td><td><b>AED 21,370</b></td><td><b>AED 47,400</b></td><td><b>AED 75,240</b></td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ ...h3, marginTop: 16 }}>Payment Methods <span style={muted}>(Overall)</span></h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['💵 Cash', '8.6%', 'AED 6,470'], ['💳 POS Card', '28.4%', 'AED 21,370'], ['🌐 Online', '63.0%', 'AED 47,400']].map(([m, p, amt]) => (
              <div key={m} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{p}</div>
                <div style={muted}>{m}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)' }}>{amt}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement / social / partners */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card" style={card}>
              <h3 style={h3}>Customers & Engagement <span style={muted}>(Today)</span></h3>
              {[
                ['🧑‍🤝‍🧑 New Customers', '128'], ['🔁 Repeat Customers', '286'],
                ['💬 WhatsApp Registrations', '184'], ['✉️ Email Registrations', '96'],
                ['🎟 Vouchers Issued (3rd Party)', '43'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', padding: '6px 0', fontSize: 11.5, borderTop: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>{l}</span><b>{v}</b>
                </div>
              ))}
            </div>
            <div className="card" style={card}>
              <h3 style={h3}>Social & Reviews <span style={muted}>(Today)</span></h3>
              {[
                ['📣 New Social Followers', '312'], ['⭐ Google Reviews', '18'],
                ['✨ Average Rating', '4.8'], ['📝 Reviews Responded', '16'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', padding: '6px 0', fontSize: 11.5, borderTop: '1px solid var(--line)' }}>
                  <span style={{ flex: 1 }}>{l}</span><b>{v}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={card}>
            <h3 style={h3}>Sales via Partners & Vouchers <span style={muted}>(Today)</span></h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                ['🎁 Gift Vouchers Used', 'AED 2,640', '28 Orders'],
                ['🎪 Event Organizer Sales', 'AED 5,820', '52 Orders'],
                ['🤝 3rd Party Partner Sales', 'AED 3,450', '31 Orders'],
              ].map(([p, v, o]) => (
                <div key={p} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5 }}>{v}</div>
                  <div style={muted}>{p}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-2)' }}>{o}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
