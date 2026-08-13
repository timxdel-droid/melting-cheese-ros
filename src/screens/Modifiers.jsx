/* Screen: Menu Management › Modifiers (Figma node 106-3464)
   KPI strip, modifiers table by group, modifier detail rail, summaries. */

const MODS = [
  { name: 'Spice Level', group: 'Cooking', applies: 'Rice Meals, Burger & Grills', options: 4, price: '—', status: 'Active' },
  { name: 'Extra Cheese', group: 'Add-on', applies: 'All Mains', options: 1, price: '+5.00', status: 'Active' },
  { name: 'Extra Sauce', group: 'Add-on', applies: 'All Mains', options: 3, price: '+2.00', status: 'Active' },
  { name: 'Protein Choice', group: 'Selection', applies: 'Rice Meals', options: 5, price: 'varies', status: 'Active' },
  { name: 'Portion Size', group: 'Selection', applies: 'All Categories', options: 3, price: 'varies', status: 'Active' },
  { name: 'Toppings', group: 'Add-on', applies: 'Burgers, Fries', options: 6, price: '+1.50', status: 'Active' },
  { name: 'Drink Size', group: 'Selection', applies: 'Drinks', options: 3, price: 'varies', status: 'Active' },
  { name: 'Ice Level', group: 'Cooking', applies: 'Drinks', options: 3, price: '—', status: 'Inactive' },
  { name: 'Special Instructions', group: 'Note', applies: 'All Categories', options: 1, price: '—', status: 'Active' },
  { name: 'Cooking Style', group: 'Cooking', applies: 'Meat Meals', options: 4, price: '—', status: 'Active' },
]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const groupTone = { Cooking: 'orange', 'Add-on': 'purple', Selection: 'blue', Note: 'gray' }

export default function Modifiers() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Modifiers</h2>
          <div style={muted}>Manage item modifiers, options and rules for meal customisation.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ ...sel, marginRight: 8 }}>Export Report</button>
        <button style={{ ...sel, marginRight: 8 }}>Import Modifiers</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>Add New Modifier</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          ['Total Modifiers', '86', 'All modifiers'], ['Active Modifiers', '72', '83.7% of total'],
          ['Modifier Groups', '14', 'Across the menu'], ['Inactive / Draft', '24', 'Needs review'],
          ['Times Used Today', '458', 'On orders'],
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
            <input placeholder="Search modifiers…" style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', outline: 'none' }} />
            <select style={sel}><option>All Categories</option></select>
            <select style={sel}><option>All Groups</option></select>
            <select style={sel}><option>All Status</option></select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Modifier</th><th>Group</th><th>Applies To</th>
                <th>Options</th><th>Price Delta</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {MODS.map(m => (
                <tr key={m.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>{m.name}</td>
                  <td><span className={'pill ' + (groupTone[m.group] || 'gray')}>{m.group}</span></td>
                  <td style={muted}>{m.applies}</td>
                  <td style={{ textAlign: 'center' }}>{m.options}</td>
                  <td><b>{m.price}</b></td>
                  <td><span className={'pill ' + (m.status === 'Active' ? 'green' : 'gray')}>{m.status}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button title="Edit">✏️</button>
                    <button title="Duplicate">⧉</button>
                    <button title="Delete" style={{ color: 'var(--red)' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, ...muted }}>
            <span>Showing 1 to 10 of 86 modifiers</span>
            <span>‹ 1 2 3 … 9 ›&ensp;·&ensp;10 per page</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ ...h3, margin: 0 }}>Spice Level</h3>
              <div style={{ flex: 1 }} />
              <span className="pill green">Active</span>
            </div>
            {[
              ['Group', 'Cooking'], ['Applies To', 'Rice Meals, Burger & Grills'],
              ['Selection', 'Single choice · required'], ['Options', 'Mild / Medium / Hot / Extra Hot'],
              ['Price Delta', 'None'], ['Created By', 'Super Admin'], ['Updated On', '19 Oct 2026, 03:12 PM'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '4px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-2)', flexShrink: 0 }}>{k}</span><b style={{ textAlign: 'right' }}>{v}</b>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Top 3 Most Used Modifiers</h3>
            {[['Spice Level', '186 uses'], ['Protein Choice', '142 uses'], ['Extra Cheese', '96 uses']].map(([m, v]) => (
              <div key={m} style={{ display: 'flex', padding: '6px 0', fontSize: 12, borderTop: '1px solid var(--line)' }}>
                <span style={{ flex: 1 }}>{m}</span><b>{v}</b>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Modifier Rules Summary</h3>
            {[['Required Modifiers', '22'], ['Optional Modifiers', '64'], ['Single Select', '38'], ['Multi Select', '48'], ['Total Rules Applied', '86']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-2)' }}>{k}</span><b>{v}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card" style={card}>
          <h3 style={h3}>Modifiers by Group</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['Cooking', '24'], ['Add-on', '32'], ['Selection', '26'], ['Note', '4']].map(([g, v]) => (
              <div key={g} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{v}</div>
                <div style={muted}>{g}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={card}>
          <h3 style={h3}>Modifiers by Status</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['Total', '86'], ['Active', '72 (83.7%)'], ['Inactive', '14 (16.3%)']].map(([l, v]) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-alt)', borderRadius: 9, padding: '10px 4px' }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{v}</div>
                <div style={muted}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
