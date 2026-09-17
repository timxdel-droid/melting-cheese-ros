import { useState } from 'react'
import SyncPanel, { SourcePills } from '../components/SyncPanel.jsx'
import { loadSyncedProducts, loadConnectors, pushProduct, hasWriteAccess, syncProducts } from '../lib/connectors.js'

/* Screen: Menu Management › Items (Figma node 106-2941)
   v7: Sync button + connectors — items pulled live from the website /
   mobile-app WooCommerce backends and tagged per source.
   v8: inline editing (name, price, stock) with Push — edits are written
   back to every connected backend via the WooCommerce REST API, which
   updates both the website and the mobile app. */

const ITEMS = [
  { name: 'Jerk Chicken & Jollof Rice', cat: 'Rice Meals', catTone: 'orange', sell: 14.99, avail: 'In Stock', status: 'Active' },
  { name: 'Suya Beef & Rice', cat: 'Rice Meals', catTone: 'orange', sell: 11.80, avail: 'In Stock', status: 'Active' },
  { name: 'Grilled Tilapia Rice', cat: 'Rice Meals', catTone: 'orange', sell: 10.99, avail: 'In Stock', status: 'Active' },
  { name: 'Fried Rice (Veg)', cat: 'Rice Meals', catTone: 'orange', sell: 8.99, avail: 'In Stock', status: 'Active' },
  { name: 'Ofada Rice & Ayamase', cat: 'Rice Meals', catTone: 'orange', sell: 12.90, avail: 'In Stock', status: 'Active' },
  { name: 'Coconut Rice & Chicken', cat: 'Rice Meals', catTone: 'orange', sell: 13.89, avail: 'Low Stock', status: 'Active' },
  { name: 'White Rice & Stew', cat: 'Sides', catTone: 'blue', sell: 7.99, avail: 'In Stock', status: 'Active' },
  { name: 'Jollof Rice (Small)', cat: 'Sides', catTone: 'blue', sell: 6.99, avail: 'In Stock', status: 'Active' },
  { name: 'Extra Plantain', cat: 'Add-ons', catTone: 'purple', sell: 3.50, avail: 'In Stock', status: 'Active' },
  { name: 'Coleslaw', cat: 'Add-ons', catTone: 'purple', sell: 2.50, avail: 'In Stock', status: 'Active' },
]

const TONES = ['orange', 'blue', 'purple', 'green', 'gray']
const toneFor = cat => TONES[Math.abs([...String(cat)].reduce((a, c) => a + c.charCodeAt(0), 0)) % TONES.length]

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const h3 = { margin: '0 0 12px', fontSize: 13.5, fontWeight: 700 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const editField = { border: '1px solid var(--mc-orange)', borderRadius: 6, padding: '5px 7px', fontSize: 12, outline: 'none' }

export default function MenuItems() {
  const [sync, setSync] = useState(loadSyncedProducts)
  const [edits, setEdits] = useState({})      // productId -> { name, price, inStock }
  const [editing, setEditing] = useState(null) // productId being edited
  const [draft, setDraft] = useState({})
  const [pushMsg, setPushMsg] = useState(null)
  const [pushing, setPushing] = useState(false)

  const live = !!(sync && sync.items && sync.items.length)
  const rows = live
    ? sync.items.map(it => {
        const e = edits[it.id] || {}
        return {
          id: it.id,
          name: e.name != null ? e.name : it.name,
          cat: it.cat, catTone: toneFor(it.cat),
          sell: e.price != null ? Number(e.price) : it.price,
          avail: (e.inStock != null ? e.inStock : it.inStock) ? 'In Stock' : 'Out of Stock',
          inStock: e.inStock != null ? e.inStock : it.inStock,
          status: 'Active', sources: it.sources, img: it.img,
          edited: !!edits[it.id],
        }
      })
    : ITEMS
  const detail = rows[0]
  const editCount = Object.keys(edits).length

  const startEdit = r => {
    setEditing(r.id)
    setDraft({ name: r.name, price: r.sell != null ? r.sell.toFixed(2) : '', inStock: r.inStock })
  }
  const saveEdit = () => {
    setEdits(e => ({ ...e, [editing]: { name: draft.name, price: draft.price, inStock: draft.inStock } }))
    setEditing(null)
  }

  const pushAll = async () => {
    setPushing(true)
    setPushMsg(null)
    const conns = loadConnectors()
    const out = []
    let allOk = true
    for (const [id, ch] of Object.entries(edits)) {
      const r = await pushProduct(conns, id, ch)
      if (!r.ok) allOk = false
      out.push('#' + id + ' → ' + r.results.join(', '))
    }
    if (allOk) {
      const fresh = await syncProducts(conns)
      if (fresh.items.length) setSync(fresh)
      setEdits({})
      setPushMsg('✓ Pushed ' + out.length + ' change' + (out.length > 1 ? 's' : '') + ' to all connected backends')
    } else {
      setPushMsg('Push issues — ' + out.join(' · '))
    }
    setPushing(false)
  }

  const kpis = live
    ? [
        ['Total Items', String(rows.length), 'Synced from connectors'],
        ['Website Items', String(rows.filter(r => r.sources && r.sources.includes('Website')).length), 'From website backend'],
        ['App Items', String(rows.filter(r => r.sources && r.sources.includes('App')).length), 'From app backend'],
        ['Out of Stock', String(rows.filter(r => r.avail === 'Out of Stock').length), 'Needs attention'],
        ['Pending Edits', String(editCount), editCount ? 'Ready to push' : 'No local changes'],
      ]
    : [
        ['Total Items', '128', 'All menu items'], ['Active Items', '112', '87.5% of total'],
        ['Inactive Items', '16', '12.5% of total'], ['Out of Stock', '9', '7% of total'],
        ['Avg. Selling Price', 'AED 14.75', 'Per portion'],
      ]

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Items</h2>
          <div style={muted}>
            Manage all menu items, pricing, availability and settings.
            {live
              ? <> · <span className="pill green">Live</span> {rows.length} items · synced from website + app</>
              : <> · <span className="pill gray">Demo data</span> — press Sync to pull live products</>}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {live && editCount > 0 && (
          <button className="btn-primary" style={{ fontSize: 12.5, marginRight: 8, background: 'var(--green)', opacity: pushing ? .6 : 1 }}
            disabled={pushing} onClick={pushAll}>
            {pushing ? 'Pushing…' : '⇧ Push ' + editCount + ' change' + (editCount > 1 ? 's' : '')}
          </button>
        )}
        <SyncPanel lastSync={sync && sync.syncedAt} onSynced={r => { setSync(r); setEdits({}) }} />
        <button style={{ ...sel, marginRight: 8 }}>Export Items</button>
        <button className="btn-primary" style={{ fontSize: 12.5 }}>Add New Item</button>
      </div>

      {pushMsg && (
        <div style={{
          fontSize: 12, padding: '9px 12px', borderRadius: 9, fontWeight: 600,
          background: pushMsg.startsWith('✓') ? 'var(--green-soft)' : 'var(--red-soft)',
          color: pushMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)',
        }}>{pushMsg}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {kpis.map(([l, v, s]) => (
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
            <select style={sel}><option>All Sources</option></select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                <th style={{ padding: '6px 4px' }}>Item Name</th><th>Category</th><th>Source</th>
                <th>Sell Price (AED)</th><th>Availability</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(i => (
                <tr key={i.id || i.name} style={{
                  borderTop: '1px solid var(--line)',
                  background: i.edited ? 'var(--amber-chip)' : 'transparent',
                }}>
                  {editing === i.id ? (
                    <>
                      <td style={{ padding: '8px 4px' }}>
                        <input style={{ ...editField, width: '95%' }} value={draft.name}
                          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                      </td>
                      <td><span className={'pill ' + i.catTone}>{i.cat}</span></td>
                      <td><SourcePills sources={i.sources} /></td>
                      <td>
                        <input style={{ ...editField, width: 70 }} value={draft.price}
                          onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} />
                      </td>
                      <td>
                        <select style={{ ...editField, padding: '4px 6px' }} value={draft.inStock ? 'in' : 'out'}
                          onChange={e => setDraft(d => ({ ...d, inStock: e.target.value === 'in' }))}>
                          <option value="in">In Stock</option>
                          <option value="out">Out of Stock</option>
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button style={{ color: 'var(--green)', fontWeight: 700, fontSize: 11.5 }} onClick={saveEdit}>✓ Save</button>
                        <button style={{ ...muted, marginLeft: 6 }} onClick={() => setEditing(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '8px 4px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {i.img && <img src={i.img} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />}
                          {i.name}
                          {i.edited && <span className="pill orange" style={{ fontSize: 9 }}>edited</span>}
                        </div>
                      </td>
                      <td><span className={'pill ' + i.catTone}>{i.cat}</span></td>
                      <td><SourcePills sources={i.sources} /></td>
                      <td><b>{i.sell != null ? i.sell.toFixed(2) : '—'}</b></td>
                      <td><span className={'pill ' + (i.avail === 'In Stock' ? 'green' : i.avail === 'Low Stock' ? 'orange' : 'red')}>{i.avail}</span></td>
                      <td>
                        {live
                          ? <button title="Edit" style={{ fontSize: 12 }} onClick={() => startEdit(i)}>✏️ Edit</button>
                          : <span style={muted}>—</span>}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, ...muted }}>
            <span>Showing {rows.length} items{live ? ' from connected backends' : ''}</span>
            <span>‹ 1 ›&ensp;·&ensp;100 per page</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={card}>
            <h3 style={h3}>Edit & Push</h3>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Edit name, price or stock on any synced row, then press
              <b> Push</b> to write the changes back to every connected backend.
              The website and the mobile app both read from those backends, so
              a push updates both applications at once.
            </div>
            {live && !hasWriteAccess(loadConnectors()) && (
              <div style={{
                marginTop: 10, fontSize: 11, padding: '7px 9px', borderRadius: 8,
                background: 'var(--amber-chip)', color: 'var(--mc-orange-deep)', fontWeight: 600,
              }}>
                No API key yet — open Sync and add a WooCommerce Read/Write key to enable pushing.
              </div>
            )}
          </div>

          <div className="card" style={card}>
            <div style={{ display: 'flex' }}>
              <h3 style={h3}>Item Details</h3>
              <div style={{ flex: 1 }} />
            </div>
            <b style={{ fontSize: 13 }}>{detail.name}</b>
            <div style={{ ...muted, marginBottom: 6 }}>
              <span className="pill green">Active</span>
              {detail.sources && <> · <SourcePills sources={detail.sources} /></>}
            </div>
            {[
              ['Category', detail.cat],
              ['Selling Price', detail.sell != null ? 'AED ' + detail.sell.toFixed(2) : '—'],
              ['Availability', detail.avail],
              ['Source', detail.sources ? detail.sources.join(' + ') : 'Demo data'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-2)' }}>{k}</span><b>{v}</b>
              </div>
            ))}
          </div>

          <div className="card" style={card}>
            <h3 style={h3}>Items by Category</h3>
            {(live
              ? [...new Set(rows.map(r => r.cat))].slice(0, 8).map(c => [c, String(rows.filter(r => r.cat === c).length), 'var(--mc-orange)'])
              : [
                  ['Rice Meals', '68 (53.1%)', 'var(--mc-orange)'], ['Sides', '28 (21.9%)', 'var(--blue)'],
                  ['Add-ons', '18 (14.7%)', 'var(--purple)'], ['Drinks', '10 (7.8%)', 'var(--teal)'], ['Others', '4 (3.1%)', 'var(--ink-3)'],
                ]
            ).map(([c, v, tone]) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: tone }} />
                <span style={{ flex: 1 }}>{c}</span><b>{v}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
