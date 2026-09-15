import { useState, useEffect, useRef } from 'react'
import {
  fetchOrders, setOrderStatus, setOrderTruck, ORDER_STATES, orderState, nextOrderState,
  hasApiToken, loadEvents, loadTrucks, trucksAtEvent,
} from '../lib/connectors.js'

/* Screen: Live Orders

   Orders placed in the customer apps, as they arrive. This is a working
   screen — someone stands at a truck with it open — so the priorities are
   different from the rest of the console:

     - The next action is one tap, and it is the big button.
     - Collection code is the largest thing on the card, because that is what
       the customer says out loud.
     - It refreshes itself. Nobody should have to remember to press reload
       while handing over food.
     - Nothing here destroys anything. Cancel is a status change, and the
       order stays in WooCommerce.

   Deliberately not on this screen: totals, refunds, customer records. Those
   live in WooCommerce, which already does them properly. */

const REFRESH_MS = 20000

const muted = { color: 'var(--ink-3)', fontSize: 11 }

const TONES = {
  amber: ['var(--amber-chip)', 'var(--mc-orange-deep)'],
  blue:  ['var(--blue-soft)',  'var(--blue)'],
  green: ['var(--green-soft)', 'var(--green)'],
  red:   ['var(--red-soft)',   'var(--red)'],
  gray:  ['var(--bg)',         'var(--ink-3)'],
}

function Pill({ tone, children }) {
  const [bg, fg] = TONES[tone] || TONES.gray
  return (
    <span style={{
      background: bg, color: fg, borderRadius: 999, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export default function LiveOrders() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('on-hold')
  const [eventId, setEventId] = useState('')
  const [truckId, setTruckId] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [lastAt, setLastAt] = useState(null)
  const timer = useRef(null)

  const connected = hasApiToken()
  const events = loadEvents()

  const load = async (quiet) => {
    if (!connected) return
    if (!quiet) setLoading(true)
    const res = await fetchOrders({
      status: filter === 'all' ? null : filter,
      event: eventId || null,
      truck: truckId || null,
    })
    setLoading(false)
    setLastAt(Date.now())
    if (res.ok) {
      setOrders(res.orders)
      setStatus(null)
    } else {
      setStatus(res)
    }
  }

  /* Poll rather than push. A websocket would be better but needs
     infrastructure this host does not have; twenty seconds is well inside
     the time it takes to cook, and the quiet flag stops the list flickering
     under someone's finger. */
  useEffect(() => {
    load(false)
    clearInterval(timer.current)
    timer.current = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, eventId, truckId, connected])

  const advance = async (order, to) => {
    setBusyId(order.order_id)
    const res = await setOrderStatus(order.order_id, to)
    setBusyId(null)
    if (!res.ok) { setStatus(res); return }
    // Replace in place so the row does not jump while being looked at.
    setOrders(list => list.map(o => o.order_id === res.order.order_id ? res.order : o))
  }

  const assign = async (order, truckId) => {
    setBusyId(order.order_id)
    const res = await setOrderTruck(order.order_id, truckId)
    setBusyId(null)
    if (!res.ok) { setStatus(res); return }
    setOrders(list => list.map(o => o.order_id === res.order.order_id ? res.order : o))
  }

  const counts = ORDER_STATES.reduce((acc, s) => {
    acc[s.id] = orders.filter(o => o.status === s.id).length
    return acc
  }, {})

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 19, fontWeight: 800 }}>Live Orders</h1>
        {loading && <span style={muted}>Loading…</span>}
        <div style={{ flex: 1 }} />
        <span style={muted}>
          {lastAt ? 'Updated ' + new Date(lastAt).toLocaleTimeString() : ''}
          {' · refreshes every ' + (REFRESH_MS / 1000) + 's'}
        </span>
        <button onClick={() => load(false)} style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: '6px 11px',
          fontSize: 11.5, background: '#fff', cursor: 'pointer',
        }}>Refresh</button>
      </div>

      <div style={{ ...muted, marginBottom: 16, lineHeight: 1.5 }}>
        Orders from the customer apps. Payment is taken at the truck, so every
        order arrives as <b>Received</b> and is walked forward from here.
      </div>

      {!connected && (
        <Callout tone="amber">
          No API token yet. Add one in <b>Sync → App publishing</b> to see orders.
        </Callout>
      )}

      {status && !status.ok && <Callout tone="red">{status.message}</Callout>}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Seg
          options={[['on-hold', 'Received' + (counts['on-hold'] ? ' · ' + counts['on-hold'] : '')],
                    ['processing', 'Preparing' + (counts['processing'] ? ' · ' + counts['processing'] : '')],
                    ['completed', 'Collected'],
                    ['all', 'All']]}
          value={filter}
          onChange={setFilter}
        />
        <div style={{ flex: 1 }} />
        <select value={truckId} onChange={e => setTruckId(e.target.value)} style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
          fontSize: 12, background: '#fff',
        }}>
          <option value="">All trucks</option>
          <option value="unassigned">Unassigned only</option>
          {loadTrucks().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={eventId} onChange={e => setEventId(e.target.value)} style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
          fontSize: 12, background: '#fff',
        }}>
          <option value="">All events</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      {connected && !orders.length && !loading && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛎</div>
          <b style={{ fontSize: 14 }}>Nothing here yet</b>
          <div style={{ ...muted, marginTop: 6, lineHeight: 1.6, maxWidth: 460, margin: '6px auto 0' }}>
            {filter === 'all'
              ? 'No app orders have come through. The apps need a build that submits orders before anything appears here.'
              : 'No orders in this state right now.'}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {orders.map(o => (
          <OrderCard
            key={o.order_id}
            order={o}
            busy={busyId === o.order_id}
            onAdvance={advance}
            onAssign={assign}
          />
        ))}
      </div>
    </div>
  )
}

/* ---------------- one order ---------------- */

function OrderCard({ order, busy, onAdvance, onAssign }) {
  const state = orderState(order.status)
  const next = nextOrderState(order.status)
  const nextLabel = next ? orderState(next).label : null
  const done = order.status === 'completed' || order.status === 'cancelled'

  const placed = order.placed_at ? new Date(order.placed_at) : null
  const minsAgo = placed ? Math.round((Date.now() - placed.getTime()) / 60000) : null

  return (
    <div className="card" style={{ padding: 14, display: 'flex', gap: 16, alignItems: 'flex-start' }}>

      {/* The code is what gets said out loud, so it is the biggest thing here. */}
      <div style={{ minWidth: 104 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>
          {order.collection_code || '—'}
        </div>
        <div style={{ ...muted, marginTop: 2 }}>#{order.order_id}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <Pill tone={state.tone}>{state.label}</Pill>
          {order.customer && <b style={{ fontSize: 13 }}>{order.customer}</b>}
          {order.platform && <span style={muted}>{order.platform}</span>}
          {minsAgo != null && (
            /* Ageing matters when someone is waiting. Past ten minutes on an
               uncollected order, say so plainly rather than in grey. */
            <span style={{
              ...muted,
              color: !done && minsAgo >= 10 ? 'var(--red)' : 'var(--ink-3)',
              fontWeight: !done && minsAgo >= 10 ? 700 : 400,
            }}>
              {minsAgo < 1 ? 'just now' : minsAgo + ' min ago'}
            </span>
          )}
        </div>

        <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
          {(order.items || []).map((it, i) => (
            <div key={i}>
              <b>{it.quantity}×</b> {it.name}
            </div>
          ))}
        </div>

        {order.phone && <div style={{ ...muted, marginTop: 6 }}>{order.phone}</div>}

        {/* Assignment is manual. The list is limited to trucks actually
            deployed to this order's event, and the server re-checks that —
            a truck that is not at the venue is a wasted trip. */}
        {!done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={muted}>Truck</span>
            <select
              value={order.truck || ''}
              disabled={busy}
              onChange={e => onAssign(order, e.target.value)}
              style={{
                border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px',
                fontSize: 12, background: '#fff',
                color: order.truck ? 'var(--ink)' : 'var(--ink-3)',
              }}>
              <option value="">Unassigned</option>
              {trucksAtEvent(order.event).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {!order.truck && <span style={{ ...muted, color: 'var(--mc-orange-deep)' }}>needs a truck</span>}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
          {order.total} {order.currency}
        </div>

        {next && (
          <button
            onClick={() => onAdvance(order, next)}
            disabled={busy}
            style={{
              background: 'var(--mc-orange)', color: '#fff', fontWeight: 700,
              fontSize: 12.5, padding: '9px 16px', borderRadius: 8,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}>
            {busy ? 'Saving…' : 'Mark ' + nextLabel}
          </button>
        )}

        {!done && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => onAdvance(order, 'cancelled')}
              disabled={busy}
              style={{
                fontSize: 11, color: 'var(--red)', fontWeight: 700,
                cursor: busy ? 'default' : 'pointer', background: 'none',
              }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- bits ---------------- */

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg)', borderRadius: 8, padding: 2 }}>
      {options.map(([id, label]) => {
        const on = id === value
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: 'pointer',
            padding: '7px 13px', borderRadius: 7,
            background: on ? 'var(--mc-orange)' : 'transparent',
            color: on ? '#fff' : 'var(--ink-2)',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

function Callout({ tone, children }) {
  const [bg, fg] = TONES[tone] || TONES.gray
  return (
    <div style={{
      background: bg, color: fg, borderRadius: 8, padding: '10px 12px',
      fontSize: 11.5, lineHeight: 1.55, marginBottom: 14,
    }}>{children}</div>
  )
}
