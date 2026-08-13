/* Screen: Menu Management › Items (Figma node 106-2941)
   KPI strip, item table with pricing/margins, item detail rail,
   status/price-range/availability summaries. */

const ITEMS = [
  { name: 'Jerk Chicken & Jollof Rice', cat: 'Rice Meals', catTone: 'orange', sell: 14.99, cost: 5.40, margin: 64, avail: 'In Stock', status: 'Active' },
  { name: 'Suya Beef & Rice', cat: 'Rice Meals', catTone: 'orange', sell: 11.80, cost: 4.80, margin: 60, avail: 'In Stock', status: 'Active' },
  { name: 'Grilled Tilapia Rice', cat: 'Rice Meals', catTone: 'orange', sell: 10.99, cost: 4.20, margin: 62, avail: 'In Stock', status: 'Active' },
  { name: 'Fried Rice (Veg)', cat: 'Rice Meals', catTone: 'orange', sell: 8.99, cost: 3.10, margin: 65, avail: 'In Stock', status: 'Active' },
  { name: 'Ofada Rice & Ayamase', cat: 'Rice Meals', catTone: 'orange', sell: 12.90, cost: 4.70, margin: 64, avail: 'In Stock', status: 'Active' },
  { name: 'Coconut Rice & Chicken', cat: 'Rice Meals', catTone: 'orange', sell: 13.89, cost: 5.10, margin: 63, avail: 'Low Stock', status: 'Active' },
  { name: 'White Rice & Stew', cat: 'Sides', catTone: 'blue', sell: 7.99, cost: 2.70, margin: 66, avail: 'In Stock', status: 'Active' },
  { name: 'Jollof Rice (Small)', cat: 'Sides', catTone: 'blue', sell: 6.99, cost: 2.30, margin: 67, avail: 'In Stock', status: 'Active' },
  { name: 'Extra Plantain', cat: 'Add-ons', catTone: 'purple', sell: 3.50, cost: 1.20, margin: 66, avail: 'In Stock', status: 'Active' },
  { name: 'Coleslaw', cat: 'Add-ons', catTone: 'purple', sell: 2.50, cost: 0.90, margin: 64, avail: 'In Stock', status: 'Active' },
]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }

export default function MenuItems() {
  const detail = ITEMS[0]
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Items</h2>
          <div style={muted}>Manage all menu items, pricing, availability and settings. · <span className="pill green">Active</span> 128 items · Visible in 5 channels</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ ...sel, marginRight: 8 }}>Export Items</button>
        <button style={{ ...sel, marginRight: 8 }}>Import Items</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>Add New Item</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          ['Total Items', '128', 'All menu items'], ['Active Items', '112', '87.5% of total'],
          ['Inactive Items', '16', '12.5% of total'], ['Out of Stock', '9', '7% of total'],
          ['Avg. Selling Price', 'AED 14.75', 'Per portion'],
        ].map(([l, v, s]) => (
          <div key={l} className="card" style={{ padding: 14 }}>
            <div style={muted}>{l}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{v}</div>
            <div style={muted}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input placeholder="Search items…" style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', outline: 'none' }} />
            <select style={sel}><option>All Categories</option></select>
            <select style={sel}><option>All Status</option></select>
            <select style={sel}><option>All Availability</option></select>
            <select style={sel}><option>All Locations</option></select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Item Name</th><th>Category</th><th>Sell Price (AED)</th>
                <th>Cost (AED)</th><th>Margin %</th><th>Availability</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ITEMS.map(i => (
                <tr key={i.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>{i.name}</td>
                  <td><span className={'pill ' + i.catTone}>{i.cat}</span></td>
                  <td><b>{i.sell.toFixed(2)}</b></td>
                  <td>{i.cost.toFixed(2)}</td>
                  <td><b style={{ color: 'var(--green)' }}>{i.margin}%</b></td>
                  <td><span className={'pill ' + (i.avail === 'In Stock' ? 'green' : 'orange')}>{i.avail}</span></td>
                  <td><span className="pill green">{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, ...muted }}>
            <span>Showing 1 to 10 of 128 items</span>
            <span>‹ 1 2 3 4 5 … 13 ›&ensp;·&ensp;10 per page</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <div style={{ display: 'flex' }}>
              <h3 style={h3}>Item Details</h3>
              <div style={{ flex: 1 }} />
              <span style={{ ...muted, cursor: 'pointer' }}>View Full Details</span>
            </div>
            <b style={{ fontSize: 13 }}>{detail.name}</b>
            <div style={{ ...muted, marginBottom: 6 }}>SKU: MC-001 · <span className="pill green">Active</span></div>
            {[
              ['Category', detail.cat], ['Selling Price', 'AED ' + detail.sell.toFixed(2)],
              ['Cost Price', 'AED ' + detail.cost.toFixed(2)], ['Margin', detail.margin + '%'],
              ['Prep Time', '6 min'], ['Availability', 'In Stock'],
              ['Last Updated', '20 Oct 2026, 08:45 AM'], ['Updated By', 'Super Admin'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-2)' }}>{k}</span><b>{v}</b>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Items by Category</h3>
            {[
              ['Rice Meals', '68 (53.1%)', 'var(--mc-orange)'], ['Sides', '28 (21.9%)', 'var(--blue)'],
              ['Add-ons', '18 (14.7%)', 'var(--purple)'], ['Drinks', '10 (7.8%)', 'var(--teal)'], ['Others', '4 (3.1%)', 'var(--ink-3)'],
            ].map(([c, v, tone]) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: tone }} />
                <span style={{ flex: 1 }}>{c}</span><b>{v}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <h3 style={h3}>Items by Status</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['Total', '128'], ['Active', '112 (87.5%)'], ['Inactive', '16 (12.5%)']].map(([l, v]) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{v}</div>
                <div style={muted}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={card}>
          <h3 style={h3}>Availability Overview</h3>
          {[['In Stock', '101 (79.0%)', 'green'], ['Low Stock', '18 (14.1%)', 'orange'], ['Out of Stock', '9 (7.0%)', 'red']].map(([l, v, tone]) => (
            <div key={l} style={{ display: 'flex', padding: '6px 0', fontSize: 12, borderTop: '1px solid var(--line)', alignItems: 'center', gap: 8 }}>
              <span className={'pill ' + tone}>{l}</span>
              <div style={{ flex: 1 }} /><b>{v}</b>
            </div>
          ))}
        </div>

        <div className="card" style={card}>
          <div style={{ display: 'flex' }}>
            <h3 style={h3}>Top Selling Items</h3>
            <div style={{ flex: 1 }} />
            <span style={{ ...muted, cursor: 'pointer' }}>View Report</span>
          </div>
          {[
            ['Jerk Chicken & Jollof Rice', '542 sold'], ['Suya Beef & Rice', '489 sold'],
            ['Grilled Tilapia Rice', '412 sold'], ['Coconut Rice & Chicken', '398 sold'], ['Ofada Rice & Ayamase', '376 sold'],
          ].map(([i, v]) => (
            <div key={i} style={{ display: 'flex', padding: '6px 0', fontSize: 12, borderTop: '1px solid var(--line)' }}>
              <span style={{ flex: 1 }}>{i}</span><b>{v}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
