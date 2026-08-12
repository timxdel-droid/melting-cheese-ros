import { useNavigate } from 'react-router-dom'

/* Screen: Menu Management › Categories (Figma node 106-1917)
   Category table with type/channels/items/status, right rail with overview,
   channel distribution and top categories. */

const CATS = [
  { name: 'Rice Meals', desc: 'Flavorful rice dishes', slug: 'rice-meals', type: 'Food', items: 4, status: 'Active', sort: 1 },
  { name: 'Burger & Grills', desc: 'Burgers, grills & more', slug: 'burger-grills', type: 'Food', items: 4, status: 'Active', sort: 2 },
  { name: 'Meat Meals', desc: 'Hearty meat dishes', slug: 'meat-meals', type: 'Food', items: 3, status: 'Active', sort: 3 },
  { name: 'Extra/Add On Menu', desc: 'Sides, extras & add-ons', slug: 'extras-addons', type: 'Food', items: 14, status: 'Active', sort: 4 },
  { name: 'Extra Proteins', desc: 'Additional protein options', slug: 'extra-proteins', type: 'Food', items: 4, status: 'Active', sort: 5 },
  { name: 'Sauces & Dips', desc: 'Sauces, dips & condiments', slug: 'sauces-dips', type: 'Add-on', items: 3, status: 'Active', sort: 6 },
  { name: 'Drinks', desc: 'Refreshing beverages', slug: 'drinks', type: 'Beverage', items: 6, status: 'Active', sort: 7 },
  { name: 'Desserts', desc: 'Sweet treats & desserts', slug: 'desserts', type: 'Dessert', items: 2, status: 'Active', sort: 8 },
  { name: 'Street Lab Combos', desc: 'Value combos & deals', slug: 'street-lab-combos', type: 'Combo', items: 6, status: 'Active', sort: 9 },
  { name: 'Festival Specials', desc: 'Limited time offers', slug: 'festival-specials', type: 'Special', items: 3, status: 'Active', sort: 10 },
]

const typeTone = { Food: 'orange', 'Add-on': 'purple', Beverage: 'blue', Dessert: 'gray', Combo: 'green', Special: 'red' }
const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }

export default function MenuCategories() {
  const nav = useNavigate()
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Menu Categories</h2>
          <div style={muted}>Manage menu categories to organize your food and drinks on all sales channels.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ ...sel, marginRight: 8 }}>Export</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>+ Add New Category</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div className="card" style={card}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input placeholder="Search categories by title or slug…" style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', outline: 'none' }} />
            <select style={sel}><option>All Status</option></select>
            <select style={sel}><option>All Locations</option></select>
            <select style={sel}><option>All Channels</option></select>
            <select style={sel}><option>All Types</option></select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Category</th><th>Slug</th><th>Type</th>
                <th>Items</th><th>Status</th><th>Sort Order</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {CATS.map(c => (
                <tr key={c.slug} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '9px 4px', cursor: 'pointer' }} onClick={() => nav('/menu/category')}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={muted}>{c.desc}</div>
                  </td>
                  <td style={muted}>{c.slug}</td>
                  <td><span className={'pill ' + (typeTone[c.type] || 'gray')}>{c.type}</span></td>
                  <td style={{ textAlign: 'center' }}>{c.items}</td>
                  <td><span className="pill green">{c.status}</span></td>
                  <td style={{ textAlign: 'center' }}>{c.sort}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button title="Open" onClick={() => nav('/menu/category')}>👁</button>
                    <button title="Edit">✏️</button>
                    <button title="Delete" style={{ color: 'var(--red)' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, ...muted }}>
            <span>Showing 1 to 10 of 18 categories</span>
            <span>‹ 1 2 ›&ensp;·&ensp;10/page</span>
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', ...muted }}>
            Channels:&ensp;Mobile App · eMenu (QR) · Website · Kiosk · Display Boards · Menu Boards
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>Categories Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['Total Categories', '18'], ['Active Categories', '16'], ['Total Items', '170'], ['Sales (Today)', 'AED 18,640']].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--surface-alt)', borderRadius: 9, padding: '9px 10px' }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{v}</div>
                  <div style={muted}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Channels Distribution</h3>
            {[
              ['Mobile App', '18 (100%)', 'var(--mc-orange)'], ['eMenu (QR)', '16 (88.9%)', 'var(--blue)'],
              ['Website', '15 (83.3%)', 'var(--green)'], ['Display Boards', '8 (44.4%)', 'var(--purple)'], ['Menu Boards', '6 (33.3%)', 'var(--teal)'],
            ].map(([ch, v, tone]) => (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: tone }} />
                <span style={{ flex: 1 }}>{ch}</span><b>{v}</b>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Top Categories <span style={muted}>(By Sales Today)</span></h3>
            {[['Rice Meals', 'AED 6,420 · 34.4%'], ['Burger & Grills', 'AED 3,820 · 20.5%'], ['Meat Meals', 'AED 2,960 · 15.9%']].map(([c, v]) => (
              <div key={c} style={{ display: 'flex', padding: '7px 0', fontSize: 12, borderTop: '1px solid var(--line)' }}>
                <span style={{ flex: 1 }}>{c}</span><b>{v}</b>
              </div>
            ))}
            <button style={{ ...sel, width: '100%', color: 'var(--mc-orange-deep)', marginTop: 10, borderColor: 'var(--mc-orange)' }}>
              View All Categories Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
