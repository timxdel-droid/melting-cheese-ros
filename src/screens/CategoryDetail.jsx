import { useNavigate } from 'react-router-dom'

/* Screen: Menu Management › Category Detail (Figma node 106-2419)
   Example: Rice Meals — KPI strip, item economics table, margin analyzer,
   batch cooking, channel visibility, event allocation, forecast. */

const ITEMS = [
  { name: 'Jerk Chicken & Jollof Rice', sell: 14.99, cost: 5.40, contrib: 9.59, margin: 64, prep: '6 min', batch: 50, status: 'Active' },
  { name: 'Suya Beef & Rice', sell: 11.99, cost: 4.80, contrib: 7.19, margin: 60, prep: '5 min', batch: 40, status: 'Active' },
  { name: 'Grilled Tilapia Rice', sell: 10.99, cost: 4.20, contrib: 6.79, margin: 62, prep: '7 min', batch: 30, status: 'Active' },
  { name: 'Fried Rice (Veg)', sell: 8.99, cost: 3.10, contrib: 5.89, margin: 65, prep: '4 min', batch: 60, status: 'Active' },
  { name: 'Ofada Rice & Ayamase', sell: 12.99, cost: 4.70, contrib: 8.29, margin: 64, prep: '6 min', batch: 40, status: 'Active' },
  { name: 'Coconut Rice & Chicken', sell: 13.99, cost: 5.10, contrib: 8.89, margin: 63, prep: '6 min', batch: 45, status: 'Active' },
  { name: 'White Rice & Stew', sell: 7.99, cost: 2.70, contrib: 5.29, margin: 66, prep: '4 min', batch: 80, status: 'Active' },
  { name: 'Jollof Rice (Small)', sell: 6.99, cost: 2.30, contrib: 4.69, margin: 67, prep: '3 min', batch: 60, status: 'Active' },
]

const BATCH = [
  ['Jerk Chicken & Jollof Rice', 50, '20 mins', 50, 'Ready', 'green'],
  ['Suya Beef & Rice', 40, '18 mins', 20, 'In Progress', 'blue'],
  ['Grilled Tilapia Rice', 30, '25 mins', 10, 'Low Stock', 'orange'],
  ['Fried Rice (Veg)', 60, '15 mins', 60, 'Ready', 'green'],
]

const EVENTS = [
  ['GITEX WTC', 400, 350, 295, 55, '84%'],
  ['Afroloud Bluewaters', 250, 210, 180, 30, '86%'],
  ['Divas Conference', 150, 135, 98, 22, '82%'],
  ['Christmas Park', 300, 240, 210, 30, '88%'],
]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const th = { textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }

export default function CategoryDetail() {
  const nav = useNavigate()
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <div style={{ ...muted, marginBottom: 2, cursor: 'pointer' }} onClick={() => nav('/menu')}>Menu Management › Categories › <b>Rice Meals</b></div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Rice Meals</h2>
          <div style={muted}>Flavorful rice-based meals with meats, seafood & special spices. · <span className="pill green">Active</span> 8 items · Visible in 5 channels</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ ...sel, marginRight: 8 }}>Export Report</button>
        <button style={{ ...sel, marginRight: 8 }}>Edit Category</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>Add New Item</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          ['Active Items', '8', 'Total dishes'], ['Avg Selling Price', 'AED 14.75', 'Per portion'],
          ['Avg Food Cost', 'AED 5.20', 'Per portion'], ['Avg Contribution', 'AED 9.55', 'Per portion'],
          ['Category Margin %', '64.7%', 'Excellent'],
        ].map(([l, v, s]) => (
          <div key={l} className="card" style={{ padding: 14 }}>
            <div style={muted}>{l}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{v}</div>
            <div style={{ ...muted, color: l.includes('Margin') ? 'var(--green)' : 'var(--ink-3)' }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <h3 style={h3}>Items in Rice Meals</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={th}>
                <th style={{ padding: '6px 4px' }}>Item Name</th><th>Sell (AED)</th><th>Cost (AED)</th>
                <th>Contribution</th><th>Margin %</th><th>Prep</th><th>Batch</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ITEMS.map(i => (
                <tr key={i.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>{i.name}</td>
                  <td><b>{i.sell.toFixed(2)}</b></td>
                  <td>{i.cost.toFixed(2)}</td>
                  <td style={{ color: 'var(--green)' }}>{i.contrib.toFixed(2)}</td>
                  <td><b style={{ color: i.margin >= 64 ? 'var(--green)' : 'var(--mc-orange-deep)' }}>{i.margin}%</b></td>
                  <td style={muted}>{i.prep}</td>
                  <td style={{ textAlign: 'center' }}>{i.batch}</td>
                  <td><span className="pill green">{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...muted, marginTop: 10 }}>Showing 1 to 8 of 8 items</div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>Contribution Margin Analyzer</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                ['Category Revenue', 'AED 12,440', 'var(--green)'],
                ['Ingredient Cost', 'AED 4,310', 'var(--red)'],
                ['Contribution Margin', 'AED 8,130', 'var(--mc-orange-deep)'],
              ].map(([l, v, tone]) => (
                <div key={l} style={{ flex: 1 }}>
                  <div style={muted}>{l}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: tone }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Batch Cooking Overview</h3>
            {BATCH.map(([item, qty, cycle, remaining, status, tone]) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 11.5, borderTop: '1px solid var(--line)' }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{item}</span>
                <span style={muted}>{qty} · {cycle} · {remaining} left</span>
                <span className={'pill ' + tone}>{status}</span>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Visibility Across Channels</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
              {['Customer App ✓', 'Kiosk ✓', 'eMenu (QR) ✓', 'LED Booth ✓', 'Staff POS ✓', 'Delivery —'].map(c => (
                <span key={c} className={'pill ' + (c.includes('✓') ? 'green' : 'gray')}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <h3 style={h3}>Inventory Allocation Per Event</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={th}>
                <th style={{ padding: '6px 4px' }}>Event</th><th>Allocated</th><th>Cooked</th><th>Sold</th><th>Remaining</th><th>Sell-through</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map(([ev, a, c, s, r, pct]) => (
                <tr key={ev} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '7px 4px', fontWeight: 600 }}>{ev}</td>
                  <td>{a}</td><td>{c}</td><td>{s}</td><td>{r}</td><td><b>{pct}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={card}>
          <h3 style={h3}>Top Performers</h3>
          {[
            ['Top Seller', 'Jerk Chicken & Jollof Rice'], ['Slowest Seller', 'Grilled Tilapia Rice'],
            ['Waste %', '3.4%'], ['Sell-through Rate', '73%'], ['Prep Delay Risk', 'Medium'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '5px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--ink-2)' }}>{k}</span><b style={{ textAlign: 'right' }}>{v}</b>
            </div>
          ))}
        </div>

        <div className="card" style={card}>
          <h3 style={h3}>Category Profit Forecast <span style={muted}>(Next Event: GITEX WTC)</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Projected Portions', '400'], ['Avg Selling Price', 'AED 14.99'],
              ['Revenue', 'AED 5,996'], ['COGS (Food Cost)', 'AED 2,160'],
              ['Contribution Margin', 'AED 3,836'], ['Margin %', '64.0%'],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--surface-alt)', borderRadius: 9, padding: '9px 10px' }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{v}</div>
                <div style={muted}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ ...muted, marginTop: 8 }}>Tip: keep margins healthy — aim for 60%+ contribution margin on all rice meals.</div>
        </div>
      </div>
    </div>
  )
}
