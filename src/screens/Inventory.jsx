import { useState } from 'react'
import SyncPanel, { SourcePills } from '../components/SyncPanel.jsx'
import {
  loadSyncedProducts, loadEvents, saveEvents,
  loadCrates, saveCrates, DEFAULT_CRATE_SIZE,
  loadConnectors, pushProduct, hasWriteAccess,
} from '../lib/connectors.js'

/* Screen: Operations › Inventory
   Product inventory across both backends. Source filter scopes the channel,
   event tabs scope the catalogue. Stock status, unit quantity and crate
   counts are editable inline — Save keeps them in ROS, Push writes the
   unit-level fields back to WooCommerce so the website and app pick them up. */

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const card = { padding: 16 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const numIn = {
  width: 62, border: '1px solid var(--line)', borderRadius: 6,
  padding: '4px 6px', fontSize: 12, outline: 'none', textAlign: 'right',
}

const SOURCES = [
  { key: 'all', label: 'All Sources' },
  { key: 'Website', label: 'Website only' },
  { key: 'App', label: 'Mobile App only' },
]

export default function Inventory() {
  const [sync, setSync] = useState(loadSyncedProducts)
  const [source, setSource] = useState('all')
  const [events, setEvents] = useState(loadEvents)
  const [tab, setTab] = useState('all')
  const [assigning, setAssigning] = useState(false)

  /* crates[key] = { crates, size }  — ROS-only, never leaves this browser */
  const [crates, setCrates] = useState(loadCrates)
  /* drafts[key] = { inStock?, qty?, crates?, size? } — unsaved edits */
  const [drafts, setDrafts] = useState({})
  const [pushing, setPushing] = useState(false)
  const [note, setNote] = useState(null)

  const all = (sync && sync.items) || []
  const live = all.length > 0
  const conns = loadConnectors()
  const canPush = hasWriteAccess(conns)

  const event = events.find(e => e.id === tab) || null
  const key = i => String(i.id) + '|' + i.name

  const bySource = all.filter(i => source === 'all' || i.sources.includes(source))
  const items = event ? bySource.filter(i => event.products.includes(key(i))) : bySource
  const cats = [...new Set(items.map(i => i.cat))]

  const setEvents_ = next => { setEvents(next); saveEvents(next) }

  /* ---- current values: draft wins, then saved crate store, then live sync ---- */
  const crateOf = i => crates[key(i)] || {}
  const val = (i, field) => {
    const d = drafts[key(i)]
    if (d && d[field] !== undefined) return d[field]
    if (field === 'crates') return crateOf(i).crates ?? 0
    if (field === 'size') return crateOf(i).size ?? DEFAULT_CRATE_SIZE
    if (field === 'qty') return i.qty ?? 0
    if (field === 'inStock') return i.inStock
    return undefined
  }
  const edit = (i, field, value) =>
    setDrafts(d => ({ ...d, [key(i)]: { ...d[key(i)], [field]: value } }))

  const dirtyKeys = Object.keys(drafts).filter(k => Object.keys(drafts[k] || {}).length)
  const dirty = dirtyKeys.length

  /* Save — persist crate figures locally, keep unit edits pending for Push. */
  const save = () => {
    const next = { ...crates }
    for (const k of dirtyKeys) {
      const d = drafts[k]
      const cur = next[k] || {}
      next[k] = {
        crates: d.crates !== undefined ? Number(d.crates) : (cur.crates ?? 0),
        size: d.size !== undefined ? Number(d.size) : (cur.size ?? DEFAULT_CRATE_SIZE),
      }
    }
    setCrates(next); saveCrates(next); saveEvents(events)
    setNote({ ok: true, text: 'Saved ' + dirty + ' product' + (dirty === 1 ? '' : 's') + ' to ROS. Press Push to send stock to the website and app.' })
  }

  /* Push — send stock status and unit quantity to every write-enabled backend. */
  const push = async () => {
    setPushing(true); setNote(null)
    const results = []
    let failed = 0
    for (const k of dirtyKeys) {
      const item = all.find(i => key(i) === k)
      if (!item) continue
      const d = drafts[k]
      const changes = {}
      if (d.inStock !== undefined) changes.inStock = d.inStock
      if (d.qty !== undefined) changes.qty = Number(d.qty)
      if (!Object.keys(changes).length) continue
      const r = await pushProduct(conns, item.id, changes)
      if (!r.ok) { failed++; results.push(item.name + ' — ' + r.results.join(', ')) }
    }
    setPushing(false)
    save()
    if (failed) setNote({ ok: false, text: 'Push failed for ' + failed + ' product(s): ' + results.join(' · ') })
    else setNote({ ok: true, text: 'Pushed stock to the website and mobile app. Crate counts saved in ROS.' })
    setDrafts({})
  }

  const toggleProduct = i => {
    if (!event) return
    const k = key(i)
    setEvents_(events.map(e => e.id !== event.id ? e : {
      ...e,
      products: e.products.includes(k) ? e.products.filter(p => p !== k) : [...e.products, k],
    }))
  }

  const renameEvent = e => {
    const name = window.prompt('Event name', e.name)
    if (name && name.trim()) setEvents_(events.map(x => x.id === e.id ? { ...x, name: name.trim() } : x))
  }

  const addEvent = () => {
    const name = window.prompt('New event name')
    if (!name || !name.trim()) return
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString(36).slice(-3)
    setEvents_([...events, { id, name: name.trim(), products: [] }])
    setTab(id); setAssigning(true)
  }

  const rowsFor = cat => (assigning && event ? bySource : items).filter(i => i.cat === cat)
  const catList = assigning && event ? [...new Set(bySource.map(i => i.cat))] : cats

  const totalCrates = items.reduce((n, i) => n + Number(val(i, 'crates') || 0), 0)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Inventory</h2>
          <div style={muted}>
            Product inventory across both sites — website and mobile app.
            {live
              ? <> · <span className="pill green">Live</span> {items.length} products in {cats.length} aisles</>
              : <> · <span className="pill gray">Not synced yet</span></>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {SOURCES.map(s => (
              <button key={s.key} onClick={() => setSource(s.key)} style={{
                border: '1px solid ' + (source === s.key ? 'var(--mc-orange)' : 'var(--line)'),
                background: source === s.key ? 'var(--amber-chip)' : '#fff',
                color: source === s.key ? 'var(--mc-orange-deep)' : 'var(--ink-2)',
                borderRadius: 999, padding: '5px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              }}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SyncPanel lastSync={sync && sync.syncedAt} onSynced={setSync} />
          <button onClick={save} disabled={!dirty} style={{
            ...sel, fontWeight: 700, cursor: dirty ? 'pointer' : 'default',
            opacity: dirty ? 1 : 0.5,
          }}>💾 Save{dirty ? ' (' + dirty + ')' : ''}</button>
          <button onClick={push} disabled={!dirty || pushing || !canPush} title={canPush ? '' : 'Add a WooCommerce API key in the Sync panel to enable push'} style={{
            border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#fff',
            background: 'var(--green)', opacity: (dirty && canPush && !pushing) ? 1 : 0.45,
            cursor: (dirty && canPush && !pushing) ? 'pointer' : 'default',
          }}>{pushing ? 'Pushing…' : '⇧ Push' + (dirty ? ' ' + dirty + ' change' + (dirty === 1 ? '' : 's') : '')}</button>
        </div>
      </div>

      {note && (
        <div style={{
          fontSize: 12, padding: '9px 12px', borderRadius: 8, fontWeight: 600,
          background: note.ok ? 'var(--green-soft)' : 'var(--red-soft)',
          color: note.ok ? 'var(--green)' : 'var(--red)',
        }}>{note.text}</div>
      )}
      {dirty > 0 && !canPush && (
        <div style={{ fontSize: 11.5, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-chip)', color: 'var(--mc-orange-deep)' }}>
          Save keeps these figures in ROS. To push stock out to the website and app,
          add a WooCommerce API key pair in the Sync panel.
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        {[{ id: 'all', name: 'All Products' }, ...events].map(e => (
          <button key={e.id}
            onClick={() => { setTab(e.id); setAssigning(false) }}
            onDoubleClick={() => e.id !== 'all' && renameEvent(e)}
            title={e.id !== 'all' ? 'Double-click to rename' : undefined}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 700, background: 'none', cursor: 'pointer',
              color: tab === e.id ? 'var(--mc-orange-deep)' : 'var(--ink-3)',
              borderBottom: '2px solid ' + (tab === e.id ? 'var(--mc-orange)' : 'transparent'), marginBottom: -1,
            }}>
            {e.name}
            {e.id !== 'all' && <span style={{ ...muted, marginLeft: 6 }}>{e.products.length}</span>}
          </button>
        ))}
        <button onClick={addEvent} style={{
          padding: '10px 14px', fontSize: 13, fontWeight: 700, background: 'none',
          color: 'var(--ink-3)', cursor: 'pointer',
        }}>+ Event</button>
      </div>

      {event && (
        <div className="card" style={{
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: assigning ? 'var(--amber-chip)' : 'var(--surface)',
        }}>
          <div style={{ fontSize: 12 }}>
            <b>{event.name}</b>
            <span style={{ ...muted, marginLeft: 8 }}>
              {assigning
                ? 'Tick the products that go on sale at this event.'
                : event.products.length + ' products selected for this event.'}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button style={sel} onClick={() => setAssigning(v => !v)}>
            {assigning ? '✓ Done' : '✎ Customise products'}
          </button>
        </div>
      )}

      {!live && (
        <div className="card" style={{ ...card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔌</div>
          <b style={{ fontSize: 14 }}>No products synced yet</b>
          <div style={{ ...muted, margin: '6px auto 14px', maxWidth: 380 }}>
            Add the backend URLs for the website and the mobile app source in the Sync
            panel. Once set, products sync automatically whenever this screen opens.
          </div>
        </div>
      )}

      {live && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            ['Total Products', String(items.length), event ? event.name : 'Both backends'],
            ['On Website', String(items.filter(i => i.sources.includes('Website')).length), 'Website backend'],
            ['On Mobile App', String(items.filter(i => i.sources.includes('App')).length), 'App backend'],
            ['Crates On Hand', String(totalCrates), 'ROS stock record'],
            ['Out of Stock', String(items.filter(i => !val(i, 'inStock')).length), 'Needs restock'],
          ].map(([l, v, s]) => (
            <div key={l} className="card" style={{ padding: 14 }}>
              <div style={muted}>{l}</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{v}</div>
              <div style={muted}>{s}</div>
            </div>
          ))}
        </div>
      )}

      {live && event && !assigning && items.length === 0 && (
        <div className="card" style={{ ...card, textAlign: 'center', padding: 34 }}>
          <b style={{ fontSize: 13.5 }}>No products assigned to {event.name} yet</b>
          <div style={{ ...muted, marginTop: 6 }}>
            Press <b>Customise products</b> above to pick what goes on sale at this event.
          </div>
        </div>
      )}

      {catList.map(cat => (
        <div key={cat} className="card" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <b style={{ fontSize: 13.5 }}>{cat}</b>
            <span style={{ ...muted, marginLeft: 8 }}>{rowsFor(cat).length} products</span>
            <div style={{ flex: 1 }} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-3)', fontSize: 10.5 }}>
                {assigning && event && <th style={{ width: 28 }}></th>}
                <th style={{ padding: '6px 4px' }}>Product</th>
                <th>Source</th>
                <th>Price (AED)</th>
                <th>Units</th>
                <th>Crates</th>
                <th>Units / Crate</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {rowsFor(cat).map(i => {
                const k = key(i)
                const on = event ? event.products.includes(k) : true
                const isDirty = !!(drafts[k] && Object.keys(drafts[k]).length)
                const inStock = val(i, 'inStock')
                return (
                  <tr key={cat + i.id + i.name} style={{
                    borderTop: '1px solid var(--line)',
                    opacity: assigning && event && !on ? 0.45 : 1,
                    background: isDirty ? 'var(--amber-chip)' : 'transparent',
                  }}>
                    {assigning && event && (
                      <td>
                        <input type="checkbox" checked={on} onChange={() => toggleProduct(i)}
                          style={{ width: 15, height: 15, cursor: 'pointer' }} />
                      </td>
                    )}
                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {i.img
                          ? <img src={i.img} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} />
                          : <span style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--amber-chip)', display: 'grid', placeItems: 'center', fontSize: 13 }}>🧀</span>}
                        {i.name}
                      </div>
                    </td>
                    <td><SourcePills sources={i.sources} /></td>
                    <td><b>{i.price != null ? i.price.toFixed(2) : '—'}</b></td>
                    <td>
                      <input type="number" min="0" style={numIn}
                        value={val(i, 'qty')}
                        onChange={e => edit(i, 'qty', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" style={numIn}
                        value={val(i, 'crates')}
                        onChange={e => edit(i, 'crates', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="1" style={{ ...numIn, width: 52 }}
                        value={val(i, 'size')}
                        onChange={e => edit(i, 'size', e.target.value)} />
                      <span style={{ ...muted, marginLeft: 6 }}>
                        = {Number(val(i, 'crates') || 0) * Number(val(i, 'size') || 0)} u
                      </span>
                    </td>
                    <td>
                      <select value={inStock ? 'in' : 'out'}
                        onChange={e => edit(i, 'inStock', e.target.value === 'in')}
                        style={{
                          ...sel, padding: '4px 6px', fontSize: 11, fontWeight: 700,
                          color: inStock ? 'var(--green)' : 'var(--red)',
                          background: inStock ? 'var(--green-soft)' : 'var(--red-soft)',
                          border: 'none', borderRadius: 999,
                        }}>
                        <option value="in">In Stock</option>
                        <option value="out">Out of Stock</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
