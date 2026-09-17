import { useState } from 'react'
import {
  loadTrucks, saveTrucks, blankDeployment,
  loadEvents, loadSyncedProducts,
} from '../lib/connectors.js'

/* Screen: Operations › Food Trucks
   Fleet grid — click a truck to open its deployment card. Each truck holds
   one record per event: date, location and an equipment checklist. Events
   are the same list the Inventory screen uses. */

const muted = { color: 'var(--ink-3)', fontSize: 11 }
const sel = { border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff' }
const field = {
  width: '100%', border: '1px solid var(--line)', borderRadius: 8,
  padding: '9px 11px', fontSize: 12.5, outline: 'none',
}

/* Inline truck illustration — stands in until real photos are uploaded. */
function TruckArt({ height = 190 }) {
  return (
    <div style={{
      height, borderRadius: 10, background: '#8C8C93',
      display: 'grid', placeItems: 'center', overflow: 'hidden',
    }}>
      <svg viewBox="0 0 200 120" width="82%" role="img" aria-label="Food truck">
        <rect x="14" y="34" width="128" height="52" rx="6" fill="#D7D7DC" />
        <rect x="142" y="48" width="44" height="38" rx="6" fill="#C4C4CB" />
        <rect x="150" y="54" width="26" height="18" rx="3" fill="#9FA0A8" />
        <rect x="30" y="44" width="88" height="26" rx="3" fill="#F2F2F4" />
        <rect x="24" y="30" width="104" height="7" rx="3" fill="#EDEDF0" />
        <rect x="14" y="86" width="172" height="7" rx="3" fill="#B4B4BC" />
        <circle cx="52" cy="97" r="13" fill="#4A4A52" />
        <circle cx="52" cy="97" r="5" fill="#9FA0A8" />
        <circle cx="158" cy="97" r="13" fill="#4A4A52" />
        <circle cx="158" cy="97" r="5" fill="#9FA0A8" />
      </svg>
    </div>
  )
}

export default function FoodTrucks() {
  const [trucks, setTrucks] = useState(loadTrucks)
  const [openId, setOpenId] = useState(null)
  const [events] = useState(loadEvents)
  const [eventId, setEventId] = useState(events[0] ? events[0].id : '')
  const [draft, setDraft] = useState(null)
  const [newKit, setNewKit] = useState('')
  const [note, setNote] = useState(null)

  const sync = loadSyncedProducts()
  const truck = trucks.find(t => t.id === openId) || null
  const event = events.find(e => e.id === eventId) || null

  const persist = next => { setTrucks(next); saveTrucks(next) }

  const deploymentOf = (t, evId) => (t && t.deployments && t.deployments[evId]) || blankDeployment()

  const open = t => {
    setOpenId(t.id)
    setDraft(JSON.parse(JSON.stringify(deploymentOf(t, eventId))))
    setNote(null)
  }

  const switchEvent = evId => {
    setEventId(evId)
    if (truck) setDraft(JSON.parse(JSON.stringify(deploymentOf(truck, evId))))
  }

  const addTruck = () => {
    const name = window.prompt('Truck name', 'Food Truck-' + String(trucks.length + 1).padStart(3, '0'))
    if (!name || !name.trim()) return
    const id = 'truck-' + Date.now().toString(36)
    persist([...trucks, { id, name: name.trim(), plate: '', deployments: {} }])
  }

  const renameTruck = t => {
    const name = window.prompt('Truck name', t.name)
    if (!name || !name.trim()) return
    persist(trucks.map(x => x.id === t.id ? { ...x, name: name.trim() } : x))
  }

  const removeTruck = t => {
    if (!window.confirm('Remove ' + t.name + ' from the fleet?')) return
    persist(trucks.filter(x => x.id !== t.id))
    if (openId === t.id) setOpenId(null)
  }

  const save = () => {
    persist(trucks.map(t => t.id !== truck.id ? t : {
      ...t,
      deployments: { ...t.deployments, [eventId]: draft },
    }))
    setNote('Saved ' + truck.name + ' for ' + (event ? event.name : 'this event') + '.')
  }

  const toggleKit = i =>
    setDraft(d => ({ ...d, equipment: d.equipment.map((k, n) => n === i ? { ...k, on: !k.on } : k) }))

  const addKit = () => {
    if (!newKit.trim()) return
    setDraft(d => ({ ...d, equipment: [...d.equipment, { name: newKit.trim(), on: true }] }))
    setNewKit('')
  }

  /* ---------- fleet grid ---------- */
  if (!truck) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>Food Trucks</h2>
            <div style={muted}>
              Manage the fleet and plan each truck's deployment per event.
              {' · '}{trucks.length} truck{trucks.length === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <select style={sel} value={eventId} onChange={e => switchEvent(e.target.value)}>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button className="btn-primary" style={{ fontSize: 12.5 }} onClick={addTruck}>+ Add Truck</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {trucks.map(t => {
            const d = deploymentOf(t, eventId)
            const kit = d.equipment.filter(k => k.on).length
            const planned = !!(d.date || d.location)
            return (
              <div key={t.id} className="card" style={{ padding: 12, cursor: 'pointer' }}
                onClick={() => open(t)}>
                <TruckArt height={150} />
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, gap: 6 }}>
                  <b style={{ fontSize: 13.5 }}>{t.name}</b>
                  <div style={{ flex: 1 }} />
                  <span className={'pill ' + (planned ? 'green' : 'gray')}>
                    {planned ? 'Scheduled' : 'Unassigned'}
                  </span>
                </div>
                <div style={{ ...muted, marginTop: 4 }}>
                  {event ? event.name : '—'} · {d.date || 'no date'} · {d.location || 'no location'}
                </div>
                <div style={{ ...muted, marginTop: 2 }}>{kit} equipment items packed</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button style={{ ...sel, fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); renameTruck(t) }}>Rename</button>
                  <button style={{ ...sel, fontSize: 11, color: 'var(--red)' }}
                    onClick={e => { e.stopPropagation(); removeTruck(t) }}>Remove</button>
                </div>
              </div>
            )
          })}
          <button onClick={addTruck} className="card" style={{
            padding: 12, border: '1px dashed var(--line)', background: 'var(--surface-alt)',
            display: 'grid', placeItems: 'center', minHeight: 200, cursor: 'pointer',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 26 }}>🚚</div>
              <b style={{ fontSize: 13 }}>Add another truck</b>
            </div>
          </button>
        </div>
      </div>
    )
  }

  /* ---------- truck detail ---------- */
  const eventProducts = event && sync && sync.items
    ? sync.items.filter(i => event.products.includes(String(i.id) + '|' + i.name))
    : []

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <button onClick={() => setOpenId(null)} style={{
            ...muted, background: 'none', cursor: 'pointer', padding: 0, marginBottom: 2,
          }}>← Food Trucks</button>
          <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>{truck.name}</h2>
          <div style={muted}>Deployment plan for the selected event.</div>
        </div>
        <div style={{ flex: 1 }} />
        <div>
          <div style={{ ...muted, marginBottom: 3 }}>Event</div>
          <select style={{ ...sel, minWidth: 200 }} value={eventId} onChange={e => switchEvent(e.target.value)}>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <button className="btn-primary" style={{ fontSize: 12.5, alignSelf: 'flex-end' }} onClick={save}>
          💾 Save deployment
        </button>
      </div>

      {note && (
        <div style={{
          fontSize: 12, padding: '9px 12px', borderRadius: 8, fontWeight: 600,
          background: 'var(--green-soft)', color: 'var(--green)',
        }}>{note}</div>
      )}

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 1fr 1fr', gap: 0 }}>
          {/* truck */}
          <div style={{ paddingRight: 18 }}>
            <TruckArt />
            <div style={{ marginTop: 10 }}>
              <b style={{ fontSize: 13.5 }}>{truck.name}</b>
              <div style={muted}>Placeholder image — upload a photo later</div>
            </div>
          </div>

          {/* date */}
          <div style={{ padding: '0 18px', borderLeft: '1px solid var(--line)' }}>
            <b style={{ fontSize: 13.5 }}>Date</b>
            <div style={{ ...muted, margin: '4px 0 8px' }}>When the truck is on site.</div>
            <input type="date" style={field} value={draft.date}
              onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
            {draft.date && (
              <div style={{ ...muted, marginTop: 6 }}>
                {new Date(draft.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>

          {/* location */}
          <div style={{ padding: '0 18px', borderLeft: '1px solid var(--line)' }}>
            <b style={{ fontSize: 13.5 }}>Location</b>
            <div style={{ ...muted, margin: '4px 0 8px' }}>Site, pitch or stand number.</div>
            <input style={field} placeholder="e.g. Dubai Bluewaters — Pitch 4"
              value={draft.location}
              onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} />
            {event && (
              <div style={{ ...muted, marginTop: 10 }}>
                {eventProducts.length
                  ? eventProducts.length + ' products assigned to ' + event.name + ' on Inventory'
                  : 'No products assigned to ' + event.name + ' yet'}
              </div>
            )}
          </div>

          {/* equipment */}
          <div style={{ padding: '0 0 0 18px', borderLeft: '1px solid var(--line)' }}>
            <b style={{ fontSize: 13.5 }}>Equipment</b>
            <div style={{ ...muted, margin: '4px 0 8px' }}>
              {draft.equipment.filter(k => k.on).length} of {draft.equipment.length} packed.
            </div>
            <div style={{ display: 'grid', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
              {draft.equipment.map((k, i) => (
                <label key={k.name + i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  color: k.on ? 'var(--ink)' : 'var(--ink-3)', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={k.on} onChange={() => toggleKit(i)}
                    style={{ width: 15, height: 15, cursor: 'pointer' }} />
                  {k.name}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input style={{ ...field, fontSize: 12 }} placeholder="Add equipment…"
                value={newKit} onChange={e => setNewKit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKit()} />
              <button style={sel} onClick={addKit}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
